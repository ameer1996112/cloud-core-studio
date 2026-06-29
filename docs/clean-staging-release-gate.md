# Cloud & Core Clean Staging QA Report

## Verdict

- Release ready: NO
- Main blockers:
  - No clean staging/disposable Supabase database has been tested.
  - Migrations have not been applied from zero on a clean release-like database.
  - Mutating E2E suites have not passed on a clean staging/disposable database.
  - Full browser QA has not run against a clean staging/disposable database.
- Highest-risk area: backend release confidence, especially migrations from zero,
  RLS, booking/credits, payments/receipts, and hidden test/demo data leakage.

## Phase 1 Evidence Review

Reviewed artifacts:

- `tmp/controlled-dev-db-qa/pre-qa-row-counts.json`
- `tmp/controlled-dev-db-qa/browser-qa-20260624200958.json`
- `tmp/controlled-dev-db-qa/cleanup-report.json`
- `tmp/controlled-dev-db-qa/post-qa-row-counts.json`

### What Was Tested

- Controlled dev database project: `banjmspemvzrqckajvwo`.
- Controlled API/data QA using `QA_TEST_20260624200958` records:
  - QA admin, instructor, member, second member login.
  - Room, program, instructor, class, plan, payment, booking, attendance,
    receipt, and notification log creation.
  - Payment confirmation grants credits.
  - Booking decrements credits and increments booked count.
  - Admin roster sees the booking.
  - Instructor roster sees the booking without payment access.
  - Attendance status persists through attended and no-show updates.
  - Member can view own receipt.
  - Other member cannot view that receipt.
  - Notification log persists.
- Browser QA:
  - 71 checks passed.
  - 37 screenshots captured.
  - 0 console errors.
  - Auth language switching at 390px for English LTR, Arabic RTL, Hebrew RTL.
  - Admin/member/instructor routes at 390px, 820px, and 1440px.
  - Horizontal overflow checks passed for tested routes/viewports.

### What Was Not Tested

- Clean database migrations from zero.
- Mutating E2E suites on isolated staging:
  - `node scripts/e2e-seed.mjs`
  - `node tests/e2e/core_balance_slice.spec.mjs`
  - `node tests/e2e/payments_receipts.spec.mjs`
  - `node tests/e2e/rpc.spec.mjs`
- Fresh staging Supabase auth/storage/RLS behavior from empty state.
- Full release viewport matrix:
  - 430 x 932
  - 1024 x 768
  - 1440 x 900
- App icon/home-screen install validation.
- Actual WhatsApp external deep-link opening.
- Logout flow.
- Signup/register flow.
- Cancellation flow.
- Full admin button audit across every admin screen.
- Production-like UI with no E2E/test data leakage on a clean database.

### Data Left Behind

Controlled QA left these records in `banjmspemvzrqckajvwo`:

- Auth users: 5 QA users.
- Members/profiles: 5 QA rows.
- Instructors: 1 QA row.
- Rooms: 1 QA row.
- Program types: 1 QA row.
- Classes: 1 QA row.
- Plans: 1 QA row.
- Member plans: 1 QA row.
- Payments: 1 QA row.
- Receipts: 1 QA row.
- Bookings: 1 QA row.
- Attendance records: 1 QA row.
- Notification logs: 1 QA row.

One partial QA admin was created during a stopped first attempt:

- `qa.admin+cloudcore-20260624200820@example.com`

Cleanup was not performed.

### Cleanup Safety

Cleanup is probably safe only if it is targeted by exact QA ids from
`tmp/controlled-dev-db-qa/cleanup-report.json` and performed in dependency order.

Do not run broad cleanup by prefix alone without review because:

- Auth deletion can cascade or leave orphaned app rows depending on triggers.
- Receipts/payments/member plans/bookings/attendance have foreign-key relations.
- The regular dev database contains existing E2E records and non-QA data.

Recommended cleanup process, only after explicit approval:

1. Re-read `cleanup-report.json`.
2. Confirm every id belongs to `QA_TEST_` or `qa.*+cloudcore-*`.
3. Delete only the listed records, in dependency order.
4. Re-count the affected tables.
5. Do not touch non-QA records.

### Hidden Risks

- Admin payments browser evidence shows existing `E2E` payments/receipts visible
  in the regular dev UI. A clean staging run must confirm seed/test data is hidden
  or absent from production-like screens.
