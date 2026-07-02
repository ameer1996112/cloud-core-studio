#!/usr/bin/env bash
set -euo pipefail

SERVICE_URL="${OPENWA_WORKER_URL:-https://cloud-core-studio-190584124070.me-west1.run.app/api/internal/notifications/openwa-run}"
KEYCHAIN_SERVICE="${OPENWA_KEYCHAIN_SERVICE:-cloud-core-openwa-automation}"
KEYCHAIN_ACCOUNT="${OPENWA_KEYCHAIN_ACCOUNT:-worker-token}"
LIMIT="${OPENWA_WORKER_LIMIT:-10}"
LOG_DIR="${OPENWA_WORKER_LOG_DIR:-$HOME/Library/Logs/CloudCoreOpenWA}"
SUCCESS_LOG="$LOG_DIR/worker.log"
ERROR_LOG="$LOG_DIR/worker-error.log"
LAST_RESPONSE_FILE="$LOG_DIR/worker-last-response.body"

mkdir -p "$LOG_DIR"

log_success() {
  printf '%s %s\n' "$(date -Iseconds)" "$*" >> "$SUCCESS_LOG"
}

log_error() {
  printf '%s %s\n' "$(date -Iseconds)" "$*" >> "$ERROR_LOG"
}

case "$LIMIT" in
  ''|*[!0-9]*)
    log_error "invalid_limit limit=$LIMIT"
    exit 1
    ;;
esac

TOKEN="$(security find-generic-password -s "$KEYCHAIN_SERVICE" -a "$KEYCHAIN_ACCOUNT" -w 2>/dev/null || true)"
if [ -z "$TOKEN" ]; then
  : > "$LAST_RESPONSE_FILE"
  log_error "missing_keychain_token service=$KEYCHAIN_SERVICE account=$KEYCHAIN_ACCOUNT"
  exit 1
fi

TMP_RESPONSE_FILE="$(mktemp "$LOG_DIR/.worker-response.XXXXXX")"
trap 'rm -f "$TMP_RESPONSE_FILE"' EXIT

HTTP_CODE="$(
  curl -sS \
    --max-time 10 \
    -o "$TMP_RESPONSE_FILE" \
    -w '%{http_code}' \
    -X POST "$SERVICE_URL" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    --data "{\"limit\":$LIMIT}" || true
)"

mv "$TMP_RESPONSE_FILE" "$LAST_RESPONSE_FILE"
trap - EXIT

case "$HTTP_CODE" in
  200)
    log_success "ok code=200 url=$SERVICE_URL limit=$LIMIT"
    ;;
  '')
    log_error "request_failed url=$SERVICE_URL limit=$LIMIT response_file=$LAST_RESPONSE_FILE"
    exit 1
    ;;
  *)
    log_error "non_200_response code=$HTTP_CODE url=$SERVICE_URL limit=$LIMIT response_file=$LAST_RESPONSE_FILE"
    exit 1
    ;;
esac
