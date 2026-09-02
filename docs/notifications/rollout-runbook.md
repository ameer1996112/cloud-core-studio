# Durable notification rollout runbook

No step in this document has been run against production by this branch.

## Flags

New flags default safe:

```text
NOTIFICATIONS_OUTBOX_ENABLED=false
NOTIFICATIONS_TASKS_ENABLED=false
NOTIFICATIONS_MAINTENANCE_ENABLED=false
NOTIFICATIONS_DRY_RUN=true
```

Required task configuration:

```text
NOTIFICATIONS_TASKS_PROJECT_ID
NOTIFICATIONS_TASKS_LOCATION
NOTIFICATIONS_TASKS_QUEUE
NOTIFICATIONS_DELIVERY_URL
NOTIFICATIONS_TASKS_SERVICE_ACCOUNT
NOTIFICATIONS_MAINTENANCE_SERVICE_ACCOUNT
NOTIFICATIONS_OIDC_AUDIENCE
NOTIFICATIONS_OIDC_ALLOWED_CALLERS
NOTIFICATIONS_MAINTENANCE_TIME_BUDGET_MS
```

Optional queue tuning variables default to the reviewed values: `NOTIFICATIONS_TASK_MAX_DISPATCHES_PER_SECOND=10`, `NOTIFICATIONS_TASK_MAX_CONCURRENT_DISPATCHES=5`, `NOTIFICATIONS_TASK_MAX_ATTEMPTS=8`, `NOTIFICATIONS_TASK_MIN_BACKOFF=10s`, `NOTIFICATIONS_TASK_MAX_BACKOFF=3600s`, and `NOTIFICATIONS_TASK_MAX_RETRY_DURATION=86400s`.

Existing `MESSAGING_DELIVERY_MODE`, channel flags, recipient allowlist, provider credentials, preferences, and consent remain authoritative.

## Preflight

1. Verify a current backup and record current Cloud Run service/revision/job/scheduler configuration.
2. Run the read-only cost audit.
3. Apply the database migration to a clean local/test database and run unit plus integration tests.
4. After verifying the production backup, apply only `20260902150000_durable_notification_cloud_tasks.sql` through the reviewed migration process and confirm its migration-history entry. Do not push unrelated historical migrations. The migration must precede application deployment: the legacy sweep also calls the new reminder-cancellation RPC, even with the new flags off.
5. Deploy code with all new flags false and dry-run true. Confirm normal payment/booking behavior is unchanged.
6. Review the infrastructure script dry-run. Have a second operator verify project, region, service, queue, identities, URLs, audience, removed tags, and IAM scope.
7. Apply infrastructure only through the normal reviewed production process.

## Phased activation

### Phase 1 — shadow materialization

- Set `NOTIFICATIONS_OUTBOX_ENABLED=true`, `NOTIFICATIONS_TASKS_ENABLED=true`, and `NOTIFICATIONS_MAINTENANCE_ENABLED=true` only after the queue/OIDC configuration is present.
- Keep `NOTIFICATIONS_DRY_RUN=true`; this runs durable preparation but creates no Cloud Tasks and the delivery endpoint remains closed.
- Keep the existing external delivery mode disabled or tightly allowlisted.
- Confirm deterministic outbox growth, one message/channel delivery, bounded maintenance batches, no external sends from the new task path, and no PII in logs. Dry-run does not mute the existing live sweep or promotion sender; do not create synthetic customer events while those senders remain enabled.

### Phase 2 — allowlist delivery

- Verify queue config and endpoint IAM, then set `NOTIFICATIONS_DRY_RUN=false` only for a controlled recipient allowlist through the existing messaging policy.
- Exercise payment success/replay, booking creation/change/cancellation, a reminder, provider transient failure, and duplicate task delivery.
- Confirm payment results remain successful when enqueue/provider delivery fails.

### Phase 3 — live and remove polling waste

- Enable only required existing channel flags and expand the recipient policy deliberately.
- Observe at least one full reminder window with healthy queue age and no duplicate external sends.
- Pause `cloud-core-unified-messaging-sweep-1m` only after proving canonical delivery. Keep `cloud-core-notification-sweep-15m` enabled for now: current production added scheduled promotion broadcasts after this feature branch diverged, and those broadcasts still send inline. Cloud Tasks preparation explicitly skips that sender so shadow runs cannot send promotions. The fifteen-minute legacy job must not be paused until promotion scheduling and delivery are covered by the replacement and verified. Do not delete either old job during the proving window.
- Confirm requests still wake Cloud Run, maintenance catches missed kicks within 15 minutes, and the service scales to zero when quiet.
- After the rollback window, remove obsolete revision tags/minimum instances and retire the paused legacy job through a separate reviewed change. Tag removal is disabled by default in the infrastructure script; `CLOUD_RUN_REMOVE_REVISION_TAGS` must explicitly name reviewed tags. Do not rerun the full setup script against a live rollout just to remove tags, because it deliberately resets the feature flags.

WhatsApp remains on the Mac-local OpenWA worker throughout these phases. Once `NOTIFICATIONS_OUTBOX_ENABLED=true`, its existing claim/report endpoints switch to canonical `message_deliveries` and require the returned lease token on every report; `notification_logs` is used only while the canonical flag is off and `OPENWA_LEGACY_DELIVERY_ENABLED=true`. Every authenticated claim records the worker heartbeat; never send WhatsApp from both Cloud Tasks and the local bridge.

## Health queries

Run these through an authorized database/admin path, not a public client:

```sql
select public.notification_delivery_health();

select status, channel, count(*)
from public.message_deliveries
group by status, channel
order by channel, status;

select min(coalesce(next_attempt_at, scheduled_for)) as oldest_due
from public.message_deliveries
where status in ('queued', 'failed', 'enqueued');

select task_last_error_code, count(*)
from public.message_deliveries
where task_last_error_code is not null
group by task_last_error_code;

select provider, outcome, count(*)
from public.message_delivery_attempts
where started_at >= now() - interval '24 hours'
group by provider, outcome
order by provider, outcome;
```

The service-only health RPC includes pending, retry-wait, expired-lease, permanent-failure, sent-in-24-hours, oldest-pending, provider-attempt, last-maintenance, and last-WhatsApp-heartbeat signals. Only the OIDC Scheduler endpoint records the maintenance heartbeat; post-commit kicks cannot hide a broken schedule. The maintenance request uses a cooperative abort budget below the Scheduler deadline, and every database scan/update remains bounded. Expected steady state for a tiny app: empty/near-empty due backlog, no 25-hour enqueued recovery, no growing dead-letter count, and Cloud Run at zero instances while idle.

The existing admin retry action now uses `admin_retry_notification_delivery`, which locks and revalidates the delivery, queues only safe transient failures, refuses opted-out WhatsApp recipients, and appends `notification.delivery_retried` to the admin activity log in the same transaction.

## Rollback

1. Set `NOTIFICATIONS_DRY_RUN=true` immediately to prevent new task enqueue and task delivery.
2. Set `NOTIFICATIONS_TASKS_ENABLED=false` and `NOTIFICATIONS_MAINTENANCE_ENABLED=false`.
3. Resume the paused legacy sweep jobs only if durable rows need processing and the previous release is still compatible.
4. Keep `message_outbox`, messages, deliveries, and attempts; do not delete durable facts.
5. Roll back application traffic using the normal reviewed Cloud Run procedure.

The migration is expand-only, so disabling the path does not require a destructive database rollback. If an incident involves ambiguous WhatsApp delivery, mark/reconcile it; never blindly retry.
