import {
  jsonResponse,
  requireNotificationAutomationAuth,
} from "../../lib/internalAutomationAuth.server";
import {
  authorizeNotificationOidcRequest,
  verifyGoogleNotificationOidcToken,
  type NotificationOidcVerifier,
} from "./oidc-auth.server";

export async function requireMessagingSweepAuth(
  request: Request,
  environment: Record<string, string | undefined> = process.env,
  verify: NotificationOidcVerifier = verifyGoogleNotificationOidcToken,
  now = new Date(),
): Promise<Response | null> {
  // Keep the existing job and fifteen-minute fallback usable during rollout/rollback.
  const unauthorized = requireNotificationAutomationAuth(request, environment);
  if (!unauthorized) return null;
  if (environment.MESSAGING_SWEEP_OIDC_ENABLED?.trim().toLowerCase() !== "true") {
    return unauthorized;
  }

  const audience = environment.MESSAGING_SWEEP_OIDC_AUDIENCE?.trim() ?? "";
  const caller = environment.MESSAGING_SWEEP_OIDC_SERVICE_ACCOUNT?.trim().toLowerCase() ?? "";
  let validAudience = false;
  try {
    const url = new URL(audience);
    validAudience = url.protocol === "https:" && url.origin === audience;
  } catch {
    // Invalid operator configuration must never make a public request authorized.
  }
  if (!validAudience || !/^[a-z0-9-]+@[a-z0-9-]+\.iam\.gserviceaccount\.com$/.test(caller)) {
    return jsonResponse({ ok: false, reason: "messaging_sweep_oidc_not_configured" }, 503);
  }

  const result = await authorizeNotificationOidcRequest(
    request,
    { enabled: true, audience, allowedCallers: new Set([caller]) },
    verify,
    now,
  );
  if (result.ok) return null;
  return jsonResponse({ ok: false, reason: result.reason }, result.status, {
    "www-authenticate": "Bearer",
  });
}
