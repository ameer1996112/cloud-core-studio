# Payment Confirmed OpenWA Automation Design

## Summary

Enable automatic WhatsApp delivery for the existing `payment_confirmed` member notification after admin payment approval.

Keep the current payment confirmation business flow unchanged:

- admin approves payment
- plan and credits are granted
- receipt is issued
- notification rows are created best-effort

This pass only automates delivery of the existing `payment_confirmed.whatsapp` event. It does not add a new welcome/greeting event, and it does not auto-send `receipt_issued.whatsapp`.

## Goals

- Automatically send the existing payment-confirmed WhatsApp after approval
- Reuse the current `notification_logs` queue and template system
- Keep payment approval successful even if OpenWA is unavailable
- Respect the existing quiet-hours window and retry policy
- Preserve idempotency and auditability

## Non-Goals

- No new greeting or onboarding event in this pass
- No automatic WhatsApp send for `receipt_issued`
- No full marketing/lifecycle automation expansion
- No changes to payment, credit, receipt, or package business rules
- No replacement of the manual admin messages workflow for other events

## Current State

When `confirmPaymentAndIssueReceipt` succeeds, it already creates notification rows for:

- `payment_confirmed`
- `receipt_issued`

For WhatsApp rows, `buildNotificationDraftRows` already sets:

- `provider = "openwa"`
- `status = "queued"` when the row is eligible for automatic timing
- `scheduled_for` according to the quiet-hours policy

However, the repo does not currently contain a runtime that claims queued rows and sends them through OpenWA. Direct sending is still blocked in the current staff-triggered server function path.

## Recommended Approach

Implement a server-side delivery worker path for `notification_logs` rows instead of introducing a new payment event.

Why this approach:

- it fixes the real gap, which is delivery, not event creation
- it keeps product copy and event semantics stable
- it can later be reused for other approved automatic events
- it avoids doubling messages for the same payment action

## Delivery Scope

Automatic delivery in this pass applies only to rows matching all of the following:

- `trigger_type = "payment_confirmed"`
- `channel = "whatsapp"`
- `provider = "openwa"`
- `status = "queued"`
- due now based on `scheduled_for` and `next_attempt_at`

`receipt_issued` rows continue to be created, logged, and visible for review, but are not auto-sent in this pass.

## Architecture

### 1. Event creation remains unchanged

`confirmPaymentAndIssueReceipt` continues to create both payment and receipt notification rows after successful approval.

No business-side branching should depend on delivery success.

### 2. Add a delivery worker layer

Add a focused OpenWA delivery module that:

- finds due queued rows for the approved trigger set
- claims a row by moving it to `sending`
- sends the rendered WhatsApp body through OpenWA
- writes back `sent` or `failed`
- increments attempt metadata and schedules retry when appropriate

The worker boundary should be isolated from the payment flow. Payment confirmation only produces rows; the worker owns delivery lifecycle transitions.

### 3. Add a safe execution entrypoint

Add an explicit server-side execution path for the worker, suitable for manual invocation first and scheduler invocation later.

First rollout should support:

- local/manual worker run for QA
- repeated execution without duplicate sends

The entrypoint should not require admin UI interaction to deliver already-queued rows.

## Data Flow

### Payment confirmation

1. Admin confirms payment.
2. `confirm_payment_and_issue_receipt` RPC succeeds.
3. App creates `payment_confirmed` and `receipt_issued` notification rows best-effort.
4. `payment_confirmed.whatsapp` row lands as `queued` with `provider = openwa`.

### Delivery worker

1. Worker selects due rows within the approved scope.
2. Worker atomically claims one row by setting:
   - `status = "sending"`
   - `last_attempt_at = now`
   - `attempt_count = attempt_count + 1`
3. Worker calls OpenWA with the member phone and generated text.
4. On success:
   - set `status = "sent"`
   - set `sent_at = now`
   - store `provider_message_id` if available
   - clear `error_message`
5. On retryable failure:
   - compute `next_attempt_at`
   - set `status = "queued"` if another retry is allowed
   - otherwise set `status = "failed"`
   - store `error_message`
6. On non-retryable failure:
   - set `status = "failed"`
   - store `error_message`

## OpenWA Integration Rules

- Use the existing OpenWA base URL, API key, and session configuration
- Normalize recipient phone before sending
- Treat missing phone as non-sendable and keep the existing skipped-row behavior at draft creation time
- If OpenWA session is offline or unavailable, treat that as retryable
- If OpenWA returns a definitive invalid-recipient style error, treat that as non-retryable

## Concurrency and Idempotency

- Existing idempotency at row creation remains the source of truth for preventing duplicate notification rows
- Worker claiming must prevent two executions from sending the same row twice
- A row already moved out of `queued` must not be re-claimed by another worker run
- A successful `sent` row must never be sent again automatically

Recommended claim rule:

- update a row from `queued` to `sending` only when it is currently due and still matches the approved scope
- proceed only if the update affected exactly one row

## Scheduling Rules

Reuse the existing timing behavior already encoded by `scheduled_for` and `next_attempt_at`.

The worker should only attempt rows that are due now:

- `scheduled_for <= now`
- and either `next_attempt_at is null` or `next_attempt_at <= now`

Quiet-hours logic should stay in draft creation and retry scheduling, not be reimplemented differently inside the sender.

## Failure Handling

Retryable failures:

- OpenWA unavailable
- timeout
- transient network error
- temporary session error

Retry policy:

1. retry after 5 minutes
2. retry after 15 minutes
3. retry after 30 minutes
4. then mark `failed`

Non-retryable failures:

- invalid phone after normalization/provider rejection
- malformed payload that cannot be sent
- row no longer valid for approved trigger constraints

Delivery failure must never roll back payment approval, credit grant, or receipt issue.

## Admin Visibility

Admin messages/logs should continue to show the delivery lifecycle accurately:

- `queued`
- `sending`
- `sent`
- `failed`

`payment_confirmed` and `receipt_issued` remain `admin_only` visibility in this pass.

No broad admin UI redesign is required. Existing log views should be enough as long as status changes are visible.

## Testing

### Unit coverage

- worker selects only `payment_confirmed.whatsapp` queued OpenWA rows in this pass
- due-row filtering respects `scheduled_for` and `next_attempt_at`
- successful send marks row `sent`
- retryable failure requeues with the correct next retry time
- terminal failure marks row `failed`
- already-sent or already-sending rows are ignored

### Integration coverage

- payment confirmation still creates notification rows
- worker processes the created payment-confirmed WhatsApp row
- receipt-issued WhatsApp row remains non-automatic

### Manual QA

1. Start OpenWA with the configured session.
2. Approve a package payment for a real test member with a valid WhatsApp phone.
3. Confirm a `payment_confirmed` WhatsApp row is created in `notification_logs`.
4. Run the worker entrypoint.
5. Confirm the member receives the message on WhatsApp.
6. Confirm the row moves to `sent`.
7. Confirm no duplicate message is sent on a second worker run.

## Rollout Plan

### Phase 1

- implement worker internals
- support manual/local invocation
- verify with a real test payment

### Phase 2

- add safe recurring execution
- expand approved automatic trigger set only after payment-confirmed delivery proves stable

## Risks

- OpenWA local session instability can produce retries and failed rows even when the app logic is correct
- If the claim/update logic is weak, duplicate sends are possible
- Mixing delivery logic into payment code would make failures harder to reason about, so boundaries must stay strict

## Decision

Implement automatic delivery for the existing `payment_confirmed.whatsapp` notification only.

Do not add a new greeting event in this pass.
Do not auto-send `receipt_issued.whatsapp` in this pass.
