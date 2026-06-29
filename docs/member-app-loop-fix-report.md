# Cloud & Core Member App Loop Fix Report

## Iteration 1

### What was tested

- Temporary authenticated member creation without public signup
- Real member login on local preview
- Member routes:
  - `/member`
  - `/member/schedule`
  - class detail sheet
  - `/member/bookings`
  - `/member/packages`
  - package payment modal
  - `/member/account`
- Languages:
  - Hebrew RTL
  - Arabic RTL
  - English LTR
- Devices:
  - `390 × 844`
  - `820 × 1180`
  - `1440 × 900`

### Bugs found

| ID       | Severity | Route                           | Language                | Device | Issue                                                                                                             | Fix status             |
| -------- | -------- | ------------------------------- | ----------------------- | ------ | ----------------------------------------------------------------------------------------------------------------- | ---------------------- |
| LOOP-001 | Critical | all authenticated member routes | all                     | all    | No confirmed working member credentials were available for authenticated member QA.                               | Fixed                  |
| LOOP-002 | Critical | member shell                    | Arabic, English         | all    | Hydration mismatch on non-default languages because the member shell rendered before client locale state settled. | Fixed                  |
| LOOP-003 | High     | `/member`                       | Hebrew, Arabic          | mobile | Opening notice stayed in raw English: `Official opening: 1.7.2026`.                                               | Fixed                  |
| LOOP-004 | Medium   | `/member/packages`              | Hebrew, English, Arabic | mobile | Package credit bullets used awkward grammar like `1 class credits` / `1 קרדיטים לשיעורים`.                        | Fixed                  |
| LOOP-005 | Medium   | class detail / cancel dialog    | Hebrew                  | mobile | Radix dialog warning for missing description appeared in console.                                                 | Fixed                  |
| LOOP-006 | Medium   | `/receipts/:id`                 | all                     | all    | No receipt exists for the temporary member, so receipt ownership QA could not be completed with this account.     | Open external data gap |

### Fixes made

- Created a temporary tagged member for authenticated QA only:
  - Tag: `QA_MEMBER_SWEEP_20260625T224605Z`
  - Email: `qa.member.sweep+20260625t224605z@example.com`
  - Password: `vlS3rcWLYuHsEic5lw7vA9!`
  - `auth.users.id`: `95dff3d3-6cc5-428d-a29c-72d977f82865`
  - `profiles.id`: `95dff3d3-6cc5-428d-a29c-72d977f82865`
  - `members.id`: `95dff3d3-6cc5-428d-a29c-72d977f82865`
- Added cleanup preview only, not executed:
  - `tmp/member-sweep-cleanup-preview.json`
  - `tmp/member-sweep-cleanup-preview.sql`
- Stabilized member-language hydration by deferring member shell rendering until the client hydration pass completes.
- Persisted language preference to a cookie and guarded cookie writes for non-browser test/runtime environments.
- Localized the opening announcement on member home when the stored studio text matches the launch message.
- Replaced awkward package credit bullet copy with explicit localized member wording.
- Added hidden dialog descriptions so class detail and booking dialogs stop emitting accessibility warnings.

### Files changed

- `src/components/app-shell/AppShell.tsx`
- `src/components/member/ClassDetailSheet.tsx`
- `src/lib/i18n.ts`
- `src/routes/__root.tsx`
- `src/routes/_authenticated/member/bookings.tsx`
- `src/routes/_authenticated/member/index.tsx`
- `src/routes/_authenticated/member/packages.tsx`

### Commands run

| Command                                                       | Result                       |
| ------------------------------------------------------------- | ---------------------------- |
| `curl ... e2e_member@test.local ...`                          | FAIL (`invalid_credentials`) |
| `/Users/ameeramer/.bun/bin/bunx tsc --noEmit`                 | PASS                         |
| `/Users/ameeramer/.bun/bin/bun run build`                     | PASS                         |
| `/Users/ameeramer/.bun/bin/bunx tsx tests/unit/i18n.test.mjs` | PASS                         |

