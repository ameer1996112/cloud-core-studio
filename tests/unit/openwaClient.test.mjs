import { describe, expect, test } from "bun:test";
import { createOpenwaClient, getOpenwaRuntimeConfig } from "../../src/lib/openwa.server.ts";

describe("openwa client", () => {
  test("normalizes phone and sends session-bound text message", async () => {
    const calls = [];
    const client = createOpenwaClient({
      baseUrl: "http://localhost:2785",
      apiKey: "key-1",
      sessionId: "session-1",
      fetchImpl: async (url, init) => {
        calls.push({ url, init });
        return new Response(JSON.stringify({ id: "provider-msg-1" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    });

    const result = await client.sendText({
      to: "+972 50-123-4567",
      text: "Payment approved",
    });

    expect(result).toEqual({
      ok: true,
      providerMessageId: "provider-msg-1",
    });
    expect(calls[0].url).toBe("http://localhost:2785/api/sessions/session-1/messages/send-text");
    expect(calls[0].init.headers["x-api-key"]).toBe("key-1");
    expect(calls[0].init.body).toContain('"chatId":"972501234567@c.us"');
  });

  test("marks provider 503 as retryable", async () => {
    const client = createOpenwaClient({
      baseUrl: "http://localhost:2785",
      apiKey: "key-1",
      sessionId: "session-1",
      fetchImpl: async () => new Response("offline", { status: 503 }),
    });

    const result = await client.sendText({
      to: "+972501234567",
      text: "Payment approved",
    });

    expect(result.ok).toBe(false);
    expect(result.retryable).toBe(true);
  });

  test("marks rejected fetch as retryable", async () => {
    const client = createOpenwaClient({
      baseUrl: "http://localhost:2785",
      apiKey: "key-1",
      sessionId: "session-1",
      fetchImpl: async () => {
        throw new Error("socket hang up");
      },
    });

    const result = await client.sendText({
      to: "+972501234567",
      text: "Payment approved",
    });

    expect(result).toEqual({
      ok: false,
      retryable: true,
      error: "socket hang up",
    });
  });

  test("marks invalid phone as non-retryable", async () => {
    const client = createOpenwaClient({
      baseUrl: "http://localhost:2785",
      apiKey: "key-1",
      sessionId: "session-1",
      fetchImpl: async () => new Response("should not be called", { status: 200 }),
    });

    const result = await client.sendText({
      to: "12",
      text: "Payment approved",
    });

    expect(result).toEqual({
      ok: false,
      retryable: false,
      error: "invalid_whatsapp_phone",
    });
  });

  test("throws when OpenWA runtime env is incomplete", () => {
    expect(() =>
      getOpenwaRuntimeConfig({
        OPENWA_BASE_URL: "http://localhost:2785",
        OPENWA_API_KEY: "",
        OPENWA_SESSION_ID: "session-1",
      }),
    ).toThrow("missing_openwa_runtime_config");
  });

  test("converts local israeli numbers to E.164 chat ids", async () => {
    const calls = [];
    const client = createOpenwaClient({
      baseUrl: "http://localhost:2785",
      apiKey: "key-1",
      sessionId: "session-1",
      fetchImpl: async (url, init) => {
        calls.push({ url, init });
        return new Response(JSON.stringify({ id: "provider-msg-2" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    });

    const result = await client.sendText({
      to: "052-331-8478",
      text: "Payment approved",
    });

    expect(result).toEqual({
      ok: true,
      providerMessageId: "provider-msg-2",
    });
    expect(calls[0].init.body).toContain('"chatId":"972523318478@c.us"');
  });
});
