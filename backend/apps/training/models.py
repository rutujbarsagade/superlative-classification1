from django.db import models


class TrainingStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    RUNNING = "RUNNING", "Running"
    COMPLETED = "COMPLETED", "Completed"
    FAILED = "FAILED", "Failed"


class ImageSample(models.Model):
    model = models.ForeignKey(
        "models.MLModel",
        on_delete=models.CASCADE,
        related_name="image_samples",
    )
    class_name = models.CharField(max_length=80)
    storage_path = models.CharField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [models.Index(fields=["model", "class_name"])]


class TrainingJob(models.Model):
    model = models.ForeignKey(
        "models.MLModel",
        on_delete=models.CASCADE,
        related_name="training_jobs",
    )
    status = models.CharField(
        max_length=20,
        choices=TrainingStatus.choices,
        default=TrainingStatus.PENDING,
        db_index=True,
    )
    progress = models.PositiveSmallIntegerField(default=0)
    algorithm = models.CharField(max_length=50, default="RANDOM_FOREST")
    metrics = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["model", "status"])]

    def __str__(self) -> str:
        return f"{self.model.name} training job"
