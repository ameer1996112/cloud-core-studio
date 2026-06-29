# Cloud & Core Notification System Plan

## Verdict

* Ready to implement V1: YES, after approval of a small notification-log migration.
* Migration required: YES for robust V1 transactional notifications, idempotency, payment and receipt references, and provider tracking.
* External provider required for V1: NO.

The current app already has a strong manual messaging base. V1 should build on it, not replace it. The launch-safe path is to generate localized notification records, preview them in admin, provide WhatsApp deep links, allow manual sent marking, and skip email sending unless an email provider is explicitly configured.

## Current system found

### Existing notification and messaging code

* `src/lib/messages.functions.ts`
  * `listMessageTemplates`
  * `upsertMessageTemplate`
  * `duplicateMessageTemplate`
  * `setTemplateActive`
  * `buildAudience`
  * `logNotification`
  * `sendWhatsAppMessage`
  * `markNotificationSent`
  * `listNotificationLogs`
  * `listPackageRequests`
  * `updatePackageRequest`
  * `waitlistOffer`
* `src/lib/messageTemplate.ts`
  * `renderTemplate`
  * `normalizePhoneForWa`
  * `waUrl`
  * `formatClassDate`
  * `formatClassTime`
  * `SUPPORTED_VARIABLES`
  * `TRIGGER_TYPES`
  * `CHANNELS`
  * `LANGUAGES`
* `src/routes/_authenticated/admin/messages.tsx`
  * Composer tab
  * Templates tab
  * Package requests tab
  * Activity log tab
  * Localized fallback templates for English, Hebrew, and Arabic
  * WhatsApp deep-link preview
  * Copy/open/mark-sent logging
* Existing OpenWA code exists in `sendWhatsAppMessage`, but it is not launch-safe as the default behavior because it attempts a real provider send when `OPENWA_*` env vars exist.
* No production email provider implementation was found.
* Payment webhook route exists at `src/routes/api/public/webhooks/payments.$provider.ts`, but it intentionally returns `503` for Stripe/Paddle because online payments are not configured.

### Existing schema support

Existing tables and fields:

* `notification_templates`
  * `id`
  * `key`
  * `label`
  * `channel`
  * `subject`
  * `body`
  * `active`
  * `trigger_type`
  * `language`
  * `description`
  * timestamps
* `notification_logs`
  * `id`
  * `template_key`
  * `channel`
  * `recipient_member_id`
  * `payload`
  * `status`
  * `sent_by`
  * `created_at`
  * `trigger_type`
  * `related_class_id`
  * `related_booking_id`
  * `related_member_plan_id`
  * `generated_text`
  * `subject`
  * `template_id`
  * `marked_sent_at`
* Older `notifications` table exists separately with `profile_id`, `channel`, `type`, `title`, `body`, `payload`, `sent_at`, `read_at`, and `created_at`.
* `provider_events` exists for future payment provider webhooks.

Important missing fields for the requested V1:

* `language`
* `provider`
* `provider_message_id`
* `related_payment_id`
* `related_receipt_id`
* `related_package_request_id`
* `error_message`
* `sent_at`
* `idempotency_key`
* admin/manual audit fields beyond the current `sent_by`

### Existing member/contact data

* `members`
  * `id`
  * `name`
  * `phone`
  * `email`
  * `preferred_language`
  * `remaining_credits`
  * `attendance_count`
  * `last_visit_at`
  * `status`
  * `emergency_contact`
* `studio_settings`
  * `studio_name`
  * `public_phone`
  * `whatsapp_number`
  * `contact_email`
  * `timezone`
  * `supported_languages`
  * `default_language`
  * `whatsapp_enabled`
  * `email_enabled`
  * `payments_enabled`
  * `payments_provider`

Language selection should use:

1. `members.preferred_language`
2. current app language
3. `studio_settings.default_language`
4. Hebrew fallback

### Existing flow entry points

* Member booking
  * UI: `src/components/member/ClassDetailSheet.tsx`
  * Server function: `src/lib/cloud-core.functions.ts` `bookClass`
  * RPC: `book_class`
* Member cancellation
  * UI: `src/routes/_authenticated/member/bookings.tsx`
  * Server function: `memberCancelBooking`
  * RPC: `member_cancel_booking`
