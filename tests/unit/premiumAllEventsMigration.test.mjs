import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { NOTIFICATION_EVENT_CATALOG } from "../../src/lib/premiumNotificationCatalog.ts";

const migrationPath = new URL(
  "../../supabase/migrations/20260721190000_premium_notification_all_events.sql",
  import.meta.url,
);
const tuningMigrationPath = new URL(
  "../../supabase/migrations/20260722120000_premium_messaging_journey_tuning.sql",
  import.meta.url,
);

describe("premium notification all-events migration", () => {
  test("keeps the complete rollout private while enabling reviewed event behavior", () => {
    const sql = readFileSync(migrationPath, "utf8");
    for (const fragment of [
      "member_welcome",
      "trg_member_welcome_outbox",
      "enqueue_member_welcome_message_event",
      "copy_reviewed = true",
      "enabled = true",
      "allowlist_only = true",
      "member:welcome:",
    ]) {
      expect(sql).toContain(fragment);
    }
    expect(sql).not.toContain("allowlist_only = false");
  });

  test("only welcomes active members and initializes valid contact channels without overwriting opt-outs", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain("NEW.status IS DISTINCT FROM 'active'");
    expect(sql).toContain(
      "CREATE OR REPLACE FUNCTION public.ensure_member_notification_preferences()",
    );
    expect(sql).toContain("CREATE TRIGGER trg_member_notification_preferences");
    expect(sql).toContain("ON CONFLICT (member_id) DO NOTHING");
    expect(sql).toContain("'^\\+[1-9][0-9]{7,14}$'");
  });

  test("routes a promoted waitlist booking through one semantic event", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain("v_event := 'waitlist_accepted'");
    expect(sql).toContain("v_event := 'booking_confirmed'");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.enqueue_waitlist_message_event()");
    expect(sql).toContain("status IN ('waiting', 'ready', 'offered', 'promoted')");
    expect(sql).toContain("NEW.status = 'promoted' AND NOT v_member_already_booked");
    const bookingFunction = sql.match(
      /CREATE OR REPLACE FUNCTION public\.enqueue_booking_message_event\(\)[\s\S]+?COMMENT ON FUNCTION public\.enqueue_booking_message_event\(\)/,
    )?.[0];
    expect(bookingFunction?.match(/PERFORM public\.emit_message_outbox\(/g)).toHaveLength(1);
  });

  test("keeps the database rollout channel matrix exactly aligned with the code catalog", () => {
    const sql = readFileSync(tuningMigrationPath, "utf8");
    const rolloutRows = new Map(
      [...sql.matchAll(/\('([^']+)', ARRAY\[([^\]]*)\]::text\[\]\)/g)].map((match) => [
        match[1],
        [...match[2].matchAll(/'([^']+)'/g)].map((channel) => channel[1]),
      ]),
    );
    expect(Object.fromEntries(rolloutRows)).toEqual(
      Object.fromEntries(
        Object.entries(NOTIFICATION_EVENT_CATALOG).map(([eventType, definition]) => [
          eventType,
          [...definition.channels],
        ]),
      ),
    );
  });
});
