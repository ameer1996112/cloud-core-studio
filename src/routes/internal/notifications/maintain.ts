import { createFileRoute } from "@tanstack/react-router";
import {
  createNotificationMaintenanceHandler,
  normalizeNotificationMaintenanceTimeBudget,
} from "@/server/notifications/maintenance-endpoint.server";
import {
  authorizeNotificationOidcRequest,
  loadNotificationOidcConfig,
  verifyGoogleNotificationOidcToken,
} from "@/server/notifications/oidc-auth.server";
import { runNotificationTaskOrchestration } from "@/server/notifications/orchestrator.server";

async function handleMaintenance(request: Request) {
  let oidcConfig;
  let timeBudgetMs;
  try {
    oidcConfig = loadNotificationOidcConfig();
    timeBudgetMs = normalizeNotificationMaintenanceTimeBudget(
      process.env.NOTIFICATIONS_MAINTENANCE_TIME_BUDGET_MS,
    );
  } catch {
    return Response.json(
      { ok: false, reason: "notification_service_not_configured" },
      { status: 503 },
    );
  }
  const enabled =
    oidcConfig.enabled &&
    process.env.NOTIFICATIONS_MAINTENANCE_ENABLED?.trim().toLowerCase() === "true";
  const expectedCaller =
    process.env.NOTIFICATIONS_MAINTENANCE_SERVICE_ACCOUNT?.trim().toLowerCase();
  if (enabled && !expectedCaller) {
    return Response.json(
      { ok: false, reason: "notification_service_not_configured" },
      { status: 503 },
    );
  }

  return createNotificationMaintenanceHandler({
    enabled,
    authorize: async (incomingRequest) => {
      const result = await authorizeNotificationOidcRequest(
        incomingRequest,
        { ...oidcConfig, allowedCallers: new Set(expectedCaller ? [expectedCaller] : []) },
        verifyGoogleNotificationOidcToken,
      );
      return result.ok;
    },
    run: (limit, signal) =>
      runNotificationTaskOrchestration({
        limit,
        signal,
        recordMaintenanceHeartbeat: true,
      }),
    timeBudgetMs,
    log: (entry) => console.info(JSON.stringify(entry)),
  })(request);
}

export const Route = createFileRoute("/internal/notifications/maintain")({
  server: { handlers: { POST: ({ request }) => handleMaintenance(request) } },
});
