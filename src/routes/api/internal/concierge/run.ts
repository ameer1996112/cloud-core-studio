import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  normalizeConciergeRunLimit,
  runConciergeOrchestrator,
} from "@/lib/conciergeOrchestrator.server";
import {
  jsonResponse,
  readJsonBody,
  requireNotificationAutomationAuth,
} from "@/lib/internalAutomationAuth.server";

const requestSchema = z.object({
  limit: z.number().finite().optional(),
});

export const Route = createFileRoute("/api/internal/concierge/run")({
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
        const parsed = requestSchema.safeParse(body);
        if (!parsed.success) {
          return jsonResponse({ ok: false, reason: "invalid_request_body" }, 400);
        }

        const result = await runConciergeOrchestrator({
          limit: normalizeConciergeRunLimit(parsed.data.limit),
        });
        return jsonResponse({ ok: true, ...result });
      },
    },
  },
});
