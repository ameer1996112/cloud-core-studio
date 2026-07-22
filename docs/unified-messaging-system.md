# Unified Messaging System — Phases 1 and 2

## Safety state

The canonical messaging system is implemented but disabled by default. The database migration is expand-only. It does not delete or update Meta templates and it does not delete legacy `notification_logs` or `member_notifications` rows. OpenWA, the previous official-WhatsApp route, and the legacy member-notification/APNs sweep now require explicit legacy flags and default to disabled.

No provisioning command creates a Meta template unless all of the following are explicit:

- `--apply`
- `--waba-id 1009561255148806`
- valid Meta credentials
- valid Supabase service-role credentials
- successful acquisition of the WABA-scoped database lease

The local template generator and test suites do not call Meta, Resend, or APNs.

## Architecture

Domain changes write transactional events to `message_outbox`. The internal sweep claims events using `FOR UPDATE SKIP LOCKED`, renders one immutable v2 message snapshot, and creates one delivery per selected channel. `in_app`, `push`, `email`, and `whatsapp` remain independent, so a provider failure cannot hide an in-app record.

The main records are:

- `message_outbox`: domain event, deduplication key, availability, expiry, and worker lease.
- `messages`: rendered channel-neutral content, language, template key/version, visibility, and legacy source.
- `message_deliveries`: channel/provider state, provider ID, idempotency key, schedule, expiry, and failure classification.
- `message_delivery_attempts`: bounded attempt history and retry metadata.
- `message_webhook_events`: verified WhatsApp/Resend event ledger, unique provider event key, and processing state.
- `message_conversations`: guest/member identity, handoff assignment, resolution, and 24-hour service window.
- `whatsapp_template_deployments`: WABA-scoped content hash and approval status.
- `whatsapp_provisioning_leases`: distributed provisioning lock.
- `message_delivery_targets`: one APNs outcome per installation beneath the aggregate push delivery.
- `message_engagement_events`: idempotent device-received, opened, actioned, converted, archived,
  and dismissed receipts owned by the authenticated member.
- `notification_event_rollouts`: copy-review and disabled-by-default gates for premium event types.
- `notification_preference_events`: immutable preference-change audit without message content.
- `notification_experiment_assignments`: stable 10% control/treatment assignment for nonessential
  growth messaging.

Legacy writes are mirrored into the canonical model. Historical legacy rows are backfilled with their original table and row ID. Canonical reads in the member notification center remain behind `MESSAGING_CANONICAL_READS_ENABLED`.

## Required configuration

- Supabase: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and server-only `SUPABASE_SERVICE_ROLE_KEY`.
- Dispatcher gates: `MESSAGING_SCHEDULER_ENABLED`, `MESSAGING_IMMEDIATE_DISPATCH_ENABLED`,
  `MESSAGING_INTERNAL_SWEEP_URL`, `MESSAGING_CANONICAL_READS_ENABLED`,
  `MESSAGING_DELIVERY_MODE`, `MESSAGING_RECIPIENT_ALLOWLIST`,
  `MESSAGING_WHATSAPP_ENABLED`, `MESSAGING_EMAIL_ENABLED`, `MESSAGING_PUSH_ENABLED`, and
  `MESSAGING_LIVE_WABA_CONFIRMATION`.
- Meta: `META_GRAPH_API_VERSION`, `META_WABA_ID`, `META_WHATSAPP_PHONE_NUMBER_ID`, `META_ACCESS_TOKEN`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, and `WHATSAPP_APP_SECRET`.
- Email/links: `RESEND_API_KEY`, `MESSAGING_EMAIL_FROM`, `MESSAGING_EMAIL_REPLY_TO`, `MESSAGING_PUBLIC_BASE_URL` (HTTPS), and `RESEND_WEBHOOK_SECRET`.
- APNs: `APNS_ENV`, build-time `VITE_APNS_ENV`, `APNS_KEY_ID`, `APNS_TEAM_ID`,
  `APNS_BUNDLE_ID`, and `APNS_PRIVATE_KEY`.
- Internal sweep: `NOTIFICATION_AUTOMATION_TOKEN`.
- Rollback-only legacy gates: `OPENWA_LEGACY_DELIVERY_ENABLED`, `OFFICIAL_WHATSAPP_LEGACY_DELIVERY_ENABLED`, and `LEGACY_MEMBER_NOTIFICATION_DELIVERY_ENABLED`.

