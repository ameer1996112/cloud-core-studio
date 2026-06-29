# Cloud & Core Manual Payment Methods: Cash + Bit

## Verdict

- Implemented: YES
- Migration needed: NO
- Credit card enabled: NO
- Packages marked paid automatically: NO
- Credits granted before admin confirmation: NO

## Files changed

- `src/lib/memberRequests.functions.ts`
- `src/lib/member.functions.ts`
- `src/lib/payments.functions.ts`
- `src/lib/i18n.ts`
- `src/routes/_authenticated/member/packages.tsx`
- `src/routes/_authenticated/admin/payments.tsx`

## Schema inspection result

Existing schema already supports the required launch flow:

- `payments.method` accepts `cash`, `bit`, `card`, `transfer`, `stripe`, `other`.
- `payments.status` accepts `pending`, `paid`, `failed`, `refunded`, `partially_refunded`.
- `payments.member_id`, `plan_id`, `amount`, `currency`, `method`, `status`, `notes`, `created_at`, `paid_at` are available.
- Existing `confirm_payment_and_issue_receipt` RPC confirms payment, grants the plan/credits, creates credit transaction, and issues receipt.

No migration was run. No schema was changed.

Note: current schema keeps `paid_at` as `NOT NULL DEFAULT now()`. Pending manual payments are still controlled by `status = pending`; the admin UI uses `created_at` for display ordering.

## Member payment method flow

Member package cards now open a premium payment method sheet instead of sending a vague package request.

Available methods:

- Cash: `cash`
- Bit: `bit`
- Credit card: disabled, coming soon

When Cash or Bit is submitted:

- A `payments` row is created with `status = pending`.
- The selected method is stored as `cash` or `bit`.
- No receipt is created.
- No credits are added.
- The member sees a localized success message that the package activates after payment confirmation.
- Bit flow shows the studio phone/WhatsApp number if configured, otherwise a localized “Bit number not configured” message.

The member cannot choose or submit credit card.

## Admin confirmation flow

Admin Payments keeps using the existing hardened confirmation RPC:

- `confirm_payment_and_issue_receipt`

Admin payment table shows:

- member
- package
- amount
- method
- status
- date
- receipt
- confirm action

The manual admin record form no longer exposes credit card as an active option.

## Payment method values used

- `cash`
- `bit`

No credit-card payment is created by the member flow.

## Role / RLS result

- Member creation of pending payments is done through an authenticated server function.
- The member id is taken from the session, not from client input.
- The server validates that the plan is active and not a test plan.
- Existing payment RLS remains unchanged: members can read their own payments; admin can manage payments.
- Members and instructors cannot call the admin confirmation RPC because it checks admin role.

## Commands run

| Command                                                       | Result |
| ------------------------------------------------------------- | ------ |
| `/Users/ameeramer/.bun/bin/bunx tsc --noEmit`                 | PASS   |
| `/Users/ameeramer/.bun/bin/bun run build`                     | PASS   |
| `/Users/ameeramer/.bun/bin/bunx tsx tests/unit/i18n.test.mjs` | PASS   |

## Browser QA result

Local production server: `http://127.0.0.1:8080`

Local server note: the shell used for the local server did not have server-side Supabase env vars exported, so the server emitted missing-env warnings. Browser console checks remained clean. Production Cloud Run is expected to use its configured server-side Supabase env vars.

| Flow                                   | Result | Notes                                                |
| -------------------------------------- | ------ | ---------------------------------------------------- |
| `/auth` admin login                    | PASS   | Redirected to `/admin`; no console errors            |
| Admin opens `/admin/payments` from nav | PASS   | Payments page loaded; no console errors              |
| Admin opens record payment modal       | PASS   | Modal opened                                         |
| Admin method dropdown                  | PASS   | Cash, Bit, transfer, other visible; card not visible |
| Guest opens `/member/packages`         | PASS   | Redirected to `/auth`; no console errors             |
| Admin opens `/member/packages`         | PASS   | Redirected to `/admin`; no console errors            |

Evidence screenshot:

- `tmp/manual-payment-admin-payments.png`

## Not run

End-to-end member submission and admin confirmation were not executed because the cleaned current database only has the admin account, and this task explicitly prohibited QA/E2E/test data creation.

To fully verify the live member flow, create or provide a real launch member account, then test:

- member chooses Single Class + Cash
- pending payment appears in Admin Payments
- credits remain unchanged before confirmation
- admin confirms payment
- credits are granted
- receipt is issued
- member sees package/receipt

## Remaining issues for future credit card support

- Credit card is intentionally disabled in the member flow.
- Online checkout/provider integration remains future work.
- When card support is ready, re-enable card only after the payment provider is configured and tested end to end.
