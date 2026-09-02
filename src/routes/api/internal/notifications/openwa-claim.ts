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
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { claimCanonicalOpenwaDeliveries } from "@/lib/unifiedMessaging.server";

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
        const canonicalEnabled =
          process.env.NOTIFICATIONS_OUTBOX_ENABLED?.trim().toLowerCase() === "true";
        const legacyEnabled =
          process.env.OPENWA_LEGACY_DELIVERY_ENABLED?.trim().toLowerCase() === "true";
        if (!canonicalEnabled && !legacyEnabled) {
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

        const common = {
          limit: normalizeOpenwaClaimLimit(parsed.data.limit),
          workerId: parsed.data.workerId ?? "openwa-local-worker",
          dryRun:
            parsed.data.dryRun === true ||
            (canonicalEnabled &&
              process.env.NOTIFICATIONS_DRY_RUN?.trim().toLowerCase() !== "false"),
          claimNotBefore: parsed.data.claimNotBefore ? new Date(parsed.data.claimNotBefore) : null,
        };
        const result = canonicalEnabled
          ? await claimCanonicalOpenwaDeliveries(common)
          : await claimOpenwaNotifications({ ...common, testPhone: parsed.data.testPhone ?? null });
        const heartbeat = await (supabaseAdmin as any).rpc(
          "record_notification_runtime_heartbeat",
          {
            p_heartbeat_key: "openwa",
            p_outcome: "completed",
            p_summary: {
              dry_run: result.dryRun,
              claimed: result.claimed,
              recovered: result.recovered,
              invalid: result.invalid,
            },
          },
        );
        if (heartbeat.error) {
          console.warn("openwa_heartbeat_persistence_failed", {
            errorCode: "heartbeat_write_failed",
          });
        }

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
