# Premium messaging manual test runbook

This runbook validates all 43 current studio and recurring-subscription canonical messaging events
without opening delivery to customers.
Use one active staff member whose member UUID, E.164 phone number, and email address are in
`MESSAGING_RECIPIENT_ALLOWLIST`. Keep `MESSAGING_DELIVERY_MODE=allowlist` and keep every row in
`notification_event_rollouts` set to `allowlist_only=true` throughout testing.

The retained/uncommitted kids module is not part of this branch and exposes no authoritative
child-to-guardian identity relationship. Guardian delivery must remain disabled until that domain
model lands and can be integrated without guessing a recipient or exposing child details. Kids
payment events remain explicitly out of scope.

## What a successful delivery looks like

1. Open **Admin → Messages → Journey Lab**, select the allowlisted staff member, and choose the
   preview language. The preview language changes the card only; a real test delivery uses the
   selected member's saved `preferred_language`.
2. Press one channel button on one event. Journey Lab creates a unique, 24-hour staff-test outbox
   row and never fans out to another member. Staff tests bypass quiet hours and the customer
   promotional frequency budget, but still respect channel kill switches, contact data, consent,
   APNs installation verification, and WhatsApp template approval.
3. Open **Deliveries** and find the event. Expected channel results are:
   - `in_app`: `delivered`; the item appears once in the member notification center when the event
     is member-visible.
   - `push`: `accepted`/`sent`, then a pop-up on the verified iPhone. Opening or using an action
     records `opened`/`actioned`; the app receipt can advance the device target to
     `device_received`.
   - `email`: `sent`, then `delivered` after the signed Resend webhook. The same delivery
     idempotency key is retained on retries.
   - `whatsapp`: `accepted`/`sent`, followed by `delivered` and `read` from Meta callbacks. The
     exact approved locale is used; there is no language fallback.
4. `suppressed` is correct only when the named gate explains it, such as
   `push_channel_disabled`, `email_opted_out`, or `whatsapp_template_locale_unapproved`. Fix the
   gate and create a new Journey Lab test; do not manually retry a suppressed configuration test.
5. A second press creates a separate staff test. Natural domain actions remain deduplicated by
   their durable event key.

## Prerequisite checks

- Canonical migration through `20260721190000_premium_notification_all_events.sql` is applied.
- `studio_settings.messaging_canonical_writes_enabled=true` only after the private rollout begins.
- Scheduler and immediate kick use the protected sweep endpoint and the same automation token.
- The selected member is active and has all preferences required for the event being tested.
- Push: the production iPhone build has notification permission, a production APNs token, and a
  matching non-revoked row in `notification_staff_test_devices`.
- Email: the allowlisted email is verified, the Resend domain/sender/webhook are configured, and
  `MESSAGING_EMAIL_ENABLED=true` only while testing email.
- WhatsApp: all needed `he`, `ar`, or `en_US` variants are approved and synchronized in
  `whatsapp_template_deployments`; `MESSAGING_WHATSAPP_ENABLED=true` only while testing WhatsApp.
- Keep the legacy OpenWA, legacy official WhatsApp, and legacy APNs delivery gates off.

## Event-by-event manual tests

The Journey Lab action is the safest complete content/channel test. The domain action column is the
separate end-to-end trigger test. Perform domain actions only with disposable classes, bookings,
waitlist rows, and payments owned by the allowlisted staff member.

### Membership and account

