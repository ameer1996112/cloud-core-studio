import { createFileRoute } from "@tanstack/react-router";
import { ingestOfficialWhatsappWebhook } from "@/lib/officialWhatsappWebhook.server";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/webhooks/whatsapp")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const configuredToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim();
        if (!configuredToken)
          return new Response("Webhook verify token not configured", { status: 503 });

        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");

        if (mode === "subscribe" && token === configuredToken && challenge) {
          return new Response(challenge, {
            status: 200,
            headers: { "content-type": "text/plain" },
          });
        }

        return new Response("Forbidden", { status: 403 });
      },
      POST: async ({ request }) => {
        const contentLength = Number(request.headers.get("content-length") ?? 0);
        if (Number.isFinite(contentLength) && contentLength > 1_048_576) {
          return jsonResponse({ ok: false, reason: "webhook_body_too_large" }, 413);
        }
        const rawBody = await request.text();
        const result = await ingestOfficialWhatsappWebhook({
          rawBody,
          signature: request.headers.get("x-hub-signature-256"),
        });
        return jsonResponse(result, result.status);
      },
    },
  },
});
