import { describe, expect, test } from "bun:test";
import { assertSafeUiAuditEnvironment } from "../../tools/ui-audit/config";

describe("UI audit environment guard", () => {
  test("requires the explicit fixture flag", () => {
    expect(() =>
      assertSafeUiAuditEnvironment({ enabled: false, mode: "development", supabaseUrl: "" }),
    ).toThrow("UI_AUDIT_FIXTURES=true");
  });

  test("rejects application production mode", () => {
    expect(() =>
      assertSafeUiAuditEnvironment({ enabled: true, mode: "production", supabaseUrl: "" }),
    ).toThrow("production");
  });

  test("rejects every configured remote URL and explicit denylist host", () => {
    expect(() =>
      assertSafeUiAuditEnvironment({
        enabled: true,
        mode: "ui-audit",
        supabaseUrl: "https://configured.example.supabase.co",
      }),
    ).toThrow("configured remote service URL");
    expect(() =>
      assertSafeUiAuditEnvironment({
        enabled: true,
        mode: "ui-audit",
        supabaseUrl: "https://production.example.supabase.co",
        forbiddenHosts: ["production.example.supabase.co"],
      }),
    ).toThrow("forbidden Supabase host");
  });

  test("allows the dedicated audit mode with no configured remote URL", () => {
    expect(() =>
      assertSafeUiAuditEnvironment({ enabled: true, mode: "ui-audit", supabaseUrl: "" }),
    ).not.toThrow();
  });
});
