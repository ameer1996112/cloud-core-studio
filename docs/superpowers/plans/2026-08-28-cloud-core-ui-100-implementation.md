# Cloud & Core UI 100/100 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove every verified deduction in the 2026-08-28 UI/UX audit and produce repeatable evidence for guest, member, instructor, and admin experiences across Hebrew, Arabic, English, and six target viewports.

**Architecture:** Build a separate, guarded Vite evidence app around real presentation components; migrate the product in dependency order from semantic foundations to primitives, shells, and role-specific route families; then enforce accessibility, bundle, and visual budgets in CI-friendly scripts. Existing business functions, route guards, Supabase contracts, and mutation behavior remain unchanged.

**Tech Stack:** React 19, TypeScript, TanStack Start/Router, Vite 8, Tailwind CSS 4, Radix UI, Bun test, Playwright, Lighthouse, local Fontsource packages.

**Spec:** `docs/superpowers/specs/2026-08-28-cloud-core-ui-100-design.md`

## Global Constraints

- Treat the existing dirty worktree as user-owned. Before every task, run `git status --short` and inspect the diff of every file that task will modify.
- Stage only the files named by the current task. Never use `git add .`, `git reset --hard`, or `git checkout --`.
- Do not modify database schema, migrations, Supabase functions, RLS, business rules, production records, payment behavior, booking behavior, or role permissions.
- Fixture code may import presentation modules, but production code must never import from `tools/ui-audit/`.
- Use test-driven development: add the focused failing test, observe the intended failure, implement the smallest coherent change, rerun the focused test, then run the relevant regression set.
- Preserve HE/AR/EN behavior in every touched surface. The document remains the sole owner of `lang` and `dir`.
- Use logical CSS properties. Keep only exceptions backed by a screenshot or browser test.
- Every interactive control must have a 44×44 CSS-pixel target, a visible focus indicator, an accessible name, and a disabled/loading contract where applicable.
- Do not claim the final score until the evidence matrix and final audit are complete.
- Meaningful batches must end with `bun run lint` and `bun run build`, as required by `AGENTS.md`.

---

## Task 1: Establish the guarded UI evidence app

**Files:**

- Create: `tools/ui-audit/types.ts`
- Create: `tools/ui-audit/config.ts`
- Create: `tools/ui-audit/fixtures.ts`
- Create: `tools/ui-audit/FixtureApp.tsx`
- Create: `tools/ui-audit/main.tsx`
- Create: `tools/ui-audit/index.html`
- Create: `tools/ui-audit/vite.config.ts`
- Test: `tests/unit/uiAuditConfig.test.ts`
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Record the overlap check**

Run: `git status --short && git diff -- package.json .gitignore`

Expected: existing user changes are understood before editing; no unrelated path is staged.

- [ ] **Step 2: Write the failing environment-guard test**

```ts
import { describe, expect, test } from "bun:test";
import { assertSafeUiAuditEnvironment } from "../../tools/ui-audit/config";

describe("UI audit environment guard", () => {
  test("requires the explicit fixture flag", () => {
    expect(() =>
      assertSafeUiAuditEnvironment({ enabled: false, mode: "development", supabaseUrl: "" }),
    ).toThrow("UI_AUDIT_FIXTURES=true");
  });

  test("rejects production mode and configured production hosts", () => {
    expect(() =>
      assertSafeUiAuditEnvironment({ enabled: true, mode: "production", supabaseUrl: "" }),
    ).toThrow("production");
    expect(() =>
      assertSafeUiAuditEnvironment({
        enabled: true,
        mode: "development",
        supabaseUrl: "https://production.example.supabase.co",
        forbiddenHosts: ["production.example.supabase.co"],
      }),
    ).toThrow("forbidden Supabase host");
  });
});
```

Run: `bun test tests/unit/uiAuditConfig.test.ts`

Expected: FAIL because `tools/ui-audit/config.ts` does not exist.

- [ ] **Step 3: Implement the guard and typed scenario contract**

```ts
import type React from "react";

export type AuditLanguage = "he" | "ar" | "en";
export type AuditRole = "guest" | "member" | "instructor" | "admin";
export type AuditViewport = "360x800" | "390x844" | "768x1024" | "1024x768" | "1280x800" | "1440x900";

export interface AuditScenario {
  id: string;
  role: AuditRole;
  route: string;
  state: string;
  languages: readonly AuditLanguage[];
  viewports: readonly AuditViewport[];
  render: () => React.ReactNode;
}
```

```ts
export function assertSafeUiAuditEnvironment(input: {
  enabled: boolean;
  mode: string;
  supabaseUrl: string;
  forbiddenHosts?: readonly string[];
}): void {
  if (!input.enabled) throw new Error("UI_AUDIT_FIXTURES=true is required");
  if (input.mode === "production") throw new Error("UI audit fixtures cannot run in production mode");
  const host = input.supabaseUrl ? new URL(input.supabaseUrl).host : "";
  if ((input.forbiddenHosts ?? []).includes(host)) throw new Error("forbidden Supabase host");
}
```

The fixture app must contain no Supabase client import, no route mutation import, and no production navigation link. It selects scenarios through query parameters and renders a visible fixture-only banner.

- [ ] **Step 4: Add isolated scripts**

Add these package scripts without rewriting existing scripts:

```json
{
  "ui-audit:dev": "UI_AUDIT_FIXTURES=true vite --config tools/ui-audit/vite.config.ts",
  "ui-audit:build": "UI_AUDIT_FIXTURES=true vite build --config tools/ui-audit/vite.config.ts"
}
```

Add `artifacts/ui-audit/current/` to `.gitignore`; keep the approved audit artifacts already present under dated paths.

- [ ] **Step 5: Prove isolation and buildability**

Run: `bun test tests/unit/uiAuditConfig.test.ts && bun run ui-audit:build && rg -n "supabase|createServerFn|useMutation" tools/ui-audit`

Expected: tests and fixture build pass; the final search has no matches.

- [ ] **Step 6: Commit the evidence foundation**

```bash
git add tools/ui-audit tests/unit/uiAuditConfig.test.ts package.json .gitignore
git commit -m "test: add guarded ui evidence harness"
```

---

## Task 2: Define semantic color, focus, spacing, and motion contracts

**Files:**

- Create: `src/lib/design-token-contract.ts`
- Test: `tests/unit/designTokenContract.test.ts`
- Modify: `src/styles/tokens.css`
- Modify: `src/styles.css`

- [ ] **Step 1: Inspect current token overlap**

Run: `git diff -- src/styles.css src/styles/tokens.css && rg -n "focus-ring|brass|ink|outline:\s*none|!important" src/styles.css src/styles/tokens.css`

Expected: current user edits are preserved and each legacy selector is catalogued before migration.

- [ ] **Step 2: Write failing contrast and focus tests**

```ts
import { describe, expect, test } from "bun:test";
import { contrastRatio, meetsNormalTextContrast } from "../../src/lib/design-token-contract";

describe("semantic visual tokens", () => {
  test("body text meets WCAG AA on light surfaces", () => {
    expect(contrastRatio("#24303c", "#fffdf8")).toBeGreaterThanOrEqual(4.5);
    expect(meetsNormalTextContrast("#a17012", "#fffdf8")).toBe(false);
  });

  test("focus colors remain visible on light and dark surfaces", () => {
    expect(contrastRatio("#0b63ce", "#fffdf8")).toBeGreaterThanOrEqual(3);
    expect(contrastRatio("#8fc8ff", "#102436")).toBeGreaterThanOrEqual(3);
  });
});
```