### Browser QA

| Route                              | Device       | Language | Console errors | Overflow | Result |
| ---------------------------------- | ------------ | -------- | -------------- | -------- | ------ |
| `/member`                          | `390 × 844`  | Hebrew   | 0              | No       | PASS   |
| `/member`                          | `390 × 844`  | Arabic   | 0              | No       | PASS   |
| `/member`                          | `390 × 844`  | English  | 0              | No       | PASS   |
| `/member/schedule`                 | `390 × 844`  | Hebrew   | 0              | No       | PASS   |
| `/member/schedule` + detail sheet  | `390 × 844`  | Hebrew   | 0              | No       | PASS   |
| `/member/bookings`                 | `390 × 844`  | Hebrew   | 0              | No       | PASS   |
| `/member/packages`                 | `390 × 844`  | Hebrew   | 0              | No       | PASS   |
| `/member/packages` + payment modal | `390 × 844`  | Hebrew   | 0              | No       | PASS   |
| `/member/account`                  | `390 × 844`  | Hebrew   | 0              | No       | PASS   |
| `/member`                          | `820 × 1180` | Hebrew   | 0              | No       | PASS   |
| `/member/schedule`                 | `820 × 1180` | Hebrew   | 0              | No       | PASS   |
| `/member/packages`                 | `820 × 1180` | Hebrew   | 0              | No       | PASS   |
| `/member`                          | `1440 × 900` | Hebrew   | 0              | No       | PASS   |
| `/member/schedule`                 | `1440 × 900` | Hebrew   | 0              | No       | PASS   |
| `/member/packages`                 | `1440 × 900` | Hebrew   | 0              | No       | PASS   |

### Remaining blockers

- `/receipts/:id` for this temporary member remains unverified because no receipt row exists for this account.
- Booking confirmation / Cloud Card post-book flow was not executed because this temporary member has no credits and no additional member-plan rows were created in this loop.

### QA evidence

- `tmp/member-loop-iteration-1-clean/`
- `tmp/member-loop-iteration-1-verify/`
- `tmp/member-loop-iteration-1-verify/results.json`

### Next loop decision

- Stop because the approved scope for this pass is complete.
- If receipt and post-book confirmation QA are required for this same temporary member, the next step is explicit approval to add only the minimal tagged package/credit data needed, plus cleanup-preview updates before any mutation.

## Iteration 2

### What was tested

- Re-used the same temporary authenticated member:
  - Tag: `QA_MEMBER_SWEEP_20260625T224605Z`
  - Email: `qa.member.sweep+20260625t224605z@example.com`
- Added only the minimal tagged credit/package records required to verify a real booking flow.
- Verified member routes after the real booking completed:
  - `/member`
  - `/member/schedule`
  - class detail sheet
  - booking confirmation / Cloud Card
  - `/member/bookings`
  - `/member/packages`
- Languages:
  - Hebrew RTL
  - Arabic RTL
  - English LTR
- Devices:
  - `390 × 844`
  - `820 × 1180`
  - `1440 × 900`

### Bugs found

| ID       | Severity | Route              | Language       | Device | Issue                                                                                                                                   | Fix status             |
| -------- | -------- | ------------------ | -------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| LOOP-007 | High     | booking flow       | all            | all    | Temporary member had no credits or active plan, so real booking confirmation could not be verified.                                     | Fixed                  |
| LOOP-008 | High     | `/member/packages` | Hebrew, Arabic | mobile | Active plan expiry date rendered in English/US formatting inside RTL member UI.                                                         | Fixed                  |
| LOOP-009 | High     | `/member/packages` | all            | mobile | Tagged QA credit-grant reason leaked into visible member credit history.                                                                | Fixed                  |
| LOOP-010 | Medium   | `/receipts/:id`    | all            | all    | No receipt rows exist in the current database, so authenticated member receipt ownership/view QA is still blocked by missing safe data. | Open external data gap |

