# Mac OpenWA Worker Operational Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing OpenWA notification queue production-operable from the studio Mac, with OpenWA session changes handled only on the Mac worker side.

**Architecture:** Keep Cloud Run as the queue/control plane and keep the studio Mac as the WhatsApp delivery plane. Replace the deprecated launchd route call with the existing local claim/send/report worker, document the exact Mac configuration boundary, and add focused tests for worker configuration and launchd generation.

**Tech Stack:** Bun, TypeScript/JavaScript ESM, TanStack Start route handlers, Supabase `notification_logs`, OpenWA local API, macOS `launchd`, macOS Keychain, shell scripts.

## Global Constraints

- Use `bun install`, `bun run lint`, and `bun run build` before pushing meaningful changes.
- Do not commit local environment files.
- No official WhatsApp Business Cloud API migration in this phase.
- No public tunnel from Cloud Run to the local OpenWA API.
- No marketing broadcasts or bulk campaigns.
- No mobile app code path that sends WhatsApp directly.
- No database schema changes in this phase. If the current queue fields are insufficient, stop and request a separate schema-change approval.
- `OPENWA_SESSION_ID`, `OPENWA_LOCAL_BASE_URL`, and `OPENWA_API_KEY` belong to the Mac worker environment, not the App Store app.
- Payment, booking, waitlist, class, credit, receipt, and package flows must not fail because WhatsApp delivery fails.

---

## File Structure

- Modify `scripts/openwa-launchd-worker.sh`: make the launchd script run `node scripts/openwa-local-worker.mjs` instead of the deprecated `/openwa-run` endpoint.
- Modify `scripts/install-openwa-launchd.sh`: keep generating a LaunchAgent that points at `scripts/openwa-launchd-worker.sh`, and ensure the installer can be tested without loading launchd.
- Modify `scripts/openwa-local-worker.mjs`: keep claim/send/report behavior, but make configuration errors and session-id expectations explicit.
- Create `tests/unit/openwaLocalWorkerConfig.test.mjs`: unit-test pure config parsing helpers extracted from the local worker.
- Modify `tests/unit/notificationQueueServer.test.mjs`: add a regression assertion that approved queue event types stay aligned with the Mac-worker operational event set.
- Modify `.env.example`: document production-vs-Mac boundaries without adding secrets.
- Create or update `docs/openwa-mac-worker-operations.md`: operator runbook for QR login, session replacement, dry run, test-phone run, launchd status, and log inspection.

---

### Task 1: Extract and Test Local Worker Configuration

**Files:**
- Modify: `scripts/openwa-local-worker.mjs`
- Create: `tests/unit/openwaLocalWorkerConfig.test.mjs`

**Interfaces:**
- Consumes: environment variables `CLOUD_CORE_BASE_URL`, `OPENWA_LOCAL_BASE_URL`, `OPENWA_API_KEY`, `OPENWA_SESSION_ID`, `OPENWA_WORKER_ID`, `OPENWA_TEST_PHONE`.
- Produces:
  - `parseArgs(argv: string[]): { dryRun: boolean; testPhoneOnly: boolean; limit: number }`
  - `buildConfigFromEnv(env: NodeJS.ProcessEnv, options: WorkerOptions, token: string): WorkerConfig`
  - `normalizePhone(value: string): string`

- [ ] **Step 1: Write failing config tests**

Create `tests/unit/openwaLocalWorkerConfig.test.mjs`:

