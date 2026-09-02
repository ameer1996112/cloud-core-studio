import { describe, expect, test } from "bun:test";
import { enqueueRecoverableNotificationDeliveries } from "../../src/server/notifications/task-dispatcher.server";

const first = "64000000-0000-4000-8000-000000000001";
const second = "64000000-0000-4000-8000-000000000002";

describe("notification task dispatcher", () => {
  test("marks successful tasks enqueued and leaves enqueue failures recoverable", async () => {
    const marked = [];
    const failed = [];
    const logs = [];
    const summary = await enqueueRecoverableNotificationDeliveries({
      limit: 10,
      repository: {
        listRecoverable: async () => [
          { id: first, scheduledFor: "2026-09-02T12:00:00.000Z" },
          { id: second, scheduledFor: "2026-09-02T12:00:00.000Z" },
        ],
        markEnqueued: async (deliveryId, taskName) => marked.push([deliveryId, taskName]),
        recordEnqueueFailure: async (deliveryId, errorCode) => failed.push([deliveryId, errorCode]),
      },
      queue: {
        enqueueDelivery: async (deliveryId) => {
          if (deliveryId === second) throw new Error("private provider detail");
          return { taskName: `tasks/${deliveryId}` };
        },
      },
      log: (entry) => logs.push(entry),
    });

    expect(summary).toEqual({ selected: 2, enqueued: 1, failed: 1 });
    expect(marked).toEqual([[first, `tasks/${first}`]]);
    expect(failed).toEqual([[second, "task_enqueue_failed"]]);
    expect(JSON.stringify(logs)).not.toContain("private provider detail");
  });

  test("bounds every maintenance batch to one hundred deliveries", async () => {
    let observedLimit = 0;
    await enqueueRecoverableNotificationDeliveries({
      limit: 1_000,
      repository: {
        listRecoverable: async (limit) => {
          observedLimit = limit;
          return [];
        },
        markEnqueued: async () => undefined,
        recordEnqueueFailure: async () => undefined,
      },
      queue: { enqueueDelivery: async () => ({ taskName: "unused" }) },
      log: () => undefined,
    });
    expect(observedLimit).toBe(100);
  });
});
