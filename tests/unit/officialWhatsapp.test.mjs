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
      bodyParameters: ["נורה", "פילאטיס מזרן", "10/07/2026", "18:00", "יארין"],
    });
  });

  test("maps reminder variables to the two-variable approved template", () => {
    expect(buildOfficialWhatsappTemplatePayload(row("class_reminder_24h"))).toEqual({
      name: "class_reminder_24h_he",
      languageCode: "he",
      bodyParameters: ["פילאטיס מזרן", "18:00"],
    });
  });

  test("maps payment variables and falls back when credits are not available", () => {
    expect(
      buildOfficialWhatsappTemplatePayload(row("payment_confirmed", { credits_available: null })),
    ).toEqual({
      name: "payment_confirmed_he",
      languageCode: "he",
      bodyParameters: ["נורה", "מינוי חודשי", "עודכן"],
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
        bodyParameters: ["נורה", "פילאטיס מזרן", "10/07/2026", "18:00", "יארין"],
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
      },
    });
  });
});
