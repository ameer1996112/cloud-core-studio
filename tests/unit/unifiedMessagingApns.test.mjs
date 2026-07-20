import { describe, expect, test } from "bun:test";
import { sendApnsDelivery } from "../../src/lib/messagingApnsAdapter.server.ts";

describe("unified APNs adapter", () => {
  test("deactivates only permanent token failures while accepting another token", async () => {
    const deactivated = [];
    const result = await sendApnsDelivery(
      [
        { id: "token-1", token: "bad" },
        { id: "token-2", token: "good" },
      ],
      { title: "Class update", body: "Updated" },
      {
        send: async (token) =>
          token === "bad"
            ? { ok: false, error: "APNs 410: Unregistered", apnsId: null }
            : { ok: true, apnsId: "apns-2" },
        deactivate: async (tokenId) => deactivated.push(tokenId),
      },
    );
    expect(result).toEqual({ ok: true, providerMessageId: "apns-2", status: "sent" });
    expect(deactivated).toEqual(["token-1"]);
  });

  test("keeps transient token failures retryable", async () => {
    const result = await sendApnsDelivery(
      [{ id: "token-1", token: "temporary" }],
      { title: "Reminder", body: "Soon" },
      {
        send: async () => ({ ok: false, error: "APNs request timed out", apnsId: null }),
        deactivate: async () => {},
      },
    );
    expect(result).toMatchObject({ ok: false, failureClass: "transient" });
  });
});
