"""Image sample storage, training, and prediction operations."""

import logging
import math
import os
import tempfile
import uuid
from collections import Counter
from pathlib import Path

import joblib
import numpy as np
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from sklearn.metrics import accuracy_score, confusion_matrix
from sklearn.calibration import CalibratedClassifierCV
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC

from apps.models.models import MLModel, ModelStatus, ModelType
from apps.models.services import ModelCapacityError, ensure_model_capacity
from ml.images import (
    MOBILENET_WEIGHTS,
    ImageValidationError,
    image_features,
    normalize_uploaded_image,
)

from .models import ImageSample, TrainingJob, TrainingStatus
from .services import TrainingError, artifact_path_for_model


logger = logging.getLogger("superlative.training")


def _image_storage_path(reference: str) -> Path:
    root = Path(settings.STORAGE_ROOT).resolve()
    path = (root / reference).resolve()
    if not path.is_relative_to(root):
        raise ImageValidationError("The image storage path is invalid.")
    return path


def save_image_sample(model: MLModel, class_name: str, uploaded_file) -> ImageSample:
    with transaction.atomic():
        locked_model = MLModel.objects.select_for_update().get(pk=model.pk)
        if locked_model.model_type != ModelType.IMAGE:
            raise ImageValidationError("Images can only be added to image models.")
        if locked_model.status in {ModelStatus.TRAINING, ModelStatus.VALIDATING}:
            raise ImageValidationError("Images cannot be added while the model is processing.")

        relative_path = Path("datasets") / str(locked_model.pk) / "images" / f"{uuid.uuid4().hex}.jpg"
        destination = _image_storage_path(str(relative_path))
        temporary = destination.with_suffix(".jpg.tmp")
        max_bytes = getattr(settings, "MAX_IMAGE_UPLOAD_BYTES", 5 * 1024 * 1024)
        try:
            normalize_uploaded_image(uploaded_file, temporary, max_bytes)
            ensure_model_capacity(locked_model.owner, additional_bytes=temporary.stat().st_size)
            os.replace(temporary, destination)
            try:
                return ImageSample.objects.create(
                    model=locked_model,
                    class_name=class_name.strip(),
                    storage_path=str(relative_path),
                )
            except Exception:
                destination.unlink(missing_ok=True)
                raise
        except Exception:
            temporary.unlink(missing_ok=True)
            raise


def image_sample_summary(model: MLModel) -> dict:
    samples = list(model.image_samples.all())
    counts = Counter(sample.class_name for sample in samples)
    return {
        "samples": [
            {
                "id": sample.id,
                "class_name": sample.class_name,
                "created_at": sample.created_at,
            }
            for sample in samples
        ],
        "class_counts": dict(sorted(counts.items())),
        "sample_count": len(samples),
        "model_status": model.status,
    }


def delete_image_sample(model: MLModel, sample_id: int) -> None:
    with transaction.atomic():
        locked_model = MLModel.objects.select_for_update().get(pk=model.pk)
        if locked_model.status in {ModelStatus.TRAINING, ModelStatus.VALIDATING}:
            raise ImageValidationError("Images cannot be removed while the model is processing.")
        try:
            sample = locked_model.image_samples.get(pk=sample_id)
        except ImageSample.DoesNotExist as exc:
            raise ImageValidationError("Image sample not found.") from exc
        path = _image_storage_path(sample.storage_path)
        sample.delete()
    path.unlink(missing_ok=True)