```js
import { describe, expect, test } from "bun:test";
import {
  buildConfigFromEnv,
  normalizePhone,
  parseArgs,
} from "../../scripts/openwa-local-worker.mjs";

const baseEnv = {
  CLOUD_CORE_BASE_URL: "https://cloud-core.example.com/",
  OPENWA_LOCAL_BASE_URL: "http://localhost:2785",
  OPENWA_API_KEY: "openwa-key",
  OPENWA_SESSION_ID: "session-123",
  OPENWA_WORKER_ID: "studio-mac",
  OPENWA_TEST_PHONE: "+972 50-123-4567",
};

describe("openwa local worker config", () => {
  test("parseArgs supports dry run, test phone, and capped limit", () => {
    expect(parseArgs(["--dry-run", "--test-phone-only", "--limit=99"])).toEqual({
      dryRun: true,
      testPhoneOnly: true,
      limit: 10,
    });
  });

  test("parseArgs rejects unknown flags", () => {
    expect(() => parseArgs(["--bad-flag"])).toThrow("unknown_flag:--bad-flag");
  });

  test("buildConfigFromEnv keeps OpenWA session config on the worker side", () => {
    const options = parseArgs(["--test-phone-only", "--limit=2"]);
    expect(buildConfigFromEnv(baseEnv, options, "secret-token")).toEqual({
      cloudCoreBaseUrl: "https://cloud-core.example.com",
      openwaBaseUrl: "http://localhost:2785",
      openwaApiKey: "openwa-key",
      openwaSessionId: "session-123",
      workerId: "studio-mac",
      token: "secret-token",
      testPhone: "+972 50-123-4567",
      options,
    });
  });

  test("buildConfigFromEnv requires test phone when test-phone-only is enabled", () => {
    const options = parseArgs(["--test-phone-only"]);
    const env = { ...baseEnv, OPENWA_TEST_PHONE: "" };
    expect(() => buildConfigFromEnv(env, options, "secret-token")).toThrow(
      "missing_env:OPENWA_TEST_PHONE",
    );
  });

  test("buildConfigFromEnv requires the local OpenWA session id", () => {
    const options = parseArgs([]);
    const env = { ...baseEnv, OPENWA_SESSION_ID: "" };
    expect(() => buildConfigFromEnv(env, options, "secret-token")).toThrow(
      "missing_env:OPENWA_SESSION_ID",
    );
  });

  test("normalizePhone removes punctuation but preserves leading plus", () => {
    expect(normalizePhone("+972 50-123-4567")).toBe("+972501234567");
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
bun test tests/unit/openwaLocalWorkerConfig.test.mjs
```

Expected: FAIL because `scripts/openwa-local-worker.mjs` does not export `parseArgs`, `buildConfigFromEnv`, or `normalizePhone`.

- [ ] **Step 3: Export pure helpers without running the worker during import**

Modify `scripts/openwa-local-worker.mjs` so the helper signatures are exported and `main()` runs only when the file is executed directly:

```js
export function parseArgs(argv) {
  const options = {
    dryRun: false,
    testPhoneOnly: false,
    limit: DEFAULT_LIMIT,
  };

  for (const arg of argv) {
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--test-phone-only") {
      options.testPhoneOnly = true;
      continue;
    }
    if (arg.startsWith("--limit=")) {
      const raw = Number(arg.slice("--limit=".length));
      if (!Number.isFinite(raw)) {
        throw new Error("invalid_limit_flag");
      }
      options.limit = Math.max(1, Math.min(10, Math.trunc(raw)));
      continue;
    }
    throw new Error(`unknown_flag:${arg}`);
  }

  return options;
}

export function normalizePhone(value) {
  return value.replace(/[^\d+]/g, "");
}

export function buildConfigFromEnv(env, options, token) {
  const testPhone = env.OPENWA_TEST_PHONE?.trim() || "";
  if (options.testPhoneOnly && !testPhone) {
    throw new Error("missing_env:OPENWA_TEST_PHONE");
  }

  return {
    cloudCoreBaseUrl: requireEnvFrom(env, "CLOUD_CORE_BASE_URL").replace(/\/+$/, ""),
    openwaBaseUrl: requireEnvFrom(env, "OPENWA_LOCAL_BASE_URL"),
    openwaApiKey: requireEnvFrom(env, "OPENWA_API_KEY"),
    openwaSessionId: requireEnvFrom(env, "OPENWA_SESSION_ID"),
    workerId: env.OPENWA_WORKER_ID?.trim() || "openwa-local-worker",
    token,
    testPhone: testPhone || null,
    options,
  };
}

function requireEnvFrom(env, name) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`missing_env:${name}`);
  return value;
}

function buildConfig(options, token) {
  return buildConfigFromEnv(process.env, options, token);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : "worker_failed";
    console.error(`[openwa-local-worker] fatal error=${message}`);
    process.exitCode = 1;
  });
}
```

