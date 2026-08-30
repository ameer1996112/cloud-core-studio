# Cloud & Core “100/100” UI Remediation Design

**Date:** 2026-08-28
**Status:** Approved design, awaiting implementation-plan approval
**Source audit:** `docs/design/ui-ux-audit.md`

## Objective

Resolve every verified UI/UX defect in the 2026-08-28 audit and create the safe evidence needed to evaluate authenticated member, instructor, and admin experiences. The work targets a defensible 100/100 against the audit rubric, not a cosmetic score claim.

Completion means:

- All P1–P3 audit findings are fixed or replaced by documented evidence that the finding is not reproducible.
- Guest, member, instructor, and admin route-state coverage can run without production accounts or production data.
- Hebrew, Arabic, and English pass the agreed responsive, accessibility, and localization matrix.
- Public Lighthouse runs meet the project targets in a stable local production build or any remaining environment-bound variance is supported by trace evidence and an agreed staging measurement.
- The app remains buildable and business behavior is unchanged.

## Non-goals and safety boundaries

This project does not change:

- Database schema, migrations, Supabase functions, RLS, or production records.
- Booking, waitlist, cancellation, credit, membership, entitlement, payment, receipt, promotion, notification, analytics, or role-permission rules.
- Provider integrations or payment-return semantics.
- Native release configuration except where a web asset or accessibility setting is already shared safely.
- Brand identity through a wholesale redesign.

The current dirty worktree is user-owned. Implementation must inspect overlapping changes before every edit, stage only files intentionally changed for this project, and never reset or overwrite unrelated work.

## Product definition of 100/100

The original rubric remains authoritative:

| Category | Target |
|---|---:|
| UX clarity and task completion | 20/20 |
| Visual hierarchy and typography | 15/15 |
| Brand identity and distinctiveness | 15/15 |
| Component consistency | 15/15 |
| Mobile and responsive quality | 10/10 |
| RTL and localization quality | 10/10 |
| Accessibility | 10/10 |
| Performance and perceived speed | 5/5 |

A category reaches full credit only when its documented deductions are removed and the corresponding route/state evidence exists. Automated scores alone do not establish full accessibility or UX credit.

## Recommended architecture

The remediation uses four boundaries:

1. **Evidence boundary** — deterministic UI fixtures and visual/a11y/performance tests. It supplies states without reaching production services.
2. **Foundation boundary** — raw, semantic, and component tokens; typography, focus, motion, grid, bidi, and locale formatting.
3. **Component boundary** — primitives and domain patterns that own states and accessibility behavior.
4. **Route boundary** — public/member/instructor/admin shells compose components without inventing new foundations.

The boundaries are migrated incrementally. Compatibility aliases stay temporarily while routes move; every alias has an owner and removal phase.

## Evidence boundary

### Safe fixture strategy

Add a deterministic, test-only presentation harness that renders real route components with typed fixture adapters. It must:

- Be excluded from production navigation and production data access.
- Refuse known production Supabase project identifiers.
- Require an explicit test environment flag.
- Never create, update, delete, book, cancel, charge, notify, or seed remote records.
- Represent guest, member, instructor, and admin roles plus the states in `docs/design/route-state-matrix.md`.

Prefer dependency injection at existing query/presentation seams. Do not add test branches throughout business components. If a component cannot accept fixture data without understanding backend internals, extract a pure presentation component with a typed view model.

### Evidence outputs

- Screenshots named `<role>-<route>-<language>-<viewport>-<state>.png`.
- Semantic assertions for headings, labels, names, state text, and focus order.
- Automated accessibility results.
- Production-build Lighthouse JSON and bundle-size manifest.
- A route-state manifest that distinguishes visual, static, redirected, and blocked coverage.

## Foundation boundary

### Tokens

Implement three layers:

- Raw palette/measurements, used only inside the theme.
- Semantic roles such as `text-primary`, `surface-raised`, `action-primary`, `status-danger`, `focus-ring`.
- Component tokens only for a proven component-specific need.

Freeze new arbitrary color/radius/shadow values. Preserve current visuals through temporary aliases, then remove legacy `brass`, `ink`, duplicate route palettes, circular/self-referential theme aliases, and compensating `!important` rules as consumers migrate.

