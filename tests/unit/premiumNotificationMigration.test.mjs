import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL(
  "../../supabase/migrations/20260721170000_premium_notification_foundation.sql",
  import.meta.url,
);
const messagingServerUrl = new URL("../../src/lib/unifiedMessaging.server.ts", import.meta.url);
const adminPushUrl = new URL("../../src/lib/adminPush.functions.ts", import.meta.url);
const adminPushSignupServerUrl = new URL(
  "../../src/lib/adminPushSignup.server.ts",
  import.meta.url,
);
const apnsServerUrl = new URL("../../src/lib/apns.server.ts", import.meta.url);
const viteConfigUrl = new URL("../../vite.config.ts", import.meta.url);

describe("premium notification foundation migration", () => {
  test("adds granular preferences, private installations, per-device targets, and engagement", async () => {
    const sql = await readFile(migrationUrl, "utf8");
    for (const fragment of [
      "class_operations_enabled",
      "recommendations_enabled",
      "installation_id",
      "message_delivery_targets",
      "message_engagement_events",
      "notification_event_rollouts",
      "record_message_engagement",
      "REVOKE SELECT ON public.member_push_tokens FROM authenticated",
    ]) {
      expect(sql).toContain(fragment);
    }
  });

  test("keeps every new event rollout disabled by default", async () => {
    const sql = await readFile(migrationUrl, "utf8");
    expect(sql).toContain("enabled boolean NOT NULL DEFAULT false");
    expect(sql).toContain("allowlist_only boolean NOT NULL DEFAULT true");
    expect(sql).toContain("copy_reviewed boolean NOT NULL DEFAULT false");
  });

  test("enforces member ownership inside the engagement RPC", async () => {
    const sql = await readFile(migrationUrl, "utf8");
    expect(sql).toContain("m.member_id = auth.uid()");
    expect(sql).toContain("t.member_id = auth.uid()");
    expect(sql).toContain("ON CONFLICT (event_key) DO NOTHING");
  });

  test("connects premium domain transitions only through disabled rollout gates", async () => {
    const sql = await readFile(migrationUrl, "utf8");
    for (const fragment of [
      "premium_notification_event_enabled",
      "booking_checked_in",
      "booking_no_show_followup",
      "class_location_changed",
      "class_instructor_changed",
      "payment_refunded",
      "credits_depleted",
      "INSERT INTO public.notification_event_rollouts",
    ]) {
      expect(sql).toContain(fragment);
    }
  });

  test("atomically registers devices, reserves promotion frequency, and purges premium audit rows", async () => {
    const sql = await readFile(migrationUrl, "utf8");
    for (const fragment of [
      "register_member_push_installation",
      "pg_advisory_xact_lock",
      "encode(sha256(convert_to(token, 'UTF8')), 'hex')",
      "notification_frequency_reservations",
      "reserve_promotional_notification",
      "DELETE FROM public.message_delivery_targets",
      "DELETE FROM public.message_engagement_events",
      "DELETE FROM public.notification_preference_events",
    ]) {
      expect(sql).toContain(fragment);
    }
    expect(sql).not.toContain("digest(token, 'sha256')");
  });

  test("supports verified member and admin staff devices without mixing APNs environments", async () => {
    const sql = await readFile(migrationUrl, "utf8");
    expect(sql).toContain("admin_push_token_id uuid");
    expect(sql).toContain("notification_staff_test_devices");
    expect(sql).toContain("admin_push_tokens_apns_environment_check");
    expect(sql).toContain("deactivate_admin_push_tokens_after_role_change");
    expect(sql).toContain("SET active = false, apns_environment = NULL");
    expect(sql).not.toContain("apns_environment = COALESCE(apns_environment, 'production')");
    expect(sql).toContain("delivery_unknown");
    expect(sql).toContain("NEW.status = 'checked_in'");
    expect(sql).not.toContain("NEW.status IN ('checked_in', 'attended')");
    const [server, adminPush, adminPushSignupServer, apnsServer, viteConfig] = await Promise.all([
      readFile(messagingServerUrl, "utf8"),
      readFile(adminPushUrl, "utf8"),
      readFile(adminPushSignupServerUrl, "utf8"),
      readFile(apnsServerUrl, "utf8"),
      readFile(viteConfigUrl, "utf8"),
    ]);
    expect(server).toContain('.eq("profiles.role", "admin")');
    expect(adminPushSignupServer).toContain('.eq("profiles.role", "admin")');
    expect(adminPush).toContain("apns_environment: data.environment");
    expect(adminPush).not.toContain("@/lib/apns.server");
    expect(apnsServer).toContain("@tanstack/react-start/server-only");
    expect(viteConfig).toContain('files: ["**/*.server.*", "**/server/**"]');
  });

  test("queues one durable follow-up for an unresolved subscription failure", async () => {
    const source = await readFile(messagingServerUrl, "utf8");
    expect(source).toContain('.in("status", ["past_due", "incomplete"])');
    expect(source).toContain("subscription_renewal_failed:followup_24h");
    expect(source).toContain('.eq("event_type", "subscription_renewal_failed")');
    expect(source).toContain("subscriptionFailureRollout.data?.copy_reviewed === true");
  });
});