Remove the previous unconditional `main().catch(...)` block at the bottom after adding the guarded block.

- [ ] **Step 4: Run the config test**

Run:

```bash
bun test tests/unit/openwaLocalWorkerConfig.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/openwa-local-worker.mjs tests/unit/openwaLocalWorkerConfig.test.mjs
git commit -m "test: cover openwa local worker config"
```

---

### Task 2: Switch Launchd to the Claim/Report Worker

**Files:**
- Modify: `scripts/openwa-launchd-worker.sh`
- Modify: `scripts/install-openwa-launchd.sh`
- Test manually with temporary launchd/log directories.

**Interfaces:**
- Consumes: `scripts/openwa-local-worker.mjs` executable behavior from Task 1.
- Produces: a launchd-compatible shell wrapper that runs the local worker with `--limit=<OPENWA_WORKER_LIMIT>` and optional `--test-phone-only` / `--dry-run` flags.

- [ ] **Step 1: Replace deprecated route curl with local worker execution**

Modify `scripts/openwa-launchd-worker.sh` to this full content:

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
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
```

- [ ] **Step 2: Keep installer generation stable**

Inspect `scripts/install-openwa-launchd.sh`. Keep these existing plist properties unchanged:

```xml
<key>ProgramArguments</key>
<array>
  <string>/bin/bash</string>
  <string>.../scripts/openwa-launchd-worker.sh</string>
</array>
<key>StartInterval</key>
<integer>15</integer>
<key>RunAtLoad</key>
<true/>
```

Do not add secrets to the plist. Do not hardcode `OPENWA_SESSION_ID` in the plist.

- [ ] **Step 3: Verify installer output without loading launchd**

Run:

```bash
TMPDIR="$(mktemp -d)"
OPENWA_LAUNCHD_SKIP_LOAD=1 \
OPENWA_LAUNCHD_PLIST_DIR="$TMPDIR/plists" \
OPENWA_LAUNCHD_LOG_DIR="$TMPDIR/logs" \
bash scripts/install-openwa-launchd.sh
plutil -lint "$TMPDIR/plists/com.cloudandcore.openwa-worker.plist"
grep -F "scripts/openwa-launchd-worker.sh" "$TMPDIR/plists/com.cloudandcore.openwa-worker.plist"
grep -F "<integer>15</integer>" "$TMPDIR/plists/com.cloudandcore.openwa-worker.plist"
rm -rf "$TMPDIR"
```

Expected:

```text
Installed .../com.cloudandcore.openwa-worker.plist
.../com.cloudandcore.openwa-worker.plist: OK
```

The two `grep` commands should print matching plist lines.

- [ ] **Step 4: Verify the wrapper fails clearly without required env**

Run:

```bash
TMPDIR="$(mktemp -d)"
OPENWA_WORKER_LOG_DIR="$TMPDIR" bash scripts/openwa-launchd-worker.sh || true
cat "$TMPDIR/worker-error.log"
cat "$TMPDIR/worker-last-response.body"
rm -rf "$TMPDIR"
```

Expected: `worker-error.log` contains `worker_failed`, and `worker-last-response.body` contains a missing-token or missing-env fatal error from `scripts/openwa-local-worker.mjs`.

- [ ] **Step 5: Commit**

```bash
git add scripts/openwa-launchd-worker.sh scripts/install-openwa-launchd.sh
git commit -m "fix: run local openwa worker from launchd"
```

---

### Task 3: Document the Mac Session Update Runbook

**Files:**
- Modify: `.env.example`
- Create: `docs/openwa-mac-worker-operations.md`

**Interfaces:**
- Consumes: operational boundary from `docs/superpowers/specs/2026-07-03-mac-openwa-worker-operational-design.md`.
- Produces: clear setup and recovery commands for the studio operator.

- [ ] **Step 1: Update `.env.example` with server-vs-Mac separation**

Replace the current OpenWA block in `.env.example` with:

```dotenv
# Optional WhatsApp automation control-plane token.
# Server-only. This authorizes the Mac worker to claim/report queued notification jobs.
OPENWA_AUTOMATION_TOKEN="your-shared-worker-token"

