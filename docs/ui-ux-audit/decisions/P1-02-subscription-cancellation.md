# P1-02 decision: subscription cancellation

Status: **decision required — no behavior implemented in milestone 2**.

## 1. Current behavior

On `/member/packages`, an active monthly subscription shows a “Stop monthly payment” control. It calls the existing `cancelMySubscription` mutation directly, disables while pending, displays toast success/error, and refreshes package data. The source currently does not display an effective date, remaining-credit consequence, undo rule, or confirmation step.

## 2. Routes and source files

- `/member/packages` — `src/routes/_authenticated/member/packages.tsx`
- Cancellation contract — `src/lib/subscriptions.functions.ts`
- Subscription data — `getMyPackages` in `src/lib/member.functions.ts`

## 3. Original audit finding

P1-02: a recurring payment cancellation action can be triggered without a clear confirmation of timing and consequences.

## 4. User problem

The member cannot confidently tell whether they are cancelling immediately or at the next renewal, what happens to credits, or whether the action can be undone.

## 5. Business risk

Subscription policy, card-provider behavior, retained access/credits, refunds, reactivation and customer support commitments may differ from what a frontend confirmation could imply.

## 6. Accessibility impact

A confirmation needs a labelled dialog, predictable initial/cancel focus, keyboard escape/cancel, focus return, pending state, durable result feedback and no color-only warning.

## 7. Mobile impact

The dialog must fit a 320px viewport with long Hebrew/Arabic text and leave no content behind fixed navigation. The irreversible action must not be too close to other payment controls.

## 8. Backend dependencies

`cancelMySubscription` defines the effective cancellation semantics. The package/subscription query must supply any date or state that the UI claims. No backend or payment configuration changes are proposed in Option A.

## 9. Analytics dependencies

Preserve existing cancellation event behavior. Options B/C require approved events for opened confirmation, abandonment, submitted cancellation, server outcome and reason collection, with privacy review.

## 10–16. Options

| Option | Description                                                                                                                                     | Advantages                                                              | Disadvantages                                                                     | Required data/backend/policy work                                                                             | Risk   | Recommendation                           |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------- |
| A      | Preserve direct cancellation and improve surrounding presentation only; do not claim timing/consequences unavailable from data.                 | No behavioral or contract change.                                       | Does not remove accidental-action risk.                                           | None.                                                                                                         | Low    | Safe only as temporary presentation work |
| B      | Add a confirmation dialog using only facts returned by the existing subscription data; retain the same mutation after confirmation.             | Reduces accidental activation; accessible deterministic dialog pattern. | Product must approve wording and confirmed facts; can add an interaction step.    | Verify effective date, credit/access and undo policy; approve copy.                                           | Medium | **Recommended after explicit approval**  |
| C      | Introduce a managed cancellation flow: choose end-of-period/immediate where supported, optional reason, undo window and durable history/status. | Best member clarity and support control.                                | Requires policy, payment-provider/backend changes, analytics and support process. | Subscription API/state model, payment configuration/provider capability, policy/legal/support/analytics work. | High   | Long-term candidate                      |

## 17. Acceptance criteria for an approved change

1. The screen names the exact cancellation effective date and credit/access outcome only when supplied authoritatively.
2. It never claims an immediate refund, loss of credits, or undo ability without policy/backend support.
3. A member can cancel/back out before the mutation; repeat activation is prevented while pending.
4. Success/failure has persistent, localized, focus-managed and screen-reader-friendly feedback.
5. The flow works EN/HE/AR, RTL/LTR, 320px through desktop, keyboard and 200% zoom.
6. Existing subscription, payment, booking, entitlement and analytics behavior is regression-tested.

## 18. Current-flow diagram

```text
/member/packages active subscription
  -> “Stop monthly payment”
  -> cancelMySubscription()
  -> toast outcome + package query refresh
```

An authenticated visual capture requires an approved safe member fixture; no live subscription was changed for this document.

## 19. Product-owner questions

1. Is cancellation immediate or end-of-current-period, and what is the exact localised wording?
2. What happens to unused credits, scheduled bookings and entitlement access?
3. Is cancellation reversible? If so, by whom and for how long?
4. Is a cancellation reason required/optional, and what privacy/retention rules apply?
5. Which support or retention offer, if any, is allowed before confirmation?
