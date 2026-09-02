# Production release preparation — 2026-09-02

## Status

Prepared on `codex/durable-notification-outbox-release`; **not deployed or activated**. The user approved deploying directly to production, without staging. Production remains on image `371244aee580e56dafd97f5ca6c150c992e767bf`, revision `cloud-core-studio-00481-bcc`.

The release starts at current production and carries only the four notification commits from the older feature branch. Newer website fixes, marketing functionality, dependencies, and routes are preserved. Unrelated local mobile/style changes are excluded.

## Integration changes

- Preserve the newer scheduled-promotion sender for the legacy sweep, but return before database/provider access during Cloud Tasks preparation. A regression test failed before the guard and passed afterward.
- Make the existing booking-cancellation translation available to the expanded shared dependency graph, preserving every translated value across all three languages.
- Regenerate the existing local interaction evidence: 48/48 scenario-language checks passed. Only its timestamp, source fingerprint, and measured timings changed; prior human VoiceOver evidence was not changed or newly claimed.
- Require the production migration before deploying even with flags off: the legacy sweep calls the new reminder-cancellation RPC.

## Verification

- Clean production baseline: 1,213 tests passed, six environment-gated tests skipped.
- Release dependency installation, lint, and production build passed. Existing lint/build warnings remain.
- Final full release test run: 1,255 passed, six environment-gated tests skipped, zero failures, 14,724 assertions across 179 files.
- Disposable local database migration/integration test: 72 assertions passed. The isolated local PostgreSQL server was stopped afterward.
- Focused translation/promotion checks: 25 tests passed; accessibility/evidence checks: 47 passed; marketing asset checks: 14 passed.
- Standalone marketing screenshot reproducibility check passed without replacing published assets.
- TypeScript check is not clean: both current production and this release have the same 70 diagnostics, allowing for line shifts and union-order formatting. No new diagnostic was introduced.
- Infrastructure script syntax and dry-run preview passed; no infrastructure apply was performed.
- Independent integration review found no Critical or Important defect in the flags-off release, subject to the remaining deployment gates.

Earlier local runs encountered sandbox-restricted fixture operations, timing failures, and a screenshot reproducibility failure. The integration-specific translation/source-contract failures were corrected, generated interaction evidence was refreshed by actually rerunning the checks, and focused checks were rerun successfully.

## Blocking deployment gate

Supabase returned no available physical backups and PITR disabled. A private local public-schema export completed, but this is **not a complete recoverable application-data backup**. Automatic permission review rejected the attempted export of production application/authentication data because its sensitive contents and local destination required explicit user approval. That export was not executed or retried through another mechanism.

Do not merge the draft release PR until the user approves the data backup, a recoverable backup is verified, and the reviewed migration has been applied and recorded. A merge into `main` automatically triggers production Cloud Build.

## Activation limits

Follow the [rollout runbook](rollout-runbook.md) for flags-off deployment, queue/OIDC verification, controlled delivery checks, and the OpenWA worker handoff. The minute-scheduled job can only be paused after replacement delivery is proven.

The fifteen-minute legacy job must remain for now because current production added an inline promotion sender. Its default path uses the same canonical delivery rows and leases, but its existing sends are not governed by the new task dry-run or queue throttling. Full removal of that job remains deferred until promotion delivery is covered by a task-safe replacement. No zero-cost or measured-savings claim is made: Cloud Run configuration and all production schedules are unchanged.
