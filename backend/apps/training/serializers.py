from rest_framework import serializers

from .models import TrainingJob


class PredictionInputSerializer(serializers.Serializer):
    features = serializers.DictField()


class ImageSampleUploadSerializer(serializers.Serializer):
    class_name = serializers.CharField(max_length=80, trim_whitespace=True)
    image = serializers.FileField()


class ImagePredictionSerializer(serializers.Serializer):
    image = serializers.FileField()


class TrainingJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrainingJob
        fields = (
            "id",
            "model",
            "status",
            "progress",
            "algorithm",
            "metrics",
            "error_message",
            "started_at",
            "completed_at",
            "created_at",
        )
        read_only_fields = fields
