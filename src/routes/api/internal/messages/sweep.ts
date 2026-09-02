import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { jsonResponse, readJsonBody } from "@/lib/internalAutomationAuth.server";
import { requireMessagingSweepAuth } from "@/server/notifications/scheduler-auth.server";
import {
  normalizeUnifiedMessagingSweepLimit,
  runUnifiedMessagingCanary,
  runUnifiedMessagingSweep,
} from "@/lib/unifiedMessaging.server";

const inputSchema = z.object({
  limit: z.number().finite().optional(),
  canary: z.boolean().optional().default(false),
});

export const Route = createFileRoute("/api/internal/messages/sweep")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauthorized = await requireMessagingSweepAuth(request);
        if (unauthorized) return unauthorized;
        if (process.env.MESSAGING_SCHEDULER_ENABLED?.trim().toLowerCase() !== "true") {
          return jsonResponse({ ok: false, reason: "messaging_scheduler_disabled" }, 409);
        }
        let body: unknown;
        try {
          body = await readJsonBody(request);
        } catch {
          return jsonResponse({ ok: false, reason: "invalid_json_body" }, 400);
        }
        const parsed = inputSchema.safeParse(body);
        if (!parsed.success)
          return jsonResponse({ ok: false, reason: "invalid_request_body" }, 400);
        if (parsed.data.canary) {
          const result = await runUnifiedMessagingCanary();
          return jsonResponse({ ok: true, ...result });
        }
        const result = await runUnifiedMessagingSweep({
          limit: normalizeUnifiedMessagingSweepLimit(parsed.data.limit),
        });
        return jsonResponse({ ok: true, ...result });
      },
    },
  },
});