| Event                            | Domain action to trigger automatically                                                                                                | Expected channels and result                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `member_welcome`                 | Create a new active member while canonical writes are enabled.                                                                        | In-app, push, email; one welcome only, opening the schedule. No WhatsApp.      |
| `membership_activated`           | Create or change a `member_plan` to `active`.                                                                                         | In-app, push, email with membership and schedule actions.                      |
| `credits_low`                    | Change credits from above 2 to 1 or 2.                                                                                                | In-app and push; package action.                                               |
| `credits_depleted`               | Change credits from above 0 to 0.                                                                                                     | In-app and push; package action.                                               |
| `membership_expiring`            | Set an active plan expiry within seven days and run the sweep; repeat within two days for the second milestone.                       | In-app, push, email once per 7-day/2-day milestone; never after expiry.        |
| `membership_expired`             | Change a member plan status to `expired`.                                                                                             | Immediate in-app, push, email; package action.                                 |
| `subscription_renewal_upcoming`  | Set an active subscription `next_charge_at` within seven days and run the sweep; repeat within one day for the second milestone.      | In-app, push, email once per 7-day/1-day milestone.                            |
| `subscription_renewal_succeeded` | On an active subscription, change `last_payment_id` to a new paid payment.                                                            | Immediate in-app, push, WhatsApp, email.                                       |
| `subscription_renewal_failed`    | Change subscription status to `past_due` or `incomplete`; leave unresolved for 24 hours and sweep to test the deduplicated follow-up. | Immediate in-app, Time Sensitive push, WhatsApp, email; one 24-hour follow-up. |
| `subscription_paused`            | Change subscription status to `paused`.                                                                                               | Immediate in-app, push, email.                                                 |
| `subscription_cancelled`         | Change subscription status to `cancelled`.                                                                                            | Immediate in-app, push, email.                                                 |

### Booking and attendance

| Event                      | Domain action to trigger automatically                        | Expected channels and result                                                |
| -------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `booking_confirmed`        | Book the staff member into a scheduled class.                 | Immediate in-app, push, WhatsApp, email; view/cancel actions.               |
| `booking_cancelled`        | Cancel that booking while the class itself remains scheduled. | Immediate in-app, push, WhatsApp, email; no duplicate class-cancel message. |
| `booking_changed`          | Move a still-booked test booking to a different class.        | Immediate in-app, push, email; opens the new class.                         |
| `booking_checked_in`       | Mark the booking `checked_in`.                                | One quiet in-app receipt only.                                              |
| `booking_no_show_followup` | Mark the booking `no_show`.                                   | In-app and push when marketing is enabled; no external fallback.            |

### Classes and reminders

| Event                      | Domain action to trigger automatically                                                                                                                                         | Expected channels and result                                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `class_cancelled_by_admin` | Cancel a scheduled class containing the staff booking.                                                                                                                         | Immediate Time Sensitive in-app, push, WhatsApp, email for each affected booked/checked-in member; no separate booking-cancel message.           |
| `class_time_changed`       | Change `starts_at` on the booked class.                                                                                                                                        | Immediate Time Sensitive in-app, push, WhatsApp, email with the new time.                                                                        |
| `class_location_changed`   | Change the class room/room ID.                                                                                                                                                 | Immediate Time Sensitive in-app, push, WhatsApp, email with the new location.                                                                    |
| `class_instructor_changed` | Change the assigned instructor.                                                                                                                                                | In-app and push during the normal delivery window.                                                                                               |
| `class_reminder_planning`  | Create a booked class whose cancellation deadline is two hours away, then sweep.                                                                                               | In-app, push, WhatsApp; cancel action remains available. Cancelling the booking/class before dispatch changes pending deliveries to `cancelled`. |
| `class_reminder_final`     | Create a booked class two hours away and sweep. For a class before 10:30, test 20:00 on the previous day.                                                                      | In-app, push, WhatsApp once; cancelled bookings/classes do not receive it.                                                                       |
| `class_published`          | Create a member-visible scheduled class or publish a hidden/draft class.                                                                                                       | In-app and push for eligible allowlisted members; customer rows remain blocked during allowlist rollout.                                         |
| `class_open_spots`         | Create a visible scheduled class 2–24 hours away at no more than 70% capacity; staff has credits, opening consent, verified push, and is neither booked nor waitlisted; sweep. | In-app and push, at most one opening per 24 hours and three per 7 days. No WhatsApp/email. State is rechecked before send.                       |
| `class_recommendation`     | Give the staff member matching attendance history and recommendation consent, leave an appropriate future class unbooked, then sweep.                                          | In-app and push under the promotional cap; `Book now` becomes `Choose package` at zero credits.                                                  |

### Waitlist