# Optional Mac-local WhatsApp worker settings.
# These belong on the studio Mac worker, not in VITE_* and not in the App Store app.
CLOUD_CORE_BASE_URL="https://your-cloud-run-or-domain.example.com"
OPENWA_LOCAL_BASE_URL="http://localhost:2785"
OPENWA_API_KEY="your-openwa-api-key"
# This is the generated OpenWA session id. Update it on the Mac if OpenWA creates a new session.
OPENWA_SESSION_ID="your-openwa-session-id"
OPENWA_WORKER_ID="studio-mac"
OPENWA_TEST_PHONE="+972501234567"
```

- [ ] **Step 2: Create the operations runbook**

Create `docs/openwa-mac-worker-operations.md`:

```markdown
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
```

- [ ] **Step 3: Check docs for obsolete `/openwa-run` guidance**

Run:

```bash
rg -n "openwa-run|OPENWA_BASE_URL|OPENWA_SESSION_ID" docs .env.example scripts
```

Expected:

- `openwa-run` may remain only in old historical reports that clearly describe it as deprecated.
- current operations docs should point to `scripts/openwa-local-worker.mjs`, `openwa-claim`, and `openwa-report`.
- `.env.example` should describe `OPENWA_SESSION_ID` as Mac-local worker config.

- [ ] **Step 4: Commit**

```bash
git add .env.example docs/openwa-mac-worker-operations.md
git commit -m "docs: add openwa mac worker runbook"
```

---

### Task 4: Add Queue Scope Regression Coverage and Run Gates

**Files:**
- Modify: `tests/unit/notificationQueueServer.test.mjs`
- No implementation file changes expected unless the test reveals drift.

**Interfaces:**
- Consumes: `OPENWA_APPROVED_AUTOMATION_EVENT_TYPES` from `src/lib/notificationQueue.server.ts`.
- Produces: regression coverage that the worker processes exactly the approved operational event set.

- [ ] **Step 1: Add approved event set test**

Append this test inside `describe("claimOpenwaNotifications", () => { ... })` in `tests/unit/notificationQueueServer.test.mjs`:

```js
  test("approved OpenWA automation event set matches the Mac worker operational scope", () => {
    expect([...OPENWA_APPROVED_AUTOMATION_EVENT_TYPES]).toEqual([
      "payment_confirmed",
      "booking_confirmed",
      "class_reminder_24h",
      "waitlist_spot_available",
      "class_cancelled_by_admin",
      "class_time_changed",
    ]);
  });
```

- [ ] **Step 2: Run focused unit tests**

Run:

```bash
bun test tests/unit/notificationQueueServer.test.mjs tests/unit/openwaLocalWorkerConfig.test.mjs tests/unit/notificationDelivery.test.mjs tests/unit/notificationDrafts.test.mjs
```

Expected: PASS.

- [ ] **Step 3: Run repository gates**

Run:

```bash
bun run lint
bun run build
```

Expected: PASS. If lint reports pre-existing warnings or errors outside the touched files, capture the exact output in the final report and do not refactor unrelated files.

- [ ] **Step 4: Commit**

```bash
git add tests/unit/notificationQueueServer.test.mjs
git commit -m "test: lock openwa automation event scope"
```

---

## Execution Notes

- Preserve unrelated dirty worktree changes. Stage only files touched by the task being committed.
- Do not add `.env`, local OpenWA data, Keychain values, logs, or generated plist files to git.
- Use a test phone before any production send pass.
- If `scripts/openwa-local-worker.mjs --test-phone-only` sends to a non-test phone, stop and fix the safety gate before installing launchd.

## Final Verification

Run these commands before reporting implementation complete:

```bash
git status --short
bun test tests/unit/notificationQueueServer.test.mjs tests/unit/openwaLocalWorkerConfig.test.mjs tests/unit/notificationDelivery.test.mjs tests/unit/notificationDrafts.test.mjs
bun run lint
bun run build
```

For live operational verification on the studio Mac, run after the code gates pass:

```bash
bun run openwa:start
node scripts/openwa-local-worker.mjs --dry-run --limit=1
node scripts/openwa-local-worker.mjs --test-phone-only --limit=1
```
