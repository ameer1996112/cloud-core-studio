# Cloud & Core member UI/UX audit

## Executive summary

**Overall member-experience score: 78/100. Mobile: 82. Desktop: 84. Arabic: 79. Hebrew: 83. English: 84.**

- Member-related routes discovered: 23 (including 5 legacy redirects and record-dependent receipt route)
- Fully audited live: 9 reachable public/guard/error routes; source-audited: 14; authenticated local loaded-data and intercepted mutation evidence is complete for milestone-2 packages/account states
- Important actions live-tested: 14 non-mutating public actions plus local authenticated payment/deletion UI contracts with all side effects intercepted
- Findings: P0 0, P1 5, P2 4, P3 2, observations 5

The live public experience is unusually strong for an early boutique studio product: it is calm, legible, genuinely responsive and has clear guest-to-member boundaries. The product is held below a fully professional standard primarily by completion-risk details rather than visual taste: checkout continuity, incomplete location information, unconfirmed recurring cancellation, weak focus contrast, and source/deployment localization divergence.

## Milestone 2 authenticated QA update

A deterministic local-only fixture completed real `/auth`, loaded package/account data, and exercised intercepted side-effect states. EN/HE/AR responsive evidence, exact counts, keyboard dialog behavior, actual 200% zoom, and 36 axe scans passed. P2-02/P2-03 were released in `371244a`; manual VoiceOver remains pending, so they are not fully audit-resolved. See `milestone-2-final-closure-report.md`.

### Ten biggest reasons it does not yet feel fully professional

1. Checkout data is collected before sign-in, written to an apparently unconsumed session key, then the member is sent to generic auth.
2. Recurring subscription cancellation has no confirmation step.
3. The class-detail sheet truncates location at the actual mobile booking decision point.
4. Focus indication is too subtle to rely on for keyboard users.
5. Local source has hard-coded Hebrew/RTL payment and error views while production served localized views: deployment parity is not controlled.
6. Language menu semantics are only partially implemented.
7. Authenticated booking, waitlist, cancellation, wallet and long-text UI have no current evidence suite across all required viewports.
8. The existing CSS has overlapping token/base/member/quality-override layers, making future consistency expensive.
9. Public checkout visually communicates pricing before its copy says price is shown after sign-in; that is a trust ambiguity.
10. Destructive account-request and subscription actions rely on a toast rather than a clear confirmation/history pattern.

### Ten highest-impact improvements

1. Ship accessible high-contrast focus.
2. Make location/address complete in the sheet.
3. Confirm subscription cancellation.
4. Fix checkout continuity and review state.
5. Localize all source-level error/payment outcomes.
6. Introduce semantic visual tokens.
7. Consolidate member component variants.
8. Finish keyboard behavior for language/dialog/notification controls.
9. Add safe-member Playwright scenarios for all booking/payment outcomes.
10. Add screenshot/RTL/zoom regression coverage before polish work.

Recommended implementation order: accessibility and destructive-action safety → checkout continuity/localization → tokens/components → responsive/RTL automation → cosmetic polish.

## Evidence inspected

- Production: landing in Hebrew, English and Arabic; auth in Arabic/English including empty-form errors; guest schedule at 320, 390, 768, 1366 and 1440; guest class detail; checkout; support; reset-expired; protected-route redirects; pending payment and root 404.
- Source: file-based router, route guards, member shell/navigation, auth, checkout, detail sheet, bookings, packages, account, receipt, locale system, token/base/member/auth CSS.
- Screenshots are in `docs/ui-ux-audit/screenshots/`; filenames named in the evidence column are exact.

## Complete findings table

