import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { shouldOfferMemberWhatsappOnboarding } from "../../src/lib/memberWhatsappOnboarding.ts";

const root = resolve(import.meta.dir, "../..");
const migrationSource = readFileSync(
  resolve(root, "supabase/migrations/20260729183000_member_whatsapp_onboarding.sql"),
  "utf8",
);
const identityFixMigrationSource = readFileSync(
  resolve(root, "supabase/migrations/20260729190000_fix_member_whatsapp_onboarding_identity.sql"),
  "utf8",
);
const shellSource = readFileSync(resolve(root, "src/components/app-shell/AppShell.tsx"), "utf8");
const serverSource = readFileSync(
  resolve(root, "src/lib/memberNotifications.functions.ts"),
  "utf8",
);

describe("existing-member WhatsApp onboarding", () => {
  test("offers one-time consent only when a phone exists and no explicit decision was recorded", () => {
    expect(
      shouldOfferMemberWhatsappOnboarding({
        phone: "0559398438",
        whatsappEnabled: false,
        consentSource: null,
        optedOutAt: null,
      }),
    ).toBe(true);
    expect(
      shouldOfferMemberWhatsappOnboarding({
        phone: null,
        whatsappEnabled: false,
        consentSource: null,
        optedOutAt: null,
      }),
    ).toBe(false);
    expect(
      shouldOfferMemberWhatsappOnboarding({
        phone: "0559398438",
        whatsappEnabled: true,
        consentSource: "signup_channel_choices",
        optedOutAt: null,
      }),
    ).toBe(false);
    expect(
      shouldOfferMemberWhatsappOnboarding({
        phone: "0559398438",
        whatsappEnabled: false,
        consentSource: "member_whatsapp_onboarding_declined",
        optedOutAt: "2026-07-29T18:30:00.000Z",
      }),
    ).toBe(false);
  });

  test("reconsents unsafe historical auto-enables instead of treating them as permission", () => {
    expect(migrationSource).toContain("legacy_auto_enable_pending_reconsent");
    expect(migrationSource).toContain("'existing_member_auto_enable'");
    expect(migrationSource).toContain("'new_active_member_auto_enable'");
    expect(migrationSource).toContain("whatsapp_enabled = false");
  });

  test("mounts one onboarding experience in the authenticated member shell", () => {
    expect(shellSource).toContain("import { MemberWhatsappOnboarding }");
    expect(shellSource).toContain('role === "member" && <MemberWhatsappOnboarding');
  });

  test("records affirmative consent and decline as separate audited decisions", () => {
    expect(serverSource).toContain('db.rpc("set_member_whatsapp_onboarding_decision"');
    expect(serverSource).toContain("p_member_id: context.userId");
    expect(migrationSource).toContain("'member_whatsapp_onboarding'");
    expect(migrationSource).toContain("'member_whatsapp_onboarding_declined'");
    expect(migrationSource).toContain("'app.notification_preference_source'");
    expect(migrationSource).toContain("whatsapp_consented_at = CASE");
    expect(migrationSource).toContain("whatsapp_opted_out_at = CASE");
  });

  test("uses the authenticated server member identity instead of auth.uid under service role", () => {
    expect(identityFixMigrationSource).toContain("p_member_id uuid");
    expect(identityFixMigrationSource).not.toContain("auth.uid()");
    expect(identityFixMigrationSource).toContain(
      "GRANT EXECUTE ON FUNCTION public.set_member_whatsapp_onboarding_decision(uuid, text) TO service_role",
    );
    expect(identityFixMigrationSource).toContain(
      "REVOKE ALL ON FUNCTION public.set_member_whatsapp_onboarding_decision(uuid, text) FROM authenticated",
    );
  });
});
