# Cloud & Core Member Lesson Card RTL Labels Fix Report

## Files changed

- `src/components/visual/VisualClassCard.tsx`
- `src/components/member/ClassDetailSheet.tsx`
- `src/styles.css`

## Chip layout fix

- Replaced the card-local horizontal chip scroller with a wrapped chip row.
- Kept chips directly under the title in all languages.
- Increased chip height, padding, and font size so Hebrew and Arabic labels stay readable.
- Removed cramped single-line clipping behavior from member lesson chips.

## Title bidi fix

- Kept mixed English and Hebrew lesson titles inside `dir="auto"` + `<bdi>`.
- Kept the full text block direction-aware through the shared card container.
- Added RTL alignment rules so Hebrew and Arabic content groups align to the right cleanly.

## Localization mapping fix

- Reused the existing localized lesson title and metadata helpers.
- Preserved localized program/type chips:
  - Hebrew: `יוגה אווירית`, `מתחילות–בינוניות`, `שיעור זורם`
  - Arabic: `يوغا هوائية`, `مبتدئات–متوسط`, `حصة انسيابية`
  - English stays unchanged

## Screenshots / evidence

- Visual bug reference from user:
  - `/var/folders/gj/7lyzfjm53xnbpmnbn4q6v4t00000gp/T/codex-clipboard-7bce3c09-a8d4-4723-a3e2-29c091ab41fc.png`

## Commands run

| Command                                                       | Result |
| ------------------------------------------------------------- | ------ |
| `/Users/ameeramer/.bun/bin/bunx tsc --noEmit`                 | PASS   |
| `/Users/ameeramer/.bun/bin/bun run build`                     | PASS   |
| `/Users/ameeramer/.bun/bin/bunx tsx tests/unit/i18n.test.mjs` | PASS   |

## Remaining issues

- Live browser sweep on authenticated member routes still needs manual visual confirmation after deploy for:
  - Hebrew mobile 390px
  - Arabic mobile 390px
  - English desktop parity
- No schema, booking, payment, or receipt logic changed.
