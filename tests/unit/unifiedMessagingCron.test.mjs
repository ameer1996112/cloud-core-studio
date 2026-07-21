import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

test("unified messaging cron calls the protected sweep endpoint", async () => {
  const originalFetch = globalThis.fetch;
  const originalLog = console.log;
  const originalEnvironment = {
    CLOUD_CORE_BASE_URL: process.env.CLOUD_CORE_BASE_URL,
    NOTIFICATION_AUTOMATION_TOKEN: process.env.NOTIFICATION_AUTOMATION_TOKEN,
    UNIFIED_MESSAGING_SWEEP_LIMIT: process.env.UNIFIED_MESSAGING_SWEEP_LIMIT,
  };
  let received;
  let output = "";

  process.env.CLOUD_CORE_BASE_URL = "https://studio.example/";
  process.env.NOTIFICATION_AUTOMATION_TOKEN = "test-automation-token";
  process.env.UNIFIED_MESSAGING_SWEEP_LIMIT = "25";
  globalThis.fetch = async (url, init) => {
    received = {
      method: init?.method,
      pathname: new URL(String(url)).pathname,
      authorization: init?.headers?.authorization,
      contentType: init?.headers?.["content-type"],
      body: JSON.parse(String(init?.body)),
    };
    return Response.json({ ok: true, deliveriesClaimed: 0 });
  };
  console.log = (value) => {
    output += String(value);
  };

  try {
    await import(`../../scripts/unified-messaging-cron.mjs?test=${Date.now()}`);
    expect(received).toEqual({
      method: "POST",
      pathname: "/api/internal/messages/sweep",
      authorization: "Bearer test-automation-token",
      contentType: "application/json",
      body: { limit: 25 },
    });
    expect(JSON.parse(output)).toEqual({ ok: true, deliveriesClaimed: 0 });
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
    for (const [name, value] of Object.entries(originalEnvironment)) {
      if (value == null) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test("production image includes the unified messaging cron runner", async () => {
  const dockerfile = await readFile("Dockerfile", "utf8");
  expect(dockerfile).toContain(
    "COPY --from=build /app/scripts/unified-messaging-cron.mjs ./scripts/unified-messaging-cron.mjs",
  );
});

test("production build explicitly embeds the APNs environment used by device registration", async () => {
  const [dockerfile, cloudbuild] = await Promise.all([
    readFile("Dockerfile", "utf8"),
    readFile("cloudbuild.yaml", "utf8"),
  ]);
  expect(dockerfile).toContain("ARG VITE_APNS_ENV");
  expect(dockerfile).toContain("ENV VITE_APNS_ENV=$VITE_APNS_ENV");
  expect(cloudbuild).toContain("VITE_APNS_ENV=${_VITE_APNS_ENV}");
});

test("Cloud Run setup reuses the production automation-token secret", async () => {
  const setup = await readFile("scripts/configure-unified-messaging-cloud-run.sh", "utf8");
  expect(setup).toContain(
    'SECRET_NAME="${NOTIFICATION_SECRET_NAME:-NOTIFICATION_AUTOMATION_TOKEN}"',
  );
});
