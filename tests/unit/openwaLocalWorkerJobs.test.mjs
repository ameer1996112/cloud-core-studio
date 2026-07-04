import { describe, expect, test } from "bun:test";
import { processClaimedJobs, sendViaOpenwa } from "../../scripts/openwa-local-worker.mjs";

function createConfig(overrides = {}) {
  return {
    workerId: "studio-mac",
    testPhone: null,
    options: {
      dryRun: false,
      testPhoneOnly: false,
      limit: 5,
    },
    ...overrides,
  };
}

function createJob(id, overrides = {}) {
  return {
    id,
    to: "+972501234567",
    text: "Message ready",
    triggerType: "payment_confirmed",
    ...overrides,
  };
}

describe("processClaimedJobs", () => {
  test("sendViaOpenwa posts chatId and text for the OpenWA send-text endpoint", async () => {
    const requests = [];
    const result = await sendViaOpenwa(
      {
        openwaBaseUrl: "http://localhost:2785",
        openwaApiKey: "openwa-key",
        openwaSessionId: "session-1",
      },
      createJob("job-1", { to: "0546464437", text: "Booking confirmed" }),
      {
        fetchImpl: async (url, init) => {
          requests.push({
            url: String(url),
            method: init.method,
            headers: init.headers,
            body: init.body ? JSON.parse(init.body) : null,
          });
          if (String(url).includes("/contacts/check/")) {
            return new Response(
              JSON.stringify({
                exists: true,
                whatsappId: "972546464437@c.us",
              }),
              { status: 200 },
            );
          }
          return new Response(JSON.stringify({ id: "provider-1" }), { status: 200 });
        },
      },
    );

    expect(result).toEqual({ ok: true, providerMessageId: "provider-1" });
    expect(requests).toEqual([
      {
        url: "http://localhost:2785/api/sessions/session-1/contacts/check/972546464437",
        method: "GET",
        headers: {
          "x-api-key": "openwa-key",
        },
        body: null,
      },
      {
        url: "http://localhost:2785/api/sessions/session-1/messages/send-text",
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": "openwa-key",
        },
        body: {
          chatId: "972546464437@c.us",
          text: "Booking confirmed",
        },
      },
    ]);
  });

  test("sendViaOpenwa reports a non-retryable failure when OpenWA says the number is not on WhatsApp", async () => {
    const result = await sendViaOpenwa(
      {
        openwaBaseUrl: "http://localhost:2785",
        openwaApiKey: "openwa-key",
        openwaSessionId: "session-1",
      },
      createJob("job-1", { to: "0546464437", text: "Booking confirmed" }),
      {
        fetchImpl: async () =>
          new Response(JSON.stringify({ exists: false, whatsappId: null }), { status: 200 }),
      },
    );

    expect(result).toEqual({
      ok: false,
      retryable: false,
      error: "whatsapp_number_not_found",
    });
  });

  test("sendViaOpenwa resolves the current ready session by name", async () => {
    const requests = [];
    const result = await sendViaOpenwa(
      {
        openwaBaseUrl: "http://localhost:2785",
        openwaApiKey: "openwa-key",
        openwaSessionId: "old-session",
        openwaSessionName: "notifications-bot",
      },
      createJob("job-1", { to: "0546464437", text: "Booking confirmed" }),
      {
        fetchImpl: async (url, init) => {
          requests.push({
            url: String(url),
            method: init.method,
            body: init.body ? JSON.parse(init.body) : null,
          });
          if (String(url) === "http://localhost:2785/api/sessions") {
            return new Response(
              JSON.stringify({
                sessions: [
                  { id: "old-session", name: "notifications-bot", status: "logged_out" },
                  { id: "ready-session", name: "notifications-bot", status: "ready" },
                ],
              }),
              { status: 200 },
            );
          }
          if (String(url).includes("/contacts/check/")) {
            return new Response(
              JSON.stringify({
                exists: true,
                whatsappId: "972546464437@c.us",
              }),
              { status: 200 },
            );
          }
          return new Response(JSON.stringify({ id: "provider-1" }), { status: 200 });
        },
      },
    );

    expect(result).toEqual({ ok: true, providerMessageId: "provider-1" });
    expect(requests.map((request) => `${request.method} ${request.url}`)).toEqual([
      "GET http://localhost:2785/api/sessions",
      "GET http://localhost:2785/api/sessions/ready-session/contacts/check/972546464437",
      "POST http://localhost:2785/api/sessions/ready-session/messages/send-text",
    ]);
  });

  test("sendViaOpenwa retries later when the named session is not ready", async () => {
    const result = await sendViaOpenwa(
      {
        openwaBaseUrl: "http://localhost:2785",
        openwaApiKey: "openwa-key",
        openwaSessionId: null,
        openwaSessionName: "notifications-bot",
      },
      createJob("job-1", { to: "0546464437", text: "Booking confirmed" }),
      {
        fetchImpl: async () =>
          new Response(
            JSON.stringify({
              sessions: [{ id: "session-1", name: "notifications-bot", status: "qr" }],
            }),
            { status: 200 },
          ),
      },
    );

    expect(result).toEqual({
      ok: false,
      retryable: true,
      error: "openwa_session_not_ready",
    });
  });

  test("sendViaOpenwa captures messageId responses from OpenWA", async () => {
    const result = await sendViaOpenwa(
      {
        openwaBaseUrl: "http://localhost:2785",
        openwaApiKey: "openwa-key",
        openwaSessionId: "session-1",
      },
      createJob("job-1", { to: "0546464437", text: "Booking confirmed" }),
      {
        fetchImpl: async () =>
          new Response(JSON.stringify({ messageId: "provider-message-1" }), { status: 201 }),
      },
    );

    expect(result).toEqual({ ok: true, providerMessageId: "provider-message-1" });
  });

  test("sendViaOpenwa treats OpenWA history failure as retryable delivery failure", async () => {
    const requests = [];
    const result = await sendViaOpenwa(
      {
        openwaBaseUrl: "http://localhost:2785",
        openwaApiKey: "openwa-key",
        openwaSessionId: "session-1",
        openwaSendVerifyDelayMs: 1,
      },
      createJob("job-1", { to: "0546464437", text: "Booking confirmed" }),
      {
        fetchImpl: async (url, init) => {
          requests.push({ url: String(url), method: init.method });
          if (String(url).includes("/contacts/check/")) {
            return new Response(
              JSON.stringify({
                exists: true,
                whatsappId: "972546464437@c.us",
              }),
              { status: 200 },
            );
          }
          if (String(url).includes("/messages/send-text")) {
            return new Response(JSON.stringify({ messageId: "provider-message-1" }), {
              status: 201,
            });
          }
          return new Response(
            JSON.stringify({
              messages: [{ waMessageId: "provider-message-1", status: "failed" }],
            }),
            { status: 200 },
          );
        },
      },
    );

    expect(result).toEqual({
      ok: false,
      retryable: true,
      error: "openwa_delivery_failed",
      providerMessageId: "provider-message-1",
    });
    expect(requests.map((request) => request.method)).toEqual(["GET", "POST", "GET"]);
  });

  test("sendViaOpenwa treats local sent status as unconfirmed when delivery confirmation is required", async () => {
    const result = await sendViaOpenwa(
      {
        openwaBaseUrl: "http://localhost:2785",
        openwaApiKey: "openwa-key",
        openwaSessionId: "session-1",
        openwaSendVerifyDelayMs: 1,
        openwaRequireDeliveryConfirmation: true,
      },
      createJob("job-1", { to: "0546464437", text: "Booking confirmed" }),
      {
        fetchImpl: async (url) => {
          if (String(url).includes("/contacts/check/")) {
            return new Response(
              JSON.stringify({
                exists: true,
                whatsappId: "972546464437@c.us",
              }),
              { status: 200 },
            );
          }
          if (String(url).includes("/messages/send-text")) {
            return new Response(JSON.stringify({ messageId: "provider-message-1" }), {
              status: 201,
            });
          }
          return new Response(
            JSON.stringify({
              messages: [{ waMessageId: "provider-message-1", status: "sent" }],
            }),
            { status: 200 },
          );
        },
      },
    );

    expect(result).toEqual({
      ok: false,
      retryable: false,
      error: "openwa_delivery_unconfirmed",
      providerMessageId: "provider-message-1",
    });
  });

  test("sendViaOpenwa accepts delivered history status when delivery confirmation is required", async () => {
    const result = await sendViaOpenwa(
      {
        openwaBaseUrl: "http://localhost:2785",
        openwaApiKey: "openwa-key",
        openwaSessionId: "session-1",
        openwaSendVerifyDelayMs: 1,
        openwaRequireDeliveryConfirmation: true,
      },
      createJob("job-1", { to: "0546464437", text: "Booking confirmed" }),
      {
        fetchImpl: async (url) => {
          if (String(url).includes("/contacts/check/")) {
            return new Response(
              JSON.stringify({
                exists: true,
                whatsappId: "972546464437@c.us",
              }),
              { status: 200 },
            );
          }
          if (String(url).includes("/messages/send-text")) {
            return new Response(JSON.stringify({ messageId: "provider-message-1" }), {
              status: 201,
            });
          }
          return new Response(
            JSON.stringify({
              messages: [{ waMessageId: "provider-message-1", status: "delivered" }],
            }),
            { status: 200 },
          );
        },
      },
    );

    expect(result).toEqual({ ok: true, providerMessageId: "provider-message-1" });
  });

  test("continues after a send transport exception and reports a retryable failure", async () => {
    const sends = [];
    const reports = [];
    const errors = [];
    const infos = [];

    await processClaimedJobs(createConfig(), [createJob("job-1"), createJob("job-2")], {
      async sendViaOpenwa(_config, job) {
        sends.push(job.id);
        if (job.id === "job-1") {
          throw new Error("fetch rejected");
        }
        return { ok: true, providerMessageId: `provider-${job.id}` };
      },
      async reportResult(_config, body) {
        reports.push(body);
      },
      logError(message) {
        errors.push(message);
      },
      logInfo(message) {
        infos.push(message);
      },
    });

    expect(sends).toEqual(["job-1", "job-2"]);
    expect(reports).toEqual([
      {
        jobId: "job-1",
        status: "failed",
        retryable: true,
        error: "send_transport_failed:fetch_rejected",
      },
      {
        jobId: "job-2",
        status: "sent",
        providerMessageId: "provider-job-2",
      },
    ]);
    expect(errors).toContain(
      "[openwa-local-worker] send transport failed job=job-1 trigger=payment_confirmed error=fetch rejected",
    );
    expect(infos).toContain(
      "[openwa-local-worker] sent job=job-2 trigger=payment_confirmed providerMessageId=provider-job-2",
    );
  });

  test("continues after report failures for failed and successful sends", async () => {
    const reports = [];
    const errors = [];
    const infos = [];

    await processClaimedJobs(
      createConfig(),
      [createJob("job-1"), createJob("job-2"), createJob("job-3")],
      {
        async sendViaOpenwa(_config, job) {
          if (job.id === "job-1") {
            return { ok: false, retryable: false, error: "bad_request" };
          }
          return { ok: true, providerMessageId: `provider-${job.id}` };
        },
        async reportResult(_config, body) {
          reports.push(body);
          if (body.jobId === "job-1" || body.jobId === "job-2") {
            throw new Error(`report offline ${body.jobId}`);
          }
        },
        logError(message) {
          errors.push(message);
        },
        logInfo(message) {
          infos.push(message);
        },
      },
    );

    expect(reports).toEqual([
      {
        jobId: "job-1",
        status: "failed",
        retryable: false,
        error: "bad_request",
      },
      {
        jobId: "job-2",
        status: "sent",
        providerMessageId: "provider-job-2",
      },
      {
        jobId: "job-3",
        status: "sent",
        providerMessageId: "provider-job-3",
      },
    ]);
    expect(errors).toContain(
      "[openwa-local-worker] HIGH_RISK report_failed job=job-1 trigger=payment_confirmed context=send_failed error=report offline job-1",
    );
    expect(errors).toContain(
      "[openwa-local-worker] HIGH_RISK report_failed job=job-2 trigger=payment_confirmed context=sent error=report offline job-2",
    );
    expect(infos).toEqual([
      "[openwa-local-worker] sent job=job-3 trigger=payment_confirmed providerMessageId=provider-job-3",
    ]);
  });
});
