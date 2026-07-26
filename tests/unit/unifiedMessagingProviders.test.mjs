import { describe, expect, test } from "bun:test";
import { sendResendEmail, sendWhatsappTemplate } from "../../src/lib/messagingProviders.server.ts";

describe("unified messaging provider adapters", () => {
  test("sends WhatsApp v2 templates and preserves the returned wamid", async () => {
    const requests = [];
    const result = await sendWhatsappTemplate(
      {
        to: "972501234567",
        templateName: "cc_booking_confirmed_v2",
        languageCode: "he",
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
              { type: "text", text: "נועה" },
              { type: "text", text: "פילאטיס" },
            ],
          },
        ],
      },
      {
        META_GRAPH_API_VERSION: "v25.0",
        META_WHATSAPP_PHONE_NUMBER_ID: "phone-1",
        META_ACCESS_TOKEN: "secret",
      },
      async (url, init) => {
        requests.push({ url, init });
        return Response.json({ messages: [{ id: "wamid.123" }] });
      },
    );
    expect(result).toEqual({ ok: true, providerMessageId: "wamid.123", status: "accepted" });
    expect(JSON.parse(requests[0].init.body).template).toEqual({
      name: "cc_booking_confirmed_v2",
      language: { code: "he" },
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
            { type: "text", text: "נועה" },
            { type: "text", text: "פילאטיס" },
          ],
        },
      ],
    });
  });

  test("marks a transmitted WhatsApp timeout ambiguous", async () => {
    const result = await sendWhatsappTemplate(
      {
        to: "972501234567",
        templateName: "cc_human_handoff_v2",
        languageCode: "ar",
        components: [
          {
            type: "body",
            parameters: [{ type: "text", text: "ليان" }],
          },
        ],
      },
      {
        META_GRAPH_API_VERSION: "v25.0",
        META_WHATSAPP_PHONE_NUMBER_ID: "phone-1",
        META_ACCESS_TOKEN: "secret",
      },
      async () => {
        throw new DOMException("timed out", "TimeoutError");
      },
    );
    expect(result).toMatchObject({ ok: false, failureClass: "ambiguous" });
  });

  test("treats any post-dispatch WhatsApp transport rejection as ambiguous", async () => {
    const result = await sendWhatsappTemplate(
      {
        to: "972501234567",
        templateName: "cc_booking_confirmed_v2",
        languageCode: "en_US",
        components: [
          {
            type: "body",
            parameters: [{ type: "text", text: "Staff" }],
          },
        ],
      },
      {
        META_GRAPH_API_VERSION: "v25.0",
        META_WHATSAPP_PHONE_NUMBER_ID: "phone-1",
        META_ACCESS_TOKEN: "secret",
      },
      async () => {
        throw new TypeError("socket closed after request write");
      },
    );
    expect(result).toMatchObject({ ok: false, failureClass: "ambiguous" });
  });

  test("requires a wamid before accepting a successful WhatsApp response", async () => {
    const result = await sendWhatsappTemplate(
      {
        to: "972501234567",
        templateName: "cc_booking_confirmed_v2",
        languageCode: "en_US",
        components: [
          {
            type: "body",
            parameters: [{ type: "text", text: "Staff" }],
          },
        ],
      },
      {
        META_GRAPH_API_VERSION: "v25.0",
        META_WHATSAPP_PHONE_NUMBER_ID: "phone-1",
        META_ACCESS_TOKEN: "secret",
      },
      async () => Response.json({ messages: [{}] }),
    );
    expect(result).toEqual({
      ok: false,
      failureClass: "ambiguous",
      error: "whatsapp_response_missing_message_id",
    });
  });

  test("rejects missing or malformed typed components before dispatch", async () => {
    let requests = 0;
    const invalidComponents = [
      undefined,
      [],
      [{ type: "body", parameters: [{ type: "text", value: "not-text" }] }],
      [
        { type: "body", parameters: [{ type: "text", text: "first" }] },
        { type: "body", parameters: [{ type: "text", text: "duplicate" }] },
      ],
      [
        {
          type: "header",
          parameters: [{ type: "image", image: { link: "https://example.com/header.webp" } }],
        },
      ],
    ];

    for (const components of invalidComponents) {
      const result = await sendWhatsappTemplate(
        {
          to: "972501234567",
          templateName: "cc_booking_confirmed_v2",
          languageCode: "he",
          components,
        },
        {
          META_GRAPH_API_VERSION: "v25.0",
          META_WHATSAPP_PHONE_NUMBER_ID: "phone-1",
          META_ACCESS_TOKEN: "secret",
        },
        async () => {
          requests += 1;
          return Response.json({ messages: [{ id: "unexpected" }] });
        },
      );
      expect(result).toEqual({
        ok: false,
        failureClass: "configuration",
        error: "whatsapp_template_components_missing_or_invalid",
      });
    }

    expect(requests).toBe(0);
  });

  test("reuses the delivery idempotency key for Resend", async () => {
    const requests = [];
    const input = {
      to: "staff@example.com",
      subject: "Booking confirmed",
      html: "<p>Confirmed</p>",
      text: "Confirmed",
      headers: { "X-Entity-Ref-ID": "cc-booking-delivery-123" },
      idempotencyKey: "delivery-123",
    };
    const env = {
      RESEND_API_KEY: "re_test",
      MESSAGING_EMAIL_FROM: "Cloud & Core <studio@example.com>",
      MESSAGING_EMAIL_REPLY_TO: "team@example.com",
    };
    const fetchImpl = async (_url, init) => {
      requests.push(init);
      return Response.json({ id: "email-123" });
    };
    await sendResendEmail(input, env, fetchImpl);
    await sendResendEmail(input, env, fetchImpl);
    expect(requests.map((request) => request.headers["Idempotency-Key"])).toEqual([
      "delivery-123",
      "delivery-123",
    ]);
    expect(requests.map((request) => JSON.parse(request.body).text)).toEqual([
      "Confirmed",
      "Confirmed",
    ]);
    expect(JSON.parse(requests[0].body).headers).toEqual({
      "X-Entity-Ref-ID": "cc-booking-delivery-123",
    });
  });
});
