import { describe, expect, test } from "bun:test";
import { resolveLocalQaSupabaseEnvironment } from "../../scripts/qa/serve-member-ui-ux-qa.mjs";

const publicKey = "local-public-key-for-test";
const serviceRoleKey = "local-service-role-key-for-test";

function localEnvironment(overrides = {}) {
  return {
    API_URL: "http://127.0.0.1:54321",
    PUBLISHABLE_KEY: publicKey,
    SERVICE_ROLE_KEY: serviceRoleKey,
    ...overrides,
  };
}

describe("member UI/UX local Supabase QA environment guard", () => {
  test.each(["http://localhost:54321", "http://127.0.0.1:54321", "http://[::1]:54321"])(
    "accepts the loopback Supabase host %s",
    (url) => {
      const environment = resolveLocalQaSupabaseEnvironment(localEnvironment({ API_URL: url }));

      expect(environment.SUPABASE_URL).toBe(url);
      expect(environment.SUPABASE_PUBLISHABLE_KEY).toBe(publicKey);
      expect(environment.SUPABASE_ANON_KEY).toBe(publicKey);
      expect(environment.VITE_SUPABASE_URL).toBe(url);
      expect(environment.VITE_SUPABASE_PUBLISHABLE_KEY).toBe(publicKey);
      expect(environment.VITE_SUPABASE_ANON_KEY).toBe(publicKey);
    },
  );

  test.each(["https://example.supabase.co", "https://remote.example.test"])(
    "rejects a remote Supabase URL without exposing the key",
    (url) => {
      expect(() => resolveLocalQaSupabaseEnvironment(localEnvironment({ API_URL: url }))).toThrow(
        "member_ui_ux_qa_server_refuses_non_local_supabase",
      );
      try {
        resolveLocalQaSupabaseEnvironment(localEnvironment({ API_URL: url }));
      } catch (error) {
        expect(String(error)).not.toContain(publicKey);
      }
    },
  );

  test("rejects a missing local URL", () => {
    expect(() => resolveLocalQaSupabaseEnvironment({ PUBLISHABLE_KEY: publicKey })).toThrow(
      "member_ui_ux_qa_server_requires_local_supabase_url",
    );
  });

  test("rejects a missing public key", () => {
    expect(() => resolveLocalQaSupabaseEnvironment({ API_URL: "http://127.0.0.1:54321" })).toThrow(
      "member_ui_ux_qa_server_requires_local_public_key",
    );
  });

  test("rejects a service-role-only configuration", () => {
    expect(() =>
      resolveLocalQaSupabaseEnvironment({
        API_URL: "http://127.0.0.1:54321",
        SERVICE_ROLE_KEY: serviceRoleKey,
        SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
      }),
    ).toThrow("member_ui_ux_qa_server_requires_local_public_key");
  });

  test("rejects a public-key alias that equals the service role key", () => {
    expect(() =>
      resolveLocalQaSupabaseEnvironment(localEnvironment({ PUBLISHABLE_KEY: serviceRoleKey })),
    ).toThrow("member_ui_ux_qa_server_requires_local_public_key");
  });

  test("rejects a remote browser alias even when the server URL is local", () => {
    expect(() =>
      resolveLocalQaSupabaseEnvironment(
        localEnvironment({ VITE_SUPABASE_URL: "https://example.supabase.co" }),
      ),
    ).toThrow("member_ui_ux_qa_server_refuses_non_local_supabase");
  });
});
