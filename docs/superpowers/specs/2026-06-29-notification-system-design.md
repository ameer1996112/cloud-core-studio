# Cloud & Core Notification System Design

Date: 2026-06-29
Status: Approved for planning
Decision: Launch-safe V1 first, with V2-ready provider architecture

## Summary

Cloud & Core already has a manual messaging foundation: templates, notification logs, WhatsApp link helpers, a Messages admin page, package request handling, and manual mark-sent flows. The notification system should build on that foundation instead of replacing it.

The approved direction is a draft-first notification system for V1. V1 prepares localized notification records, renders copy for admin review, supports WhatsApp deep links, supports copyable email drafts, and allows an admin to explicitly mark records as manually sent. V1 must not send real email or WhatsApp messages automatically by default.

V2 extends the same model with provider adapters, real email delivery, WhatsApp Business API delivery, Cloud Scheduler and Cloud Run jobs for reminders and retries, provider webhooks, and delivery tracking.

## Goals

- Give staff a reliable operational trail for booking, cancellation, waitlist, package, payment, receipt, reminder, and attendance/no-show notifications.
- Avoid accidental customer messages during launch.
- Keep notification preparation idempotent so repeat operations do not duplicate notification rows.
- Support Hebrew, Arabic, and English with a clear language fallback chain.
- Keep payment and receipt notification visibility admin-only.
- Preserve existing business flows: notification failures must not block booking, cancellation, payment confirmation, receipt issuance, package requests, waitlist changes, or attendance marking.
- Leave a clean path to real providers in V2 without requiring a rewrite.

## Non-Goals

- No production email sending in V1 unless a provider is explicitly added later.
- No WhatsApp Business API sending in V1.
- No automatic scheduled reminders in V1.
- No retry worker in V1.
- No member-facing notification history page in V1.
- No notification code should mutate credits, issue receipts, change booking state, or confirm payments.

## Existing System

Relevant code already exists in:

- `src/lib/messages.functions.ts`
- `src/lib/messageTemplate.ts`
- `src/routes/_authenticated/admin/messages.tsx`
- `src/lib/memberRequests.functions.ts`
- `src/lib/receipts.functions.ts`
- `src/lib/admin.functions.ts`
- `src/routes/api/public/webhooks/payments.$provider.ts`

Existing tables already provide most of the base:

- `notification_templates`
- `notification_logs`
- `notifications`
- `provider_events`
- `members`
- `studio_settings`
- `payments`
- `receipts`
- `package_requests`
- `bookings`
- `classes`

Important current gap: `notification_logs` can store generated text and basic relations, but needs better provider metadata, language, financial relations, error fields, idempotency, and split visibility support.

## Approved Decisions

### V1 Delivery Model

V1 is manual and draft-first:

- Create notification log records after successful domain events.
- Generate WhatsApp deep links with prefilled localized text.
- Generate email drafts that admins can preview and copy.
- Opening a WhatsApp deep link does not change delivery status.
- Admins must explicitly mark a record as `manually_sent`.
- Email drafts are not marked sent until a provider sends them or an admin marks them manually sent.
- Notification preparation failures are recorded when possible and never roll back the source business action.

### V1 Class Reminders

V1 includes manual reminder drafts:

- Admin can prepare reminder drafts from the Messages/class workflow.
- No background scheduler sends reminders in V1.
- V2 adds automated 24-hour reminders with Cloud Scheduler and Cloud Run.

### Cash/Bit Package Requests

Cash and Bit package requests create both sides of the operational notification flow:

- Member confirmation draft: tells the member the request was received and is pending studio confirmation.
- Admin action alert draft: tells staff a manual package request or manual payment needs review.

Neither is automatically sent in V1.

### Language Fallback

Resolve template language in this order:

1. `members.preferred_language`
2. current app language
3. `studio_settings.default_language`
4. Hebrew

Templates should exist for Hebrew, Arabic, and English. Missing translation fallback follows the same chain.

### Visibility

Use split visibility:

- Admins see all notification logs.
- Instructors see operational logs only.
- Payment, receipt, and package-payment logs are admin-only.
- Members do not see notification log history in V1.