All dispatcher and channel gates default to disabled. Transactional domain triggers also remain off until `studio_settings.messaging_canonical_writes_enabled` is explicitly set to `true`; while it is false, legacy rows may mirror into canonical storage for validation but the v2 dispatcher never claims legacy deliveries. `MESSAGING_RECIPIENT_ALLOWLIST` is mandatory in allowlist mode. Live mode additionally requires `MESSAGING_LIVE_WABA_CONFIRMATION=1009561255148806`.

Allowlist comparison is case-insensitive for email/UUID values and canonicalizes the studio's
historical Israeli mobile forms (`05xxxxxxxx`, formatted local values, and `972...`) to E.164 before
comparison. Provider requests still receive the recipient format selected by the channel adapter.

The database release gate is `MESSAGING_TEST_DATABASE_URL=... bun run test:integration`. Unlike the
general local suite, this command fails closed when the ephemeral PostgreSQL/Supabase database is
missing, so CI cannot report migration, concurrency, or RLS coverage as passing without executing it.

## Event and channel behavior

The channel matrix is encoded in `src/lib/messagingPolicy.ts`. Only class cancellation, material class-time change, and payment failure bypass later email/WhatsApp opt-outs. Other external deliveries require the relevant preference. In-app and push are separate deliveries.

Routine external delivery is scheduled inside 08:00–20:30 Asia/Jerusalem. Booking actions, handoff replies, class cancellation/time change, and payment failure can be immediate. The reminder sweep uses the existing cancellation-aware schedule:

- planning reminder: two hours before the cancellation deadline;
- final reminder: two hours before the class, or 20:00 on the prior evening for classes before 10:30.

Waitlist deliveries inherit `offer_expires_at`; no retry is scheduled at or beyond that deadline. Missing or unapproved locale-specific WhatsApp templates are suppressed as configuration failures. No language fallback is used.

Studio one-time/manual/HYP payments and `member_subscriptions` are covered by outbox triggers. The kids payment module is intentionally unchanged. A payment request creates in-app and email immediately. Pending payments create the in-app/push reminder after 24 hours and schedule WhatsApp escalation 48 hours later (72 hours after the original pending state). The dispatcher rechecks payment state before every delayed attempt, so paid or failed payments cancel obsolete pending reminders. Payment/subscription failures send immediately and receive one deduplicated follow-up while still failed after 24 hours. A normal success uses in-app, quiet push, and email; WhatsApp success is used only when the payment recovered from `failed`.

### Premium event policy and iPhone experience

`src/lib/premiumNotificationCatalog.ts` is the channel-neutral policy for all 43 booking, class,
waitlist, payment, membership, communication, and engagement events. It defines tier, channels,
fallbacks, preference, quiet-hours behavior, APNs interruption level, sound, and branded actions.
Every event has reviewed Hebrew, Arabic, and English copy and is enabled at the database event gate
by `20260721190000_premium_notification_all_events.sql`, but every row remains
`allowlist_only=true`. Disabled runtime mode therefore sends nothing, allowlist mode reaches only a
verified staff contact, and live mode still suppresses the row until an administrator explicitly
promotes it to Live eligible.

Members receive one deduplicated `member_welcome` message when inserted active or when an existing
pending/inactive record later becomes active. Consented channels are in-app, WhatsApp, and email.
The primary app action is selected at materialization time: upcoming booking, first lesson, or
membership/package. The scheduler normally materializes it within one minute and its five-minute
service target is monitored operationally. Existing active members are not backfilled with a
welcome during migration. WhatsApp remains suppressed until the exact locale of
`cc_member_welcome_v2` is created, approved, and reconciled.

Planning reminders create an in-app record and prefer push; WhatsApp is retained only as a fallback
when no active push installation exists. Final reminders create in-app plus WhatsApp without a
second push interruption. The final reminder remains two hours before class, or 20:00 the previous
evening for classes before 10:30.

Growth messages are push-first. Open-class candidates must be 2–24 hours away and at most 70% full,
are ranked from the member's recent instructor/day/time attendance affinity, and are offered to at
most ten members per class across all scheduler sweeps. Pending sends stop when the class reaches
85%. A recommendation contains the best one or two unbooked lessons by recent instructor/day/time
attendance affinity. It may add one weekly WhatsApp escalation only for a consented member with no
future booking, no recent booking/planning message, two recent successfully sent but unopened growth
pushes, and no prior escalation in seven days. Retention uses a caring push at 21 days and a personal
WhatsApp message at 30 days. Ten percent of members are held out from nonessential growth messaging,
and the third successfully sent but unengaged growth push starts a durable 30-day cooldown.