### Fixes made

- Added the minimum tagged records required to verify a real member booking without creating fake public sessions:
  - `member_plans.id`: `d3aa59e1-78dc-4a96-993b-34545dc09db1`
  - `credit_transactions.id`: `ecba3d87-e40c-4499-a7eb-62f82799c238` (manual +1 grant)
  - `bookings.id`: `691a2f1f-82cc-41d6-888e-7cf6949ac45c`
  - `attendance_records.id`: `6bbb8812-0319-4caf-b959-080225434642`
  - `credit_transactions.id`: `4435850a-c0bc-4e4c-b9e8-c223065b50ef` (booking -1 deduction)
- Confirmed the real booking flow mutated safe tagged member data only:
  - member `remaining_credits` returned to `0`
  - class open spots dropped from `8` to `7`
  - booking appears on member home Cloud Card
  - booking appears on member bookings list
- Localized active-plan expiry dates with the current app locale instead of default English formatting.
- Replaced visible QA-tag ledger copy with localized member-facing credit history labels.

### Files changed

- `src/lib/i18n.ts`
- `src/routes/_authenticated/member/index.tsx`
- `src/routes/_authenticated/member/packages.tsx`
- `docs/member-app-loop-fix-report.md`
- `tmp/member-sweep-cleanup-preview.json`
- `tmp/member-sweep-cleanup-preview.sql`

### Commands run

| Command                                                       | Result |
| ------------------------------------------------------------- | ------ |
| `/Users/ameeramer/.bun/bin/bunx tsc --noEmit`                 | PASS   |
| `/Users/ameeramer/.bun/bin/bun run build`                     | PASS   |
| `/Users/ameeramer/.bun/bin/bunx tsx tests/unit/i18n.test.mjs` | PASS   |

### Browser QA

| Route              | Device      | Language | Console errors                   | Overflow | Result |
| ------------------ | ----------- | -------- | -------------------------------- | -------- | ------ |
| `/member`          | `390 × 844` | Hebrew   | 0 app errors (`vite` debug only) | No       | PASS   |
| `/member/packages` | `390 × 844` | Hebrew   | 0 app errors (`vite` debug only) | No       | PASS   |
| `/member/bookings` | `390 × 844` | Hebrew   | 0 app errors (`vite` debug only) | No       | PASS   |
| `/member`          | `390 × 844` | Arabic   | 0 app errors (`vite` debug only) | No       | PASS   |
| `/member`          | `390 × 844` | English  | 0 app errors (`vite` debug only) | No       | PASS   |

### Remaining blockers

- `/receipts/:id` remains blocked by missing real receipt data in the current database. No receipt row exists for this temporary member, and the broader database currently has no receipts to use for authenticated member receipt-route verification.
- The member route sweep passed on the verified surfaces, but final release readiness still depends on receipt-route verification once safe receipt data exists.

### QA evidence

- `tmp/member-loop-iteration-2-booking/`
- `tmp/member-loop-iteration-2-post-book/`
- `tmp/member-loop-iteration-2-final/`
- `tmp/member-loop-iteration-2-final/results.json`

### Next loop decision

- Stop because the approved member sweep scope is complete and the remaining blocker is an external data gap, not a UI regression.

## Iteration 3

### What was tested

- Continued the same temporary member sweep with tagged-only package payment data.
- Created a real pending manual package payment through the member package flow.
- Confirmed that payment through the existing hardened receipt RPC.
- Verified direct receipt-route access with the owning member and with a guest.
- Rechecked member packages after payment confirmation.
- Languages and devices used for this pass:
  - Hebrew RTL
  - `390 × 844`

### Bugs found

