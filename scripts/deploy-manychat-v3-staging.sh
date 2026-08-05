#!/usr/bin/env bash
set -euo pipefail

readonly PRODUCTION_SERVICE="cloud-core-studio"
readonly STAGING_SERVICE="cloud-core-studio-staging"
readonly PROTECTED_SUPABASE_REF_ONE="banjmspemvzrqckajvwo"
readonly PROTECTED_SUPABASE_REF_TWO="iuxxebonaamwpgiwqkeq"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

is_placeholder() {
  case "$1" in
    ""|*your-*|*YOUR_*|*placeholder*|*PLACEHOLDER*|*replace-me*|*REPLACE_ME*) return 0 ;;
    *) return 1 ;;
  esac
}

usage() {
  cat <<'EOF'
Usage: bash scripts/deploy-manychat-v3-staging.sh [--check]

  --check  Validate local staging configuration without calling gcloud.
EOF
}

CHECK_ONLY=false
case "${1:-}" in
  "") ;;
  --check) CHECK_ONLY=true ;;
  -h|--help)
    usage
    exit 0
    ;;
  *)
    usage >&2
    fail "unknown argument: $1"
    ;;
esac
[[ $# -le 1 ]] || fail "expected at most one argument"

APP_ENV_VALUE="${APP_ENV:-}"
PROJECT_ID="${GCP_PROJECT_ID:-}"
REGION="${GCP_REGION:-me-west1}"
SERVICE="${CLOUD_RUN_SERVICE:-$STAGING_SERVICE}"
SERVICE_ACCOUNT="${STAGING_SERVICE_ACCOUNT:-}"
IMAGE="${STAGING_IMAGE:-}"
SUPABASE_REF="${SUPABASE_PROJECT_ID:-}"
SUPABASE_PUBLIC_URL="${SUPABASE_URL:-}"
SUPABASE_PUBLIC_KEY="${SUPABASE_PUBLISHABLE_KEY:-}"
VITE_SUPABASE_REF="${VITE_SUPABASE_PROJECT_ID:-}"
VITE_SUPABASE_PUBLIC_URL="${VITE_SUPABASE_URL:-}"
VITE_SUPABASE_PUBLIC_KEY="${VITE_SUPABASE_PUBLISHABLE_KEY:-}"
SUPABASE_SERVICE_ROLE_SECRET_NAME="${SUPABASE_SERVICE_ROLE_SECRET:-}"
MANYCHAT_BEARER_SECRET_NAME="${MANYCHAT_BEARER_SECRET:-}"
TEST_NOTIFICATION_CONFIG_SECRET_NAME="${TEST_NOTIFICATION_CONFIG_SECRET:-}"

[[ "$APP_ENV_VALUE" == "staging" ]] || fail "APP_ENV must be staging"
[[ "$SERVICE" != "$PRODUCTION_SERVICE" ]] || fail "this script refuses production Cloud Run service $PRODUCTION_SERVICE"
[[ "$SERVICE" == "$STAGING_SERVICE" ]] || fail "CLOUD_RUN_SERVICE must be $STAGING_SERVICE"

is_placeholder "$PROJECT_ID" && fail "GCP_PROJECT_ID must name an explicit GCP project"
[[ "$PROJECT_ID" =~ ^[a-z][a-z0-9-]{4,28}[a-z0-9]$ ]] || fail "GCP_PROJECT_ID must be a valid explicit GCP project ID"
[[ -n "$REGION" ]] || fail "GCP_REGION is required"

for candidate in \
  "$SUPABASE_REF" \
  "$SUPABASE_PUBLIC_URL" \
  "$VITE_SUPABASE_REF" \
  "$VITE_SUPABASE_PUBLIC_URL"; do
  case "$candidate" in
    *"$PROTECTED_SUPABASE_REF_ONE"*|*"$PROTECTED_SUPABASE_REF_TWO"*)
      fail "protected Supabase project ref detected; production/customer projects are forbidden"
      ;;
  esac
done

if is_placeholder "$SUPABASE_REF" || is_placeholder "$SUPABASE_PUBLIC_URL" || is_placeholder "$SUPABASE_PUBLIC_KEY"; then
  fail "staging Supabase project ref, URL, and public key are required"
fi
if is_placeholder "$VITE_SUPABASE_REF" || is_placeholder "$VITE_SUPABASE_PUBLIC_URL" || is_placeholder "$VITE_SUPABASE_PUBLIC_KEY"; then
  fail "staging Supabase VITE public values are required"
fi

[[ "$SUPABASE_REF" =~ ^[a-z0-9]+$ ]] || fail "staging Supabase project ref must be lowercase alphanumeric"
[[ "$SUPABASE_PUBLIC_URL" == "https://${SUPABASE_REF}.supabase.co" ]] || fail "staging Supabase URL must match SUPABASE_PROJECT_ID"
[[ "$VITE_SUPABASE_REF" == "$SUPABASE_REF" ]] || fail "staging Supabase public project refs must match"
[[ "$VITE_SUPABASE_PUBLIC_URL" == "$SUPABASE_PUBLIC_URL" ]] || fail "staging Supabase public URLs must match"
[[ "$VITE_SUPABASE_PUBLIC_KEY" == "$SUPABASE_PUBLIC_KEY" ]] || fail "staging Supabase public keys must match"
if [[ ! "$SUPABASE_PUBLIC_KEY" =~ ^[A-Za-z0-9._-]+$ || \
      ! "$VITE_SUPABASE_PUBLIC_KEY" =~ ^[A-Za-z0-9._-]+$ ]]; then
  fail "staging Supabase publishable key must use safe public-key characters"
fi

is_placeholder "$SERVICE_ACCOUNT" && fail "a dedicated staging service account is required"
case "$SERVICE_ACCOUNT" in
  *staging*"@${PROJECT_ID}.iam.gserviceaccount.com") ;;
  *) fail "STAGING_SERVICE_ACCOUNT must be a dedicated staging service account in $PROJECT_ID" ;;
