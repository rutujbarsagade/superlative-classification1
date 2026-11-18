"""Image validation and feature extraction for image classifiers."""

from threading import Lock
from pathlib import Path

import numpy as np
from PIL import Image, UnidentifiedImageError


_MOBILENET_ENCODER = None
_MOBILENET_PREPROCESS = None
_MOBILENET_LOCK = Lock()
MOBILENET_WEIGHTS = "IMAGENET1K_V2"
MAX_IMAGE_DIMENSION = 4096
ALLOWED_IMAGE_FORMATS = {"JPEG", "PNG", "WEBP"}


class ImageValidationError(Exception):
    """Raised when an uploaded image is invalid or unsupported."""


def normalize_uploaded_image(uploaded_file, destination: Path, max_bytes: int) -> None:
    if uploaded_file.size > max_bytes:
        raise ImageValidationError("Image files must be 5 MB or smaller.")
    try:
        with Image.open(uploaded_file) as image:
            if image.format not in ALLOWED_IMAGE_FORMATS:
                raise ImageValidationError("Use a JPEG, PNG, or WebP image.")
            if max(image.size) > MAX_IMAGE_DIMENSION:
                raise ImageValidationError("Image dimensions must be 4096 pixels or smaller.")
            image.load()
            normalized = image.convert("RGB")
            normalized.thumbnail((1024, 1024))
            destination.parent.mkdir(parents=True, exist_ok=True)
            normalized.save(destination, format="JPEG", quality=88, optimize=True)
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise ImageValidationError("The uploaded file is not a valid image.") from exc


def image_features(image_path: Path) -> np.ndarray:
    try:
        with Image.open(image_path) as image:
            rgb_image = image.convert("RGB")
    except (UnidentifiedImageError, OSError) as exc:
        raise ImageValidationError("A stored training image could not be read.") from exc

    encoder, preprocess, torch = _load_mobilenet_encoder()
    try:
        image_tensor = preprocess(rgb_image).unsqueeze(0)
        with torch.inference_mode():
            return encoder(image_tensor).squeeze(0).cpu().numpy()
    except Exception as exc:
        raise ImageValidationError("MobileNetV2 could not extract features from the image.") from exc


def _load_mobilenet_encoder():
    global _MOBILENET_ENCODER, _MOBILENET_PREPROCESS

    if _MOBILENET_ENCODER is not None:
        import torch

        return _MOBILENET_ENCODER, _MOBILENET_PREPROCESS, torch

    with _MOBILENET_LOCK:
        if _MOBILENET_ENCODER is not None:
            import torch

            return _MOBILENET_ENCODER, _MOBILENET_PREPROCESS, torch

        try:
            import torch
            from torchvision.models import MobileNet_V2_Weights, mobilenet_v2
        except (ImportError, OSError, RuntimeError) as exc:
            raise ImageValidationError(
                "MobileNetV2 dependencies are unavailable. Install compatible torch and torchvision packages."
            ) from exc

        weights = getattr(MobileNet_V2_Weights, MOBILENET_WEIGHTS)
        try:
            encoder = mobilenet_v2(weights=weights)
        except Exception as exc:
            raise ImageValidationError(
                "Pretrained MobileNetV2 weights are unavailable. Allow the server to download them or pre-cache the weights."
            ) from exc

        encoder.classifier = torch.nn.Identity()
        encoder.eval()
        _MOBILENET_ENCODER = encoder
        _MOBILENET_PREPROCESS = weights.transforms()
        return _MOBILENET_ENCODER, _MOBILENET_PREPROCESS, torch