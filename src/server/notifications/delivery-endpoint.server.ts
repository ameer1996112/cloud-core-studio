import { parseNotificationTaskPayload } from "./task-queue.server";

export type NotificationDeliveryOutcome =
  | "sent"
  | "delivered"
  | "accepted"
  | "skipped"
  | "cancelled"
  | "failed_permanent"
  | "already_terminal"
  | "lease_busy"
  | "retryable_failure";

type DeliveryHandlerDependencies = {
  enabled: boolean;
  authorize(request: Request): Promise<boolean>;
  process(deliveryId: string): Promise<{ outcome: NotificationDeliveryOutcome }>;
  log?: (entry: Record<string, string | number | boolean | null>) => void;
};

function response(body: unknown, status: number) {
  return Response.json(body, { status });
}

export function createNotificationDeliveryHandler(dependencies: DeliveryHandlerDependencies) {
  return async (request: Request) => {
    if (!dependencies.enabled) return response({ ok: false, reason: "not_found" }, 404);
    if (!(await dependencies.authorize(request))) {
      return response({ ok: false, reason: "unauthorized" }, 401);
    }

    let payload;
    try {
      payload = parseNotificationTaskPayload(await request.json());
    } catch {
      return response({ ok: false, reason: "invalid_request" }, 400);
    }

    try {
      const result = await dependencies.process(payload.deliveryId);
      dependencies.log?.({
        event: "notification_delivery",
        notification_delivery_id: payload.deliveryId,
        outcome: result.outcome,
      });
      if (result.outcome === "retryable_failure" || result.outcome === "lease_busy") {
        return response({ ok: false, reason: "temporary_failure" }, 503);
      }
      return response({ ok: true, outcome: result.outcome }, 200);
    } catch {
      dependencies.log?.({
        event: "notification_delivery",
        notification_delivery_id: payload.deliveryId,
        outcome: "handler_failure",
      });
      return response({ ok: false, reason: "temporary_failure" }, 503);
    }
  };
}