The iPhone registration stores a random installation ID, token hash, app/build version, locale,
environment, capability set, permission sync time, logout time, and stale deadline. Raw APNs tokens
are service-role-only. A transaction-safe registration RPC locks token/installation identity so
concurrent token rotation updates one installation instead of creating a second active device. A
member can have multiple installations; successful targets are not resent while a transiently
failed target remains retryable. Permanent APNs errors deactivate only that token; an accepted send
whose target status cannot be persisted becomes `delivery_unknown` and is never automatically
retried.

APNs payloads support category actions, thread/collapse IDs, expiry, badge, Time Sensitive
interruption, relevance, privacy-safe deep links, and optional rich-media metadata. Push-capable
canonical events are rendered through `src/lib/premiumPush.ts`, which produces a short localized
title, contextual subtitle, and one caring lock-screen sentence instead of projecting the longer
email/WhatsApp body. The renderer covers every push-capable event in Hebrew, Arabic, and English,
removes line breaks, applies lock-screen length limits, never uses the member name, and never shows
payment amounts, receipt URLs, or message bodies. Full content remains available in the authenticated
in-app notification. Native action categories are registered in `ios/App/App/AppDelegate.swift` with
Hebrew/Arabic/English labels.
The server uses `cloud_core_important.caf` for brand-important alerts; before the native rollout,
add the approved licensed sound asset to the app target or iOS will use its normal fallback sound.
Rich recommendation images require the native Notification Service Extension before those draft
events may be enabled.

The member notification center has All/Unread views, family filters, Today/This Week/Earlier
grouping, pin-aware ordering, archive and expired-action handling, critical treatment, safe deep
links, and granular practice/account/communication controls. The admin Messages page exposes Inbox,
Deliveries (including per-device success counts), Event matrix, Templates, Activity, and a Journey
Lab. Journey Lab previews all 43 localized journeys and queues exactly one channel for one active,
allowlisted staff member. Tests expire after 24 hours, bypass quiet hours and customer promotional
frequency reservations, and still honor consent, provider gates, APNs staff-device verification,
contact data, and WhatsApp locale approval. The complete manual procedure is in
[Premium messaging manual test runbook](./premium-messaging-manual-test-runbook.md).

### Open-class iPhone alerts

`class_open_spots` is a push-first schedule-opening event. It creates independent in-app and APNs
deliveries and never creates a WhatsApp or email delivery. The one-minute canonical sweep considers
only scheduled, member-visible classes starting 2–24 hours from the sweep and at no more than 70%
capacity. A member is eligible only when all of the following are true:

- the account is active, has remaining credits, and has an active permission-granted iPhone token;
- the member enabled the existing **New schedules and lesson openings** preference;
- the member is neither booked nor waitlisted for that class;
- that member/class pair has not already been alerted; and
- the member has received fewer than one open-class alert in 24 hours and fewer than three in seven
  days.

At most one class is selected per member in a sweep. Allowlist mode filters candidates by the member
ID before an outbox event is created, so non-allowlisted members do not receive or accumulate a
hidden in-app promotion. `enqueue_open_class_alert` serializes reservations per member and counts
pending as well as processed outbox rows, so concurrent sweeps cannot exceed the rolling limits.
Before a delayed delivery is sent, the worker rechecks class/booking/waitlist state, account status,
credits, consent, and a permission-granted APNs token. The message opens `/member/schedule`.

This event intentionally has no Meta template. A future WhatsApp version must use separate explicit
marketing consent and a separately authorized `MARKETING` template; it must not be added to the
existing utility template catalog.

## Delivery states and retries

Canonical states are `queued`, `sending`, `accepted`, `sent`, `delivered`, `read`, `failed`, `dead_letter`, `suppressed`, `expired`, `cancelled`, and `delivery_unknown`.

- WhatsApp: four total attempts with 1-, 5-, and 30-minute backoff; `Retry-After` wins when longer. A transmitted timeout is `delivery_unknown` and cannot be manually retried until reconciled.
- Resend: the same delivery idempotency key and `X-Entity-Ref-ID` are used on every attempt; five total attempts at 1 minute, 5 minutes, 30 minutes, and 2 hours. Every request contains branded HTML plus a complete plain-text alternative.
- APNs: initial attempt plus two retries. `BadDeviceToken`, `Unregistered`, and `DeviceTokenNotForTopic` deactivate only the affected token.

