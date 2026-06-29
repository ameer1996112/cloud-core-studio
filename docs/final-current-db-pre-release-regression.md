# Cloud & Core Final Current-DB Pre-Release Regression

## Verdict

- Final current-DB regression passed: YES
- Release ready: NO
- Remaining blockers:
  - Do not mark final release-ready from the current controlled DB alone.
  - Cleanup preview is still needed before deleting QA data.
  - Final clean staging/release database QA remains the release gate before public launch.

## Commands run

| Command                                                       | Result | Notes                                                                                  |
| ------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------- |
| `/Users/ameeramer/.bun/bin/bunx tsc --noEmit`                 | PASS   | TypeScript check passed.                                                               |
| `/Users/ameeramer/.bun/bin/bun run build`                     | PASS   | Client and SSR production build passed.                                                |
| `/Users/ameeramer/.bun/bin/bunx tsx tests/unit/i18n.test.mjs` | PASS   | `i18n defaults and catalogs OK`.                                                       |
| `python3 -m py_compile tests/e2e/playwright-routing.py`       | PASS   | Syntax check passed.                                                                   |
| Remove `tests/e2e/__pycache__/` and `*.pyc`                   | PASS   | Removed generated Python cache after `py_compile`; no Python cache artifacts remained. |

## Browser QA

Evidence: `tmp/final-current-db-pre-release-regression/browser.json`

| Flow                           | Role       | Route                                                 | Device            | Result | Console errors |
| ------------------------------ | ---------- | ----------------------------------------------------- | ----------------- | ------ | -------------- |
| `/auth` Hebrew refresh         | Guest      | `/auth`                                               | 390x844           | PASS   | 0              |
| `/auth` Arabic refresh         | Guest      | `/auth`                                               | 390x844           | PASS   | 0              |
| `/auth` English refresh        | Guest      | `/auth`                                               | 390x844           | PASS   | 0              |
| UI login                       | Member     | `/auth` to `/member`                                  | 390x844           | PASS   | 0              |
| UI logout                      | Member     | `/member` to `/auth`                                  | 390x844           | PASS   | 0              |
| Guest admin guard              | Guest      | `/admin`                                              | 390x844           | PASS   | 0              |
| Member admin guard             | Member     | `/admin`                                              | 390x844           | PASS   | 0              |
| Instructor admin guard         | Instructor | `/admin`                                              | 390x844           | PASS   | 0              |
| Admin shell                    | Admin      | `/admin`                                              | 390x844           | PASS   | 0              |
| Owning member receipt          | Member     | `/receipts/428a6702-dc16-48d9-a0de-5c5222fbbd6f`      | 390x844, 820x1180 | PASS   | 0              |
| Other member receipt RLS route | Member     | `/receipts/428a6702-dc16-48d9-a0de-5c5222fbbd6f`      | 390x844           | PASS   | 0              |
| Guest receipt guard            | Guest      | `/receipts/428a6702-dc16-48d9-a0de-5c5222fbbd6f`      | 390x844           | PASS   | 0              |
| Admin class detail             | Admin      | `/admin/classes/827e08e3-e592-4384-93d4-53fd2e33cf2f` | 390x844, 820x1180 | PASS   | 0              |
| Member admin class block       | Member     | `/admin/classes/827e08e3-e592-4384-93d4-53fd2e33cf2f` | 390x844           | PASS   | 0              |
| Instructor admin class block   | Instructor | `/admin/classes/827e08e3-e592-4384-93d4-53fd2e33cf2f` | 390x844           | PASS   | 0              |
| Guest admin class block        | Guest      | `/admin/classes/827e08e3-e592-4384-93d4-53fd2e33cf2f` | 390x844           | PASS   | 0              |

Summary: 33 browser checks passed, 0 failed, 0 console events, 0 hydration mismatch events, 0 `getUser`/failed fetch events.

## Functional QA

Evidence: `tmp/final-current-db-pre-release-regression/functional.json`

| Flow                 | Expected                                          | Actual                                                                                | Result |
| -------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------- | ------ |
| Existing QA users    | Admin/member/instructor/other can login           | All QA users signed in successfully                                                   | PASS   |
| Member booking       | Existing QA booking remains booked                | Booking `b7a75532-504e-417e-b80f-062535c08798` is `booked` for the QA member/class    | PASS   |
| Credits              | Credits decreased from booking/payment flow       | QA member has `remaining_credits = 6`                                                 | PASS   |
| Capacity             | Class booked count reflects booking               | QA class capacity `4`, booked count `1`                                               | PASS   |
| Admin roster         | Admin roster data includes booking                | Roster includes QA booking/member                                                     | PASS   |
| Instructor roster    | Instructor RLS allows assigned booking visibility | Instructor can read QA booking via RLS                                                | PASS   |
| Attendance           | Attendance persists                               | Attendance record `ccd8a78c-e7dd-4ad4-8a2a-760a76bbb64c` is `attended`                | PASS   |
| Payment confirmation | Payment confirmation persisted                    | Payment `a1d764c7-fdac-451b-823a-09c972833059` is `paid` with `confirmed_at`          | PASS   |
| Receipt issued       | Receipt exists for payment                        | Receipt `428a6702-dc16-48d9-a0de-5c5222fbbd6f` issued for the QA payment/member       | PASS   |
| Receipt owner RLS    | Owner can read own receipt                        | Owning member can read receipt via anon client                                        | PASS   |
| Receipt RLS block    | Other member cannot read receipt                  | Other member receives no receipt row                                                  | PASS   |
| Notification log     | Notification log persists                         | Notification log `8c4a02cb-634a-425b-aff6-120f9d0b084f` is `sent` for QA member/class | PASS   |