esac
case "$SERVICE_ACCOUNT" in
  *-compute@developer.gserviceaccount.com|*@appspot.gserviceaccount.com)
    fail "STAGING_SERVICE_ACCOUNT must be a dedicated staging service account"
    ;;
esac

is_placeholder "$IMAGE" && fail "STAGING_IMAGE is required"
case "$IMAGE" in
  "${REGION}-docker.pkg.dev/${PROJECT_ID}/"*staging*) ;;
  *) fail "STAGING_IMAGE must be a staging Artifact Registry image in $PROJECT_ID and $REGION" ;;
esac
case "$IMAGE" in
  *[[:space:],]*|*:*|*@*) fail "STAGING_IMAGE must be an untagged image path without spaces or commas" ;;
esac

for secret_name in \
  "$SUPABASE_SERVICE_ROLE_SECRET_NAME" \
  "$MANYCHAT_BEARER_SECRET_NAME" \
  "$TEST_NOTIFICATION_CONFIG_SECRET_NAME"; do
  is_placeholder "$secret_name" && fail "three distinct staging Secret Manager resource names are required"
  [[ "$secret_name" =~ ^[A-Za-z0-9_-]+$ ]] || fail "Secret Manager resource names must be simple secret names"
  [[ "$secret_name" == *staging* ]] || fail "Secret Manager resource names must be staging-specific"
done
if [[ "$SUPABASE_SERVICE_ROLE_SECRET_NAME" == "$MANYCHAT_BEARER_SECRET_NAME" || \
      "$SUPABASE_SERVICE_ROLE_SECRET_NAME" == "$TEST_NOTIFICATION_CONFIG_SECRET_NAME" || \
      "$MANYCHAT_BEARER_SECRET_NAME" == "$TEST_NOTIFICATION_CONFIG_SECRET_NAME" ]]; then
  fail "three distinct staging Secret Manager resource names are required"
fi

for raw_secret_name in \
  SUPABASE_SERVICE_ROLE_KEY \
  MANYCHAT_BEARER_TOKEN \
  TEST_NOTIFICATION_CONFIG \
  VITE_SUPABASE_SERVICE_ROLE_KEY \
  VITE_MANYCHAT_BEARER_TOKEN \
  VITE_TEST_NOTIFICATION_CONFIG; do
  if [[ -n "${!raw_secret_name:-}" ]]; then
    fail "raw server secrets are forbidden; configure only Secret Manager resource names"
  fi
done

if [[ "$CHECK_ONLY" == "true" ]]; then
  echo "ManyChat V3 staging configuration is valid (local check only): service=$SERVICE region=$REGION project=$PROJECT_ID"
  exit 0
fi

command -v gcloud >/dev/null 2>&1 || fail "gcloud is required for deployment"

if ! gcloud iam service-accounts describe "$SERVICE_ACCOUNT" \
  --project "$PROJECT_ID" >/dev/null 2>&1; then
  fail "missing dedicated staging service account: $SERVICE_ACCOUNT"
fi

for secret_name in \
  "$SUPABASE_SERVICE_ROLE_SECRET_NAME" \
  "$MANYCHAT_BEARER_SECRET_NAME" \
  "$TEST_NOTIFICATION_CONFIG_SECRET_NAME"; do
  if ! gcloud secrets describe "$secret_name" --project "$PROJECT_ID" >/dev/null 2>&1; then
    fail "missing Secret Manager resource: $secret_name"
  fi
done

SUBSTITUTIONS="_IMAGE=${IMAGE},_REGION=${REGION},_STAGING_SERVICE_ACCOUNT=${SERVICE_ACCOUNT},_VITE_SUPABASE_PROJECT_ID=${VITE_SUPABASE_REF},_VITE_SUPABASE_URL=${VITE_SUPABASE_PUBLIC_URL},_VITE_SUPABASE_PUBLISHABLE_KEY=${VITE_SUPABASE_PUBLIC_KEY},_SUPABASE_SERVICE_ROLE_SECRET=${SUPABASE_SERVICE_ROLE_SECRET_NAME},_MANYCHAT_BEARER_SECRET=${MANYCHAT_BEARER_SECRET_NAME},_TEST_NOTIFICATION_CONFIG_SECRET=${TEST_NOTIFICATION_CONFIG_SECRET_NAME}"

gcloud builds submit \
  --config cloudbuild.staging.yaml \
  --project "$PROJECT_ID" \
  --substitutions "$SUBSTITUTIONS" \
  .

echo "Submitted staging-only build for $STAGING_SERVICE in $REGION."
