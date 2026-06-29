# Cloud & Core Member RTL Arabic/Hebrew Layout Fix Report

## Files changed

- `src/routes/_authenticated/member/index.tsx`
- `src/styles.css`

## Typography changes

- Kept the editorial display treatment for English member home headings.
- Switched RTL hero headings to the UI font instead of the English display treatment.
- Reduced RTL heading scale and removed display-style letter spacing for Hebrew and Arabic.
- Removed uppercase/tracking treatment from shared member eyebrow/chip styling in Hebrew and Arabic.

## RTL layout fixes

- Added a dedicated `member-hero-content` wrapper so the member home hero block mirrors intentionally by `dir`.
- Kept English left-aligned and moved Hebrew/Arabic hero content to right-aligned composition.
- Replaced route action arrow icons in the member home section headers with directional text arrows:
  - RTL: `←`
  - LTR: `→`
- Updated greeting rendering to use `<bdi>` for member names inside localized greeting strings.

## Member home fixes

- Fixed the greeting composition so Hebrew/Arabic render as one natural phrase:
  - `שלום, Ameer`
  - `أهلاً، Ameer`
- Preserved the English editorial variant:
  - `Welcome back, Ameer`
- Updated the hero section to use cleaner RTL-native composition instead of applying the English display layout unchanged.
- Added bidi isolation to the next-booking card title so mixed English/Hebrew titles remain stable.

## Lesson card fixes

- The shared member lesson card already used structured RTL-aware layout and structured time/duration badge spans.
- This pass kept that shared implementation and aligned the member home composition around it.
- Existing structured time badge remains direction-safe and avoids raw `|` separators.

## Bottom safe-area fixes

- Increased shared member page bottom padding to:
  - `max(var(--member-bottom-nav-offset), calc(130px + env(safe-area-inset-bottom)))`
- Applied the stronger bottom clearance to:
  - `.member-shell-main`
  - `.member-sheet-content`
  - `.member-page`
  - `.member-home`
  - `.member-home-primary`

## Commands run

| Command                                                       | Result |
| ------------------------------------------------------------- | ------ |
| `/Users/ameeramer/.bun/bin/bunx tsc --noEmit`                 | PASS   |
| `/Users/ameeramer/.bun/bin/bun run build`                     | PASS   |
| `/Users/ameeramer/.bun/bin/bunx tsx tests/unit/i18n.test.mjs` | PASS   |

## Screenshots / evidence

- Code evidence:
  - `src/routes/_authenticated/member/index.tsx`
  - `src/styles.css`
- Browser screenshots were not captured in this pass.

## Remaining issues

- Live browser QA for authenticated member flows in Hebrew, Arabic, and English was not executed in this pass.
- Because that authenticated visual sweep was not rerun here, final visual signoff for:
  - `/member`
  - `/member/schedule`
  - bottom-nav overlap on real device/browser chrome
    remains pending.
