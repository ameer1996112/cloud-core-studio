# Cloud & Core Studio UI/UX Audit — Final Local Gate

**Original audit:** 2026-08-28

**Final local gate:** 2026-08-30

**Status:** Remediation implemented and locally verified for the documented fixture scope; release remains blocked by seven explicit score deductions.
**Final score:** **92/100** (up from 75/100; not a staging or 100/100 claim)

## Executive summary

The remediation replaced the audit-only/static review with isolated, production-backed UI fixtures without accounts, backend writes, or production data. The final matrix contains **16 visual product surfaces** and 288 HE/AR/EN screenshots at six viewports; every screenshot filename is public/guest. It also records **303 nonvisual state dispositions** (77 static, 56 redirected, and **170 protected-runtime blocked states**), runs 288 axe scans, checks 48 interaction scenario/locale rows, and correlates 21 parent-operated VoiceOver journeys. Production-backed member, instructor, and admin adapters exercise selected semantics and interactions, but they are not direct authenticated route screenshots.

The design, interaction, localization, responsive, bundle, CLS, and serious/critical accessibility gates are supported by final artifacts. The project is not scored 100/100 because:

- valid local-production mobile LCP remains over the strict 2,500 ms budget: home 4,386 ms, auth 4,202 ms, schedule 5,447 ms;
- the full production Lighthouse matrix passed `home-he`, then failed closed because `home-ar` rendered `html[lang=he]` instead of Arabic;
- axe records 18 moderate `landmark-unique` findings on the app-marketing screens region across three languages and six viewports, while serious/critical findings remain zero;
- the registration CTA remains below the initial 390×844 viewport, and direct protected-role responsive screenshots remain unavailable;
- compatibility aliases/baselines and the 9/10/11 px source microcopy floor remain governed removal work;
- six real-database integration tests remain environment-gated and lint retains 748 existing warnings.

No staging run was performed. The root environment was loaded read-only for the local production audit and was not copied, printed, changed, or committed.

## Final score breakdown

| Category | Score | Evidence and remaining deduction |
|---|---:|---|
| UX clarity and task flow | 19/20 | Production-backed task journeys have deterministic interaction evidence, but the registration CTA remains below the initial 390×844 viewport. |
| Visual hierarchy and typography | 14/15 | Six-viewport captures and the style contract verify the hierarchy, but the compatibility layer still compensates for source `text-[9px]`, `text-[10px]`, and `text-[11px]` labels. |
| Brand expression | 15/15 | Public, app-marketing, promo, legal, and authenticated surfaces share the Quiet Strength foundation while preserving real product imagery. |
| Component and design-system consistency | 14/15 | Tokens, primitives, shells, route CSS ownership, and cascade contracts are implemented; time-boxed compatibility aliases and baseline selectors remain. |
| Mobile and responsive quality | 9/10 | The 288 public/guest captures plus tier-A 200%/400% reflow checks pass; direct member/instructor/admin role-responsive screenshots remain blocked. |
| RTL and localization | 9/10 | HE/AR/EN fixture, bidi, namespace, and VoiceOver evidence pass; the production `home-ar` Lighthouse navigation currently resolves to Hebrew and keeps one point open. |
| Accessibility | 9/10 | Keyboard, activation, focus, dialogs, reduced motion, forced colors, VoiceOver, and zero serious/critical axe findings pass; 18 moderate app-marketing landmark findings keep one point open. |
| Performance and perceived speed | 3/5 | Bundle, CLS, accessibility, and representative interaction budgets pass; local mobile LCP fails all three valid HE routes. |
| **Total** | **92/100** | **Seven documented deductions remain; no staging or perfect-score claim.** |

## Original finding reconciliation

Every original P1–P3 finding is tied to an executable check and a final artifact. “Fixed with governed debt” means the user-facing failure is removed while an explicitly owned compatibility boundary remains; it is not a claim that all legacy CSS has been deleted.

