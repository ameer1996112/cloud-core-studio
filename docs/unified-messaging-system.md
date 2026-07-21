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

Legacy writes are mirrored into the canonical model. Historical legacy rows are backfilled with their original table and row ID. Canonical reads in the member notification center remain behind `MESSAGING_CANONICAL_READS_ENABLED`.

## Required configuration

- Supabase: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and server-only `SUPABASE_SERVICE_ROLE_KEY`.
- Dispatcher gates: `MESSAGING_SCHEDULER_ENABLED`, `MESSAGING_CANONICAL_READS_ENABLED`, `MESSAGING_DELIVERY_MODE`, `MESSAGING_RECIPIENT_ALLOWLIST`, `MESSAGING_WHATSAPP_ENABLED`, `MESSAGING_EMAIL_ENABLED`, `MESSAGING_PUSH_ENABLED`, and `MESSAGING_LIVE_WABA_CONFIRMATION`.
- Meta: `META_GRAPH_API_VERSION`, `META_WABA_ID`, `META_WHATSAPP_PHONE_NUMBER_ID`, `META_ACCESS_TOKEN`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, and `WHATSAPP_APP_SECRET`.
- Email/links: `RESEND_API_KEY`, `MESSAGING_EMAIL_FROM`, `MESSAGING_EMAIL_REPLY_TO`, `MESSAGING_PUBLIC_BASE_URL` (HTTPS), and `RESEND_WEBHOOK_SECRET`.
- APNs: `APNS_ENV`, `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_BUNDLE_ID`, and `APNS_PRIVATE_KEY`.
- Internal sweep: `NOTIFICATION_AUTOMATION_TOKEN`.
- Rollback-only legacy gates: `OPENWA_LEGACY_DELIVERY_ENABLED`, `OFFICIAL_WHATSAPP_LEGACY_DELIVERY_ENABLED`, and `LEGACY_MEMBER_NOTIFICATION_DELIVERY_ENABLED`.

All dispatcher and channel gates default to disabled. Transactional domain triggers also remain off until `studio_settings.messaging_canonical_writes_enabled` is explicitly set to `true`; while it is false, legacy rows may mirror into canonical storage for validation but the v2 dispatcher never claims legacy deliveries. `MESSAGING_RECIPIENT_ALLOWLIST` is mandatory in allowlist mode. Live mode additionally requires `MESSAGING_LIVE_WABA_CONFIRMATION=1009561255148806`.

## Event and channel behavior

The channel matrix is encoded in `src/lib/messagingPolicy.ts`. Only class cancellation, material class-time change, and payment failure bypass later email/WhatsApp opt-outs. Other external deliveries require the relevant preference. In-app and push are separate deliveries.

Routine external delivery is scheduled inside 08:00–20:30 Asia/Jerusalem. Booking actions, handoff replies, class cancellation/time change, and payment failure can be immediate. The reminder sweep uses the existing cancellation-aware schedule:

- planning reminder: two hours before the cancellation deadline;
- final reminder: two hours before the class, or 20:00 on the prior evening for classes before 10:30.

Waitlist deliveries inherit `offer_expires_at`; no retry is scheduled at or beyond that deadline. Missing or unapproved locale-specific WhatsApp templates are suppressed as configuration failures. No language fallback is used.

Studio one-time/manual/HYP payments and `member_subscriptions` are covered by outbox triggers. The kids payment module is intentionally unchanged.

## Delivery states and retries

Canonical states are `queued`, `sending`, `accepted`, `sent`, `delivered`, `read`, `failed`, `dead_letter`, `suppressed`, `expired`, `cancelled`, and `delivery_unknown`.

- WhatsApp: four total attempts with 1-, 5-, and 30-minute backoff; `Retry-After` wins when longer. A transmitted timeout is `delivery_unknown` and cannot be manually retried until reconciled.
- Resend: the same delivery idempotency key is used on every attempt; five total attempts at 1 minute, 5 minutes, 30 minutes, and 2 hours.
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

## Template catalog and provisioning

`src/lib/messageTemplateCatalog.ts` is the immutable source for every event/language body, subject, variable schema, version, and Meta name. `he`, `ar`, and `en` content must remain in parity. WhatsApp JSON under `whatsapp/templates/v2` is generated from this catalog.

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

