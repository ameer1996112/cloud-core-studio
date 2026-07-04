# Gate 1 Implementation Report

## Result

Gate 1 was implemented without a schema migration.

Cloud Run is now the queue/control plane and the Mac-local worker is the OpenWA sender.

## Files changed

- `src/lib/notificationDelivery.ts`
- `src/lib/internalAutomationAuth.server.ts`
- `src/lib/notificationQueue.server.ts`
- `src/routes/api/internal/notifications/openwa-claim.ts`
- `src/routes/api/internal/notifications/openwa-report.ts`
- `src/routes/api/internal/notifications/openwa-run.ts`
- `scripts/openwa-local-worker.mjs`
- `tests/unit/notificationQueueServer.test.mjs`
- `tests/unit/notificationDelivery.test.mjs`
- `docs/openwa-local-claim-report-automation.md`

## Audit conclusion

Existing `notification_logs` fields were enough for Gate 1:

- `status`
- `attempt_count`
- `scheduled_for`
- `next_attempt_at`
- `last_attempt_at`
- `sent_at`
- `provider_message_id`
- `error_message`

Because those fields already existed, Gate 1 reuses the current `sending` plus stale-recovery model instead of adding new `claimed_by` or `claim_expires_at` columns.

## Behavior summary

- automatic OpenWA queueing now covers the exact approved six-event scope
- claim endpoint returns ready jobs and atomically moves real rows to `sending`
- report endpoint finalizes rows as `sent`, `queued`, or `failed`
- local worker supports `--dry-run`
- local worker supports `--test-phone-only`
- local worker reads the automation token from env or Keychain

## Known limitations

- worker identity is accepted in request payloads but not persisted because Gate 1 intentionally avoided schema changes
- stale-claim recovery still relies on `last_attempt_at` timeout rather than explicit `claim_expires_at`
- `launchd` scheduling is intentionally deferred to a later gate
