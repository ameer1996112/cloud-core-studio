import { z } from "zod";

const taskPayloadSchema = z.object({ deliveryId: z.string().uuid() }).strict();

export type NotificationTaskPayload = z.infer<typeof taskPayloadSchema>;

export type NotificationTaskConfig = {
  enabled: boolean;
  projectId: string;
  location: string;
  queue: string;
  deliveryUrl: string;
  serviceAccountEmail: string;
  audience: string;
};

type TaskRequest = {
  parent: string;
  task: {
    name: string;
    httpRequest: {
      httpMethod: "POST";
      url: string;
      headers: { "Content-Type": "application/json" };
      body: Uint8Array;
      oidcToken: { serviceAccountEmail: string; audience: string };
    };
    scheduleTime?: { seconds: number };
  };
};

type CloudTasksClientLike = {
  createTask(request: TaskRequest): Promise<readonly [{ name?: string | null }, ...unknown[]]>;
};

export interface NotificationTaskQueue {
  enqueueDelivery(deliveryId: string, scheduleTime?: Date): Promise<{ taskName: string }>;
}

function enabled(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

export function loadNotificationTaskConfig(
  environment: Record<string, string | undefined> = process.env,
): NotificationTaskConfig {
  const config: NotificationTaskConfig = {
    enabled: enabled(environment.NOTIFICATIONS_TASKS_ENABLED),
    projectId: environment.NOTIFICATIONS_TASKS_PROJECT_ID?.trim() ?? "",
    location: environment.NOTIFICATIONS_TASKS_LOCATION?.trim() ?? "me-west1",
    queue: environment.NOTIFICATIONS_TASKS_QUEUE?.trim() ?? "cc-notification-delivery",
    deliveryUrl: environment.NOTIFICATIONS_DELIVERY_URL?.trim() ?? "",
    serviceAccountEmail: environment.NOTIFICATIONS_TASKS_SERVICE_ACCOUNT?.trim() ?? "",
    audience: environment.NOTIFICATIONS_OIDC_AUDIENCE?.trim() ?? "",
  };
  if (
    config.enabled &&
    (!config.projectId ||
      !config.location ||
      !config.queue ||
      !config.deliveryUrl ||
      !config.serviceAccountEmail ||
      !config.audience)
  ) {
    throw new Error("incomplete_notification_tasks_configuration");
  }
  if (config.enabled) {
    const deliveryUrl = new URL(config.deliveryUrl);
    const audience = new URL(config.audience);
    if (deliveryUrl.protocol !== "https:" || audience.protocol !== "https:") {
      throw new Error("insecure_notification_tasks_configuration");
    }
  }
  return config;
}

export function parseNotificationTaskPayload(value: unknown): NotificationTaskPayload {
  const parsed = taskPayloadSchema.safeParse(value);
  if (!parsed.success) throw new Error("invalid_notification_task_payload");
  return parsed.data;
}

export function notificationTaskId(deliveryId: string) {
  return `delivery-${parseNotificationTaskPayload({ deliveryId }).deliveryId.replaceAll("-", "")}`;
}

export function buildNotificationTask(
  config: NotificationTaskConfig,
  deliveryId: string,
  scheduleTime?: Date,
): TaskRequest {
  const payload = parseNotificationTaskPayload({ deliveryId });
  const parent = `projects/${config.projectId}/locations/${config.location}/queues/${config.queue}`;
  const taskId = notificationTaskId(deliveryId);
  return {
    parent,
    task: {
      name: `${parent}/tasks/${taskId}`,
      httpRequest: {
        httpMethod: "POST",
        url: config.deliveryUrl,
        headers: { "Content-Type": "application/json" },
        body: Buffer.from(JSON.stringify(payload)),
        oidcToken: {
          serviceAccountEmail: config.serviceAccountEmail,
          audience: config.audience,
        },
      },
      ...(scheduleTime && scheduleTime.getTime() > Date.now()
        ? { scheduleTime: { seconds: Math.floor(scheduleTime.getTime() / 1_000) } }
        : {}),
    },
  };
}

export class GoogleCloudNotificationTaskQueue implements NotificationTaskQueue {
  constructor(
    private readonly client: CloudTasksClientLike,
    private readonly config: NotificationTaskConfig,
  ) {}

  async enqueueDelivery(deliveryId: string, scheduleTime?: Date) {
    const request = buildNotificationTask(this.config, deliveryId, scheduleTime);
    try {
      const [task] = await this.client.createTask(request);
      return { taskName: task.name ?? request.task.name };
    } catch (error) {
      const code = (error as { code?: number | string })?.code;
      if (code === 6 || code === "ALREADY_EXISTS") return { taskName: request.task.name };
      throw error;
    }
  }
}

export async function createNotificationTaskQueue(
  environment: Record<string, string | undefined> = process.env,
) {
  const config = loadNotificationTaskConfig(environment);
  if (!config.enabled) return null;
  const { CloudTasksClient } = await import("@google-cloud/tasks");
  return new GoogleCloudNotificationTaskQueue(new CloudTasksClient(), config);
}
