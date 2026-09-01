# Milestone 2 authenticated QA — automated results

Date: 2026-09-01

## Safe target

- Target type: local Supabase running on loopback only.
- App target: `127.0.0.1` loopback QA server.
- Remote Supabase hosts and the two repository-blocked project references were not used.
- The QA server rejects a non-local Supabase URL and requires unconfigured HYP test mode.

## Executed browser smoke

`APP_BASE_URL=http://127.0.0.1:4176 node tests/e2e/member-ui-ux-milestone-2.spec.mjs`

Result: **pass**.

- The fake fixture authenticated through the rendered `/auth` password form; no injected React state or hidden login route was used.
- `/member/packages` remained on its protected route.
- `/member/account` remained on its protected route.
- `/checkout` loaded normally after authentication.
- Final local loaded-data probe: **pass**. After the QA-only alias adapter supplied `SUPABASE_PUBLISHABLE_KEY` before the server bundle imported, both deterministic fixture package names and the fake member profile visibly rendered. Evidence: `screenshots/after/milestone-2-authenticated-complete/`.
- This does not establish the uncompleted intercepted mutation matrix or manual accessibility matrix.
- Screenshots were captured at 390 × 844: `../screenshots/after/milestone-2-authenticated/`.

## Not yet executed

- Payment-session interception, loading/error/retry and duplicate-activation assertions.
- Deletion-request interception, loading/success/error/retry and focus assertions.
- Arabic/Hebrew authenticated flows, responsive matrix, automated axe, browser zoom, and manual screen-reader checks.

These omissions mean this is route/authentication evidence only; it does **not** close P2-02 or P2-03.

## Regression commands

- `bun test tests/unit tests/integration` — **651 pass, 6 skipped, 0 fail** (657 tests; 5,008 expectations).
- `bun run lint` — **pass**.
- `bun run build` — **pass** (existing TanStack deprecation warnings).
- `bunx tsc --noEmit --pretty false` — exits nonzero with **67** existing diagnostics; before and after authenticated QA both contain 67. No TypeScript diagnostics are reported in the new QA files.