Operational logs can include class booking, class cancellation, class change, waitlist, reminder, attendance, and no-show events when the product allows instructors to see those surfaces.

## V1 Event Matrix

| Event | Trigger | Channels | V1 Behavior | Visibility |
| --- | --- | --- | --- | --- |
| Booking confirmed | Member/admin booking succeeds | WhatsApp draft, email draft | Log localized drafts, admin can open/copy/mark manually sent | Admin, instructor operational |
| Booking cancelled | Member/admin cancellation succeeds | WhatsApp draft, email draft | Log localized drafts | Admin, instructor operational |
| Waitlist joined | Member/admin waitlist entry created | WhatsApp draft, email draft | Log localized drafts | Admin, instructor operational |
| Waitlist spot available | Admin offer/promotion flow | WhatsApp draft, email draft | Log localized drafts | Admin, instructor operational |
| Package request submitted | Cash/Bit package request created | Member draft, admin action draft | Log both drafts | Admin only for payment-related details |
| Payment confirmed | Admin payment confirmation succeeds | WhatsApp draft, email draft | Log payment confirmation draft | Admin only |
| Receipt issued | Receipt exists after payment confirmation | WhatsApp draft, email draft | Log receipt notification draft with receipt relation | Admin only |
| Manual class reminder | Admin prepares reminder | WhatsApp draft, email draft | Log reminder drafts, no scheduler | Admin, instructor operational if allowed |
| Attendance/no-show | Attendance/no-show marking succeeds | WhatsApp draft, email draft | Log follow-up draft where enabled | Admin, instructor operational |

## Status Model

Use these statuses for V1 and V2 compatibility:

- `draft`: prepared for review, copy, or manual sending.
- `queued`: reserved for future provider queue.
- `sent`: sent by a real provider.
- `failed`: provider or preparation failure.
- `manually_sent`: staff explicitly marked it sent.
- `skipped`: no contact details, disabled channel, opt-out, missing template, or no provider when the product chooses not to draft.

Legacy status mapping:

- `generated` -> `draft`
- `copied` -> `draft`
- `opened` -> `draft`
- `marked_sent` -> `manually_sent`

## Data Model

Extend `notification_logs`; do not introduce a separate V1 notification table.

Required additions:

```sql
ALTER TABLE public.notification_logs
  ADD COLUMN IF NOT EXISTS language text,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS related_payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS related_receipt_id uuid REFERENCES public.receipts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS related_package_request_id uuid REFERENCES public.package_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS staff_visibility text NOT NULL DEFAULT 'operational';

CREATE UNIQUE INDEX IF NOT EXISTS notification_logs_idempotency_key_uniq
  ON public.notification_logs(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS notification_logs_payment_idx
  ON public.notification_logs(related_payment_id);

CREATE INDEX IF NOT EXISTS notification_logs_receipt_idx
  ON public.notification_logs(related_receipt_id);

CREATE INDEX IF NOT EXISTS notification_logs_package_request_idx
  ON public.notification_logs(related_package_request_id);

CREATE INDEX IF NOT EXISTS notification_logs_status_idx
  ON public.notification_logs(status, created_at DESC);
```

`staff_visibility` values:

- `operational`: admin and eligible instructor visibility.
- `admin_only`: admin-only logs, including payment, receipt, and manual package-payment records.

Recommended idempotency key formats:

- `booking:{booking_id}:booking_confirmed:{channel}`
- `booking:{booking_id}:booking_cancelled:{channel}`
- `waitlist:{entry_id}:waitlist_joined:{channel}`
- `waitlist:{entry_id}:waitlist_spot_available:{channel}`
- `package_request:{package_request_id}:package_request_received:{channel}:{audience}`
- `payment:{payment_id}:payment_confirmed:{channel}`
- `receipt:{receipt_id}:receipt_issued:{channel}`
- `booking:{booking_id}:class_reminder_24h:{channel}`
- `booking:{booking_id}:no_show_followup:{channel}`

## Security And RLS

- Service role keys remain server-side only.
- Provider secrets remain server-side only.
- WhatsApp deep links can be generated without secrets.
- Do not expose other members' phone or email in roster or message surfaces.
- Do not send or draft to empty contact fields.
- Payment, receipt, and package-payment notification logs must be admin-only.
- Instructor log access must filter out `staff_visibility = 'admin_only'`.
- Do not store provider secrets or raw webhook secrets in `notification_logs.payload`.

