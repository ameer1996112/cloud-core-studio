import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { CONCIERGE_META_TEMPLATE_CATALOG } from "../../src/lib/conciergeTemplateCatalog.ts";
import { templateContentHash } from "../../src/lib/whatsappTemplateProvisioning.ts";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260727130000_concierge_branded_messaging_final_fixes.sql",
);
const sql = readFileSync(migrationPath, "utf8");

describe("Concierge branded messaging final-fix migration", () => {
  test("seeds every missing WhatsApp source locale without inventing approval provenance", () => {
    const catalog = JSON.parse(sql.match(/\$missing_catalog\$(.*?)\$missing_catalog\$/s)[1]);
    expect(catalog).toHaveLength(15);
    expect(new Set(catalog.map((row) => row.template_key))).toEqual(
      new Set([
        "payment_one_time_succeeded",
        "payment_subscription_renewal_succeeded",
        "payment_requires_action",
        "payment_terminally_failed",
        "recommendation",
      ]),
    );
    for (const templateKey of new Set(catalog.map((row) => row.template_key))) {
      expect(
        catalog
          .filter((row) => row.template_key === templateKey)
          .map((row) => row.locale)
          .sort(),
      ).toEqual(["ar", "en", "he"]);
    }
    expect(sql).toContain("approved_by IS NOT NULL");
    expect(sql).toContain("concierge_approved_requires_provenance");
  });

  test("adds explicit version selection and exact provider deployment evidence", () => {
    const providerCatalog = JSON.parse(
      sql.match(/\$provider_catalog\$(.*?)\$provider_catalog\$/s)[1],
    );
    expect(providerCatalog).toEqual(
      CONCIERGE_META_TEMPLATE_CATALOG.map((template) => ({
        template_name: template.name,
        language: template.language,
        content_hash: templateContentHash(template),
      })),
    );
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.concierge_delivery_versions");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.concierge_delivery_selections");
    expect(sql).toContain("select_concierge_delivery_version");
    expect(sql).toContain("provider_content_hash");
    expect(sql).toContain("w.content_hash = v_delivery_version.provider_content_hash");
    expect(sql).toContain("w.waba_id = v_canonical_whatsapp_waba_id");
    expect(sql).toContain("upper(w.approval_status) = 'APPROVED'");
  });

  test("rejects every non-array or empty materialization shape, including SQL and JSON null", () => {
    expect(sql).toContain("p_materializations IS NULL");
    expect(sql).toContain("jsonb_typeof(p_materializations) IS DISTINCT FROM 'array'");
    expect(sql).toContain("COALESCE(jsonb_array_length(p_materializations), 0) = 0");
  });

  test("keeps the selected-evidence aggregation syntactically singular", () => {
    expect(sql.match(/INTO v_materialization_evidence/g) ?? []).toHaveLength(1);
  });

  test("keeps legacy work executable without permitting duplicate ambiguous sends", () => {
    expect(sql).toContain("legacy_parameters_v1_backfill");
    expect(sql).toContain("delivery_unknown");
    expect(sql).toContain("legacy_materialization_translation");
    expect(sql).toContain("WITH ORDINALITY");
    expect(sql).toContain("'selection_id'");
    expect(sql).toContain("'expected_content_hash'");
  });
});
