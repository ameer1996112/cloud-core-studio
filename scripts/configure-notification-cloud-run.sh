#!/usr/bin/env bash
set -euo pipefail

# Required: NOTIFICATION_JOB_IMAGE, for example:
# me-west1-docker.pkg.dev/cloudandcorestudio/cloud-core/cloud-core-studio:20260719120000
PROJECT_ID="${GCP_PROJECT_ID:-cloudandcorestudio}"
REGION="${GCP_REGION:-me-west1}"
APP_SERVICE="${CLOUD_RUN_SERVICE:-cloud-core-studio}"
JOB_NAME="${NOTIFICATION_JOB_NAME:-cloud-core-notification-sweep}"
SCHEDULER_JOB="${NOTIFICATION_SCHEDULER_JOB:-cloud-core-notification-sweep-15m}"
SCHEDULE="${NOTIFICATION_SCHEDULE:-*/15 * * * *}"
SECRET_NAME="${NOTIFICATION_SECRET_NAME:-notification-automation-token}"
JOB_SERVICE_ACCOUNT_NAME="${NOTIFICATION_JOB_SERVICE_ACCOUNT:-notification-sweep-job}"
SCHEDULER_SERVICE_ACCOUNT_NAME="${NOTIFICATION_SCHEDULER_SERVICE_ACCOUNT:-notification-scheduler}"
IMAGE="${NOTIFICATION_JOB_IMAGE:?Set NOTIFICATION_JOB_IMAGE to the deployed application image}"

gcloud services enable run.googleapis.com cloudscheduler.googleapis.com secretmanager.googleapis.com \
  --project "$PROJECT_ID"

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
JOB_SERVICE_ACCOUNT="${JOB_SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
SCHEDULER_SERVICE_ACCOUNT="${SCHEDULER_SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

if ! gcloud iam service-accounts describe "$JOB_SERVICE_ACCOUNT" --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$JOB_SERVICE_ACCOUNT_NAME" \
    --display-name "Member notification sweep job" --project "$PROJECT_ID"
fi

if ! gcloud iam service-accounts describe "$SCHEDULER_SERVICE_ACCOUNT" --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$SCHEDULER_SERVICE_ACCOUNT_NAME" \
    --display-name "Member notification scheduler" --project "$PROJECT_ID"
fi

if ! gcloud secrets describe "$SECRET_NAME" --project "$PROJECT_ID" >/dev/null 2>&1; then
  echo "Missing Secret Manager secret: $SECRET_NAME" >&2
  echo "Create it first; this script never accepts the secret value on the command line." >&2
  exit 1
fi

gcloud secrets add-iam-policy-binding "$SECRET_NAME" \
  --member "serviceAccount:$JOB_SERVICE_ACCOUNT" \
  --role roles/secretmanager.secretAccessor --project "$PROJECT_ID" >/dev/null

APP_SERVICE_ACCOUNT="$(gcloud run services describe "$APP_SERVICE" \
  --region "$REGION" --project "$PROJECT_ID" \
  --format='value(spec.template.spec.serviceAccountName)')"
if [[ -z "$APP_SERVICE_ACCOUNT" ]]; then
  APP_SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
fi

gcloud secrets add-iam-policy-binding "$SECRET_NAME" \
  --member "serviceAccount:$APP_SERVICE_ACCOUNT" \
  --role roles/secretmanager.secretAccessor --project "$PROJECT_ID" >/dev/null

gcloud run services update "$APP_SERVICE" \
  --region "$REGION" --project "$PROJECT_ID" \
  --update-secrets "NOTIFICATION_AUTOMATION_TOKEN=${SECRET_NAME}:latest" >/dev/null

SERVICE_URL="$(gcloud run services describe "$APP_SERVICE" \
  --region "$REGION" --project "$PROJECT_ID" --format='value(status.url)')"

gcloud run jobs deploy "$JOB_NAME" \
  --image "$IMAGE" --region "$REGION" --project "$PROJECT_ID" \
  --service-account "$JOB_SERVICE_ACCOUNT" \
  --command node --args scripts/member-notification-cron.mjs \
  --set-env-vars "CLOUD_CORE_BASE_URL=${SERVICE_URL},NOTIFICATION_SWEEP_LIMIT=50" \
  --set-secrets "NOTIFICATION_AUTOMATION_TOKEN=${SECRET_NAME}:latest" \
  --task-timeout 10m --max-retries 1 >/dev/null

gcloud run jobs add-iam-policy-binding "$JOB_NAME" \
  --region "$REGION" --project "$PROJECT_ID" \
  --member "serviceAccount:$SCHEDULER_SERVICE_ACCOUNT" --role roles/run.invoker >/dev/null

gcloud iam service-accounts add-iam-policy-binding "$SCHEDULER_SERVICE_ACCOUNT" \
  --member "serviceAccount:service-${PROJECT_NUMBER}@gcp-sa-cloudscheduler.iam.gserviceaccount.com" \
  --role roles/iam.serviceAccountTokenCreator --project "$PROJECT_ID" >/dev/null

RUN_URI="https://run.googleapis.com/v2/projects/${PROJECT_ID}/locations/${REGION}/jobs/${JOB_NAME}:run"
SCHEDULER_ARGS=(
  --location "$REGION"
  --project "$PROJECT_ID"
  --schedule "$SCHEDULE"
  --time-zone "Asia/Jerusalem"
  --uri "$RUN_URI"
  --http-method POST
  --oauth-service-account-email "$SCHEDULER_SERVICE_ACCOUNT"
  --oauth-token-scope "https://www.googleapis.com/auth/cloud-platform"
  --headers "Content-Type=application/json"
  --message-body "{}"
  --attempt-deadline 10m
  --max-retry-attempts 1
)

if gcloud scheduler jobs describe "$SCHEDULER_JOB" --location "$REGION" --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud scheduler jobs update http "$SCHEDULER_JOB" "${SCHEDULER_ARGS[@]}"
else
  gcloud scheduler jobs create http "$SCHEDULER_JOB" "${SCHEDULER_ARGS[@]}"
fi

echo "Configured Cloud Scheduler -> Cloud Run job -> $SERVICE_URL"
