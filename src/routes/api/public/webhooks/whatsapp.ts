import { createFileRoute } from "@tanstack/react-router";
import {
  recordOfficialWhatsappStatuses,
  verifyMetaSignature,
} from "@/lib/officialWhatsappWebhook.server";

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
        const rawBody = await request.text();
        const appSecret = process.env.WHATSAPP_APP_SECRET?.trim();

        if (
          appSecret &&
          !verifyMetaSignature(rawBody, request.headers.get("x-hub-signature-256"), appSecret)
        ) {
          return jsonResponse({ ok: false, reason: "invalid_signature" }, 401);
        }

        let payload: unknown;
        try {
          payload = rawBody.trim() ? JSON.parse(rawBody) : {};
        } catch {
          return jsonResponse({ ok: false, reason: "invalid_json_body" }, 400);
        }

        const result = await recordOfficialWhatsappStatuses(payload);
        return jsonResponse({ ok: true, ...result });
      },
    },
  },
});
