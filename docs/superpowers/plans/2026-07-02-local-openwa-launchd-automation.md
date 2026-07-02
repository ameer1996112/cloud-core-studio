# Local OpenWA Launchd Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make WhatsApp delivery run automatically every 15 seconds from the user's Mac, with a Keychain-backed bearer token and no manual admin sending.

**Architecture:** Keep Cloud Run as the queue control plane and keep OpenWA on the user's Mac. Add a guarded preflight to verify Cloud Run can actually reach the configured OpenWA endpoint, then add a local `launchd`-driven poller that calls the existing production worker route with a bearer token stored in macOS Keychain.

**Tech Stack:** Bun, TypeScript, TanStack Start, Cloud Run, OpenWA, macOS `launchd`, macOS Keychain, shell scripting

---

## File Structure

- `src/routes/api/internal/notifications/openwa-run.ts`
  Responsibility: protected Cloud Run route that triggers the queue worker.
- `src/lib/openwa.server.ts`
  Responsibility: OpenWA runtime config lookup and HTTP client.
- `scripts/openwa-launchd-worker.sh`
  Responsibility: local macOS script that reads the bearer token from Keychain and POSTs to the production worker route.
- `scripts/install-openwa-launchd.sh`
  Responsibility: one-time installer that writes the per-user LaunchAgent plist and loads it.
- `docs/openwa-launchd-automation.md`
  Responsibility: operator runbook for Keychain setup, launchd install, logs, and troubleshooting.
- `tests/unit/openwaRuntimeConfig.test.mjs`
  Responsibility: focused guard around OpenWA runtime env validation if a new helper or preflight function is added.

### Task 1: Verify the production architecture is reachable

**Files:**
- Modify: `src/lib/openwa.server.ts`
- Test: `tests/unit/openwaRuntimeConfig.test.mjs`

- [ ] **Step 1: Write the failing preflight test**

```js
import { expect, test } from "bun:test";
import { getOpenwaRuntimeConfig } from "../../src/lib/openwa.server.ts";

test("getOpenwaRuntimeConfig rejects missing runtime env", () => {
  expect(() =>
    getOpenwaRuntimeConfig({
      OPENWA_BASE_URL: "",
      OPENWA_API_KEY: "",
      OPENWA_SESSION_ID: "",
    }),
  ).toThrow("missing_openwa_runtime_config");
});
```

- [ ] **Step 2: Run the test to verify the current guard still behaves**

Run: `bun test tests/unit/openwaRuntimeConfig.test.mjs`
Expected: PASS once the test file exists, proving the worker still hard-fails without runtime config.

- [ ] **Step 3: Add a focused preflight helper for operator verification**

```ts
export function isReachableOpenwaBaseUrl(baseUrl: string) {
  return /^https?:\/\//.test(baseUrl) && !/localhost|127\.0\.0\.1|0\.0\.0\.0/.test(baseUrl);
}
```

Add it in `src/lib/openwa.server.ts` next to `getOpenwaRuntimeConfig(...)`, and use it only for operational verification and docs guidance. Do not silently rewrite runtime behavior.

- [ ] **Step 4: Extend the test with the reachability rule**

```js
import { isReachableOpenwaBaseUrl } from "../../src/lib/openwa.server.ts";

test("isReachableOpenwaBaseUrl rejects localhost endpoints", () => {
  expect(isReachableOpenwaBaseUrl("http://localhost:2785")).toBe(false);
  expect(isReachableOpenwaBaseUrl("http://127.0.0.1:2785")).toBe(false);
  expect(isReachableOpenwaBaseUrl("https://openwa.example.com")).toBe(true);
});
```

- [ ] **Step 5: Run the focused test**

Run: `bun test tests/unit/openwaRuntimeConfig.test.mjs`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/openwa.server.ts tests/unit/openwaRuntimeConfig.test.mjs
git commit -m "test: add openwa runtime reachability guard"
```

### Task 2: Add the local sender script

**Files:**
- Create: `scripts/openwa-launchd-worker.sh`
- Test: `scripts/openwa-launchd-worker.sh`

- [ ] **Step 1: Create the failing script skeleton**

```bash
#!/bin/bash
set -euo pipefail

echo "openwa-launchd-worker: not implemented" >&2
exit 1
```

- [ ] **Step 2: Run it to verify it fails intentionally**

Run: `bash scripts/openwa-launchd-worker.sh`
Expected: exit code `1` with `openwa-launchd-worker: not implemented`

- [ ] **Step 3: Replace the skeleton with the real worker script**

```bash
#!/bin/bash
set -euo pipefail

SERVICE_URL="${OPENWA_WORKER_URL:-https://cloud-core-studio-190584124070.me-west1.run.app/api/internal/notifications/openwa-run}"
KEYCHAIN_SERVICE="${OPENWA_KEYCHAIN_SERVICE:-cloud-core-openwa-automation}"
KEYCHAIN_ACCOUNT="${OPENWA_KEYCHAIN_ACCOUNT:-worker-token}"
LIMIT="${OPENWA_WORKER_LIMIT:-10}"
LOG_DIR="${OPENWA_WORKER_LOG_DIR:-$HOME/Library/Logs/CloudCoreOpenWA}"
mkdir -p "$LOG_DIR"

