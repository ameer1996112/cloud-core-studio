# UI Migration Plan — Final Implementation Status

**Original plan:** 2026-08-28

**Final status:** Implemented through the documented local fixture gate; release remains blocked by seven explicit deductions. Final score: **92/100**.
**Scope boundary:** presentation, styles, localization, accessibility, fixtures, and performance evidence only. Backend behavior, Supabase schema/RLS, booking/payment rules, permissions, analytics, and production data were unchanged.

## Phase status

| Phase | Status | Implemented outcome | Evidence |
|---|---|---|---|
| 0 — Safe visual harness | Partial visual coverage | The guarded, read-only harness fails closed on production/remote configuration. Its 288 screenshots cover 16 public/guest surfaces; protected-role adapters provide nonvisual evidence, not direct route captures. | `tests/unit/uiAuditConfig.test.ts`, `tests/unit/uiAuditManifest.test.ts`, `artifacts/ui-audit/final/capture-manifest.json` |
| 1 — Foundation and tokens | Complete with compatibility debt | Semantic text/surface/action/state/focus/motion roles implemented; legacy aliases retained under executable contract. | `tests/unit/designTokenContract.test.ts`, `tests/unit/styleContract.test.ts` |
| 2 — Typography and localization | Complete with one production-audit blocker | Local fonts, role namespace splitting, root recovery, HE/AR/EN copy, and bidi boundaries implemented. Full Lighthouse stops because `home-ar` renders Hebrew. | `tests/unit/i18nNamespaces.test.ts`, `tests/unit/bidiRouteCoverage.test.ts`, final manifest |
| 3 — Primitive components | Complete | Action, field, selection, async, dialog, sheet, table/list, and toast contracts include target, focus, label, state, and focus-return semantics. | `tests/unit/primitiveAccessibility.test.mjs`, `tests/unit/compositeAccessibility.test.mjs` |
| 4 — Navigation and shell | Complete | Public routes share `PublicShell`; authenticated navigation localizes controls, clears fixed navigation, and restores drawer focus. | `tests/unit/publicRouteShells.test.mjs`, `tests/unit/authenticatedShellAccessibility.test.mjs` |
| 5 — Member booking | Complete at presentation boundary | Schedule, filter, class detail, booking/waitlist/eligibility/cancellation, empty/error/offline/session outcomes use existing production logic with deterministic props. | `tests/unit/bookingViewState.test.ts`, `tests/unit/guestScheduleGuestHandoff.test.mjs`, interaction artifact |
| 6 — Membership and payments | Complete at presentation boundary | Package, credits, payment success/failure/pending, receipt and account outcomes are explicit and localized; providers/server actions unchanged. Direct authenticated route screenshots remain blocked. | `tests/unit/memberAccountViewState.test.ts`, interaction and VoiceOver adapter evidence |
| 7 — Instructor | Complete at presentation boundary; visual coverage open | Upcoming class, roster/attendance, localized statuses, and recovery are tested without mutation. No direct authenticated instructor screenshot is claimed. | `tests/unit/attendanceViewState.test.ts`, `tests/unit/adminAttendanceRoster.test.tsx`, interaction/VoiceOver adapters |
| 8 — Admin | Complete at presentation boundary; visual coverage open | Shared hierarchy, responsive alternatives, states, and safe destructive dialogs are source/adapter tested. No direct authenticated admin screenshot is claimed. | `tests/unit/adminUiContracts.test.mjs`, `tests/unit/adminUiFixRound1.test.tsx`, `tests/unit/adminUiFixRound2.test.tsx` |
| 9 — Accessibility | Complete with one moderate finding | Keyboard/activation, dialogs, focus surfaces, 200%/400%, reduced motion, forced colors, VoiceOver, and status semantics pass. App marketing retains 18 moderate `landmark-unique` findings. | `tests/unit/accessibilityEvidence.test.ts`, final accessibility/interaction artifacts |
| 10 — Performance | Partial; release blocker | Compressed serving, role CSS ownership, module provenance, raw/gzip budgets, CLS, and <200 ms interactions pass. Valid HE LCP fails at 4,386/4,202/5,447 ms. | `tests/unit/performanceBudget.test.ts`, final bundle/Lighthouse artifacts |
| 11 — Visual regression and governance | Partial by role | All 319 scenarios have dispositions; 16 public/guest surfaces produce 288 captures and scans. The 170 protected-runtime states remain nonvisual/blocked. | `docs/design/visual-regression-results.md`, final artifacts |

## Implemented release order

The implementation followed the planned dependency order:

1. isolated fixture safety;
2. semantic tokens, focus, and contrast;
3. localized fonts, catalogs, bidi, and root recovery;
4. primitive and composite state semantics;
5. public/authenticated shell ownership;
6. member booking/payment/account presentations;
7. instructor/admin presentation contracts;
8. CSS ownership/cascade and bundle enforcement;
9. full visual, accessibility, VoiceOver, and interaction evidence;
10. final rescore and artifact publication.

