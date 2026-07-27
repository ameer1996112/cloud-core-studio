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
    expect(sql).toContain("'draft',");
    expect(sql).toContain("catalog.first_person_voice_approved, NULL, NULL");
    expect(sql).not.toContain(
      "CASE WHEN provenance.approved_by IS NULL THEN 'draft' ELSE 'approved'",
    );
    expect(sql).not.toContain("LEFT JOIN provenance");
    expect(sql).toContain("concierge_approved_requires_provenance");
  });

  test("binds candidates to one exact approved source and selects v1 for both modes", () => {
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
    expect(sql).toContain("source_template_id uuid NOT NULL");
    expect(sql).toContain("source_content_hash text NOT NULL");
    expect(sql).toContain("source_approved_by uuid NOT NULL");
    expect(sql).toContain("source_approved_at timestamptz NOT NULL");
    expect(sql).toContain("SELECT DISTINCT ON (");
    expect(sql).toContain("source.lifecycle_status = 'approved'");
    expect(sql).toContain("v1.id, NULL");
    expect(sql).not.toContain(
      "CASE WHEN mode.delivery_mode = 'test_only' THEN COALESCE(v2.id, v1.id)",
    );
  });

  test("selects the exact candidate id with trusted source and provider evidence", () => {
    expect(sql).toContain("select_concierge_delivery_version");
    expect(sql).toContain("p_delivery_version_id uuid");
    expect(sql).toContain("v.id = p_delivery_version_id");
    expect(sql).toContain("source.id = v_version.source_template_id");
    expect(sql).toContain("source.content_hash = v_version.source_content_hash");
    expect(sql).toContain("provider_content_hash");
    expect(sql).toContain("w.content_hash = v_delivery_version.provider_content_hash");
    expect(sql).toContain("w.waba_id = v_canonical_whatsapp_waba_id");
    expect(sql).toContain("upper(w.approval_status) = 'APPROVED'");
    expect(sql).toContain("concierge_trusted_provider_settings");
    expect(sql).toContain("p_runtime_whatsapp_waba_id text");
    expect(sql).toContain("trusted_whatsapp_runtime_mismatch");
    expect(sql).not.toContain("count(DISTINCT deployment.waba_id)");
  });

  test("requires reviewed successful test delivery evidence before selecting v2 live", () => {
    expect(sql).toContain(
      "CREATE TABLE IF NOT EXISTS public.concierge_delivery_promotion_evidence",
    );
    expect(sql).toContain("review_concierge_test_delivery_evidence");
    expect(sql).toContain("successful_test_delivery_evidence_required");
    expect(sql).toContain("p_delivery_mode = 'live'");
    expect(sql).toContain("test_selection.delivery_mode = 'test_only'");
    expect(sql).toContain("test_delivery.status IN ('delivered','read')");
    expect(sql).toContain("promotion.reviewed_by IS NOT NULL");
    expect(sql).toContain("promotion.reviewed_at IS NOT NULL");
  });

  test("freezes exact email presentation and approval evidence", () => {
    for (const column of [
      "presentation_key text NOT NULL",
      "presentation_hash text NOT NULL",
      "presentation_contract jsonb NOT NULL",
      "email_shell_version integer",
      "email_shell_hash text",
      "presentation_approved_by uuid",
      "presentation_approved_at timestamptz",
    ]) {
      expect(sql).toContain(column);
    }
    expect(sql).toContain("source_content_hash");
    expect(sql).toContain("rendered_facts");
    expect(sql).toContain("rendered_fact_evidence_mismatch");
    expect(sql).toContain("v_expected_rendered_facts");
    expect(sql).toContain("public.concierge_presentation_contract(");
    expect(sql).toContain("public.concierge_presentation_hash(");
    expect(sql).toContain("prevent_concierge_delivery_identity_mutation");
    expect(sql).toContain("concierge_presentation_approval_is_immutable");
    expect(sql).toContain("concierge_presentation_preview_audit_idx");
    expect(sql).toContain("presentation_approved_by IS NULL");
    expect(sql).not.toContain("ON CONFLICT (delivery_version_id,presentation_hash) DO UPDATE");
  });

  test("uses one asset-complete WhatsApp v2 contract for seeds and later exact approvals", () => {
    expect(sql).toContain("'mimeType','image/png'");
    expect(sql).toContain("'width',1200");
    expect(sql).toContain("'height',628");
    expect(sql).toContain(
      "'sha256','b29c3947567fd874164ce7a7e24d1f230b6987183ea905fc13fbc7aebe830fb6'",
    );
    expect(sql.match(/public\.concierge_presentation_contract\(/g)?.length ?? 0).toBeGreaterThan(6);
  });

  test("atomically retires an approved source before approving its exact replacement", () => {
    const approval = sql.slice(
      sql.indexOf("CREATE OR REPLACE FUNCTION public.approve_concierge_template_version"),
      sql.indexOf("CREATE OR REPLACE FUNCTION public.approve_concierge_delivery_preview"),
    );
    expect(approval).toContain("FOR UPDATE");
    expect(approval).toContain("pg_advisory_xact_lock");
    expect(approval).toContain("source.id <> v_source.id");
    expect(approval).toContain("SET lifecycle_status = 'retired'");
    expect(approval).toContain("'replaced_source_ids'");
    expect(approval.indexOf("SET lifecycle_status = 'retired'")).toBeLessThan(
      approval.indexOf("SET lifecycle_status = 'approved'"),
    );
  });

  test("makes selection history append-only and blocks direct service-role mutation", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.concierge_delivery_selection_history");
    expect(sql).toContain("concierge_selection_history_is_append_only");
    expect(sql).toContain("BEFORE UPDATE OR DELETE ON public.concierge_delivery_selection_history");
    expect(sql).toContain("direct_concierge_selection_mutation_forbidden");
    expect(sql).toContain(
      "REVOKE UPDATE, DELETE ON public.concierge_delivery_selections FROM service_role",
    );
    expect(sql).toContain("'retired'::text");
    expect(sql).toContain("'selected'::text");
    expect(sql).toContain("replacement_selection_id");
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
    expect(sql).toContain("historical_materialization_replay");
    expect(sql).toContain("stored_materialization_evidence_reconstruction");
    expect(sql).toContain("v_existing_decision_id");
  });

  test("returns exact stored replays before mutable eligibility checks", () => {
    const replay = sql.indexOf("exact_stored_materialization_replay");
    const recipient = sql.indexOf("active_recipient_not_found");
    const configuration = sql.indexOf("automation_configuration_changed");
    const selection = sql.indexOf("delivery_selection_mismatch");
    expect(replay).toBeGreaterThan(0);
    expect(replay).toBeLessThan(recipient);
    expect(replay).toBeLessThan(configuration);
    expect(replay).toBeLessThan(selection);
  });

  test("emits reachable payment subtypes and recommendation domain events", () => {
    expect(sql).toContain("emit_concierge_payment_outcome_event");
    expect(sql).toContain("'payment_subtype',v_payment_subtype");
    expect(sql).toContain("'subscription_id',NEW.subscription_id");
    expect(sql).toContain("THEN 'payment.requires_action'");
    expect(sql).toContain("'requires_action',v_event_type = 'payment.requires_action'");
    expect(sql).toContain("emit_concierge_recommendation_event");
    expect(sql).toContain("'recommendation.created'");
    expect(sql).toContain("'recommendation_summary',p_recommendation_summary");
    expect(sql).toContain("recommendation_summary_required");
  });

  test("emits payment outcomes only for meaningful transitions with stable dedupe", () => {
    const paymentEmitter = sql.slice(
      sql.indexOf("CREATE OR REPLACE FUNCTION public.emit_concierge_payment_outcome_event"),
      sql.indexOf("CREATE OR REPLACE FUNCTION public.emit_concierge_recommendation_event"),
    );
    expect(paymentEmitter).toContain("v_previous_outcome");
    expect(paymentEmitter).toContain("v_current_outcome");
    expect(paymentEmitter).toContain("THEN 'payment.recovered'");
    expect(paymentEmitter).toContain("OLD.status IS NOT DISTINCT FROM NEW.status");
    expect(paymentEmitter).toContain(
      "OLD.provider_status IS NOT DISTINCT FROM NEW.provider_status",
    );
    expect(paymentEmitter).not.toContain("NEW.updated_at");
    expect(paymentEmitter).not.toContain("UPDATE OF status, provider_status, metadata");
    expect(paymentEmitter).toContain(
      "concat('payment.outcome:',NEW.id,':',COALESCE(v_previous_outcome,'initial'),':',v_event_type)",
    );
  });
});
