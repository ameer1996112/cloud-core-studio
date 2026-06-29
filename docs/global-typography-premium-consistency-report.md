# Cloud & Core Global Typography Consistency Report

## Scope

- Audited the shared typography system for admin, member, instructor, auth-adjacent UI, shared cards, buttons, badges, tables, modals, sheets, and empty states.
- Kept the change limited to typography and visual consistency.
- No migrations, schema changes, test data, booking/payment/receipt/auth business logic, or database behavior changed.

## Files Changed

- `src/styles.css`
- `src/components/admin-shared/index.tsx`
- `src/components/app-shell/AppShell.tsx`
- `src/components/visual/InstructorAvatar.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/sheet.tsx`
- `src/components/ui/alert-dialog.tsx`
- `src/routes/_authenticated/admin/index.tsx`
- `src/routes/_authenticated/admin/members/index.tsx`
- `src/routes/_authenticated/admin/payments.tsx`
- `src/routes/_authenticated/admin/instructors.tsx`
- `src/routes/_authenticated/admin/attendance.tsx`

## Font Sources Found

- Brand serif: `Cormorant Garamond`, kept for `--font-brand`, `.font-brand`, and `.brand-wordmark`.
- Main UI font: `Assistant`, used for Hebrew, English, and general UI through `--font-sans`.
- Arabic UI font: `Noto Sans Arabic`, kept through `--font-ui-ar` and applied to Arabic shell text.
- Legacy `font-display` usage was widespread across admin/member UI, card titles, names, modal titles, and metric values.

## Typography System Updates

- Changed `--font-display` to resolve to the UI sans font instead of the brand serif.
- Kept `--font-brand` mapped to the brand serif so wordmarks remain branded.
- Added shared typography classes:
  - `.cc-ui-text`
  - `.cc-page-title`
  - `.cc-section-title`
  - `.cc-card-title`
  - `.cc-label`
  - `.cc-metric-value`
  - `.cc-technical-value`
- Added global `bdi` inheritance/isolation so mixed-language names inherit the surrounding UI font.
- Added Hebrew/Arabic letter-spacing reset with `:lang(he), :lang(ar)`.
- Added scoped admin/member shell typography guards so legacy route text stays on the UI font system.

## Serif / Display Usage Removed From UI

- Admin page headers now use `.cc-page-title`.
- Admin section titles now use `.cc-section-title`.
- Admin metric values now use UI font plus tabular numerals.
- Admin table text now uses UI font plus tabular numerals.
- Dialog, sheet, and alert dialog titles now use UI sans typography.
- Instructor avatar initials now use UI sans typography.
- Dashboard class titles, member names, attendance member names, instructor names, and payment table names were moved to UI typography.

## RTL / LTR Results

- Hebrew UI no longer relies on decorative serif heading styles.
- Arabic shell text uses `Noto Sans Arabic` and comfortable line-height.
- Hebrew/Arabic tracking is normalized.
- Mixed names are isolated with `bdi` in high-visibility admin/dashboard/payment/attendance areas.
- Technical values can use `.cc-technical-value` for LTR, tabular rendering.

## Routes Audited

- `/auth`
- `/member`
- `/member/schedule`
- `/member/bookings`
- `/member/packages`
- `/member/profile`
- `/receipts/:id`
- `/admin`
- `/admin/pulse`
- `/admin/classes`
- `/admin/schedule`
- `/admin/attendance`
- `/admin/rooms`
- `/admin/clients`
- `/admin/instructors`
- `/admin/programs`
- `/admin/packages`
- `/admin/payments`
- `/admin/messages`
- `/admin/reports`
- `/admin/settings`
- `/instructor`

## Commands Run

- `/Users/ameeramer/.bun/bin/bunx prettier --write ...`
- `/Users/ameeramer/.bun/bin/bunx tsc --noEmit`
- `/Users/ameeramer/.bun/bin/bun run build`
- `/Users/ameeramer/.bun/bin/bunx tsx tests/unit/i18n.test.mjs`
- `/Users/ameeramer/.bun/bin/bun run lint`

## Verification Results

- TypeScript: passed.
- Production build: passed.
- i18n catalog/defaults test: passed.
- Lint: passed with warnings only. Existing warning categories include `no-explicit-any`, `react-refresh/only-export-components`, and one existing hook dependency warning in messages.

## Remaining Issues

- There are still route-level `font-display` class names in legacy JSX, but `font-display` now resolves to the UI font, so they no longer render as the brand serif.
- A future cleanup can replace the remaining legacy class names with `.cc-*` classes for readability, but it is not required for the visual fix.
- Browser/device visual QA should be repeated on an authenticated session before deploying if exact pixel inspection is required.