| ID | Priority | Final disposition | Validating test or gate | Final evidence |
|---|---|---|---|---|
| A11Y-01 | P1 | Fixed: solid 3 px focus indicators are verified on white, ivory, sand, navy, and image-backed surfaces. | `tests/unit/designTokenContract.test.ts`, `tests/unit/primitiveAccessibility.test.mjs`, `tests/unit/accessibilityEvidence.test.ts` | `artifacts/ui-audit/final/interaction-results.json` (`surfaceFocus`) |
| A11Y-02 | P1 | Fixed: semantic text roles prohibit decorative gold body copy and forced-color text/control contrast is checked fail-closed. | `tests/unit/styleContract.test.ts`, `tests/unit/accessibilityEvidence.test.ts` | `artifacts/ui-audit/final/interaction-results.json` |
| PERF-01 | P1 | Partially fixed, deduction open: deterministic bundle budgets and compressed serving pass; LCP remains 4,386/4,202/5,447 ms. | `tests/unit/performanceBudget.test.ts`, `tests/unit/serveProductionCompression.test.mjs`, `bun run ui-audit:bundle`, `bun run ui-audit:lighthouse` | `artifacts/ui-audit/final/bundle-manifest.json`, `artifacts/ui-audit/final/lighthouse/summary.json` |
| LOC-01 | P1 | Fixed for the original shell/control/copy defects: public locale control, root recovery, legal/social direction, and HE/AR/EN copy are shared. A separate production audit blocker for `home-ar` remains. | `tests/unit/publicShell.test.mjs`, `tests/unit/publicRouteShells.test.mjs`, `tests/unit/i18nNamespaces.test.ts` | `artifacts/ui-audit/final/screenshots/`, `artifacts/ui-audit/final/manifest.json` |
| DS-01 | P2 | Fixed with governed debt: semantic tokens and executable literal/ownership rules replace unbounded route-local drift. | `tests/unit/designTokenContract.test.ts`, `tests/unit/styleContract.test.ts`, `tests/unit/styleCascadeContract.test.ts` | `artifacts/ui-audit/final/capture-manifest.json` |
| UX-01 | P2 | Fixed: schedule task content and filters precede the compact guest handoff explanation. | `tests/unit/guestScheduleHierarchy.test.mjs`, `tests/unit/guestScheduleGuestHandoff.test.mjs` | `artifacts/ui-audit/final/screenshots/guest-member-schedule-he-390x844-default.png` |
| A11Y-03 | P2 | Fixed: authenticated routes compose the shell landmark instead of nesting a route-level `main`. | `tests/unit/authenticatedShellAccessibility.test.mjs`, `tests/unit/adminUiContracts.test.mjs` | `artifacts/ui-audit/final/accessibility.json` |
| QA-01 | P2 | Open: the guarded fixture accounts for all 319 dispositions, but role-responsive visual coverage is incomplete: all 288 filenames are public/guest and 170 protected runtime states remain blocked. | `tests/unit/uiAuditConfig.test.ts`, `tests/unit/uiAuditManifest.test.ts` | `artifacts/ui-audit/final/capture-manifest.json` (288 public/guest captures), route manifest gate (319 scenarios) |
| TYPE-01 | P2 | Fixed: required Assistant, Noto Sans Arabic, and Cormorant faces load from local Fontsource packages. | `tests/unit/i18nDependencyCompleteness.test.ts`, production build | `artifacts/ui-audit/final/bundle-manifest.json` (`totalFonts`) |
| CSS-01 | P2 | Fixed with governed debt: root/base/role ownership, cascade equivalence, and a frozen `!important` baseline are executable; compatibility removal remains scheduled. | `tests/unit/styleContract.test.ts`, `tests/unit/styleCascadeContract.test.ts` | `tools/ui-audit/route-style-contract.json`, `tools/ui-audit/style-important-baseline.json` |
| RTL-02 | P2 | Fixed: mixed dates, times, phones, email, URLs, currency, and identifiers use tested bidi boundaries across route sources. | `tests/unit/bidiFormat.test.ts`, `tests/unit/bidiValueRender.test.tsx`, `tests/unit/bidiRouteCoverage.test.ts` | `artifacts/ui-audit/final/screenshots/` |
| NAV-01 | P2 | Fixed: auth, schedule, app, legal, download, Instagram, promo, payment, checkout, support, and reset routes share `PublicShell`. | `tests/unit/publicShell.test.mjs`, `tests/unit/publicRouteShells.test.mjs` | `artifacts/ui-audit/final/screenshots/` |
| POLISH-01 | P3 | Fixed with governed debt: surface/control radius roles are canonical and new route-local literals fail the style contract. | `tests/unit/designTokenContract.test.ts`, `tests/unit/styleContract.test.ts` | `artifacts/ui-audit/final/screenshots/` |
| POLISH-02 | P3 | Fixed with governed debt: elevation roles and route ownership are enforced; retained legacy winners are isolated by the cascade baseline. | `tests/unit/styleContract.test.ts`, `tests/unit/styleCascadeContract.test.ts` | `artifacts/ui-audit/final/capture-manifest.json` |
| POLISH-03 | P3 | Fixed: legal/support routes share navigation, locale control, support access, and metadata patterns. | `tests/unit/publicRouteShells.test.mjs`, `tests/unit/supportPublicRoute.test.mjs` | `artifacts/ui-audit/final/screenshots/guest-terms-he-390x844-default.png`, `artifacts/ui-audit/final/screenshots/guest-support-he-390x844-default.png` |
| POLISH-04 | P3 | Fixed: app marketing, Instagram, download, and promo retain editorial layouts while consuming the shared shell, tokens, locale, and CTA contracts. | `tests/unit/appMarketingRoute.test.mjs`, `tests/unit/publicRouteShells.test.mjs` | `artifacts/ui-audit/final/screenshots/` |
| POLISH-05 | P3 | Open, governed debt: the mobile 9/10/11 px microcopy floor is still present and frozen by the cascade baseline; source migration is due for review 2026-09-30. | `tests/unit/styleContract.test.ts`, `tests/unit/styleCascadeContract.test.ts` | `tools/ui-audit/style-important-baseline.json`, `artifacts/ui-audit/final/screenshots/` |

