# Milestone 2 baseline: checkout and deletion request

Recorded before member-facing implementation changes on `codex/member-ui-ux-improvements`.

## Route coverage

| Route / source                                                       | Existing state and interaction                                                                                                                                                                                                                                                                                                           | P2 finding                          |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `/checkout` — `src/routes/checkout.tsx`                              | Loads active ILS public plans, lets a visitor select one and collect details/terms, saves `cloud-core-checkout-draft` in session storage, then navigates to `/auth`. It does not create a payment session or charge a member. A price was shown beside the selected plan while nearby wording called the full price a post-sign-in step. | Original P2-02 signal; finalized scope is P1-01 context |
| `/member/packages` — `src/routes/_authenticated/member/packages.tsx` | Loads member plans, opens the payment method sheet, and sends plan ID/method/recurring/consent to `createCheckoutSession`. When the existing server response is `ready` with `checkout_url`, the browser navigates to HYP. Existing pending state disables the action; failed session creation was toast-only.                           | P2-02                               |
| `/payment-result` — `src/routes/payment-result.tsx`                  | Renders success, pending, cancelled, failed and missing-reference states from the existing authoritative payment result. It is not modified in this milestone.                                                                                                                                                                           | P2-02 evidence / no behavior change |
| `/member/account` — `src/routes/_authenticated/member/account.tsx`   | The button called `requestMyAccountDeletion` directly. A success or duplicate response only displayed a toast.                                                                                                                                                                                                                           | P2-03                               |
| `requestMyAccountDeletion` — `src/lib/member.functions.ts`           | Finds an existing `requested`/`reviewing` request and returns `duplicate`; otherwise inserts a new `requested` record. It does not delete the account, sign the member out, expose an identifier, or change booking/payment access. This server function is not modified.                                                                | P2-03                               |

## Authoritative payment and deletion facts

- The public checkout’s displayed price is supplied in its existing loader as an active ILS plan value; it is not a payment handoff.
- The authenticated purchase route sends only the selected plan and payment choice. The existing `createCheckoutSession` server function loads plan price/currency/credits/validity and creates the payment/session. The UI does not calculate a total.
- A plan’s existing presentation indicates monthly recurring card plans; the existing sheet and server request already send the recurring flag. The milestone only makes that existing information more scannable.
- The deletion success response guarantees only that a request is submitted or already open. It does not guarantee deletion, a schedule, or a support outcome.

## Baseline screenshot constraints

Public checkout screenshots can be taken locally without submitting payment. Authenticated package and account states need an approved safe member and mocked/non-production payment/deletion outcome. No credentials or safe fixture were provided at baseline, so those views were explicitly blocked rather than substituted with a production interaction; a later local fixture resolves route/data access only.
