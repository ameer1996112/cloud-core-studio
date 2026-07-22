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
        parameters: ["נועה", "פילאטיס", "20/07", "18:00", "ירין"],
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
    expect(JSON.parse(requests[0].init.body).template.name).toBe("cc_booking_confirmed_v2");
  });

  test("marks a transmitted WhatsApp timeout ambiguous", async () => {
    const result = await sendWhatsappTemplate(
      {
        to: "972501234567",
        templateName: "cc_human_handoff_v2",
        languageCode: "ar",
        parameters: ["ليان"],
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
        parameters: ["Staff", "Class", "20/07", "18:00", "Yareen"],
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
        parameters: ["Staff", "Class", "20/07", "18:00", "Yareen"],
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
