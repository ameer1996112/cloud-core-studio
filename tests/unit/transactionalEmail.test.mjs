import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { MESSAGE_CONTENT_CATALOG } from "../../src/lib/messageTemplateCatalog.ts";
import {
  renderTransactionalEmail,
  TRANSACTIONAL_EMAIL_SHELL_ARTIFACT,
  TRANSACTIONAL_EMAIL_SHELL_HASH,
  validateTransactionalEmailSenderConfig,
  validateTransactionalEmailPresentationCatalog,
} from "../../src/lib/transactionalEmail.ts";
import { hashTransactionalEmailShellArtifact } from "../../src/lib/transactionalEmailHash.server.ts";

const transactionalEmailSource = readFileSync(
  new URL("../../src/lib/transactionalEmail.ts", import.meta.url),
  "utf8",
);

const baseInput = {
  eventType: "subscription_renewal_failed",
  language: "he",
  subject: "לא הצלחנו לחדש את המנוי",
  body: "היי Test, לא הצלחנו לחדש את מנוי הסטודיו.\n\nאנחנו כאן לעזור.",
  variables: {
    member_name: "Test",
    package_name: "מנוי הסטודיו",
  },
  actionUrl: "/member/packages",
  publicBaseUrl: "https://cloudandcorestudio.com",
  replyTo: "studio@cloudandcorestudio.com",
  messageKey: "delivery-123",
};