Run: `bun test tests/unit/designTokenContract.test.ts`

Expected: FAIL because the contract module does not exist.

- [ ] **Step 3: Implement the pure contrast helper and semantic tokens**

The helper converts sRGB channels to relative luminance and returns `(lighter + 0.05) / (darker + 0.05)`. Add semantic CSS custom properties for primary/secondary/muted text, canvas/raised/subtle surfaces, primary/destructive actions, success/warning/danger/info states, light/dark focus colors, target size, and reduced-motion duration.

```css
:root {
  --cc-text-primary: #24303c;
  --cc-text-secondary: #52606d;
  --cc-surface-canvas: #fffdf8;
  --cc-surface-raised: #ffffff;
  --cc-action-primary: #173b57;
  --cc-focus-color: #0b63ce;
  --cc-focus-outline: 3px solid var(--cc-focus-color);
  --cc-focus-offset: 3px;
  --cc-target-min: 2.75rem;
  --cc-motion-reduced: 1ms;
}

.cc-dark-surface { --cc-focus-color: #8fc8ff; }
```

Compatibility aliases may remain in `tokens.css`, but new component code uses semantic roles only.

- [ ] **Step 4: Replace the global focus reset**

```css
:where(a, button, input, textarea, select, summary, [tabindex]):focus-visible {
  outline: var(--cc-focus-outline);
  outline-offset: var(--cc-focus-offset);
  box-shadow: none;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    animation-duration: var(--cc-motion-reduced) !important;
    animation-iteration-count: 1 !important;
    transition-duration: var(--cc-motion-reduced) !important;
  }
}
```

- [ ] **Step 5: Verify the foundation**

Run: `bun test tests/unit/designTokenContract.test.ts && bunx tsc --noEmit && bun run build`

Expected: all commands pass and the build contains no self-referential semantic variables.

- [ ] **Step 6: Commit the foundation**

```bash
git add src/lib/design-token-contract.ts src/styles/tokens.css src/styles.css tests/unit/designTokenContract.test.ts
git commit -m "fix: establish accessible semantic ui tokens"
```

---

## Task 3: Harden core form and action primitives

**Files:**

- Create: `src/components/ui/field-message.tsx`
- Create: `src/components/ui/icon-button.tsx`
- Test: `tests/unit/primitiveAccessibility.test.mjs`
- Modify: `src/components/ui/button.tsx`
- Modify: `src/components/ui/input.tsx`
- Modify: `src/components/ui/textarea.tsx`
- Modify: `src/components/ui/select.tsx`
- Modify: `src/components/ui/checkbox.tsx`
- Modify: `src/components/ui/radio-group.tsx`
- Modify: `src/components/ui/switch.tsx`
- Modify: `src/components/ui/tabs.tsx`
- Modify: `src/components/ui/badge.tsx`

- [ ] **Step 1: Add source-contract tests for primitives**

The test must assert that action primitives consume `--cc-target-min`, focus remains shared, loading controls expose `aria-busy`, error-capable fields accept `aria-describedby` and `aria-invalid`, and icon-only actions require a non-empty accessible label.

```js
test("IconButton requires an accessible label", () => {
  const source = readFileSync("src/components/ui/icon-button.tsx", "utf8");
  assert.match(source, /aria-label: string/);
  assert.match(source, /size-\[var\(--cc-target-min\)\]/);
});
```

Run: `bun test tests/unit/primitiveAccessibility.test.mjs`

Expected: FAIL because the new primitives and contracts do not exist.

- [ ] **Step 2: Add explicit button and icon-button states**

```tsx
type ButtonStateProps = {
  loading?: boolean;
  loadingLabel?: string;
};

export function IconButton({
  "aria-label": label,
  ...props
}: React.ComponentProps<typeof Button> & { "aria-label": string }) {
  return <Button size="icon" aria-label={label} {...props} />;
}
```

Buttons must retain their visible label while loading, set `aria-busy`, prevent duplicate activation, and meet the 44×44 target. Do not infer labels from SVG content.

- [ ] **Step 3: Standardize field error/help relationships**

```tsx
export function FieldMessage({ id, tone = "help", children }: FieldMessageProps) {
  return (
    <p id={id} role={tone === "error" ? "alert" : undefined} className={fieldMessageVariants({ tone })}>
      {children}
    </p>
  );
}
```

Input-like primitives pass native `aria-invalid`, `aria-describedby`, `disabled`, and `readOnly` props without replacement wrappers. Checkboxes, radios, switches, and tabs gain consistent disabled, selected, and focus-visible styling.

- [ ] **Step 4: Verify primitives and touched-file lint**

Run: `bun test tests/unit/primitiveAccessibility.test.mjs && bunx eslint src/components/ui/button.tsx src/components/ui/icon-button.tsx src/components/ui/field-message.tsx src/components/ui/input.tsx src/components/ui/textarea.tsx src/components/ui/select.tsx src/components/ui/checkbox.tsx src/components/ui/radio-group.tsx src/components/ui/switch.tsx src/components/ui/tabs.tsx src/components/ui/badge.tsx`

Expected: tests pass; touched files add no lint warnings.

- [ ] **Step 5: Commit primitive contracts**

```bash
git add src/components/ui/field-message.tsx src/components/ui/icon-button.tsx src/components/ui/button.tsx src/components/ui/input.tsx src/components/ui/textarea.tsx src/components/ui/select.tsx src/components/ui/checkbox.tsx src/components/ui/radio-group.tsx src/components/ui/switch.tsx src/components/ui/tabs.tsx src/components/ui/badge.tsx tests/unit/primitiveAccessibility.test.mjs
git commit -m "fix: harden accessible interaction primitives"
```

---

## Task 4: Standardize dialogs, sheets, tables, skeletons, and announcements

**Files:**

- Create: `src/components/ui/async-state.tsx`
- Create: `src/components/ui/responsive-data-list.tsx`
- Test: `tests/unit/compositeAccessibility.test.mjs`
- Modify: `src/components/ui/dialog.tsx`
- Modify: `src/components/ui/alert-dialog.tsx`
- Modify: `src/components/ui/sheet.tsx`
- Modify: `src/components/ui/table.tsx`
- Modify: `src/components/ui/skeleton.tsx`
- Modify: `src/components/ui/sonner.tsx`

- [ ] **Step 1: Write failing composite-contract tests**

Assert required dialog title/description composition, explicit close names, focus-return support, loading-region semantics, table captions, responsive card labels, and a persistent success/error companion for critical toasts.

Run: `bun test tests/unit/compositeAccessibility.test.mjs`

Expected: FAIL on the missing `AsyncState` and `ResponsiveDataList` exports.

- [ ] **Step 2: Implement async and responsive data contracts**

```ts
export type AsyncViewState<T> =
  | { status: "loading"; label: string }
  | { status: "empty"; title: string; body: string; action?: React.ReactNode }
  | { status: "error"; title: string; body: string; retry?: () => void }
  | { status: "ready"; data: T };
```

`AsyncState` owns `aria-busy`, polite status announcements, and persistent empty/error copy. `ResponsiveDataList` renders a captioned table at wide widths and labeled cards at compact widths from one column definition.

- [ ] **Step 3: Harden focus and announcement behavior**

