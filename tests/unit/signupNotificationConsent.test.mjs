import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DEFAULT_SIGNUP_NOTIFICATION_CHOICES,
  buildSignupNotificationMetadata,
} from "../../src/lib/signupNotificationConsent.ts";

const migrationSource = readFileSync(
  resolve(
    import.meta.dir,
    "../../supabase/migrations/20260731150000_separate_signup_notification_consent.sql",
  ),
  "utf8",
);

describe("signup notification consent", () => {
  test("keeps optional channels off while enabling essential email", () => {
    expect(DEFAULT_SIGNUP_NOTIFICATION_CHOICES).toEqual({
      whatsapp: false,
      marketing: false,
    });

    expect(
      buildSignupNotificationMetadata({
        phone: "0541234567",
        ...DEFAULT_SIGNUP_NOTIFICATION_CHOICES,
      }),
    ).toEqual({
      whatsapp_updates_enabled: false,
      email_updates_enabled: true,
      push_updates_enabled: false,
      marketing_updates_enabled: false,
    });
  });

  test("records affirmative WhatsApp and marketing choices independently", () => {
    expect(
      buildSignupNotificationMetadata({
        phone: " 0541234567 ",
        whatsapp: true,
        marketing: true,
      }),
    ).toEqual({
      whatsapp_updates_enabled: true,
      email_updates_enabled: true,
      push_updates_enabled: false,
      marketing_updates_enabled: true,
    });

    expect(
      buildSignupNotificationMetadata({ phone: "   ", whatsapp: true, marketing: false })
        .whatsapp_updates_enabled,
    ).toBe(false);
  });

  test("persists essential email separately from optional channel consent", () => {
    expect(migrationSource).toContain("marketing_updates_enabled");
    expect(migrationSource).toContain("email_enabled = true");
    expect(migrationSource).toContain("push_enabled = false");
    expect(migrationSource).toContain("marketing = v_marketing_enabled");
    expect(migrationSource).toContain("essential_service_email");
    expect(migrationSource).toContain("signup_explicit_whatsapp");
  });
});
