# Cloud & Core Pre-Release Regression After Blocker Fixes

## Verdict

- Regression passed: NO
- Release ready: NO
- Main blockers:
  - Member receipt browser route `/receipts/:id` redirects to `/member`, so member cannot view the receipt page in browser.
  - Admin class detail/browser roster route `/admin/classes/:id` redirects to `/admin`, so the class-detail roster page does not open in browser.

The release blocker fixes themselves held: no hydration mismatch, no repeated `getUser()` failed-fetch console errors, and member/instructor `/admin` access is blocked.

## Commands run

| Command                             | Result | Notes                                            |
| ----------------------------------- | -----: | ------------------------------------------------ |
| `bunx tsc --noEmit`                 |   PASS | No TypeScript errors.                            |
| `bun run build`                     |   PASS | Build completed. Vite/plugin timing output only. |
| `bunx tsx tests/unit/i18n.test.mjs` |   PASS | `i18n defaults and catalogs OK`.                 |

## Browser QA

Evidence:

- Focused browser result: `tmp/pre-release-regression-after-blockers/browser-focused.json`
- Broad browser result: `tmp/pre-release-regression-after-blockers/browser.json`
- Screenshots: `tmp/pre-release-regression-after-blockers/focused-screens/`

| Flow                                              | Role       | Language | Device             | Result | Console errors |
| ------------------------------------------------- | ---------- | -------- | ------------------ | -----: | -------------: |
| `/auth` refresh                                   | guest      | Hebrew   | 390px              |   PASS |              0 |
| `/auth` refresh                                   | guest      | Arabic   | 390px              |   PASS |              0 |
| `/auth` refresh                                   | guest      | English  | 390px              |   PASS |              0 |
| UI login                                          | member     | Hebrew   | 390px              |   PASS |              0 |
| UI logout/session clear                           | member     | Hebrew   | 390px              |   PASS |              0 |
| Direct `/admin`                                   | guest      | n/a      | 390px              |   PASS |              0 |
| Direct `/admin`                                   | member     | Hebrew   | 390px/820px/1440px |   PASS |              0 |
| Direct `/admin`                                   | instructor | Hebrew   | 390px/820px/1440px |   PASS |              0 |
| Direct `/admin`                                   | admin      | Hebrew   | 390px/820px/1440px |   PASS |              0 |
| `/member`, `/member/schedule`, `/member/bookings` | member     | Hebrew   | 390px/820px/1440px |   PASS |              0 |
| `/instructor`                                     | instructor | Hebrew   | 390px/820px/1440px |   PASS |              0 |
| `/admin`, `/admin/pulse`, `/admin/reports`        | admin      | Hebrew   | 390px/820px/1440px |   PASS |              0 |
| `/receipts/:id`                                   | member     | Hebrew   | 390px/820px/1440px |   FAIL |              0 |
| `/admin/classes/:id`                              | admin      | Hebrew   | 390px/820px/1440px |   FAIL |              0 |

Focused browser summary: 58 passed, 6 failed, 0 console events.

## Functional QA

Evidence: `tmp/pre-release-regression-after-blockers/functional-20260624T214226Z.json`

| Flow                           | Expected                                              | Actual                                               | Result |
| ------------------------------ | ----------------------------------------------------- | ---------------------------------------------------- | -----: |
| Existing QA users login        | Admin/member/instructor/other member can authenticate | All existing QA users logged in                      |   PASS |
| Tagged studio data setup       | New rerun room/program/plan/class created             | Created with `QA_PRE_RELEASE_RERUN_20260624T214226Z` |   PASS |
| Payment confirmation           | Payment grants credits and issues one receipt         | Credits increased, receipt issued                    |   PASS |
| Duplicate payment confirmation | Second confirmation is idempotent                     | Returned already-confirmed, no duplicate receipt     |   PASS |
| Booking                        | Member books rerun class                              | Booking created                                      |   PASS |
| Credits                        | Credits decrease by class cost                        | Decreased by class `credit_cost`                     |   PASS |
| Capacity                       | Class `booked_count` increments                       | Incremented by 1                                     |   PASS |
| Admin roster                   | Booking visible to admin data query                   | Booking present                                      |   PASS |
| Instructor roster              | Booking visible to instructor data query              | Booking present                                      |   PASS |
| Attendance                     | Admin marks attended                                  | `attended` persisted                                 |   PASS |
| Receipt/RLS                    | Owner can read, other member cannot                   | RLS behaved correctly                                |   PASS |
| Notification log               | Admin logs WhatsApp/manual notification               | Log persisted as `sent`                              |   PASS |