Keep Radix focus trapping and return behavior intact; give every icon close button a localized label; respect reduced motion; ensure destructive confirmation text names the object and consequence; reserve toasts for supplemental feedback.

- [ ] **Step 4: Verify and commit**

Run: `bun test tests/unit/compositeAccessibility.test.mjs && bunx tsc --noEmit && bun run build`

Expected: all commands pass.

```bash
git add src/components/ui/async-state.tsx src/components/ui/responsive-data-list.tsx src/components/ui/dialog.tsx src/components/ui/alert-dialog.tsx src/components/ui/sheet.tsx src/components/ui/table.tsx src/components/ui/skeleton.tsx src/components/ui/sonner.tsx tests/unit/compositeAccessibility.test.mjs
git commit -m "fix: standardize accessible composite states"
```

---

## Task 5: Localize root recovery and introduce PublicShell

**Files:**

- Create: `src/components/public/PublicShell.tsx`
- Create: `src/components/public/PublicLanguageSwitcher.tsx`
- Test: `tests/unit/publicShell.test.mjs`
- Modify: `src/routes/__root.tsx`
- Modify: `src/lib/i18n.ts`
- Modify: `src/components/legal/LegalLanguageSwitcher.tsx`

- [ ] **Step 1: Write failing public-shell and root-error tests**

Assert one `main` landmark, skip-link destination, HE/AR/EN options, localized not-found/error/retry/home/support strings, and no Hebrew literals inside `NotFound` or `ErrorComponent`.

Run: `bun test tests/unit/publicShell.test.mjs tests/unit/mobileAuditLocalization.test.ts`

Expected: FAIL because `PublicShell` and root recovery keys do not exist.

- [ ] **Step 2: Add the public shell interface**

```tsx
export interface PublicShellProps {
  children: React.ReactNode;
  headerMode?: "full" | "compact";
  showSchedule?: boolean;
  showAccount?: boolean;
  mainClassName?: string;
}

export function PublicShell({ children, mainClassName, ...navigation }: PublicShellProps) {
  return (
    <div className="min-h-dvh bg-[var(--cc-surface-canvas)]">
      <a className="cc-skip-link" href="#main-content">Skip</a>
      <PublicHeader {...navigation} />
      <main id="main-content" className={mainClassName}>{children}</main>
      <PublicFooter />
    </div>
  );
}
```

The visible skip-link label and all destinations come from `t()`. `PublicLanguageSwitcher` replaces the legal-only switcher while the old export becomes a temporary compatibility wrapper.

- [ ] **Step 3: Localize root errors**

Root not-found and error states must call `useI18n`, preserve active direction, expose retry/home/support actions, and report technical details only inside an expandable disclosure in development.

- [ ] **Step 4: Verify and commit**

Run: `bun test tests/unit/publicShell.test.mjs tests/unit/mobileAuditLocalization.test.ts tests/unit/appMarketingShellLanguage.test.mjs && bun run build`

Expected: all commands pass.

```bash
git add src/components/public/PublicShell.tsx src/components/public/PublicLanguageSwitcher.tsx src/components/legal/LegalLanguageSwitcher.tsx src/routes/__root.tsx src/lib/i18n.ts tests/unit/publicShell.test.mjs
git commit -m "fix: add localized public shell and recovery"
```

---

## Task 6: Migrate public routes and repair guest schedule hierarchy

**Files:**

- Test: `tests/unit/publicRouteShells.test.mjs`
- Test: `tests/unit/guestScheduleHierarchy.test.mjs`
- Modify: `src/routes/auth.tsx`
- Modify: `src/routes/auth_.reset.tsx`
- Modify: `src/routes/reset-password.tsx`
- Modify: `src/routes/member.schedule.tsx`
- Modify: `src/routes/checkout.tsx`
- Modify: `src/routes/payment-result.tsx`
- Modify: `src/routes/privacy.tsx`
- Modify: `src/routes/terms.tsx`
- Modify: `src/routes/support.tsx`
- Modify: `src/routes/download.tsx`
- Modify: `src/routes/instagram.tsx`
- Modify: `src/routes/promo.yoga-lina.tsx`
- Modify: `src/routes/app.tsx`
- Modify: `src/components/app-marketing/AppMarketingPage.tsx`

- [ ] **Step 1: Add failing route-shell assertions**

The source-contract test must verify that each public route composes `PublicShell`, no route hardcodes `dir="rtl"`, and each page leaves ownership of the single `main` landmark to the shell.

The guest schedule test must assert the DOM order `schedule heading → date controls → class list → trust/explanation → sign-in handoff` and preserve existing guest-auth intent parameters.

Run: `bun test tests/unit/publicRouteShells.test.mjs tests/unit/guestScheduleHierarchy.test.mjs tests/unit/guestScheduleGuestHandoff.test.mjs`

Expected: FAIL on routes that still own independent shells or hardcoded direction.

- [ ] **Step 2: Migrate low-risk informational routes first**

Move privacy, terms, support, download, Instagram, promo, and app marketing into `PublicShell`. Preserve route metadata, analytics calls, download configuration, and marketing assets. Replace physical left/right properties in touched styles with logical properties.

- [ ] **Step 3: Migrate auth and transaction routes**

Move auth, reset, checkout, and payment-result pages into the shell without changing submit handlers, redirect targets, consent requirements, provider-return parsing, or session behavior. Associate validation summaries with fields and focus the first invalid field.

- [ ] **Step 4: Reorder the guest schedule**

Keep schedule discovery and booking-intent behavior intact. Move long studio explanation below the class list, show concise trust copy near the primary action, make full/waitlist/ineligible distinctions explicit, and keep sign-in continuation visible.

- [ ] **Step 5: Run the public regression set**

Run: `bun test tests/unit/publicRouteShells.test.mjs tests/unit/guestScheduleHierarchy.test.mjs tests/unit/guestScheduleGuestHandoff.test.mjs tests/unit/guestDetailGuestBranch.test.mjs tests/unit/authPublicEntry.test.mjs tests/unit/supportPublicRoute.test.mjs tests/unit/downloadConfig.test.ts tests/unit/instagramLanding.test.mjs tests/unit/appMarketing.test.ts tests/unit/appMarketingRoute.test.mjs tests/unit/appMarketingShellLanguage.test.mjs tests/unit/yogaPromoMetadata.test.mjs`

Expected: all tests pass.

- [ ] **Step 6: Build and commit public migration**

Run: `bun run lint && bun run build`

Expected: zero lint errors, no new warnings in touched files, production build passes.

```bash
git add src/routes/auth.tsx src/routes/auth_.reset.tsx src/routes/reset-password.tsx src/routes/member.schedule.tsx src/routes/checkout.tsx src/routes/payment-result.tsx src/routes/privacy.tsx src/routes/terms.tsx src/routes/support.tsx src/routes/download.tsx src/routes/instagram.tsx src/routes/promo.yoga-lina.tsx src/routes/app.tsx src/components/app-marketing/AppMarketingPage.tsx tests/unit/publicRouteShells.test.mjs tests/unit/guestScheduleHierarchy.test.mjs
git commit -m "fix: unify public routes and guest schedule hierarchy"
```

---

## Task 7: Create pure booking and cancellation presentation states

**Files:**

