import { createFileRoute } from "@tanstack/react-router";
import { jsonResponse, readBearerToken } from "@/lib/internalAutomationAuth.server";
import {
  chargeDueHypTokenSubscriptions,
  syncDueHypSubscriptions,
} from "@/lib/subscriptions.server";

function requireSubscriptionAutomationAuth(request: Request): Response | null {
  const configuredToken =
    process.env.SUBSCRIPTION_AUTOMATION_TOKEN?.trim() ||
    process.env.NOTIFICATION_AUTOMATION_TOKEN?.trim();
  if (!configuredToken) {
    return jsonResponse({ ok: false, reason: "subscription_sync_not_configured" }, 503);
  }

  const bearerToken = readBearerToken(request.headers.get("authorization"));
  const headerToken = request.headers.get("x-cloud-core-token")?.trim();
  const urlToken = new URL(request.url).searchParams.get("token")?.trim();
  if (![bearerToken, headerToken, urlToken].includes(configuredToken)) {
    return jsonResponse({ ok: false, reason: "unauthorized" }, 401, {
      "www-authenticate": "Bearer",
    });
  }

  return null;
}

async function handle(request: Request) {
  const unauthorized = requireSubscriptionAutomationAuth(request);
  if (unauthorized) return unauthorized;

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? 25);
  try {
    const tokenCharges = await chargeDueHypTokenSubscriptions({ limit });
    const includeInquirySync = url.searchParams.get("include_inquiry_sync") === "true";
    const inquirySync = includeInquirySync ? await syncDueHypSubscriptions({ limit }) : null;
    return jsonResponse({ ok: true, tokenCharges, inquirySync });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        reason: error instanceof Error ? error.message : "hyp_subscription_sync_failed",
      },
      500,
    );
  }
}

export const Route = createFileRoute("/api/internal/subscriptions/hyp-sync")({
  server: {
    handlers: {
      GET: async ({ request }) => handle(request),
      POST: async ({ request }) => handle(request),
    },
  },
});
