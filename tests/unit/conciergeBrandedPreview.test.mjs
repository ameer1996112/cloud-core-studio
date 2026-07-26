import { describe, expect, test } from "bun:test";
import { buildConciergeBrandedPreview } from "../../src/lib/conciergeTemplateAdmin.ts";
import { CONCIERGE_META_TEMPLATE_CATALOG } from "../../src/lib/conciergeTemplateCatalog.ts";
import { templateContentHash } from "../../src/lib/whatsappTemplateProvisioning.ts";

const template = {
  id: "template-1",
  template_key: "waitlist_offer",
  channel: "email",
  locale: "he",
  version: 2,
  lifecycle_status: "approved",
  subject_template: "התפנה מקום, {{member_name}}",
  body_template: "היי {{member_name}}, מקום ב-{{class_name}} פנוי עד {{offer_expires_at}}.",
  required_variables: ["member_name"],
  approved_at: "2026-07-26T00:00:00Z",
  approved_by: "admin-1",
};

function expectedHash(locale) {
  const providerTemplate = CONCIERGE_META_TEMPLATE_CATALOG.find(
    (candidate) => candidate.name === "waitlist_offer_branded_v2" && candidate.language === locale,
  );
  return templateContentHash(providerTemplate);
}

function brandedPreview(templateInput, deployments) {
  const language = templateInput.locale === "en" ? "en_US" : templateInput.locale;
  return buildConciergeBrandedPreview(templateInput, deployments, {
    [`${templateInput.template_key}_branded_v2:${language}`]: expectedHash(language),
  });
}

describe("Concierge branded previews", () => {
  test("renders the delivery-grade premium email with shared presentation evidence", () => {
    const preview = buildConciergeBrandedPreview(template, []);

    expect(preview).toMatchObject({
      channel: "email",
      locale: "he",
      lifecycleStatus: "approved",
      presentationKey: "waitlist_offer:email:v2",
      action: {
        label: "מימוש המקום",
        url: "https://cloudandcorestudio.com/member/schedule",
      },
    });
    expect(preview.emailHtml).toContain("Cloud &amp; Core");
    expect(preview.emailHtml).toContain("#F4EFE7");
    expect(preview.emailHtml).toContain('dir="rtl"');
  });

  test("renders the provider-approved WhatsApp catalog shell only when its exact hash matches", () => {
    const preview = brandedPreview(
      { ...template, channel: "whatsapp", locale: "ar", subject_template: null },
      [
        {
          template_name: "waitlist_offer_branded_v2",
          language: "ar",
          approval_status: "APPROVED",
          content_hash: expectedHash("ar"),
        },
      ],
    );

    expect(preview).toMatchObject({
      channel: "whatsapp",
      locale: "ar",
      presentationKey: "waitlist_offer:whatsapp:v2",
      providerApprovalStatus: "APPROVED",
      providerSyncStatus: "approved",
      whatsappHeaderUrl: "https://cloudandcorestudio.com/brand/concierge-whatsapp-header.webp",
      whatsappFooter: "Cloud & Core Studio",
      action: {
        label: "حجز المكان",
        url: "https://cloudandcorestudio.com/member/schedule",
      },
    });
    expect(preview.body).toContain("نور");
    expect(preview.body).not.toContain("מקום");
    expect(preview.emailHtml).toBeNull();
  });

  test("flags a hash mismatch as stale even when Meta reports approved", () => {
    const preview = brandedPreview(
      { ...template, channel: "whatsapp", locale: "he", subject_template: null },
      [
        {
          template_name: "waitlist_offer_branded_v2",
          language: "he",
          approval_status: "APPROVED",
          content_hash: "stale-content-hash",
        },
      ],
    );

    expect(preview.providerApprovalStatus).toBe("APPROVED");
    expect(preview.providerSyncStatus).toBe("stale");
  });

  test("flags missing and non-approved deployments as not synced", () => {
    const missing = brandedPreview(
      { ...template, channel: "whatsapp", locale: "he", subject_template: null },
      [],
    );
    const pending = brandedPreview(
      { ...template, channel: "whatsapp", locale: "he", subject_template: null },
      [
        {
          template_name: "waitlist_offer_branded_v2",
          language: "he",
          approval_status: "PENDING",
          content_hash: expectedHash("he"),
        },
      ],
    );

    expect(missing.providerSyncStatus).toBe("not_synced");
    expect(pending.providerSyncStatus).toBe("not_synced");
  });

  test("uses RTL presentation for Hebrew and Arabic previews", () => {
    for (const locale of ["he", "ar"]) {
      const preview = brandedPreview(
        { ...template, channel: "whatsapp", locale, subject_template: null },
        [
          {
            template_name: "waitlist_offer_branded_v2",
            language: locale,
            approval_status: "APPROVED",
            content_hash: expectedHash(locale),
          },
        ],
      );
      expect(preview.dir).toBe("rtl");
      expect(preview.body).toContain(locale === "he" ? "נועה" : "نور");
    }
  });
});