def start_image_training(model: MLModel) -> TrainingJob:
    if model.model_type != ModelType.IMAGE:
        raise TrainingError("Only image models can use image training.")

    with transaction.atomic():
        locked_model = MLModel.objects.select_for_update().get(pk=model.pk)
        if locked_model.status not in {
            ModelStatus.DRAFT,
            ModelStatus.FAILED,
            ModelStatus.TRAINED,
        }:
            raise TrainingError("Only draft, failed, or trained models can be trained.")
        job = TrainingJob.objects.create(
            model=locked_model,
            status=TrainingStatus.RUNNING,
            progress=10,
            algorithm="MOBILENET_V2_SVC",
            started_at=timezone.now(),
        )
        locked_model.status = ModelStatus.TRAINING
        locked_model.save(update_fields=["status", "updated_at"])

    previous_artifact_available = False
    temporary_artifact = None
    final_artifact = None
    backup_artifact = None
    artifact_replaced = False
    backup_created = False
    try:
        samples = list(locked_model.image_samples.all())
        class_counts = Counter(sample.class_name for sample in samples)
        classes = sorted(class_counts)
        if len(classes) < 2:
            raise TrainingError("Add images for at least two different classes.")
        if any(count < 2 for count in class_counts.values()):
            raise TrainingError("Capture at least two images for every class before training.")

        vectors = np.asarray(
            [image_features(_image_storage_path(sample.storage_path)) for sample in samples]
        )
        labels = np.asarray([sample.class_name for sample in samples])
        test_size = min(len(samples) - len(classes), max(len(classes), math.ceil(len(samples) * 0.25)))
        train_vectors, test_vectors, train_labels, test_labels = train_test_split(
            vectors,
            labels,
            test_size=test_size,
            random_state=42,
            stratify=labels,
        )
        evaluation_model = make_pipeline(
            StandardScaler(),
            SVC(C=4.0, class_weight="balanced", random_state=42),
        )
        evaluation_model.fit(train_vectors, train_labels)
        predictions = evaluation_model.predict(test_vectors)
        accuracy = float(accuracy_score(test_labels, predictions))
        matrix = confusion_matrix(test_labels, predictions, labels=classes).tolist()
        job.progress = 65
        job.save(update_fields=["progress"])

        pipeline = make_pipeline(
            StandardScaler(),
            CalibratedClassifierCV(
                SVC(C=4.0, class_weight="balanced", random_state=42),
                method="sigmoid",
                cv=2,
            ),
        )
        pipeline.fit(vectors, labels)

        relative_artifact, final_artifact = artifact_path_for_model(locked_model)
        final_artifact.parent.mkdir(parents=True, exist_ok=True)
        temporary_artifact = final_artifact.with_suffix(".joblib.tmp")
        backup_artifact = final_artifact.with_suffix(".joblib.previous")
        previous_artifact_available = bool(locked_model.artifact_reference) and final_artifact.exists()
        joblib.dump(pipeline, temporary_artifact)
        artifact_size = temporary_artifact.stat().st_size
        try:
            ensure_model_capacity(
                locked_model.owner,
                additional_bytes=artifact_size,
                check_model_count=False,
                exclude_references={locked_model.artifact_reference}
                if locked_model.artifact_reference
                else set(),
            )
        except ModelCapacityError as exc:
            raise TrainingError(str(exc)) from exc

        if final_artifact.exists():
            backup_artifact.unlink(missing_ok=True)
            os.replace(final_artifact, backup_artifact)
            backup_created = True
        os.replace(temporary_artifact, final_artifact)
        artifact_replaced = True
        temporary_artifact = None

        metrics = {
            "accuracy": accuracy,
            "confusion_matrix": matrix,
            "class_labels": classes,
            "evaluation_samples": len(test_labels),
        }
        metadata = dict(locked_model.metadata or {})
        metadata.update(
            {
                "image_classifier": "MobileNetV2 features + calibrated RBF SVM",
                "image_feature_extractor": "MobileNetV2",
                "image_feature_weights": MOBILENET_WEIGHTS,
                "image_classes": classes,
                "image_class_counts": dict(sorted(class_counts.items())),
                "image_sample_count": len(samples),
                "holdout_accuracy": accuracy,
                "trained_at": timezone.now().isoformat(),
            }
        )
        with transaction.atomic():
            locked_model.status = ModelStatus.TRAINED
            locked_model.artifact_reference = relative_artifact
            locked_model.algorithm = "MOBILENET_V2_SVC"
            locked_model.metadata = metadata
            locked_model.save(
                update_fields=["status", "artifact_reference", "algorithm", "metadata", "updated_at"]
            )
            job.status = TrainingStatus.COMPLETED
            job.progress = 100
            job.metrics = metrics
            job.completed_at = timezone.now()
            job.save(update_fields=["status", "progress", "metrics", "completed_at"])
        if backup_artifact:
            backup_artifact.unlink(missing_ok=True)
    except Exception as exc:
        if final_artifact is not None and backup_artifact is not None:
            if artifact_replaced:
                final_artifact.unlink(missing_ok=True)
            if backup_created and backup_artifact.exists():
                os.replace(backup_artifact, final_artifact)
        if temporary_artifact is not None:
            temporary_artifact.unlink(missing_ok=True)
        if not previous_artifact_available and locked_model.artifact_reference and final_artifact:
            previous_artifact_available = final_artifact.is_file()
        message = (
            str(exc)
            if isinstance(exc, (TrainingError, ImageValidationError))
            else "Image training failed. Check the sample images and try again."
        )
        with transaction.atomic():
            job.status = TrainingStatus.FAILED
            job.error_message = message
            job.completed_at = timezone.now()
            job.save(update_fields=["status", "error_message", "completed_at"])
            locked_model.status = ModelStatus.TRAINED if previous_artifact_available else ModelStatus.FAILED
            locked_model.save(update_fields=["status", "updated_at"])
        logger.exception("Image training job %s failed", job.pk)
        raise TrainingError(message) from exc

    return job


def predict_image(model: MLModel, uploaded_file) -> dict:
    if model.model_type != ModelType.IMAGE or model.status != ModelStatus.TRAINED:
        raise ImageValidationError("This image model is not trained yet.")
    metadata = model.metadata or {}
    if (
        metadata.get("image_feature_extractor") != "MobileNetV2"
        or metadata.get("image_feature_weights") != MOBILENET_WEIGHTS
    ):
        raise ImageValidationError(
            "This image model uses an older feature extractor. Retrain it with MobileNetV2 before predicting."
        )
    classes = metadata.get("image_classes") or []
    expected_reference, artifact_path = artifact_path_for_model(model)
    if model.artifact_reference != expected_reference or not artifact_path.is_file() or not classes:
        raise ImageValidationError("The trained image model artifact is unavailable.")

    with tempfile.TemporaryDirectory() as temporary_directory:
        image_path = Path(temporary_directory) / "input.jpg"
        normalize_uploaded_image(
            uploaded_file,
            image_path,
            getattr(settings, "MAX_IMAGE_UPLOAD_BYTES", 5 * 1024 * 1024),
        )
        features = image_features(image_path).reshape(1, -1)

    try:
        pipeline = joblib.load(artifact_path)
        predicted_class = str(pipeline.predict(features)[0])
        probabilities = pipeline.predict_proba(features)[0]
        class_probabilities = {
            str(label): float(probability)
            for label, probability in zip(pipeline.classes_, probabilities)
        }
    except Exception as exc:
        raise ImageValidationError("The image prediction could not be completed.") from exc

    return {
        "model_id": model.id,
        "model_name": model.name,
        "predicted_class": predicted_class,
        "probability": class_probabilities.get(predicted_class),
        "probabilities": class_probabilities,
    }