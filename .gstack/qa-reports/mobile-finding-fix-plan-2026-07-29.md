# Mobile Audit Fix Plan

**Implementation status:** Complete on 2026-07-29. All six confirmed product findings are fixed. The seeded class-detail browser regression could not run without local Supabase configuration/class data; rendered component semantics and the existing guest handoff behavior tests pass.

## Corrected scope

Production verification confirmed six findings: five medium and one low. The initial signup-button, class-card click, terms-layout, and development-only hydration observations are not shipping defects. The corrected baseline is 93/100.

## Pass 1 — Reliability

### 1. Remove the six-second signed-out auth delay

**Root cause:** `src/routes/auth.tsx` retries `getFreshSupabaseSession()` every 650ms for six seconds after the function has already returned `null`. `src/integrations/supabase/auth-session.ts` returns `null` immediately when no refresh cookie exists, so retrying a confirmed guest cannot restore anything.

**Change:**

- Remove `SESSION_RESTORE_TIMEOUT_MS`, `SESSION_RESTORE_RETRY_MS`, and `wait()`.
- Call `getFreshSupabaseSession()` once.
- If there is a user, resolve the role and redirect as today.
- If there is no user, set `restoringSession` to `false` immediately.
- If transient refresh failures need retries later, expose a typed result that distinguishes `guest` from `retryable-error`; never infer that distinction from `null`.

**Acceptance:**

- On a clean production browser with no auth cookies, `/auth` renders the email field within 1 second after `DOMContentLoaded`.
- A valid existing session still redirects to the correct role/return destination.
- The forgot-password mode never waits for session restoration.

### 2. Add regression coverage for the guest class card

The card is already wired to `setOpenClass()` and `ClassDetailSheet`; the initial dead-click report was an automation false positive. Existing unit tests invoke callbacks directly and therefore cannot prove that the rendered card is tappable.

**Change:**

- Keep the existing guest handoff test that proves the rendered schedule callback opens the selected class.
- Add a rendered-component regression for the localized accessible name and dialog relationship.
- Run the seeded tap-to-dialog browser case when local Supabase fixtures are available.

**Acceptance:**

- The rendered component and guest handoff tests pass.
- Opening and closing the sheet preserves filters and scroll position.

## Pass 2 — Accessibility

### 3. Name the class-card control

**Change:** In `src/components/visual/VisualClassCard.tsx`, add a localized `aria-label` containing the class title, time, and CTA, plus `aria-haspopup="dialog"`. Keep the existing keyboard handler unless the component is refactored to avoid nested interactive descendants.

**Acceptance:**

- Accessibility tree exposes a meaningful name instead of an unnamed `button`.
- Enter and Space open the detail dialog.

### 4. Raise type, contrast, and touch targets

**Change:**

- In `src/styles/tokens.css`, use `--text-base: 16px`, `--text-sm: 14px`, and darken `--color-text-secondary` from `#6f7a8c` to `#5f6b7e`. The proposed gray measures approximately 5.05:1 on ivory and 5.40:1 on white.
- In `src/styles.css`, give auth language buttons, password visibility, secondary/switch actions, and legal links a minimum 44×44px interactive area.
- Preserve the existing visible focus treatment.

**Acceptance:**

- All normal muted text passes 4.5:1 on every surface where it appears.
- Audited mobile controls have at least a 44×44px hit area.
- No horizontal overflow at 375px.

## Pass 3 — Localization and form quality

### 5. Replace browser-native validation

**Change:**

- Add `noValidate` to the auth form.
- Validate required fields, email shape, and password requirements before the async submit.
- Add localized field-level errors to `src/lib/i18n.ts`.
- Connect each error with `aria-invalid` and `aria-describedby`; focus the first invalid field.

**Acceptance:**

- Invalid email feedback is inline and matches English, Hebrew, or Arabic selection.
- No English browser tooltip appears in Hebrew or Arabic mode.
- Screen readers announce the relevant field error.

### 6. Finish checkout/footer localization

**Change:**

- Add `legal.checkout` in all three language dictionaries and replace literal `Checkout` text in auth and terms footers.
- In `src/routes/checkout.tsx`, reuse `getPlanDisplay()` from `src/lib/planDisplay.ts` for localized plan names and credit/member lines instead of rendering `plan.name` and the literal word `credits`.

**Acceptance:**

- Arabic and Hebrew checkout contain no unintended English package or credit copy.
- RTL number and currency ordering remains readable at 375px.

### 7. Restore mobile autofill

**Change:** In `src/routes/auth.tsx`, keep form autocomplete enabled and use `name`, `tel`, `email`/`username`, and `new-password` tokens for signup.

**Acceptance:**

- Mobile browsers/password managers can offer saved identity data.
- Signup still clears values when the user intentionally switches form modes.

## Verification gate

Before closing the findings:

1. Run the focused unit tests for auth public entry and guest schedule.
2. Run the mobile production checks against the production build.
3. Run `bun run lint` and `bun run build`.
4. Re-audit English, Hebrew, and Arabic at 375px and 390px.

Expected result: no confirmed functional defect, auth form ready in under one second for guests, localized conversion flows, WCAG AA contrast, and 44px mobile targets.