| ID | Severity | Route | Language | Viewport | Component | Action/State | Finding | User Impact | Evidence | Root Cause | Recommendation | Acceptance Criteria | Source File | Effort | Confidence |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| P1-01 | P1 | `/checkout` → `/auth` | all | 390 | Public checkout | Continue after form | Draft is stored as `cloud-core-checkout-draft`, but no read exists in source; auth has no checkout return route. | High | `checkout-en-390x844.png`; `rg` found a single write | Broken handoff | Return to the selected package and consume/review draft after auth, or defer fields until authenticated. | Selected plan and legal consent are retained, surfaced and editable after auth; no silent loss. | `src/routes/checkout.tsx` | M | High |
| P1-02 | P1 | `/member/packages` | all | all | Subscription card | Cancel subscription | Action directly mutates after one tap. | High | Source mutation at packages lines ~114–121 and button ~260 | Missing confirmation state | Use a confirmation dialog with effective date and consequence copy. | No cancellation request until explicit confirm; pending prevents duplicate. | `src/routes/_authenticated/member/packages.tsx` | S | High |
| P1-03 | P1 | global | all | all | Focus state | Keyboard focus | 18%-gold shadow has no contrast-guaranteed outline. | High | `checkout-en-focus-390x844.png`; AX-01 | Decorative focus token | Use navy outline + gold outer ring. | ≥3:1 focus indicator and visible at 200% zoom. | `src/styles/theme-session.css`, `src/styles/base-components.css` | S | High |
| P1-04 | P1 | `/member/schedule` detail | EN tested | 390 | Class detail sheet | Understand location | Location is truncated to “At Cloud & Core…” in the key facts card. | High | `public-class-detail-en-390x844.png` | `Stat` values truncate indiscriminately | Wrap/expand full location and make it an address/map link where appropriate. | Full location visible/announced at 320, 390 and RTL. | `src/components/member/ClassDetailSheet.tsx` | S | High |
| P1-05 | P1 | errors/payment (local source) | EN/AR risk | all | Error/payment result | Failure/pending | Local source hard-codes Hebrew and `dir=rtl`; observed production EN is localized, so parity is unsafe. | High | `payment-result-en-390x844.png`; source review | User copy bypasses i18n | Route all user copy and direction through locale system; add three-language tests. | EN/HE/AR source and deployed output match for all statuses. | `src/routes/payment-result.tsx`, `src/routes/__root.tsx`, `src/routes/_authenticated/route.tsx` | M | High |
| P2-01 | P2 | member shell | all | all | Language menu | Keyboard use | Custom menu lacks documented Escape/arrow/roving focus behavior. | Medium | AX-02 | Hand-rolled menu semantics | Use tested primitive/APG implementation. | Arrow, Escape and focus-return tests pass. | `src/components/app-shell/AppShell.tsx` | M | High |
| P2-02 | P2 | `/member/packages` | all | 390 | `PackagePricingCard` → `PaymentMethodSheet` | Package payment | The authenticated payment sheet needed clear separation of selected package, authoritative total, recurring disclosure when supplied, and the provider handoff; failure recovery was toast-only. | Medium | Source and local fixture evidence; public checkout screenshots are P1-01 context only | Inconsistent package/payment hierarchy and transient failure feedback | Keep the real server-provided amount distinct from provider handoff; make the next action and recovery accurate. | Member can identify package, authoritative total/currency, authoritative recurring disclosure when available, and provider handoff; failure feedback persists without a false payment result. | `src/routes/_authenticated/member/packages.tsx` | S | High |
| P2-03 | P2 | `/member/account` | all | all | Deletion request | Destructive request | Request fires immediately and success is toast-only; status/next step is not persistent in UI. | Medium | Source review | No confirmation/status component | Add confirmation, explanatory review window, and durable requested state. | Member can cancel/back out before submit and see request status afterward. | `src/routes/_authenticated/member/account.tsx` | M | Medium |
| P2-04 | P2 | member UI | all | all | CSS system | Consistency | Token, base, member and quality override layers duplicate roles and hard-code visual values. | Medium | Source review | Design system implemented in layers | Consolidate semantic tokens and component variants incrementally. | No route needs one-off color/spacing to represent shared semantic state. | `src/styles/tokens.css`, `base-components.css`, `member.css`, `quality-overrides.css` | L | High |
| P3-01 | P3 | mobile nav | HE/AR/EN | 320 | Five-tab bar | Long translation | Five labels fit in reviewed source but leave little resilience at 320px. | Low | `AppShell.tsx`; responsive matrix | Fixed five-item allocation | Regression-test actual longest labels and use More only if needed. | All labels/targets retain clarity at 320. | `src/components/app-shell/AppShell.tsx` | M | Medium |
| P3-02 | P3 | root error (source) | HE/AR/EN | all | Error page | Recovery | Production 404 is calm but sparse; add context-preserving back/return support only where a safe referrer exists. | Low | `not-found-en-390x844.png` | Generic recovery | Keep current visual restraint; add safe contextual recovery. | No dead-end from valid member deep links. | `src/routes/__root.tsx` | S | Low |

## Page scoring

| Page group | Score | Why below 85 |
|---|---:|---|
| Landing | 88 | Strong visual hierarchy and localization; final landing and App Store conversion still needs full viewport/zoom suite. |
| Auth | 86 | Excellent labels/validation and calm form; valid reset/register and assistive-tech verification missing. |
| Guest schedule/detail | 82 | Clear browse-to-auth flow, but essential location truncates in detail. |
| Checkout | 70 | Good form semantics and visual trust cues; continuity and price-stage ambiguity materially weaken confidence. |
| Payment result | 80 | Production pending state is excellent; local source parity/localization risk prevents a higher score. |
| Support/legal | 87 | Direct, orderly, readable; non-English live evidence not captured. |
| Authenticated home/bookings/packages/account | 74 (mixed source/local evidence) | Packages/account loaded deterministic local data, but mutation, dialog and complete responsive content matrices remain unexecuted. |

## Strongest parts

1. The public visual direction is refined, calm and genuinely boutique rather than generic wellness UI.
2. Guest schedule is a trustworthy preview, not a bait-and-switch: it explains when sign-in is needed.
3. Auth form labels, validation and language controls are clear.
4. Public responsiveness at 320–1440 showed no horizontal overflow and uses desktop space well.
5. Booking states and translations are thoughtfully modelled in source, including full/waitlist/credit recovery.

## First milestone

Implement backlog items 1–5 as one “safe completion” milestone, then run the authenticated test matrix with a non-production or approved disposable member. This directly reduces access barriers, incorrect subscription cancellation, checkout abandonment, and locale regression risk without changing booking/payment business rules.

## Scope confirmation

Milestone 2 changed only member UI presentation, localization, shared feedback semantics and test/QA support. No production data, payment configuration, authentication configuration, Supabase schema/RLS, booking logic, credits, promotions, backend behavior, deployments, bookings or cancellations were changed.