| ID       | Severity | Route              | Language | Device | Issue                                                                                     | Fix status |
| -------- | -------- | ------------------ | -------- | ------ | ----------------------------------------------------------------------------------------- | ---------- |
| LOOP-011 | High     | `/receipts/:id`    | Hebrew   | mobile | Receipt route was blocked previously only because no real receipt data existed.           | Fixed      |
| LOOP-012 | High     | `/member/packages` | Hebrew   | mobile | Credit history showed raw English activation reason: `plan paid: Single Class`.           | Fixed      |
| LOOP-013 | High     | `/receipts/:id`    | Hebrew   | mobile | Receipt page showed English plan name snapshot and non-localized default date formatting. | Fixed      |

### Fixes made

- Created a real pending manual payment via the member package flow:
  - `payments.id`: `0520e649-e22d-4ae8-ad89-7941c1d4c051`
  - method: `cash`
  - amount: `₪80`
- Confirmed the payment through the existing `confirm_payment_and_issue_receipt` RPC using a real admin profile id already present in the database:
  - actor id: `a5048b14-b8dd-41df-a38c-1b7b716901f0`
  - `receipts.id`: `362b425b-917e-49ed-b9c1-d173428152a2`
  - receipt number: `CC-2026-01008`
  - auto-created `member_plans.id`: `64802333-b6bd-46bd-95d7-f2df06de0f7d`
  - auto-created `credit_transactions.id`: `0c3b3320-354d-4a18-ad19-ed379b8f783b`
- Localized receipt page output:
  - localized plan name from the underlying plan record
  - localized receipt date formatting
  - localized singular credit-grant line
- Localized payment-activation ledger copy in member packages.

### Files changed

- `src/lib/i18n.ts`
- `src/lib/receipts.functions.ts`
- `src/routes/_authenticated/member/packages.tsx`
- `src/routes/_authenticated/receipts/$id.tsx`
- `docs/member-app-loop-fix-report.md`
- `tmp/member-sweep-cleanup-preview.json`
- `tmp/member-sweep-cleanup-preview.sql`

### Commands run

| Command                                                       | Result |
| ------------------------------------------------------------- | ------ |
| `/Users/ameeramer/.bun/bin/bunx tsc --noEmit`                 | PASS   |
| `/Users/ameeramer/.bun/bin/bun run build`                     | PASS   |
| `/Users/ameeramer/.bun/bin/bunx tsx tests/unit/i18n.test.mjs` | PASS   |

### Browser QA

| Route                                                    | Device      | Language | Console errors                   | Overflow | Result |
| -------------------------------------------------------- | ----------- | -------- | -------------------------------- | -------- | ------ |
| `/member/packages` + payment method sheet + submit       | `390 × 844` | Hebrew   | 0 app errors (`vite` debug only) | No       | PASS   |
| `/receipts/362b425b-917e-49ed-b9c1-d173428152a2`         | `390 × 844` | Hebrew   | 0 app errors (`vite` debug only) | No       | PASS   |
| `/receipts/362b425b-917e-49ed-b9c1-d173428152a2` refresh | `390 × 844` | Hebrew   | 0 app errors (`vite` debug only) | No       | PASS   |
| guest direct receipt route                               | `390 × 844` | Hebrew   | 0 app errors (`vite` debug only) | No       | PASS   |
| `/member/packages` after confirmation                    | `390 × 844` | Hebrew   | 0 app errors (`vite` debug only) | No       | PASS   |

### Remaining blockers

- No critical or high member blocker remains in the authenticated member sweep.
- Unauthorized second-member receipt access is still not covered by this temporary single-member sweep because no second approved member account was created in this loop.

### QA evidence

- `tmp/member-loop-iteration-3-receipt/`
- `tmp/member-loop-iteration-3-receipt/member-payment-submit.json`
- `tmp/member-loop-iteration-3-receipt/receipt-route-check.json`
- `tmp/member-loop-iteration-3-receipt/receipt-route-check-post-fix.json`

### Next loop decision

- Stop because the authenticated member critical/high pass is complete and the tagged cleanup preview has been updated for every created row.

