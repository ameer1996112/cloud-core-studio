import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../../src/lib/adultTrials.functions.ts", import.meta.url),
  "utf8",
);

test("adult trial mutations authorize the caller before using service-role RPC access", () => {
  expect(source).toContain('import { supabaseAdmin } from "@/integrations/supabase/client.server"');
  expect(source).toContain("await requireAdmin(context.supabase, context.userId);");
  expect(source).toContain('(supabaseAdmin as any).rpc("create_adult_inquiry"');
  expect(source).toContain("manual_reconciliation_not_allowed_for_payment");
});
