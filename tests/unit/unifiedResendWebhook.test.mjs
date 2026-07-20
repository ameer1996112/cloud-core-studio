import { createHmac } from "node:crypto";
import { describe, expect, test } from "bun:test";
import {
  handleVerifiedResendWebhook,
  verifyResendWebhookSignature,
} from "../../src/lib/resendWebhook.server.ts";
import { resendCanonicalStatus } from "../../src/lib/messageStatus.server.ts";

function signature(rawBody, id, timestamp, secret) {
  const key = Buffer.from(secret.slice("whsec_".length), "base64");
  const value = createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest("base64");
  return `v1,${value}`;
}

describe("secure idempotent Resend webhook ingestion", () => {
  test("preserves Resend delivery-delayed as a provider status", () => {
    expect(resendCanonicalStatus("delivery_delayed")).toBe("delivery_delayed");
  });
  test("verifies the raw Svix payload", () => {
    const rawBody = JSON.stringify({ type: "email.delivered" });
    const id = "msg_1";
    const timestamp = "1784556000";
    const secret = `whsec_${Buffer.from("webhook-secret").toString("base64")}`;
    expect(
      verifyResendWebhookSignature(
        rawBody,
        { id, timestamp, signature: signature(rawBody, id, timestamp, secret) },
        secret,
        new Date(Number(timestamp) * 1000),
      ),
    ).toBe(true);
    expect(
      verifyResendWebhookSignature(
        `${rawBody} `,
        { id, timestamp, signature: signature(rawBody, id, timestamp, secret) },
        secret,
        new Date(Number(timestamp) * 1000),
      ),
    ).toBe(false);
  });

  test("persists a unique svix-id before applying provider status", async () => {
    const rawBody = JSON.stringify({
      type: "email.delivered",
      created_at: "2026-07-20T10:00:00.000Z",
      data: { email_id: "email-123", to: ["private@example.com"] },
    });
    const id = "msg_2";
    const timestamp = "1784556000";
    const secret = `whsec_${Buffer.from("webhook-secret").toString("base64")}`;
    const order = [];
    const result = await handleVerifiedResendWebhook(
      {
        rawBody,
        svixId: id,
        svixTimestamp: timestamp,
        svixSignature: signature(rawBody, id, timestamp, secret),
      },
      { secret, now: new Date(Number(timestamp) * 1000) },
      {
        persistEvent: async (event) => {
          order.push(["persist", event]);
          return { inserted: true, eventId: "event-1" };
        },
        applyStatus: async (event) => order.push(["apply", event]),
        markProcessed: async () => order.push(["processed"]),
      },
    );
    expect(result).toMatchObject({ ok: true, processed: 1 });
    expect(order[0][0]).toBe("persist");
    expect(order[0][1].payload).not.toHaveProperty("to");
    expect(order[1]).toEqual([
      "apply",
      expect.objectContaining({ providerMessageId: "email-123", providerStatus: "delivered" }),
    ]);
  });

  test("does not acknowledge an unmatched early delivery event", async () => {
    const rawBody = JSON.stringify({
      type: "email.delivered",
      created_at: "2026-07-20T10:00:00.000Z",
      data: { email_id: "email-early" },
    });
    const id = "msg_early";
    const timestamp = "1784556000";
    const secret = `whsec_${Buffer.from("webhook-secret").toString("base64")}`;
    let marked = false;
    const result = await handleVerifiedResendWebhook(
      {
        rawBody,
        svixId: id,
        svixTimestamp: timestamp,
        svixSignature: signature(rawBody, id, timestamp, secret),
      },
      { secret, now: new Date(Number(timestamp) * 1000) },
      {
        persistEvent: async () => ({ inserted: true, eventId: "event-early" }),
        applyStatus: async () => false,
        markProcessed: async () => {
          marked = true;
        },
      },
    );
    expect(result).toMatchObject({ ok: false, status: 503, reason: "webhook_delivery_unmatched" });
    expect(marked).toBe(false);
  });
});