## V1 UI Design

### Admin Messages

The Messages page should become the main operational surface:

- Filters for event, status, channel, language, member, visibility, and date.
- Preview panel showing rendered subject/body.
- Copy email draft.
- Copy WhatsApp draft.
- Open WhatsApp deep link.
- Mark manually sent.
- Show skipped reason, missing contact info, failed state, and related object links.

### Admin Package Requests

- Package request rows should link to generated member confirmation and admin action drafts.
- Manual payment requests remain pending until staff confirms them.

### Admin Payments

- Payment confirmation should show related payment and receipt notification drafts.
- Payment and receipt logs are admin-only.

### Member App

Member screens should not overclaim delivery:

- Booking success copy says the booking is confirmed and details are available in the app.
- Package request success copy says the request was received and is pending studio confirmation.
- Receipt pages remain the source of truth for issued receipts.
- Only say "sent" if a provider actually sent the notification or staff explicitly marked it manually sent.

## V2 Architecture

V2 keeps provider details behind adapters:

- Email provider adapter interface.
- WhatsApp provider adapter interface.
- Delivery status normalizer.
- Provider webhook ingestion.
- Retry and dead-letter handling.

Recommended default providers:

- Email: Resend.
- WhatsApp: WhatsApp Business API.

Scheduler path:

- Google Cloud Scheduler triggers a Cloud Run endpoint or Cloud Run job.
- Scheduler jobs handle 24-hour reminders, retry sweeps, and queued sends.
- Scheduler endpoints must require a server-side secret or authenticated service identity.

Provider events:

- Store provider message IDs on `notification_logs.provider_message_id`.
- Store raw provider webhook events in `provider_events` where useful.
- Normalize provider delivery status back to notification log status fields.

## Failure Rules

- Notification preparation never blocks the originating business flow.
- Missing template creates `skipped` or `failed` based on whether it is expected.
- Missing recipient contact creates `skipped`.
- Missing provider in V1 creates a draft for admin-preview channels, not a sent record.
- Duplicate event processing uses `idempotency_key` to avoid duplicate rows.
- Provider failure in V2 updates the notification row and can enqueue retry if retry policy allows.

## Implementation Plan Outline

This design document is not an implementation plan, but the likely build order is:

1. Add the notification log migration.
2. Add typed notification event and template definitions.
3. Add language resolution and template rendering helpers.
4. Add idempotent server-side notification preparation functions.
5. Wire V1 events after successful existing domain operations.
6. Update admin Messages filters and row actions.
7. Update member success copy to avoid overclaiming sends.
8. Add tests for rendering, language fallback, idempotency, skipped contacts, admin-only visibility, and no-provider behavior.
9. Add V2 provider adapters and scheduler after V1 is stable.

## Test Plan

Minimum checks for implementation later:

- Booking creates one booking-confirmed draft per enabled channel.
- Duplicate booking notification preparation does not duplicate rows.
- Cancellation creates one cancellation draft.
- Waitlist join and spot-offer drafts are idempotent.
- Cash/Bit package request creates both member and admin drafts.
- Payment confirmation creates admin-only payment and receipt drafts.
- Instructor log query cannot see admin-only financial logs.
- Hebrew, Arabic, and English templates render with correct fallback.
- Opening a WhatsApp link does not mark sent.
- Mark manually sent updates only the selected log.
- No real email is sent without provider configuration.
- No WhatsApp API message is sent in V1.

## Approval

Ameer approved:

- Approach 1: launch-safe V1 first, V2-ready architecture.
- Split log visibility.
- No member-facing notification history in V1.
- Email drafts in V1.
- WhatsApp open action does not update status.
- Cash/Bit package requests notify both member and admin as drafts.
- Manual class reminder drafts in V1.
- Language fallback chain: member preference, app language, studio default, Hebrew.
- Provider-agnostic V2 adapters with Resend and WhatsApp Business API as recommended defaults.
- Google Cloud Scheduler plus Cloud Run endpoint/job for V2 scheduled reminders and retries.
