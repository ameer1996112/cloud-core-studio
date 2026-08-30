import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  new URL("../../supabase/migrations/20260819190000_goldmine_schedule_source.sql", import.meta.url),
  "utf8",
).toLowerCase();

describe("GoldMine schedule source database contract", () => {
  test("is a bounded read-only service-role function", () => {
    expect(sql).toContain("language sql");
    expect(sql).toContain("stable");
    expect(sql).toContain("security invoker");
    expect(sql).toContain("set statement_timeout = '5s'");
    expect(sql).toContain("limit least(greatest(coalesce(p_limit, 201), 1), 501)");
    expect(sql).toContain("from public, anon, authenticated");
    expect(sql).toContain("to service_role");
    expect(sql).not.toMatch(/\b(insert|update|delete|merge)\s+(into|public\.|from)/);
  });

  test("joins only the authoritative schedule tables and aggregates booked capacity", () => {
    expect(sql).toContain("from public.classes as c");
    expect(sql).toContain("join public.program_types as pt");
    expect(sql).toContain("left join public.bookings as b");
    expect(sql).toContain("count(b.class_id) filter (where b.status = 'booked')");
    expect(sql).not.toContain("member_id");
    expect(sql).not.toContain("booking_id");
    expect(sql).not.toContain("email");
    expect(sql).not.toContain("phone");
    expect(sql).not.toContain("payment");
  });

  test("enforces application visibility, status, audience, and window rules in SQL", () => {
    expect(sql).toContain("c.status = 'scheduled'");
    expect(sql).toContain("c.member_visible = true");
    expect(sql).toContain("pt.active = true");
    expect(sql).toContain("pt.age_groups @> array['adults']::text[]");
    expect(sql).toContain("c.starts_at >= p_start_at");
    expect(sql).toContain("c.starts_at >= now()");
    expect(sql).toContain("c.starts_at < p_end_at");
  });
});
