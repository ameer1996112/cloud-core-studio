# UI Migration Plan

**Status:** Proposed; implementation has not started.

The migration is deliberately incremental. Each phase should ship independently, preserve business logic, and be reversible through small commits. Existing backend behavior, Supabase schema/RLS, payment flow, booking rules, analytics, permissions, and production data remain out of scope.

## Phase 0 — Safe visual test harness

**Likely files:** `tests/e2e/`, new `tests/visual/`, Playwright config, fixture adapters under `src/lib/test-records.ts` or a separate test-only boundary.
**Components:** PublicShell, AppShell, representative state fixtures.
**Risks:** Accidental production connection or mutation.
**Tests:** Environment hard-blocks; verify fixture runner refuses known production IDs; screenshots at six viewports and three languages.
**Rollback:** Remove test-only entry points/config; no production bundle path should depend on them.
**Visual improvement:** None directly; creates reliable baselines.
**UX improvement:** Prevents regressions in critical role/state paths.

Exit criteria: deterministic read-only or mocked states for guest/member/instructor/admin, with no production credentials.

## Phase 1 — Foundation and tokens

**Likely files:** `src/styles/tokens.css`, token portion of `src/styles.css`, Tailwind theme mapping, visual-test baselines.
**Components:** All primitives indirectly.
**Risks:** Broad visual drift; user-owned stylesheet changes; Tailwind v4 alias behavior.
**Tests:** Contrast script, computed-token snapshot, all public route screenshots, build and lint.
**Rollback:** One token-layer commit; retain compatibility aliases for one release.
**Visual improvement:** Consistent color, radius, elevation, and focus.
**UX improvement:** Visible focus and predictable state meaning.

Actions: establish raw/semantic/component layers; implement accessible focus; prohibit gold body text; define status roles; collapse radius/elevation scales; mark legacy aliases deprecated.

## Phase 2 — Typography and localization

**Likely files:** `src/lib/i18n.ts` or split locale modules, `src/routes/__root.tsx`, font imports/loading, `src/components/ui/bidi.tsx`, public routes with hardcoded direction/copy.
**Components:** Typography utilities, locale switcher, bidi values.
**Risks:** Flash of wrong language, hydration mismatch, font metric shifts, translation gaps.
**Tests:** HE/AR/EN route matrix, SSR/client language agreement, 200% zoom, long strings, mixed values, font-loading/LCP test.
**Rollback:** Preserve current combined dictionary and Google Fonts link behind a short-lived flag.
**Visual improvement:** Stable typography and intentional Arabic/Hebrew.
**UX improvement:** Language control and error recovery are consistent everywhere.

Actions: split dictionaries by locale/route, self-host subset fonts, localize root errors, replace hardcoded RTL on public microsites, formalize date/time/number/currency helpers.

## Phase 3 — Primitive components

**Likely files:** `src/components/ui/button.tsx`, `input.tsx`, `textarea.tsx`, `select.tsx`, `dialog.tsx`, `sheet.tsx`, `badge.tsx`, `table.tsx`, `skeleton.tsx`, form wrappers.
**Components:** Buttons, icon buttons, fields, dialogs, sheets, badges, tables, loading states.
**Risks:** Route-level overrides may fight new primitives.
**Tests:** Story/state matrix; keyboard navigation; focus trap/return; disabled/loading/error; touch target measurement; axe.
**Rollback:** Keep legacy CSS utilities mapped to old tokens until route migration completes.
**Visual improvement:** Unified control proportions and interaction states.
**UX improvement:** Clearer actions, focus, errors, and loading feedback.

## Phase 4 — Navigation and app shell

**Likely files:** `src/components/app-shell/AppShell.tsx`, `useRoleNav.ts`, `src/routes/__root.tsx`, new PublicShell, legal language switcher, auth/schedule headers.
**Components:** Desktop sidebar, mobile drawer, bottom navigation, public header, language control, toast region.
**Risks:** Content hidden by fixed navigation; role permission regressions; safe-area issues.
**Tests:** Route guards, keyboard drawer, focus restoration, 360/390/430/768/1024/1440, safe-area simulation, 200% zoom.
**Rollback:** Retain old shell as a route-level fallback for one release.
**Visual improvement:** One recognizable product shell.
**UX improvement:** Stable navigation and locale access across roles.

## Phase 5 — Member booking journey

**Likely files:** `src/routes/member.schedule.tsx`, authenticated member routes, `ClassDetailSheet.tsx`, `PremiumClassCard.tsx`, `VisualClassCard.tsx`, schedule filter panel, booking functions only at their presentation boundary.
**Components:** Schedule, filter, class card, detail, booking/waitlist/cancellation confirmations, empty/error/offline states.
**Risks:** Accidental booking-rule change; duplicate submits; stale availability.
**Tests:** Available/full/waitlist/ineligible, double-click, stale seat, cancellation cutoff, slow/offline, expired session, success announcement, credit delta, three languages, mobile/desktop.
**Rollback:** Presentation-only commits; preserve existing RPC calls and data contracts.
**Visual improvement:** Calm, consistent journey from schedule to confirmation.
**UX improvement:** Price/credit/eligibility/consequence understood before action.

