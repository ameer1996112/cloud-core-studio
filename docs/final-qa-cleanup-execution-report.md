# Cloud & Core Final QA Cleanup Execution Report

## Verdict

- Cleanup executed: YES
- Cleanup committed: YES
- Cleanup target: `banjmspemvzrqckajvwo`
- QA records remain: NO
- Real studio data deleted: NO
- Migrations run: NO
- Database reset/truncate run: NO
- Broad deletes run: NO
- Remaining blocker: real signup verification is still pending because Supabase Auth is returning `429` rate-limit responses.

## 2026-06-25 Retry Confirmation

After the auth-fix real signup retry confirmed that no `QA_PRE_RELEASE_AUTH_FIX_` or `QA_PRE_RELEASE_AUTH_FIX_RETRY_` rows were created, cleanup was retried against the same reviewed preview.

The retry did not execute any new deletes. The transaction stopped before DELETE because the required pre-delete counts no longer matched the preview: `notification_logs` expected `2`, actual `0`. A follow-up exact-ID scan showed all 52 reviewed target IDs were already absent across all cleanup tables. This matches the previously committed cleanup recorded below.

Artifacts from this retry:

- Retry execution summary: `tmp/final-qa-cleanup-execution-rerun-result.json`
- Exact target-ID count scan: `tmp/final-qa-cleanup-post-mismatch-counts.json`
- Remaining QA tag/email scan: `tmp/final-qa-cleanup-remaining-scan.json`

## Source Artifacts

- Preview report: `docs/final-qa-cleanup-preview.md`
- Preview JSON: `tmp/final-qa-cleanup-preview.json`
- Preview SQL: `tmp/final-qa-cleanup-preview.sql`
- Execution SQL: `tmp/final-qa-cleanup-execute.sql`
- Execution output: `tmp/final-qa-cleanup-execution-output.json`
- Verification output: `tmp/final-qa-cleanup-verify-output.json`
- Smoke evidence: `tmp/final-qa-cleanup-smoke.json`

## Rows Deleted

| Table                 | Deleted | Notes                                      |
| --------------------- | ------: | ------------------------------------------ |
| `notification_logs`   |       2 | Deleted by exact reviewed IDs from preview |
| `attendance_records`  |       3 | Deleted by exact reviewed IDs from preview |
| `package_requests`    |       1 | Deleted by exact reviewed IDs from preview |
| `receipts`            |       3 | Deleted by exact reviewed IDs from preview |
| `payments`            |       3 | Deleted by exact reviewed IDs from preview |
| `member_plans`        |       3 | Deleted by exact reviewed IDs from preview |
| `credit_transactions` |       7 | Deleted by exact reviewed IDs from preview |
| `bookings`            |       3 | Deleted by exact reviewed IDs from preview |
| `classes`             |       4 | Deleted by exact reviewed IDs from preview |
| `plans`               |       3 | Deleted by exact reviewed IDs from preview |
| `program_types`       |       2 | Deleted by exact reviewed IDs from preview |
| `rooms`               |       2 | Deleted by exact reviewed IDs from preview |
| `instructors`         |       1 | Deleted by exact reviewed IDs from preview |
| `members`             |       5 | Deleted by exact reviewed IDs from preview |
| `profiles`            |       5 | Deleted by exact reviewed IDs from preview |
| `auth.users`          |       5 | Deleted by exact reviewed IDs from preview |

Total deleted rows: 52

## Execution Summary

- The transaction validated every pre-delete table count against the reviewed preview before deleting.
- Deletes ran in dependency-safe order.
- Post-delete target-ID checks ran before commit inside the same transaction.
- QA tag/email checks ran before commit inside the same transaction.
- Transaction reached final verification and committed.

## Verification Results

| Check                | Table                        | Remaining rows | Result |
| -------------------- | ---------------------------- | -------------: | ------ |
| remaining_qa_text    | `auth.users`                 |              0 | PASS   |
| remaining_qa_text    | `public.classes`             |              0 | PASS   |
| remaining_qa_text    | `public.credit_transactions` |              0 | PASS   |
| remaining_qa_text    | `public.instructors`         |              0 | PASS   |
| remaining_qa_text    | `public.members`             |              0 | PASS   |
| remaining_qa_text    | `public.notification_logs`   |              0 | PASS   |
| remaining_qa_text    | `public.payments`            |              0 | PASS   |
| remaining_qa_text    | `public.plans`               |              0 | PASS   |
| remaining_qa_text    | `public.program_types`       |              0 | PASS   |
| remaining_qa_text    | `public.receipts`            |              0 | PASS   |
| remaining_qa_text    | `public.rooms`               |              0 | PASS   |
| remaining_target_ids | `attendance_records`         |              0 | PASS   |
| remaining_target_ids | `auth.users`                 |              0 | PASS   |
| remaining_target_ids | `bookings`                   |              0 | PASS   |
| remaining_target_ids | `classes`                    |              0 | PASS   |
| remaining_target_ids | `credit_transactions`        |              0 | PASS   |
| remaining_target_ids | `instructors`                |              0 | PASS   |
| remaining_target_ids | `member_plans`               |              0 | PASS   |
| remaining_target_ids | `members`                    |              0 | PASS   |
| remaining_target_ids | `notification_logs`          |              0 | PASS   |
| remaining_target_ids | `package_requests`           |              0 | PASS   |
| remaining_target_ids | `payments`                   |              0 | PASS   |
| remaining_target_ids | `plans`                      |              0 | PASS   |
| remaining_target_ids | `profiles`                   |              0 | PASS   |
| remaining_target_ids | `program_types`              |              0 | PASS   |
| remaining_target_ids | `receipts`                   |              0 | PASS   |
| remaining_target_ids | `rooms`                      |              0 | PASS   |

