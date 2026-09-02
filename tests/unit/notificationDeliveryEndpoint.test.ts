import { describe, expect, test } from "bun:test";
import { createNotificationDeliveryHandler } from "../../src/server/notifications/delivery-endpoint.server";

const deliveryId = "64000000-0000-4000-8000-000000000001";

function request(body = { deliveryId }) {
  return new Request("https://app.example/internal/notifications/deliver", {
    method: "POST",
    headers: { authorization: "Bearer signed", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("notification delivery endpoint", () => {
  test("fails closed while disabled and rejects unauthenticated calls", async () => {
    const process = async () => ({ outcome: "sent" as const });
    expect(
      (
        await createNotificationDeliveryHandler({
          enabled: false,
          authorize: async () => true,
          process,
        })(request())
      ).status,
    ).toBe(404);
    expect(
      (
        await createNotificationDeliveryHandler({
          enabled: true,
          authorize: async () => false,
          process,
        })(request())
      ).status,
    ).toBe(401);
  });

  test("rejects payloads containing anything except deliveryId", async () => {
    const response = await createNotificationDeliveryHandler({
      enabled: true,
      authorize: async () => true,
      process: async () => ({ outcome: "sent" }),
    })(request({ deliveryId, email: "member@example.com" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, reason: "invalid_request" });
  });

  test("acknowledges terminal deliveries but retries a busy lease", async () => {
    const terminal = await createNotificationDeliveryHandler({
      enabled: true,
      authorize: async () => true,
      process: async () => ({ outcome: "already_terminal" }),
    })(request());
    expect(terminal.status).toBe(200);

    const busy = await createNotificationDeliveryHandler({
      enabled: true,
      authorize: async () => true,
      process: async () => ({ outcome: "lease_busy" }),
    })(request());
    expect(busy.status).toBe(503);
  });

  test("returns a retryable status only for temporary delivery failures", async () => {
    const retry = await createNotificationDeliveryHandler({
      enabled: true,
      authorize: async () => true,
      process: async () => ({ outcome: "retryable_failure" }),
    })(request());
    expect(retry.status).toBe(503);
    expect(await retry.json()).toEqual({ ok: false, reason: "temporary_failure" });

    const permanent = await createNotificationDeliveryHandler({
      enabled: true,
      authorize: async () => true,
      process: async () => ({ outcome: "failed_permanent" }),
    })(request());
    expect(permanent.status).toBe(200);
  });

  test("two concurrent handlers cannot both reach the provider behind one lease", async () => {
    let leaseHeld = false;
    let providerSends = 0;
    const handler = createNotificationDeliveryHandler({
      enabled: true,
      authorize: async () => true,
      process: async () => {
        if (leaseHeld) return { outcome: "lease_busy" as const };
        leaseHeld = true;
        await Promise.resolve();
        providerSends += 1;
        return { outcome: "sent" as const };
      },
    });

    const responses = await Promise.all([handler(request()), handler(request())]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 503]);
    expect(providerSends).toBe(1);
  });
});