Terminal failures create admin in-app alerts. Manual retry refuses expired and ambiguous deliveries.

## Webhook security

### WhatsApp

`POST /api/public/webhooks/whatsapp`:

- refuses requests when `WHATSAPP_APP_SECRET` is missing;
- limits the raw request to 1 MiB;
- verifies `x-hub-signature-256` before parsing;
- requires the configured WABA and phone-number ID in the payload;
- stores a verified unique event before processing;
- deduplicates inbound messages by `wamid` and statuses by message ID, status, and provider timestamp;
- applies monotonic status transitions;
- returns an error if durable storage or processing fails so Meta can retry.

Inbound text, button/list replies, and media metadata are supported. Only media ID, MIME type, filename, and caption are stored. `GET /api/internal/messages/media/:mediaId` verifies an admin bearer token, fetches media from Meta on demand, returns `Cache-Control: private, no-store`, and never saves the bytes.

Every inbound reply creates or reopens a handoff, extends the service window, alerts admins, and pauses nonessential WhatsApp automation for that contact. A localized acknowledgement is queued only for a newly opened handoff. Unknown or ambiguous phone matches remain guest conversations. Common English, Hebrew, and Arabic opt-out keywords disable routine WhatsApp and still open a handoff.

### Resend

`POST /api/public/webhooks/resend` verifies the raw Svix signature using `RESEND_WEBHOOK_SECRET`, checks timestamp freshness, and deduplicates by `svix-id`. Provider states remain in `provider_status`; the canonical delivery state advances monotonically. Complaints disable routine email for that member.

`src/lib/transactionalEmail.ts` is the pure presentation boundary for email. It renders one compact,
table-based Cloud & Core shell for every catalog event, with explicit Hebrew/Arabic RTL, English LTR,
real paragraph spacing, localized event labels and calls to action, whitelisted structured facts, and
same-origin HTTPS links. Member-controlled values are escaped. The provider adapter receives only the
rendered subject, HTML, text, safe headers, recipient, and durable idempotency key.

Transactional deliverability requirements:

- use one stable From identity on the exact Resend-verified transactional subdomain;
- keep a working Reply-To and invite replies instead of using `no-reply`;
- publish SPF, DKIM, and DMARC for the organizational domain, beginning with `p=none` while all
  sources are audited before moving to enforcement;
- keep Resend click/open tracking disabled for transactional mail;
- use the authenticated application origin for every action link;
- send one representative visual QA email at a time. Never repeat the all-events burst against one
  mailbox for visual testing because that traffic pattern resembles bulk mail;
- retain the text alternative, compact body, single primary action, bounce/complaint suppression,
  and existing provider idempotency on every retry.

## Template catalog and provisioning

`src/lib/messageTemplateCatalog.ts` is the immutable source for every event/language body, subject, variable schema, version, Meta name, and category. `he`, `ar`, and `en` content must remain in parity. WhatsApp JSON under `whatsapp/templates/v2` is generated from this catalog. The current catalog contains 19 semantic Meta names and 57 checked-in locale variants (19 each for `he`, `ar`, and `en_US`). Welcome remains `UTILITY`; recommendation and personal-return templates are explicitly `MARKETING`. Checked-in does not mean created or approved in Meta.

Local commands:

```sh
bun run whatsapp:templates:check
bun run whatsapp:templates:plan
```

`plan` performs only read/reconcile work. If Meta credentials are absent it prints the local create plan without a remote call. Exact remote content is unchanged, missing variants are planned, duplicates are reported, and content drift requires a new version. It never updates or deletes a template.

Do not run this without separate production authorization:

```sh
bun run whatsapp:templates:apply
```

Apply performs a paginated preflight, acquires a WABA database lease, creates sequentially, and reconciles after provider errors. Existing same-name content drift is never updated in place.

## Operations

The internal worker endpoint is `POST /api/internal/messages/sweep` with `Authorization: Bearer $NOTIFICATION_AUTOMATION_TOKEN`. It also requires `MESSAGING_SCHEDULER_ENABLED=true`. Start with delivery mode disabled and all external channel flags false.

When `MESSAGING_IMMEDIATE_DISPATCH_ENABLED=true`, successful application mutations make a bounded,
authenticated post-commit request to `MESSAGING_INTERNAL_SWEEP_URL`. The request is best-effort and
never replaces the one-minute scheduler: a timeout leaves the durable outbox for recovery. Keep this
flag false until the protected internal URL and allowlist behavior have been validated.

