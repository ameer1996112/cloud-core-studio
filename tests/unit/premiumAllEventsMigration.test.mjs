import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const migrationPath = new URL(
  "../../supabase/migrations/20260721190000_premium_notification_all_events.sql",
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
});
