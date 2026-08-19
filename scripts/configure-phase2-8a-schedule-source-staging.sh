#!/usr/bin/env bash
set -euo pipefail

readonly PRODUCTION_SERVICE="cloud-core-studio"
readonly DEFAULT_STAGING_SERVICE="cloud-core-studio-staging"
readonly DEFAULT_PUBLISHER_CALLER="goldmine-schedule-publisher-staging@cloudandcorestudio.iam.gserviceaccount.com"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

PROJECT_ID="${GCP_PROJECT_ID:-cloudandcorestudio}"
REGION="${GCP_REGION:-me-west1}"
SERVICE="${CLOUD_RUN_SERVICE:-$DEFAULT_STAGING_SERVICE}"
CALLER="${GOLDMINE_SCHEDULE_ALLOWED_CALLER:-$DEFAULT_PUBLISHER_CALLER}"
HOT_SOURCE_SLUG="${GOLDMINE_SCHEDULE_HOT_PILATES_SOURCE_SLUG:-}"
MODE="${1:-configure}"

[[ "$MODE" == "configure" || "$MODE" == "--disable" ]] || fail "usage: $0 [--disable]"
[[ "$SERVICE" != "$PRODUCTION_SERVICE" ]] || fail "production service is forbidden"
[[ "$SERVICE" == "$DEFAULT_STAGING_SERVICE" ]] || fail "CLOUD_RUN_SERVICE must be $DEFAULT_STAGING_SERVICE"
[[ "$REGION" == "me-west1" ]] || fail "GCP_REGION must be me-west1"
[[ "$CALLER" == "$DEFAULT_PUBLISHER_CALLER" ]] || fail "only the staging publisher caller is allowed"

command -v gcloud >/dev/null 2>&1 || fail "gcloud is required"
gcloud run services describe "$SERVICE" --project "$PROJECT_ID" --region "$REGION" >/dev/null

if [[ "$MODE" == "--disable" ]]; then
  gcloud run services update "$SERVICE" \
    --project "$PROJECT_ID" \
    --region "$REGION" \
    --update-env-vars "GOLDMINE_SCHEDULE_SOURCE_ENABLED=false" \
    --quiet >/dev/null
  echo "GoldMine schedule source disabled on staging."
  exit 0
fi

[[ "$HOT_SOURCE_SLUG" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]] || \
  fail "set GOLDMINE_SCHEDULE_HOT_PILATES_SOURCE_SLUG to the exact staging program_types.slug"
[[ "$HOT_SOURCE_SLUG" != "aerial-yoga" && "$HOT_SOURCE_SLUG" != "mat-pilates" ]] || \
  fail "HOT Pilates must use its own exact program_types.slug"

if ! gcloud iam service-accounts describe "$CALLER" --project "$PROJECT_ID" >/dev/null 2>&1; then
  fail "missing publisher service account: $CALLER"
fi

SERVICE_URL="$(gcloud run services describe "$SERVICE" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --format='value(status.url)')"
[[ "$SERVICE_URL" == https://* ]] || fail "staging service URL is unavailable"
PROGRAM_MAP="{\"aerial-yoga\":\"aerial_adults\",\"${HOT_SOURCE_SLUG}\":\"hot_pilates\",\"mat-pilates\":\"mat_pilates\"}"

gcloud run services update "$SERVICE" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --update-env-vars "^|^GOLDMINE_SCHEDULE_SOURCE_ENABLED=true|GOLDMINE_SCHEDULE_SOURCE_AUDIENCE=${SERVICE_URL}|GOLDMINE_SCHEDULE_ALLOWED_CALLERS=${CALLER}|GOLDMINE_SCHEDULE_PROGRAM_MAP_JSON=${PROGRAM_MAP}|GOLDMINE_SCHEDULE_QUERY_TIMEOUT_MS=5000|GOLDMINE_SCHEDULE_MAX_SESSIONS=200|GOLDMINE_SCHEDULE_MAX_RESPONSE_BYTES=256000" \
  --quiet >/dev/null

gcloud run services add-iam-policy-binding "$SERVICE" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --member "serviceAccount:${CALLER}" \
  --role roles/run.invoker \
  --quiet >/dev/null

echo "GoldMine schedule source enabled on staging for the dedicated publisher identity."
