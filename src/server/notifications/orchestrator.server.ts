import { runConciergeDispatch } from "@/lib/conciergeDispatch.server";
import { runConciergeOrchestrator } from "@/lib/conciergeOrchestrator.server";
import { runUnifiedMessagingSweep } from "@/lib/unifiedMessaging.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  createSupabaseNotificationTaskRepository,
  enqueueRecoverableNotificationDeliveries,
} from "./task-dispatcher.server";
import { createNotificationTaskQueue, loadNotificationTaskConfig } from "./task-queue.server";

export async function orchestrateNotificationTasks<T>(input: {
  enabled: boolean;
  limit?: number;
  signal?: AbortSignal;
  prepare(): Promise<T>;
  dispatch(): Promise<{ selected: number; enqueued: number; failed: number }>;
}) {
  if (!input.enabled) return { enabled: false as const, skipped: "disabled" as const };
  input.signal?.throwIfAborted();
  const preparation = await input.prepare();
  input.signal?.throwIfAborted();
  const tasks = await input.dispatch();
  input.signal?.throwIfAborted();
  return { enabled: true as const, preparation, tasks };
}

export async function runNotificationTaskOrchestration(input?: {
  limit?: number;
  environment?: Record<string, string | undefined>;
  signal?: AbortSignal;
  recordMaintenanceHeartbeat?: boolean;
}) {
  const environment = input?.environment ?? process.env;
  const taskConfig = loadNotificationTaskConfig(environment);
  const outboxEnabled = environment.NOTIFICATIONS_OUTBOX_ENABLED?.trim().toLowerCase() === "true";
  const dryRun = environment.NOTIFICATIONS_DRY_RUN?.trim().toLowerCase() !== "false";
  const queue =
    taskConfig.enabled && !dryRun ? await createNotificationTaskQueue(environment) : null;
  const repository = createSupabaseNotificationTaskRepository();
  const startedAt = Date.now();
  try {
    const result = await orchestrateNotificationTasks({
      enabled: outboxEnabled && taskConfig.enabled,
      limit: input?.limit,
      signal: input?.signal,
      prepare: async () => {
        input?.signal?.throwIfAborted();
        const conciergeOrchestration = await runConciergeOrchestrator({ limit: input?.limit });
        input?.signal?.throwIfAborted();
        const conciergeDispatch = await runConciergeDispatch({ limit: input?.limit });
        input?.signal?.throwIfAborted();
        const unifiedMessaging = await runUnifiedMessagingSweep({
          limit: input?.limit,
          deliveryTransport: "cloud_tasks",
          signal: input?.signal,
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
              signal: input?.signal,
              log: (entry) => console.info(JSON.stringify(entry)),
            }),
    });
    if (!input?.recordMaintenanceHeartbeat) return result;
    const tasks = "tasks" in result ? result.tasks : null;
    const heartbeat = await (supabaseAdmin as any).rpc("record_notification_runtime_heartbeat", {
      p_heartbeat_key: "maintenance",
      p_outcome: "completed",
      p_summary: {
        selected: tasks?.selected ?? 0,
        enqueued: tasks?.enqueued ?? 0,
        failed: tasks?.failed ?? 0,
        duration_ms: Date.now() - startedAt,
      },
    });
    if (heartbeat.error) throw heartbeat.error;
    return result;
  } catch (error) {
    if (!input?.recordMaintenanceHeartbeat) throw error;
    try {
      await (supabaseAdmin as any).rpc("record_notification_runtime_heartbeat", {
        p_heartbeat_key: "maintenance",
        p_outcome: "failed",
        p_summary: { duration_ms: Date.now() - startedAt },
      });
    } catch {
      // The scheduler retry remains authoritative if health persistence also fails.
    }
    throw error;
  }
}
