# Cloud & Core Pre-Release Current DB QA Report

## Verdict

- Current DB QA passed: NO
- Release ready: NO
- Main blockers:
  - `/auth` still emits React hydration mismatch errors in the Vite client log.
  - Member and instructor browser sessions can remain on `/admin` instead of being blocked.
  - Browser QA captured repeated Supabase `getUser()` `Failed to fetch` console errors during protected route navigation.

## Environment

- Supabase project ref: `banjmspemvzrqckajvwo`
- App released: NO
- QA tag: `QA_PRE_RELEASE_20260624T210916Z`
- Destructive scripts run: NO
- Migrations run: NO
- Cleanup run: NO
- Mutating E2E suites run: NO. Existing E2E scripts are guarded and not tag-safe for this current DB run.

## Commands Run

| Command                             | Result | Notes                                                     |
| ----------------------------------- | -----: | --------------------------------------------------------- |
| `bunx tsc --noEmit`                 |   PASS | No TypeScript errors.                                     |
| `bun run build`                     |   PASS | Build completed; Vite reported large chunk warnings only. |
| `bunx tsx tests/unit/i18n.test.mjs` |   PASS | `i18n defaults and catalogs OK`.                          |

## Functional Results

| Flow                                           | Role                    | Language | Device                    |  Result | Notes                                                                           |
| ---------------------------------------------- | ----------------------- | -------- | ------------------------- | ------: | ------------------------------------------------------------------------------- |
| Register/create tagged QA users                | admin/service setup     | n/a      | API                       |    PASS | 5 QA users created with tag.                                                    |
| Login/session/wrong password/duplicate account | all QA roles            | n/a      | API                       |    PASS | Wrong password and duplicate create rejected.                                   |
| Create/edit room/program/instructor/class      | admin                   | n/a      | API                       |    PASS | Tagged QA studio data created/edited.                                           |
| Payment confirm and receipt idempotency        | admin/member            | n/a      | API                       |    PASS | Fresh tagged payment granted credits; second confirm did not duplicate receipt. |
| Booking credits/capacity/roster                | member/admin/instructor | n/a      | API                       |    PASS | Booking updated credits/capacity and appeared in admin/instructor roster.       |
| Member without credits booking                 | member                  | n/a      | API                       |    PASS | Blocked with insufficient credits.                                              |
| Cancellation refund/capacity                   | member                  | n/a      | API                       |    PASS | Cancellation restored credits and capacity.                                     |
| Attendance persistence                         | admin                   | n/a      | API                       |    PASS | `attended` persisted in `attendance_records`.                                   |
| Package request                                | member                  | n/a      | API                       |    PASS | Tagged package request created/read.                                            |
| WhatsApp/notification log                      | admin                   | n/a      | API                       |    PASS | Tagged notification log persisted.                                              |
| Receipt RLS                                    | member/other member     | n/a      | API                       |    PASS | Member can read own receipt; other member cannot.                               |
| Responsive/language route matrix               | member/admin/instructor | HE/AR/EN | 390, 430, 820, 1024, 1440 | PARTIAL | 734 browser checks passed; 15 failed.                                           |

## Bugs Found

### BR-01: `/auth` hydration mismatch still occurs

- Severity: High / release blocker
- Route: `/auth`
- Role: guest/login
- Language/device: reproduced during `/auth` browser passes, including Hebrew mobile retry activity.
- Steps to reproduce:
  1. Run `bun run dev -- --host 127.0.0.1 --port 5173`.
  2. Open `/auth` during browser QA.
  3. Watch the Vite terminal/client error stream.
- Expected: No hydration mismatch.
- Actual: React reports `Hydration failed because the server rendered HTML didn't match the client`; diff shows `AuthPage` rendering `<main className="auth-page ...">` on the client where the server had `<Suspense>`.
- Evidence: Vite terminal output from this QA run, emitted while stopping the dev server.
- Suggested fix: Re-check the `/auth` route SSR/lazy/Suspense boundary and any client-only language/auth state that changes the first rendered tree.

### BR-02: Member and instructor browser sessions can access `/admin`

- Severity: High / release blocker
- Route: `/admin`
- Role: member, instructor
- Language/device: reproduced across multiple HE/AR/EN viewport combinations
- Steps to reproduce:
  1. Log in as QA member or QA instructor.
  2. Navigate directly to `/admin`.
- Expected: User is redirected or shown an unauthorized state.
- Actual: Browser remained on `/admin`.
- Evidence: `tmp/pre-release-current-db-qa/browser-qa-20260624T210916Z.json`
- Suggested fix: Add/enforce route-level role authorization for every admin route, not only nav visibility or API/RLS restrictions.

### BR-03: Repeated Supabase auth fetch console errors

