import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DEFAULT_SIGNUP_NOTIFICATION_CHOICES,
  buildSignupNotificationMetadata,
  isValidSignupWhatsappPhone,
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
      notification_consent_version: 2,
      whatsapp_signup_opt_in_v2: false,
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
      notification_consent_version: 2,
      whatsapp_signup_opt_in_v2: true,
      email_updates_enabled: true,
      push_updates_enabled: false,
      marketing_updates_enabled: true,
    });

    expect(
      buildSignupNotificationMetadata({ phone: "   ", whatsapp: true, marketing: false })
        .whatsapp_signup_opt_in_v2,
    ).toBe(false);
  });

  test("requires a plausible phone number for WhatsApp consent", () => {
    expect(isValidSignupWhatsappPhone("052-331-8478")).toBe(true);
    expect(isValidSignupWhatsappPhone("+972 52 331 8478")).toBe(true);
    expect(isValidSignupWhatsappPhone("abc")).toBe(false);
    expect(isValidSignupWhatsappPhone("12345")).toBe(false);
    expect(
      buildSignupNotificationMetadata({ phone: "not a phone", whatsapp: true, marketing: false })
        .whatsapp_signup_opt_in_v2,
    ).toBe(false);
  });

  test("persists essential email separately from optional channel consent", () => {
    expect(migrationSource).toContain("marketing_updates_enabled");
    expect(migrationSource).toContain("notification_consent_version");
    expect(migrationSource).toContain("whatsapp_signup_opt_in_v2");
    expect(migrationSource).not.toContain("whatsapp_updates_enabled");
    expect(migrationSource).toContain("v_phone_valid");
    expect(migrationSource).toContain("email_enabled = true");
    expect(migrationSource).toContain("push_enabled = false");
    expect(migrationSource).toContain("marketing = v_marketing_enabled");
    expect(migrationSource).toContain("essential_service_email");
    expect(migrationSource).toContain("signup_explicit_whatsapp");
  });
});
