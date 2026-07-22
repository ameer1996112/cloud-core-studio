import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const migrationPath = new URL(
  "../../supabase/migrations/20260722120000_premium_messaging_journey_tuning.sql",
  import.meta.url,
);

describe("premium messaging journey tuning migration", () => {
  test("adds a durable ten-percent holdout and a thirty-day ignored-message cooldown", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain("notification_experiment_assignments");
    expect(sql).toContain("premium_growth_v2");
    expect(sql).toContain("v_bucket < 10");
    expect(sql).toContain("p_now - interval '30 days'");
    expect(sql).toContain("v_unengaged_count >= 3");
    expect(sql).toContain("event_type IN ('opened', 'actioned', 'converted')");
    expect(sql).toContain("notification_growth_cooldowns");
    expect(sql).toContain("v_cooldown_expires_at > p_now");
    expect(sql).toContain("v_third_unengaged_at + interval '30 days'");
    expect(sql).toContain("delivery.channel = 'push'");
    expect(sql).toContain("delivery.sent_at");
    expect(sql).toContain("delivery.accepted_at");
    expect(sql).toContain("ignored.successful_at");
  });

  test("snapshots failed-payment recovery for conditional WhatsApp confirmation", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.enqueue_payment_message_event()");
    expect(sql).toContain("'payment_was_failing', v_payment_was_failing");
    expect(sql).toContain("v_payment_was_failing := OLD.status = 'failed'");
    expect(sql).toContain("NEW.status IN ('refunded', 'partially_refunded')");
    expect(sql).toContain("v_event := 'payment_refunded'");
  });

  test("welcomes a member exactly once when an existing record becomes active", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain("AFTER INSERT OR UPDATE OF status ON public.members");
    expect(sql).toContain("OLD.status IS NOT DISTINCT FROM NEW.status");
    expect(sql).toContain(
      "CREATE OR REPLACE FUNCTION public.ensure_member_notification_preferences()",
    );
    expect(sql).toContain("whatsapp_consent_source IS NULL");
    expect(sql).toContain("whatsapp_opted_out_at IS NULL");
    expect(sql).toContain("member_activation_auto_enable");
  });

  test("enforces the ten-recipient open-class cap atomically inside the reservation RPC", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.enqueue_open_class_alert(");
    expect(sql).toContain("'open-class-cap:' || p_class_id::text");
    expect(sql).toContain("v_class_alert_count >= 10");
    expect(sql).toContain("v_last_7_days >= 3");
  });

  test("is expand-only and keeps every tuned journey in allowlist mode", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain("allowlist_only = true");
    expect(sql).not.toMatch(/DELETE FROM|DROP TABLE|TRUNCATE/i);
  });
});
