import { runConciergeDispatch } from "@/lib/conciergeDispatch.server";
import { runConciergeOrchestrator } from "@/lib/conciergeOrchestrator.server";
import { runUnifiedMessagingSweep } from "@/lib/unifiedMessaging.server";
import {
  createSupabaseNotificationTaskRepository,
  enqueueRecoverableNotificationDeliveries,
} from "./task-dispatcher.server";
import { createNotificationTaskQueue, loadNotificationTaskConfig } from "./task-queue.server";

export async function orchestrateNotificationTasks<T>(input: {
  enabled: boolean;
  limit?: number;
  prepare(): Promise<T>;
  dispatch(): Promise<{ selected: number; enqueued: number; failed: number }>;
}) {
  if (!input.enabled) return { enabled: false as const, skipped: "disabled" as const };
  const preparation = await input.prepare();
  const tasks = await input.dispatch();
  return { enabled: true as const, preparation, tasks };
}

export async function runNotificationTaskOrchestration(input?: {
  limit?: number;
  environment?: Record<string, string | undefined>;
}) {
  const environment = input?.environment ?? process.env;
  const taskConfig = loadNotificationTaskConfig(environment);
  const outboxEnabled = environment.NOTIFICATIONS_OUTBOX_ENABLED?.trim().toLowerCase() === "true";
  const dryRun = environment.NOTIFICATIONS_DRY_RUN?.trim().toLowerCase() !== "false";
  const queue =
    taskConfig.enabled && !dryRun ? await createNotificationTaskQueue(environment) : null;
  const repository = createSupabaseNotificationTaskRepository();

  return orchestrateNotificationTasks({
    enabled: outboxEnabled && taskConfig.enabled,
    limit: input?.limit,
    prepare: async () => {
      const conciergeOrchestration = await runConciergeOrchestrator({ limit: input?.limit });
      const conciergeDispatch = await runConciergeDispatch({ limit: input?.limit });
      const unifiedMessaging = await runUnifiedMessagingSweep({
        limit: input?.limit,
        deliveryTransport: "cloud_tasks",
      });
      return { conciergeOrchestration, conciergeDispatch, unifiedMessaging };
    },
    dispatch: () =>
      dryRun
        ? Promise.resolve({ selected: 0, enqueued: 0, failed: 0 })
        : enqueueRecoverableNotificationDeliveries({
            limit: input?.limit,
            repository,
            queue: queue!,
            log: (entry) => console.info(JSON.stringify(entry)),
          }),
  });
}
