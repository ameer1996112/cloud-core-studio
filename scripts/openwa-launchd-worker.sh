#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEFAULT_ENV_FILE="$HOME/Library/Application Support/CloudCoreOpenWA/openwa-worker.env"
ENV_FILE="${OPENWA_WORKER_ENV_FILE:-$DEFAULT_ENV_FILE}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

LIMIT="${OPENWA_WORKER_LIMIT:-5}"
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
    : > "$LAST_RESPONSE_FILE"
    log_error "invalid_limit limit=$LIMIT"
    exit 1
    ;;
esac

ARGS=("--limit=$LIMIT")

if [[ "${OPENWA_WORKER_DRY_RUN:-0}" == "1" ]]; then
  ARGS+=("--dry-run")
fi

if [[ "${OPENWA_WORKER_TEST_PHONE_ONLY:-0}" == "1" ]]; then
  ARGS+=("--test-phone-only")
fi

TMP_RESPONSE_FILE="$(mktemp "$LOG_DIR/.worker-response.XXXXXX")"
trap 'rm -f "$TMP_RESPONSE_FILE"' EXIT

if node "$ROOT_DIR/scripts/openwa-local-worker.mjs" "${ARGS[@]}" >"$TMP_RESPONSE_FILE" 2>&1; then
  mv "$TMP_RESPONSE_FILE" "$LAST_RESPONSE_FILE"
  trap - EXIT
  log_success "ok limit=$LIMIT dryRun=${OPENWA_WORKER_DRY_RUN:-0} testPhoneOnly=${OPENWA_WORKER_TEST_PHONE_ONLY:-0}"
  exit 0
fi

mv "$TMP_RESPONSE_FILE" "$LAST_RESPONSE_FILE"
trap - EXIT
log_error "worker_failed limit=$LIMIT dryRun=${OPENWA_WORKER_DRY_RUN:-0} testPhoneOnly=${OPENWA_WORKER_TEST_PHONE_ONLY:-0} response_file=$LAST_RESPONSE_FILE"
exit 1
