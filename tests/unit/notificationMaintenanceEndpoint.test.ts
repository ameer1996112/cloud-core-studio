import { describe, expect, test } from "bun:test";
import { createNotificationMaintenanceHandler } from "../../src/server/notifications/maintenance-endpoint.server";

function request(body = {}) {
  return new Request("https://app.example/internal/notifications/maintain", {
    method: "POST",
    headers: { authorization: "Bearer signed", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("notification maintenance endpoint", () => {
  test("fails closed while disabled and rejects unauthorized callers", async () => {
    const run = async () => ({ tasks: { selected: 0, enqueued: 0, failed: 0 } });
    expect(
      (
        await createNotificationMaintenanceHandler({
          enabled: false,
          authorize: async () => true,
          run,
        })(request())
      ).status,
    ).toBe(404);
    expect(
      (
        await createNotificationMaintenanceHandler({
          enabled: true,
          authorize: async () => false,
          run,
        })(request())
      ).status,
    ).toBe(401);
  });

  test("runs one bounded batch and returns a safe summary", async () => {
    let limit = 0;
    const response = await createNotificationMaintenanceHandler({
      enabled: true,
      authorize: async () => true,
      run: async (requestedLimit) => {
        limit = requestedLimit;
        return { tasks: { selected: 4, enqueued: 3, failed: 1 } };
      },
    })(request({ limit: 10_000 }));
    expect(limit).toBe(100);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      tasks: { selected: 4, enqueued: 3, failed: 1 },
    });
  });

  test("rejects unknown fields and reports failures without provider details", async () => {
    const invalid = await createNotificationMaintenanceHandler({
      enabled: true,
      authorize: async () => true,
      run: async () => ({}),
    })(request({ email: "member@example.com" }));
    expect(invalid.status).toBe(400);

    const failed = await createNotificationMaintenanceHandler({
      enabled: true,
      authorize: async () => true,
      run: async () => {
        throw new Error("private provider response");
      },
    })(request());
    expect(failed.status).toBe(503);
    expect(JSON.stringify(await failed.json())).not.toContain("private provider response");
  });
});
