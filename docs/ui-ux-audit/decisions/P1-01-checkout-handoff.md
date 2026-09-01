# P1-01 decision: checkout handoff

Status: **decision required — no behavior implemented in milestone 2**.

## 1. Current behavior

`/checkout` collects a plan selection, contact details and terms consent in the browser. On submit it saves a `cloud-core-checkout-draft` in session storage and navigates to `/auth`. The authenticated packages route does not currently restore that draft or automatically select its plan. A signed-in member later chooses a package and payment method on `/member/packages`; `createCheckoutSession` then produces an external HYP URL and the browser redirects there.

## 2. Routes and source files

- `/checkout` — `src/routes/checkout.tsx`
- `/auth` — authentication entry and draft-adjacent behavior
- `/member/packages` — `src/routes/_authenticated/member/packages.tsx`
- Payment-session contract — `src/lib/receipts.functions.ts`
- Return handling — `src/routes/payment-result.tsx`, `src/routes/api/public/payments/hyp.return.ts`

## 3. Original audit finding

P1-01: public checkout collects payment-intent data before authentication but does not visibly restore it after sign-in. The journey can feel broken and it is unclear whether the selected plan was retained.

## 4. User problem

Members may think they are buying a chosen package, then lose that context after authentication and have to find it again. The existing label historically also suggested payment before the actual HYP step.

## 5. Business risk

Draft restoration touches consent, login/registration, plan availability and eventual payment intent. A wrong implementation could select an inactive plan, bypass an explicit review, or create a misleading purchase expectation.

## 6. Accessibility impact

Any returned-to state needs a heading/status announcement, preserved keyboard position, error recovery, and no surprise redirect to an external provider.

## 7. Mobile impact

At 320px, reopening a sheet or restoring long plan names must not obscure authentication errors, consent, or the primary action. Deep links and browser Back must remain unsurprising.

## 8. Backend dependencies

Active-plan lookup, plan price/currency/credits/validity, payment-session creation, HYP callback verification and entitlement activation stay server-authoritative. No schema/RLS/RPC changes are proposed by Option A.

## 9. Analytics dependencies

Preserve existing auth, package-view, payment-session and payment-result analytics. Options B/C require product approval for new funnel events and attribution rules before adding them.

## 10–16. Options

| Option | Description                                                                                                                                                     | Advantages                                                                        | Disadvantages                                                                                                              | Required data/backend/policy work                                                          | Risk   | Recommendation        |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------ | --------------------- |
| A      | Preserve the current draft-to-auth behavior; improve only its wording and visible selected-price context.                                                       | No contract, pricing, auth, redirect or analytics change; fastest and reversible. | The member must reselect the plan after sign-in.                                                                           | None beyond UI copy/evidence.                                                              | Low    | **Recommended now**   |
| B      | After authentication, restore the draft selection into `/member/packages` and show an explicit review; do not create a payment session automatically.           | Keeps context while retaining member review and server plan validation.           | Requires safe draft lifecycle, stale-plan handling, consent treatment, Back/refresh behavior and additional test coverage. | Product decision on retained personal data/consent; client state design; analytics review. | Medium | Viable after approval |
| C      | Replace public detail collection with an authenticated purchase flow where plan selection starts after sign-in, optionally preserving only an anonymous intent. | Cleanest long-term state model and clearest ownership of payment/consent.         | Larger conversion-flow/product change and possible campaign impact.                                                        | Product, legal/consent, marketing attribution, auth and payment-flow review.               | High   | Long-term candidate   |

## 17. Acceptance criteria for an approved change

1. The selected active plan is validated again after authentication; unavailable plans show recovery rather than proceeding.
2. No payment session or external redirect occurs without a visible authenticated review and explicit action.
3. Amount, currency, recurrence, credits and validity come from authoritative current plan data.
4. Draft personal data is retained only with approved privacy/consent rules and has a documented expiration/clearing policy.
5. Back, refresh, sign-out and deep-link behavior are specified and tested.
6. EN, HE and AR / RTL and LTR work at 320px through desktop with keyboard and screen reader status feedback.
7. Existing booking, payment, analytics and localization behavior remains compatible.

## 18. Current-flow diagram

```text
/checkout (select plan + details + terms)
  -> sessionStorage draft
  -> /auth
  -> /member/packages (member chooses package again)
  -> createCheckoutSession (server authoritative amount)
  -> HYP hosted payment
  -> /payment-result (authoritative result)
```

The current public checkout evidence is stored with the milestone screenshots; authenticated screenshots require an approved safe fixture.

## 19. Product-owner questions

1. Should a selected public plan be restored after sign-in, and for how long?
2. May contact details/terms consent be retained before authentication? What is the approved retention rule?
3. Is explicit package review mandatory after restoration?
4. Which conversion/attribution events are required, and which funnel drop-off is acceptable?
5. Should unknown, expired or changed plans return the member to selection, auth, or support?
