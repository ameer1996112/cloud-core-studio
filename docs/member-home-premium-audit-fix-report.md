# Cloud & Core Member Home Premium Audit Fix Report

## Files changed

- `src/routes/_authenticated/member/index.tsx`
- `src/lib/i18n.ts`
- `src/styles.css`

## Issues found

1. Mixed RTL/LTR greeting punctuation could render names awkwardly in Hebrew/Arabic.
2. Member home bottom spacing was too small relative to the bottom nav safe area.
3. Stats labels were still slightly admin/technical in tone.
4. Recommended-class copy could imply a booked class when it was only a suggestion.
5. Opening announcement card was too plain and depended entirely on backend text.
6. “All sessions” action used hardcoded arrow text instead of direction-aware icon handling.

## Fixes made

- Reworked the member-home greeting headline to isolate dynamic names with `bdi`.
- Changed the hero title/subtitle copy to be more member-facing and language-aware.
- Refined stats labels:
  - Hebrew: `כניסות זמינות`, `הרשמות`, `שיעורים זמינים`
  - Arabic: `دخول متاح`, `حجوزات`, `حصص متاحة`
  - English: `Credits`, `Bookings`, `Available classes`
- Split booked vs recommended wording:
  - booked state now uses a real “your next class” section
  - recommendation state now uses “recommended for you”
- Added a stable opening-announcement fallback card with localized launch copy.
- Replaced inline text arrows with direction-aware icon links for RTL/LTR.
- Increased member-home bottom padding to clear the bottom nav and safe area.
- Tightened member-home typography and stat-label spacing for a more premium mobile feel.

## Bidi / name fix

- Dynamic member names on the hero now render inside `<bdi>`.
- This prevents punctuation drift such as `.Ameer` in Hebrew RTL.

## Bottom nav safe-area fix

- Updated `.member-home-primary` to use:
  - `padding-bottom: calc(110px + env(safe-area-inset-bottom));`
- This gives the last member-home content enough room above the bottom nav and iPhone browser controls.

## Localization fixes

- Added or updated member-home copy for English, Hebrew, and Arabic:
  - greeting title
  - welcome subtitle
  - next booking / recommended wording
  - opening announcement body
  - CTA for viewing booking
- Removed the stale duplicate Arabic `member.bookNext` key that broke typecheck.

## Responsive QA

Code-level pass completed:

- member-home spacing adjusted for mobile safe area
- direction-aware CTA arrows now work from shared language direction state
- greeting/title layout no longer depends on brittle punctuation placement

Live authenticated browser QA not completed in this pass:

- no member-session sweep was run here
- console/hydration/runtime behavior on `/member` still needs a real signed-in browser pass

## Commands run

| Command                                                       | Result |
| ------------------------------------------------------------- | ------ |
| `/Users/ameeramer/.bun/bin/bunx tsc --noEmit`                 | PASS   |
| `/Users/ameeramer/.bun/bin/bun run build`                     | PASS   |
| `/Users/ameeramer/.bun/bin/bunx tsx tests/unit/i18n.test.mjs` | PASS   |

## Remaining issues

- Recommended final check: authenticated member browser QA on `/member` in Hebrew, Arabic, and English at mobile widths.
- Recommended visual check: confirm the bottom card and CTA remain fully visible above the bottom nav on iPhone Safari / Capacitor webview.