## Iteration 4

### What was tested

- Attempted to finish the remaining receipt-security edge case:
  - another signed-in non-owner member tries to open `/receipts/362b425b-917e-49ed-b9c1-d173428152a2`
- Safe sources checked:
  - existing documented seeded member credentials
  - existing current-database member rows
  - existing local storage-state artifacts
- After approval, created one additional tagged non-owner member for receipt RLS verification only:
  - Tag: `QA_MEMBER_SWEEP_RLS_20260626T085419Z`
  - Email: `qa.member.rls+qa_member_sweep_rls_20260626t085419z@example.com`
  - Password: `RlsSweep20260626!Aa7`
  - `auth.users.id`: `f458fbb3-91f0-4612-9713-673429b4428b`
  - `profiles.id`: `f458fbb3-91f0-4612-9713-673429b4428b`
  - `members.id`: `f458fbb3-91f0-4612-9713-673429b4428b`

### Bugs found

| ID       | Severity | Route           | Language | Device | Issue                                                                                     | Fix status |
| -------- | -------- | --------------- | -------- | ------ | ----------------------------------------------------------------------------------------- | ---------- |
| LOOP-014 | High     | `/receipts/:id` | Hebrew   | mobile | Non-owner member stayed on `טוען קבלה…` instead of resolving to a denied/not-found state. | Fixed      |

### Fixes made

- Created one additional tagged non-owner member strictly for receipt RLS browser verification.
- Changed receipt fetching so RLS “no row” returns `null` instead of escalating into a thrown server error.
- Disabled React Query retry on the receipt page so denied/not-found states settle immediately.
- Verified the non-owner member:
  - stays on the same receipt route
  - sees localized not-found copy
  - does not see `CC-2026-01008`
  - gets no console errors

### Files changed

- `src/lib/receipts.functions.ts`
- `src/routes/_authenticated/receipts/$id.tsx`
- `docs/member-app-loop-fix-report.md`
- `tmp/member-sweep-cleanup-preview.json`
- `tmp/member-sweep-cleanup-preview.sql`

### Commands run

| Command                                                        | Result                             |
| -------------------------------------------------------------- | ---------------------------------- |
| anon sign-in check for `e2e_member@test.local` / `E2ePass!23`  | FAIL (`Invalid login credentials`) |
| anon sign-in check for `e2e_member2@test.local` / `E2ePass!23` | FAIL (`Invalid login credentials`) |
| `/Users/ameeramer/.bun/bin/bunx tsc --noEmit`                  | PASS                               |
| `/Users/ameeramer/.bun/bin/bun run build`                      | PASS                               |
| `/Users/ameeramer/.bun/bin/bunx tsx tests/unit/i18n.test.mjs`  | PASS                               |

### Browser QA

| Route                                                                | Device      | Language | Console errors | Overflow | Result |
| -------------------------------------------------------------------- | ----------- | -------- | -------------- | -------- | ------ |
| `/receipts/362b425b-917e-49ed-b9c1-d173428152a2` as non-owner member | `390 × 844` | Hebrew   | 0              | No       | PASS   |

### Remaining blockers

- No critical or high member blocker remains in the authenticated member sweep.

### QA evidence

- `tmp/member-loop-iteration-4-rls/`
- `tmp/member-loop-iteration-4-rls/other-member-receipt-check-fixed.json`

### Next loop decision

- Stop because the authenticated member QA loop acceptance criteria now pass.

## Iteration 5

### What was tested

- Real browser login with the approved temporary member, not storage-state replay only
- Deep-link refresh verification after authenticated login on:
  - `/member/schedule` in Hebrew
  - `/member/schedule` in Arabic
  - `/receipts/362b425b-917e-49ed-b9c1-d173428152a2` in English

### Findings

- The earlier hydration warnings seen during storage-state replay were a test artifact:
  - browser localStorage session existed
  - auth cookie was missing
  - SSR rendered `/auth` first
  - client then rehydrated into the authenticated app
