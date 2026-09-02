import { expect, test } from "bun:test";

let invocation = 0;

async function runCron({ canary = "true", legacyEnabled = "true", responseStatus = 200 } = {}) {
  const keys = [
    "CLOUD_CORE_BASE_URL",
    "NOTIFICATION_AUTOMATION_TOKEN",
    "NOTIFICATION_SWEEP_CANARY",
    "LEGACY_MEMBER_NOTIFICATION_DELIVERY_ENABLED",
    "NOTIFICATION_SWEEP_LIMIT",
  ];
  const originalEnvironment = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  const originalLog = console.log;
  const calls = [];
  let output;
  Object.assign(process.env, {
    CLOUD_CORE_BASE_URL: "https://studio.example/",
    NOTIFICATION_AUTOMATION_TOKEN: "fixture-token",
    NOTIFICATION_SWEEP_CANARY: canary,
    LEGACY_MEMBER_NOTIFICATION_DELIVERY_ENABLED: legacyEnabled,
    NOTIFICATION_SWEEP_LIMIT: "25",
  });
  globalThis.fetch = async (url, init) => {
    calls.push({
      url: String(url),
      method: init.method,
      authorization: init.headers.authorization,
      body: JSON.parse(init.body),
    });
    return Response.json(
      { ok: true, canary: true, databaseReady: true },
      { status: responseStatus },
    );
  };
  console.log = (value) => {
    output = JSON.parse(value);
  };
  try {
    await import(`../../scripts/member-notification-cron.mjs?fixture=${++invocation}`);
    return { calls, output };
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
    for (const [key, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("fallback canary checks readiness without running any sender or legacy lifecycle", async () => {
  const { calls, output } = await runCron();
  expect(calls).toEqual([
    {
      url: "https://studio.example/api/internal/messages/sweep",
      method: "POST",
      authorization: "Bearer fixture-token",
      body: { limit: 25, canary: true },
    },
  ]);
  expect(output).toEqual({
    canonicalReadiness: { ok: true, canary: true, databaseReady: true },
  });
});

test.each(["", "false"])(
  "normal fallback preserves its three scheduled workflows when canary is %j",
  async (canary) => {
    const { calls, output } = await runCron({ canary, legacyEnabled: "false" });
    expect(calls.map((call) => [new URL(call.url).pathname, call.body])).toEqual([
      ["/api/internal/concierge/run", { limit: 25 }],
      ["/api/internal/concierge/dispatch", { limit: 25 }],
      ["/api/internal/messages/sweep", { limit: 25 }],
    ]);
    expect(Object.keys(output)).toEqual([
      "conciergeOrchestration",
      "conciergeDispatch",
      "canonicalDelivery",
    ]);
  },
);

test("normal fallback preserves explicitly enabled legacy lifecycle processing", async () => {
  const { calls } = await runCron({ canary: "false" });
  expect(calls.map((call) => new URL(call.url).pathname)).toEqual([
    "/api/internal/concierge/run",
    "/api/internal/concierge/dispatch",
    "/api/internal/messages/sweep",
    "/api/internal/notifications/lifecycle-sweep",
  ]);
  expect(calls[3].body).toEqual({ limitPerEvent: 25 });
});

test("fallback canary fails closed when its readiness request is rejected", async () => {
  await expect(runCron({ responseStatus: 401 })).rejects.toThrow(
    "notification_sweep_failed:/api/internal/messages/sweep:401",
  );
});