* Admin booking and cancellation
  * Server functions: `adminCreateBooking`, `adminCancelBooking`
  * RPCs: `admin_create_booking`, `admin_cancel_booking`
* Waitlist
  * Member functions: `joinWaitlist`, `leaveWaitlist`
  * Admin functions: `waitlistAdd`, `waitlistRemove`, `waitlistPromote`, `waitlistOffer`
* Package request and manual package payment
  * `src/lib/memberRequests.functions.ts`
  * `createMyPackageRequest`
  * `createManualPackagePayment`
* Payment confirmation and receipt
  * UI: `src/routes/_authenticated/admin/payments.tsx`
  * Server function: `confirmPaymentAndIssueReceipt`
  * RPC: `confirm_payment_and_issue_receipt`
* Receipt viewing
  * `src/lib/receipts.functions.ts`
  * `src/routes/_authenticated/receipts/$id.tsx`
* Attendance and no-show
  * `markAttendance`
  * `mark_attendance_v2`
* Payment provider webhooks
  * Stub only. No live provider processing.

## Recommended V1 scope

Build V1 as a server-side notification preparation system:

* Add transactional template definitions for booking, cancellation, waitlist, package request, payment, receipt, class changes, and reminders.
* Add a notification service that creates log records only.
* Generate WhatsApp deep links with prefilled localized text.
* Add email preview/logging, but only send email if a real provider is configured later.
* Show accurate member UI copy:
  * If actually sent: say sent.
  * If only logged/manual: say the booking/payment was confirmed and details are available in the app.
* Admin can preview, copy, open WhatsApp, mark manually sent, and see failures.
* Notification creation must never block booking, cancellation, payment confirmation, receipt issuance, or attendance.
* Notification code must never issue credits, create receipts, or mutate booking/payment business state.

Recommended V1 statuses:

* `draft`
* `queued`
* `sent`
* `failed`
* `manually_sent`
* `skipped`

For compatibility with the current UI, map old statuses:

* `generated` -> `draft`
* `copied` -> `draft`
* `opened` -> `draft`
* `marked_sent` -> `manually_sent`

## V2 later scope

Postpone:

* Real email provider: Resend, Postmark, or SendGrid.
* WhatsApp Business API.
* SMS provider.
* Retry queue.
* Scheduled reminder worker.
* Provider webhook delivery status tracking.
* Payment provider webhook notification fanout.
* Template approval workflow for WhatsApp Business API.

## Event matrix

