#!/usr/bin/env bash
set -euo pipefail

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
WRONG_CALLER="${GOLDMINE_SCHEDULE_WRONG_CALLER:-}"
START_AT="${GOLDMINE_SCHEDULE_ACCEPTANCE_START_AT:-}"
END_AT="${GOLDMINE_SCHEDULE_ACCEPTANCE_END_AT:-}"

[[ "$SERVICE" == "$DEFAULT_STAGING_SERVICE" ]] || fail "only the staging service may be tested"
[[ "$CALLER" == "$DEFAULT_PUBLISHER_CALLER" ]] || fail "only the staging publisher caller may be used"
[[ -n "$WRONG_CALLER" ]] || fail "set GOLDMINE_SCHEDULE_WRONG_CALLER to an impersonable unauthorized test identity"
command -v gcloud >/dev/null 2>&1 || fail "gcloud is required"
command -v curl >/dev/null 2>&1 || fail "curl is required"
command -v jq >/dev/null 2>&1 || fail "jq is required"
[[ -n "$START_AT" && -n "$END_AT" ]] || \
  fail "set timezone-aware GOLDMINE_SCHEDULE_ACCEPTANCE_START_AT and GOLDMINE_SCHEDULE_ACCEPTANCE_END_AT"

SERVICE_URL="$(gcloud run services describe "$SERVICE" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --format='value(status.url)')"
ENDPOINT="${SERVICE_URL}/internal/goldmine/v1/schedule"
QUERY="start_at=$(jq -rn --arg value "$START_AT" '$value|@uri')&end_at=$(jq -rn --arg value "$END_AT" '$value|@uri')"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf -- "$WORK_DIR"' EXIT

anonymous_status="$(curl --silent --show-error --output "$WORK_DIR/anonymous.json" \
  --write-out '%{http_code}' "${ENDPOINT}?${QUERY}")"
case "$anonymous_status" in
  401|403|404) ;;
  *) fail "anonymous request was not rejected" ;;
esac

TOKEN="$(gcloud auth print-identity-token \
  --impersonate-service-account "$CALLER" \
  --audiences "$SERVICE_URL")"
[[ -n "$TOKEN" ]] || fail "could not mint an identity token"

authorized_status="$(curl --silent --show-error --output "$WORK_DIR/first.json" \
  --write-out '%{http_code}' \
  --header "Authorization: Bearer ${TOKEN}" \
  "${ENDPOINT}?${QUERY}")"
[[ "$authorized_status" == "200" ]] || fail "authorized staging request did not return HTTP 200"

curl --silent --show-error --output "$WORK_DIR/second.json" \
  --header "Authorization: Bearer ${TOKEN}" \
  "${ENDPOINT}?${QUERY}"

jq -e '
  (.source_revision | test("^[0-9a-f]{64}$")) and
  (.sessions | type == "array") and
  (all(.sessions[];
    (.status == "scheduled") and
    (.published == true) and
    (.private == false) and
    (.audience == "adults") and
    (.class_type == "aerial_adults" or .class_type == "hot_pilates" or .class_type == "mat_pilates") and
    ((.capacity == null and .remaining_capacity == null) or
      (.remaining_capacity == ([.capacity - .confirmed_booking_count, 0] | max)))
  ))
' "$WORK_DIR/first.json" >/dev/null || fail "response contract or public filters failed"

first_revision="$(jq -r '.source_revision' "$WORK_DIR/first.json")"
second_revision="$(jq -r '.source_revision' "$WORK_DIR/second.json")"
[[ "$first_revision" == "$second_revision" ]] || fail "source_revision changed without a schedule change"

if jq -e '
  [paths(scalars) as $path | ($path[-1] | tostring | ascii_downcase)] |
  any(.[]; test("(^|_)(member_id|name|phone|email|payment|booking_id|notes?)($|_)"))
' "$WORK_DIR/first.json" >/dev/null; then
  fail "response contains a forbidden identity or private-data field"
fi

WRONG_TOKEN="$(gcloud auth print-identity-token \
  --impersonate-service-account "$WRONG_CALLER" \
  --audiences "$SERVICE_URL")"
wrong_status="$(curl --silent --show-error --output "$WORK_DIR/wrong.json" \
  --write-out '%{http_code}' \
  --header "Authorization: Bearer ${WRONG_TOKEN}" \
  "${ENDPOINT}?${QUERY}")"
[[ "$wrong_status" == "403" ]] || fail "wrong service account was not rejected"

unset TOKEN WRONG_TOKEN
echo "Phase 2.8A read-only endpoint probes passed."
echo "Manual source-data comparison, approved staging mutation/revision-change/restore, and log audit remain required."
