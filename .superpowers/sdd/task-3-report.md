# Task 3 Report: Add Pure Draft Row Builder

## Completed

- Added `src/lib/notificationDrafts.ts` with the pure draft-row builder, input/output types, skip reasons, language resolution, rendered copy, idempotency keys, and staff visibility.
- Added `tests/unit/notificationDrafts.test.mjs` covering draft rows, skipped rows, and admin-only visibility for payment notifications.

## Verification

- `/Users/ameeramer/.bun/bin/bunx tsx tests/unit/notificationDrafts.test.mjs`
  - First attempt failed in the sandbox with `listen EPERM` on the `tsx` IPC pipe.
  - Reran with escalated permissions and the test passed: `notification draft rows OK`.
- `/Users/ameeramer/.bun/bin/bunx tsx tests/unit/notificationTemplates.test.mjs`
  - Passed: `notification template helpers OK`.
- `bun install`
  - Passed with no package changes.
- `bun run lint`
  - Fails on pre-existing repository warnings outside the task files; the new files are clean under targeted `eslint`.
- `bun run build`
  - Passed.

## Commit

- Pending at report write time.

## Concern

- The repository still has many existing lint warnings, so the full lint script exits non-zero even though the new files are lint-clean.

## Fix Update

- Preserved all provided related IDs in `payload.related_ids` so waitlist linkage remains auditable without adding a DB column.
- Added a compact waitlist-focused unit test covering idempotency, language fallback, and `payload.related_ids.waitlistEntryId`.

## Verification Update

- `/Users/ameeramer/.bun/bin/bunx tsx tests/unit/notificationDrafts.test.mjs`
  - Sandbox attempt failed with `listen EPERM` on the `tsx` IPC pipe.
  - Escalated rerun passed: `notification draft rows OK`.
- `/Users/ameeramer/.bun/bin/bunx tsx tests/unit/notificationTemplates.test.mjs`
  - Sandbox attempt failed with `listen EPERM` on the `tsx` IPC pipe.
  - Escalated rerun passed: `notification template helpers OK`.
- `bun run lint`
  - Completed with the repository's existing 401 warnings and no errors.
- `bun run build`
  - Passed.
