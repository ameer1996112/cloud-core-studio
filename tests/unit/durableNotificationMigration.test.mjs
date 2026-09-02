import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260902150000_durable_notification_cloud_tasks.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("durable notification Cloud Tasks migration", () => {
  test("extends the canonical outbox instead of creating a duplicate notification system", () => {
    expect(migration).toContain("ALTER TABLE public.message_outbox");
    expect(migration).toContain("template_key");
    expect(migration).toContain("template_version");
    expect(migration).toContain("locale");
    expect(migration).not.toContain("CREATE TABLE public.notification_events");
  });

  test("adds task identity and token-bound delivery leases", () => {
    expect(migration).toContain("task_name");
    expect(migration).toContain("lease_token");
    expect(migration).toContain("claim_message_delivery_by_id");
    expect(migration).toContain("p_lease_token uuid");
    expect(migration).toContain("FOR UPDATE SKIP LOCKED");
    expect(migration).toContain("GRANT EXECUTE");
    expect(migration).toContain("TO service_role");
  });

  test("keeps task recovery bounded and indexed without granting member writes", () => {
    expect(migration).toContain("message_deliveries_task_recovery_idx");
    expect(migration).toContain("LEAST(GREATEST(p_limit, 1), 100)");
    expect(migration).toContain("REVOKE ALL");
    expect(migration).not.toMatch(/GRANT\s+(INSERT|UPDATE|DELETE|ALL).*authenticated/i);
  });
});
