# Premium Concierge implementation audit

## Repository architecture

Cloud & Core is a Bun-managed TypeScript application built with React 19, TanStack Start/Router,
Vite, Tailwind 4, TanStack Query, and Zod. PostgreSQL is hosted through Supabase. Schema changes
are ordered SQL files in `supabase/migrations`; authentication is Supabase Auth, roles are
`member`, `instructor`, and `admin`, and access is enforced by route guards plus RLS.

The application runs as one web/server deployment. Scheduled notification work is invoked by
`scripts/member-notification-cron.mjs` against authenticated internal TanStack endpoints.
OpenWA is a separate local worker; official WhatsApp, APNs, and Resend are server adapters.

## Existing domain model

- Members are auth-backed `members`; profiles carry roles. Members have locale, email, phone,
  credit balance, attendance count, and last visit.
- Kids are independent `kid_aerial_children` with guardian name/contact fields. Their packages,
  enrollments, payments, subscriptions, assignments, and attendance are separate tables. There
  was no normalized guardian identity or authorization relationship.
- Classes reference instructors and program types and contain publication/status, schedule,
  capacity, room, credit cost, and visibility. Bookings connect a member and class. Fixed kids
  attendance uses assignments rather than ordinary member bookings.
- Plans, member plans, recurring subscriptions, package requests, payments, provider events,
  and receipts are implemented. `confirm_payment_and_issue_receipt` provides the important
  payment/receipt transaction boundary.
- Notifications span legacy `notification_templates`/`notification_logs`, member push
  preferences/tokens/notifications/campaigns, OpenWA queues, and the newer canonical
  `message_outbox`, `messages`, deliveries, attempts, conversations, and webhook events.

## Existing transaction and worker behavior

Booking RPCs update booking, credits, class count, attendance, and audit evidence in one
PostgreSQL transaction. Trigger-based canonical message emission is consequently in the same
transaction. Class changes, waitlist changes, payment state, subscription failure, receipts,
and package requests also emit into `message_outbox` using triggers. The canonical worker
claims with `FOR UPDATE SKIP LOCKED`; deliveries use leases and bounded retries.

`message_outbox` is already effectively-once at materialization through deterministic unique
keys. Delivery records have provider IDs, attempts, failure classification, and
`delivery_unknown`. Webhook storage is deduplicated and delivery progression is monotonic.
Resend and official WhatsApp validate signatures; OpenWA is explicitly a separate operational
adapter and must not be represented as an official inbound provider.

## Provider and channel support

- In-app: `member_notifications` and canonical member-visible `messages`.
- Push: Capacitor/APNs tokens and an APNs server adapter.
- Email: Resend adapter and signed webhook endpoint.
- WhatsApp: official Meta template adapter/webhook plus OpenWA claim/report worker.
- Instagram: no live inbound messaging integration. Only the lead contract/state model can be
  completed without external Meta setup.

No Kafka, Temporal, Redis, or general queue service exists, so PostgreSQL remains the correct
coordination mechanism.

## Admin and localization

The admin Messages center already contains inbox, delivery console, templates, composer,
manual logs, package requests, and iPhone campaigns. Arabic, Hebrew, and English exist in the
application i18n system. RTL is globally supported. Existing notification templates cover the
three locales unevenly and do not have an independent approved lifecycle per
channel/locale/version.

## Duplicate and conflicting behavior

- Existing decisions are primarily per member/event; no cross-event recipient arbitration
  exists.
- `member_id` conflates participant and recipient. Kids store guardian text, not an authorized
  adult entity.
- Payment confirmation currently prefers WhatsApp and omits push. Payment failure currently
  bypasses quiet hours. Both conflict with the approved policy.
- Routine lifecycle WhatsApp fallback and 30-day retention logic lack an episode record and
  atomic cross-channel contact reservation.
- Legacy and canonical notification evidence coexist. It must be migrated gradually, never
  deleted.
- Most existing canonical tables predate studio scoping.

## Tests and gaps

The repository uses Bun tests under `tests/unit` and `tests/integration`. Existing coverage is
strongest around pure notification policy, canonical materialization, templates, webhooks,
provider adapters, and queue helpers. Database concurrency/RLS tests require a configured local
Supabase instance and are not part of the default test command. Missing coverage included
guardian resolution, recipient arbitration, total-contact caps, consolidated payment outcomes,
schedule publication identity, suitable-class eligibility, and episode closure.

## Reusable modules

`unifiedMessaging.server.ts`, `unifiedMessagingMaterialization.ts`,
`notificationQueue.server.ts`, `messagingProviders.server.ts`, APNs/Resend/WhatsApp adapters,
webhook status functions, `studio-time.ts`, server route guards, and the existing Messages
center are the primary reuse points.

## Risks

The highest risks are incorrect kid-to-adult migration, duplicate legacy/canonical outputs,
activation without complete locale approvals, ambiguous WhatsApp results, provider event
ordering, and old marketing backlog replay. The foundation therefore does not infer kid
guardians, excludes historical outbox rows from claims, defaults automations to paused, and
keeps all external channel switches off.
