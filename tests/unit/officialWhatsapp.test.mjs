import { describe, expect, test } from "bun:test";
import {
  buildOfficialWhatsappTemplatePayload,
  normalizeOfficialWhatsappRecipient,
  sendOfficialWhatsappTemplateMessage,
} from "../../src/lib/officialWhatsapp.server.ts";

function row(triggerType, variables) {
  return {
    trigger_type: triggerType,
    payload: {
      variables: {
        member_name: "נורה",
        class_name: "פילאטיס מזרן",
        class_date: "10/07/2026",
        class_time: "18:00",
        instructor_name: "יארין",
        package_name: "מינוי חודשי",
        credits_available: 10,
        ...variables,
      },
    },
  };
}

describe("official WhatsApp template payloads", () => {
  test("maps booking confirmation variables to the approved Hebrew template", () => {
    expect(buildOfficialWhatsappTemplatePayload(row("booking_confirmed"))).toEqual({
      name: "booking_confirmed_he",
      languageCode: "he",
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: "נורה" },
            { type: "text", text: "פילאטיס מזרן" },
            { type: "text", text: "10/07/2026" },
            { type: "text", text: "18:00" },
            { type: "text", text: "יארין" },
          ],
        },
      ],
    });
  });

  test("maps reminder variables to the two-variable approved template", () => {
    expect(buildOfficialWhatsappTemplatePayload(row("class_reminder_24h"))).toEqual({
      name: "class_reminder_24h_he",
      languageCode: "he",
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: "פילאטיס מזרן" },
            { type: "text", text: "18:00" },
          ],
        },
      ],
    });
  });

  test("maps the payment amount instead of the member credit balance", () => {
    expect(
      buildOfficialWhatsappTemplatePayload(
        row("payment_confirmed", { amount: 350, currency: "ILS", credits_available: 10 }),
      ),
    ).toEqual({
      name: "cc_payment_confirmed_v3",
      languageCode: "he",
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: "נורה" },
            { type: "text", text: "מינוי חודשי" },
            { type: "text", text: "₪350" },
          ],
        },
      ],
    });
  });

  test("maps payment reminders and failures to approved utility templates", () => {
    expect(buildOfficialWhatsappTemplatePayload(row("payment_pending_reminder"))).toEqual({
      name: "payment_pending_reminder_he",
      languageCode: "he",
      components: [
        {
          type: "body",
          parameters: [{ type: "text", text: "נורה" }],
        },
      ],
    });
    expect(buildOfficialWhatsappTemplatePayload(row("payment_failed"))).toEqual({
      name: "payment_failed_he",
      languageCode: "he",
      components: [
        {
          type: "body",
          parameters: [{ type: "text", text: "נורה" }],
        },
      ],
    });
  });

  test("uses the member language for Arabic and English template variants", () => {
    expect(
      buildOfficialWhatsappTemplatePayload({ ...row("payment_failed"), language: "ar" }),
    ).toMatchObject({ name: "payment_failed_ar", languageCode: "ar" });
    expect(
      buildOfficialWhatsappTemplatePayload({ ...row("payment_failed"), language: "en" }),
    ).toMatchObject({ name: "payment_failed_en", languageCode: "en_US" });
  });

  test("uses the approved branded v5 weekly schedule template with its image header", () => {
    expect(buildOfficialWhatsappTemplatePayload(row("weekly_schedule"))).toEqual({
      name: "cc_weekly_schedule_branded_v5",
      languageCode: "he",
      components: [
        {
          type: "header",
          parameters: [
            {
              type: "image",
              image: {
                link: "https://cloudandcorestudio.com/brand/cloud-core-logo-full.png",
              },
            },
          ],
        },
        {
          type: "body",
          parameters: [{ type: "text", text: "נורה" }],
        },
      ],
    });
  });

  test("normalizes local Israeli phone numbers for Meta Cloud API", () => {
    expect(normalizeOfficialWhatsappRecipient("052-331-8478")).toBe("972523318478");
    expect(normalizeOfficialWhatsappRecipient("+972 52 331 8478")).toBe("972523318478");
    expect(normalizeOfficialWhatsappRecipient("12")).toBe(null);
  });

  test("posts a template message to the phone-number messages endpoint", async () => {
    const calls = [];
    const result = await sendOfficialWhatsappTemplateMessage({
      to: "052-331-8478",
      template: {
        name: "booking_confirmed_he",
        languageCode: "he",
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: "נורה" },
              { type: "text", text: "פילאטיס מזרן" },
              { type: "text", text: "10/07/2026" },
              { type: "text", text: "18:00" },
              { type: "text", text: "יארין" },
            ],
          },
        ],
      },
      env: {
        META_GRAPH_API_VERSION: "v25.0",
        META_WHATSAPP_PHONE_NUMBER_ID: "phone-id-1",
        META_ACCESS_TOKEN: "token-1",
      },
      fetchImpl: async (url, init) => {
        calls.push({ url, init });
        return new Response(JSON.stringify({ messages: [{ id: "wamid.1" }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    });

    expect(result).toEqual({ ok: true, providerMessageId: "wamid.1" });
    expect(calls[0].url).toBe("https://graph.facebook.com/v25.0/phone-id-1/messages");
    expect(calls[0].init.headers.authorization).toBe("Bearer token-1");
    expect(JSON.parse(calls[0].init.body)).toMatchObject({
      messaging_product: "whatsapp",
      to: "972523318478",
      type: "template",
      template: {
        name: "booking_confirmed_he",
        language: { code: "he" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: "נורה" },
              { type: "text", text: "פילאטיס מזרן" },
              { type: "text", text: "10/07/2026" },
              { type: "text", text: "18:00" },
              { type: "text", text: "יארין" },
            ],
          },
        ],
      },
    });
  });

  test("rejects the retired positional template shape before dispatch", async () => {
    let requests = 0;
    const result = await sendOfficialWhatsappTemplateMessage({
      to: "052-331-8478",
      template: {
        name: "booking_confirmed_he",
        languageCode: "he",
        bodyParameters: ["נורה"],
      },
      env: {
        META_GRAPH_API_VERSION: "v25.0",
        META_WHATSAPP_PHONE_NUMBER_ID: "phone-id-1",
        META_ACCESS_TOKEN: "token-1",
      },
      fetchImpl: async () => {
        requests += 1;
        return Response.json({ messages: [{ id: "unexpected" }] });
      },
    });

    expect(result).toEqual({
      ok: false,
      retryable: false,
      error: "invalid_official_whatsapp_template_components",
    });
    expect(requests).toBe(0);
  });

  test("classifies a post-dispatch network rejection as ambiguous and non-retryable", async () => {
    const result = await sendOfficialWhatsappTemplateMessage({
      to: "052-331-8478",
      template: {
        name: "payment_failed_he",
        languageCode: "he",
        components: [
          {
            type: "body",
            parameters: [{ type: "text", text: "נורה" }],
          },
        ],
      },
      env: {
        META_GRAPH_API_VERSION: "v25.0",
        META_WHATSAPP_PHONE_NUMBER_ID: "phone-id-1",
        META_ACCESS_TOKEN: "token-1",
      },
      fetchImpl: async () => {
        throw new Error("connection reset after request transmission");
      },
    });

    expect(result).toEqual({
      ok: false,
      retryable: false,
      ambiguous: true,
      error: "connection reset after request transmission",
    });
  });
});
