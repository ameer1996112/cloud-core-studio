import { describe, expect, test } from "bun:test";
import { requestImmediateMessagingSweep } from "../../src/lib/unifiedMessagingKick.server.ts";

describe("post-commit messaging kick", () => {
  test("is disabled unless explicitly enabled", async () => {
    let called = false;
    const result = await requestImmediateMessagingSweep({}, async () => {
      called = true;
      return new Response();
    });
    expect(result).toEqual({ ok: false, skipped: "disabled" });
    expect(called).toBe(false);
  });

  test("uses the existing automation token and bounded internal sweep", async () => {
    const requests = [];
    const result = await requestImmediateMessagingSweep(
      {
        MESSAGING_IMMEDIATE_DISPATCH_ENABLED: "true",
        MESSAGING_INTERNAL_SWEEP_URL: "https://app.example/api/internal/messages/sweep",
        NOTIFICATION_AUTOMATION_TOKEN: "test-secret",
      },
      async (url, init) => {
        requests.push({ url, init });
        return Response.json({ ok: true });
      },
    );
    expect(result).toEqual({ ok: true });
    expect(requests[0]).toMatchObject({
      url: "https://app.example/api/internal/messages/sweep",
      init: {
        method: "POST",
        headers: { authorization: "Bearer test-secret", "content-type": "application/json" },
        body: '{"limit":50}',
      },
    });
  });
});