| Event | Trigger source | Required data | Channels | Template keys | Automatic or reviewed | Timing | Idempotency rule | Failure behavior | UI surface |
|---|---|---|---|---|---|---|---|---|---|
| Booking confirmed | `bookClass`, `adminCreateBooking`, waitlist promote when booking created | member, booking, class, instructor, room, studio settings | email, WhatsApp manual, in-app optional | `booking_confirmed.email`, `booking_confirmed.whatsapp` | automatic log, admin-reviewed send | immediately after booking success | one per booking + event + channel | booking remains successful, log failed/skipped | member confirmation sheet, member bookings, admin messages |
| Booking cancelled | `memberCancelBooking`, `adminCancelBooking` | member, booking, class, refund/credit info | email, WhatsApp manual | `booking_cancelled.email`, `booking_cancelled.whatsapp` | automatic log, admin-reviewed send | immediately after cancellation success | one per booking + event + channel | cancellation remains successful, log failed/skipped | member bookings, admin messages |
| Class reminder | scheduled worker later, manual admin in V1 | member, booking, class, instructor, room | email, WhatsApp manual | `class_reminder_24h.email`, `class_reminder_24h.whatsapp` | V1 admin-reviewed, V2 automatic | 24h before class, 2h later optional | one per booking + reminder window + channel | log failed/skipped, do not affect booking | admin messages, later member notifications |
| Class changed | admin updates class time/instructor/location | member roster, old/new class data | email, WhatsApp manual | `class_changed.email`, `class_changed.whatsapp` | automatic log, admin-reviewed send | immediately after change | one per class change version + member + channel | class update remains successful, log failed/skipped | admin classes/schedule, admin messages |
| Class cancelled | admin cancels session | member roster, class, refund policy | email, WhatsApp manual | `class_cancelled.email`, `class_cancelled.whatsapp` | automatic log, admin-reviewed send | immediately after cancellation | one per class + member + channel | class cancellation remains successful, log failed/skipped | admin schedule, member bookings, admin messages |
| Waitlist joined | `joinWaitlist`, `waitlistAdd` | member, class, position | email optional, WhatsApp manual | `waitlist_joined.email`, `waitlist_joined.whatsapp` | automatic log, admin-reviewed send | immediately | one per waitlist entry + channel | waitlist join remains successful, log failed/skipped | member schedule/bookings, admin messages |
| Waitlist spot available | `waitlistOffer` or future auto-offer | member, class, entry, claim window | WhatsApp manual, email optional | `waitlist_spot_available.email`, `waitlist_spot_available.whatsapp` | admin-reviewed in V1 | immediately when offered | one per waitlist entry + offer status + channel | offer remains active, log failed/skipped | admin roster/messages, member waitlist |
| Package request received | `createMyPackageRequest`, `createManualPackagePayment` | member, plan/package, payment method, amount | email optional, WhatsApp manual | `package_request_received.email`, `package_request_received.whatsapp` | automatic log, admin-reviewed send | immediately | one per package request or payment + channel | request/payment remains pending, log failed/skipped | member packages, admin messages requests |
| Payment confirmed | `confirmPaymentAndIssueReceipt` | member, payment, plan, amount, method | email, WhatsApp manual | `payment_confirmed.email`, `payment_confirmed.whatsapp` | automatic log, admin-reviewed send | after RPC returns confirmed/already_confirmed | one per payment + event + channel | payment remains confirmed, log failed/skipped | admin payments, member packages, admin messages |
| Receipt issued | `confirmPaymentAndIssueReceipt` receipt result | member, payment, receipt, receipt URL | email, WhatsApp manual | `receipt_issued.email`, `receipt_issued.whatsapp` | automatic log, admin-reviewed send | after receipt exists | one per receipt + event + channel | receipt remains issued, log failed/skipped | receipt page, member packages, admin messages |
| Attendance/no-show later | `markAttendance` with `no_show` | member, booking, class, attendance status | WhatsApp manual, email optional | `no_show_followup.email`, `no_show_followup.whatsapp` | admin-reviewed | after class/no-show marking | one per booking + no_show + channel | attendance remains marked, log failed/skipped | attendance page, admin messages |

## Template examples

### Booking confirmed

Hebrew email subject:

`ההרשמה שלך אושרה · {class_name}`

Hebrew email body:

`שלום {member_name}, המקום שלך נשמר לשיעור {class_name} בתאריך {date} בשעה {time}. נתראה ב־Cloud & Core.`

Hebrew WhatsApp:

`שלום {member_name}, ההרשמה שלך לשיעור {class_name} אושרה.
תאריך: {date}
שעה: {time}
מדריכה: {instructor_name}
נתראה ב־Cloud & Core.`

Arabic email subject:

`تم تأكيد حجزك · {class_name}`

Arabic email body:

`مرحباً {member_name}، تم حفظ مكانك في حصة {class_name} بتاريخ {date} الساعة {time}. نراك في Cloud & Core.`

Arabic WhatsApp:

`مرحباً {member_name}، تم تأكيد حجزك لحصة {class_name}.
التاريخ: {date}
الساعة: {time}
المدربة: {instructor_name}
نراك في Cloud & Core.`

English email subject:

`Your class booking is confirmed · {class_name}`

English email body:

`Hi {member_name}, your spot is saved for {class_name} on {date} at {time}. See you at Cloud & Core.`

English WhatsApp:

`Hi {member_name}, your booking for {class_name} is confirmed.
Date: {date}
Time: {time}
Instructor: {instructor_name}
See you at Cloud & Core.`

### Other template titles

