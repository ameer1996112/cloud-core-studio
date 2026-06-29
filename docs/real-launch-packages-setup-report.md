# Cloud & Core Real Launch Packages Setup Report

## Verdict

- Real launch packages created/updated: YES
- Duplicates created: NO
- Migrations run: NO
- Schema changed: NO
- Booking/payment/receipt logic changed: NO
- QA/E2E/test packages created: NO

## Packages

| Package                           | ID                                     | Slug                 | Price  | Credits | Validity | Active |
| --------------------------------- | -------------------------------------- | -------------------- | ------ | ------- | -------- | ------ |
| Single Class                      | `d837ec67-d6b6-4547-9147-bc39a336ad11` | `single_class`       | `₪80`  | 1       | 30 days  | YES    |
| Monthly Membership — Once a Week  | `c5c9e77a-9f79-41b4-9cfc-b5e8da1d61bd` | `monthly_once_week`  | `₪280` | 4       | 30 days  | YES    |
| Monthly Membership — Twice a Week | `9ccd255a-2891-4dd4-a7fd-48f153d610df` | `monthly_twice_week` | `₪350` | 8       | 30 days  | YES    |

## Data Result

- Project: `banjmspemvzrqckajvwo`
- Plans before setup: `0`
- Plans after setup: `3`
- Active visible launch packages: `3`
- Active non-launch packages: `0`
- Evidence: `tmp/real-launch-packages/upsert-result.json`

## Display Result

Admin `/admin/plans`:

- Shows all 3 packages as cards.
- Shows localized package name, price, validity, credits/frequency, active visibility, and edit action.
- Does not show a standalone `ILS` currency metric.
- Does not show QA/E2E/test packages.

Member `/member/packages` data path:

- Real active package payload contains exactly 3 visible launch plans.
- Hebrew/Arabic/English display copy resolves correctly from package slugs.
- Price rendering uses `₪`.
- Evidence: `tmp/real-launch-packages/member-visible-data.json`

## Manual Payment / Request Flow

The existing manual package request flow remains connected:

- Member selecting a package calls `createMyPackageRequest`.
- The request is inserted into `package_requests` with status `requested`.
- The package is not marked paid automatically.
- Admin confirmation still goes through the existing payment/receipt confirmation flow.
- Credits are granted only after admin confirms payment.

No package request was submitted during this setup because the database currently has only the admin account and no real member account to use for non-test browser submission.

## Commands Run

| Command                                                       | Result | Notes                              |
| ------------------------------------------------------------- | ------ | ---------------------------------- |
| `/Users/ameeramer/.bun/bin/bunx tsc --noEmit`                 | PASS   | Typecheck passed                   |
| `/Users/ameeramer/.bun/bin/bun run build`                     | PASS   | Production build passed            |
| `/Users/ameeramer/.bun/bin/bunx tsx tests/unit/i18n.test.mjs` | PASS   | i18n catalog/default checks passed |

## Browser QA

| Page           | Language    | Viewport   | Result | Console errors |
| -------------- | ----------- | ---------- | ------ | -------------- |
| `/admin/plans` | Hebrew RTL  | 390 x 844  | PASS   | 0              |
| `/admin/plans` | Arabic RTL  | 820 x 1180 | PASS   | 0              |
| `/admin/plans` | English LTR | 1440 x 900 | PASS   | 0              |

Evidence:

- `tmp/real-launch-packages/admin-browser-qa.json`
- `tmp/real-launch-packages/screenshots/admin-plans-he-390.png`
- `tmp/real-launch-packages/screenshots/admin-plans-ar-820.png`
- `tmp/real-launch-packages/screenshots/admin-plans-en-1440.png`

## Remaining Issues

- Member browser QA was not submitted through the UI because there is no non-test member account currently available.
- Once the first real member account exists, do one live package request smoke test and confirm the request appears for admin without auto-marking payment as paid.
