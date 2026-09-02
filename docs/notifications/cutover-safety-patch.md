# Notification cutover safety patch — 2026-09-02

## Scope

This patch prepares two repairs; this document is not evidence that they have been applied to production.

- Exclude imported historical messages from Cloud Tasks selection, abandoned-task/lease recovery, and direct delivery claims. Match the existing inline eligibility rule: `template_version = 'v2' OR legacy_source_table IS NULL`. Deliberately converted v2 records and native messages remain eligible. No historical row is deleted, cancelled, or rewritten by the migration.
- Update `cloud-core-notification-sweep` to the release image on every main-branch deployment, just like `cloud-core-unified-messaging-sweep`. The fallback was observed referencing an unavailable image; deploying the corrected pipeline repairs that reference.
- Add an execution-only `NOTIFICATION_SWEEP_CANARY=true` probe. It calls only the existing authenticated, read-only `/api/internal/messages/sweep` readiness branch with `canary: true`. It does not run Concierge, lifecycle processing, or message delivery, even if legacy lifecycle delivery is enabled.

The regular fallback retains its existing work. Updating its image allows its enabled fifteen-minute schedule to resume that work; the canary override applies only to the explicit verification execution, not subsequent scheduled executions.

## Release checks

1. Keep outbox, tasks, and maintenance flags `false`, and dry-run `true`. Preserve existing provider choices and all scheduler states. Do not create synthetic customer events or manually invoke normal delivery as a smoke test.
2. Verify a recoverable backup and capture the existing definitions of `list_notification_deliveries_for_tasks(integer)` and `claim_message_delivery_by_id(uuid,text,uuid,integer)`. Apply only the new `20260902210000_guard_legacy_notification_tasks.sql` migration if the original durable-notification migration is already recorded. Record the new migration through the normal reviewed database process; do not run a blanket migration push.
3. Verify both functions retain service-role-only execution and the historical predicate. Compare aggregate historical-row state before/after; never invoke a claiming function against customer data merely to test it.
4. Deploy through the reviewed main-branch pipeline. Verify the service and both scheduled jobs use the release image, both canary executions complete successfully, and neither job template retains a canary override. Confirm feature flags, schedules, provider selection, and scale-to-zero settings are unchanged.
5. Observe a normally scheduled fallback execution to verify the missing-image failure is gone. A successful read-only canary alone does not prove every provider or scheduled workflow is healthy.

### Deployment permission gate

Read-only preflight found that `cloud-core-runner@cloudandcorestudio.iam.gserviceaccount.com` has resource-scoped `roles/run.developer` on `cloud-core-unified-messaging-sweep`, but no binding on `cloud-core-notification-sweep` and no project-level Cloud Run role. Its existing `roles/iam.serviceAccountUser` binding already covers the fallback runtime identity.

Before merging, obtain approval for the corresponding `roles/run.developer` binding on **only** `cloud-core-notification-sweep`, then verify it. Do not grant a project-wide role or change runtime identities. Without that permission, the new fallback update would fail after the service deployment. No IAM change has been applied by this patch preparation.

## Automated evidence

- The real PostgreSQL integration fixture checks queued, failed, enqueued, and expired-lease historical rows. They cannot be selected or directly claimed, and their status, task generation, and attempt count remain unchanged. Current/native and explicitly converted v2 rows remain eligible.
- Runner tests execute the actual fallback script with only HTTP mocked: canary isolation, normal behavior with the flag absent/false, explicitly enabled legacy behavior, and authentication failure.
- Deployment tests parse the actual Cloud Build configuration: both jobs receive the immutable release image before their execution-only canaries, and image updates do not rewrite job environment variables.

### Local verification result

Dependency installation, lint, and production build passed. Lint reported zero errors and 826 existing warnings. The final full suite passed 1,261 tests with six environment-gated tests skipped and zero failures (14,739 assertions). The messaging PostgreSQL test was run separately against a disposable local database: 75 assertions passed and the database server was stopped afterward. The initial sandboxed full run failed three local browser checks; those checks and the full suite passed with the required loopback/browser access.

Independent read-only review found no Critical or Important defects. No customer-facing end-to-end send was attempted, and these results do not claim successful production deployment or transport activation.

## Remaining activation gates

This patch does not configure Cloud Tasks/OIDC, change retry policy, migrate WhatsApp, pause polling jobs, or remove the inline promotion sender. Those need separate verification before transport activation or further scheduler removal. The live WhatsApp provider must be checked explicitly; the older rollout document's Mac-worker assumption is not evidence of current production configuration.

No additional billing reduction is claimed from these safety repairs. Cost reduction from replacing polling remains pending successful activation and a separately reviewed scheduler change.

## Recovery

Keep the new transport disabled if verification fails. The database change only replaces functions; preserve all messages, deliveries, and attempts. If a function rollback is necessary, use the captured definitions under review and record it as a forward migration. For a runner regression, choose a verified retained compatible image rather than restoring the unavailable fallback image. Do not delete records or blindly retry ambiguous sends.