## Security/role QA

| Test                                       | Expected                               | Actual                      | Result |
| ------------------------------------------ | -------------------------------------- | --------------------------- | -----: |
| Guest direct `/admin`                      | Redirect to `/auth`                    | Redirected to `/auth`       |   PASS |
| Member direct `/admin`                     | Redirect to `/member`                  | Redirected to `/member`     |   PASS |
| Member refresh after `/admin` redirect     | Remain blocked from admin              | Stayed on `/member`         |   PASS |
| Instructor direct `/admin`                 | Redirect to `/instructor`              | Redirected to `/instructor` |   PASS |
| Instructor refresh after `/admin` redirect | Remain blocked from admin              | Stayed on `/instructor`     |   PASS |
| Admin direct `/admin`                      | Allowed                                | Stayed on `/admin`          |   PASS |
| Admin refresh `/admin`                     | Allowed                                | Stayed on `/admin`          |   PASS |
| Receipt RLS                                | Other member cannot read owner receipt | No data returned            |   PASS |

## Responsive QA

| Route                | Viewport               |                      Horizontal overflow | Result |
| -------------------- | ---------------------- | ---------------------------------------: | -----: |
| `/auth`              | 390px                  |                                       No |   PASS |
| `/member`            | 390px / 820px / 1440px |                                       No |   PASS |
| `/member/schedule`   | 390px / 820px / 1440px |                                       No |   PASS |
| `/member/bookings`   | 390px / 820px / 1440px |                                       No |   PASS |
| `/instructor`        | 390px / 820px / 1440px |                                       No |   PASS |
| `/admin`             | 390px / 820px / 1440px |                                       No |   PASS |
| `/admin/pulse`       | 390px / 820px / 1440px |                                       No |   PASS |
| `/admin/reports`     | 390px / 820px / 1440px |                                       No |   PASS |
| `/receipts/:id`      | 390px / 820px / 1440px | No overflow on redirected `/member` page |   FAIL |
| `/admin/classes/:id` | 390px / 820px / 1440px |  No overflow on redirected `/admin` page |   FAIL |

## Bugs found

### REG-01

- ID: REG-01
- Severity: High
- Route: `/receipts/:id`
- Steps:
  1. Log in as the member who owns receipt `428a6702-dc16-48d9-a0de-5c5222fbbd6f`.
  2. Navigate directly to `/receipts/428a6702-dc16-48d9-a0de-5c5222fbbd6f`.
- Expected: Receipt page opens and displays the member's own receipt.
- Actual: Browser redirects to `/member`.
- Suggested fix: Check route generation/link path and authenticated route guard interaction for `/_authenticated/receipts/$id`. The data/RLS layer passed, so this appears to be browser route access/redirect behavior.

### REG-02

- ID: REG-02
- Severity: High
- Route: `/admin/classes/:id`
- Steps:
  1. Log in as admin.
  2. Navigate directly to `/admin/classes/827e08e3-e592-4384-93d4-53fd2e33cf2f`.
- Expected: Admin class detail page opens with the roster area.
- Actual: Browser redirects to `/admin`.
- Suggested fix: Check route generation and admin class detail route matching for `/_authenticated/admin/classes/$id`. The admin roster data query passed, so this appears to be browser route access/redirect behavior.

## QA data status

- Previous QA data still present: YES
- New QA data created: YES
- New QA tag: `QA_PRE_RELEASE_RERUN_20260624T214226Z`
- Cleanup run: NO
- Migrations run: NO
- Destructive scripts run: NO
