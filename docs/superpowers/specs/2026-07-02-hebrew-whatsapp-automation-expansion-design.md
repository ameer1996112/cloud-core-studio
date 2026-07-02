# Hebrew WhatsApp Automation Expansion Design

## Summary

Expand the existing OpenWA automation pipeline so that premium Hebrew member WhatsApp notifications are sent automatically for the approved event set, not just `payment_confirmed`.

This pass builds on the current queue-based delivery model. It does not introduce a second notification system, and it does not move delivery into business flows.

## Goals

- Automatically deliver the premium Hebrew WhatsApp member notifications for the approved event set
- Reuse the current queue, retry, quiet-hours, and audit-log behavior
- Keep automation scoped to Hebrew member WhatsApp only
- Preserve non-Hebrew, email, and admin behavior exactly as it is today
- Keep delivery failures isolated from booking, payment, and admin workflow success

## Non-Goals

- No Arabic or English WhatsApp automation in this pass
- No email automation changes
- No admin/internal automation changes
- No direct-send path from booking, payment, or admin actions
- No quiet-hours bypass
- No marketing or lifecycle message expansion beyond the approved event set

## Scope

Automatic OpenWA delivery should apply only when all of the following are true:

- `channel = whatsapp`
- `audience = member`
- `language = he`
- event key is one of:
  - `payment_confirmed`
  - `booking_confirmed`
  - `class_reminder_24h`
  - `waitlist_spot_available`
  - `class_cancelled_by_admin`
  - `class_time_changed`

All other notifications remain unchanged.

## Current State

The system already does three important things:

1. It renders event-specific notification text through the shared template layer.
2. It creates `notification_logs` rows with status such as `draft`, `queued`, `skipped`, or `cancelled`.
3. It has an OpenWA queue worker that can claim, send, retry, and finalize rows.

However, the automation scope is currently narrow:

- `shouldAutoQueueOpenwaNotification(...)` only returns `true` for `payment_confirmed`
- the worker in `src/lib/notificationQueue.server.ts` is hard-coded to process only `payment_confirmed`

That means the premium Hebrew WhatsApp copy exists for several events, but most of those rows still remain draft/manual instead of being delivered automatically.

## Recommended Approach

Extend the existing queue-based OpenWA automation pipeline instead of introducing new workers or direct-send calls.

This is the correct approach because:

- the queue already owns retries and audit state
- quiet-hours behavior is already centralized
- row claiming is already isolated from business actions
- one delivery path is easier to verify and maintain than event-specific delivery branches

## Architecture

### 1. Keep row creation logic centralized

Notification rows should continue to be created through the existing draft-building pipeline in `src/lib/notificationDrafts.ts`.

The change is only in the decision that determines whether a WhatsApp row becomes:

- `queued`
- `draft`
- `skipped`
- `cancelled`

### 2. Separate automation eligibility from timing eligibility

The current code mixes two related but distinct concepts:

- whether a row is valid to send at all based on timing
- whether a valid WhatsApp row should be auto-queued

This pass should make those boundaries explicit:

- timing logic still decides whether a row is `queued`, `skipped`, or `cancelled`
- automation eligibility decides whether an otherwise valid WhatsApp row becomes `queued` or stays `draft`

### 3. Expand the queue worker’s allowed event set

The worker should no longer be specialized as a `payment_confirmed`-only path.

Instead, it should process any due row that matches the approved automatic Hebrew member WhatsApp set.

The worker still uses the same lifecycle:

- list due rows
- claim row
- send through OpenWA
- mark `sent`, `queued`, or `failed`

## Automation Eligibility Rules

Auto-queue should happen only when:

- `channel` is `whatsapp`
- `audience` is `member`
- resolved language is `he`
- event key is in the approved automation set
- the row passed the timing-state checks and would otherwise be `queued`

Rows should remain `draft` when:

- language is `ar` or `en`
- audience is `admin`
- channel is `email`
- event is outside the approved set

