import { describe, expect, test } from "bun:test";
import { buildConciergeBrandedPreview } from "../../src/lib/conciergeTemplateAdmin.ts";

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

  test("renders the approved WhatsApp shell with header, footer, and contextual button", () => {
    const preview = buildConciergeBrandedPreview(
      { ...template, channel: "whatsapp", locale: "ar", subject_template: null },
      [
        {
          template_name: "waitlist_offer_branded_v2",
          language: "ar",
          approval_status: "APPROVED",
          content_hash: "approved-content",
        },
      ],
    );

    expect(preview).toMatchObject({
      channel: "whatsapp",
      locale: "ar",
      presentationKey: "waitlist_offer:whatsapp:v2",
      providerApprovalStatus: "APPROVED",
      whatsappHeaderUrl: "https://cloudandcorestudio.com/brand/concierge-whatsapp-header.webp",
      whatsappFooter: "Cloud & Core Studio",
      action: {
        label: "حجز المكان",
        url: "https://cloudandcorestudio.com/member/schedule",
      },
    });
    expect(preview.body).toContain("نور");
    expect(preview.emailHtml).toBeNull();
  });

  test("uses RTL presentation for Hebrew and Arabic previews", () => {
    for (const locale of ["he", "ar"]) {
      const preview = buildConciergeBrandedPreview({ ...template, locale }, []);
      expect(preview.dir).toBe("rtl");
    }
  });
});
