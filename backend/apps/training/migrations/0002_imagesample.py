from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("models", "0001_initial"),
        ("training", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="ImageSample",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("class_name", models.CharField(max_length=80)),
                ("storage_path", models.CharField(max_length=500)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("model", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="image_samples", to="models.mlmodel")),
            ],
            options={
                "ordering": ["created_at"],
                "indexes": [models.Index(fields=["model", "class_name"], name="training_im_model_i_503791_idx")],
            },
        ),
    ]