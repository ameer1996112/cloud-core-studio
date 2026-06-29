# Cloud & Core Member Card RTL Alignment Fix Report

## Verdict

- Member session card RTL alignment fixed: YES
- Hebrew cards visually RTL/right-aligned: YES
- Arabic cards visually RTL/right-aligned: YES
- English cards remain LTR/left-aligned: YES
- Migrations/schema changes run: NO
- Booking/payment/auth business logic changed: NO

## Files changed

| File                                        | Change                                                                                                                                                                                                |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/visual/VisualClassCard.tsx` | Added language-aware `dir`/`is-rtl`/`is-ltr` state to shared visual session cards and mini cards; rendered mixed lesson titles through bidi-safe parts; localized chip metadata and instructor names. |
| `src/styles.css`                            | Added direction-aware card content alignment, title alignment, chip flow, instructor alignment, and RTL time-badge placement.                                                                         |
| `src/lib/i18n.ts`                           | Hardened stored-language reading and stopped mutating `<html>` before hydration.                                                                                                                      |
| `src/routes/__root.tsx`                     | Deferred applying saved language until after initial hydration, preventing non-Hebrew hydration errors during browser QA.                                                                             |

## RTL/LTR card behavior

| Language | Expected                                                        | Verified |
| -------- | --------------------------------------------------------------- | -------- |
| Hebrew   | Card `dir=rtl`, title right, chips from right, instructor right | PASS     |
| Arabic   | Card `dir=rtl`, title right, chips from right, instructor right | PASS     |
| English  | Card `dir=ltr`, title left, chips from left, instructor left    | PASS     |

## Mixed title and chip evidence

| Language | Title                         | Chips                                            | Instructor       |
| -------- | ----------------------------- | ------------------------------------------------ | ---------------- |
| Hebrew   | `Elevate Flow — יוגה אווירית` | `יוגה אווירית`, `מתחילות–בינוניות`, `שיעור זורם` | `יארין שובאש`    |
| Arabic   | `Elevate Flow — يوغا هوائية`  | `يوغا هوائية`, `مبتدئات–متوسط`, `حصة انسيابية`   | `يارين شوباش`    |
| English  | `Elevate Flow — Aerial Yoga`  | `Aerial Yoga`, `Beginner–Intermediate`, `Flow`   | `Yareen Shobash` |

## Commands run

| Command                                                       | Result | Notes                                      |
| ------------------------------------------------------------- | ------ | ------------------------------------------ |
| `/Users/ameeramer/.bun/bin/bunx tsc --noEmit`                 | PASS   | Typecheck clean.                           |
| `/Users/ameeramer/.bun/bin/bun run build`                     | PASS   | Production client and SSR build completed. |
| `/Users/ameeramer/.bun/bin/bunx tsx tests/unit/i18n.test.mjs` | PASS   | Catalog/default checks clean.              |

## Browser QA

| Route              | Languages               | Devices                              | Result |
| ------------------ | ----------------------- | ------------------------------------ | ------ |
| `/member`          | Hebrew, Arabic, English | 390x844, 430x932, 820x1180, 1440x900 | PASS   |
| `/member/schedule` | Hebrew, Arabic, English | 390x844, 430x932, 820x1180, 1440x900 | PASS   |

Automated browser QA result:

- Checks: 36
- Failures: 0
- Console/page errors: 0 material errors
- Horizontal overflow: NO
- Raw technical metadata in Hebrew/Arabic: NO

Evidence:

- `tmp/member-card-rtl-alignment/browser-qa.json`
- `tmp/member-card-rtl-alignment/he-phone390-_member.png`
- `tmp/member-card-rtl-alignment/ar-phone390-_member.png`
- `tmp/member-card-rtl-alignment/en-phone390-_member.png`
- `tmp/member-card-rtl-alignment/he-phone390-_member_schedule.png`
- `tmp/member-card-rtl-alignment/ar-phone390-_member_schedule.png`
- `tmp/member-card-rtl-alignment/en-phone390-_member_schedule.png`

## Remaining issues

None found in the targeted member session card RTL/LTR sweep.