## QA Tags And Emails Verified Removed

Tags checked:

- `QA_PRE_RELEASE_`
- `QA_PRE_RELEASE_RERUN_`
- `QA_PRE_RELEASE_FINAL_`

Exact QA emails checked:

- `qa_pre_release_20260624t210916z.admin@example.com`
- `qa_pre_release_20260624t210916z.instructor@example.com`
- `qa_pre_release_20260624t210916z.member@example.com`
- `qa_pre_release_20260624t210916z.nocredits@example.com`
- `qa_pre_release_20260624t210916z.othermember@example.com`

## Commands Run

| Command                                                                                         | Result                | Notes                                                                                                                         |
| ----------------------------------------------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `supabase db query --linked "select current_database()..."`                                     | PASS                  | Confirmed linked SQL execution.                                                                                               |
| `supabase db query --linked --file tmp/final-qa-cleanup-execute.sql --output json`              | PASS                  | Cleanup transaction committed after SQL assertions.                                                                           |
| `supabase db query --linked --file tmp/final-qa-cleanup-verify-union.sql --output json`         | PASS                  | 27 verification checks, all zero remaining rows.                                                                              |
| `/Users/ameeramer/.bun/bin/bunx tsc --noEmit`                                                   | PASS                  | No output.                                                                                                                    |
| `/Users/ameeramer/.bun/bin/bun run build`                                                       | PASS                  | Production client and SSR build completed.                                                                                    |
| `/Users/ameeramer/.bun/bin/bunx tsx tests/unit/i18n.test.mjs`                                   | PASS                  | `i18n defaults and catalogs OK`; Node deprecation warning only.                                                               |
| `supabase db query --linked --file tmp/final-qa-cleanup-execute.sql --output json`              | STOPPED BEFORE DELETE | Retry found pre-delete count mismatch because reviewed target IDs were already absent: `notification_logs` expected 2, got 0. |
| `supabase db query --linked --file tmp/final-qa-cleanup-post-mismatch-counts.sql --output json` | PASS                  | Exact-ID scan showed 0 remaining rows for every reviewed cleanup table.                                                       |
| `supabase db query --linked --file tmp/final-qa-cleanup-remaining-scan.sql --output json`       | PASS                  | QA tag/email scan showed 0 remaining rows for every reviewed cleanup table.                                                   |
| `/Users/ameeramer/.bun/bin/bunx tsc --noEmit`                                                   | PASS                  | Refreshed after cleanup retry; no output.                                                                                     |
| `/Users/ameeramer/.bun/bin/bun run build`                                                       | PASS                  | Refreshed after cleanup retry; production client and SSR build completed.                                                     |
| `/Users/ameeramer/.bun/bin/bunx tsx tests/unit/i18n.test.mjs`                                   | PASS                  | Refreshed after cleanup retry; `i18n defaults and catalogs OK`; Node deprecation warning only.                                |

## Smoke Test

| Flow                       | Route     | Final path | Result | Console errors |
| -------------------------- | --------- | ---------- | ------ | -------------: |
| /auth loads                | `/auth`   | `/auth`    | PASS   |              0 |
| admin login /admin works   | `/admin`  | `/admin`   | PASS   |              0 |
| member login /member works | `/member` | `/member`  | PASS   |              0 |

Smoke summary: 3 passed, 0 failed, 0 console errors.

Refreshed smoke after cleanup retry: 3 passed, 0 failed, 0 console errors.

## Safety Confirmation

- Deleted only exact records shown in `tmp/final-qa-cleanup-preview.json`: YES
- Every cleanup target was tied to QA tags, exact QA emails, or dependency on reviewed QA records: YES
- No migrations were run: YES
- No database reset was run: YES
- No truncate statements were run: YES
- No broad deletes were run: YES
- Cleanup is complete: YES
