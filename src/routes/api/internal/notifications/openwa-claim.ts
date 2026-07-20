import { z } from "zod";
import { createFileRoute } from "@tanstack/react-router";
import {
  claimOpenwaNotifications,
  normalizeOpenwaClaimLimit,
} from "@/lib/notificationQueue.server";
import {
  jsonResponse,
  readJsonBody,
  requireOpenwaAutomationAuth,
} from "@/lib/internalAutomationAuth.server";

const claimRequestSchema = z.object({
  limit: z.number().finite().optional(),
  workerId: z.string().trim().min(1).max(120).optional(),
  dryRun: z.boolean().optional(),
  testPhone: z.string().trim().min(1).optional(),
  claimNotBefore: z.string().datetime().optional(),
});

export const Route = createFileRoute("/api/internal/notifications/openwa-claim")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauthorized = requireOpenwaAutomationAuth(request);
        if (unauthorized) return unauthorized;
        if (process.env.OPENWA_LEGACY_DELIVERY_ENABLED?.trim().toLowerCase() !== "true") {
          return jsonResponse({ ok: false, reason: "openwa_legacy_delivery_disabled" }, 410);
        }

        let body: unknown;
        try {
          body = await readJsonBody(request);
        } catch (error) {
          return jsonResponse(
            { ok: false, reason: error instanceof Error ? error.message : "invalid_json_body" },
            400,
          );
        }

        const parsed = claimRequestSchema.safeParse(body);
        if (!parsed.success) {
          return jsonResponse({ ok: false, reason: "invalid_request_body" }, 400);
        }

        const result = await claimOpenwaNotifications({
          limit: normalizeOpenwaClaimLimit(parsed.data.limit),
          workerId: parsed.data.workerId ?? null,
          dryRun: parsed.data.dryRun === true,
          testPhone: parsed.data.testPhone ?? null,
          claimNotBefore: parsed.data.claimNotBefore ? new Date(parsed.data.claimNotBefore) : null,
        });

        return jsonResponse({
          ok: true,
          dryRun: result.dryRun,
          jobs: result.jobs,
          meta: {
            claimed: result.claimed,
            recovered: result.recovered,
            invalid: result.invalid,
          },
        });
      },
    },
  },
});