- PITR was disabled and no usable physical backups were listed.
- Logical schema export failed because Docker is unhealthy.
- Controlled dev QA proves important app behavior but does not prove a fresh
  release environment can be created correctly.

## Environment

| Field                        | Value                                               |
| ---------------------------- | --------------------------------------------------- |
| Supabase project             | Not yet provided for clean staging                  |
| DB type                      | Required: clean staging/disposable Supabase project |
| Clean DB confirmed           | NO                                                  |
| Migrations applied from zero | NO                                                  |
| Seed used                    | NO                                                  |
| Destructive tests allowed    | NO until confirmed staging/disposable               |

## Clean Staging QA Plan

### Target Rules

- Use only a clean staging Supabase database or disposable Supabase project.
- Do not use `banjmspemvzrqckajvwo` for destructive/mutating E2E.
- Do not use `iuxxebonaamwpgiwqkeq`.
- Do not run migrations, seeds, or mutating E2E until the target is confirmed.
- Require:
  - `APP_ENV=staging`
  - `ALLOW_E2E_MUTATION=true`
  - `VITE_SUPABASE_PROJECT_ID=<staging-project-ref>`
  - project ref must not be a blocked project id.

### Setup Commands

| Command                             | Result  | Notes                         |
| ----------------------------------- | ------- | ----------------------------- |
| `bun install`                       | NOT RUN | Run on clean staging QA pass. |
| `bunx tsc --noEmit`                 | NOT RUN | Required gate.                |
| `bun run build`                     | NOT RUN | Required gate.                |
| `bunx tsx tests/unit/i18n.test.mjs` | NOT RUN | Required gate.                |

### Database Setup

1. Create or receive a clean Supabase staging project.
2. Confirm project ref is not:
   - `banjmspemvzrqckajvwo`
   - `iuxxebonaamwpgiwqkeq`
3. Create `.env.staging` from `.env.staging.example`.
4. Apply migrations from empty DB using the project workflow.
5. Verify:
   - schema tables exist
   - RLS is enabled where expected
   - RPC functions exist
   - auth roles and policies behave correctly
6. Regenerate types if the project workflow requires it.

### Seed and Mutating E2E

Run only after staging target is confirmed:

```bash
set -a
source .env.staging
set +a

node scripts/e2e-seed.mjs
node tests/e2e/core_balance_slice.spec.mjs
node tests/e2e/payments_receipts.spec.mjs
node tests/e2e/rpc.spec.mjs
```

Expected result: every command exits zero and prints PASS results.

## Functional Results

| Flow                                        | Role                    | Language      | Device                 | Result         | Notes                                       |
| ------------------------------------------- | ----------------------- | ------------- | ---------------------- | -------------- | ------------------------------------------- |
| Auth login                                  | admin/member/instructor | HE/AR/EN      | 390/820/1440           | PASS on dev DB | Must rerun on clean staging.                |
| Admin creates room/program/instructor/class | admin                   | HE/EN         | API + browser evidence | PASS on dev DB | Must rerun on clean staging.                |
| Member books class                          | member                  | HE/AR         | API + browser evidence | PASS on dev DB | Must rerun on clean staging.                |
| Credits decrease                            | member                  | API           | API                    | PASS on dev DB | Must rerun on clean staging.                |
| Capacity updates                            | admin/member            | API           | API                    | PASS on dev DB | Must rerun on clean staging.                |
| Member Cloud Card/bookings                  | member                  | HE/AR/EN      | 390/820/1440           | PASS on dev DB | Must rerun on clean staging.                |
| Admin roster                                | admin                   | HE/EN         | 390/820/1440           | PASS on dev DB | Must rerun on clean staging.                |
| Instructor roster                           | instructor              | EN            | 390/820/1440           | PASS on dev DB | Must rerun on clean staging.                |
| Attendance persists                         | admin                   | API           | API                    | PASS on dev DB | Must rerun on clean staging.                |
| Payment confirmation                        | admin                   | API + browser | API/browser            | PASS on dev DB | Must rerun on clean staging.                |
| Receipt ownership                           | member/other member     | API + browser | 390/820/1440           | PASS on dev DB | Must rerun on clean staging.                |
| Messages log persists                       | admin                   | HE/EN         | API/browser            | PASS on dev DB | WhatsApp external link not fully exercised. |

## Bugs Found