## Phase 6 — Membership and payments

**Likely files:** member packages, checkout, payment-result, receipts, plan display helpers.
**Components:** Package card, credit balance, checkout summary, consent, payment status, receipt.
**Risks:** Trust/copy changes misrepresent provider behavior; currency formatting.
**Tests:** Success/pending/failed/cancelled, zero/low/unlimited credits, receipt permissions, RTL currency, provider-return URLs; no live charges.
**Rollback:** Keep provider and server code untouched; revert UI layer/copy only.
**Visual improvement:** One payment/membership status language.
**UX improvement:** Clear value, price, credits, provider status, and recovery.

## Phase 7 — Instructor experience

**Likely files:** instructor route, attendance components/shared roster pieces, AppShell role navigation.
**Components:** Upcoming class, participant list, attendance control, empty/loading/error.
**Risks:** Attendance mutation or permission regression.
**Tests:** Instructor-only access, large rosters, no-show/present toggles in disposable test data, offline/retry, mobile touch targets.
**Rollback:** Route-level presentation commits; do not change RLS/RPC behavior.
**Visual improvement:** Focused operational workspace.
**UX improvement:** Faster attendance with fewer ambiguous states.

## Phase 8 — Admin experience

**Likely files:** all admin routes, `admin-shared`, class danger zone, roster drawer, Studio Pulse, messaging/delivery components.
**Components:** Page shell, metrics, table/card responsive pattern, form, destructive dialog, audit history.
**Risks:** Dense workflows, destructive operations, role leakage, performance of reports/messages.
**Tests:** Admin permissions, mobile table alternatives, keyboard data entry, long translations, destructive confirmation, pagination/filter persistence, route chunk budgets.
**Rollback:** Migrate one route family per commit; retain old table layouts behind component boundary during rollout.
**Visual improvement:** Consistent information density and hierarchy.
**UX improvement:** Faster scanning, safer destructive actions, better mobile administration.

## Phase 9 — Accessibility hardening

**Likely files:** all shared primitives/shells, route landmarks/headings, live-region helpers, test suite.
**Components:** Focus, error summary, dialogs, toasts, tables, charts, authentication.
**Risks:** Over-announcement, focus jumps, conflicts with native Radix behavior.
**Tests:** axe, keyboard scripts, VoiceOver manual runbook, 200%/400% zoom where applicable, reduced motion, high contrast, focus order and return.
**Rollback:** Fix by component; never disable the whole accessibility layer.
**Visual improvement:** Strong consistent focus and legible status colors.
**UX improvement:** WCAG 2.2 AA task completion for keyboard/screen-reader/low-vision users.

## Phase 10 — Performance

**Likely files:** router imports, locale modules, reports/messages routes, CSS entry points, image/font loading, query boundaries.
**Components:** Route loaders, skeletons, responsive images, charts/reports.
**Risks:** Loading flashes, chunk waterfalls, stale query behavior.
**Tests:** production Lighthouse, bundle analyzer/budgets, route transition timings, React render profiling, slow 4G, repeat/cold cache.
**Rollback:** One optimization per commit with before/after artifact; revert if clarity or reliability degrades.
**Visual improvement:** Less font swap/layout delay.
**UX improvement:** Faster first content, class discovery, and admin interaction.

Targets: LCP <2.5 s, CLS <0.1, INP <200 ms in representative field/lab testing; initial route JS and global CSS budgets defined before coding.

## Phase 11 — Visual regression and governance

**Likely files:** visual test configuration, route-state manifest, CI workflow, contribution/design docs.
**Components:** All migrated components/routes.
**Risks:** Noisy snapshots, fixture drift, excessive CI time.
**Tests:** Required route-state matrix by risk tier; pixel thresholds plus semantic assertions; screenshot naming validation.
**Rollback:** Quarantine only demonstrably flaky cases with owner/expiry; retain stable smoke suite.
**Visual improvement:** Stops cross-route drift.
**UX improvement:** Prevents recurrence of missing, untranslated, obscured, or ambiguous states.

## Release order and gates

1. Build safe fixtures.
2. Land tokens/focus/contrast.
3. Land typography/localization/public shell.
4. Migrate primitives.
5. Migrate member booking and payments.
6. Migrate instructor, then admin by route family.
7. Complete accessibility/performance hardening.
8. Make visual matrix and budgets required in CI.

Every phase must pass `bun run lint`, `bun run build`, relevant unit/E2E tests, and its visual/accessibility subset. No phase may require production data or loosen authorization.

## Recommended first implementation ticket

Create the safe visual fixture harness and semantic foundation together as two reviewable commits. The first proves states without production; the second adds accessible focus, text-safe color roles, and a compatibility mapping. This is the highest-leverage, lowest-behavior-risk start.
