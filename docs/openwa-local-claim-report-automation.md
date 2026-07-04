# OpenWA Local Claim/Report Automation

Gate 1 moves WhatsApp delivery to a Mac-local worker while Cloud Run keeps queue control in `notification_logs`.

## What changed

- Cloud Run now exposes:
  - `POST /api/internal/notifications/openwa-claim`
  - `POST /api/internal/notifications/openwa-report`
- the old `POST /api/internal/notifications/openwa-run` route is deprecated and returns `410`
- `scripts/openwa-local-worker.mjs` can now poll Cloud Run, send through local OpenWA, and report outcomes

## Automatic event scope

Gate 1 keeps exactly this approved automatic WhatsApp scope:

- `payment_confirmed`
- `booking_confirmed`
- `class_reminder_24h`
- `waitlist_spot_available`
- `class_cancelled_by_admin`
- `class_time_changed`

No other automatic WhatsApp events were added in this pass.

## Queue model

The system still uses the existing `notification_logs` fields:

- `status`
- `attempt_count`
- `scheduled_for`
- `next_attempt_at`
- `last_attempt_at`
- `sent_at`
- `provider_message_id`
- `error_message`

There is no schema change in Gate 1.

Instead of new claim metadata, Gate 1 reuses:

- `status = queued` for ready jobs
- `status = sending` when Cloud Run claims a job
- stale `sending` recovery after 10 minutes

## Claim endpoint

`POST /api/internal/notifications/openwa-claim`

Request:

```json
{
  "limit": 5,
  "workerId": "ameer-macbook",
  "dryRun": false
}
```

Optional safety filter used by the local worker:

```json
{
  "testPhone": "+972501234567"
}
```

Behavior:

- bearer auth only via `OPENWA_AUTOMATION_TOKEN`
- default limit `5`
- maximum limit `10`
- selects only due queued WhatsApp rows in the approved event set
- reuses existing `scheduled_for`, `next_attempt_at`, and stale `sending` rules
- moves real jobs to `sending` unless `dryRun=true`
- marks malformed claimed rows as `failed` instead of returning broken jobs

Dry-run behavior:

- does not claim rows
- does not send WhatsApp
- returns the jobs that would be sent
- does not mutate queue state

## Report endpoint

`POST /api/internal/notifications/openwa-report`

Sent:

```json
{
  "jobId": "notification-log-id",
  "status": "sent",
  "providerMessageId": "openwa-message-id",
  "workerId": "ameer-macbook"
}
```

Failed:

```json
{
  "jobId": "notification-log-id",
  "status": "failed",
  "retryable": true,
  "error": "openwa_network_error",
  "workerId": "ameer-macbook"
}
```

Behavior:

- only accepts jobs that currently exist and are still `sending`
- `sent` updates the row to `sent` and keeps provider `openwa`
- retryable failures requeue using the existing retry schedule
- exhausted or terminal failures become `failed`

## Local worker setup

Required env:

```bash
export CLOUD_CORE_BASE_URL="https://cloudandcorestudio.com"
export OPENWA_LOCAL_BASE_URL="http://localhost:2785"
export OPENWA_API_KEY="..."
export OPENWA_SESSION_ID="..."
export OPENWA_WORKER_ID="ameer-macbook"
export OPENWA_TEST_PHONE="+9725..."
```

Token source priority:

1. `OPENWA_AUTOMATION_TOKEN`
2. macOS Keychain item service `cloud-core-openwa-automation-token`

Store the token in Keychain:

```bash
security add-generic-password -U -a "$USER" -s cloud-core-openwa-automation-token -w "<token>"
```

Manual runs:

```bash
node scripts/openwa-local-worker.mjs --dry-run
node scripts/openwa-local-worker.mjs --test-phone-only
node scripts/openwa-local-worker.mjs --test-phone-only --limit=1
```

## Safety notes

- the worker never talks to Supabase directly
- the worker never renders templates
- the worker never decides event eligibility
- if OpenWA send succeeds but report fails, the worker logs `HIGH_RISK sent_but_report_failed`
- `--test-phone-only` is intended for QA before real customer sending is enabled
- if a claimed job somehow bypasses the test phone filter, the worker blocks it and reports `openwa_test_phone_only_blocked`

## Gate 1 boundary

This pass does not:

- add migrations
- add Cloud Scheduler
- expose OpenWA publicly
- enable `launchd`
- add marketing or bulk messages
