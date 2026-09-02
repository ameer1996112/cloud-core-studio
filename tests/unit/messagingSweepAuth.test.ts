import { describe, expect, test } from "bun:test";
import { requireMessagingSweepAuth } from "../../src/server/notifications/scheduler-auth.server";

const audience = "https://studio.example";
const caller = "notification-scheduler@test-project.iam.gserviceaccount.com";
const now = new Date("2026-09-03T00:00:00Z");
const environment = {
  NOTIFICATION_AUTOMATION_TOKEN: "legacy-secret",
  MESSAGING_SWEEP_OIDC_ENABLED: "true",
  MESSAGING_SWEEP_OIDC_AUDIENCE: audience,
  MESSAGING_SWEEP_OIDC_SERVICE_ACCOUNT: caller,
  NOTIFICATIONS_OUTBOX_ENABLED: "false",
};
const claims = {
  iss: "https://accounts.google.com",
  aud: audience,
  exp: Math.floor(now.getTime() / 1000) + 300,
  email: caller,
  email_verified: true,
};
function request(token?: string) {
  return new Request(`${audience}/api/internal/messages/sweep`, {
    method: "POST",
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

describe("direct scheduler sweep authentication", () => {
  test("accepts the signed scheduler identity without enabling the new outbox transport", async () => {
    const result = await requireMessagingSweepAuth(
      request("signed-token"),
      environment,
      async (token, expectedAudience) => {
        expect(token).toBe("signed-token");
        expect(expectedAudience).toBe("https://studio.example");
        return claims;
      },
      now,
    );
    expect(result).toBeNull();
  });

  test("keeps the legacy job authorized without contacting Google", async () => {
    const result = await requireMessagingSweepAuth(
      request("legacy-secret"),
      environment,
      async () => {
        throw new Error("legacy auth must not verify OIDC");
      },
      now,
    );
    expect(result).toBeNull();
  });

  test("OIDC remains disabled by default even for an otherwise valid caller", async () => {
    const result = await requireMessagingSweepAuth(
      request("signed-token"),
      { ...environment, MESSAGING_SWEEP_OIDC_ENABLED: undefined },
      async () => claims,
      now,
    );
    expect(result?.status).toBe(401);
  });

  test("missing or invalid configuration fails closed without breaking legacy rollback", async () => {
    for (const overrides of [
      { MESSAGING_SWEEP_OIDC_AUDIENCE: "" },
      { MESSAGING_SWEEP_OIDC_AUDIENCE: "http://studio.example" },
      { MESSAGING_SWEEP_OIDC_AUDIENCE: "https://studio.example/path" },
      { MESSAGING_SWEEP_OIDC_SERVICE_ACCOUNT: "" },
      { MESSAGING_SWEEP_OIDC_SERVICE_ACCOUNT: "member@example.com" },
    ]) {
      const config = { ...environment, ...overrides };
      expect(
        (await requireMessagingSweepAuth(request("signed-token"), config, async () => claims, now))
          ?.status,
      ).toBe(503);
      expect(
        await requireMessagingSweepAuth(request("legacy-secret"), config, async () => claims, now),
      ).toBeNull();
    }
  });

  test("rejects unsigned, expired, wrong-audience, unverified and wrong-caller tokens", async () => {
    expect(
      (await requireMessagingSweepAuth(request(), environment, async () => claims, now))?.status,
    ).toBe(401);
    const rejected = await requireMessagingSweepAuth(
      request("forged-token"),
      environment,
      async () => {
        throw new Error("invalid signature: sensitive detail");
      },
      now,
    );
    expect(rejected?.status).toBe(401);
    expect(await rejected?.text()).not.toContain("sensitive detail");
    for (const [override, status] of [
      [{ iss: "https://attacker.example" }, 401],
      [{ aud: "https://other.example" }, 401],
      [{ email_verified: false }, 401],
      [{ exp: Math.floor(now.getTime() / 1000) }, 401],
      [{ email: "other@test-project.iam.gserviceaccount.com" }, 403],
    ] as const) {
      const result = await requireMessagingSweepAuth(
        request("token"),
        environment,
        async () => ({ ...claims, ...override }),
        now,
      );
      expect(result?.status).toBe(status);
    }
  });
});