## Security/role QA

| Test                            | Expected                                          | Actual                                                        | Result |
| ------------------------------- | ------------------------------------------------- | ------------------------------------------------------------- | ------ |
| Guest `/admin`                  | Redirect to `/auth`                               | Redirected to `/auth`                                         | PASS   |
| Member `/admin`                 | Redirect to `/member`                             | Redirected to `/member`                                       | PASS   |
| Instructor `/admin`             | Redirect to `/instructor`                         | Redirected to `/instructor`                                   | PASS   |
| Admin `/admin`                  | Allowed                                           | Admin stayed in admin shell                                   | PASS   |
| Member `/admin/classes/:id`     | Redirect to `/member`, no admin content flash     | Redirected to `/member`; admin detail markers not present     | PASS   |
| Instructor `/admin/classes/:id` | Redirect to `/instructor`, no admin content flash | Redirected to `/instructor`; admin detail markers not present | PASS   |
| Guest `/admin/classes/:id`      | Redirect to `/auth`, no admin content flash       | Redirected to `/auth`; admin detail markers not present       | PASS   |
| Receipt RLS                     | Non-owner cannot view another member receipt      | Other member query returned no row                            | PASS   |

## Receipt/admin detail route QA

| Route                                                 | Role          | Expected                          | Actual                                                               | Result |
| ----------------------------------------------------- | ------------- | --------------------------------- | -------------------------------------------------------------------- | ------ |
| `/receipts/428a6702-dc16-48d9-a0de-5c5222fbbd6f`      | Owning member | Direct open allowed               | Receipt page opened                                                  | PASS   |
| `/receipts/428a6702-dc16-48d9-a0de-5c5222fbbd6f`      | Owning member | Refresh remains allowed           | Receipt route still loaded after refresh-equivalent check            | PASS   |
| `/receipts/428a6702-dc16-48d9-a0de-5c5222fbbd6f`      | Other member  | Blocked by RLS/not-found handling | Stayed on receipt route; RLS read returned no row                    | PASS   |
| `/receipts/428a6702-dc16-48d9-a0de-5c5222fbbd6f`      | Guest         | Redirect to `/auth`               | Redirected to `/auth`                                                | PASS   |
| `/admin/classes/827e08e3-e592-4384-93d4-53fd2e33cf2f` | Admin         | Direct open allowed               | Admin class detail page opened                                       | PASS   |
| `/admin/classes/827e08e3-e592-4384-93d4-53fd2e33cf2f` | Admin         | Refresh remains allowed           | Admin class detail route still loaded after refresh-equivalent check | PASS   |
| `/admin/classes/827e08e3-e592-4384-93d4-53fd2e33cf2f` | Member        | Redirect to `/member`             | Redirected to `/member`                                              | PASS   |
| `/admin/classes/827e08e3-e592-4384-93d4-53fd2e33cf2f` | Instructor    | Redirect to `/instructor`         | Redirected to `/instructor`                                          | PASS   |
| `/admin/classes/827e08e3-e592-4384-93d4-53fd2e33cf2f` | Guest         | Redirect to `/auth`               | Redirected to `/auth`                                                | PASS   |

## Responsive QA

| Route                | Viewport          | Horizontal overflow | Result |
| -------------------- | ----------------- | ------------------- | ------ |
| `/auth`              | 390x844           | NO                  | PASS   |
| `/auth`              | 820x1180          | NO                  | PASS   |
| `/auth`              | 1440x900          | NO                  | PASS   |
| `/member`            | 390x844           | NO                  | PASS   |
| `/member`            | 820x1180          | NO                  | PASS   |
| `/member`            | 1440x900          | NO                  | PASS   |
| `/member/schedule`   | 390x844           | NO                  | PASS   |
| `/member/schedule`   | 820x1180          | NO                  | PASS   |
| `/member/schedule`   | 1440x900          | NO                  | PASS   |
| `/admin`             | 390x844           | NO                  | PASS   |
| `/admin`             | 820x1180          | NO                  | PASS   |
| `/admin`             | 1440x900          | NO                  | PASS   |
| `/instructor`        | 390x844           | NO                  | PASS   |
| `/instructor`        | 820x1180          | NO                  | PASS   |
| `/instructor`        | 1440x900          | NO                  | PASS   |
| `/receipts/:id`      | 390x844, 820x1180 | NO                  | PASS   |
| `/admin/classes/:id` | 390x844, 820x1180 | NO                  | PASS   |

## New QA data

- Created: NO
- Tag: N/A
- Records: Existing QA records only:
  - `QA_PRE_RELEASE_`
  - `QA_PRE_RELEASE_RERUN_20260624T214226Z`

## Cleanup status

- Cleanup run: NO
- Cleanup preview needed: YES
