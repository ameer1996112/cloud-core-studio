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
  test("offers one default-on choice that covers every external channel", () => {
    expect(authSource).toContain("useState(true)");
    expect(authSource).toContain("whatsapp_updates_enabled");
    expect(authSource).toContain("email_updates_enabled");
    expect(authSource).toContain("push_updates_enabled");
    expect(authSource).toContain('t("auth.notificationConsentAllChannels")');
    expect(authSource).not.toContain('t("auth.notificationConsentWhatsapp")');
    expect(authSource).not.toContain('t("auth.notificationConsentEmail")');
    expect(authSource).not.toContain('t("auth.notificationConsentPush")');
  });

  test("keeps the unified consent compact at the end of the signup fields", () => {
    expect(authSource.indexOf('label={t("auth.password")}')).toBeLessThan(
      authSource.indexOf('t("auth.notificationConsentAllChannels")'),
    );
    expect(authSource).not.toContain(
      'className="rounded-2xl border border-gold/25 bg-white/55 p-4 text-start"',
    );
    expect(authSource).not.toContain('t("auth.notificationConsentTitle")');
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