- Create: `src/lib/booking-view-state.ts`
- Create: `src/components/member/BookingActionPanel.tsx`
- Test: `tests/unit/bookingViewState.test.ts`
- Modify: `src/components/member/PremiumClassCard.tsx`
- Modify: `src/components/member/ClassDetailSheet.tsx`
- Modify: `src/components/visual/VisualClassCard.tsx`
- Modify: `src/routes/_authenticated/schedule.tsx`
- Modify: `src/routes/_authenticated/bookings/$id.tsx`
- Modify: `src/routes/_authenticated/bookings/index.tsx`

- [ ] **Step 1: Write the state-machine tests**

```ts
describe("deriveBookingViewState", () => {
  test.each([
    ["available", "book"],
    ["full", "unavailable"],
    ["waitlist-open", "join-waitlist"],
    ["ineligible", "recover"],
    ["pending", "pending"],
    ["booked", "manage"],
  ] as const)("maps %s to %s", (availability, action) => {
    expect(deriveBookingViewState(fixture({ availability })).action.kind).toBe(action);
  });
});
```

Also assert exact credit/price consequence, seat copy, cancellation deadline, recovery action, duplicate-action lock, and persistent success/failure announcement.

Run: `bun test tests/unit/bookingViewState.test.ts`

Expected: FAIL because the pure view-state module does not exist.

- [ ] **Step 2: Implement the discriminated view model**

```ts
export type BookingAction =
  | { kind: "book"; label: string; consequence: string }
  | { kind: "join-waitlist"; label: string; explanation: string }
  | { kind: "unavailable"; reason: string }
  | { kind: "recover"; reason: string; label: string; href: string }
  | { kind: "pending"; label: string }
  | { kind: "manage"; label: string; cancellationDeadline?: string };
```

Inputs must be existing server/query results and existing eligibility decisions. The module formats presentation only and cannot decide entitlement.

- [ ] **Step 3: Compose one action panel across schedule surfaces**

`BookingActionPanel` renders seats, price/credit impact, waitlist explanation, eligibility recovery, pending lock, success details, and failure recovery. It uses `aria-live="polite"` for changing status and persistent content for final outcomes.

- [ ] **Step 4: Preserve mutation semantics and verify**

Run: `bun test tests/unit/bookingViewState.test.ts tests/unit/guestDetailGuestBranch.test.mjs tests/unit/visualClassCardPackageCta.test.mjs && bunx tsc --noEmit && bun run build`

Expected: all commands pass; existing booking/cancel handlers and function imports are unchanged.

- [ ] **Step 5: Commit booking presentation states**

```bash
git add src/lib/booking-view-state.ts src/components/member/BookingActionPanel.tsx src/components/member/PremiumClassCard.tsx src/components/member/ClassDetailSheet.tsx src/components/visual/VisualClassCard.tsx src/routes/_authenticated/schedule.tsx 'src/routes/_authenticated/bookings/$id.tsx' src/routes/_authenticated/bookings/index.tsx tests/unit/bookingViewState.test.ts
git commit -m "fix: clarify booking and cancellation states"
```

---

## Task 8: Normalize member package, payment, and account recovery states

**Files:**

- Create: `src/lib/member-account-view-state.ts`
- Create: `src/components/member/MemberOutcomePanel.tsx`
- Test: `tests/unit/memberAccountViewState.test.ts`
- Modify: `src/routes/_authenticated/member/index.tsx`
- Modify: `src/routes/_authenticated/member/packages.tsx`
- Modify: `src/routes/_authenticated/member/bookings.tsx`
- Modify: `src/routes/_authenticated/member/account.tsx`
- Modify: `src/routes/_authenticated/plans.tsx`
- Modify: `src/routes/_authenticated/receipts/$id.tsx`
- Modify: `src/routes/payment-result.tsx`

- [ ] **Step 1: Write failing member-state tests**

Cover loading, no package, active package, expiring package, exhausted credits, payment pending, payment succeeded, payment failed, missing receipt, expired session, offline retry, and profile validation error.

Run: `bun test tests/unit/memberAccountViewState.test.ts`

Expected: FAIL because the view-state module does not exist.

- [ ] **Step 2: Implement pure outcome mapping**

```ts
export type MemberOutcome = {
  tone: "neutral" | "info" | "success" | "warning" | "danger";
  title: string;
  body: string;
  nextAction?: { label: string; href: string };
  announce: boolean;
};
```

Mapping receives existing package/payment/account statuses; it does not reinterpret provider status or credit rules.

- [ ] **Step 3: Apply consistent recovery UI**

Use `AsyncState` and `MemberOutcomePanel` across the named member routes. Keep entered account values after validation failure, connect errors through `aria-describedby`, and make receipt/payment failure recovery persistent rather than toast-only.

- [ ] **Step 4: Verify and commit**

Run: `bun test tests/unit/memberAccountViewState.test.ts tests/unit/checkoutConsent.test.ts tests/unit/hypPaymentPage.test.ts tests/unit/ezcountReceipts.test.mjs tests/unit/memberProfileLanguage.test.mjs && bun run build`

Expected: all commands pass.

```bash
git add src/lib/member-account-view-state.ts src/components/member/MemberOutcomePanel.tsx src/routes/_authenticated/member/index.tsx src/routes/_authenticated/member/packages.tsx src/routes/_authenticated/member/bookings.tsx src/routes/_authenticated/member/account.tsx src/routes/_authenticated/plans.tsx 'src/routes/_authenticated/receipts/$id.tsx' src/routes/payment-result.tsx tests/unit/memberAccountViewState.test.ts
git commit -m "fix: normalize member recovery states"
```

---

## Task 9: Harden authenticated shells, instructor attendance, and admin data patterns

**Files:**

- Create: `src/lib/attendance-view-state.ts`
- Create: `src/components/admin/AdminDestructiveAction.tsx`
- Test: `tests/unit/authenticatedShellAccessibility.test.mjs`
- Test: `tests/unit/attendanceViewState.test.ts`
- Modify: `src/components/app-shell/AppShell.tsx`
- Modify: `src/routes/_authenticated/route.tsx`
- Modify: `src/routes/_authenticated/instructor/route.tsx`
- Modify: `src/routes/_authenticated/instructor/index.tsx`
- Modify: `src/routes/_authenticated/admin/route.tsx`
- Modify: `src/routes/_authenticated/admin/messages.tsx`
- Modify: `src/routes/_authenticated/admin/attendance.tsx`
- Modify: `src/components/admin-shared/index.tsx`
- Modify: `src/components/admin/AdminClassDangerZone.tsx`

- [ ] **Step 1: Write failing shell landmark and focus tests**

Assert one `main` landmark per authenticated page, localized drawer/close labels, focus return to the menu trigger, bottom-navigation content clearance, active-route semantics, and no nested `<main>` in admin messages.

Run: `bun test tests/unit/authenticatedShellAccessibility.test.mjs`

Expected: FAIL on the nested admin messages landmark and missing explicit shell contracts.

- [ ] **Step 2: Write failing attendance state tests**

Cover roster loading, empty roster, present, absent, late, excused, pending save, saved, save failed, and offline retry. Assert that every state has text in addition to color and pending prevents duplicate mutation.

Run: `bun test tests/unit/attendanceViewState.test.ts`

Expected: FAIL because `attendance-view-state.ts` does not exist.

- [ ] **Step 3: Repair shells and attendance presentation**

Keep role navigation and route guards unchanged. Remove the messages `<main>`, use `ResponsiveDataList` for roster data, derive attendance presentation from existing attendance values, and add persistent save outcomes with a polite status region.

- [ ] **Step 4: Standardize destructive confirmations**

