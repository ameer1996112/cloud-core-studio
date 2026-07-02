# Local OpenWA Claim/Report Automation Design

## Summary

Replace the current Cloud Run -> OpenWA send hop with a Mac-local sender model.

Cloud Run remains the control plane and queue source of truth. Your Mac becomes the actual delivery worker:

- Cloud Run exposes authenticated endpoints to claim due WhatsApp jobs
- your Mac `launchd` worker polls Cloud Run every `15 seconds`
- your Mac sends the message to local OpenWA at `localhost`
- your Mac reports `sent` or `failed` back to Cloud Run

This removes the broken assumption that Cloud Run can reach `localhost` on your Mac.

## Goals

- Make WhatsApp delivery fully automatic with OpenWA running locally on your Mac
- Keep `notification_logs` as the source of truth for queue state and audit history
- Avoid exposing the local OpenWA API publicly
- Keep the current approved automatic WhatsApp event set unchanged
- Keep the Mac worker limited to bearer-protected Cloud Run endpoints rather than broad database credentials

## Non-Goals

- No Cloud Scheduler in this pass
- No public tunnel from Cloud Run to your Mac
- No direct Supabase service-role access from the Mac worker
- No change to the approved automatic event set in this pass
- No redesign of templates, Hebrew-only language rules, or core business logic

## Approved Automatic Event Set

Keep the current approved automatic WhatsApp event set exactly as-is:

- `payment_confirmed`
- `booking_confirmed`
- `class_reminder_24h`
- `waitlist_spot_available`
- `class_cancelled_by_admin`
- `class_time_changed`

These events already align with the current Hebrew-only automatic member WhatsApp behavior and queue rules.

## Current Problem

The current server-side worker design assumes Cloud Run can call the OpenWA API directly using:

- `OPENWA_BASE_URL`
- `OPENWA_API_KEY`
- `OPENWA_SESSION_ID`

In local development, `OPENWA_BASE_URL` is `http://localhost:2785`. That works only from your Mac, not from Cloud Run. From Cloud Run, `localhost` points to the Cloud Run container itself.

So even if the queueing and worker logic are correct, Cloud Run cannot perform the actual send to your local OpenWA runtime.

## Recommended Architecture

### 1. Cloud Run control plane

Cloud Run should own:

- selecting due queued WhatsApp rows
- claiming rows safely
- enforcing event scope, timing, and delivery-state rules
- recording send success/failure outcomes

Cloud Run should not call OpenWA directly in this architecture.

### 2. Mac-local delivery worker

Your Mac should own:

- polling Cloud Run for due work every `15 seconds`
- sending the message through local OpenWA at `localhost`
- reporting delivery outcomes back to Cloud Run

### 3. Auth model

Use a shared bearer token stored in:

- Cloud Run env as `OPENWA_AUTOMATION_TOKEN`
- macOS Keychain on your Mac

The Mac worker should use that token for both claim and report requests.

## API Design

Replace the current one-shot “run the server-side worker” route model with two explicit Cloud Run endpoints.

### Claim endpoint

Example path:

- `POST /api/internal/notifications/openwa-claim`

Responsibilities:

- authenticate bearer token
- select due rows in the approved automatic WhatsApp scope
- atomically claim rows by moving them to `sending`
- return enough payload for the Mac to send locally

Suggested response shape:

```json
{
  "ok": true,
  "jobs": [
    {
      "id": "notification-log-id",
      "to": "+9725...",
      "text": "rendered message body",
      "attemptCount": 1,
      "triggerType": "booking_confirmed"
    }
  ]
}
```

### Report endpoint

Example path:

- `POST /api/internal/notifications/openwa-report`

Responsibilities:

- authenticate bearer token
- accept a job result from the Mac worker
- mark the row `sent`, `queued`, or `failed` according to existing retry rules
- record `provider_message_id`, `error_message`, `next_attempt_at`, and timestamps

Suggested request shapes:

```json
{
  "jobId": "notification-log-id",
  "status": "sent",
  "providerMessageId": "provider-msg-id"
}
```