## Final evidence summary

| Gate | Result |
|---|---|
| Unit/integration | 998 passed, 6 environment-gated skips, 0 failed across 144 files |
| Lint | Exit 0; 0 errors and 748 existing warnings |
| Production build | Pass; existing TanStack `inputValidator()` deprecation notices remain |
| UI fixture build | Pass; 1,947 modules transformed |
| Route/state manifest | 319 scenarios valid |
| Visual capture | 288/288 deterministic screenshots |
| Axe matrix | 288/288 scans completed; 0 serious/critical, 18 moderate `landmark-unique` rows |
| Bundle budget | Pass: public JS 1,081,105/330,349 raw/gzip; public CSS 384,360/55,141; root CSS 332,315/45,580; largest route 401,859/104,831; fonts 622,560/618,801 bytes |
| Interactions | 48/48 scenario/locale rows; 21/21 AT semantic rows; dialog 18.9 ms, schedule 2.1 ms, table 7 ms |
| VoiceOver | 21/21 parent-operated HE/AR/EN journeys pass; transcript explicitly records manual attribution and its non-cryptographic limitation |
| Lighthouse | Valid HE diagnostic: CLS/accessibility/axe pass; LCP fails at 4,386/4,202/5,447 ms. Full matrix also stops on `home-ar` language mismatch. |
| Final artifact integrity | Pass: `bun tools/ui-audit/final-evidence.ts` recomputes the exact 300-file tree, including per-file size/SHA-256 for 288 PNGs and six Lighthouse report/trace payloads. |
| Staging/deployment | Not run; no claim made |

The accepted Task 14 checkpoint was home 4,842 ms, auth 4,279 ms, and schedule 5,605 ms. The final valid HE diagnostic improved all three values but did not meet the 2,500 ms gate, so the performance deduction and release blocker remain.

## Artifact index

- `artifacts/ui-audit/final/manifest.json`: command ledger, identities, exact blockers, checksums/sizes for all 288 PNGs and six Lighthouse report/trace payloads, and local-only scope.
- `artifacts/ui-audit/final/capture-manifest.json` and `screenshots/`: 288 final public/guest captures across 16 visual surfaces.
- `artifacts/ui-audit/final/accessibility.json`: 288 axe scans and all recorded findings.
- `artifacts/ui-audit/final/interaction-results.json`: keyboard, activation, focus, reflow, forced colors, motion, AT semantics, and latency.
- `docs/design/evidence/task-15-voiceover-transcript.md`: parent-operated manual VoiceOver transcript.
- `artifacts/ui-audit/final/bundle-manifest.json`: bundle provenance and budget evidence.
- `artifacts/ui-audit/final/lighthouse/`: three valid HE reports/traces plus the failing budget summary.
- `docs/design/visual-regression-results.md`: systematic disposition of all 288 captures.

The final evidence tree contains 300 files. Excluding its self-describing manifest, it retains 67,357,071 bytes: 288 PNGs (46,569,010 bytes) and six directly usable raw Lighthouse report/trace JSON payloads (20,594,728 bytes), plus five compact root artifacts. This is a deliberate evidence-specific exception because Task 16 requires final screenshots and usable traces. Every payload is checksummed; Git LFS and external storage were not introduced without authority.

## Release decision

The UI remediation is materially complete for its stated public/guest visual scope, but the final release gate is **blocked**, not passed. Move the registration CTA into the initial mobile viewport; capture protected member/instructor/admin routes in an approved disposable authenticated environment; close the LCP, Arabic-root, and app-marketing landmark failures; migrate the source microcopy; and retire the governed compatibility aliases/baselines before rerunning the full gate. A staging result may be recorded only after an approved staging run actually occurs.