Structured JSON logs go to stdout with correlation, message, delivery, attempt, provider, outcome, duration, and retry classification fields. The logging allowlist rejects names, addresses, bodies, tokens, and signatures.

Run `select public.redact_and_purge_message_audit();` from the protected retention scheduler. It redacts message bodies and rendered variables after 180 days; after 13 months it clears delivery recipients, provider IDs/payloads/errors and deletes delivery-attempt/webhook audit rows.

Troubleshooting sequence:

1. Check `message_outbox.last_error` and whether the event lease is stale.
2. Check the delivery state, `error_code`, `failure_class`, expiry, and active handoff state.
3. Check the latest `message_delivery_attempts` without copying recipient/body fields into logs or tickets.
4. For WhatsApp, verify WABA/phone ID and `whatsapp_template_deployments` approval for the exact locale.
5. For `delivery_unknown`, inspect Meta Manager/API before any staff reconciliation; do not retry blindly.
6. For Resend, verify the sender domain, sender, Reply-To, webhook secret, and selected delivery events.
7. For APNs, verify credentials/environment and whether only one token was deactivated.

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

1. Set `MESSAGING_DELIVERY_MODE=disabled`, `MESSAGING_SCHEDULER_ENABLED=false`, every new channel flag to false, and `studio_settings.messaging_canonical_writes_enabled=false`. Re-enable `LEGACY_MEMBER_NOTIFICATION_DELIVERY_ENABLED=true` only when intentionally returning to the legacy APNs worker.
2. Record the cutover timestamp and run `docs/sql/unified-messaging-rollback-reconciliation.sql` with that value. The script inserts only missing legacy projections and disables mirror recursion for its transaction.
3. Verify projected counts and statuses.
4. Revert the application to the prior release.
5. Keep canonical tables, webhook events, and backfill rows intact. Do not run destructive down migrations.
6. Recover and reprocess with the existing idempotency keys.

## Exact pre-production sequence

1. Back up the database and capture all legacy/canonical counts.
2. Apply `20260720140000_unified_messaging_phases_1_2.sql` with the scheduler and channels disabled.
3. Validate backfill counts, preference backfill, waitlist expiry, RLS, and worker functions.
4. Deploy the schema-compatible app with delivery mode disabled, canonical reads false, scheduler false, and all external channel flags false.
5. Verify WABA `1009561255148806`, its connected production phone number, webhook subscription, callback GET verification, app secret, and permanent system-user token.
6. With separate authorization, run local template check and remote plan. Only then run explicit apply. Wait for all required `he`, `ar`, and `en_US` variants to be approved and sync deployment status.
7. Verify the Resend domain, `MESSAGING_EMAIL_FROM`, Reply-To, signed webhook endpoint, and event selections.
8. Set `LEGACY_MEMBER_NOTIFICATION_DELIVERY_ENABLED=false` and stop its scheduled calls before setting `studio_settings.messaging_canonical_writes_enabled=true`. Then enable the canonical scheduler and reads while delivery mode remains disabled, and validate one authoritative outbox path plus in-app delivery only. Confirm legacy mirrors stop producing canonical duplicates.
9. Obtain a verified staff phone/email, set `MESSAGING_DELIVERY_MODE=allowlist`, populate the allowlist, and enable push, then email, then WhatsApp one at a time.
10. Validate exactly one delivery per channel, status callbacks, reply handoff, service-window rules, retries, expiry, and replay suppression.
11. Monitor dead letters, ambiguous WhatsApp outcomes, webhook duplicates, and template configuration failures.
12. Set `MESSAGING_LIVE_WABA_CONFIRMATION=1009561255148806` and switch to `live` only after every gate passes.

## Known risks

- The 35 existing Meta rows and nine duplicate pairs remain visible by design. The incorrectly categorized Hebrew waitlist template is untouched.
- Meta can reject or reclassify utility templates; unavailable locale variants stay suppressed.
- Automatic opt-in for existing members needs policy/legal review.
- Ambiguous WhatsApp network outcomes require staff reconciliation to avoid duplicates.
- Backfill and compatibility mirroring increase storage until the retention job runs.
- Existing uncommitted kids/payment work is outside this change and must remain preserved during integration.
