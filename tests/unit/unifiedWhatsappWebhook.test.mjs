import { createHmac } from "node:crypto";
import { describe, expect, test } from "bun:test";
import {
  handleVerifiedWhatsappWebhook,
  parseOfficialWhatsappInboundMessages,
} from "../../src/lib/officialWhatsappWebhook.server.ts";

function signed(body, secret = "app-secret") {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

const payload = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "waba-1",
      changes: [
        {
          value: {
            metadata: { phone_number_id: "phone-1" },
            contacts: [{ wa_id: "972501234567" }],
            messages: [
              {
                id: "wamid.inbound-1",
                from: "972501234567",
                timestamp: "1783250000",
                type: "text",
                text: { body: "הסרה בבקשה" },
              },
            ],
          },
        },
      ],
    },
  ],
};

describe("secure idempotent WhatsApp webhook ingestion", () => {
  test("parses text, interactive replies, and media metadata without media bytes", () => {
    const messages = parseOfficialWhatsappInboundMessages({
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  { id: "1", from: "a", type: "button", button: { text: "Yes", payload: "yes" } },
                  {
                    id: "2",
                    from: "a",
                    type: "image",
                    image: { id: "media-1", mime_type: "image/jpeg", caption: "photo" },
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    expect(messages).toEqual([
      expect.objectContaining({ messageId: "1", kind: "interactive", text: "Yes" }),
      expect.objectContaining({
        messageId: "2",
        kind: "media",
        media: { id: "media-1", mimeType: "image/jpeg", caption: "photo", filename: null },
      }),
    ]);
  });

  test("fails closed without secret or on identity mismatch", async () => {
    const body = JSON.stringify(payload);
    const deps = { persistEvent: async () => ({ inserted: true }) };
    expect(
      await handleVerifiedWhatsappWebhook({ rawBody: body, signature: signed(body) }, {}, deps),
    ).toMatchObject({
      ok: false,
      status: 503,
      reason: "missing_whatsapp_app_secret",
    });
    expect(
      await handleVerifiedWhatsappWebhook(
        { rawBody: body, signature: signed(body) },
        { appSecret: "app-secret", wabaId: "wrong", phoneNumberId: "phone-1" },
        deps,
      ),
    ).toMatchObject({ ok: false, status: 401, reason: "whatsapp_identity_mismatch" });
  });

  test("persists before processing, deduplicates replay, opts out, and opens one handoff", async () => {
    const body = JSON.stringify(payload);
    const order = [];
    const seen = new Set();
    const deps = {
      persistEvent: async (event) => {
        order.push(`persist:${event.eventKey}`);
        if (seen.has(event.eventKey)) return { inserted: false };
        seen.add(event.eventKey);
        return { inserted: true };
      },
      applyStatus: async () => order.push("status"),
      openConversation: async () => {
        order.push("open");
        return {
          conversationId: "conversation-1",
          newlyOpened: true,
          acknowledgementNeeded: true,
          openGeneration: "generation-1",
          memberId: "member-1",
          language: "he",
        };
      },
      recordInbound: async () => order.push("record"),
      optOutWhatsapp: async () => order.push("optout"),
      enqueueAcknowledgement: async () => order.push("ack"),
      alertAdmins: async () => order.push("alert"),
    };
    const config = { appSecret: "app-secret", wabaId: "waba-1", phoneNumberId: "phone-1" };
    expect(
      await handleVerifiedWhatsappWebhook({ rawBody: body, signature: signed(body) }, config, deps),
    ).toMatchObject({ ok: true, processed: 1, duplicates: 0 });
    expect(order[0]).toBe("persist:message:wamid.inbound-1");
    expect(order).toContain("optout");
    expect(order).toContain("ack");

    order.length = 0;
    expect(
      await handleVerifiedWhatsappWebhook({ rawBody: body, signature: signed(body) }, config, deps),
    ).toMatchObject({ ok: true, processed: 0, duplicates: 1 });
    expect(order).toEqual(["persist:message:wamid.inbound-1"]);
  });

  test("keeps an early unmatched status pending for provider retry and reconciliation", async () => {
    const statusPayload = {
      entry: [
        {
          id: "waba-1",
          changes: [
            {
              value: {
                metadata: { phone_number_id: "phone-1" },
                statuses: [{ id: "wamid.early", status: "delivered", timestamp: "1783250000" }],
              },
            },
          ],
        },
      ],
    };
    const body = JSON.stringify(statusPayload);
    let marked = false;
    const result = await handleVerifiedWhatsappWebhook(
      { rawBody: body, signature: signed(body) },
      { appSecret: "app-secret", wabaId: "waba-1", phoneNumberId: "phone-1" },
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