Each product change remained presentation-only. Audit adapters import real production components/functions and deterministic records; they do not replace runtime routes or mutate external state.

## Compatibility removal plan

| Debt | Owner | Required proof before removal | Review date |
|---|---|---|---|
| Base-only `src/styles.css` entry and legacy `--color-*`/spacing/radius/shadow aliases | UI platform + design system | style contract, cascade equivalence, 288 captures, interactions, build | 2026-10-15 |
| Misnamed `--color-blue` alias | Design system | zero-consumer search plus style/full suite | 2026-09-30 |
| 34 frozen `!important` declarations | UI platform + route owners | remove one bounded recipe at a time; update baseline only with visual/cascade proof | 2026-09-30 |
| Global 9/10/11 px mobile microcopy floor | Route-family owners | migrate every source label to `meta`/`label` roles; confirm six viewports and reflow | 2026-09-30 |
| Legacy radius/elevation selectors | UI platform | zero legacy consumers and unchanged computed-cascade baseline | 2026-10-15 |

Compatibility debt cannot be closed by deleting a baseline or weakening a contract. Each removal must demonstrate equal or better computed presentation and accessibility.

## Open release work

### 1. Registration task priority

Move the registration CTA above the initial fold or otherwise make the primary next action immediately visible at 390×844, then add precise viewport evidence without obscuring required form content.

### 2. Protected-role responsive visual coverage

Use an approved disposable authenticated environment to capture member, instructor, and admin route states at the agreed role-responsive viewports. The current 288-image matrix is public/guest only; the 170 protected-runtime dispositions remain blocked and QA-01 remains open.

### 3. Local-production LCP

The original Task 14 checkpoint was 4,842 ms home, 4,279 ms auth, and 5,605 ms schedule. The final valid HE diagnostic improved to 4,386/4,202/5,447 ms, but all remain above 2,500 ms. Bundle budgets already pass, and Task 14 traces ruled out speculative route/admin splits. The next change must be justified by a fresh trace and must preserve SSR, auth restoration, visual clarity, and accessibility.

### 4. Arabic root navigation validity

The final full Lighthouse command passed the intended Hebrew home/auth DOM, then stopped because `home-ar` reported Hebrew document language. Reproduce in the local production server, correct cookie/redirect/document-language propagation, add a focused regression, then rerun all nine public cases.

### 5. App-marketing landmark identity

Axe records `landmark-unique` on `.app-marketing__screens-section` in all 18 language/viewport combinations. Give repeated regions distinct accessible names or remove the redundant landmark role, then rerun all 288 axe scans and the manual navigation journey.

### 6. Source microcopy migration

The global mobile floor still compensates for `text-[9px]`, `text-[10px]`, and `text-[11px]` consumers. Migrate the source labels by route family and remove the selectors only after the cascade, capture, reflow, and interaction gates remain green.

### 7. Compatibility alias and baseline removal

Retire the time-boxed legacy color/spacing/type/radius/shadow aliases, approved `!important` baseline, and radius/elevation cascade winners only after zero-consumer searches and unchanged computed-cascade, capture, interaction, lint, and build evidence. Do not delete the baselines to manufacture a pass.

## Final local gate

| Gate | Final result |
|---|---|
| `bun test tests/unit tests/integration` | 998 pass, 6 environment-gated skip, 0 fail across 144 files |
| `bun run lint` | pass, 0 errors, 748 existing warnings |
| `bun run build` | pass |
| `bun run ui-audit:validate` | 319 scenarios valid |
| `bun run ui-audit:capture` | 288/288 captures |
| `bun run ui-audit:a11y` | 288 scans, 0 serious/critical, 18 moderate |
| `bun run ui-audit:bundle` | pass |
| `bun run ui-audit:interactions` | 48/48 rows, 21/21 AT semantics, all representative flows <200 ms |
| `bun run ui-audit:lighthouse` | fail: Arabic language validity in full run and LCP in valid HE diagnostic |

Six skipped tests require explicit real-database integration environments. They were neither force-enabled nor replaced with weaker fixtures. No staging/deployment run occurred.

## Release and rollback rules

- The current UI commits remain small and presentation-scoped; rollback by the component/route/style-owner commit, not by weakening the shared contract.
- Preserve RPCs, server functions, provider callbacks, RLS, role checks, and business-state derivation.
- Do not point visual/interaction fixtures at production services.
- Do not relabel the local gate as staging, waive the LCP limit, suppress moderate axe findings, or convert environment-gated skips into passes.
- Publish a higher score only after final artifacts prove the deduction is removed.

## Exit status

The migration implementation is finished for its approved presentation scope, but protected-role visual verification remains incomplete. The release gate is **blocked** and the final audit score is **92/100**. The seven open items above reconcile one-for-one with the seven scored category deductions; six environment-gated skips and 748 existing lint warnings remain separately disclosed tooling limitations.
