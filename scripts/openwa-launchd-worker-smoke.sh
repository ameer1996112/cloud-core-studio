#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

ENV_FILE="$TMP_DIR/openwa-worker.env"
SHIM_BIN="$TMP_DIR/node-shim.sh"
ARGS_FILE="$TMP_DIR/node-args.txt"
ENV_DUMP_FILE="$TMP_DIR/node-env.txt"
LOG_DIR="$TMP_DIR/logs"

cat > "$ENV_FILE" <<EOF
export CLOUD_CORE_BASE_URL="https://example.test"
export OPENWA_LOCAL_BASE_URL="http://localhost:2785"
export OPENWA_API_KEY="test-api-key"
export OPENWA_SESSION_ID="session-from-env-file"
export OPENWA_WORKER_ID="smoke-worker"
export OPENWA_WORKER_LOG_DIR="$LOG_DIR"
export OPENWA_NODE_BIN="$SHIM_BIN"
export OPENWA_SHIM_ARGS_FILE="$ARGS_FILE"
export OPENWA_SHIM_ENV_DUMP_FILE="$ENV_DUMP_FILE"
EOF

cat > "$SHIM_BIN" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$@" > "$OPENWA_SHIM_ARGS_FILE"
env | sort > "$OPENWA_SHIM_ENV_DUMP_FILE"
exit 0
EOF
chmod +x "$SHIM_BIN"

OPENWA_WORKER_ENV_FILE="$ENV_FILE" \
OPENWA_WORKER_DRY_RUN=1 \
OPENWA_WORKER_LIMIT=1 \
bash "$ROOT_DIR/scripts/openwa-launchd-worker.sh"

grep -Fqx "$ROOT_DIR/scripts/openwa-local-worker.mjs" "$ARGS_FILE"
grep -Fqx -- "--limit=1" "$ARGS_FILE"
grep -Fqx -- "--dry-run" "$ARGS_FILE"
grep -Fq 'OPENWA_SESSION_ID=session-from-env-file' "$ENV_DUMP_FILE"
grep -Fq "OPENWA_NODE_BIN=$SHIM_BIN" "$ENV_DUMP_FILE"

echo "openwa_launchd_worker_smoke: ok"
