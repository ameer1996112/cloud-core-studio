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

test("fails closed when persisted concierge presentation evidence does not match", () => {
  expect(() =>
    renderConciergeEmail({
      journeyType: "payment_outcome",
      templateKey: "payment_requires_action",
      locale: "en",
      subject: "Payment action required",
      body: "Hi Noa, your payment needs attention.",
      variables: { member_name: "Noa" },
      publicBaseUrl: "https://cloudandcorestudio.com",
      messageKey: "delivery-immutable",
      presentationKey: "payment_requires_action:email:v1",
      actionUrl: "https://cloudandcorestudio.com/member/payments",
    }),
  ).toThrow("concierge_presentation_evidence_mismatch");
});

test("accepts persisted null action evidence for a no-action concierge journey", () => {
  const rendered = renderConciergeEmail({
    journeyType: "booking_cancellation",
    templateKey: "booking_cancelled",
    locale: "en",
    subject: "Cancellation confirmed",
    body: "Your booking was cancelled.",
    variables: { member_name: "Noa" },
    publicBaseUrl: "https://cloudandcorestudio.com",
    messageKey: "delivery-no-action",
    presentationKey: "booking_cancelled:email:v2",
    actionUrl: null,
  });

  expect(rendered.presentationKey).toBe("booking_cancelled:email:v2");
  expect(rendered.html).not.toContain("If the button does not work");
});