| Event | Hebrew title | Arabic title | English title |
|---|---|---|---|
| Booking confirmed | ההרשמה לשיעור אושרה | تم تأكيد حجز الحصة | Your class booking is confirmed |
| Booking cancelled | ההזמנה לשיעור בוטלה | تم إلغاء حجز الحصة | Your class booking was cancelled |
| Class reminder | תזכורת לשיעור הקרוב | تذكير بالحصة القادمة | Reminder for your upcoming class |
| Class changed | פרטי השיעור עודכנו | تم تحديث تفاصيل الحصة | Your class details changed |
| Class cancelled | השיעור בוטל | تم إلغاء الحصة | Your class was cancelled |
| Waitlist joined | הצטרפת לרשימת ההמתנה | تمت إضافتك إلى قائمة الانتظار | You joined the waitlist |
| Waitlist spot available | התפנה מקום בשיעור | أصبح هناك مكان متاح | A class spot is available |
| Package request received | בקשת החבילה התקבלה | تم استلام طلب الباقة | Package request received |
| Payment confirmed | התשלום אושר | تم تأكيد الدفع | Payment confirmed |
| Receipt issued | הקבלה הונפקה | تم إصدار الإيصال | Receipt issued |

## Data model

### Existing fields usable now

* `notification_templates` can store localized templates by channel, trigger, and language.
* `notification_logs` can store generated message text, subject, trigger, status, member, class, booking, member plan, and sent-by admin.
* `members.email`, `members.phone`, and `members.preferred_language` support recipient selection.
* `studio_settings.whatsapp_number`, `contact_email`, `timezone`, and `default_language` support template variables.
* `payments`, `receipts`, `package_requests`, `bookings`, `classes`, `instructors`, and `rooms` provide the required event data.

### Missing fields that should be added