Production automation uses a dedicated `cloud-core-unified-messaging-sweep` Cloud Run job and the
`cloud-core-unified-messaging-sweep-1m` Cloud Scheduler job. The job runs
`scripts/unified-messaging-cron.mjs` and calls only the protected canonical sweep endpoint. It is
separate from the retained 15-minute legacy notification job.

Configure the canonical job with the exact deployed application image:

```sh
UNIFIED_MESSAGING_JOB_IMAGE="REGION-docker.pkg.dev/PROJECT/REPOSITORY/IMAGE:TAG" \
  scripts/configure-unified-messaging-cloud-run.sh
```

The configuration script creates or updates the scheduler in a paused state by default. Verify the
job, service flags, database write gate, queue counts, and allowlist before resuming it. Set
`UNIFIED_MESSAGING_START_PAUSED=false` only for an already-validated rollout.

When an external channel flag is off, newly materialized v2 deliveries for that channel are stored
as `suppressed` with `<channel>_channel_disabled`; they are not left queued for a surprise late send
when the channel is enabled later. In-app delivery remains independent.

For push allowlist testing, include the verified member UUID in `MESSAGING_RECIPIENT_ALLOWLIST` in
addition to any WhatsApp phone number. Push delivery addresses are member UUIDs, not phone numbers.
Add `admin_group` only when testing handoff alerts. In allowlist mode, both member and admin APNs
queries require a non-revoked `notification_staff_test_devices` row and the matching APNs
environment. Sandbox tokens are never sent through the production endpoint or deactivated because
of an environment mismatch. Legacy tokens with no trustworthy environment are deactivated by the
expand migration and become eligible again only after the native build re-registers them with its
declared `VITE_APNS_ENV`.

The Admin Messages event matrix is the per-event and per-channel kill-switch. All 43 reviewed
events begin enabled but allowlist-only at the database rollout layer. Moving an event to Live
eligible is a separate explicit action and always retains in-app delivery. Promotional customer
events reserve an atomic one-per-24-hours,
three-per-seven-days budget before materialization.
The matrix exposes an explicit `Allowlist only` / `Live eligible` control. Global allowlist mode
still restricts every channel, including in-app, regardless of the per-event setting. A draft event
marked allowlist-only remains suppressed in global live mode until an admin promotes that event.

Structured JSON logs go to stdout with correlation, message, delivery, attempt, provider, outcome, duration, and retry classification fields. The logging allowlist rejects names, addresses, bodies, tokens, and signatures.

Run `select public.redact_and_purge_message_audit();` from the protected retention scheduler. It
redacts message bodies and rendered variables after 180 days; after 13 months it clears delivery
recipients, provider IDs/payloads/errors and deletes attempts, webhooks, per-device targets,
engagement, preference-audit, and promotional-frequency rows.

Troubleshooting sequence:

1. Check `message_outbox.last_error` and whether the event lease is stale.
2. Check the delivery state, `error_code`, `failure_class`, expiry, and active handoff state.
3. Check the latest `message_delivery_attempts` without copying recipient/body fields into logs or tickets.
4. For WhatsApp, verify WABA/phone ID and `whatsapp_template_deployments` approval for the exact locale.
5. For `delivery_unknown`, inspect Meta Manager/API before any staff reconciliation; do not retry blindly.
6. For Resend, verify the sender domain, sender, Reply-To, webhook secret, and selected delivery events.
7. For APNs, verify credentials/environment and whether only one token was deactivated.
8. If an APNs target is `delivery_unknown`, reconcile it manually; the provider accepted the alert
   but target-status persistence was uncertain, so an automatic retry could duplicate the pop-up.

## Migration validation

Before and after applying the migration, capture:

```sql
select count(*) from public.notification_logs;
select count(*) from public.member_notifications;
select count(*) from public.messages where legacy_source_table = 'notification_logs';
select count(*) from public.messages where legacy_source_table = 'member_notifications';
select count(*) from public.message_deliveries;
```

The two canonical legacy counts must equal their corresponding legacy table counts. Existing active members with a valid phone/email are automatically enabled with consent source `existing_member_auto_enable`. Obtain policy/legal approval before live use.

## Non-destructive rollback

1. Set `MESSAGING_DELIVERY_MODE=disabled`, `MESSAGING_SCHEDULER_ENABLED=false`,
   `MESSAGING_IMMEDIATE_DISPATCH_ENABLED=false`, every new channel flag to false, and
   `studio_settings.messaging_canonical_writes_enabled=false`. Set every
   `notification_event_rollouts.enabled=false`. Re-enable
   `LEGACY_MEMBER_NOTIFICATION_DELIVERY_ENABLED=true` only when intentionally returning to the
   legacy APNs worker.
