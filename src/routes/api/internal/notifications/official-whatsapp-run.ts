import { z } from "zod";
import { createFileRoute } from "@tanstack/react-router";
import {
  normalizeOfficialWhatsappRunLimit,
  runOfficialWhatsappQueue,
} from "@/lib/officialWhatsappQueue.server";
import {
  jsonResponse,
  readJsonBody,
  requireNotificationAutomationAuth,
} from "@/lib/internalAutomationAuth.server";

const runRequestSchema = z.object({
  limit: z.number().finite().optional(),
  dryRun: z.boolean().optional(),
  claimOpenwaBacklog: z.boolean().optional(),
});

export const Route = createFileRoute("/api/internal/notifications/official-whatsapp-run")({
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

        const parsed = runRequestSchema.safeParse(body);
        if (!parsed.success) {
          return jsonResponse({ ok: false, reason: "invalid_request_body" }, 400);
        }

        const result = await runOfficialWhatsappQueue({
          limit: normalizeOfficialWhatsappRunLimit(parsed.data.limit),
          dryRun: parsed.data.dryRun === true,
          claimOpenwaBacklog: parsed.data.claimOpenwaBacklog,
        });

        return jsonResponse({ ok: true, ...result });
      },
    },
  },
});