- Severity: Medium / release risk
- Route: protected routes during browser matrix
- Role: captured mostly during member navigation
- Expected: No console errors during route loads.
- Actual: 101 console error events, sample: `TypeError: Failed to fetch` inside `supabase.auth.getUser()` from `src/routes/_authenticated/route.tsx`.
- Evidence: `tmp/pre-release-current-db-qa/browser-qa-20260624T210916Z.json`
- Suggested fix: Investigate auth loader retry/error handling and confirm whether this is remote Supabase/network flake or app-side unhandled auth loading.

## Security/RLS Results

| Test                                                   | Expected       | Actual                            | Result |
| ------------------------------------------------------ | -------------- | --------------------------------- | -----: |
| Guest cannot access `/member`, `/admin`, `/instructor` | Redirect/block | Redirected to auth                |   PASS |
| Member cannot read another member receipt              | No data        | No data                           |   PASS |
| Instructor cannot confirm payments                     | Forbidden      | `forbidden`                       |   PASS |
| Instructor cannot create admin resources by API        | Rejected       | Rejected                          |   PASS |
| Member cannot create classes by API                    | Rejected       | Rejected                          |   PASS |
| Member cannot access admin pages in browser            | Blocked        | Stayed on `/admin`                |   FAIL |
| Instructor cannot access admin pages in browser        | Blocked        | Stayed on `/admin` in most checks |   FAIL |

## Responsive Results

| Route                                                                                                                     | Viewport              | Horizontal overflow | Offending element |                                                              Result |
| ------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------: | ----------------- | ------------------------------------------------------------------: |
| `/auth`                                                                                                                   | 390                   |                  No | none              | PASS after targeted retry, but hydration mismatch remains a blocker |
| `/member`, `/member/schedule`, `/member/bookings`, `/member/packages`                                                     | 390/430/820/1024/1440 |                  No | none              |                                                                PASS |
| `/admin`, `/admin/pulse`, `/admin/reports`, `/admin/payments`, `/admin/messages`, `/admin/settings`, `/admin/classes/:id` | 390/430/820/1024/1440 |                  No | none              |                                                                PASS |
| `/instructor`                                                                                                             | 390/430/820/1024/1440 |                  No | none              |                                                                PASS |

## Language/RTL Results

| Route            | Hebrew | Arabic | English | Issues                                                                                                                                    |
| ---------------- | -----: | -----: | ------: | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `/auth`          |   PASS |   PASS |    PASS | Initial screenshot was too early/blank; targeted retry rendered correctly with LTR email/password inputs. Hydration mismatch still fails. |
| Member routes    |   PASS |   PASS |    PASS | Direction checks passed.                                                                                                                  |
| Admin routes     |   PASS |   PASS |    PASS | Direction checks passed.                                                                                                                  |
| Instructor route |   PASS |   PASS |    PASS | Direction checks passed.                                                                                                                  |

## Records Created

| Table                 | Count | Notes                                                              |
| --------------------- | ----: | ------------------------------------------------------------------ |
| `auth.users`          |     5 | Tagged QA users.                                                   |
| `profiles`            |     5 | Profiles for tagged users.                                         |
| `members`             |     5 | Member/admin/instructor backing records created by trigger/upsert. |
| `instructors`         |     1 | Linked QA instructor.                                              |
| `rooms`               |     1 | Tagged QA room.                                                    |
| `program_types`       |     1 | Tagged QA program.                                                 |
| `classes`             |     3 | Main class plus cancellation classes.                              |
| `bookings`            |     2 | Active booking plus cancelled booking.                             |
| `plans`               |     2 | Retry left two tagged plans.                                       |
| `member_plans`        |     2 | Created by payment confirmation.                                   |
| `payments`            |     2 | Tagged confirmed payments.                                         |
| `receipts`            |     2 | One receipt per payment.                                           |
| `attendance_records`  |     2 | Booking/cancellation/attended records.                             |
| `package_requests`    |     1 | Tagged request.                                                    |
| `notification_logs`   |     1 | Tagged WhatsApp/manual log.                                        |
| `credit_transactions` |     5 | Credit grant/booking/cancellation ledger rows.                     |

## Cleanup Preview

- Exact cleanup preview JSON: `tmp/pre-release-current-db-qa/cleanup-preview.json`
- Exact cleanup SQL preview: `tmp/pre-release-current-db-qa/cleanup-preview.sql`
- Safety verdict: PREVIEW ONLY. Cleanup was not run.
- Pre-QA counts: `tmp/pre-release-current-db-qa/pre-qa-baseline.json`
- Post-QA counts: `tmp/pre-release-current-db-qa/post-qa-row-counts.json`
- Browser evidence/screenshots: `tmp/pre-release-current-db-qa/browser-qa-20260624T210916Z.json`, `tmp/pre-release-current-db-qa/screenshots-20260624T210916Z/`

## Final Recommendation

Not ready.

Fix the `/auth` hydration mismatch, fix browser route authorization for member/instructor access to `/admin`, investigate the Supabase auth console errors, then rerun the auth and protected-route browser matrix. This remains pre-release current DB QA only; final production release readiness still requires the same QA on a clean confirmed staging/release database.