TOKEN="$(security find-generic-password -s "$KEYCHAIN_SERVICE" -a "$KEYCHAIN_ACCOUNT" -w 2>/dev/null || true)"
if [[ -z "$TOKEN" ]]; then
  echo "$(date -Iseconds) missing_keychain_token" >> "$LOG_DIR/worker-error.log"
  exit 1
fi

HTTP_CODE="$(
  curl -sS \
    -o "$LOG_DIR/worker-last-response.json" \
    -w "%{http_code}" \
    --max-time 10 \
    -X POST "$SERVICE_URL" \
    -H "content-type: application/json" \
    -H "authorization: Bearer $TOKEN" \
    --data "{\"limit\":$LIMIT}"
)"

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "$(date -Iseconds) non_200_response code=$HTTP_CODE" >> "$LOG_DIR/worker-error.log"
  exit 1
fi

echo "$(date -Iseconds) ok code=$HTTP_CODE" >> "$LOG_DIR/worker.log"
```

- [ ] **Step 4: Make the script executable and smoke-check syntax**

Run: `chmod +x scripts/openwa-launchd-worker.sh && bash -n scripts/openwa-launchd-worker.sh`
Expected: no output, exit code `0`

- [ ] **Step 5: Commit**

```bash
git add scripts/openwa-launchd-worker.sh
git commit -m "feat: add local openwa launchd worker script"
```

### Task 3: Add a launchd installer

**Files:**
- Create: `scripts/install-openwa-launchd.sh`
- Test: `scripts/install-openwa-launchd.sh`

- [ ] **Step 1: Create the installer script with a generated plist**

```bash
#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLIST_PATH="$HOME/Library/LaunchAgents/com.cloudandcore.openwa-worker.plist"
LOG_DIR="$HOME/Library/Logs/CloudCoreOpenWA"
mkdir -p "$LOG_DIR"

cat > "$PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>com.cloudandcore.openwa-worker</string>
    <key>ProgramArguments</key>
    <array>
      <string>/bin/bash</string>
      <string>$ROOT_DIR/scripts/openwa-launchd-worker.sh</string>
    </array>
    <key>StartInterval</key>
    <integer>15</integer>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$LOG_DIR/launchd-stdout.log</string>
    <key>StandardErrorPath</key>
    <string>$LOG_DIR/launchd-stderr.log</string>
    <key>WorkingDirectory</key>
    <string>$ROOT_DIR</string>
  </dict>
</plist>
PLIST

launchctl unload "$PLIST_PATH" >/dev/null 2>&1 || true
launchctl load "$PLIST_PATH"
launchctl kickstart -k "gui/$(id -u)/com.cloudandcore.openwa-worker"
echo "Installed $PLIST_PATH"
```

- [ ] **Step 2: Run a syntax-only smoke check**

Run: `bash -n scripts/install-openwa-launchd.sh`
Expected: no output, exit code `0`

- [ ] **Step 3: Commit**

```bash
git add scripts/install-openwa-launchd.sh
git commit -m "feat: add launchd installer for local openwa worker"
```

### Task 4: Add the operator runbook

**Files:**
- Create: `docs/openwa-launchd-automation.md`
- Test: `docs/openwa-launchd-automation.md`

- [ ] **Step 1: Document the exact production env requirement**

```md
## Production prerequisites

Cloud Run must have:

- `OPENWA_AUTOMATION_TOKEN`
- `OPENWA_BASE_URL`
- `OPENWA_API_KEY`
- `OPENWA_SESSION_ID`

`OPENWA_BASE_URL` must not be `localhost` unless Cloud Run can actually reach that host, which it usually cannot.
```

- [ ] **Step 2: Document the exact Keychain setup**

```md
```bash
security add-generic-password \
  -U \
  -s cloud-core-openwa-automation \
  -a worker-token \
  -w 'REPLACE_WITH_LONG_RANDOM_TOKEN'
```
```

- [ ] **Step 3: Document install and verification commands**

```md
```bash
bash scripts/install-openwa-launchd.sh
launchctl list | grep cloudandcore.openwa-worker
tail -f ~/Library/Logs/CloudCoreOpenWA/worker.log
```
```

- [ ] **Step 4: Document a manual route smoke test**

```md
```bash
TOKEN="$(security find-generic-password -s cloud-core-openwa-automation -a worker-token -w)"
curl -sS -X POST \
  'https://cloud-core-studio-190584124070.me-west1.run.app/api/internal/notifications/openwa-run' \
  -H "content-type: application/json" \
  -H "authorization: Bearer $TOKEN" \
  --data '{"limit":10}'
```
```

- [ ] **Step 5: Commit**

```bash
git add docs/openwa-launchd-automation.md
git commit -m "docs: add openwa launchd automation runbook"
```

### Task 5: Configure production and verify the route

**Files:**
- Modify: `tmp/deploy.sh`
- Test: production Cloud Run service `cloud-core-studio`

- [ ] **Step 1: Add the automation token env to the deploy script**

Update the deploy command to include:

```bash
--set-env-vars \
  SUPABASE_URL="https://banjmspemvzrqckajvwo.supabase.co",\
  SUPABASE_PUBLISHABLE_KEY="sb_publishable_teQmj60vBGsYCVxVWFHlVg_i4zawbJJ",\
  OPENWA_AUTOMATION_TOKEN="$OPENWA_AUTOMATION_TOKEN",\
  OPENWA_BASE_URL="$OPENWA_BASE_URL",\
  OPENWA_API_KEY="$OPENWA_API_KEY",\
  OPENWA_SESSION_ID="$OPENWA_SESSION_ID"