- With a real browser login and cookie-backed authenticated refresh, the routes above load correctly with:
  - 0 console errors
  - 0 hydration errors
  - 0 `getUser()` failed-fetch errors

### Browser QA

| Route                                                                | Device      | Language | Console errors | Overflow | Result |
| -------------------------------------------------------------------- | ----------- | -------- | -------------- | -------- | ------ |
| `/member/schedule` refresh after login                               | `390 × 844` | Hebrew   | 0              | No       | PASS   |
| `/member/schedule` refresh after login                               | `390 × 844` | Arabic   | 0              | No       | PASS   |
| `/receipts/362b425b-917e-49ed-b9c1-d173428152a2` refresh after login | `390 × 844` | English  | 0              | No       | PASS   |

### QA evidence

- `tmp/member-loop-iteration-5-polish/`
- `tmp/member-loop-iteration-5-polish/real-login-results.json`

### Next loop decision

- Stop because authenticated member QA passes with real login, direct route refresh, localized receipt handling, and non-owner receipt protection.

## Iteration 6

### What was tested

- Continued the member polish pass with a real authenticated member session.
- Focused surfaces:
  - `/member/account`
  - `/member/schedule`
  - class detail dialog close control
- Languages:
  - Hebrew RTL
  - Arabic RTL
  - English LTR
- Devices:
  - `390 × 844`
  - `430 × 932`
  - `820 × 1180`
  - `1440 × 900`

### Bugs found

| ID       | Severity | Route               | Language       | Device | Issue                                                                                                                            | Fix status |
| -------- | -------- | ------------------- | -------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| LOOP-015 | Medium   | class detail dialog | Hebrew, Arabic | mobile | Shared dialog wrapper still exposed a hardcoded English `Close` screen-reader label inside localized member class detail sheets. | Fixed      |

### Fixes made

- Added an explicit localized `aria-label` to the member class detail close control.
- Localized the shared dialog close control in the Radix dialog wrapper so Hebrew and Arabic detail sheets no longer expose raw English `Close`.
- Re-verified the remaining member polish surfaces with fresh authenticated browser contexts per language.

### Files changed

- `src/components/member/ClassDetailSheet.tsx`
- `src/components/ui/dialog.tsx`

### Commands run

| Command                                                       | Result |
| ------------------------------------------------------------- | ------ |
| `/Users/ameeramer/.bun/bin/bunx tsc --noEmit`                 | PASS   |
| `/Users/ameeramer/.bun/bin/bun run build`                     | PASS   |
| `/Users/ameeramer/.bun/bin/bunx tsx tests/unit/i18n.test.mjs` | PASS   |

### Browser QA

| Route                              | Device       | Language | Console errors | Overflow | Result |
| ---------------------------------- | ------------ | -------- | -------------- | -------- | ------ |
| `/member/account`                  | `390 × 844`  | Hebrew   | 0              | No       | PASS   |
| `/member/account`                  | `390 × 844`  | Arabic   | 0              | No       | PASS   |
| `/member/account`                  | `1440 × 900` | English  | 0              | No       | PASS   |
| `/member/schedule` + detail dialog | `390 × 844`  | Hebrew   | 0              | No       | PASS   |
| `/member/schedule` + detail dialog | `430 × 932`  | Arabic   | 0              | No       | PASS   |
| `/member/schedule` + detail dialog | `820 × 1180` | English  | 0              | No       | PASS   |

### Remaining blockers

- No critical or high member blocker remains in the authenticated member sweep.
- No remaining member polish blocker was found in the verified account and schedule-detail surfaces.

### QA evidence

- `tmp/member-loop-iteration-6-polish/`
- `tmp/member-loop-iteration-6-polish/results.json`

### Next loop decision

- Stop because the authenticated member loop remains clean after the final localized dialog/detail verification pass.
