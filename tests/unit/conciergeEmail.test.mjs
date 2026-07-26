import { expect, test } from "bun:test";
import { renderConciergeEmail } from "../../src/lib/conciergeEmail.ts";

test("renders the premium shell with localized action and presentation evidence", () => {
  const rendered = renderConciergeEmail({
    journeyType: "payment_outcome",
    templateKey: "payment_requires_action",
    locale: "en",
    subject: "Payment action required",
    body: "Hi Noa, your payment needs attention.",
    variables: { member_name: "Noa" },
    publicBaseUrl: "https://cloudandcorestudio.com",
    replyTo: "support@cloudandcorestudio.com",
    messageKey: "delivery-1",
  });
  expect(rendered.html).toContain("Cloud &amp; Core");
  expect(rendered.html).toContain("#F4EFE7");
  expect(rendered.html).toContain("#D4AF6A");
  expect(rendered.html).toContain("Review payment");
  expect(rendered.html).toContain("https://cloudandcorestudio.com/member/packages");
  expect(rendered.text).toContain("Review payment:");
  expect(rendered.presentationKey).toBe("payment_requires_action:email:v2");
});
