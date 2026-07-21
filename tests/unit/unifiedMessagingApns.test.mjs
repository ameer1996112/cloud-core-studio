import { describe, expect, test } from "bun:test";
import {
  ApnsPersistenceUncertainError,
  sendApnsDelivery,
} from "../../src/lib/messagingApnsAdapter.server.ts";

describe("unified APNs adapter", () => {
  test("deactivates only permanent token failures while accepting another token", async () => {
    const deactivated = [];
    const reported = [];
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
        report: async (outcome) => reported.push(outcome),
      },
    );
    expect(result).toMatchObject({ ok: true, providerMessageId: "apns-2", status: "sent" });
    expect(deactivated).toEqual(["token-1"]);
    expect(reported).toEqual([
      {
        tokenId: "token-1",
        status: "failed",
        providerMessageId: null,
        failureClass: "permanent",
        errorCode: "apns_unregistered",
      },
      {
        tokenId: "token-2",
        status: "sent",
        providerMessageId: "apns-2",
        failureClass: null,
        errorCode: null,
      },
    ]);
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

  test("keeps an aggregate delivery retryable when one device succeeds and another times out", async () => {
    const result = await sendApnsDelivery(
      [
        { id: "token-1", token: "good" },
        { id: "token-2", token: "temporary" },
      ],
      { title: "Reminder", body: "Soon" },
      {
        send: async (token) =>
          token === "good"
            ? { ok: true, apnsId: "apns-1" }
            : { ok: false, error: "APNs request timed out", apnsId: null },
        deactivate: async () => {},
      },
    );

    expect(result).toMatchObject({ ok: false, failureClass: "transient" });
    expect(result.targetOutcomes.map((outcome) => outcome.status)).toEqual(["sent", "failed"]);
  });

  test("stops after APNs acceptance when target status persistence is uncertain", async () => {
    let sendCount = 0;
    const operation = sendApnsDelivery(
      [{ id: "token-1", token: "device-1" }],
      { title: "Class update", body: "Starts at 18:00" },
      {
        send: async () => {
          sendCount += 1;
          return { ok: true, apnsId: "apns-accepted" };
        },
        deactivate: async () => {},
        report: async () => {
          throw new Error("database unavailable");
        },
      },
    );

    await expect(operation).rejects.toBeInstanceOf(ApnsPersistenceUncertainError);
    expect(sendCount).toBe(1);
  });
});
