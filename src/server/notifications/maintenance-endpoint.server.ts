import { z } from "zod";

const requestSchema = z.object({ limit: z.number().int().positive().optional() }).strict();

type MaintenanceHandlerDependencies = {
  enabled: boolean;
  authorize(request: Request): Promise<boolean>;
  run(limit: number): Promise<{ tasks?: unknown }>;
  log?: (entry: Record<string, string | number | boolean | null>) => void;
};

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
    try {
      const result = await dependencies.run(limit);
      dependencies.log?.({ event: "notification_maintenance", outcome: "completed", limit });
      return Response.json({ ok: true, tasks: result.tasks ?? null }, { status: 200 });
    } catch {
      dependencies.log?.({ event: "notification_maintenance", outcome: "failed", limit });
      return Response.json({ ok: false, reason: "temporary_failure" }, { status: 503 });
    }
  };
}
