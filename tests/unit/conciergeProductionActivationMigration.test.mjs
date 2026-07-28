import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(
    import.meta.dir,
    "../../supabase/migrations/20260728143000_activate_complete_concierge_catalog.sql",
  ),
  "utf8",
);

describe("complete Concierge production activation", () => {
  test("promotes only the remaining canonical customer journeys", () => {
    for (const eventType of [
      "weekly_schedule",
      "daily_briefing",
      "class_recommendation",
      "trial_followup",
      "retention_reminder",
    ]) {
      expect(migration).toContain(`'${eventType}'`);
    }

    expect(migration).toContain("allowlist_only = false");
    expect(migration).toContain("enabled = true");
    expect(migration).toContain("RAISE EXCEPTION");
    expect(migration).toContain("AND copy_reviewed = true");
    expect(migration).toContain("notification_copy_review_evidence");
    expect(migration).toContain("catalog-spec-and-standards-review");
    expect(migration).toContain("count(DISTINCT evidence.locale) = 3");
    expect(migration).not.toContain("SET\n  copy_reviewed = true");
    expect(migration).not.toContain("'class_published'");
  });
});
