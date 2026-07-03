# OpenWA Mac Worker Operations

## What Runs Where

Production Cloud Run queues and authorizes WhatsApp jobs. The studio Mac sends them.

Cloud Run needs `OPENWA_AUTOMATION_TOKEN`. The Mac worker needs `CLOUD_CORE_BASE_URL`, `OPENWA_LOCAL_BASE_URL`, `OPENWA_API_KEY`, `OPENWA_SESSION_ID`, and the same automation token.

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

4. Store the automation token in Keychain:

```bash
security add-generic-password -U \
  -a "$USER" \
  -s cloud-core-openwa-automation-token \
  -w "<same-token-as-cloud-run>"
```

5. Export Mac worker variables in the shell or launch environment used for testing:

```bash
export CLOUD_CORE_BASE_URL="https://cloud-core-studio-190584124070.me-west1.run.app"
export OPENWA_LOCAL_BASE_URL="http://localhost:2785"
export OPENWA_API_KEY="<openwa-api-key>"
export OPENWA_SESSION_ID="<current-openwa-session-id>"
export OPENWA_WORKER_ID="studio-mac"
export OPENWA_TEST_PHONE="+972501234567"
```

6. Run a dry run:

```bash
node scripts/openwa-local-worker.mjs --dry-run --limit=1
```

7. Run a test-phone-only pass:

```bash
node scripts/openwa-local-worker.mjs --test-phone-only --limit=1
```

8. Install the launch agent:

```bash
bash scripts/install-openwa-launchd.sh
```

## When OpenWA Creates a New Session

1. Scan the QR code with the WhatsApp Business number.
2. Copy the new OpenWA session id.
3. Update `OPENWA_SESSION_ID` in the Mac worker environment.
4. Restart the launch agent:

```bash
launchctl unload "$HOME/Library/LaunchAgents/com.cloudandcore.openwa-worker.plist" || true
launchctl load "$HOME/Library/LaunchAgents/com.cloudandcore.openwa-worker.plist"
launchctl kickstart -k "gui/$(id -u)/com.cloudandcore.openwa-worker"
```

5. Run:

```bash
node scripts/openwa-local-worker.mjs --dry-run --limit=1
```

No App Store release is needed. No mobile app env value changes.

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