2. Record the cutover timestamp and run `docs/sql/unified-messaging-rollback-reconciliation.sql` with that value. The script inserts only missing legacy projections and disables mirror recursion for its transaction.
3. Verify projected counts and statuses.
4. Revert the application to the prior release.
5. Keep canonical tables, webhook events, and backfill rows intact. Do not run destructive down migrations.
6. Recover and reprocess with the existing idempotency keys.

## Exact pre-production sequence

1. Back up the database and capture all legacy/canonical counts.
2. Apply `20260720140000_unified_messaging_phases_1_2.sql`,
   `20260721143000_open_class_alert_reservations.sql`, and
   `20260721170000_premium_notification_foundation.sql`, then
   `20260721190000_premium_notification_all_events.sql`, then
   `20260722120000_premium_messaging_journey_tuning.sql` with immediate dispatch, the scheduler,
   and channels disabled.
3. Validate backfill counts, preference backfill, waitlist expiry, RLS, and worker functions.
4. Deploy the schema-compatible app with delivery mode disabled, canonical reads false, scheduler false, and all external channel flags false.
5. Verify WABA `1009561255148806`, its connected production phone number, webhook subscription, callback GET verification, app secret, and permanent system-user token.
6. With separate authorization, run local template check and remote plan. Only then run explicit apply. Wait for all required `he`, `ar`, and `en_US` variants to be approved and sync deployment status.
7. Verify the Resend domain, `MESSAGING_EMAIL_FROM`, Reply-To, signed webhook endpoint, and event selections.
8. Set `LEGACY_MEMBER_NOTIFICATION_DELIVERY_ENABLED=false` and stop its scheduled calls before setting `studio_settings.messaging_canonical_writes_enabled=true`. Then enable the canonical scheduler and reads while delivery mode remains disabled, and validate one authoritative outbox path plus in-app delivery only. Confirm legacy mirrors stop producing canonical duplicates.
9. Build and install the iPhone release containing the native action categories. Add the approved
   `cloud_core_important.caf` asset and Notification Service Extension before enabling branded sound
   or rich-image events. Confirm the APNs environment recorded by the staff device matches the key.
10. Obtain a verified staff phone/email, set `MESSAGING_DELIVERY_MODE=allowlist`, populate the
    allowlist, verify the staff installation in `notification_staff_test_devices`, and enable push,
    then email, then WhatsApp one at a time. Add `admin_group` only for the verified admin-device
    handoff test.
11. Validate exactly one delivery per channel and per iPhone installation, badge/action/deep-link
    behavior, engagement receipts, status callbacks, reply handoff, service-window rules, retries,
    expiry, and replay suppression. Then enable the post-commit kick and verify scheduler recovery.
12. Keep all event rows Allowlist only. Use Journey Lab and the domain-trigger matrix in the manual
    test runbook to validate every locale/channel, then observe seven clean days.
13. Monitor dead letters, ambiguous WhatsApp outcomes, per-device failures, webhook duplicates, and
    template configuration failures.
14. Promote only individually validated event rows from `Allowlist only` to `Live eligible`, set
    `MESSAGING_LIVE_WABA_CONFIRMATION=1009561255148806`, and switch to `live` only after every gate
    passes. Expand event rollouts independently; never bulk-promote the catalog.

## Known risks

- The 35 existing Meta rows and nine duplicate pairs remain visible by design. The incorrectly categorized Hebrew waitlist template is untouched.
- Meta can reject or reclassify utility templates; unavailable locale variants stay suppressed.
- Automatic opt-in for existing members needs policy/legal review.
- The three new semantic Meta names (`cc_member_welcome_v2`, `cc_class_recommendation_v2`, and
  `cc_retention_reminder_v2`) have local definitions only until separately authorized, created, and
  approved. Their WhatsApp deliveries fail safely as suppressed configuration rows meanwhile.
- Ambiguous WhatsApp network outcomes require staff reconciliation to avoid duplicates.
- Backfill and compatibility mirroring increase storage until the retention job runs.
- Existing uncommitted kids/payment work is outside this change and must remain preserved during integration.
- This branch has no child/guardian persistence or routing relationship. Guardian-facing child
  journeys cannot be enabled safely until the retained kids module provides an authoritative
  guardian recipient; the dispatcher never infers that relationship from names or contact data.
