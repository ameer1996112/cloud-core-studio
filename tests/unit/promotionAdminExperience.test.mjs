import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const functions = readFileSync(
  new URL("../../src/lib/promotionManager.functions.ts", import.meta.url),
  "utf8",
);
const page = readFileSync(
  new URL("../../src/routes/_authenticated/admin/promotions.tsx", import.meta.url),
  "utf8",
);

describe("admin promotions manager", () => {
  test("saves reusable drafts and exposes a guarded lifecycle", () => {
    expect(functions).toContain("promotionCampaignDraftSchema");
    expect(functions).toContain("savePromotionDraft");
    expect(functions).toContain("previewPromotionAudience");
    expect(functions).toContain("sendPromotionTest");
    expect(functions).toContain("transitionPromotion");
    expect(functions).toContain("promotion_activation_requirements");
  });

  test("keeps preview, test-send, and activation as separate explicit actions", () => {
    expect(page).toContain("Preview audience");
    expect(page).toContain("Send test");
    expect(page).toContain("Activate campaign");
    expect(page).toContain("Save draft");
    expect(functions).toContain("Published promotions are immutable");
    expect(functions).toContain("broadcast_dispatched_at");
    expect(functions).toContain("broadcast_dispatch_started_at");
    expect(page).toContain("publishedLocked");
    expect(page).toContain("Use New promotion to create the next campaign");
    expect(page).not.toContain("Campaign enabled");
  });

  test("edits every approved locale and channel evidence", () => {
    expect(page).toContain("PROMOTION_LANGUAGES.map");
    expect(page).toContain("form.localizedContent[language]");
    expect(page).toContain('in_app: "In-app"');
    expect(page).toContain('push: "iPhone push"');
    expect(page).toContain('whatsapp: "WhatsApp"');
    expect(page).toContain("whatsappTemplates");
    expect(functions).toContain("whatsapp_template_deployments");
    expect(functions).toContain('approval_status === "APPROVED"');
    expect(page).not.toContain('["approved", "Approved"]');
  });

  test("shows the complete campaign funnel and localized attributed share links", () => {
    for (const metric of [
      "audience",
      "sent",
      "delivered",
      "read",
      "impressions",
      "clicks",
      "claims",
      "bookings",
      "conversion",
      "remaining",
    ]) {
      expect(functions).toContain(metric);
    }
    expect(page).toContain("promotionShareUrl");
    expect(page).toContain('url.searchParams.set("lang", language)');
    expect(page).toContain('url.searchParams.set("utm_campaign", slug)');
    expect(functions).toContain("actionUrl = `/member/schedule?program=");
    expect(page).toContain("Filtered schedule destination");
  });
});
