# Cloud & Core Release Blocker Fix Report

## Verdict

- Blockers fixed: YES
- Release ready: NO

This fixes the Critical/High blockers from the controlled current-DB QA. It does not make the app final release-ready because final release readiness still requires the clean staging/release DB gate.

## Files Changed

- `src/lib/route-guards.ts`
- `src/lib/auth-redirect.ts`
- `src/routes/auth.tsx`
- `src/routes/index.tsx`
- `src/routes/_authenticated/route.tsx`
- `src/routes/_authenticated/admin/route.tsx`
- `src/routes/_authenticated/member/route.tsx`
- `src/routes/_authenticated/instructor/route.tsx`
- `src/routes/_authenticated/instructor/index.tsx`
- `src/components/admin/ClassRosterDrawer.tsx`
- `tests/e2e/playwright-routing.py`
- `docs/release-blocker-fix-report.md`

## Fixes

### 1. `/auth` Hydration Mismatch

- Root cause: `/auth` and the authenticated route group were client-only route boundaries. Cold guest redirects from `/admin` to `/auth` caused the server to hydrate a route Suspense placeholder while the client rendered the auth page.
- Fix implemented: removed the client-only route flags from `/auth` and `/_authenticated` so the initial route tree is deterministic. Auth page language remains SSR-stable with Hebrew default and client language restoration after hydration.
- Tests performed: targeted browser QA opened/refreshed `/auth` in Hebrew, Arabic, and English.
- Result: PASS. Targeted rerun captured 0 hydration mismatch console errors.

### 2. Admin Route Role Guard

- Root cause: role checks were split across parent/child routes and still depended on repeated `getUser()` calls. Unauthorized roles could remain on `/admin` in browser navigation.
- Fix implemented: added centralized `requireAuthenticatedRoute()` and `requireRouteRole()` guards. Admin, member, and instructor route groups now explicitly enforce allowed roles and redirect unauthorized users to their own home route.
- Tests performed: guest/member/instructor/admin direct `/admin`, plus refresh-after-direct-navigation checks.
- Result: PASS. Guest -> `/auth`, member -> `/member`, instructor -> `/instructor`, admin stays on `/admin`.

### 3. Repeated Supabase `getUser()` Failed Fetch Errors

- Root cause: normal browser route navigation repeatedly called network-backed `supabase.auth.getUser()` in route guards and display helpers.
- Fix implemented: replaced app `auth.getUser()` calls with `auth.getSession()` for browser-side routing/display, then profile lookup for role. This avoids uncontrolled Auth network calls during route transitions while preserving database/RLS enforcement.
- Tests performed: targeted browser QA and source search.
- Result: PASS. `rg "auth\\.getUser\\(" src` returns no app calls. Targeted browser rerun captured 0 repeated `getUser`/`Failed to fetch` console errors.

## Commands Run

| Command                                                 | Result |
| ------------------------------------------------------- | -----: |
| `bunx tsc --noEmit`                                     |   PASS |
| `bun run build`                                         |   PASS |
| `bunx tsx tests/unit/i18n.test.mjs`                     |   PASS |
| `python3 -m py_compile tests/e2e/playwright-routing.py` |   PASS |

## Browser Regression Results

Evidence: `tmp/release-blocker-fix-qa/targeted-browser-qa-rerun.json`

| Flow                          | Role         | Language | Route                     | Result | Console errors |
| ----------------------------- | ------------ | -------- | ------------------------- | -----: | -------------: |
| Auth render/refresh           | guest        | Hebrew   | `/auth`                   |   PASS |              0 |
| Auth render/refresh           | guest        | Arabic   | `/auth`                   |   PASS |              0 |
| Auth render/refresh           | guest        | English  | `/auth`                   |   PASS |              0 |
| Direct admin access           | guest        | Hebrew   | `/admin` -> `/auth`       |   PASS |              0 |
| Direct admin access           | member       | Hebrew   | `/admin` -> `/member`     |   PASS |              0 |
| Refresh after admin redirect  | member       | Hebrew   | `/admin` -> `/member`     |   PASS |              0 |
| Direct admin access           | instructor   | Hebrew   | `/admin` -> `/instructor` |   PASS |              0 |
| Refresh after admin redirect  | instructor   | Hebrew   | `/admin` -> `/instructor` |   PASS |              0 |
| Direct admin access           | admin        | Hebrew   | `/admin`                  |   PASS |              0 |
| Refresh admin page            | admin        | Hebrew   | `/admin`                  |   PASS |              0 |
| Hydration console check       | all targeted | mixed    | auth/admin routes         |   PASS |              0 |
| `getUser` fetch console check | all targeted | mixed    | protected routes          |   PASS |              0 |
| Role guard console check      | all targeted | mixed    | protected routes          |   PASS |              0 |

Targeted browser summary: 13 passed, 0 failed, 0 console events.

## Remaining Bugs

No Critical/High blocker remains from this targeted fix pass.

Remaining release caveat: Cloud & Core is still not final production release-ready until the clean staging/release database QA gate is completed.
