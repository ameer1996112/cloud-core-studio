# Notification outbox verification — 2026-09-02

## Result

Implemented on `feat/durable-notification-outbox`. Production is unchanged: no deployment, production migration, infrastructure apply, provider send, scheduler pause, or secret change was performed.

## Verification actually executed

| Command                                                                                                                                                               | Result                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `bun install --frozen-lockfile`                                                                                                                                       | Pass; 599 installed packages checked, no dependency changes                                                   |
| `bun run test`                                                                                                                                                        | Pass: 702 tests, 5,180 assertions; six environment-gated cases skipped                                        |
| `bun run lint`                                                                                                                                                        | Pass                                                                                                          |
| `bun run build`                                                                                                                                                       | Pass; existing framework deprecation/build warnings remain                                                    |
| `bunx tsc --noEmit --pretty false`                                                                                                                                    | Fails with the same 67 pre-existing diagnostics; not a clean type-check                                       |
| `MESSAGING_TEST_DATABASE_URL='postgresql://localhost/codex_notification_outbox_final?host=/private/tmp' bun test tests/integration/unifiedMessagingDatabase.test.mjs` | Pass: one integration test with 72 assertions, against a disposable local PostgreSQL database                 |
| `bash -n scripts/gcp/configure-notification-infrastructure.sh scripts/gcp/audit-cloud-run-cost-config.sh`                                                             | Pass                                                                                                          |
| `git diff --check`                                                                                                                                                    | Pass                                                                                                          |
| `bash scripts/gcp/audit-cloud-run-cost-config.sh`                                                                                                                     | Read-only service/revision/job/scheduler inventory succeeded; queue listing reported Cloud Tasks API disabled |

Focused notification policy, materialization, task, lease, OIDC, maintenance, database-scope, OpenWA-worker, and infrastructure-preview tests were also run during development. The new regression tests were observed failing before their fixes and passing afterward.

`bun run test` expands to the project's unit and integration suites. The messaging database case was rerun separately with the local test URL above. The two Concierge integration cases and three Yoga-promotion cases/hooks remain environment-gated; no production database was substituted. A bare `bun test` also discovered E2E scripts and encountered the existing live-mutation safety guard; those scripts were not authorized to mutate production.

The local integration fixture exercised migration/backfill, metadata locale preservation, payment deduplication, concurrent claims, stale lease rejection/recovery, task generations, consent, admin retry permissions/audit, class schedule versions, health reporting, and RLS. The disposable database was dropped afterward and the local PostgreSQL server restored to its initial stopped state.

## Live cost observations

At the final read-only check, the production service still had revision minimum 1, maximum 3, 1 CPU, 512 MiB, concurrency 80, and two rollback/smoke tags. The minute-scheduled unified messaging job remained enabled (61,434 recorded executions), as did the fifteen-minute notification job (3,993 executions) and five-minute staging Sheets worker (4,453 executions). These are execution counts, not per-month price calculations.

Cloud Tasks API is still disabled. The queue, identities, and new Scheduler job were not created. The audit script intentionally tolerates queue-list errors, so its zero exit status does not mean Cloud Tasks was verified ready.

The setup preview targets both service-level and revision-level minimums of zero, maximum three instances, request-based CPU, one queue, and one fifteen-minute HTTP maintenance schedule. Existing revision tags are preserved unless explicitly selected for removal. Cost savings are therefore prospective, not measured. No exact zero-cost promise is made.

## Standards review

Remaining findings: one documented reviewability concern about the breadth of this requested feature under “Keep changes small,” and three judgment-based maintainability concerns: repeated OIDC route setup, distributed feature-flag parsing, and multiple responsibilities in the existing unified messaging module. No environment files are included. Concrete OpenWA, cancellation-scope naming, and bounded-cleanup findings were fixed.

## Spec review

No remaining concrete blockers found in the final code review. This does not replace staged production smoke tests or validation of live credentials/IAM. The implementation preserves the existing database tables and provider paths rather than introducing a second messaging system.

## Rollout and rollback

Use [the rollout runbook](rollout-runbook.md), not a direct deploy from this report. Apply the migration in staging, deploy with flags off, review queue/IAM setup, shadow-test, activate an allowlist, and prove delivery before pausing old polling jobs. Only then remove reviewed old tags and evaluate actual daily billing.

Rollback stops new sending/enqueue through dry-run and task flags, restores a compatible previous application release/legacy processing when required, and preserves all outbox facts and attempt history. Do not retry ambiguous WhatsApp transmissions until reconciled.
