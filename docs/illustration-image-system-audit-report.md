# Cloud & Core Illustration and Image System Audit Report

## Scope

Audited the shared empty-state and illustration surfaces used across admin and member routes, with focus on visuals that previously appeared as generic placeholders, white canvases, or disconnected one-off artwork.

## Pages and Surfaces Audited

- Admin shared empty states through `src/components/admin-shared/index.tsx`
- Admin attendance empty state at `/admin/attendance`
- Admin simple empty states used by classes, calendar, instructors, plans, programs, reports, and related admin data panels
- Member empty states through `MemberEmptyState` in `src/components/member/PremiumClassCard.tsx`
- Member schedule, bookings, packages, payments, profile, receipt, and cloud-card empty-state usage
- Shared image registry in `src/lib/image-assets.ts`
- Public empty-state assets under `public/images/empty-states`

## Image Assets Replaced

- `public/images/empty-states/no-classes.svg`
  - Replaced the full-background calendar placeholder with a transparent attendance/check-in roster motif.
  - The drawing now fills the viewBox with no white rectangular canvas.
- `public/images/empty-states/no-bookings.svg`
  - Replaced the generic cloud placeholder with a structured booking-card illustration.
  - Uses the same navy line, gold accent, and transparent background style.
- `public/images/empty-states/payment-empty.svg`
  - Replaced the full ivory rectangle with a transparent receipt/check illustration.
  - Removes dead background whitespace and keeps the motif focused.
- `public/images/empty-states/cloud-card-empty.svg`
  - Replaced text-heavy card artwork with a cleaner premium cloud-card motif.
  - Removes generic text labels from the image so localization is handled by UI copy.

## Registry Updates

- `src/lib/image-assets.ts`
  - Changed `noBookings` from `/images/empty-states/no-bookings.jpg` to `/images/empty-states/no-bookings.svg`.
  - Changed `cloudCardEmpty` from `/images/empty-states/cloud-card-empty.jpg` to `/images/empty-states/cloud-card-empty.svg`.
  - The old JPEG placeholders are no longer referenced by application code.

## Component Updates

- `src/components/admin-shared/index.tsx`
  - Tightened the attendance illustration viewBox so the roster/check image renders cropped instead of floating inside extra canvas.
  - Preserved the shared `Empty` component API and did not change attendance data or routing logic.
- `src/styles.css`
  - Increased attendance illustration scale inside the card.
  - Added object-fit containment for member empty-state images.
  - Kept RTL/LTR layout behavior in the shared empty-state rules.

## RTL/LTR Notes

- Admin rich empty states already use direction-aware grid placement.
- Attendance empty state keeps visual placement mirrored for RTL through the existing `[dir="rtl"].admin-empty-state-attendance` rules.
- Member empty states continue to inherit `dir` from `useI18n`.
- The new SVGs avoid embedded localized text, so Hebrew, Arabic, and English copy remains controlled by the app i18n layer.

## Responsive Notes

- The new assets are transparent SVGs and scale cleanly at mobile, tablet, and desktop sizes.
- The attendance SVG no longer depends on a bitmap crop and has no white background.
- The member image container now keeps illustrations contained without stretching.

## Verification

Commands run:

- `/Users/ameeramer/.bun/bin/bunx tsc --noEmit` - passed
- `/Users/ameeramer/.bun/bin/bun run build` - passed
- `/Users/ameeramer/.bun/bin/bunx tsx tests/unit/i18n.test.mjs` - passed after rerun with elevated permissions because sandboxed TSX IPC pipe creation failed with `EPERM`
- `/Users/ameeramer/.bun/bin/bun run lint` - passed with existing warnings, 0 errors

Visual smoke:

- Started the built app locally on `http://127.0.0.1:4178`.
- Verified `http://127.0.0.1:4178/auth` returned `200`.
- Verified `http://127.0.0.1:4178/images/empty-states/no-classes.svg` served the updated asset.
- Captured attendance/no-classes asset screenshots at:
  - `/tmp/cc-no-classes-390.png`
  - `/tmp/cc-no-classes-820.png`
  - `/tmp/cc-no-classes-1440.png`
- Captured all updated empty-state assets on a checker-backed preview at:
  - `/tmp/cc-empty-assets-grid-390.png`
  - `/tmp/cc-empty-assets-grid-820.png`
  - `/tmp/cc-empty-assets-grid-1440.png`
- Checker-backed preview confirmed the SVG assets are transparent and do not contain embedded white canvas backgrounds.

## Remaining Notes

- The old JPEG files remain in `public/images/empty-states`, but they are no longer referenced by `src/lib/image-assets.ts`.
- Some admin table/report empty states intentionally use the shared simple `Empty` presentation instead of page-specific artwork; this keeps the visual language consistent without redesigning business surfaces.
