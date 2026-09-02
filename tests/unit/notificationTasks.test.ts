import { describe, expect, test } from "bun:test";
import {
  buildNotificationTask,
  loadNotificationTaskConfig,
  notificationTaskId,
  parseNotificationTaskPayload,
} from "../../src/server/notifications/task-queue.server";

const deliveryId = "64000000-0000-4000-8000-000000000001";

describe("notification Cloud Tasks transport", () => {
  test("defaults disabled and rejects incomplete enabled configuration", () => {
    expect(loadNotificationTaskConfig({}).enabled).toBe(false);
    expect(() => loadNotificationTaskConfig({ NOTIFICATIONS_TASKS_ENABLED: "true" })).toThrow(
      "incomplete_notification_tasks_configuration",
    );
  });

  test("creates a deterministic task with a UUID-only payload and OIDC identity", () => {
    const config = loadNotificationTaskConfig({
      NOTIFICATIONS_TASKS_ENABLED: "true",
      NOTIFICATIONS_TASKS_PROJECT_ID: "cloudandcorestudio",
      NOTIFICATIONS_TASKS_LOCATION: "me-west1",
      NOTIFICATIONS_TASKS_QUEUE: "cc-notification-delivery",
      NOTIFICATIONS_DELIVERY_URL: "https://app.example/internal/notifications/deliver",
      NOTIFICATIONS_TASKS_SERVICE_ACCOUNT:
        "notification-tasks@cloudandcorestudio.iam.gserviceaccount.com",
      NOTIFICATIONS_OIDC_AUDIENCE: "https://app.example",
    });

    expect(notificationTaskId(deliveryId)).toBe("delivery-64000000000040008000000000000001");
    expect(buildNotificationTask(config, deliveryId)).toEqual({
      parent: "projects/cloudandcorestudio/locations/me-west1/queues/cc-notification-delivery",
      task: {
        name: "projects/cloudandcorestudio/locations/me-west1/queues/cc-notification-delivery/tasks/delivery-64000000000040008000000000000001",
        httpRequest: {
          httpMethod: "POST",
          url: "https://app.example/internal/notifications/deliver",
          headers: { "Content-Type": "application/json" },
          body: Buffer.from(JSON.stringify({ deliveryId })),
          oidcToken: {
            serviceAccountEmail: "notification-tasks@cloudandcorestudio.iam.gserviceaccount.com",
            audience: "https://app.example",
          },
        },
      },
    });
    expect(JSON.stringify(buildNotificationTask(config, deliveryId))).not.toContain("email");
    expect(JSON.stringify(buildNotificationTask(config, deliveryId))).not.toContain("phone");
  });

  test("accepts only an exact delivery UUID payload", () => {
    expect(parseNotificationTaskPayload({ deliveryId })).toEqual({ deliveryId });
    expect(() => parseNotificationTaskPayload({ deliveryId, email: "member@example.com" })).toThrow(
      "invalid_notification_task_payload",
    );
    expect(() => parseNotificationTaskPayload({ deliveryId: "not-a-uuid" })).toThrow(
      "invalid_notification_task_payload",
    );
  });
});
