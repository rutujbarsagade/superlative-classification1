from django.urls import path

from .views import (
    ImagePredictionView,
    ImageSampleDeleteView,
    ImageSamplesView,
    MetricsView,
    PredictionSchemaView,
    PredictionView,
    TrainingView,
)


urlpatterns = [
    path("<int:model_id>/training/", TrainingView.as_view(), name="model-training"),
    path("<int:model_id>/metrics/", MetricsView.as_view(), name="model-metrics"),
    path("<int:model_id>/images/", ImageSamplesView.as_view(), name="model-image-samples"),
    path(
        "<int:model_id>/images/<int:sample_id>/",
        ImageSampleDeleteView.as_view(),
        name="model-image-sample-delete",
    ),
    path(
        "<int:model_id>/prediction/image/",
        ImagePredictionView.as_view(),
        name="model-image-prediction",
    ),
    path(
        "<int:model_id>/prediction/schema/",
        PredictionSchemaView.as_view(),
        name="model-prediction-schema",
    ),
    path(
        "<int:model_id>/prediction/",
        PredictionView.as_view(),
        name="model-prediction",
    ),
]
