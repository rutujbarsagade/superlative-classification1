# Superlative Classification Platform

A classification platform for tabular and image models. CSV models validate a
dataset, compare algorithms, and train a prediction pipeline. Image models collect
labeled camera or uploaded images, train an image classifier, and classify new images.

## Repository layout

- `backend/` — Django REST API with a custom user model, developer registration
  and approval workflow, JWT authentication, CSV and image training, metrics, and
  prediction endpoints, plus PostgreSQL settings and environment templates.
- `frontend/` — React/Vite/Tailwind single-page app with protected
  authentication routing.
- `storage/` — filesystem boundary for datasets and trained model artifacts.
  Large files are not stored in PostgreSQL.

See [`backend/README.md`](backend/README.md) and
[`frontend/README.md`](frontend/README.md) for setup commands.

## Fresh checkout setup (Windows)

Environment files are intentionally not committed so credentials stay local.
The example below uses PostgreSQL and console email for local development.
Install and start PostgreSQL first, then set `POSTGRES_PASSWORD` in
`backend\.env` (and adjust the connection settings if needed):

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
Push-Location frontend
npm.cmd ci
Pop-Location
$env:DJANGO_SETTINGS_MODULE = "config.settings.development"
.\.venv\Scripts\python.exe backend\manage.py migrate
.\.venv\Scripts\python.exe backend\manage.py createsuperuser
```

In separate terminals, start the backend with
`.\.venv\Scripts\python.exe backend\manage.py runserver` and the frontend with
`Set-Location frontend; npm.cmd run dev`. Verification emails are printed in the
backend terminal. Do not deploy using the development environment template.

Developer registration, email verification, and Super Admin approval are implemented.
Super Admin accounts are provisioned with Django's `createsuperuser` command.
The Super Admin dashboard provides separate CSV and image model creation flows.

## CSV workflow

1. Register and verify the developer email.
2. Sign in after a Super Admin approves the account.
3. Create a CSV model.
4. Upload and validate a CSV dataset.
5. Select and validate the target column and task type.
6. Compare supported algorithms and train the best-performing pipeline.
7. Review classification or regression metrics and the confusion matrix when applicable.
8. Generate predictions through the dynamic feature form.

## Image workflow

1. A Super Admin creates an image model and enters class names.
2. Capture examples with the laptop camera or upload image files.
3. Add at least two images for each of two or more classes.
4. Start training; the backend extracts pretrained MobileNetV2 features, trains
   a calibrated SVM, and reports holdout accuracy and a confusion matrix.
5. Upload a test image to view its predicted class and class probabilities.

## Security

See [SECURITY.md](SECURITY.md) for the vulnerability reporting policy. CI runs
tests, Gitleaks scans repository history, CodeQL analyzes Python code, and
Dependabot monitors dependencies and Actions.