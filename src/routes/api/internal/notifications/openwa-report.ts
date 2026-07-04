import { z } from "zod";
import { createFileRoute } from "@tanstack/react-router";
import { reportOpenwaNotification } from "@/lib/notificationQueue.server";
import {
  jsonResponse,
  readJsonBody,
  requireOpenwaAutomationAuth,
} from "@/lib/internalAutomationAuth.server";

const sentSchema = z.object({
  jobId: z.string().uuid(),
  status: z.literal("sent"),
  providerMessageId: z.string().trim().min(1).nullable().optional(),
  workerId: z.string().trim().min(1).max(120).optional(),
});

const failedSchema = z.object({
  jobId: z.string().uuid(),
  status: z.literal("failed"),
  retryable: z.boolean(),
  error: z.string().trim().min(1),
  providerMessageId: z.string().trim().min(1).nullable().optional(),
  workerId: z.string().trim().min(1).max(120).optional(),
});

const reportRequestSchema = z.union([sentSchema, failedSchema]);

export const Route = createFileRoute("/api/internal/notifications/openwa-report")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauthorized = requireOpenwaAutomationAuth(request);
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

        const parsed = reportRequestSchema.safeParse(body);
        if (!parsed.success) {
          return jsonResponse({ ok: false, reason: "invalid_request_body" }, 400);
        }

        const result = await reportOpenwaNotification(parsed.data);
        if (!result.ok) {
          return jsonResponse(
            { ok: false, reason: result.reason },
            result.reason === "not_found" ? 404 : 409,
          );
        }

        return jsonResponse({
          ok: true,
          outcome: result.outcome,
          nextAttemptAt: result.nextAttemptAt ?? null,
        });
      },
    },
  },
});