```tsx
export interface AdminDestructiveActionProps {
  objectName: string;
  consequence: string;
  confirmLabel: string;
  pendingLabel: string;
  onConfirm: () => Promise<void>;
}
```

The shared pattern names the object and consequence, prevents duplicate confirm, restores focus after cancellation, and keeps failure copy visible. Apply it to `AdminClassDangerZone` without changing its mutation.

- [ ] **Step 5: Verify and commit**

Run: `bun test tests/unit/authenticatedShellAccessibility.test.mjs tests/unit/attendanceViewState.test.ts tests/unit/adminClassWorkflow.test.mjs tests/unit/adminClassFormValidation.test.ts && bun run build`

Expected: all commands pass.

```bash
git add src/lib/attendance-view-state.ts src/components/app-shell/AppShell.tsx src/components/admin-shared/index.tsx src/components/admin/AdminDestructiveAction.tsx src/components/admin/AdminClassDangerZone.tsx src/routes/_authenticated/route.tsx src/routes/_authenticated/instructor/route.tsx src/routes/_authenticated/instructor/index.tsx src/routes/_authenticated/admin/route.tsx src/routes/_authenticated/admin/messages.tsx src/routes/_authenticated/admin/attendance.tsx tests/unit/authenticatedShellAccessibility.test.mjs tests/unit/attendanceViewState.test.ts
git commit -m "fix: harden authenticated role workflows"
```

---

## Task 10: Migrate remaining admin tables, forms, reports, and messaging states

**Files:**

- Test: `tests/unit/adminUiContracts.test.mjs`
- Modify: `src/routes/_authenticated/admin/bookings.tsx`
- Modify: `src/routes/_authenticated/admin/classes/index.tsx`
- Modify: `src/routes/_authenticated/admin/credits.tsx`
- Modify: `src/routes/_authenticated/admin/instructors.tsx`
- Modify: `src/routes/_authenticated/admin/kids.tsx`
- Modify: `src/routes/_authenticated/admin/members/index.tsx`
- Modify: `src/routes/_authenticated/admin/payments.tsx`
- Modify: `src/routes/_authenticated/admin/plans.tsx`
- Modify: `src/routes/_authenticated/admin/programs.tsx`
- Modify: `src/routes/_authenticated/admin/reports.tsx`
- Modify: `src/routes/_authenticated/admin/rooms.tsx`
- Modify: `src/routes/_authenticated/admin/settings.tsx`
- Modify: `src/routes/_authenticated/admin/templates.tsx`
- Modify: `src/components/admin/ConciergeCommandCenter.tsx`
- Modify: `src/components/admin/DeliveryMonitoringConsole.tsx`

- [ ] **Step 1: Add failing admin UI contract checks**

Assert captioned/labeled responsive data, persistent empty/loading/error states, explicit filter labels, 44×44 actions, localized icon buttons, destructive confirmation usage, and no horizontal page overflow at 360 CSS pixels.

Run: `bun test tests/unit/adminUiContracts.test.mjs`

Expected: FAIL for each unmigrated route family.

- [ ] **Step 2: Migrate data-heavy routes in three reviewable batches**

Batch A: bookings, classes, members, instructors. Batch B: credits, payments, plans, programs. Batch C: reports, rooms, kids, settings, templates, concierge, and delivery monitoring. Use `ResponsiveDataList`, `AsyncState`, shared field messages, and the destructive action pattern; preserve query keys, server functions, filtering, exports, and mutations.

- [ ] **Step 3: Verify after each batch**

Run after each batch: `bun test tests/unit/adminUiContracts.test.mjs && bunx tsc --noEmit`

Expected: the contract test progressively passes for the completed batch and TypeScript remains clean.

- [ ] **Step 4: Run admin regression tests**

Run: `bun test tests/unit/adminBookingAlerts.test.mjs tests/unit/adminClassFormValidation.test.ts tests/unit/adminClassWorkflow.test.mjs tests/unit/adminNotificationCampaigns.test.mjs tests/unit/adminOverviewBookings.test.ts tests/unit/conciergePresentation.test.mjs tests/unit/deliveryMonitoring.test.mjs`

Expected: all tests pass.

- [ ] **Step 5: Lint, build, and commit**

Run: `bun run lint && bun run build`

Expected: zero lint errors, no new warnings in touched files, build passes.

```bash
git add src/routes/_authenticated/admin/bookings.tsx src/routes/_authenticated/admin/classes/index.tsx src/routes/_authenticated/admin/credits.tsx src/routes/_authenticated/admin/instructors.tsx src/routes/_authenticated/admin/kids.tsx src/routes/_authenticated/admin/members/index.tsx src/routes/_authenticated/admin/payments.tsx src/routes/_authenticated/admin/plans.tsx src/routes/_authenticated/admin/programs.tsx src/routes/_authenticated/admin/reports.tsx src/routes/_authenticated/admin/rooms.tsx src/routes/_authenticated/admin/settings.tsx src/routes/_authenticated/admin/templates.tsx src/components/admin/ConciergeCommandCenter.tsx src/components/admin/DeliveryMonitoringConsole.tsx tests/unit/adminUiContracts.test.mjs
git commit -m "fix: unify responsive admin interaction patterns"
```

---

## Task 11: Split locale catalogs and centralize bidi formatting

**Files:**

- Create: `src/lib/i18n/types.ts`
- Create: `src/lib/i18n/runtime.ts`
- Create: `src/lib/i18n/catalogs/core.ts`
- Create: `src/lib/i18n/catalogs/member.ts`
- Create: `src/lib/i18n/catalogs/instructor.ts`
- Create: `src/lib/i18n/catalogs/admin.ts`
- Create: `src/lib/bidi-format.ts`
- Test: `tests/unit/i18nNamespaces.test.ts`
- Test: `tests/unit/bidiFormat.test.ts`
- Modify: `src/lib/i18n.ts`
- Modify: `src/components/ui/bidi.tsx`
- Modify: `src/routes/_authenticated/member/route.tsx`
- Modify: `src/routes/_authenticated/instructor/route.tsx`
- Modify: `src/routes/_authenticated/admin/route.tsx`

- [ ] **Step 1: Write failing namespace and fallback tests**

```ts
test("loads only the requested role namespace", async () => {
  const runtime = createI18nRuntime({ language: "ar", core: coreCatalog });
  await runtime.ensureNamespaces(["member"]);
  expect(runtime.loadedNamespaces()).toEqual(["core", "member"]);
  expect(runtime.t("member.schedule.title")).not.toBe("member.schedule.title");
});

test("falls back to Hebrew for a missing localized key", () => {
  expect(resolveMessage({ language: "ar", key: "core.support.title", catalogs })).toBe(catalogs.he.core.support.title);
});
```

Run: `bun test tests/unit/i18nNamespaces.test.ts tests/unit/i18n.test.mjs`

Expected: FAIL because namespace loading does not exist.

- [ ] **Step 2: Write failing bidi formatter tests**

Cover email, phone, URL, currency, identifier, and time range in all three document directions. Outputs must isolate neutral/Latin sequences without reversing surrounding punctuation.

Run: `bun test tests/unit/bidiFormat.test.ts`

Expected: FAIL because the shared formatter does not exist.

- [ ] **Step 3: Extract typed catalogs with an eager core**

`core` contains public navigation, auth, errors, shared actions, and public route copy. Role layouts await only their namespace via dynamic import before rendering:

