# Notification Automation V1 Report

## Current automatic scope

Automatic OpenWA delivery is enabled only for `payment_confirmed.whatsapp`.

Rows are eligible for automatic delivery only when they match all of the following:

- `trigger_type = payment_confirmed`
- `channel = whatsapp`
- `provider = openwa`
- `status = queued`
- due now according to `scheduled_for` and `next_attempt_at`

Other WhatsApp events remain outside the automatic worker scope in V1. In particular, `receipt_issued.whatsapp` is still created as a manual-review notification row and is not auto-sent.

## Delivery path

Queued delivery now runs through the internal worker route:

- `POST /api/internal/notifications/openwa-run`
- requires `Authorization: Bearer <OPENWA_AUTOMATION_TOKEN>`
- accepts optional JSON body: `{ "limit": 25 }`

The route executes the payment-confirmed OpenWA queue worker and returns:

```json
{
  "ok": true,
  "claimed": 0,
  "sent": 0,
  "failed": 0,
  "skipped": 0
}
```

This route is intentionally narrow and internal-only. It is suitable for manual runs now and for a future scheduler hook later.

## Payment approval boundary

Payment approval remains best-effort with respect to notifications:

- admin payment approval, credit grant, and receipt issuance stay on the existing approval path
- notification rows are created best-effort after approval
- OpenWA delivery happens later through the internal worker route
- OpenWA send failures or retries do not roll back payment approval

## Manual QA checklist

1. Ensure `OPENWA_BASE_URL`, `OPENWA_API_KEY`, `OPENWA_SESSION_ID`, and `OPENWA_AUTOMATION_TOKEN` are configured in the server runtime.
2. Approve a real test package payment for a member with a valid WhatsApp number.
3. Confirm a `payment_confirmed.whatsapp` row is present in `notification_logs` with `provider = openwa`.
4. Run `POST /api/internal/notifications/openwa-run` with the bearer token and an optional `limit`.
5. Confirm the WhatsApp message is delivered and the row becomes `sent`.
6. Confirm `receipt_issued.whatsapp` remains a manual-review row and is not auto-sent by the worker.
7. Repeat the worker run and confirm the already-sent row is not sent again.