| Event                       | Domain action to trigger automatically                                      | Expected channels and result                                                               |
| --------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `waitlist_joined`           | Join a full class waitlist.                                                 | In-app and push.                                                                           |
| `waitlist_position_changed` | Remove or promote a person ahead of the staff member.                       | Quiet in-app update with the new numeric position.                                         |
| `waitlist_spot_available`   | Promote the staff waitlist row and give it `offered_at`/`offer_expires_at`. | Immediate Time Sensitive in-app, push, WhatsApp; all retries expire at the claim deadline. |
| `waitlist_accepted`         | Convert the promoted offer into a booked booking.                           | Immediate in-app, push, WhatsApp, email; no duplicate `booking_confirmed` event.           |
| `waitlist_offer_expired`    | Change the promoted row to `expired` or `no_response`.                      | One quiet in-app update; claim action is no longer active.                                 |
| `waitlist_removed`          | Change the waitlist row to `left`, `cancelled`, or `removed`.               | Immediate in-app and push.                                                                 |

### Payments and receipts

| Event                      | Domain action to trigger automatically                                                                                  | Expected channels and result                                                                                                          |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `payment_request_received` | Create a pending studio payment or a requested package request.                                                         | Immediate in-app, push, email with payment action.                                                                                    |
| `payment_pending_reminder` | Leave a payment pending for 24 hours and run the sweep.                                                                 | In-app and push at 24 hours; WhatsApp is scheduled 48 hours later (72 hours after creation) if still valid.                           |
| `payment_confirmed`        | Change the studio payment to `paid`.                                                                                    | Immediate in-app, push, WhatsApp, email.                                                                                              |
| `payment_failed`           | Change a payment to `failed`, or make a subscription past due; leave a failed payment unresolved for the 24-hour sweep. | Immediate Time Sensitive in-app, push, WhatsApp, email; one deduplicated follow-up. Opt-out bypass applies to this essential failure. |
| `payment_refunded`         | Change the payment to `refunded` or `partially_refunded`.                                                               | Immediate in-app, push, email.                                                                                                        |
| `receipt_issued`           | Issue a receipt for the paid test payment.                                                                              | In-app and email with an authenticated receipt link; no receipt PII in lock-screen logs.                                              |

### Conversations, staff, and engagement

| Event                        | Domain action to trigger automatically                                                           | Expected channels and result                                                                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `human_handoff`              | Send an inbound WhatsApp text/button/media reply from the allowlisted phone.                     | One open/reopened admin conversation, admin in-app/push alert, one localized WhatsApp acknowledgement for a newly opened handoff, and a 24-hour service window. |
| `staff_reply`                | In Admin Messages, claim the conversation and reply.                                             | Free-form WhatsApp inside the 24-hour window; member in-app/push reply alert. Outside the window only the explicit handoff template is allowed.                 |
| `human_handoff_resolved`     | Resolve the claimed conversation.                                                                | Quiet member in-app resolution. A later inbound message reopens it.                                                                                             |
| `urgent_studio_announcement` | From the protected admin action, target only the staff member and confirm the exact send phrase. | Immediate Time Sensitive in-app, push, WhatsApp, email; never use a broad recipient list during allowlist testing.                                              |
| `trial_followup`             | Set the staff member to one attendance with `last_visit_at` 1–7 days ago and sweep.              | In-app and push when marketing is enabled; once for the first-visit journey.                                                                                    |
| `retention_reminder`         | Set `last_visit_at` more than 21 days ago and sweep.                                             | In-app and push when marketing is enabled; deduplicated by calendar month and promotional cap.                                                                  |

## Failure, retry, and webhook checks

- With mocked providers, return 429/5xx and confirm WhatsApp retries at 1/5/30 minutes, email at
  1/5/30/120 minutes, and push at 1/5 minutes before `dead_letter`.
- Simulate a transmitted WhatsApp timeout and confirm `delivery_unknown`; do not manually retry it.
- Replay the same WhatsApp `wamid` or Resend `svix-id`; row counts must not increase.
- Deliver callbacks out of order (`read`, then `sent`); the final state must remain `read`.
- Send `STOP`, `הסרה`, or `إلغاء`; routine WhatsApp is disabled immediately and a handoff still
  opens for staff review.
- Disable one external channel, create a new test, and confirm it becomes `suppressed` rather than
  waiting to send later when the switch is re-enabled.

## Completion evidence

For each event record: selected member, locale, channel, outbox ID, message ID, delivery ID, final
status, device screenshot for push, provider dashboard/webhook evidence for email/WhatsApp, and the
deep-link/action result. Do not copy message bodies, phone numbers, email addresses, tokens, or
webhook signatures into logs or tickets.
