import { z } from "zod";

const requestSchema = z.object({ limit: z.number().int().positive().optional() }).strict();

type MaintenanceHandlerDependencies = {
  enabled: boolean;
  authorize(request: Request): Promise<boolean>;
  run(limit: number): Promise<{ tasks?: unknown }>;
  timeBudgetMs?: number;
  log?: (entry: Record<string, string | number | boolean | null>) => void;
};

export function normalizeNotificationMaintenanceTimeBudget(value?: string) {
  if (!value?.trim()) return 150_000;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1_000 || parsed > 150_000) {
    throw new Error("invalid_notification_maintenance_time_budget");
  }
  return parsed;
}

async function runWithinTimeBudget<T>(operation: Promise<T>, timeBudgetMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("notification_maintenance_time_budget_exhausted")),
          timeBudgetMs,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export function createNotificationMaintenanceHandler(dependencies: MaintenanceHandlerDependencies) {
  return async (request: Request) => {
    if (!dependencies.enabled) {
      return Response.json({ ok: false, reason: "not_found" }, { status: 404 });
    }
    if (!(await dependencies.authorize(request))) {
      return Response.json({ ok: false, reason: "unauthorized" }, { status: 401 });
    }

    let input: z.infer<typeof requestSchema>;
    try {
      const parsed = requestSchema.safeParse(await request.json());
      if (!parsed.success) throw new Error("invalid_request");
      input = parsed.data;
    } catch {
      return Response.json({ ok: false, reason: "invalid_request" }, { status: 400 });
    }

    const limit = Math.min(Math.max(input.limit ?? 100, 1), 100);
    const timeBudgetMs = Math.min(
      Math.max(Math.trunc(dependencies.timeBudgetMs ?? 150_000), 1_000),
      150_000,
    );
    try {
      const result = await runWithinTimeBudget(dependencies.run(limit), timeBudgetMs);
      const tasks =
        result.tasks && typeof result.tasks === "object"
          ? (result.tasks as Record<string, unknown>)
          : {};
      dependencies.log?.({
        event: "notification_maintenance",
        outcome: "completed",
        limit,
        selected: typeof tasks.selected === "number" ? tasks.selected : 0,
        enqueued: typeof tasks.enqueued === "number" ? tasks.enqueued : 0,
        failed: typeof tasks.failed === "number" ? tasks.failed : 0,
      });
      return Response.json({ ok: true, tasks: result.tasks ?? null }, { status: 200 });
    } catch {
      dependencies.log?.({ event: "notification_maintenance", outcome: "failed", limit });
      return Response.json({ ok: false, reason: "temporary_failure" }, { status: 503 });
    }
  };
}
