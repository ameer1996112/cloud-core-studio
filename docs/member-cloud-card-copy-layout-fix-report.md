# Cloud & Core Member Cloud Card Copy/Layout Fix Report

## Files changed

- `src/routes/_authenticated/member/index.tsx`
- `src/lib/i18n.ts`
- `src/styles.css`

## Copy changes

- Replaced Hebrew `Cloud Card שלך` with `כרטיס השיעור שלך`.
- Replaced Arabic mixed Cloud Card copy with `بطاقة الحصة`.
- Added a small helper label for Cloud Card branding instead of mixing it into the main sentence.
- Replaced the technical calendar helper text with calmer copy:
  - Hebrew: `נפתח את היומן כדי לשמור את השיעור.`
  - Arabic: `سنفتح التقويم لحفظ الحصة.`
  - English: `We’ll open your calendar to save the class.`

## Cloud Card layout changes

- Hero now emphasizes the branded class name only, such as `Elevate Flow`.
- Localized program, instructor, duration, credit cost, and cancellation policy moved below the image into clean structured rows.
- Cancellation policy is now in a calm secondary info box.
- Calendar and bookings actions are now proper button-style CTAs.

## RTL/LTR handling

- Card root uses the active language direction.
- Hebrew/Arabic details and actions align to the right.
- English remains left-aligned.
- Mixed English class names are isolated with `bdi`.
- Time/date values remain stable through `LtrInline`.

## Add-to-calendar UX

- Calendar action remains the existing `.ics` download behavior.
- The success toast now uses user-friendly copy instead of technical file language.

## Responsive QA

- Local production build passed.
- Live browser QA was not run with authenticated member state in this turn.

## Commands run

| Command                                                       | Result |
| ------------------------------------------------------------- | ------ |
| `/Users/ameeramer/.bun/bin/bunx tsc --noEmit`                 | PASS   |
| `/Users/ameeramer/.bun/bin/bun run build`                     | PASS   |
| `/Users/ameeramer/.bun/bin/bunx tsx tests/unit/i18n.test.mjs` | PASS   |

## Remaining issues

- Authenticated visual confirmation should be checked on `/member` after deployment using a member account.
