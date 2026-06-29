# Cloud & Core Global Label Alignment Regression Fix Report

## Verdict

- Global label/alignment regression fixed: PARTIAL
- Release ready from this pass: NO
- Main blocker: the local production preview was started without Supabase environment variables, so authenticated member child routes redirected back to `/member` during the saved-session browser probe. `/member/schedule`, `/member/bookings`, and `/member/packages` need one more live authenticated verification pass with the real env loaded.

## Scope

No migrations were run.
No database schema changes were made.
No data was created, deleted, or modified.
No auth, booking, payment, receipt, or role logic was changed.

## Files changed

| File                                         | Change                                                                                                                                                                  |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/routes/_authenticated/member/index.tsx` | Removed the Hebrew/Arabic hero exception that split the greeting into separate visual blocks. The greeting now uses one direction-aware, bidi-safe line.                |
| `src/styles.css`                             | Added global RTL/LTR alignment guards for common member/admin/auth label/card/header classes. Replaced the hero greeting bidi behavior with isolated inline-flex spans. |

## Fixes made

| Area                 | Before                                                                                    | After                                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Member hero greeting | Hebrew fallback could render as `חבר/השלום,` or split awkwardly.                          | Hebrew renders as `שלום, חבר/ה`; Arabic renders as `أهلاً، صديق/ة`; English remains `Welcome back, friend`. |
| Hero bidi behavior   | Whole greeting line used `unicode-bidi: plaintext`, allowing punctuation/name reordering. | Prefix and name are isolated spans inside an inline-flex row.                                               |
| RTL/LTR labels       | Some shared page/card/label surfaces could inherit the wrong alignment.                   | Hebrew/Arabic shared labels/cards/headers align right; English aligns left.                                 |
| Chips/card groups    | Shared visual card rows could remain left-biased after language changes.                  | `.class-card-main` and `.lesson-chip-row` justify from the language start side.                             |

## Commands run

| Command                                                                         | Result | Notes                                                           |
| ------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------- |
| `/Users/ameeramer/.bun/bin/bunx tsc --noEmit`                                   | PASS   | No TypeScript errors.                                           |
| `/Users/ameeramer/.bun/bin/bun run build`                                       | PASS   | Production client and server bundles built successfully.        |
| `/Users/ameeramer/.bun/bin/bunx tsx tests/unit/i18n.test.mjs`                   | PASS   | `i18n defaults and catalogs OK`; Node deprecation warning only. |
| `git diff --check -- src/routes/_authenticated/member/index.tsx src/styles.css` | PASS   | No whitespace errors in scoped diff.                            |

## Browser QA

Local production preview:

- URL: `http://127.0.0.1:4174`
- Server: `PORT=4174 /Users/ameeramer/.bun/bin/bun run start`
- Limitation: the preview emitted missing `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` warnings, so authenticated route QA was limited.

| Route              | Device  | Language              | Result   | Notes                                                                                                 |
| ------------------ | ------- | --------------------- | -------- | ----------------------------------------------------------------------------------------------------- |
| `/auth`            | 390x844 | Hebrew                | PASS     | RTL, right-aligned auth labels, no horizontal overflow.                                               |
| `/auth`            | 390x844 | Arabic                | PASS     | RTL, right-aligned auth labels, no horizontal overflow.                                               |
| `/auth`            | 390x844 | English               | PASS     | LTR, left-aligned auth labels, no horizontal overflow.                                                |
| `/member`          | 390x844 | Hebrew                | PASS     | Hero greeting ordering fixed; no `חבר/השלום,`; no horizontal overflow.                                |
| `/member`          | 390x844 | Arabic                | PASS     | RTL root direction and right-aligned member content verified.                                         |
| `/member`          | 390x844 | English               | PASS     | LTR root direction and left-aligned member content verified.                                          |
| `/admin`           | 390x844 | Hebrew                | PASS     | RTL header and admin title alignment verified; no horizontal overflow.                                |
| `/admin/classes`   | 390x844 | Hebrew                | PASS     | Admin route screenshot captured; no horizontal overflow.                                              |
| `/admin/settings`  | 390x844 | Hebrew                | PASS     | Admin route screenshot captured; no horizontal overflow.                                              |
| `/admin/messages`  | 390x844 | Hebrew                | PASS     | Admin route screenshot captured; no horizontal overflow.                                              |
| `/member/schedule` | 390x844 | Hebrew/Arabic/English | NEEDS QA | Local saved member session redirected child routes to `/member`; no data was mutated to resolve this. |
| `/member/bookings` | 390x844 | Hebrew/Arabic/English | NEEDS QA | Same saved-session redirect limitation.                                                               |
| `/member/packages` | 390x844 | Hebrew/Arabic/English | NEEDS QA | Same saved-session redirect limitation.                                                               |

