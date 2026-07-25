import { describe, expect, test } from "bun:test";
import { buildConciergeMaterializationPlan } from "../../src/lib/conciergeMaterialization.ts";

const rendered = [
  {
    channel: "in_app",
    templateId: "template-in-app",
    templateVersion: 2,
    subject: "Booked",
    body: "Your class is booked.",
  },
  {
    channel: "push",
    templateId: "template-push",
    templateVersion: 3,
    subject: "Booked",
    body: "Your class is booked.",
  },
  {
    channel: "whatsapp",
    templateId: "template-whatsapp",
    templateVersion: 4,
    subject: null,
    body: "Your class is booked.",
  },
];

describe("concierge delivery materialization plan", () => {
  test("creates deterministic channel-specific snapshots and deliveries", () => {
    const plan = buildConciergeMaterializationPlan({
      decisionKey: "decision:booking-1",
      templateKey: "booking_confirmed_first",
      locale: "ar",
      rendered,
      variables: { member_name: "Lian", class_name: "Pilates" },
      recipient: {
        memberId: "member-1",
        email: "member@example.com",
        phoneE164: "+972500000000",
      },
      scheduledFor: "2026-07-26T10:00:00.000Z",
      expiresAt: null,
    });

    expect(plan.map((item) => item.delivery.idempotencyKey)).toEqual([
      "decision:booking-1:in_app",
      "decision:booking-1:push",
      "decision:booking-1:whatsapp",
    ]);
    expect(plan.map((item) => item.delivery.recipientAddress)).toEqual([
      "member-1",
      "member-1",
      "+972500000000",
    ]);
    expect(plan[2].delivery.providerPayload).toEqual({
      template_name: "booking_confirmed_first",
      template_language: "ar",
      parameters: ["Lian", "Pilates"],
    });
  });

  test("suppresses a delivery with no usable destination", () => {
    const [email] = buildConciergeMaterializationPlan({
      decisionKey: "decision:receipt-1",
      templateKey: "receipt_issued",
      locale: "en",
      rendered: [
        {
          channel: "email",
          templateId: "template-email",
          templateVersion: 1,
          subject: "Receipt",
          body: "Attached receipt",
        },
      ],
      variables: {},
      recipient: { memberId: "member-1", email: null, phoneE164: null },
      scheduledFor: "2026-07-26T10:00:00.000Z",
      expiresAt: null,
    });

    expect(email.delivery).toMatchObject({
      status: "suppressed",
      errorCode: "missing_email_recipient",
      recipientAddress: null,
    });
  });
});
