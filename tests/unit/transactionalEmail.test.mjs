import { describe, expect, test } from "bun:test";
import { MESSAGE_CONTENT_CATALOG } from "../../src/lib/messageTemplateCatalog.ts";
import {
  renderTransactionalEmail,
  validateTransactionalEmailPresentationCatalog,
} from "../../src/lib/transactionalEmail.ts";

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
