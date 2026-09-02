type MessagingKickEnvironment = Partial<
  Record<
    | "MESSAGING_IMMEDIATE_DISPATCH_ENABLED"
    | "MESSAGING_INTERNAL_SWEEP_URL"
    | "NOTIFICATION_AUTOMATION_TOKEN"
    | "OPENWA_AUTOMATION_TOKEN"
    | "NOTIFICATIONS_OUTBOX_ENABLED"
    | "NOTIFICATIONS_TASKS_ENABLED",
    string
  >
>;

function flag(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

export async function runPostCommitNotificationDispatch<T, U>(
  env: MessagingKickEnvironment,
  dependencies: { enqueueTasks(): Promise<T>; legacySweep(): Promise<U> },
) {
  if (flag(env.NOTIFICATIONS_OUTBOX_ENABLED) && flag(env.NOTIFICATIONS_TASKS_ENABLED)) {
    return dependencies.enqueueTasks();
  }
  return dependencies.legacySweep();
}

export async function requestImmediateMessagingSweep(
  env: MessagingKickEnvironment = process.env,
  fetchImpl: typeof fetch = fetch,
) {
  if (env.MESSAGING_IMMEDIATE_DISPATCH_ENABLED?.trim().toLowerCase() !== "true") {
    return { ok: false as const, skipped: "disabled" as const };
  }
  const rawUrl = env.MESSAGING_INTERNAL_SWEEP_URL?.trim();
  const token = env.NOTIFICATION_AUTOMATION_TOKEN?.trim() || env.OPENWA_AUTOMATION_TOKEN?.trim();
  if (!rawUrl || !token) return { ok: false as const, skipped: "missing_configuration" as const };

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false as const, skipped: "invalid_url" as const };
  }
  if (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)) {
    return { ok: false as const, skipped: "insecure_url" as const };
  }

  const response = await fetchImpl(url.toString(), {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ limit: 50 }),
    signal: AbortSignal.timeout(3_000),
  });
  if (!response.ok) {
    return { ok: false as const, skipped: "sweep_rejected" as const, status: response.status };
  }
  return { ok: true as const };
}

export async function kickUnifiedMessagingAfterCommit() {
  try {
    return await runPostCommitNotificationDispatch(process.env, {
      enqueueTasks: async () => {
        const { runNotificationTaskOrchestration } =
          await import("@/server/notifications/orchestrator.server");
        return runNotificationTaskOrchestration({ limit: 50 });
      },
      legacySweep: () => requestImmediateMessagingSweep(),
    });
  } catch (error) {
    console.warn("messaging_immediate_kick_failed", {
      outcome: "failed",
      errorCode: error instanceof Error ? error.name : "unknown_error",
    });
    return { ok: false as const, skipped: "request_failed" as const };
  }
}