```

Do not hardcode secret values in the script. Read them from the shell environment at deploy time.

- [ ] **Step 2: Run a local guard before deploy**

Run:

```bash
env | rg '^OPENWA_(AUTOMATION_TOKEN|BASE_URL|API_KEY|SESSION_ID)='
```

Expected: all four variables are present in the current shell before deploy.

- [ ] **Step 3: Deploy**

Run: `bash tmp/deploy.sh`
Expected: Cloud Build succeeds and Cloud Run deploys a new revision.

- [ ] **Step 4: Verify the live service env and revision**

Run:

```bash
gcloud run services describe cloud-core-studio \
  --region me-west1 \
  --project cloudandcorestudio \
  --format='value(status.latestReadyRevisionName,spec.template.spec.containers[0].image)'
```

Expected: new revision name and the new image tag.

- [ ] **Step 5: Verify the protected route manually from the Mac**

Run:

```bash
TOKEN="$(security find-generic-password -s cloud-core-openwa-automation -a worker-token -w)"
curl -sS -X POST \
  'https://cloud-core-studio-190584124070.me-west1.run.app/api/internal/notifications/openwa-run' \
  -H "content-type: application/json" \
  -H "authorization: Bearer $TOKEN" \
  --data '{"limit":10}'
```

Expected: `{"ok":true,...}` with `claimed`, `sent`, `failed`, and `skipped` counters.

- [ ] **Step 6: Commit the deploy helper change**

```bash
git add tmp/deploy.sh
git commit -m "chore: wire openwa automation env into deploy script"
```

### Task 6: Install the launch agent and verify end-to-end delivery

**Files:**
- Test: `scripts/install-openwa-launchd.sh`
- Test: local LaunchAgent at `~/Library/LaunchAgents/com.cloudandcore.openwa-worker.plist`
- Test: production `notification_logs`

- [ ] **Step 1: Install the Keychain token**

Run:

```bash
security add-generic-password \
  -U \
  -s cloud-core-openwa-automation \
  -a worker-token \
  -w 'REPLACE_WITH_LONG_RANDOM_TOKEN'
```

Expected: Keychain item updated or created successfully.

- [ ] **Step 2: Install and start the LaunchAgent**

Run: `bash scripts/install-openwa-launchd.sh`
Expected: `Installed ~/Library/LaunchAgents/com.cloudandcore.openwa-worker.plist`

- [ ] **Step 3: Verify the agent is loaded**

Run:

```bash
launchctl list | grep cloudandcore.openwa-worker
```

Expected: the launchd label appears.

- [ ] **Step 4: Verify local logs**

Run:

```bash
tail -n 20 ~/Library/Logs/CloudCoreOpenWA/worker.log
tail -n 20 ~/Library/Logs/CloudCoreOpenWA/worker-error.log
```

Expected: successful `ok code=200` entries or clear operational failures.

- [ ] **Step 5: Verify a real queued notification clears automatically**

Create or use a real queued WhatsApp row, then confirm within one or two polling cycles:

```bash
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="cloud-core-studio" AND textPayload:"openwa"' \
  --project=cloudandcorestudio \
  --limit=20 \
  --format='value(timestamp,textPayload)'
```

Expected: worker activity appears, and the notification row transitions from `queued` to `sent` or a retry state.

- [ ] **Step 6: Commit any local-safe verification-only repo changes**

```bash
git add scripts/openwa-launchd-worker.sh scripts/install-openwa-launchd.sh docs/openwa-launchd-automation.md src/lib/openwa.server.ts tests/unit/openwaRuntimeConfig.test.mjs tmp/deploy.sh
git commit -m "feat: add local openwa launchd automation"
```

## Self-Review

- Spec coverage:
  - local `launchd` trigger: covered by Tasks 2, 3, and 6
  - Keychain token storage: covered by Tasks 4, 5, and 6
  - Cloud Run automation token: covered by Task 5
  - route verification and end-to-end send: covered by Tasks 5 and 6
  - architectural reachability constraint: covered by Task 1 and the production prerequisite text in Task 4
- Placeholder scan:
  - no `TODO`, `TBD`, or vague implementation-only steps remain
- Type consistency:
  - helper names and file paths are consistent across tasks