### Focus and contrast

- Replace the 18%-gold focus glow with a solid WCAG 2.2-compliant focus treatment visible on white, ivory, sand, navy, and imagery.
- No primitive may remove focus without applying the shared replacement.
- Gold remains an accent for borders, icons, rules, or sufficiently large decorative type; it is not normal body text on light surfaces.
- Every semantic status uses text/icon/state semantics in addition to color.

### Typography and fonts

- Assistant for Hebrew/English UI, Noto Sans Arabic for Arabic, and Cormorant Garamond only for brand/editorial Latin.
- Self-host installed font packages or equivalent local assets, subset weights/scripts, and preload only the faces required above the fold.
- Split route/locale dictionaries so public entry routes do not load the entire translation catalog.
- Remove source microcopy below the approved floor instead of relying on global selector overrides.

### Responsive and bidi rules

- Standard layout ranges: compact `<640`, medium `640–1023`, wide `≥1024`; keep only demonstrated exceptions.
- Use logical CSS properties.
- Isolate email, phone, URL, currency, identifiers, and time ranges with the shared bidi primitives.
- The document owns `lang` and `dir`; public microsites must not hardcode RTL.

## Component boundary

### Primitive contract

Button, IconButton, Input, Textarea, Select, Checkbox, Radio, Switch, Tabs, Dialog, AlertDialog, Sheet, Table, Badge, Skeleton, Toast, and field wrappers must document and test:

- Default, hover, focus-visible, active/pressed, selected, disabled, loading, error, success, and read-only when applicable.
- A 44×44 px minimum interactive target.
- Accessible names and programmatic field/error relationships.
- Keyboard operation and dialog focus trap/return.
- Reduced-motion behavior.

### Domain state contract

Booking, package, credit, payment, attendance, member, participant, and admin-destructive patterns receive typed view states. Presentation code must make state and consequence explicit.

For booking:

- Available shows seats and exact credit/price effect.
- Full is distinct from waitlist availability.
- Waitlist explains behavior before joining.
- Ineligible/disabled exposes the reason and recovery path.
- Pending blocks duplicate action.
- Success announces class/time, balance effect, cancellation deadline, and next action.
- Failure preserves context and prevents an accidental duplicate retry.

Business decisions remain sourced from existing functions/RPC results; the design only standardizes their presentation.

## Route boundary

### PublicShell

Introduce one lightweight public shell providing:

- Cloud & Core identity.
- Consistent HE/AR/EN control.
- Support, sign-in/account, schedule, privacy, and terms destinations as context requires.
- Skip link and one `main` landmark.
- Safe-area and responsive behavior.

Auth, guest schedule, legal, support, download, Instagram, promo, and app marketing may retain route-specific editorial layouts while consuming this shell and the shared foundations.

Root not-found/error states become fully localized. `/download` and `/instagram` inherit document direction. The guest schedule moves schedule discovery ahead of long explanatory content while keeping trust and sign-in handoff visible.

### Authenticated shells

AppShell retains role-aware navigation. The remediation validates:

- Stable bottom navigation and content clearance.
- Drawer keyboard/focus behavior.
- Locale switching in all roles.
- One `main` landmark per page; the nested admin messages landmark is removed.
- Responsive admin table contracts rather than route-specific overflow fixes.

## Performance design

The implementation uses evidence-led optimization:

1. Produce a route bundle manifest and cold-load trace.
2. Split locale dictionaries and large route-only dependencies.
3. Reduce global CSS by migrating repeated recipes and removing confirmed-unused compatibility rules.
4. Self-host/subset fonts and prioritize LCP assets.
5. Keep reports, charts, messaging consoles, and admin-only code out of public/member initial chunks.
6. Measure route transitions and representative interactions; use skeletons only where they improve comprehension.

Targets:

- LCP under 2.5 s.
- CLS under 0.1.
- INP under 200 ms in representative interaction testing.
- No regression in accessibility or action clarity to improve a score.