describe("premium transactional email renderer", () => {
  test("keeps the shared renderer browser-safe", () => {
    expect(transactionalEmailSource).not.toContain('from "node:crypto"');
  });

  test("derives shell evidence from the canonical rendered artifact", () => {
    expect(hashTransactionalEmailShellArtifact(TRANSACTIONAL_EMAIL_SHELL_ARTIFACT)).toBe(
      TRANSACTIONAL_EMAIL_SHELL_HASH,
    );
    expect(
      hashTransactionalEmailShellArtifact(
        TRANSACTIONAL_EMAIL_SHELL_ARTIFACT.replace("#D4AF6A", "#000000"),
      ),
    ).not.toBe(TRANSACTIONAL_EMAIL_SHELL_HASH);
    expect(TRANSACTIONAL_EMAIL_SHELL_HASH).toMatch(/^[a-f0-9]{64}$/);
  });

  test("requires the branded From mailbox and a Reply-To without sending mail", () => {
    expect(
      validateTransactionalEmailSenderConfig({
        from: "Cloud & Core Studio <studio@cloudandcorestudio.com>",
        replyTo: "support@cloudandcorestudio.com",
      }),
    ).toEqual({
      from: "Cloud & Core Studio <studio@cloudandcorestudio.com>",
      replyTo: "support@cloudandcorestudio.com",
    });
    expect(() =>
      validateTransactionalEmailSenderConfig({
        from: "Cloud & Core <studio@cloudandcorestudio.com>",
        replyTo: "support@cloudandcorestudio.com",
      }),
    ).toThrow("invalid_messaging_email_from");
    expect(() =>
      validateTransactionalEmailSenderConfig({
        from: "Cloud & Core Studio <studio@cloudandcorestudio.com>",
        replyTo: "",
      }),
    ).toThrow("missing_messaging_email_reply_to");
  });

  test("renders a branded Outlook-safe Hebrew email with a text alternative", () => {
    const rendered = renderTransactionalEmail(baseInput);

    expect(rendered.html).toContain('<html lang="he" dir="rtl">');
    expect(rendered.html).toContain('role="presentation"');
    expect(rendered.html).toContain("Cloud &amp; Core");
    expect(rendered.html).toContain("AERIAL · STRENGTH · BALANCE");
    expect(rendered.html).toContain("עדכון תשלום");
    expect(rendered.html).toContain("בדיקת פרטי התשלום");
    expect(rendered.html).toContain("https://cloudandcorestudio.com/member/packages");
    expect(rendered.html).toContain("אנחנו כאן לעזור.");
    expect(rendered.text).toContain("לא הצלחנו לחדש את המנוי");
    expect(rendered.text).toContain("https://cloudandcorestudio.com/member/packages");
    expect(rendered.headers["X-Entity-Ref-ID"]).toBe("cc-delivery-123");
  });

  test("renders English left-to-right and Arabic right-to-left", () => {
    const english = renderTransactionalEmail({
      ...baseInput,
      language: "en",
      subject: "Membership renewal failed",
      body: "Hi Test, we could not renew your membership.",
    });
    const arabic = renderTransactionalEmail({
      ...baseInput,
      language: "ar",
      subject: "تعذر تجديد الاشتراك",
      body: "مرحباً Test، تعذر تجديد الاشتراك.",
    });

    expect(english.html).toContain('<html lang="en" dir="ltr">');
    expect(english.html).toContain("Payment update");
    expect(arabic.html).toContain('<html lang="ar" dir="rtl">');
    expect(arabic.html).toContain("تحديث الدفع");
  });

  test("escapes member content and suppresses unsafe or cross-origin actions", () => {
    const injected = renderTransactionalEmail({
      ...baseInput,
      subject: '<img src=x onerror="alert(1)">',
      body: '<script>alert("x")</script>\n\nSafe text',
      variables: { package_name: '<b onclick="x">Gold</b>' },
      actionUrl: "https://evil.example/steal",
    });

    expect(injected.html).not.toContain("<script>");
    expect(injected.html).not.toContain("<img src=x");
    expect(injected.html).not.toContain("evil.example");
    expect(injected.html).toContain("&lt;script&gt;");
    expect(injected.html).toContain("&lt;b onclick=&quot;x&quot;&gt;Gold&lt;/b&gt;");
    expect(injected.text).not.toContain("evil.example");
  });

  test("uses an explicit presentation instead of event-derived email metadata", () => {
    const rendered = renderTransactionalEmail({
      ...baseInput,
      language: "en",
      actionUrl: "https://evil.example/steal",
      presentation: {
        key: "payment_requires_action:email:v2",
        categoryLabel: "Payment details",
        action: {
          label: "Review payment",
          url: "https://cloudandcorestudio.com/member/packages",
        },
        facts: [{ key: "payment_amount", label: "Amount due", value: "₪120", ltr: true }],
      },
    });

    expect(rendered.html).toContain("Payment details");
    expect(rendered.html).toContain("Review payment");
    expect(rendered.html).toContain("Amount due");
    expect(rendered.html).toContain("https://cloudandcorestudio.com/member/packages");
    expect(rendered.html).not.toContain("evil.example");
    expect(rendered.text).toContain("Amount due: \u2066₪120\u2069");
  });

  test("includes localized structured facts in RTL plain text with isolated LTR values", () => {
    const rendered = renderTransactionalEmail({
      ...baseInput,
      language: "ar",
      subject: "تفاصيل الدفع",
      body: "تم تحديث الدفع.",
      presentation: {
        key: "payment_requires_action:email:v2",
        categoryLabel: "تفاصيل الدفع",
        action: null,
        facts: [
          { key: "amount", label: "المبلغ", value: "₪350.00", ltr: true },
          { key: "class_name", label: "الحصة", value: "بيلاتس", ltr: false },
        ],
      },
    });

    expect(rendered.text).toContain("المبلغ: \u2066₪350.00\u2069");
    expect(rendered.text).toContain("الحصة: بيلاتس");
  });

  test("shows only class facts for a class cancellation even when test data contains unrelated fields", () => {
    const rendered = renderTransactionalEmail({
      ...baseInput,
      eventType: "class_cancelled_by_admin",
      subject: "השיעור בוטל",
      body: "השיעור לא יתקיים הפעם.",
      variables: {
        class_name: "פילאטיס מזרן",
        class_date: "24/07/2026",
        class_time: "18:00",
        instructor_name: "ירין",
        location_name: "הסטודיו הראשי",
        offer_expires_at: "18:30",
        package_name: "מינוי חודשי",
        amount: "₪350",
        receipt_number: "CC-1001",
        renewal_date: "31/07/2026",
        expiry_date: "31/07/2026",
        credits_remaining: "2",
        waitlist_position: "2",
        spots_available: "3",
      },
      actionUrl: "/member/schedule",
    });

    expect(rendered.html).toContain("פילאטיס מזרן");
    expect(rendered.html).toContain("הסטודיו הראשי");
    expect(rendered.html).toContain("צפייה בלוח השיעורים");
    for (const unrelated of [
      "שמירת המקום עד",
      "חבילה",
      "סכום",
      "מספר קבלה",
      "מועד חידוש",
      "בתוקף עד",
      "קרדיטים שנותרו",
      "מיקום ברשימה",
      "מקומות פנויים",
    ]) {
      expect(rendered.html).not.toContain(unrelated);
      expect(rendered.text).not.toContain(unrelated);
    }
  });

  test("treats a failed subscription renewal as a payment event", () => {
    const rendered = renderTransactionalEmail({
      ...baseInput,
      eventType: "subscription_renewal_failed",
      language: "en",
      subject: "Renewal failed",
      body: "Please update your payment.",
      actionUrl: "https://cloudandcorestudio.com/member/packages",
      variables: {
        package_name: "Monthly membership",
        amount: "₪350",
        receipt_number: "CC-1001",
        renewal_date: "31/07/2026",
        credits_remaining: "2",
      },
      publicBaseUrl: "https://cloudandcorestudio.com",
    });

    expect(rendered.html).toContain("Amount");
    expect(rendered.html).toContain("Receipt");
    expect(rendered.html).not.toContain("Renewal date");
    expect(rendered.html).not.toContain("Credits left");
  });

  test("does not fall back to an action URL when an explicit presentation omits its action", () => {
    const rendered = renderTransactionalEmail({
      ...baseInput,
      language: "en",
      actionUrl: "/member/packages",
      presentation: {
        key: "payment_recovered:email:v2",
        categoryLabel: "Payment details",
        action: null,
        facts: [],
      },
    });

    expect(rendered.html).not.toContain("/member/packages");
    expect(rendered.text).not.toContain("/member/packages");
    expect(rendered.html).not.toContain("Review payment details");
  });

  test("has localized presentation metadata for every catalog event", () => {
    const result = validateTransactionalEmailPresentationCatalog(
      Object.keys(MESSAGE_CONTENT_CATALOG),
    );
    expect(result).toEqual({ ok: true, errors: [] });
  });

  test("keeps generated HTML compact and free of fragile email CSS", () => {
    const rendered = renderTransactionalEmail(baseInput);
    expect(new TextEncoder().encode(rendered.html).byteLength).toBeLessThan(50_000);
    expect(rendered.html).not.toMatch(/display:\s*(flex|grid)/);
    expect(rendered.html).not.toContain("<script");
    expect(rendered.html).not.toContain("<svg");
  });
});
