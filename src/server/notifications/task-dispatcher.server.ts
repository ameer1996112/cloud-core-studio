import { notificationDatabase } from "./database-scope.server";
import { NotificationTaskNameExpiredError, type NotificationTaskQueue } from "./task-queue.server";

export type RecoverableDelivery = { id: string; scheduledFor: string; taskGeneration: number };

export interface NotificationTaskRepository {
  listRecoverable(limit: number): Promise<RecoverableDelivery[]>;
  markEnqueued(deliveryId: string, taskName: string): Promise<void>;
  recordEnqueueFailure(deliveryId: string, errorCode: string): Promise<void>;
}

export type NotificationTaskLog = (entry: {
  event: "notification_task_enqueue";
  notification_delivery_id: string;
  outcome: "enqueued" | "failed";
  error_code?: "task_enqueue_failed" | "task_name_expired";
}) => void;

export async function enqueueRecoverableNotificationDeliveries(input: {
  limit?: number;
  repository: NotificationTaskRepository;
  queue: NotificationTaskQueue;
  signal?: AbortSignal;
  log: NotificationTaskLog;
}) {
  input.signal?.throwIfAborted();
  const limit = Math.min(Math.max(Math.trunc(input.limit ?? 100), 1), 100);
  const deliveries = await input.repository.listRecoverable(limit);
  let enqueued = 0;
  let failed = 0;

  for (const delivery of deliveries) {
    input.signal?.throwIfAborted();
    try {
      const task = await input.queue.enqueueDelivery(
        delivery.id,
        new Date(delivery.scheduledFor),
        delivery.taskGeneration,
        input.signal,
      );
      await input.repository.markEnqueued(delivery.id, task.taskName);
      enqueued += 1;
      input.log({
        event: "notification_task_enqueue",
        notification_delivery_id: delivery.id,
        outcome: "enqueued",
      });
    } catch (error) {
      input.signal?.throwIfAborted();
      failed += 1;
      const errorCode =
        error instanceof NotificationTaskNameExpiredError
          ? "task_name_expired"
          : "task_enqueue_failed";
      await input.repository.recordEnqueueFailure(delivery.id, errorCode);
      input.log({
        event: "notification_task_enqueue",
        notification_delivery_id: delivery.id,
        outcome: "failed",
        error_code: errorCode,
      });
    }
  }

  return { selected: deliveries.length, enqueued, failed };
}

export function createSupabaseNotificationTaskRepository(): NotificationTaskRepository {
  const database = notificationDatabase as any;
  return {
    async listRecoverable(limit) {
      const result = await database.rpc("list_notification_deliveries_for_tasks", {
        p_limit: limit,
      });
      if (result.error) throw result.error;
      return (result.data ?? []).map((row: any) => ({
        id: row.id,
        scheduledFor: row.next_attempt_at ?? row.scheduled_for,
        taskGeneration: Number(row.task_generation ?? 0),
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
