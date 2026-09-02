import { OAuth2Client } from "google-auth-library";

export type NotificationOidcClaims = {
  iss?: string;
  aud?: string;
  exp?: number;
  email?: string;
  email_verified?: boolean;
};

export type NotificationOidcConfig = {
  enabled: boolean;
  audience: string;
  allowedCallers: ReadonlySet<string>;
};

export type NotificationOidcVerifier = (
  token: string,
  audience: string,
) => Promise<NotificationOidcClaims>;

function enabled(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

export function loadNotificationOidcConfig(
  environment: Record<string, string | undefined> = process.env,
): NotificationOidcConfig {
  const config = {
    enabled: enabled(environment.NOTIFICATIONS_OUTBOX_ENABLED),
    audience: environment.NOTIFICATIONS_OIDC_AUDIENCE?.trim() ?? "",
    allowedCallers: new Set(
      (environment.NOTIFICATIONS_OIDC_ALLOWED_CALLERS ?? "")
        .split(",")
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean),
    ),
  };
  if (config.enabled && (!config.audience || config.allowedCallers.size === 0)) {
    throw new Error("incomplete_notification_oidc_configuration");
  }
  return config;
}

function bearerToken(request: Request) {
  const value = request.headers.get("authorization")?.trim() ?? "";
  const match = value.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1] ?? null;
}

export async function authorizeNotificationOidcRequest(
  request: Request,
  config: NotificationOidcConfig,
  verify: NotificationOidcVerifier,
  now = new Date(),
): Promise<
  | { ok: true; caller: string }
  | { ok: false; status: 401 | 403; reason: "unauthorized" | "forbidden" }
> {
  const token = bearerToken(request);
  if (!token) return { ok: false, status: 401, reason: "unauthorized" };

  let claims: NotificationOidcClaims;
  try {
    claims = await verify(token, config.audience);
  } catch {
    return { ok: false, status: 401, reason: "unauthorized" };
  }
  const caller = claims.email?.trim().toLowerCase() ?? "";
  if (
    !["accounts.google.com", "https://accounts.google.com"].includes(claims.iss ?? "") ||
    claims.aud !== config.audience ||
    claims.email_verified !== true ||
    !claims.exp ||
    claims.exp <= Math.floor(now.getTime() / 1_000)
  ) {
    return { ok: false, status: 401, reason: "unauthorized" };
  }
  if (!config.allowedCallers.has(caller)) {
    return { ok: false, status: 403, reason: "forbidden" };
  }
  return { ok: true, caller };
}

const googleOidcClient = new OAuth2Client();

export async function verifyGoogleNotificationOidcToken(token: string, audience: string) {
  const ticket = await googleOidcClient.verifyIdToken({ idToken: token, audience });
  return ticket.getPayload() ?? {};
}
