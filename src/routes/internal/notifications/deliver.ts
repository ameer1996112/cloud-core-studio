import { createFileRoute } from "@tanstack/react-router";
import { processUnifiedMessagingDeliveryById } from "@/lib/unifiedMessaging.server";
import { createNotificationDeliveryHandler } from "@/server/notifications/delivery-endpoint.server";
import {
  authorizeNotificationOidcRequest,
  loadNotificationOidcConfig,
  verifyGoogleNotificationOidcToken,
} from "@/server/notifications/oidc-auth.server";

async function handleDelivery(request: Request) {
  let oidcConfig;
  try {
    oidcConfig = loadNotificationOidcConfig();
  } catch {
    return Response.json(
      { ok: false, reason: "notification_service_not_configured" },
      { status: 503 },
    );
  }
  const expectedCaller = process.env.NOTIFICATIONS_TASKS_SERVICE_ACCOUNT?.trim().toLowerCase();
  const dryRun = process.env.NOTIFICATIONS_DRY_RUN?.trim().toLowerCase() !== "false";
  const tasksEnabled = process.env.NOTIFICATIONS_TASKS_ENABLED?.trim().toLowerCase() === "true";
  const deliveryEnabled = oidcConfig.enabled && tasksEnabled && !dryRun;
  if (deliveryEnabled && !expectedCaller) {
    return Response.json(
      { ok: false, reason: "notification_service_not_configured" },
      { status: 503 },
    );
  }

  return createNotificationDeliveryHandler({
    enabled: deliveryEnabled,
    authorize: async (incomingRequest) => {
      const result = await authorizeNotificationOidcRequest(
        incomingRequest,
        { ...oidcConfig, allowedCallers: new Set(expectedCaller ? [expectedCaller] : []) },
        verifyGoogleNotificationOidcToken,
      );
      return result.ok;
    },
    process: (deliveryId) => processUnifiedMessagingDeliveryById(deliveryId),
    log: (entry) => console.info(JSON.stringify(entry)),
  })(request);
}

export const Route = createFileRoute("/internal/notifications/deliver")({
  server: { handlers: { POST: ({ request }) => handleDelivery(request) } },
});
