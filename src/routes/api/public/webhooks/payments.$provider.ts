import { createFileRoute } from "@tanstack/react-router";
import { kickUnifiedMessagingAfterCommit } from "@/lib/unifiedMessagingKick.server";
import { processHypPaymentNotification } from "@/lib/subscriptions.server";
import { authorizeLegacyHypNotification } from "@/lib/adultHypNotificationBoundary.server";

type HypSnsEnvelope = {
  Type?: string;
  MessageId?: string;
  Message?: string;
  SubscribeURL?: string;
  Timestamp?: string;
  TopicArn?: string;
};

function readTextField(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"));
  if (!match) return "";
  return match[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function textValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  if (typeof value === "object" && "text" in value)
    return textValue((value as { text?: unknown }).text);
  return "";
}

function amountFromHypWebhookTotal(total: string) {
  const numeric = Number(total);
  if (!Number.isFinite(numeric) || numeric <= 0) return "";
  return (numeric / 100)
    .toFixed(2)
    .replace(/\.00$/, "")
    .replace(/(\.\d)0$/, "$1");
}

function decodeHypSnsTransactionMessage(message: string) {
  const decoded = Buffer.from(message, "base64").toString("utf8").trim();
  if (!decoded) throw new Error("hyp_sns_empty_message");

  if (decoded.startsWith("{")) {
    const parsed = JSON.parse(decoded) as { transaction?: Record<string, unknown> };
    const transaction = parsed.transaction ?? parsed;
    const total = textValue(transaction.total);
    return {
      status: textValue(transaction.status),
      statusText: textValue(transaction.statusText),
      financialStatus: textValue(transaction.financialStatus),
      terminalNumber: textValue(transaction.terminalNumber),
      cardMask: textValue(transaction.cardMask),
      cardExp: textValue(transaction.cardExpiration),
      user: textValue(transaction.user),
      userData1: textValue(
        (transaction.customerData as { userData1?: unknown } | undefined)?.userData1,
      ),
      Id: textValue(transaction.tranId) || textValue(transaction.cgUid),
      txId: textValue(transaction.tranId),
      cgUid: textValue(transaction.cgUid),
      authNumber: textValue(transaction.authNumber),
      Amount: amountFromHypWebhookTotal(total),
      total,
      transactionDate: textValue(transaction.transactionDate),
      rawMessage: decoded,
    };
  }

  const total = readTextField(decoded, "total");
  return {
    status: readTextField(decoded, "status"),
    statusText: readTextField(decoded, "statusText"),
    financialStatus: readTextField(decoded, "financialStatus"),
    terminalNumber: readTextField(decoded, "terminalNumber"),
    cardMask: readTextField(decoded, "cardMask"),
    cardExp: readTextField(decoded, "cardExpiration"),
    user: readTextField(decoded, "user"),
    userData1: readTextField(decoded, "userData1"),
    Id: readTextField(decoded, "tranId") || readTextField(decoded, "cgUid"),
    txId: readTextField(decoded, "tranId"),
    cgUid: readTextField(decoded, "cgUid"),
    authNumber: readTextField(decoded, "authNumber"),
    Amount: amountFromHypWebhookTotal(total),
    total,
    transactionDate: readTextField(decoded, "transactionDate"),
    rawMessage: decoded,
  };
}

function paramsFromHypSnsEnvelope(envelope: HypSnsEnvelope) {
  const transaction = decodeHypSnsTransactionMessage(envelope.Message ?? "");
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(transaction)) {
    if (value) params.set(key, value);
  }
  params.set(
    "CCode",
    transaction.status === "000" || transaction.status === "0" ? "0" : transaction.status,
  );
  if (envelope.MessageId) params.set("MessageId", envelope.MessageId);
  if (envelope.Timestamp) params.set("Timestamp", envelope.Timestamp);
  if (envelope.TopicArn) params.set("TopicArn", envelope.TopicArn);
  params.set("_hyp_webhook_format", "sns");
  return params;
}

function hasConfiguredHypWebhookToken(request: Request, url: URL) {
  return authorizeLegacyHypNotification({
    configuredToken: process.env.SUBSCRIPTION_AUTOMATION_TOKEN,
    suppliedToken:
      url.searchParams.get("token")?.trim() ||
      url.searchParams.get("automation_token")?.trim() ||
      request.headers.get("x-cloud-core-token")?.trim(),
  });
}

/**
 * Generic payments webhook endpoint.
 *
 * Legacy JSON/SNS traffic remains available for existing member payments under
 * its configured token boundary. Adult trials always require a signed HYP form
 * callback independently verified against HYP.
 */
export const Route = createFileRoute("/api/public/webhooks/payments/$provider")({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        const provider = String(params.provider ?? "").toLowerCase();
        if (!["hyp", "stripe", "paddle"].includes(provider)) {
          return new Response("Unknown provider", { status: 404 });
        }
        if (provider === "hyp") {
          const rawBody = await request.text();
          const url = new URL(request.url);
          const contentType = request.headers.get("content-type") ?? "";
          const snsType = request.headers.get("x-amz-sns-message-type") ?? "";
          try {
            if (contentType.includes("application/json") || snsType) {
              if (!hasConfiguredHypWebhookToken(request, url)) {
                return new Response(JSON.stringify({ ok: false, reason: "unauthorized" }), {
                  status: 401,
                  headers: { "content-type": "application/json" },
                });
              }
              const envelope = JSON.parse(rawBody || "{}") as HypSnsEnvelope;
              const type = envelope.Type || snsType;
              if (type === "SubscriptionConfirmation") {
                if (!envelope.SubscribeURL) throw new Error("hyp_sns_missing_subscribe_url");
                const confirm = await fetch(envelope.SubscribeURL);
                if (!confirm.ok) throw new Error(`hyp_sns_confirm_http_${confirm.status}`);
                return new Response(
                  JSON.stringify({ ok: true, status: "subscription_confirmed" }),
                  {
                    status: 200,
                    headers: { "content-type": "application/json" },
                  },
                );
              }
              if (type !== "Notification") {
                return new Response(JSON.stringify({ ok: true, status: "ignored", type }), {
                  status: 200,
                  headers: { "content-type": "application/json" },
                });
              }
              const result = await processHypPaymentNotification(
                paramsFromHypSnsEnvelope(envelope),
                "legacy_sns_webhook",
              );
              await kickUnifiedMessagingAfterCommit();
              return new Response(JSON.stringify({ ok: true, ...result }), {
                status: 200,
                headers: { "content-type": "application/json" },
              });
            }

            const notificationParams = new URLSearchParams(url.searchParams);
            const paramsFromBody = new URLSearchParams(rawBody);
            for (const [key, value] of paramsFromBody.entries()) {
              notificationParams.set(key, value);
            }
            const result = await processHypPaymentNotification(
              notificationParams,
              "signed_callback",
            );
            await kickUnifiedMessagingAfterCommit();
            return new Response(JSON.stringify({ ok: true, ...result }), {
              status: 200,
              headers: { "content-type": "application/json" },
            });
          } catch (error) {
            return new Response(
              JSON.stringify({
                ok: false,
                reason: error instanceof Error ? error.message : "hyp_webhook_failed",
              }),
              { status: 500, headers: { "content-type": "application/json" } },
            );
          }
        }
        // Drain body so the provider doesn't see a connection-reset.
        try {
          await request.text();
        } catch {
          // Ignore a disconnected peer.
        }
        return new Response(
          JSON.stringify({
            ok: false,
            reason: "webhook_endpoint_not_configured",
            provider,
            message: "This studio has not enabled online payments yet.",
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