```ts
const namespaceLoaders = {
  member: () => import("./catalogs/member"),
  instructor: () => import("./catalogs/instructor"),
  admin: () => import("./catalogs/admin"),
} satisfies Record<Exclude<MessageNamespace, "core">, () => Promise<NamespaceModule>>;
```

Retain the public `useI18n()` and `t()` signatures so route consumers migrate without behavior changes. Keep a typed Hebrew fallback and log missing keys only in development.

- [ ] **Step 4: Centralize isolated values**

```tsx
export function BidiValue({ kind, children }: { kind: BidiKind; children: React.ReactNode }) {
  return <bdi dir={kind === "currency" ? "auto" : "ltr"}>{children}</bdi>;
}
```

Route-level email, phone, URL, currency, identifier, and time-range markup must use the shared component or formatter.

- [ ] **Step 5: Verify translation completeness and chunks**

Run: `bun test tests/unit/i18nNamespaces.test.ts tests/unit/bidiFormat.test.ts tests/unit/i18n.test.mjs tests/unit/mobileAuditLocalization.test.ts && bun run build`

Expected: tests pass; build output contains separate member, instructor, and admin locale chunks; the public entry chunk does not contain admin-only keys.

- [ ] **Step 6: Commit locale architecture**

```bash
git add src/lib/i18n.ts src/lib/i18n src/lib/bidi-format.ts src/components/ui/bidi.tsx src/routes/_authenticated/member/route.tsx src/routes/_authenticated/instructor/route.tsx src/routes/_authenticated/admin/route.tsx tests/unit/i18nNamespaces.test.ts tests/unit/bidiFormat.test.ts
git commit -m "perf: split locale catalogs by route family"
```

---

## Task 12: Reduce global CSS and remove arbitrary visual values

**Files:**

- Create: `src/styles/base.css`
- Create: `src/styles/public.css`
- Create: `src/styles/member.css`
- Create: `src/styles/admin.css`
- Create: `tools/ui-audit/check-style-contract.ts`
- Test: `tests/unit/styleContract.test.ts`
- Modify: `src/styles.css`
- Modify: `src/routes/__root.tsx`
- Modify: `src/components/public/PublicShell.tsx`
- Modify: `src/routes/_authenticated/member/route.tsx`
- Modify: `src/routes/_authenticated/admin/route.tsx`
- Modify: `src/components/member/PremiumClassCard.tsx`
- Modify: `src/lib/lesson-card-variants.ts`

- [ ] **Step 1: Write a failing style-contract test**

The checker must report hardcoded hex/rgb/hsl values outside token definitions and approved image gradients, physical directional properties in migrated files, body-copy use of decorative gold, duplicate breakpoint recipes, and new `!important` declarations.

Run: `bun test tests/unit/styleContract.test.ts`

Expected: FAIL with the current hardcoded logo/accent values and global route CSS.

- [ ] **Step 2: Split CSS by loading boundary**

Keep reset, semantic tokens, shared typography, and primitives in `base.css`. Import `public.css` from `PublicShell`, `member.css` from the member layout, and `admin.css` from the admin layout so Vite can keep route-only rules out of public entry chunks. `styles.css` becomes the compatibility entry while migration completes.

- [ ] **Step 3: Move arbitrary presentation values into tokens**

Replace the hardcoded `PremiumLogoMark` and `PROGRAM_ACCENTS` values with semantic/component token references. Remove confirmed-unused compatibility rules only after `rg` and the visual harness show no consumers.

- [ ] **Step 4: Verify and commit**

Run: `bun test tests/unit/styleContract.test.ts tests/unit/lessonCardVariants.test.mjs && bun run build`

Expected: tests pass and route CSS emits as separate chunks.

```bash
git add src/styles src/styles.css src/routes/__root.tsx src/components/public/PublicShell.tsx src/routes/_authenticated/member/route.tsx src/routes/_authenticated/admin/route.tsx src/components/member/PremiumClassCard.tsx src/lib/lesson-card-variants.ts tools/ui-audit/check-style-contract.ts tests/unit/styleContract.test.ts
git commit -m "perf: split route css and enforce style contracts"
```

---

## Task 13: Build the complete role, language, viewport, and state matrix

**Files:**

- Create: `tools/ui-audit/scenarios/public.tsx`
- Create: `tools/ui-audit/scenarios/member.tsx`
- Create: `tools/ui-audit/scenarios/instructor.tsx`
- Create: `tools/ui-audit/scenarios/admin.tsx`
- Create: `tools/ui-audit/capture.ts`
- Create: `tools/ui-audit/validate-manifest.ts`
- Create: `tools/ui-audit/axe.ts`
- Create: `tests/unit/uiAuditManifest.test.ts`
- Modify: `tools/ui-audit/fixtures.ts`
- Modify: `package.json`
- Modify: `bun.lock`

- [ ] **Step 1: Encode the route-state matrix as typed scenarios**

Each row in `docs/design/route-state-matrix.md` must map to a scenario with evidence kind `visual`, `static`, `redirected`, or `blocked`. Risk-tier A scenarios require all three languages and all six viewports; lower tiers follow the approved matrix but may not omit a documented state.

```ts
export interface ScenarioEvidence {
  scenarioId: string;
  kind: "visual" | "static" | "redirected" | "blocked";
  languages: readonly AuditLanguage[];
  viewports: readonly AuditViewport[];
  expectedLandmarks: { main: 1 };
}
```

- [ ] **Step 2: Write the failing manifest completeness test**

The test parses the Markdown matrix, loads the scenario registry, and fails on missing IDs, duplicate IDs, omitted languages/viewports, or absent state labels.

Run: `bun test tests/unit/uiAuditManifest.test.ts`

Expected: FAIL until every matrix row is represented.

- [ ] **Step 3: Add non-mutating fixture adapters**

Extract pure presentation components where necessary and construct deterministic props for guest, member, instructor, and admin states. Scenario modules may import those presentation components and pure view-state functions only; `validate-manifest.ts` must reject imports containing `.functions`, `.server`, Supabase, or mutation hooks.

- [ ] **Step 4: Add capture and axe scripts**

Install the browser-audit libraries and commit their exact lockfile resolutions:

Run: `bun add --dev @axe-core/playwright lighthouse`

Expected: `package.json` and `bun.lock` contain only the two new development dependencies and their transitive resolution changes.

Add scripts:

```json
{
  "ui-audit:capture": "bun tools/ui-audit/capture.ts",
  "ui-audit:a11y": "bun tools/ui-audit/axe.ts",
  "ui-audit:validate": "bun tools/ui-audit/validate-manifest.ts"
}
```

Capture names must be `<role>-<route>-<language>-<viewport>-<state>.png`. Axe output must include scenario ID, language, viewport, rule ID, impact, selector, and help URL.

- [ ] **Step 5: Verify the evidence harness**

Run: `bun test tests/unit/uiAuditManifest.test.ts && bun run ui-audit:validate && bun run ui-audit:build && bun run ui-audit:capture && bun run ui-audit:a11y`

Expected: manifest and build pass; all expected screenshots exist; axe reports zero serious or critical violations.

- [ ] **Step 6: Commit the complete matrix**

