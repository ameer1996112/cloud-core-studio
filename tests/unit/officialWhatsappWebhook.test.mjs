import { describe, expect, test } from "bun:test";
import {
  parseOfficialWhatsappStatuses,
  recordOfficialWhatsappStatuses,
  verifyMetaSignature,
} from "../../src/lib/officialWhatsappWebhook.server.ts";
import { createHmac } from "node:crypto";

describe("official WhatsApp webhook helpers", () => {
  test("parses status callbacks from WhatsApp webhook payloads", () => {
    const statuses = parseOfficialWhatsappStatuses({
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              value: {
                statuses: [
                  { id: "wamid.sent", status: "sent", timestamp: "1783250000" },
                  {
                    id: "wamid.failed",
                    status: "failed",
                    timestamp: "1783250001",
                    errors: [{ code: 131026, title: "Message undeliverable" }],
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    expect(statuses).toEqual([
      {
        messageId: "wamid.sent",
        status: "sent",
        timestamp: "1783250000",
        error: null,
      },
      {
        messageId: "wamid.failed",
        status: "failed",
        timestamp: "1783250001",
        error: "131026: Message undeliverable",
      },
    ]);
  });

  test("records every parsed status through injected deps", async () => {
    const updates = [];
    const result = await recordOfficialWhatsappStatuses(
      {
        entry: [
          {
            changes: [{ value: { statuses: [{ id: "wamid.1", status: "delivered" }] } }],
          },
        ],
      },
      {
        async updateMessageStatus(input) {
          updates.push(input);
        },
      },
    );

    expect(result).toEqual({ processed: 1 });
    expect(updates).toEqual([
      { messageId: "wamid.1", status: "delivered", timestamp: null, error: null },
    ]);
  });

  test("validates Meta x-hub-signature-256 headers", () => {
    const body = JSON.stringify({ hello: "world" });
    const secret = "app-secret";
    const signature = createHmac("sha256", secret).update(body, "utf8").digest("hex");

    expect(verifyMetaSignature(body, `sha256=${signature}`, secret)).toBe(true);
    expect(verifyMetaSignature(body, "sha256=deadbeef", secret)).toBe(false);
  });
});
