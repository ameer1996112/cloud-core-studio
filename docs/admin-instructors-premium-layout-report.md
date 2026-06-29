# Admin Instructors Premium Layout Report

## Scope

Updated `/admin/instructors` as a UI-only premium layout pass. No migrations, schema changes, booking/payment/auth logic changes, or QA/demo records were created.

## Files Changed

- `src/routes/_authenticated/admin/instructors.tsx`
- `src/components/admin-shared/index.tsx`
- `src/lib/i18n.ts`
- `src/styles.css`
- `docs/admin-instructors-premium-layout-report.md`

## Layout Strategy

The page now uses a tighter vertical flow:

1. Premium header with localized eyebrow/title/subtitle.
2. Integrated primary CTA aligned opposite the header copy on desktop and stacked on smaller screens.
3. Combined summary and search control panel.
4. Two-column premium instructor card grid on desktop, single-column cards on tablet/mobile.
5. Rich empty state when there are no instructors.

## Header Improvements

- Replaced the generic `AdminPageHeader` composition with a page-specific header.
- Added exact Hebrew, Arabic, and English copy from the brief.
- Reduced hero whitespace and kept the header visually connected to the rest of the page.
- Added `dir={dir}` support through `AdminPageShell` for page-level RTL/LTR handling.

## CTA Improvements

- Moved `Add instructor` / `הוספת מדריך` into the header system.
- Kept the shared navy button style and added page-specific sizing/shadow only.
- On mobile/tablet, the CTA stacks below the header and remains full-width where needed.

## Stats Improvements

- Replaced disconnected metric cards with a compact summary panel.
- Added total, active, and inactive instructor counts.
- Styled the active count as a subtle accent card.

## Search Improvements

- Rebuilt the search as a premium rounded field inside the summary panel.
- Used logical padding and `inset-inline-start` so the search icon aligns correctly in RTL/LTR.
- Added a compact result-count pill.

## Card Redesign

- Rebuilt instructor cards with:
  - stronger avatar presentation,
  - intentional active status dot,
  - prominent instructor name,
  - calmer bio/specialty line,
  - premium status chip,
  - metadata chips for schedule/profile readiness,
  - grouped action row for edit and activate/deactivate.

## RTL / LTR Fixes

- Page shell receives `dir={dir}`.
- Header, search, result pill, cards, and actions use logical alignment.
- Search icon/input padding uses inline direction-aware rules.
- Hebrew and Arabic layouts stay right-native without hardcoded left alignment.

## Responsive Fixes

- Desktop: two-column card grid with compact summary/search panel.
- Tablet: summary/search stacks cleanly and cards become single-column.
- Mobile: CTA/search/actions become full-width, stats stack, card identity/actions no longer crowd.

## Verification

Passed:

- `/Users/ameeramer/.bun/bin/bunx tsc --noEmit`
- `/Users/ameeramer/.bun/bin/bunx tsx tests/unit/i18n.test.mjs`
- `/Users/ameeramer/.bun/bin/bun run lint`
- `/Users/ameeramer/.bun/bin/bun run build`

Notes:

- `bun run lint` exits successfully with existing repo warnings.
- Live browser route probe on `http://127.0.0.1:4178/admin/instructors` returned `307` to `/auth`, so authenticated desktop/tablet/mobile screenshots were not captured in this shell.
- No test or demo records were created for visual verification.

## Remaining Follow-Up

- Run an authenticated browser sweep on `/admin/instructors` at `1440x900`, `820x1180`, and `390x844` after opening a valid admin session.
