import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { NotificationTaskQueue } from "./task-queue.server";

export type RecoverableDelivery = { id: string; scheduledFor: string };

export interface NotificationTaskRepository {
  listRecoverable(limit: number): Promise<RecoverableDelivery[]>;
  markEnqueued(deliveryId: string, taskName: string): Promise<void>;
  recordEnqueueFailure(deliveryId: string, errorCode: string): Promise<void>;
}

export type NotificationTaskLog = (entry: {
  event: "notification_task_enqueue";
  notification_delivery_id: string;
  outcome: "enqueued" | "failed";
  error_code?: "task_enqueue_failed";
}) => void;

export async function enqueueRecoverableNotificationDeliveries(input: {
  limit?: number;
  repository: NotificationTaskRepository;
  queue: NotificationTaskQueue;
  log: NotificationTaskLog;
}) {
  const limit = Math.min(Math.max(Math.trunc(input.limit ?? 100), 1), 100);
  const deliveries = await input.repository.listRecoverable(limit);
  let enqueued = 0;
  let failed = 0;

  for (const delivery of deliveries) {
    try {
      const task = await input.queue.enqueueDelivery(delivery.id, new Date(delivery.scheduledFor));
      await input.repository.markEnqueued(delivery.id, task.taskName);
      enqueued += 1;
      input.log({
        event: "notification_task_enqueue",
        notification_delivery_id: delivery.id,
        outcome: "enqueued",
      });
    } catch {
      failed += 1;
      await input.repository.recordEnqueueFailure(delivery.id, "task_enqueue_failed");
      input.log({
        event: "notification_task_enqueue",
        notification_delivery_id: delivery.id,
        outcome: "failed",
        error_code: "task_enqueue_failed",
      });
    }
  }

  return { selected: deliveries.length, enqueued, failed };
}

export function createSupabaseNotificationTaskRepository(): NotificationTaskRepository {
  const database = supabaseAdmin as any;
  return {
    async listRecoverable(limit) {
      const result = await database.rpc("list_notification_deliveries_for_tasks", {
        p_limit: limit,
      });
      if (result.error) throw result.error;
      return (result.data ?? []).map((row: any) => ({
        id: row.id,
        scheduledFor: row.next_attempt_at ?? row.scheduled_for,
      }));
    },
    async markEnqueued(deliveryId, taskName) {
      const result = await database.rpc("mark_notification_delivery_task_enqueued", {
        p_delivery_id: deliveryId,
        p_task_name: taskName,
      });
      if (result.error) throw result.error;
    },
    async recordEnqueueFailure(deliveryId, errorCode) {
      const result = await database.rpc("mark_notification_delivery_task_failed", {
        p_delivery_id: deliveryId,
        p_error_code: errorCode,
      });
      if (result.error) throw result.error;
    },
  };
}
