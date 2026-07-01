import { createFileRoute } from "@tanstack/react-router";
import { runPaymentConfirmedOpenwaPass } from "@/lib/notificationQueue.server";

function json(body: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...headers,
    },
  });
}

function readBearerToken(authorizationHeader: string | null) {
  if (!authorizationHeader) return null;
  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function readLimit(input: unknown) {
  if (input == null) return undefined;
  if (typeof input !== "number" || !Number.isFinite(input)) {
    throw new Error("invalid_limit");
  }

  return Math.max(1, Math.trunc(input));
}

export const Route = createFileRoute("/api/internal/notifications/openwa-run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const configuredToken = process.env.OPENWA_AUTOMATION_TOKEN?.trim();
        if (!configuredToken) {
          return json({ ok: false, reason: "unauthorized" }, 401, {
            "www-authenticate": "Bearer",
          });
        }

        const bearerToken = readBearerToken(request.headers.get("authorization"));
        if (!bearerToken || bearerToken !== configuredToken) {
          return json({ ok: false, reason: "unauthorized" }, 401, {
            "www-authenticate": "Bearer",
          });
        }

        let limit: number | undefined;
        const rawBody = await request.text();

        if (rawBody.trim()) {
          let body: unknown;
          try {
            body = JSON.parse(rawBody);
          } catch {
            return json({ ok: false, reason: "invalid_json_body" }, 400);
          }

          try {
            limit = readLimit(
              body && typeof body === "object" && "limit" in body
                ? (body as { limit?: unknown }).limit
                : undefined,
            );
          } catch {
            return json({ ok: false, reason: "invalid_limit" }, 400);
          }
        }

        const result = await runPaymentConfirmedOpenwaPass({ limit });

        return json({
          ok: true,
          claimed: result.claimed,
          sent: result.sent,
          failed: result.failed,
          skipped: result.skipped,
        });
      },
    },
  },
});