## Evidence

Screenshots:

- `tmp/global-label-alignment-regression-fix/targeted/mobile390-he-member-member.png`
- `tmp/global-label-alignment-regression-fix/targeted/mobile390-ar-member-member.png`
- `tmp/global-label-alignment-regression-fix/targeted/mobile390-en-member-member.png`
- `tmp/global-label-alignment-regression-fix/targeted/mobile390-he-guest-auth.png`
- `tmp/global-label-alignment-regression-fix/targeted/mobile390-ar-guest-auth.png`
- `tmp/global-label-alignment-regression-fix/targeted/mobile390-en-guest-auth.png`
- `tmp/global-label-alignment-regression-fix/targeted/mobile390-he-admin-admin.png`
- `tmp/global-label-alignment-regression-fix/targeted/mobile390-he-admin-admin_classes.png`
- `tmp/global-label-alignment-regression-fix/targeted/mobile390-he-admin-admin_settings.png`
- `tmp/global-label-alignment-regression-fix/targeted/mobile390-he-admin-admin_messages.png`

## Remaining issues

| ID         | Severity | Route/component     | Issue                                                                                                                                                                                                                    | Status                    |
| ---------- | -------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- |
| RTL-QA-001 | High     | Member child routes | Local preview was missing Supabase env vars and saved member session redirected `/member/schedule`, `/member/bookings`, and `/member/packages` back to `/member`, so those pages were not fully reverified in this pass. | Open verification blocker |
| RTL-QA-002 | Medium   | Auth SSR hydration  | Earlier broad sweep captured React minified hydration page errors on `/auth` for Arabic/English production preview, with no console errors. Needs a separate hydration-focused pass if it reproduces.                    | Open verification item    |

## Acceptance status

| Criterion                                      | Status                                                                   |
| ---------------------------------------------- | ------------------------------------------------------------------------ |
| Hebrew pages visually align right              | PARTIAL                                                                  |
| Arabic pages visually align right              | PARTIAL                                                                  |
| English pages visually align left              | PARTIAL                                                                  |
| Root `dir` correct for tested language changes | PASS on focused probes                                                   |
| Member home hero greeting fixed                | PASS                                                                     |
| Stats strip direction on member home           | PASS on `/member` screenshot                                             |
| Class cards/chips direction                    | NEEDS QA on child routes                                                 |
| Forms/labels shared alignment                  | PASS on auth and admin settings screenshots                              |
| Drawer/sidebar direction                       | Previously fixed; not reopened in this focused pass                      |
| Technical values remain LTR                    | Not changed                                                              |
| No horizontal overflow on tested routes        | PASS                                                                     |
| Console errors                                 | PASS on focused screenshots; earlier broad sweep showed 0 console errors |
| Typecheck/build/i18n                           | PASS                                                                     |

## Next step

Run one live authenticated member pass in the browser or local preview with the real Supabase env loaded and verify:

- `/member/schedule`
- `/member/bookings`
- `/member/packages`
- class detail sheet
- package modal

Do not deploy this pass as final release-ready until those member child routes are verified after the saved-session redirect is resolved.
