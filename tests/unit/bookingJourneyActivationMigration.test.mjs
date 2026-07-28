import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(
    import.meta.dir,
    "../../supabase/migrations/20260728144000_activate_booking_no_show_followup.sql",
  ),
  "utf8",
);

describe("complete Booking journey activation", () => {
  test("requires reviewed enabled copy before removing the allowlist", () => {
    expect(migration).toContain("event_type = 'booking_no_show_followup'");
    expect(migration).toContain("enabled = true");
    expect(migration).toContain("copy_reviewed = true");
    expect(migration).toContain("RAISE EXCEPTION");
    expect(migration).toContain("allowlist_only = false");
  });
});
