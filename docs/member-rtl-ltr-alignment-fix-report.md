# Cloud & Core Member RTL/LTR Alignment Fix Report

## Files changed

- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/src/styles.css`
- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/src/components/member/PremiumClassCard.tsx`
- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/src/components/member/ClassDetailSheet.tsx`
- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/src/routes/_authenticated/member/index.tsx`
- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/src/routes/_authenticated/member/schedule.tsx`
- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/src/routes/_authenticated/member/bookings.tsx`
- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/src/routes/_authenticated/member/packages.tsx`
- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/src/routes/_authenticated/member/account.tsx`
- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/src/routes/_authenticated/receipts/$id.tsx`

## RTL/LTR alignment fixes

- Added `dir={dir}` to the root wrapper of member-facing route pages so shared `text-start`, logical spacing, and flex alignment can mirror correctly by language.
- Added `dir={dir}` to member dialogs/sheets that were still rendering without explicit direction:
  - class detail sheet
  - bookings cancel dialog
  - package payment sheet
  - receipt page wrappers
- Expanded global member safe-area padding to include `.member-page`, not only `.member-shell-main` and `.member-sheet-content`.
- Made shared member page copy direction-aware:
  - Hebrew/Arabic: `align-items: flex-end`, `text-align: right`
  - English: `align-items: flex-start`, `text-align: left`
- Added direction-aware placement for the schedule date segment:
  - RTL: anchor to start of the grid track
  - LTR: anchor to end of the grid track
- Added direction-aware text alignment for shared member section headings and member cards.

## Components updated

### Premium class card

- Added `useI18n()` and `dir={dir}` at the card root.
- Replaced physical positioning with logical positioning:
  - `right-3` -> `end-3`
  - `left-4 right-4` -> `inset-x-4`
- Forced the hero/title block to use `text-start`.
- Wrapped the title with `<bdi>` and `dir="auto"` for mixed English/Hebrew titles.
- Allowed the bottom metadata row to wrap instead of forcing an LTR-feeling single row.

### Class detail sheet

- Added `useI18n()` and `dir={dir}` to `DialogContent`.
- This allows title, chips, summary text, and CTA alignment to follow the active language direction consistently.

## Mixed text / bidi fixes

- Member class title surfaces now inherit route direction correctly instead of rendering inside LTR-neutral wrappers.
- `PremiumClassCard` title now uses `<bdi>` for safer mixed branded English + localized program names.
- Existing structured time badge work remains compatible with this pass.

## Pages audited in code

- `/member`
- `/member/schedule`
- `/member/bookings`
- `/member/packages`
- `/member/profile`
- `/receipts/:id`
- shared member class detail sheet
- shared member premium class card

## Evidence

### Code-level evidence

- Member route roots now receive `dir={dir}` from `useI18n()`.
- Shared member CSS now applies alignment through `text-start` and `[dir="rtl"]` / `[dir="ltr"]` rules instead of relying on page-specific left/right patches.
- Member page safe-area padding now includes `.member-page`.

### Command verification

| Command                                                       | Result |
| ------------------------------------------------------------- | ------ |
| `/Users/ameeramer/.bun/bin/bunx tsc --noEmit`                 | PASS   |
| `/Users/ameeramer/.bun/bin/bun run build`                     | PASS   |
| `/Users/ameeramer/.bun/bin/bunx tsx tests/unit/i18n.test.mjs` | PASS   |

## Browser QA

Live authenticated browser QA was not completed in this turn.

What is ready for the next sweep:

- Hebrew RTL route shells now carry `dir="rtl"`
- Arabic RTL route shells now carry `dir="rtl"`
- English LTR route shells now carry `dir="ltr"`
- member page safe-area padding is shared instead of per-page
- shared class card and class detail sheet now inherit direction explicitly

## Remaining issues

- A real authenticated member browser sweep is still required to confirm:
  - Hebrew lesson card copy is fully right-aligned on live data
  - Arabic lesson card copy is fully right-aligned on live data
  - English lesson card copy is fully left-aligned on live data
  - no remaining punctuation drift on live mixed-content cards
  - no bottom-nav overlap regressions on the updated pages

## Acceptance status

- Shared `dir`-based member layout fix: DONE
- Route-level member wrappers aligned to language direction: DONE
- Shared premium class card alignment fix: DONE
- Shared member sheet/dialog direction fix: DONE
- Safe-area padding extension to `.member-page`: DONE
- Typecheck/build/i18n gates: PASS
- Live authenticated member visual QA across Hebrew/Arabic/English: PENDING