If a local Lighthouse result is dominated by the preview server or audit harness, the trace must identify that contribution and the final gate moves to a stable staging build; the result cannot simply be waived.

## Error and recovery behavior

- Root and route errors use the active language, preserve direction, and offer a safe retry/home/support path.
- Form errors associate to fields, focus the first invalid control, and preserve entered values.
- Loading states expose busy semantics where users can act.
- Empty states explain why the state is empty and provide a relevant next action.
- Offline/slow network states preserve context and distinguish retryable from final failure.
- Expired sessions return to auth with a localized explanation and safe return target.
- Toasts complement persistent state; critical outcomes are not toast-only.

## Accessibility verification

WCAG 2.2 AA is the release minimum. Verification includes:

- Automated axe/Lighthouse on the risk-tier route matrix.
- Keyboard traversal, activation, Escape behavior, focus trap, and focus return.
- Visible focus on every surface type.
- 200% zoom for every route tier and 400% for reflow-sensitive content.
- Reduced motion and high-contrast/forced-colors checks.
- VoiceOver manual runbook for auth, booking, cancellation, payment result, attendance, destructive admin confirmation, and navigation.
- Dynamic status announcements and validation error associations.

Automated accessibility 100 is necessary but not sufficient for category completion.

## Test strategy

Use test-driven changes at these seams:

- Contrast and semantic-token tests before token changes.
- Locale/direction/public-shell tests before route migration.
- Primitive state/keyboard tests before component changes.
- Pure booking/payment/attendance view-model tests before route composition changes.
- Bundle-budget and route-import tests before performance refactors.

Regular verification:

- Typecheck and relevant single tests during each task.
- `bun run lint` and `bun run build` for every meaningful batch.
- Full unit/integration suite at completion.
- Non-mutating route-guard tests.
- Visual matrix at the end of each migration phase.

Existing lint warnings are baseline debt; remediation may reduce them in touched files but must introduce no new errors or warnings.

## Phased delivery

1. Safe fixture and evidence harness.
2. Accessible focus, contrast, and semantic tokens.
3. Typography, local font delivery, locale splitting, and bidi formatters.
4. Primitive component state contracts.
5. PublicShell and public route remediation.
6. Member schedule, booking, cancellation, packages, payments, and account states.
7. Instructor dashboard, roster, and attendance states.
8. Admin shell, tables, forms, confirmations, reports, and messaging states.
9. Accessibility hardening and assistive-technology runbook.
10. Performance optimization and bundle budgets.
11. Full visual regression matrix and final rescore.

Each phase is independently reviewable and reversible. Migration commits must not mix backend changes with UI work.

## Rollback strategy

- Keep compatibility token aliases until all consumers in a phase migrate.
- Migrate one route family or primitive family per commit.
- Preserve existing data/RPC interfaces.
- Every performance optimization records before/after artifacts so it can be reverted independently.
- Fixture/test harness changes remain isolated from production routing.
- If a cross-cutting token change causes unacceptable regressions, revert the token commit rather than patching routes with new one-offs.

## Acceptance criteria

The project is complete only when:

1. All audit findings have a linked fix and test/evidence artifact.
2. The full UI route-state matrix has no unexplained Blocked entries.
3. All six viewports and three languages pass the agreed risk-tier screenshots.
4. Guest/member/instructor/admin critical flows pass keyboard and accessibility checks.
5. Focus, contrast, touch targets, labels, landmarks, dialogs, live regions, zoom, reduced motion, and fixed-navigation clearance meet WCAG 2.2 AA.
6. Public LCP/CLS and representative INP meet targets in a stable production-like environment.
7. `bun run lint`, typecheck, `bun run build`, full tests, and non-mutating E2E checks pass within the documented baseline.
8. No production UI behavior, backend contract, permission, payment, or data semantics changed unintentionally.
9. The final audit is rerun from fresh evidence and scores 100/100 without coverage caveats.

## Deliverables

- Updated design tokens, primitives, shells, and route presentation.
- Safe role/state fixture harness.
- Automated accessibility, localization, performance, and visual-regression checks.
- Updated audit, inventory, design-system documentation, route-state matrix, and migration status.
- Final before/after evidence and rescore report.
