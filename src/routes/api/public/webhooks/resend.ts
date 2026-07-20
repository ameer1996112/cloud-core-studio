import { createFileRoute } from "@tanstack/react-router";
import { ingestResendWebhook } from "@/lib/resendWebhook.server";

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/webhooks/resend")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const contentLength = Number(request.headers.get("content-length") ?? 0);
        if (Number.isFinite(contentLength) && contentLength > 1_048_576) {
          return jsonResponse({ ok: false, reason: "webhook_body_too_large" }, 413);
        }
        const result = await ingestResendWebhook({
          rawBody: await request.text(),
          svixId: request.headers.get("svix-id"),
          svixTimestamp: request.headers.get("svix-timestamp"),
          svixSignature: request.headers.get("svix-signature"),
        });
        return jsonResponse(result, result.status);
      },
    },
  },
});
