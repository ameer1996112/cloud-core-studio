import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260824120000_yoga_lina_launch_promotion.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("reusable promotions manager database contract", () => {
  test("stores reusable lifecycle, content, targeting, channels, and publishing evidence", () => {
    for (const contract of [
      "promotion_type text NOT NULL",
      "status text NOT NULL DEFAULT 'draft'",
      "localized_content jsonb NOT NULL",
      "audience jsonb NOT NULL",
      "channels text[] NOT NULL",
      "action_url text NOT NULL",
      "is_public boolean NOT NULL DEFAULT false",
      "is_featured boolean NOT NULL DEFAULT false",
      "priority integer NOT NULL DEFAULT 0",
      "audience_previewed_at timestamptz",
      "test_sent_at timestamptz",
      "broadcast_dispatch_started_at timestamptz",
      "broadcast_dispatched_at timestamptz",
    ]) {
      expect(migration).toContain(contract);
    }
  });

  test("records append-only campaign audit and member engagement evidence", () => {
    expect(migration).toContain("CREATE TABLE public.promotion_campaign_audit");
    expect(migration).toContain("CREATE TABLE public.promotion_engagement_events");
    expect(migration).toContain(
      "'impression','cta_clicked','dismissed','claim_started','claim_succeeded','booking_completed'",
    );
    expect(migration).toContain("promotion_campaign_audit_append_only");
    expect(migration).toContain("promotion_engagement_idempotency_idx");
  });

  test("seeds Yoga with Lina as a disabled reusable campaign for existing and new members", () => {
    expect(migration).toContain(
      "'yoga-lina-launch', 'Yoga with Lina Launch', 'free_class_credit', 'draft'",
    );
    expect(migration).toContain("'not_attended_program'");
    expect(migration).toContain("ARRAY['in_app','push','whatsapp']::text[]");
    expect(migration).toContain("new_accounts_only, false");
  });

  test("accepts in-app claims without forcing public-link attribution", () => {
    const claim = migration.slice(
      migration.indexOf("CREATE OR REPLACE FUNCTION public.claim_promotion"),
      migration.indexOf("CREATE OR REPLACE FUNCTION public.expire_promotion_entitlements"),
    );
    expect(claim).toContain("IF p_attribution_token IS NOT NULL THEN");
    expect(claim).toContain("source, 'in_app'");
    expect(claim).not.toContain("missing_campaign_attribution");
  });

  test("enforces the not-attended-program audience at claim time", () => {
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.member_has_attended_promotion_program",
    );
    expect(migration).toContain("audience->>'kind' = 'not_attended_program'");
    expect(migration).toContain("already_attended_program");
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.member_matches_promotion_audience",
    );
    expect(migration).toContain("public.member_matches_promotion_audience(v_user, v_campaign.id)");
    expect(migration).toContain("audience_not_eligible");
  });

  test("keeps every new campaign disabled until preview, test-send, and activation", () => {
    expect(migration).toContain("promotion_activation_requirements");
    expect(migration).toContain("audience_preview_required");
    expect(migration).toContain("test_send_required");
    expect(migration).toContain("whatsapp_template_not_approved");
    expect(migration).toContain("prevent_published_promotion_content_mutation");
    expect(migration).toContain("promotion_campaign_content_immutable_after_delivery");
    expect(migration).toContain("published_promotions_are_immutable");
  });

  test("restricts activation readiness details to administrators and the service role", () => {
    const requirements = migration.slice(
      migration.indexOf("CREATE OR REPLACE FUNCTION public.promotion_activation_requirements"),
      migration.indexOf("CREATE OR REPLACE FUNCTION public.admin_preview_promotion_audience"),
    );
    expect(requirements).toContain("COALESCE(auth.role(),'') <> 'service_role'");
    expect(requirements).toContain("NOT public.has_role(auth.uid(),'admin')");
    expect(requirements).toContain("ARRAY['forbidden']");
  });

  test("previews the audience without depending on a lifecycle transition argument", () => {
    const preview = migration.slice(
      migration.indexOf("CREATE OR REPLACE FUNCTION public.admin_preview_promotion_audience"),
      migration.indexOf("CREATE OR REPLACE FUNCTION public.admin_mark_promotion_test_sent"),
    );
    expect(preview).toContain("audience_previewed_at=now()");
    expect(preview).not.toContain("p_next_status");
  });

  test("hides campaign inbox cards while paused and restores them without resending push", () => {
    expect(migration).toContain(
      "delivery_status='suppressed',suppression_reason='campaign_inactive'",
    );
    expect(migration).toContain("delivery_status='inbox',suppression_reason=NULL");
    expect(migration).toContain("promotion_id=p_promotion_id");
    expect(migration).toContain(
      "delivery_status IN ('inbox','queued','sending','sent','delivered','failed')",
    );
    expect(migration).toContain("suppress_inactive_promotion_notification");
    expect(migration).toContain("restore_promotion_notifications_on_activation");
    expect(migration).toContain("promotion_notification_activation_restore");
    expect(migration).toContain("NEW.enabled=true AND NEW.status='active'");
  });
});
