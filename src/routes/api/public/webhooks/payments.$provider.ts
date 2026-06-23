import { createFileRoute } from "@tanstack/react-router";

/**
 * Generic payments webhook endpoint.
 *
 * URL: /api/public/webhooks/payments/:provider  (e.g. stripe, paddle)
 *
 * This is a structured stub. It does NOT confirm payments yet, because no
 * provider is wired. When Stripe or Paddle is enabled in a later pass,
 * the matching branch will:
 *   1. Verify the provider's signature against the raw body
 *   2. Look up payment by provider_session_id / provider_payment_id
 *   3. Insert into public.provider_events (unique on provider+event_id) for idempotency
 *   4. Call confirm_payment_and_issue_receipt RPC on success
 *
 * Returning 503 today is intentional: no provider should think this endpoint
 * is alive and accepting events until we explicitly turn it on.
 */
export const Route = createFileRoute("/api/public/webhooks/payments/$provider")({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        const provider = String(params.provider ?? "").toLowerCase();
        if (!["stripe", "paddle"].includes(provider)) {
          return new Response("Unknown provider", { status: 404 });
        }
        // Drain body so the provider doesn't see a connection-reset
        try {
          await request.text();
        } catch {
          /* ignore */
        }
        return new Response(
          JSON.stringify({
            ok: false,
            reason: "webhook_endpoint_not_configured",
            provider,
            message:
              "This studio has not enabled online payments yet. Webhook deliveries are being acknowledged but not processed.",
          }),
          { status: 503, headers: { "content-type": "application/json" } },
        );
      },
      GET: async () =>
        new Response(
          JSON.stringify({
            ok: true,
            status: "stub",
            message: "Use POST with a provider webhook payload.",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    },
  },
});
