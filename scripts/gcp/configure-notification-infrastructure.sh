#!/usr/bin/env bash
set -euo pipefail

APPLY=false
if [[ "${1:-}" == "--apply" ]]; then
  APPLY=true
  shift
fi
if [[ $# -gt 0 ]]; then
  echo "Usage: $0 [--apply]" >&2
  exit 2
fi

PROJECT_ID="${GCP_PROJECT_ID:-cloudandcorestudio}"
REGION="${GCP_REGION:-me-west1}"
SERVICE="${CLOUD_RUN_SERVICE:-cloud-core-studio}"
QUEUE="${NOTIFICATIONS_TASKS_QUEUE:-cc-notification-delivery}"
TASKS_SA_NAME="${NOTIFICATIONS_TASKS_SERVICE_ACCOUNT_NAME:-cc-notification-tasks}"
MAINTENANCE_SA_NAME="${NOTIFICATIONS_MAINTENANCE_SERVICE_ACCOUNT_NAME:-cc-notification-maintenance}"
SCHEDULER="${NOTIFICATIONS_MAINTENANCE_SCHEDULER:-cc-notification-maintenance-15m}"
REMOVE_REVISION_TAGS="${CLOUD_RUN_REMOVE_REVISION_TAGS:-}"
TASK_MAX_DISPATCHES_PER_SECOND="${NOTIFICATIONS_TASK_MAX_DISPATCHES_PER_SECOND:-10}"
TASK_MAX_CONCURRENT_DISPATCHES="${NOTIFICATIONS_TASK_MAX_CONCURRENT_DISPATCHES:-5}"
TASK_MAX_ATTEMPTS="${NOTIFICATIONS_TASK_MAX_ATTEMPTS:-8}"
TASK_MIN_BACKOFF="${NOTIFICATIONS_TASK_MIN_BACKOFF:-10s}"
TASK_MAX_BACKOFF="${NOTIFICATIONS_TASK_MAX_BACKOFF:-3600s}"
TASK_MAX_RETRY_DURATION="${NOTIFICATIONS_TASK_MAX_RETRY_DURATION:-86400s}"
TASKS_SA="${TASKS_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
MAINTENANCE_SA="${MAINTENANCE_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

run() {
  if [[ "$APPLY" == "true" ]]; then
    "$@"
  else
    printf 'DRY RUN'
    printf ' %q' "$@"
    printf '\n'
  fi
}

require_positive_integer() {
  local name="$1"
  local value="$2"
  if [[ ! "$value" =~ ^[1-9][0-9]*$ ]]; then
    echo "${name} must be a positive integer." >&2
    exit 2
  fi
}

require_seconds_duration() {
  local name="$1"
  local value="$2"
  if [[ ! "$value" =~ ^[1-9][0-9]*s$ ]]; then
    echo "${name} must be a positive whole-second duration such as 10s." >&2
    exit 2
  fi
}

require_positive_integer NOTIFICATIONS_TASK_MAX_DISPATCHES_PER_SECOND "$TASK_MAX_DISPATCHES_PER_SECOND"
require_positive_integer NOTIFICATIONS_TASK_MAX_CONCURRENT_DISPATCHES "$TASK_MAX_CONCURRENT_DISPATCHES"
require_positive_integer NOTIFICATIONS_TASK_MAX_ATTEMPTS "$TASK_MAX_ATTEMPTS"
require_seconds_duration NOTIFICATIONS_TASK_MIN_BACKOFF "$TASK_MIN_BACKOFF"
require_seconds_duration NOTIFICATIONS_TASK_MAX_BACKOFF "$TASK_MAX_BACKOFF"
require_seconds_duration NOTIFICATIONS_TASK_MAX_RETRY_DURATION "$TASK_MAX_RETRY_DURATION"

ensure_service_account() {
  local name="$1"
  local display_name="$2"
  if [[ "$APPLY" == "true" ]] && gcloud iam service-accounts describe \
    "${name}@${PROJECT_ID}.iam.gserviceaccount.com" --project="$PROJECT_ID" >/dev/null 2>&1; then
    return
  fi
  run gcloud iam service-accounts create "$name" \
    --project="$PROJECT_ID" --display-name="$display_name"
}

echo "Notification infrastructure plan for ${PROJECT_ID}/${REGION}/${SERVICE}"
[[ "$APPLY" == "true" ]] || echo "No changes will be made. Re-run with --apply after reviewing this plan."

run gcloud services enable run.googleapis.com cloudtasks.googleapis.com \
  cloudscheduler.googleapis.com iamcredentials.googleapis.com --project="$PROJECT_ID"

ensure_service_account "$TASKS_SA_NAME" "Cloud & Core notification task caller"
ensure_service_account "$MAINTENANCE_SA_NAME" "Cloud & Core notification maintenance caller"

if [[ "$APPLY" == "true" ]]; then
  SERVICE_URL="$(gcloud run services describe "$SERVICE" --region="$REGION" \
    --project="$PROJECT_ID" --format='value(status.url)')"
  RUNTIME_SA="$(gcloud run services describe "$SERVICE" --region="$REGION" \
    --project="$PROJECT_ID" --format='value(spec.template.spec.serviceAccountName)')"
  PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
else
  SERVICE_URL="https://SERVICE_URL_FROM_CLOUD_RUN"
  RUNTIME_SA="SERVICE_RUNTIME_ACCOUNT_FROM_CLOUD_RUN"
  PROJECT_NUMBER="PROJECT_NUMBER"
fi

run gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${RUNTIME_SA}" --role=roles/cloudtasks.enqueuer
run gcloud iam service-accounts add-iam-policy-binding "$TASKS_SA" \
  --project="$PROJECT_ID" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role=roles/iam.serviceAccountUser
run gcloud iam service-accounts add-iam-policy-binding "$TASKS_SA" \
  --project="$PROJECT_ID" \
  --member="serviceAccount:service-${PROJECT_NUMBER}@gcp-sa-cloudtasks.iam.gserviceaccount.com" \
  --role=roles/iam.serviceAccountTokenCreator

for caller in "$TASKS_SA" "$MAINTENANCE_SA"; do
  run gcloud run services add-iam-policy-binding "$SERVICE" \
    --region="$REGION" --project="$PROJECT_ID" \
    --member="serviceAccount:${caller}" --role=roles/run.invoker
done

if [[ "$APPLY" == "true" ]] && gcloud tasks queues describe "$QUEUE" \
  --location="$REGION" --project="$PROJECT_ID" >/dev/null 2>&1; then
  run gcloud tasks queues update "$QUEUE" --location="$REGION" --project="$PROJECT_ID" \
    --max-dispatches-per-second="$TASK_MAX_DISPATCHES_PER_SECOND" \
    --max-concurrent-dispatches="$TASK_MAX_CONCURRENT_DISPATCHES" \
    --max-attempts="$TASK_MAX_ATTEMPTS" --min-backoff="$TASK_MIN_BACKOFF" \
    --max-backoff="$TASK_MAX_BACKOFF" --max-retry-duration="$TASK_MAX_RETRY_DURATION"
else
  run gcloud tasks queues create "$QUEUE" --location="$REGION" --project="$PROJECT_ID" \
    --max-dispatches-per-second="$TASK_MAX_DISPATCHES_PER_SECOND" \
    --max-concurrent-dispatches="$TASK_MAX_CONCURRENT_DISPATCHES" \
    --max-attempts="$TASK_MAX_ATTEMPTS" --min-backoff="$TASK_MIN_BACKOFF" \
    --max-backoff="$TASK_MAX_BACKOFF" --max-retry-duration="$TASK_MAX_RETRY_DURATION"
fi

run gcloud tasks queues add-iam-policy-binding "$QUEUE" \
  --location="$REGION" --project="$PROJECT_ID" \
  --member="serviceAccount:${RUNTIME_SA}" --role=roles/cloudtasks.viewer

run gcloud run services update "$SERVICE" --region="$REGION" --project="$PROJECT_ID" \
  --min=0 --min-instances=0 --max=3 --max-instances=3 --cpu=1 --memory=512Mi --concurrency=20 \
  --cpu-throttling \
  --update-env-vars="NOTIFICATIONS_OUTBOX_ENABLED=false,NOTIFICATIONS_TASKS_ENABLED=false,NOTIFICATIONS_MAINTENANCE_ENABLED=false,NOTIFICATIONS_DRY_RUN=true,NOTIFICATIONS_MAINTENANCE_TIME_BUDGET_MS=150000,NOTIFICATIONS_TASKS_PROJECT_ID=${PROJECT_ID},NOTIFICATIONS_TASKS_LOCATION=${REGION},NOTIFICATIONS_TASKS_QUEUE=${QUEUE},NOTIFICATIONS_DELIVERY_URL=${SERVICE_URL}/internal/notifications/deliver,NOTIFICATIONS_OIDC_AUDIENCE=${SERVICE_URL},NOTIFICATIONS_OIDC_ALLOWED_CALLERS=${TASKS_SA},NOTIFICATIONS_TASKS_SERVICE_ACCOUNT=${TASKS_SA},NOTIFICATIONS_MAINTENANCE_SERVICE_ACCOUNT=${MAINTENANCE_SA}"

if [[ -n "$REMOVE_REVISION_TAGS" ]]; then
  run gcloud run services update-traffic "$SERVICE" --region="$REGION" --project="$PROJECT_ID" \
    --remove-tags="$REMOVE_REVISION_TAGS"
fi

SCHEDULER_ARGS=(
  --location="$REGION"
  --project="$PROJECT_ID"
  "--schedule=*/15 * * * *"
  --time-zone=Asia/Jerusalem
  --uri="${SERVICE_URL}/internal/notifications/maintain"
  --http-method=POST
  --headers=Content-Type=application/json
  --message-body={}
  --oidc-service-account-email="$MAINTENANCE_SA"
  --oidc-token-audience="$SERVICE_URL"
  --attempt-deadline=180s
  --max-retry-attempts=1
)
if [[ "$APPLY" == "true" ]] && gcloud scheduler jobs describe "$SCHEDULER" \
  --location="$REGION" --project="$PROJECT_ID" >/dev/null 2>&1; then
  run gcloud scheduler jobs update http "$SCHEDULER" "${SCHEDULER_ARGS[@]}"
else
  run gcloud scheduler jobs create http "$SCHEDULER" "${SCHEDULER_ARGS[@]}"
fi

echo "Feature flags remain false. Follow docs/notifications/rollout-runbook.md to activate safely."