## Timing And Quiet-Hours Rules

Quiet hours stay unchanged:

- send window remains `08:00` to `20:30` in `Asia/Jerusalem`

That means even approved automatic events should still schedule forward into the next allowed window when needed.

Timing-specific rules stay unchanged:

- `waitlist_spot_available` still becomes `cancelled` when the waitlist offer expires first
- `class_reminder_24h` still becomes `skipped` if the computed send time is already at or after class start

## Queue Worker Rules

The worker should process only rows that match all of these:

- `provider = openwa`
- `channel = whatsapp`
- `status` is currently eligible (`queued`, or recoverable stale `sending`)
- event key is in the approved automatic set
- row payload or row metadata resolves to `language = he`
- row audience is `member`

If the current `notification_logs` row shape does not persist enough information to filter by language and audience directly, the worker should use the event payload already stored in the row instead of introducing a new parallel configuration source.

## Data Flow

### Example: booking confirmation

1. Booking succeeds.
2. Notification draft rows are built.
3. Language resolves to Hebrew.
4. WhatsApp member row for `booking_confirmed` is marked `queued`.
5. Existing OpenWA worker picks it up when due.
6. Worker sends text and marks the row `sent`.

### Example: non-Hebrew booking confirmation

1. Booking succeeds.
2. Notification draft rows are built.
3. Language resolves to English or Arabic.
4. WhatsApp member row stays `draft`.
5. No automatic send occurs.

## Failure Handling

No business action should ever fail because WhatsApp delivery fails.

That remains true for:

- payment confirmation
- booking confirmation
- class cancellation
- class time change
- reminder generation
- waitlist offer generation

Failures should remain inside the queue system:

- missing phone -> `failed` or `skipped` according to current row-creation rules
- provider unavailable -> retry according to current retry schedule
- terminal provider failure -> `failed`

## Components Affected

- `src/lib/notificationDelivery.ts`
  - expand the automatic OpenWA event set and keep quiet-hours logic unchanged
- `src/lib/notificationDrafts.ts`
  - auto-queue only when the row is Hebrew member WhatsApp and the event is approved
- `src/lib/notificationQueue.server.ts`
  - widen the worker from `payment_confirmed`-only to the approved event set
- `tests/unit/notificationDrafts.test.mjs`
  - verify which events/languages become `queued` versus `draft`
- `tests/unit/notificationQueueServer.test.mjs`
  - verify worker eligibility and send processing for the expanded event set

## Testing

### Unit coverage for draft creation

- Hebrew member WhatsApp rows for the six approved events become `queued`
- English and Arabic member WhatsApp rows stay `draft`
- admin WhatsApp rows stay `draft`
- email rows remain unchanged
- waitlist expiry and reminder timing rules remain intact

### Unit coverage for worker eligibility

- worker processes queued rows for all approved automatic events
- worker ignores disallowed events
- worker ignores non-Hebrew rows
- worker ignores non-member rows
- worker keeps the current retry and stale-sending behavior

### Manual QA

1. Trigger a Hebrew booking confirmation and confirm the row appears as `queued`.
2. Trigger a Hebrew payment confirmation and confirm it still auto-sends.
3. Trigger a Hebrew class cancellation and confirm it queues instead of staying `draft`.
4. Trigger the same event for English or Arabic and confirm it stays `draft`.
5. Confirm sent rows appear in the admin message log with the correct premium Hebrew text.

## Rollout

This should ship as a behavior-only change on top of the already deployed premium template copy.

Expected rollout effect:

- new Hebrew WhatsApp member rows for the approved events will begin auto-queuing immediately after deployment
- existing old rows remain in their current status unless explicitly reprocessed

No migration is required.

## Success Criteria

- premium Hebrew WhatsApp templates are not just visible in drafts; they are delivered automatically for the approved member events
- non-Hebrew and non-member behaviors remain unchanged
- queue retry behavior remains stable
- admin message logs continue to reflect queued, sent, failed, and manual-review states accurately