Proposed migration, not applied:

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
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS notification_logs_idempotency_key_uniq
  ON public.notification_logs(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS notification_logs_payment_idx
  ON public.notification_logs(related_payment_id);

CREATE INDEX IF NOT EXISTS notification_logs_receipt_idx
  ON public.notification_logs(related_receipt_id);

CREATE INDEX IF NOT EXISTS notification_logs_status_idx
  ON public.notification_logs(status, created_at DESC);
```

Optional, if member-facing notification history should use the existing `notifications` table:

```sql
ALTER TABLE public.notification_logs
  ADD COLUMN IF NOT EXISTS member_visible boolean NOT NULL DEFAULT false;
```

Recommended idempotency key format:

* `booking:{booking_id}:booking_confirmed:{channel}`
* `booking:{booking_id}:booking_cancelled:{channel}`
* `class:{class_id}:class_cancelled:{member_id}:{channel}`
* `waitlist:{entry_id}:waitlist_joined:{channel}`
* `waitlist:{entry_id}:waitlist_spot_available:{channel}`
* `package_request:{package_request_id}:package_request_received:{channel}`
* `payment:{payment_id}:payment_confirmed:{channel}`
* `receipt:{receipt_id}:receipt_issued:{channel}`
* `booking:{booking_id}:class_reminder_24h:{channel}`

## Security/RLS considerations

* Members can only view their own notification history if exposed.
* Admin can view all notification logs.
* Instructors should not see payment notifications unless the product explicitly allows it.
* Service role keys must remain server-side only.
* Email provider secrets must be server-side only.
* WhatsApp deep links generated client-side are acceptable because they do not use secrets.
* Do not expose other members' phone/email in roster or messages surfaces.
* Do not send to empty or invalid contact fields.
* Respect `members.status` and notification preferences if they are added or reused.
* The current `notification_logs` staff read policy allows instructors to read logs. For payment/receipt notifications, change read access to admin-only or add policy-level filtering before implementing payment logs.
* Do not store provider secrets or raw webhook secrets in `notification_logs.payload`.

## UI plan

### Member side

* Booking confirmation sheet:
  * Keep the current confirmation view.
  * Add neutral copy only: `ההרשמה אושרה. פרטי השיעור זמינים באזור ההזמנות.`
  * Only say "we sent confirmation" if the email provider actually sent or admin marks a manual send.
* Member bookings:
  * Show booking details and cancellation status.
  * Keep WhatsApp contact-studio fallback for special cases.
* Member packages:
  * After Cash/Bit request, show pending status and studio contact route.
  * Do not claim payment is confirmed until admin confirms.
* Receipts:
  * Existing receipt page remains the source of truth.

### Admin side

* Messages page:
  * Add filters for event, status, channel, language, member, and date.
  * Show notification logs, including payment and receipt records.
  * Add preview panel for each notification.
  * Add Copy WhatsApp message.
  * Add Open WhatsApp link.
  * Add Mark manually sent.
  * Add Skip reason if contact info missing or opt-out applies.
  * Add failed notification state.
* Package requests tab:
  * Link request rows to generated notifications.
* Payments page:
  * After confirmation, show generated notification rows/actions.
* Class/session edit/cancel flow:
  * Preview affected-member notifications before final send/mark.

## Provider plan

### V1 email

* If no provider configured: create log rows with status `skipped` and reason `email_provider_not_configured`, or `draft` if admin preview is desired.
* If provider is configured later: send through a server-side function only.
* Do not call provider APIs from client components.

### V1 WhatsApp

* Use `https://wa.me/<phone>?text=<encoded>`.
* Generate localized text server-side or with shared isomorphic helpers.
* Admin manually sends.
* Status becomes `manually_sent` only after admin clicks mark sent.
* Opening a WhatsApp link should not automatically mark as sent.

### V2 WhatsApp Business API

* Add provider integration only after business account and approved templates exist.
* Store provider message ID.
* Process delivery webhooks into `provider_events` or notification delivery fields.

## Implementation steps

1. Add the approved migration for missing notification log fields and indexes.
2. Add `src/lib/notificationTemplates.ts` with typed event keys, variable definitions, and localized default copy.
3. Add `src/lib/notificationService.ts` or server functions in `src/lib/notifications.functions.ts`:
   * `resolveNotificationLanguage(member, appLang, settings)`
   * `buildNotificationPayload(eventType, relatedIds)`
   * `renderNotificationTemplate(template, variables)`
   * `prepareNotification(eventType, channel, relatedIds)`
   * `prepareNotificationsForEvent(eventType, relatedIds)`
   * `buildWhatsAppNotificationLink(notificationId)`
   * `markNotificationManuallySent(notificationId)`
   * `markNotificationFailed(notificationId, error)`
4. Add idempotent insert/upsert using `idempotency_key`.
5. Wire booking success after `bookClass` returns `booked`.
6. Wire member/admin cancellation after RPC returns success.
7. Wire waitlist joined and waitlist spot available after their RPCs return success.
8. Wire package request/manual payment request after insert succeeds.
9. Wire payment confirmed and receipt issued after `confirmPaymentAndIssueReceipt` returns confirmed or already confirmed.
10. Update admin Messages activity log filters and row actions.
11. Update member success copy so it never overclaims an external send.
12. Add tests for template rendering, idempotency, and no-provider behavior.

## Test plan

Commands:

```bash
/Users/ameeramer/.bun/bin/bunx tsc --noEmit
/Users/ameeramer/.bun/bin/bun run build
/Users/ameeramer/.bun/bin/bunx tsx tests/unit/i18n.test.mjs
```

Functional tests:

1. Member books class.
2. Booking succeeds.
3. Notification logs are created for booking confirmation.
4. WhatsApp message preview is generated.
5. Email notification is skipped if no provider is configured.
6. Admin sees notification log.
7. Admin opens WhatsApp deep link.
8. Admin marks notification manually sent.
9. Member cancels booking.
10. Cancellation notification is logged once.
11. Member joins waitlist.
12. Waitlist joined notification is logged once.
13. Admin offers waitlist spot.
14. Waitlist spot notification is logged once.
15. Member submits Cash/Bit package request.
16. Package request notification is logged once.
17. Admin confirms manual payment.
18. Payment confirmed notification is created.
19. Receipt issued notification is created.
20. Duplicate payment confirmation does not duplicate notification logs.
21. Hebrew templates render with RTL-friendly wording.
22. Arabic templates render with RTL-friendly wording.
23. English templates render without RTL punctuation issues.
24. No real external email is sent.
25. No real WhatsApp API message is sent.

## Open questions for Ameer

1. Should payment and receipt notification logs be admin-only, or can instructors see non-financial message logs only?
2. Should V1 create email `skipped` records when no provider exists, or only create WhatsApp/manual draft records?
3. Should member-facing notification history be visible in the app in V1, or only admin logs?
4. Should opening WhatsApp count as `opened`, or should the only final manual status be `manually_sent`?
5. For Cash/Bit package requests, should the first message go to the member, to the studio/admin, or both?
6. Should the default launch language fallback be Hebrew even when `studio_settings.default_language` is English?
7. Should class reminder V1 be manual only from the Messages page, or should it wait entirely for V2 scheduled jobs?

