import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL(
  "../../supabase/migrations/20260721143000_open_class_alert_reservations.sql",
  import.meta.url,
);

describe("open-class alert reservation migration", () => {
  test("serializes per-member reservations and enforces rolling frequency caps", async () => {
    const sql = await readFile(migrationUrl, "utf8");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("event_type = 'class_open_spots'");
    expect(sql).toContain("created_at >= now() - interval '24 hours'");
    expect(sql).toContain("created_at >= now() - interval '7 days'");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.enqueue_open_class_alert");
  });
});
