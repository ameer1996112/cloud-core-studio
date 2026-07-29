import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../..");
const authSource = readFileSync(resolve(root, "src/routes/auth.tsx"), "utf8");
const migrationSource = readFileSync(
  resolve(root, "supabase/migrations/20260729163000_signup_notification_consent.sql"),
  "utf8",
);

describe("signup notification consent", () => {
  test("offers separate, default-on choices for every external channel", () => {
    expect(authSource).toContain("useState(true)");
    expect(authSource).toContain("whatsapp_updates_enabled");
    expect(authSource).toContain("email_updates_enabled");
    expect(authSource).toContain("push_updates_enabled");
    expect(authSource).toContain('t("auth.notificationConsentWhatsapp")');
    expect(authSource).toContain('t("auth.notificationConsentEmail")');
    expect(authSource).toContain('t("auth.notificationConsentPush")');
  });

  test("persists the selected channels with an auditable signup source", () => {
    expect(migrationSource).toContain("signup_channel_choices");
    expect(migrationSource).toContain("whatsapp_updates_enabled");
    expect(migrationSource).toContain("email_updates_enabled");
    expect(migrationSource).toContain("push_updates_enabled");
    expect(migrationSource).toContain("whatsapp_consented_at");
    expect(migrationSource).toContain("email_consented_at");
  });
});
