# Cloud & Core Member Time/Duration Badge RTL Fix Report

## Files changed

- `src/components/visual/VisualClassCard.tsx`
- `src/styles.css`

## Fix summary

- Replaced the implicit divider effect in the member class time badge with a structured separator element.
- The badge now renders:
  - time span
  - middle dot separator
  - duration span
- The badge container keeps `dir="ltr"` so numeric time always leads.
- The duration span uses isolated bidi behavior so Hebrew and Arabic duration labels stay stable.

## Result

- Hebrew target: `12:00 · 45 דק׳`
- Arabic target: `12:00 · 45 دقيقة`
- English target: `12:00 · 45 min`

## Bidi / layout changes

- Removed the old visual divider behavior from the duration span.
- Added `.class-time-badge__separator` with `·`
- Added `direction: ltr` to the badge container
- Added `unicode-bidi: isolate` to the duration span

## Surfaces covered

- `/member`
- `/member/schedule`
- shared member image-led lesson cards using `VisualClassCard`

## Evidence

- User screenshot showing the bug:
  - `/tmp/codex-remote-attachments/019efab7-df80-7db3-9636-aa7b3720d78c/E141A6FE-B116-4343-9220-CE3828DE7C7D/1-Photo-1.jpg`

## Commands run

| Command                                                       | Result |
| ------------------------------------------------------------- | ------ |
| `/Users/ameeramer/.bun/bin/bunx tsc --noEmit`                 | PASS   |
| `/Users/ameeramer/.bun/bin/bun run build`                     | PASS   |
| `/Users/ameeramer/.bun/bin/bunx tsx tests/unit/i18n.test.mjs` | PASS   |

## QA notes

- Code-level verification passed.
- Manual browser sweep on mobile/iPad/desktop was not rerun in this pass.

## Remaining issues

- No schema or business logic changes.
- If you want this live immediately, the next step is a production deploy.
