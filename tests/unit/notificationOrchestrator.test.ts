import { describe, expect, test } from "bun:test";
import { orchestrateNotificationTasks } from "../../src/server/notifications/orchestrator.server";

describe("notification Cloud Tasks orchestration", () => {
  test("materializes committed events before selecting deliveries for Cloud Tasks", async () => {
    const calls: string[] = [];
    const result = await orchestrateNotificationTasks({
      enabled: true,
      limit: 50,
      prepare: async () => {
        calls.push("prepare");
        return { outboxClaimed: 2 };
      },
      dispatch: async () => {
        calls.push("dispatch");
        return { selected: 3, enqueued: 3, failed: 0 };
      },
    });
    expect(calls).toEqual(["prepare", "dispatch"]);
    expect(result).toEqual({
      enabled: true,
      preparation: { outboxClaimed: 2 },
      tasks: { selected: 3, enqueued: 3, failed: 0 },
    });
  });

  test("does no database or network work while disabled", async () => {
    let called = false;
    const result = await orchestrateNotificationTasks({
      enabled: false,
      prepare: async () => {
        called = true;
        return {};
      },
      dispatch: async () => {
        called = true;
        return { selected: 0, enqueued: 0, failed: 0 };
      },
    });
    expect(result).toEqual({ enabled: false, skipped: "disabled" });
    expect(called).toBe(false);
  });
});
