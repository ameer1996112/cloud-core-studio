import { describe, expect, test } from "bun:test";
import {
  authorizeNotificationOidcRequest,
  loadNotificationOidcConfig,
} from "../../src/server/notifications/oidc-auth.server";

const audience = "https://app.example";
const caller = "notification-tasks@cloudandcorestudio.iam.gserviceaccount.com";
const now = new Date("2026-09-02T12:00:00.000Z");

function request(token = "signed-token") {
  return new Request("https://app.example/internal/notifications/deliver", {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

describe("notification internal endpoint OIDC", () => {
  test("defaults disabled and fails closed when enabled configuration is incomplete", () => {
    expect(loadNotificationOidcConfig({}).enabled).toBe(false);
    expect(() => loadNotificationOidcConfig({ NOTIFICATIONS_OUTBOX_ENABLED: "true" })).toThrow(
      "incomplete_notification_oidc_configuration",
    );
  });

  test("accepts only the configured verified service account and audience", async () => {
    const config = loadNotificationOidcConfig({
      NOTIFICATIONS_OUTBOX_ENABLED: "true",
      NOTIFICATIONS_OIDC_AUDIENCE: audience,
      NOTIFICATIONS_OIDC_ALLOWED_CALLERS: caller,
    });
    const authorized = await authorizeNotificationOidcRequest(
      request(),
      config,
      async () => ({
        iss: "https://accounts.google.com",
        aud: audience,
        exp: Math.floor(now.getTime() / 1_000) + 300,
        email: caller,
        email_verified: true,
      }),
      now,
    );
    expect(authorized).toEqual({ ok: true, caller });
  });

  test("rejects absent tokens, wrong audience, unverified email, expiry, and other callers", async () => {
    const config = loadNotificationOidcConfig({
      NOTIFICATIONS_OUTBOX_ENABLED: "true",
      NOTIFICATIONS_OIDC_AUDIENCE: audience,
      NOTIFICATIONS_OIDC_ALLOWED_CALLERS: caller,
    });
    const base = {
      iss: "https://accounts.google.com",
      aud: audience,
      exp: Math.floor(now.getTime() / 1_000) + 300,
      email: caller,
      email_verified: true,
    };
    expect(
      (await authorizeNotificationOidcRequest(request(""), config, async () => base, now)).ok,
    ).toBe(false);
    for (const claims of [
      { ...base, aud: "https://wrong.example" },
      { ...base, email_verified: false },
      { ...base, exp: Math.floor(now.getTime() / 1_000) },
      { ...base, email: "other@cloudandcorestudio.iam.gserviceaccount.com" },
    ]) {
      expect(
        (await authorizeNotificationOidcRequest(request(), config, async () => claims, now)).ok,
      ).toBe(false);
    }
  });
});
