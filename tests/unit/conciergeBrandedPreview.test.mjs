import { describe, expect, test } from "bun:test";
import { buildConciergeBrandedPreview } from "../../src/lib/conciergeTemplateAdmin.ts";
import { CONCIERGE_PREMIUM_META_TEMPLATE_CATALOG } from "../../src/lib/conciergeTemplateCatalog.ts";
import { templateContentHash } from "../../src/lib/whatsappTemplateProvisioning.ts";
import { TRANSACTIONAL_EMAIL_SHELL_HASH } from "../../src/lib/transactionalEmail.ts";

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
  content_hash: "c".repeat(64),
  approved_at: "2026-07-26T00:00:00Z",
  approved_by: "admin-1",
};

function expectedHash(locale) {
  const providerTemplate = CONCIERGE_PREMIUM_META_TEMPLATE_CATALOG.find(
    (candidate) => candidate.name === "waitlist_offer_premium_v3" && candidate.language === locale,
  );
  return templateContentHash(providerTemplate);
}

function brandedPreview(templateInput, deployments) {
  const language = templateInput.locale === "en" ? "en_US" : templateInput.locale;
  return buildConciergeBrandedPreview(templateInput, deployments, {
    [`${templateInput.template_key}_premium_v3:${language}`]: expectedHash(language),
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

  test("previews the exact immutable email candidate instead of rebuilding current labels", () => {
    const candidate = {
      id: "candidate-v2",
      template_key: "waitlist_offer",
      channel: "email",
      locale: "he",
      source_template_id: template.id,
      source_template_version: template.version,
      source_content_hash: template.content_hash,
      source_approved_by: template.approved_by,
      source_approved_at: template.approved_at,
      presentation_version: 2,
      presentation_key: "waitlist_offer:email:v2",
      presentation_hash: "a".repeat(64),
      presentation_contract: {
        schema: "concierge_presentation_v2",
        presentationKey: "waitlist_offer:email:v2",
        eventType: "waitlist_spot_available",
        categoryLabel: "Frozen candidate category",
        actionLabel: "Frozen candidate action",
        actionUrl: "https://cloudandcorestudio.com/member/schedule",
        sourceContentHash: template.content_hash,
        facts: [{ key: "class_name", label: "Frozen class label", ltr: false }],
      },
      email_shell_version: 1,
      email_shell_hash: TRANSACTIONAL_EMAIL_SHELL_HASH,
      presentation_approved_by: null,
      presentation_approved_at: null,
      provider_template_name: null,
      provider_content_hash: null,
    };

    const preview = buildConciergeBrandedPreview(template, [], {}, [candidate], []);

    expect(preview.emailHtml).toContain("Frozen candidate category");
    expect(preview.emailHtml).toContain("Frozen candidate action");
    expect(preview.emailHtml).toContain("Frozen class label");
    expect(preview.emailHtml).not.toContain("רשימת המתנה");
  });

  test("renders the provider-approved WhatsApp catalog shell only when its exact hash matches", () => {
    const preview = brandedPreview(
      { ...template, channel: "whatsapp", locale: "ar", subject_template: null },
      [
        {
          template_name: "waitlist_offer_premium_v3",
          language: "ar",
          approval_status: "APPROVED",
          content_hash: expectedHash("ar"),
        },
      ],
    );

    expect(preview).toMatchObject({
      channel: "whatsapp",
      locale: "ar",
      presentationKey: "waitlist_offer:whatsapp:v3",
      providerApprovalStatus: "APPROVED",
      providerSyncStatus: "approved",
      whatsappHeaderUrl: "https://cloudandcorestudio.com/brand/concierge-whatsapp-header.png",
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
          template_name: "waitlist_offer_premium_v3",
          language: "he",
          approval_status: "APPROVED",
          content_hash: "stale-content-hash",
        },
      ],
    );

    expect(preview.providerApprovalStatus).toBe("APPROVED");
    expect(preview.providerSyncStatus).toBe("stale");
  });

  test("does not present the current WhatsApp catalog as an older immutable candidate", () => {
    const whatsappTemplate = {
      ...template,
      channel: "whatsapp",
      locale: "he",
      subject_template: null,
    };
    const preview = buildConciergeBrandedPreview(
      whatsappTemplate,
      [
        {
          template_name: "waitlist_offer_premium_v3",
          language: "he",
          approval_status: "APPROVED",
          content_hash: expectedHash("he"),
        },
      ],
      { "waitlist_offer_premium_v3:he": expectedHash("he") },
      [
        {
          id: "older-whatsapp-v2",
          template_key: "waitlist_offer",
          channel: "whatsapp",
          locale: "he",
          source_template_id: template.id,
          source_template_version: template.version,
          source_content_hash: template.content_hash,
          source_approved_by: template.approved_by,
          source_approved_at: template.approved_at,
          presentation_version: 2,
          presentation_key: "waitlist_offer:whatsapp:v2",
          presentation_hash: "d".repeat(64),
          presentation_contract: {
            schema: "concierge_presentation_v2",
            presentationKey: "waitlist_offer:whatsapp:v2",
            actionUrl: "https://cloudandcorestudio.com/member/schedule",
            sourceContentHash: template.content_hash,
            facts: [],
          },
          email_shell_version: null,
          email_shell_hash: null,
          presentation_approved_by: null,
          presentation_approved_at: null,
          provider_template_name: "waitlist_offer_branded_v2",
          provider_content_hash: "older-provider-hash",
        },
      ],
      [],
    );

    expect(preview.providerSyncStatus).toBe("stale");
    expect(preview.candidatePreviewExact).toBe(false);
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
          template_name: "waitlist_offer_premium_v3",
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
            template_name: "waitlist_offer_premium_v3",
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

  test("distinguishes the v2 candidate from the versions selected for test and live", () => {
    const versions = [
      {
        id: "v1",
        template_key: "waitlist_offer",
        channel: "email",
        locale: "he",
        source_template_id: "template-1",
        source_template_version: 2,
        source_content_hash: template.content_hash,
        presentation_version: 1,
        provider_template_name: null,
        provider_content_hash: null,
      },
      {
        id: "v2",
        template_key: "waitlist_offer",
        channel: "email",
        locale: "he",
        source_template_id: "template-1",
        source_template_version: 2,
        source_content_hash: template.content_hash,
        source_approved_by: template.approved_by,
        source_approved_at: template.approved_at,
        presentation_version: 2,
        presentation_key: "waitlist_offer:email:v2",
        presentation_hash: "b".repeat(64),
        presentation_contract: {
          schema: "concierge_presentation_v2",
          presentationKey: "waitlist_offer:email:v2",
          eventType: "waitlist_spot_available",
          categoryLabel: "רשימת המתנה",
          actionLabel: "מימוש המקום",
          actionUrl: "https://cloudandcorestudio.com/member/schedule",
          sourceContentHash: template.content_hash,
          facts: [],
        },
        email_shell_version: 1,
        email_shell_hash: TRANSACTIONAL_EMAIL_SHELL_HASH,
        presentation_approved_by: "admin-1",
        presentation_approved_at: "2026-07-26T01:00:00Z",
        provider_template_name: null,
        provider_content_hash: null,
      },
    ];
    const selections = [
      { id: "selection-live", delivery_mode: "live", delivery_version_id: "v1" },
      { id: "selection-test", delivery_mode: "test_only", delivery_version_id: "v2" },
    ];

    const preview = buildConciergeBrandedPreview(template, [], {}, versions, selections);

    expect(preview.deliveryState).toEqual({
      candidatePresentationVersion: 2,
      candidateAvailable: true,
      livePresentationVersion: 1,
      testOnlyPresentationVersion: 2,
    });
  });
});
