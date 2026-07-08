function unauthorizedResponse() {
  return jsonResponse({ ok: false, reason: "unauthorized" }, 401, {
    "www-authenticate": "Bearer",
  });
}

export function jsonResponse(body: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...headers,
    },
  });
}

export function readBearerToken(authorizationHeader: string | null) {
  if (!authorizationHeader) return null;
  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export function requireOpenwaAutomationAuth(request: Request): Response | null {
  const configuredToken = process.env.OPENWA_AUTOMATION_TOKEN?.trim();
  if (!configuredToken) return unauthorizedResponse();

  const bearerToken = readBearerToken(request.headers.get("authorization"));
  if (!bearerToken || bearerToken !== configuredToken) {
    return unauthorizedResponse();
  }

  return null;
}

export function requireNotificationAutomationAuth(request: Request): Response | null {
  const configuredToken =
    process.env.NOTIFICATION_AUTOMATION_TOKEN?.trim() ||
    process.env.OPENWA_AUTOMATION_TOKEN?.trim();
  if (!configuredToken) return unauthorizedResponse();

  const bearerToken = readBearerToken(request.headers.get("authorization"));
  if (!bearerToken || bearerToken !== configuredToken) {
    return unauthorizedResponse();
  }

  return null;
}

export async function readJsonBody(request: Request): Promise<unknown> {
  const rawBody = await request.text();
  if (!rawBody.trim()) return {};

  try {
    return JSON.parse(rawBody);
  } catch {
    throw new Error("invalid_json_body");
  }
}
