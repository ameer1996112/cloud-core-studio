import { z } from "zod";
import { createFileRoute } from "@tanstack/react-router";
import { runLifecycleNotificationSweep } from "@/lib/lifecycleNotifications.server";
import {
  jsonResponse,
  readJsonBody,
  requireNotificationAutomationAuth,
} from "@/lib/internalAutomationAuth.server";

const lifecycleSweepRequestSchema = z.object({
  limitPerEvent: z.number().finite().optional(),
  dryRun: z.boolean().optional(),
});

export const Route = createFileRoute("/api/internal/notifications/lifecycle-sweep")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauthorized = requireNotificationAutomationAuth(request);
        if (unauthorized) return unauthorized;

        let body: unknown;
        try {
          body = await readJsonBody(request);
        } catch (error) {
          return jsonResponse(
            { ok: false, reason: error instanceof Error ? error.message : "invalid_json_body" },
            400,
          );
        }

        const parsed = lifecycleSweepRequestSchema.safeParse(body);
        if (!parsed.success) {
          return jsonResponse({ ok: false, reason: "invalid_request_body" }, 400);
        }

        const result = await runLifecycleNotificationSweep({
          limitPerEvent: parsed.data.limitPerEvent,
          dryRun: parsed.data.dryRun === true,
        });

        return jsonResponse({ ok: true, ...result });
      },
    },
  },
});
