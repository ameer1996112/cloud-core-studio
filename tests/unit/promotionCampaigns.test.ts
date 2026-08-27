import { describe, expect, test } from "bun:test";
import {
  promotionCampaignDraftSchema,
  promotionEngagementSchema,
  promotionLifecycle,
  resolvePromotionDeliveryChannels,
  selectFeaturedPromotion,
  selectPromotionAudience,
  validatePromotionForActivation,
} from "../../src/lib/promotionCampaigns";

const localizedContent = {
  he: { eyebrow: "הטבה חדשה", title: "שיעור מתנה", body: "בואי להכיר את לינה", cta: "לקבלת ההטבה" },
  ar: { eyebrow: "عرض جديد", title: "حصة هدية", body: "تعالي للتعرف على لينا", cta: "احصلي على العرض" },
  en: { eyebrow: "New offer", title: "A class on us", body: "Come meet Lina", cta: "Claim offer" },
};

const activeCampaign = {
  id: "promo-1",
  status: "active" as const,
  startsAt: "2026-08-28T08:00:00.000Z",
  endsAt: "2026-09-04T08:00:00.000Z",
  priority: 10,
};

describe("reusable promotion campaign contract", () => {
  test("accepts a complete localized free-class draft and rejects unsafe destinations", () => {
    const draft = {
      slug: "yoga-lina-launch",
      name: "Yoga with Lina launch",
      promotionType: "free_class_credit",
      localizedContent,
      actionUrl: "/member/schedule?promotion=yoga-lina-launch",
      audience: { kind: "not_attended_program" },
      channels: ["in_app", "push", "whatsapp"],
      public: true,
      featured: true,
      priority: 10,
      claimLimit: 10,
      creditQuantity: 1,
      eligibleProgramTypeIds: ["11111111-1111-4111-8111-111111111111"],
      startsAt: "2026-08-28T08:00:00.000Z",
      endsAt: "2026-09-04T08:00:00.000Z",
      creditExpiresAt: "2026-09-18T08:00:00.000Z",
      whatsappTemplates: {
        he: { name: "cc_yoga_lina_launch_he", status: "approved" },
        ar: { name: "cc_yoga_lina_launch_ar", status: "approved" },
        en: { name: "cc_yoga_lina_launch_en", status: "approved" },
      },
    };

    expect(promotionCampaignDraftSchema.parse(draft)).toEqual(draft);
    expect(() =>
      promotionCampaignDraftSchema.parse({ ...draft, actionUrl: "https://evil.example/promo" }),
    ).toThrow();
  });

  test("fails activation closed when reward or approved WhatsApp evidence is incomplete", () => {
    const result = validatePromotionForActivation({
      promotionType: "free_class_credit",
      localizedContent,
      channels: ["in_app", "push", "whatsapp"],
      eligibleProgramTypeIds: [],
      claimLimit: 10,
      creditQuantity: 1,
      startsAt: "2026-08-28T08:00:00.000Z",
      endsAt: "2026-09-04T08:00:00.000Z",
      creditExpiresAt: "2026-09-04T08:00:00.000Z",
      whatsappTemplates: {
        he: { name: "cc_yoga_lina_launch_he", status: "approved" },
        ar: { name: "cc_yoga_lina_launch_ar", status: "pending" },
        en: { name: "cc_yoga_lina_launch_en", status: "approved" },
      },
      audiencePreviewedAt: null,
      testSentAt: null,
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([
      "eligible_program_required",
      "credit_expiry_must_follow_campaign",
      "whatsapp_template_ar_not_approved",
      "audience_preview_required",
      "test_send_required",
    ]);
  });

  test("derives scheduled, active, ended, paused, and archived lifecycle states", () => {
    const now = new Date("2026-08-28T09:00:00.000Z");
    expect(promotionLifecycle({ ...activeCampaign, status: "scheduled", startsAt: "2026-08-29T08:00:00.000Z" }, now)).toBe("scheduled");
    expect(promotionLifecycle(activeCampaign, now)).toBe("active");
    expect(promotionLifecycle({ ...activeCampaign, endsAt: "2026-08-28T08:30:00.000Z" }, now)).toBe("ended");
    expect(promotionLifecycle({ ...activeCampaign, status: "paused" }, now)).toBe("paused");
    expect(promotionLifecycle({ ...activeCampaign, status: "archived" }, now)).toBe("archived");
  });

  test("selects active members who have not attended the promoted program", () => {
    const members = [
      { id: "new-to-yoga", status: "active" },
      { id: "attended-yoga", status: "active" },
      { id: "inactive", status: "paused" },
    ];
    const attended = new Map([
      ["attended-yoga", new Set(["yoga"])],
      ["new-to-yoga", new Set(["pilates"])],
    ]);

    expect(
      selectPromotionAudience({
        members,
        audience: { kind: "not_attended_program" },
        eligibleProgramTypeIds: ["yoga"],
        attendedProgramTypeIdsByMember: attended,
      }).map((member) => member.id),
    ).toEqual(["new-to-yoga"]);
  });

  test("features only the highest-priority eligible active campaign", () => {
    const now = new Date("2026-08-28T09:00:00.000Z");
    expect(
      selectFeaturedPromotion({
        campaigns: [
          { ...activeCampaign, id: "low", priority: 2, featured: true },
          { ...activeCampaign, id: "high", priority: 20, featured: true },
          { ...activeCampaign, id: "hidden", priority: 30, featured: false },
          { ...activeCampaign, id: "dismissed", priority: 40, featured: true },
        ],
        dismissedCampaignIds: new Set(["dismissed"]),
        now,
      })?.id,
    ).toBe("high");
  });

  test("keeps in-app eligible while gating external channels by consent and capacity", () => {
    expect(
      resolvePromotionDeliveryChannels({
        requestedChannels: ["in_app", "push", "whatsapp"],
        marketingConsent: false,
        pushEnabled: true,
        whatsappEnabled: true,
        hasActivePushDevice: true,
        hasWhatsappNumber: true,
        promotionalContactsToday: 0,
        promotionalContactsThisWeek: 0,
        whatsappTemplateApproved: true,
      }),
    ).toEqual({ deliver: ["in_app"], suppressed: { push: "marketing_consent", whatsapp: "marketing_consent" } });

    expect(
      resolvePromotionDeliveryChannels({
        requestedChannels: ["in_app", "push", "whatsapp"],
        marketingConsent: true,
        pushEnabled: true,
        whatsappEnabled: true,
        hasActivePushDevice: true,
        hasWhatsappNumber: true,
        promotionalContactsToday: 0,
        promotionalContactsThisWeek: 1,
        whatsappTemplateApproved: true,
      }),
    ).toEqual({ deliver: ["in_app", "push", "whatsapp"], suppressed: {} });
  });

  test("accepts only the approved promotion analytics events and safe attribution", () => {
    expect(
      promotionEngagementSchema.parse({
        campaignId: "11111111-1111-4111-8111-111111111111",
        event: "claim_succeeded",
        source: "in_app",
        utm: { source: "instagram", medium: "dm", campaign: "yoga_lina_launch" },
      }),
    ).toMatchObject({ event: "claim_succeeded", source: "in_app" });
    expect(() =>
      promotionEngagementSchema.parse({
        campaignId: "11111111-1111-4111-8111-111111111111",
        event: "credit_changed",
        source: "in_app",
      }),
    ).toThrow();
  });
});