| ID             | Severity | Route             | Role  | Language | Device | Steps                                         | Expected                                     | Actual                                           | Suspected Cause                   | Suggested Fix                                                                       | Evidence                         |
| -------------- | -------- | ----------------- | ----- | -------- | ------ | --------------------------------------------- | -------------------------------------------- | ------------------------------------------------ | --------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------- |
| QA-BLOCKER-001 | Critical | N/A               | N/A   | N/A      | N/A    | Attempt release gate without clean staging DB | Clean staging is available and tested        | No clean staging DB available/tested             | Infrastructure/environment gap    | Create clean staging Supabase project and rerun this plan                           | This document                    |
| QA-RISK-001    | High     | `/admin/payments` | admin | HE       | 390    | Open payments on dev DB                       | Production-like UI has no E2E/test pollution | Existing E2E payment rows are visible in dev UI  | Prior non-isolated E2E/QA records | Confirm clean staging has no E2E data leakage; hide/remove test data before release | `browser-qa-20260624200958.json` |
| QA-RISK-002    | Medium   | Backup/export     | N/A   | N/A      | N/A    | Try schema export                             | Export available before mutating shared DB   | Export failed because Docker engine is unhealthy | Docker infrastructure issue       | Fix Docker or use Supabase dashboard backup before future shared DB mutation        | `pre-qa-public-schema.sql` is 0B |

## Security/RLS Results

| Test                             | Expected                 | Actual                     | Result         |
| -------------------------------- | ------------------------ | -------------------------- | -------------- |
| Instructor cannot read payments  | No payment data visible  | No payment data returned   | PASS on dev DB |
| Member can view own receipt      | Own receipt visible      | `CC-2026-01004` visible    | PASS on dev DB |
| Other member cannot view receipt | Receipt hidden           | Receipt number not visible | PASS on dev DB |
| RLS from clean migration         | Policies valid from zero | Not tested                 | BLOCKED        |

## Responsive Results

| Route                | Viewport              | Horizontal overflow | Offending element | Result         |
| -------------------- | --------------------- | ------------------- | ----------------- | -------------- |
| `/auth`              | 390 x 844             | NO                  | None found        | PASS on dev DB |
| `/admin`             | 390/820/1440          | NO                  | None found        | PASS on dev DB |
| `/admin/pulse`       | 390/820/1440          | NO                  | None found        | PASS on dev DB |
| `/admin/classes/$id` | 390/820/1440          | NO                  | None found        | PASS on dev DB |
| `/admin/payments`    | 390/820/1440          | NO                  | None found        | PASS on dev DB |
| `/admin/messages`    | 390/820/1440          | NO                  | None found        | PASS on dev DB |
| `/member`            | 390/820/1440          | NO                  | None found        | PASS on dev DB |
| `/member/schedule`   | 390/820/1440          | NO                  | None found        | PASS on dev DB |
| `/member/bookings`   | 390/820/1440          | NO                  | None found        | PASS on dev DB |
| `/member/packages`   | 390/820/1440          | NO                  | None found        | PASS on dev DB |
| `/receipts/$id`      | 390/820/1440          | NO                  | None found        | PASS on dev DB |
| `/instructor`        | 390/820/1440          | NO                  | None found        | PASS on dev DB |
| Full required matrix | 430/1024x768/1440x900 | Not tested          | Unknown           | BLOCKED        |

## Language Results

| Route            | Hebrew                  | Arabic           | English         | Issues                                                                       |
| ---------------- | ----------------------- | ---------------- | --------------- | ---------------------------------------------------------------------------- |
| `/auth`          | PASS RTL                | PASS RTL         | PASS LTR        | Page title remains Hebrew in evidence; verify if title localization matters. |
| Admin routes     | PASS on tested HE/EN    | Not fully tested | PASS on desktop | Rerun full matrix on clean staging.                                          |
| Member routes    | PASS on tested HE/AR/EN | PASS on tablet   | PASS on desktop | Rerun full matrix on clean staging.                                          |
| Instructor route | Not fully tested        | Not fully tested | PASS            | Rerun full matrix on clean staging.                                          |

## Data Cleanup

- Records created: listed in `tmp/controlled-dev-db-qa/cleanup-report.json`.
- Cleanup performed: NO.
- Cleanup safe: UNKNOWN until targeted deletion plan is approved.

## Final Recommendation

Not ready.

Controlled dev database QA passed, but Cloud & Core V1 must not be marked
release-ready until clean staging/disposable database QA passes with migrations
from zero, mutating E2E, full browser QA, RLS/security checks, language checks,
responsive checks, and no test-data leakage.