```bash
git add tools/ui-audit/scenarios/public.tsx tools/ui-audit/scenarios/member.tsx tools/ui-audit/scenarios/instructor.tsx tools/ui-audit/scenarios/admin.tsx tools/ui-audit/capture.ts tools/ui-audit/validate-manifest.ts tools/ui-audit/axe.ts tools/ui-audit/fixtures.ts package.json bun.lock tests/unit/uiAuditManifest.test.ts
git commit -m "test: cover the complete ui state matrix"
```

---

## Task 14: Enforce bundle and Core Web Vitals budgets

**Files:**

- Create: `tools/ui-audit/bundle-budget.ts`
- Create: `tools/ui-audit/lighthouse.ts`
- Create: `tools/ui-audit/performance-budget.json`
- Create: `tests/unit/performanceBudget.test.ts`
- Modify: `package.json`
- Modify: `vite.config.ts`
- Modify: `src/routes/__root.tsx`
- Modify: `src/routes/_authenticated/admin/reports.tsx`
- Modify: `src/routes/_authenticated/admin/messages.tsx`
- Modify: `src/components/admin/ConciergeCommandCenter.tsx`
- Modify: `src/components/admin/DeliveryMonitoringConsole.tsx`

### Trace-led scope amendment (local production compression)

- Modify: `scripts/serve-production.mjs`
- Create: `tests/unit/serveProductionCompression.test.mjs`

The first complete local production mobile matrix measured LCP at 9,528–11,590 ms while
CLS remained 0.0011–0.0097, Lighthouse accessibility remained 1.0, and serious/critical
axe findings remained zero. The saved Lighthouse evidence attributes 7,502–8,702 ms of
render-blocking delay to `assets/base-6F7JFr5Q.css` (377,833 transferred bytes) and another
1,652–2,102 ms to `assets/index-B0GZ7Rzl.css` (52,993 transferred bytes). Actual local TTFB
was 2–44 ms, the critical request chain completed in 83–255 ms, JavaScript boot work was
122–217 ms, and the LCP phase breakdown was 145–256 ms. The local production server did
not negotiate compression for compressible static assets, so simulated mobile throttling
magnified uncompressed CSS rather than server latency or LCP asset discovery.

Ruling: add deterministic Brotli/gzip content negotiation to the local production static
server, including correct `Vary`, `Content-Encoding`, encoded `Content-Length`, cache,
`HEAD`, and safe identity-fallback behavior. Do not edit the speculative root/admin
lazy-load targets because this trace does not identify them as the LCP blocker.

### Trace-led scope amendment (source-aware Tailwind generation)

- Modify: `src/styles/base.css`
- Modify: `src/styles/member.css`
- Modify: `src/styles/admin.css`
- Create: `src/styles/instructor.css`
- Modify: `src/routes/_authenticated/member/route.tsx`
- Modify: `src/routes/_authenticated/admin/route.tsx`
- Modify: `src/routes/_authenticated/instructor/route.tsx`
- Modify: `tools/ui-audit/bundle-budget.ts`
- Modify: `tools/ui-audit/performance-budget.json`
- Modify: `tools/ui-audit/check-style-contract.ts`
- Modify: `tools/ui-audit/route-style-contract.json`
- Modify: `tests/unit/performanceBudget.test.ts`
- Modify: `tests/unit/styleContract.test.ts`

The compressed, environment-backed HE diagnostic first proves intended DOM rather than an
error fallback: `/` redirects to the intended auth page, `/auth` renders `main.auth-page`,
and `/member/schedule` renders `main.public-safe-page`. LCP remains 4,841 ms, 4,354 ms,
and 5,607 ms respectively. All three still load `assets/base-6F7JFr5Q.css`: 46,654 bytes
transferred, 376,884 decoded bytes, and 1,652–1,653 ms of simulated render-blocking time,
plus `assets/index-B0GZ7Rzl.css`: 10,074 transferred, 52,045 decoded, and 602–603 ms.
The base Tailwind directive scans all of `src`, so public pages compile role-only route
utilities even though Task 12 correctly isolates authored public/member/admin CSS.

Ruling: make Tailwind utility generation source-aware. Keep Tailwind theme/preflight,
tokens, shared primitives, shared guest/member schedule rules, AppShell/instructor shared
contracts, and toaster rules in root-owned `base.css`; generate only utilities from public
and shared sources there. Generate member, instructor, and admin route utilities in the
owning late-loaded role sheets, referencing base theme without duplicating preflight.
Preserve Task 12's base-first/active-route-second order and selector ownership. Assert from
the Vite manifest and emitted CSS that the public closure excludes representative role-only
utility markers. Do not change the home redirect or schedule illustration unless a new
post-split trace still fails LCP.

### Post-split bounded performance ruling

An additional bounded authored-ownership probe created `src/styles/member-shared.css` and
`src/styles/pulse.css` and temporarily changed `PremiumClassCard.tsx` and `StudioPulse.tsx`.
The executable Task 12 cascade proof rejected it: `member-eyebrow`, `member-card`, AppShell
frame rules, and CTA primitives are consumed across public/member/admin boundaries, while
the source-level proof intentionally does not treat a nested CSS import as equivalent
owner order. That unsafe probe was reverted in full before acceptance.

The accepted source-aware utility pass preserves all authored shared rules and reduces
root-owned CSS from 376,884 to 331,921 raw bytes (45,449 gzip); the deterministic public
CSS closure is 383,966 raw / 55,010 gzip. Its valid environment-backed HE checkpoint
measured home at 4,842 ms LCP, auth at 4,279 ms LCP, and public schedule at 5,605 ms LCP.
All three retained passing CLS, accessibility 1.0, and zero serious/critical axe findings.

The accepted direct-auth trace still attributes 1,502 ms of simulated render blocking to
root CSS and 603 ms to Fontsource CSS. Lighthouse estimates at most 750 ms LCP savings from
all unused JavaScript. The largest public JavaScript contributor is TanStack Start's
generated client entry (about 400 KB raw / 123 KB gzip); it owns framework boot and route
metadata rather than an application route-level feature. The next unused chunk is the
Supabase client (about 202 KB raw / 51 KB gzip), which direct auth needs for session restore
and sign-in. Even completely removing the reported savings cannot bring 4,279 ms below
2,500 ms, and no SSR-compatible application route-level split is identified by the trace.
Per the bounded-pass rule, stop without speculative root/auth changes or a full nine-route
rerun; preserve the valid three-route evidence and record the local Lighthouse
simulated-target limitation.

- [ ] **Step 1: Write failing budget tests**

```ts
test("public entry excludes role-only modules", () => {
  const manifest = loadViteManifest(".output/public/.vite/manifest.json");
  expect(importClosure(manifest, "src/routes/index.tsx")).not.toContain("src/routes/_authenticated/admin/reports.tsx");
  expect(importClosure(manifest, "src/routes/index.tsx")).not.toContain("src/lib/i18n/catalogs/admin.ts");
});
```

Also assert configured gzip limits for public JS, public CSS, route chunks, and total fonts.

Run: `bun test tests/unit/performanceBudget.test.ts`

Expected: FAIL until the analyzer and budget file exist.

- [ ] **Step 2: Generate a deterministic bundle manifest**

Enable Vite manifest output without changing SSR behavior. `bundle-budget.ts` traverses static imports, records raw and gzip bytes, fails on forbidden role imports in public routes, and writes `artifacts/ui-audit/current/bundle-manifest.json`.

- [ ] **Step 3: Optimize only trace-proven bottlenecks**

