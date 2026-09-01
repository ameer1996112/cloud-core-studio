# Milestone 2 interception contract

The authenticated payment flow is `/member/packages` → `PackagePricingCard` → `PaymentMethodSheet` → `createCheckoutSession`, not the public `/checkout` information form. The application invokes TanStack Start `POST /_serverFn/<opaque-id>` endpoints. The payment payload carries `plan_id`, payment method, recurring flag, and consent. The authoritative ready response is `{ status: "ready", provider: "hyp", payment_id, checkout_url }`; the sheet’s pending mutation state plus an in-flight guard disables duplicate submit before provider navigation.

Account deletion is `/member/account` → deletion action → Radix `AlertDialog` → `requestMyAccountDeletion`. Its authenticated POST payload has optional `reason`; the success contract is `{ ok: true, status: "requested" | "reviewing", duplicate }`. Existing React Query pending state disables both trigger and confirm action; success/error feedback is a persistent `MemberFeedbackPanel` and does not itself alter the account or sign the user out.

Browser interception must occur at the `/_serverFn/` boundary and count requests without forwarding them. This pass did not complete the delayed/success/error response matrix, so this document is a discovery record, not live payment or deletion integration evidence.
