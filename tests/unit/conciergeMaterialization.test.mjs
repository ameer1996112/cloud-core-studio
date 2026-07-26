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
      journeyType: "booking",
      presentationByChannel: {
        in_app: "booking_confirmed_first:in_app:v2",
        push: "booking_confirmed_first:push:v1",
        whatsapp: "booking_confirmed_first:whatsapp:v2",
      },
      actionByChannel: {
        in_app: "https://cloudandcorestudio.com/member/bookings",
        push: "https://cloudandcorestudio.com/member/bookings",
        whatsapp: "https://cloudandcorestudio.com/member/bookings",
      },
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
      template_name: "booking_confirmed_first_branded_v2",
      template_language: "ar",
      presentation_key: "booking_confirmed_first:whatsapp:v2",
      components: [
        {
          type: "header",
          parameters: [
            {
              type: "image",
              image: {
                link: "https://cloudandcorestudio.com/brand/concierge-whatsapp-header.webp",
              },
            },
          ],
        },
        {
          type: "body",
          parameters: [
            { type: "text", text: "Lian" },
            { type: "text", text: "Pilates" },
          ],
        },
      ],
    });
    expect(plan[0].snapshot).toMatchObject({
      presentationKey: "booking_confirmed_first:in_app:v2",
      journeyType: "booking",
      actionUrl: "https://cloudandcorestudio.com/member/bookings",
    });
  });

  test("preserves the selected payment presentation evidence", () => {
    const [plan] = buildConciergeMaterializationPlan({
      decisionKey: "decision:payment-1",
      templateKey: "payment_requires_action",
      journeyType: "payment_outcome",
      presentationByChannel: { email: "payment_requires_action:email:v2" },
      actionByChannel: { email: "https://cloudandcorestudio.com/member/payments" },
      locale: "en",
      rendered: [
        {
          channel: "email",
          templateId: "template-email",
          templateVersion: 2,
          subject: "Payment action required",
          body: "Review payment",
        },
      ],
      variables: {},
      recipient: { memberId: "member-1", email: "member@example.com", phoneE164: null },
      scheduledFor: "2026-07-26T10:00:00.000Z",
      expiresAt: null,
    });

    expect(plan.snapshot).toMatchObject({
      presentationKey: "payment_requires_action:email:v2",
      journeyType: "payment_outcome",
      actionUrl: "https://cloudandcorestudio.com/member/payments",
    });
  });

  test("suppresses a delivery with no usable destination", () => {
    const [email] = buildConciergeMaterializationPlan({
      decisionKey: "decision:receipt-1",
      templateKey: "receipt_issued",
      journeyType: "receipt",
      presentationByChannel: { email: "receipt_issued:email:v2" },
      actionByChannel: { email: null },
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