Use the manifest and Lighthouse trace to lazy-load the listed reports, charts, messaging consoles, and admin-only components from their route boundary. In `__root.tsx`, preload only the local font faces used above the fold and size or prioritize the existing LCP asset identified by the trace. Do not add skeletons to hide synchronous work. If the trace identifies a different module, amend this plan with that exact file before editing it.

The first trace identified `scripts/serve-production.mjs`, not the speculative root/admin
targets, through the uncompressed render-blocking CSS evidence recorded above. Implement
and verify that amendment before considering any additional application change.

- [ ] **Step 4: Add production Lighthouse runs**

`lighthouse.ts` builds once, starts the repository production server on an unused local port, audits public home/auth/schedule in HE/AR/EN with mobile throttling, stops the server, and asserts LCP `<2500ms`, CLS `<0.1`, accessibility `1.0`, and no serious/critical axe violations. INP remains a Playwright interaction measurement because a cold navigation does not establish representative INP.

- [ ] **Step 5: Verify budgets**

Run: `bun run build && bun tools/ui-audit/bundle-budget.ts && bun tools/ui-audit/lighthouse.ts`

Expected: bundle budgets pass; each route meets LCP and CLS targets in the stable local production server. If server overhead dominates LCP, save the trace and run the same command against the approved staging URL before proceeding.

- [ ] **Step 6: Commit performance enforcement**

```bash
git add tools/ui-audit/bundle-budget.ts tools/ui-audit/lighthouse.ts tools/ui-audit/performance-budget.json tests/unit/performanceBudget.test.ts package.json vite.config.ts src/routes/__root.tsx src/routes/_authenticated/admin/reports.tsx src/routes/_authenticated/admin/messages.tsx src/components/admin/ConciergeCommandCenter.tsx src/components/admin/DeliveryMonitoringConsole.tsx
git commit -m "perf: enforce ui bundle and web vital budgets"
```

---

## Task 15: Complete manual accessibility, responsive, and localization verification

**Files:**

- Create: `docs/design/accessibility-verification.md`
- Create: `docs/design/visual-regression-results.md`
- Create: `tools/ui-audit/interaction-checks.ts`
- Test: `tests/unit/accessibilityEvidence.test.ts`

- [ ] **Step 1: Add a failing evidence-completeness test**

Require recorded results for keyboard traversal, Enter/Space activation, Escape, focus trap/return, 200% zoom, 400% reflow-sensitive zoom, reduced motion, forced colors, VoiceOver, and representative interaction latency on each risk-tier A journey.

Run: `bun test tests/unit/accessibilityEvidence.test.ts`

Expected: FAIL until the evidence documents contain every required route/journey entry.

- [ ] **Step 2: Automate interaction checks where reliable**

`interaction-checks.ts` runs keyboard-only flows in the fixture app, checks visible focus against white/ivory/sand/navy/image surfaces, verifies dialog focus trap/return, tests reduced motion and forced colors, checks horizontal overflow at 200%/400%, and records interaction latency under 200 ms for schedule filtering, dialog opening, and table filtering.

- [ ] **Step 3: Run and document manual VoiceOver journeys**

Record pass/fail and concise evidence for auth, booking, cancellation, payment result, instructor attendance, destructive admin confirmation, and global navigation in HE/AR/EN. Resolve every failure before marking the row complete.

- [ ] **Step 4: Compare the visual matrix**

Inspect all generated captures for hierarchy, clipping, safe areas, logical alignment, locale expansion, overlays, and state clarity. Log the before/after artifact paths and disposition of every discrepancy.

- [ ] **Step 5: Verify and commit evidence**

Run: `bun run ui-audit:interactions && bun test tests/unit/accessibilityEvidence.test.ts`

Expected: automated checks pass and every required manual row is explicitly marked passed with evidence.

```bash
git add docs/design/accessibility-verification.md docs/design/visual-regression-results.md tools/ui-audit/interaction-checks.ts tests/unit/accessibilityEvidence.test.ts
git commit -m "test: document complete accessibility verification"
```

---

## Task 16: Run the final release gate and rescore the audit

**Files:**

- Modify: `docs/design/ui-ux-audit.md`
- Modify: `docs/design/design-inventory.md`
- Modify: `docs/design/ui-migration-plan.md`
- Modify: `docs/design/route-state-matrix.md`
- Modify: `docs/design/cloud-core-design-system-proposal.md`
- Create: `artifacts/ui-audit/final/manifest.json`
- Create: `artifacts/ui-audit/final/accessibility.json`
- Create: `artifacts/ui-audit/final/bundle-manifest.json`
- Create: `artifacts/ui-audit/final/lighthouse/`
- Create: `artifacts/ui-audit/final/screenshots/`

- [ ] **Step 1: Run the complete automated gate**

Run: `bun test tests/unit tests/integration`

Expected: all unit and integration tests pass.

Run: `bun run lint`

Expected: zero errors; touched files introduce no warnings. Record the repository-wide legacy warning count separately if it remains nonzero.

Run: `bun run build && bun run ui-audit:validate && bun run ui-audit:capture && bun run ui-audit:a11y && bun tools/ui-audit/bundle-budget.ts && bun tools/ui-audit/lighthouse.ts && bun run ui-audit:interactions`

Expected: production build, complete matrix, visual capture, accessibility, bundle, Lighthouse, and interaction gates all pass.

- [ ] **Step 2: Reconcile every original finding**

For each P1–P3 item in `ui-ux-audit.md`, record `fixed` or `not reproducible`, the validating test, and the artifact path. No finding may be closed solely by assertion.

- [ ] **Step 3: Rescore all eight rubric categories**

Award full credit only where the deduction is removed and evidence exists. If any target remains unmet, keep the honest score, record the exact blocker, and do not label the project 100/100.

- [ ] **Step 4: Update migration and inventory documents**

Mark migrated tokens/components/routes, update the proposed design system to its implemented contracts, list any compatibility aliases still present with an owner/removal date, and ensure the route-state matrix links to its final evidence.

- [ ] **Step 5: Review the complete diff**

Run: `git status --short && git diff --stat && git diff --check`

Expected: no whitespace errors, no environment files, no production fixtures, no database/business-rule changes, and no unrelated user files staged.

- [ ] **Step 6: Commit the final audit evidence**

```bash
git add docs/design/ui-ux-audit.md docs/design/design-inventory.md docs/design/ui-migration-plan.md docs/design/route-state-matrix.md docs/design/cloud-core-design-system-proposal.md artifacts/ui-audit/final/manifest.json artifacts/ui-audit/final/accessibility.json artifacts/ui-audit/final/bundle-manifest.json artifacts/ui-audit/final/lighthouse artifacts/ui-audit/final/screenshots
git commit -m "docs: publish final ui quality evidence"
```

## Completion Checklist

- [ ] All original P1–P3 findings have linked evidence and no open deduction.
- [ ] Guest, member, instructor, and admin state coverage is complete without production accounts or data.
- [ ] HE/AR/EN pass the six-viewport visual matrix where required.
- [ ] All pages expose one main landmark and a working skip path.
- [ ] Keyboard, focus, reduced-motion, forced-colors, zoom/reflow, and VoiceOver checks pass.
- [ ] LCP, CLS, representative interaction, bundle, and accessibility budgets pass.
- [ ] `bun test tests/unit tests/integration`, `bun run lint`, and `bun run build` pass at the final commit.
- [ ] No backend, schema, role, booking, payment, or production-data behavior changed.
- [ ] The final score is supported by evidence rather than an aspirational label.
