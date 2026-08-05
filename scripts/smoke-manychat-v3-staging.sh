#!/usr/bin/env bash
set -euo pipefail

readonly PRODUCTION_SERVICE="cloud-core-studio"
readonly STAGING_SERVICE="cloud-core-studio-staging"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

PROJECT_ID="${GCP_PROJECT_ID:-}"
REGION="${GCP_REGION:-me-west1}"
SERVICE="${CLOUD_RUN_SERVICE:-$STAGING_SERVICE}"
EXPECTED_SERVICE_ACCOUNT="${STAGING_SERVICE_ACCOUNT:-}"

[[ -n "$PROJECT_ID" ]] || fail "GCP_PROJECT_ID is required"
[[ "$SERVICE" != "$PRODUCTION_SERVICE" ]] || fail "this script refuses production Cloud Run service $PRODUCTION_SERVICE"
[[ "$SERVICE" == "$STAGING_SERVICE" ]] || fail "CLOUD_RUN_SERVICE must be $STAGING_SERVICE"
[[ -n "$REGION" ]] || fail "GCP_REGION is required"
[[ -n "$EXPECTED_SERVICE_ACCOUNT" ]] || fail "STAGING_SERVICE_ACCOUNT is required"

command -v gcloud >/dev/null 2>&1 || fail "gcloud is required for the read-only inspection"
command -v curl >/dev/null 2>&1 || fail "curl is required for the HTTP smoke request"

DESCRIPTION="$(gcloud run services describe "$STAGING_SERVICE" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --format='value(metadata.name,status.url,spec.template.spec.serviceAccountName)')" || \
  fail "unable to describe staging Cloud Run service"

IFS=$'\t' read -r ACTUAL_SERVICE SERVICE_URL ACTUAL_SERVICE_ACCOUNT <<< "$DESCRIPTION"
[[ "$ACTUAL_SERVICE" == "$STAGING_SERVICE" ]] || fail "unexpected Cloud Run service identity: $ACTUAL_SERVICE"
[[ "$ACTUAL_SERVICE_ACCOUNT" == "$EXPECTED_SERVICE_ACCOUNT" ]] || \
  fail "unexpected Cloud Run service account: $ACTUAL_SERVICE_ACCOUNT"
case "$SERVICE_URL" in
  "https://${STAGING_SERVICE}-"*.run.app) ;;
  *) fail "unexpected staging Cloud Run URL: $SERVICE_URL" ;;
esac

echo "Inspected service: $ACTUAL_SERVICE"
echo "Service account: $ACTUAL_SERVICE_ACCOUNT"
echo "Staging URL: $SERVICE_URL"

IDENTITY_TOKEN="$(gcloud auth print-identity-token)" || fail "unable to obtain an identity token for staging smoke"
[[ -n "$IDENTITY_TOKEN" ]] || fail "gcloud returned an empty identity token"

curl --config - <<EOF
url = "${SERVICE_URL}/support"
header = "Authorization: Bearer ${IDENTITY_TOKEN}"
fail
silent
show-error
location
max-time = 20
output = "/dev/null"
EOF

unset IDENTITY_TOKEN

echo "ManyChat V3 staging smoke check passed: GET /support returned success."
