# OpenWA Mac Worker Operations

## What Runs Where

Production Cloud Run queues and authorizes WhatsApp jobs. The studio Mac sends them.

Cloud Run needs `OPENWA_AUTOMATION_TOKEN`. The Mac worker needs `CLOUD_CORE_BASE_URL`, `OPENWA_LOCAL_BASE_URL`, `OPENWA_API_KEY`, `OPENWA_SESSION_ID`, and a way to read the same automation token. `scripts/openwa-local-worker.mjs` first calls `POST /api/internal/notifications/openwa-claim` and then reports each result to `POST /api/internal/notifications/openwa-report`.

Do not put OpenWA session values in `VITE_*` variables. They must not ship to the browser or App Store app.

## First-Time Setup

1. Start OpenWA:

```bash
bun run openwa:start
```

2. Open the sessions UI:

```text
http://localhost:2785/sessions
```

3. Create or select the WhatsApp Business session and scan the QR code.

4. Create a persistent Mac worker env file outside the repo:

```bash
mkdir -p "$HOME/Library/Application Support/CloudCoreOpenWA"
cat > "$HOME/Library/Application Support/CloudCoreOpenWA/openwa-worker.env" <<'EOF'
export CLOUD_CORE_BASE_URL="https://cloud-core-studio-190584124070.me-west1.run.app"
export OPENWA_LOCAL_BASE_URL="http://localhost:2785"
export OPENWA_API_KEY="<openwa-api-key>"
export OPENWA_SESSION_ID="<current-openwa-session-id>"
export OPENWA_WORKER_ID="studio-mac"
export OPENWA_TEST_PHONE="+972501234567"
EOF
chmod 600 "$HOME/Library/Application Support/CloudCoreOpenWA/openwa-worker.env"
```

5. Store the automation token in Keychain:

```bash
security add-generic-password -U \
  -a "$USER" \
  -s cloud-core-openwa-automation-token \
  -w "<same-token-as-cloud-run>"
```

6. Run the local worker with the env file loaded by the launchd wrapper:

```bash
OPENWA_WORKER_ENV_FILE="$HOME/Library/Application Support/CloudCoreOpenWA/openwa-worker.env" \
  bash scripts/openwa-launchd-worker.sh
```

7. Run a dry run:

```bash
OPENWA_WORKER_ENV_FILE="$HOME/Library/Application Support/CloudCoreOpenWA/openwa-worker.env" \
node scripts/openwa-local-worker.mjs --dry-run --limit=1
```

8. Run a test-phone-only pass:

```bash
OPENWA_WORKER_ENV_FILE="$HOME/Library/Application Support/CloudCoreOpenWA/openwa-worker.env" \
node scripts/openwa-local-worker.mjs --test-phone-only --limit=1
```

9. Install the launch agent:

```bash
bash scripts/install-openwa-launchd.sh
```

## When OpenWA Creates a New Session

1. Scan the QR code with the WhatsApp Business number.
2. Copy the new OpenWA session id.
3. Update `OPENWA_SESSION_ID` in `~/Library/Application Support/CloudCoreOpenWA/openwa-worker.env`.
4. Restart the launch agent:

```bash
launchctl unload "$HOME/Library/LaunchAgents/com.cloudandcore.openwa-worker.plist" || true
launchctl load "$HOME/Library/LaunchAgents/com.cloudandcore.openwa-worker.plist"
launchctl kickstart -k "gui/$(id -u)/com.cloudandcore.openwa-worker"
```

5. Run:

```bash
OPENWA_WORKER_ENV_FILE="$HOME/Library/Application Support/CloudCoreOpenWA/openwa-worker.env" \
node scripts/openwa-local-worker.mjs --dry-run --limit=1
```

No App Store release is needed. No mobile app env value changes.

## How launchd gets its environment

`scripts/openwa-launchd-worker.sh` sources `~/Library/Application Support/CloudCoreOpenWA/openwa-worker.env` on every run before it calls `node scripts/openwa-local-worker.mjs`. That keeps the Mac worker settings persistent across LaunchAgent restarts without committing secrets or relying on transient shell exports.

## Check Status

```bash
launchctl list | grep cloudandcore.openwa-worker
tail -n 50 "$HOME/Library/Logs/CloudCoreOpenWA/worker.log"
tail -n 50 "$HOME/Library/Logs/CloudCoreOpenWA/worker-error.log"
cat "$HOME/Library/Logs/CloudCoreOpenWA/worker-last-response.body"
```

## Safety Test Before Real Sending

Use `OPENWA_TEST_PHONE` and `--test-phone-only` before allowing normal production sending.

If the worker reports `openwa_test_phone_only_blocked`, it protected a non-test recipient from being sent during a test run.
