# Mac OpenWA Worker Operational Design

## Summary

Cloud & Core should run WhatsApp automation through the existing queue plus a Mac-local OpenWA worker.

The production app remains responsible for business operations, notification creation, queue state, and worker authorization. The studio Mac remains responsible for the changing OpenWA session details and the actual WhatsApp Web send.

This keeps App Store builds independent from OpenWA session changes. If OpenWA creates a new session, only the Mac worker configuration changes.

## Goals

- Send operational WhatsApp messages automatically after eligible app events.
- Keep payment, booking, waitlist, and class flows independent from WhatsApp delivery.
- Keep `notification_logs` as the queue and audit source of truth.
- Keep `OPENWA_SESSION_ID`, local OpenWA base URL, and OpenWA API key on the Mac worker side.
- Avoid App Store releases or mobile app env changes when the OpenWA session changes.
- Keep production Cloud Run protected by a shared automation bearer token.

## Non-Goals

- No official WhatsApp Business Cloud API migration in this phase.
- No public tunnel from Cloud Run to the local OpenWA API.
- No marketing broadcasts or bulk campaigns.
- No mobile app code path that sends WhatsApp directly.
- No database schema changes in this phase. If the current queue fields are insufficient, stop and request a separate schema-change approval.

## Recommended Architecture

### Production App and Cloud Run

Cloud Run owns the control plane:

- finish the business operation first
- render the localized notification text
- insert or update a `notification_logs` row
- set eligible WhatsApp rows to `queued`
- expose authenticated claim/report endpoints
- record send outcomes as `sent`, retryable `queued`, or terminal `failed`

Cloud Run should not need the current OpenWA session id for this model. Its main secret for the Mac worker is `OPENWA_AUTOMATION_TOKEN`.

### Studio Mac Worker

The studio Mac owns the delivery plane:

- keep OpenWA running locally
- keep the WhatsApp Business number logged in
- store the current `OPENWA_SESSION_ID`
- store the OpenWA API key
- poll Cloud Run for queued jobs
- send jobs through local OpenWA
- report success or failure back to Cloud Run

When OpenWA creates a new session, the operator updates only the Mac worker's session value and restarts the worker.

## Data Flow

1. A member or admin performs an operation in the app.
2. The server completes the actual operation, such as confirming payment, booking a class, or offering a waitlist spot.
3. The server creates a `notification_logs` row with generated WhatsApp text.
4. If the event is approved for automatic OpenWA delivery, the row becomes `queued`.
5. The Mac worker wakes on its schedule.
6. The Mac worker calls `POST /api/internal/notifications/openwa-claim` with bearer auth.
7. Cloud Run claims due rows and returns send jobs.
8. The Mac worker sends each job through local OpenWA.
9. The Mac worker calls `POST /api/internal/notifications/openwa-report`.
10. Cloud Run records the final result in `notification_logs`.

The business operation is complete before WhatsApp delivery begins. WhatsApp failure must not roll back payment confirmation, booking, credit grants, receipts, or waitlist changes.

## Session Handling

OpenWA session values are local operational config, not product config.

If a new OpenWA session is created:

1. Scan the QR code with the WhatsApp Business number.
2. Find the new OpenWA session id on the Mac.
3. Update the Mac worker environment or local config.
4. Restart the worker or launch agent.
5. Run a dry-run or test-phone worker pass.

No App Store release is needed. No mobile app environment variable should be changed. No production redeploy is needed unless the shared automation token or production app URL changes.

## Configuration Boundary

Production Cloud Run should know:

- `OPENWA_AUTOMATION_TOKEN`
- Supabase/server runtime settings already required by the app

The Mac worker should know:

- `CLOUD_CORE_BASE_URL`
- `OPENWA_AUTOMATION_TOKEN` or a Keychain reference for it
- `OPENWA_LOCAL_BASE_URL`
- `OPENWA_API_KEY`
- `OPENWA_SESSION_ID`
- optional test safety settings such as `OPENWA_TEST_PHONE`

The current OpenWA session id belongs on the Mac because that is where OpenWA runs and changes.

## Eligible Messages

Automatic WhatsApp delivery should stay limited to the approved operational set already supported by the queue:

- `payment_confirmed`
- `booking_confirmed`
- `class_reminder_24h`
- `waitlist_spot_available`
- `class_cancelled_by_admin`
- `class_time_changed`

A separate welcome-after-signup or welcome-after-first-payment message should be added as its own event only if the studio wants that exact customer journey. It should still use the same queue and Mac worker path.

## Error Handling

### Mac Offline or Sleeping

Queued rows remain queued or retryable. Delivery resumes when the Mac and OpenWA worker are available again.

### OpenWA Disconnected

The worker reports a retryable failure when possible. Cloud Run records the error and uses the existing retry schedule. If retries are exhausted, the row becomes failed and remains visible for admin review.

### Session Id Changed

The worker fails to send until the Mac config is updated with the new session id. This failure should not affect App Store users or production business actions.

### Sent But Report Failed

The worker should log this as high risk because the WhatsApp message may have been delivered while Cloud Run still sees the row as `sending`. Stale sending recovery should prevent permanent lockup, but operators should inspect these cases.

## Admin Visibility

The admin messages surface should remain the operational dashboard for notification rows:

- queued
- sending
- sent
- failed
- skipped
- cancelled

Admins should be able to identify failed WhatsApp rows and decide whether to retry, send manually, or contact the member another way.

## Testing

Before claiming production readiness:

1. Confirm OpenWA is running locally on the Mac.
2. Confirm the WhatsApp Business number is logged in.
3. Confirm the Mac worker has the current `OPENWA_SESSION_ID`.
4. Run the worker in dry-run mode.
5. Run the worker with a test phone safety filter.
6. Create or find a real queued notification row.
7. Confirm the row moves through `queued` to `sending` to `sent`.
8. Confirm the WhatsApp message arrives.
9. Change no mobile app environment variables during this test.

## Success Criteria

- A payment confirmation or approved operational event creates a queued WhatsApp row.
- The Mac worker sends the message from the WhatsApp Business number.
- `notification_logs` records the message as sent.
- If OpenWA session changes, only the Mac worker config is updated.
- The installed App Store app continues working without a release.