```json
{
  "jobId": "notification-log-id",
  "status": "failed",
  "retryable": true,
  "error": "openwa_network_error"
}
```

## Data Flow

1. App flow creates a WhatsApp row in `notification_logs` with `status = queued`.
2. The Mac `launchd` worker wakes every `15 seconds`.
3. The worker reads the token from Keychain.
4. The worker calls the Cloud Run claim endpoint.
5. Cloud Run returns zero or more claimed jobs in the approved scope.
6. For each claimed job, the Mac sends through local OpenWA at `localhost`.
7. The Mac reports `sent` or `failed` to the Cloud Run report endpoint.
8. Cloud Run writes the final state to `notification_logs`.

## Queue Semantics

Reuse the current queue behavior already implemented in the app:

- `queued`
- `sending`
- `sent`
- `failed`
- `cancelled`
- `skipped`

Reuse the current rules for:

- Hebrew-only automatic member WhatsApp language
- due filtering via `scheduled_for`
- retry filtering via `next_attempt_at`
- stale `sending` recovery if applicable
- retry scheduling and terminal failure behavior

The architecture changes who performs the OpenWA API call, not the business rules for queue eligibility.

## Mac Worker Behavior

The local worker should:

- call claim endpoint with bearer auth
- iterate through returned jobs
- send each message to local OpenWA using the existing local OpenWA config
- call report endpoint immediately after each outcome
- log successes and failures locally
- exit cleanly after each polling run

The worker should not:

- query Supabase directly
- decide event eligibility locally
- re-render message text locally
- mutate queue state without going through Cloud Run

## Required Production Configuration

Cloud Run should require:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENWA_AUTOMATION_TOKEN`

Cloud Run should no longer require local OpenWA runtime env for delivery in this architecture:

- `OPENWA_BASE_URL`
- `OPENWA_API_KEY`
- `OPENWA_SESSION_ID`

Those values belong on the Mac worker only.

## Required Local Configuration

Your Mac should require:

- local OpenWA running and reachable at `localhost`
- local OpenWA API key
- local OpenWA session id
- Keychain-stored bearer token
- installed `launchd` worker

## Error Handling

### Claim failures

If the claim endpoint fails or returns non-200:

- local worker logs the failure
- no local send is attempted
- queued rows remain available for the next poll

### Send failures

If local OpenWA send fails:

- worker reports failure to Cloud Run
- Cloud Run applies retry or terminal failure rules

### Report failures

If local send succeeded but report call fails:

- worker must log the failure clearly
- this is a high-risk operational state because Cloud Run may still think the row is `sending`
- follow-up handling should prefer existing stale-sending recovery logic rather than local duplicate sends

## Security

- Keep bearer auth on both claim and report endpoints
- Do not put Supabase service-role credentials on the Mac
- Do not expose the local OpenWA API publicly
- Keep the bearer token out of repo files and plist contents

## Testing

### Unit coverage

- claim endpoint returns only approved due rows
- claim endpoint marks rows `sending` atomically
- report endpoint marks successful sends `sent`
- retryable local-send failure requeues correctly
- terminal failure marks rows `failed`

### Manual QA

1. Start local OpenWA on the Mac.
2. Trigger a real approved automatic WhatsApp event.
3. Confirm the row becomes `queued`.
4. Confirm the local worker claims the job within `15 seconds`.
5. Confirm the message is sent locally through OpenWA.
6. Confirm the row transitions to `sent` in `notification_logs`.

## Risks

### Stale sending state

If local send succeeds but the report request fails, Cloud Run can temporarily retain `sending` state until the stale-sending recovery logic resolves it.

### Mac dependency

If the Mac sleeps, reboots without login, or OpenWA stops, sending pauses until the worker resumes.

### Scope creep

The clean rollout is architecture-only. Do not mix this pass with event-set expansion, template redesign, or admin UI redesign.

## Success Criteria

- all currently approved automatic WhatsApp events can be delivered without manual admin action
- the Mac performs the actual OpenWA send locally
- Cloud Run remains the source of truth for queue state and audit history
- no Supabase service-role secret is stored on the Mac
- no public OpenWA endpoint is required
