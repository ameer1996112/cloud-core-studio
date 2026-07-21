# Premium Branded Notification System

## Objective

Turn Cloud & Core notifications into one professional, branded system across the in-app inbox,
iPhone APNs pop-ups, WhatsApp, and email. The system must cover every approved member event while
preventing duplicate, stale, mistargeted, or overly frequent communication.

This implementation must remain disabled-by-default for new event families. Automated tests use
provider mocks. No real customer delivery or broad production rollout is part of implementation.

## Brand and localization

- Voice: warm, calm, premium, personal, and concise.
- Languages: native-quality Hebrew, Arabic, and English with correct RTL, date, time, currency, and
  plural formatting.
- Missing or unreviewed locale content is suppressed; another language is never substituted.
- Positive moments may use minimal emoji. Urgent copy stays clear and direct.
- The app icon, existing brand colors, terminology, and a subtle original/licensed sound form the
  notification identity.
- Rich images are limited to schedule and recommendation content. Operational and private events
  remain text-first.

## Importance tiers

1. `critical`: class cancellation, material time/location change, payment/subscription failure,
   expiring waitlist offer, direct staff reply, and explicit urgent studio announcement. These may
   send immediately and use iOS Time Sensitive interruption when permitted.
2. `transactional`: booking/payment/membership state confirmations and refunds.
3. `reminder`: class, payment, renewal, credit, and expiry reminders.
4. `promotional`: schedule openings, recommendations, trial follow-up, and retention.
5. `inbox_only`: durable records such as receipts or non-actionable confirmations.

Apple Critical Alerts are explicitly out of scope.

## Channel contract

- Every member event creates a durable in-app notification unless its definition explicitly says
  otherwise.
- APNs is the phone pop-up channel.
- WhatsApp and email are event-specific rather than universal duplicates.
- Critical events fall back to approved WhatsApp/email when no active push installation exists.
- Promotional events never fall back to transactional channels without the relevant consent.

## Event families

- Booking: confirmed, cancelled, changed, checked in, and no-show follow-up.
- Class: cancellation, time/location/instructor change, planning/final reminders, publication, open
  spots, and recommendations.
- Waitlist: joined, position changed, spot offered, accepted, expired, and removed.
- Payment: request received, pending, confirmed, failed, refunded, and receipt issued.
- Membership: activated, low/depleted credits, expiring/expired package, renewal upcoming/succeeded/
  failed, paused, and cancelled.
- Communication: handoff opened/resolved, staff reply, and urgent studio announcement.
- Engagement: trial follow-up and retention reminder.
- Children: guardian-facing booking/class/waitlist/staff events. Children payment events remain out
  of scope until that workflow is approved.

## Preferences and privacy

- Granular preferences: class operations, reminders, schedule openings, waitlist, payments,
  membership, staff replies, recommendations, marketing, sound, and Time Sensitive permission.
- Members may disable reminders, recommendations, and marketing. Critical operational records
  remain in-app and use approved fallback when push is unavailable.
- Permission prompting is contextual after login or a successful booking.
- Sensitive payment details, child details, private notes, tokens, and message bodies do not appear
  in technical logs or unsafe lock-screen copy.
- Content is redacted after 180 days; delivery/consent/audit metadata is retained for 13 months.

## Timing and frequency

- Routine external delivery window: 08:00–20:30 Asia/Jerusalem.
- Booking confirmation: immediate.
- Planning reminder: two hours before the free-cancellation deadline.
- Final reminder: two hours before class, or 20:00 the prior evening for classes before 10:30.
- Payment pending: push after 24 hours and WhatsApp escalation after 72 hours.
- Payment/subscription failure: immediate with one unresolved follow-up after 24 hours.
- Renewal upcoming: seven days and one day before.
- Credits: once when reaching two and once when reaching zero.
- Package expiry: seven days and two days before.
- Promotional/recommendation cap: one per rolling 24 hours and three per rolling seven days.
- Open-class members with credits receive `Book now`. Zero-credit members may receive `View class /
Choose package` only with schedule plus marketing/package consent.

## iPhone behavior

- Register native categories and foreground actions.
- Use `thread-id`, `apns-collapse-id`, expiry, category, interruption level, relevance, badge, and
  optional `mutable-content` correctly.
- Supported actions include view class, cancel booking, claim waitlist spot, book now, choose
  package, fix payment, contact studio, and reply. Sensitive/irreversible actions open the
  authenticated app for confirmation.
- Operational notifications are grouped by class/booking, payments by transaction/subscription,
  and replies by conversation. Superseding states replace outdated banners.
- Read/open state and badges synchronize across active installations.
- Permanent APNs token failures deactivate only that installation. Logout deactivates its token;
  installations unseen for 90 days stop receiving until they register again.
- Android remains architecture-ready, but FCM and browser push are deferred.

## Reliability and tracking

- The transactional outbox is the source of truth.
- Critical/user-triggered events wake the dispatcher after commit; the one-minute scheduler remains
  the durable fallback.
- Deliveries are idempotent per channel and push installation, with bounded retries, leases,
  stale-worker recovery, expiry, and pre-send domain revalidation.
- States include queued, sending, accepted, sent, device_received where available, delivered, read,
  opened, actioned, converted, failed, dead_letter, suppressed, expired, cancelled, and
  delivery_unknown where provider ambiguity applies.
- Track aggregate performance by event, channel, language, and template version without logging PII.

## Member experience

- Bell preview plus a full branded inbox.
- Today, This Week, and Earlier sections; unread, pinned, archived, and expired states.
- Filters for Classes, Waitlist, Payments, Membership, and Studio.
- Exact authenticated deep links, visibly disabled expired actions, synchronized badge/read state,
  and direct access to preferences.

## Admin experience

- Notifications inbox, deliveries/dead letters, templates, campaigns, activity, and performance.
- Hebrew/Arabic/English plus iPhone lock-screen previews.
- Verified staff-device tests only.
- Audience/exclusion/frequency preview, two-step broad-campaign confirmation, channel/category kill
  switches, global emergency pause, and immutable staff activity.

## Acceptance

- Every enabled event has tested Hebrew, Arabic, and English content.
- Critical events normally reach APNs within 60 seconds.
- Concurrent workers/provider retries do not create duplicates.
- Cancelled, expired, booked, waitlisted, opted-out, or superseded events do not send.
- Every action opens the correct authenticated state.
- Token refresh, logout, permission, multi-device, badge, and grouping flows are tested.
- Unit/integration/provider tests are mocked. Real-device tests require a separately authorized,
  verified staff device.
- Seven clean allowlist days are required before each rollout expansion.

## Rollout and rollback

Deploy schema and code with new event families disabled. Release native capability changes before
enabling rich/action payloads. Roll out critical/transactional, then reminders, then promotional
families from staff allowlist to a small cohort and finally eligible members.

Rollback uses event/channel kill switches, scheduler pause, and application revision rollback.
Expand-only tables remain intact and safe events retain their idempotency keys.
