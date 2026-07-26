import { expect, test } from "bun:test";
import {
  renderConciergeEmail,
  renderSelectedConciergeEmail,
} from "../../src/lib/conciergeEmail.ts";

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

test("never mustache-renders an already stored final subject or body", () => {
  const rendered = renderConciergeEmail({
    journeyType: "class_change",
    templateKey: "class_cancelled",
    locale: "en",
    subject: "Update for {{nickname}}",
    body: "Hi {{nickname}}, the class changed.",
    variables: {
      member_name: "{{nickname}}",
      nickname: "this must not replace stored evidence",
    },
    publicBaseUrl: "https://cloudandcorestudio.com",
    messageKey: "delivery-single-render",
    contentMode: "final",
  });

  expect(rendered.subject).toBe("Update for {{nickname}}");
  expect(rendered.text).toContain("Hi {{nickname}}, the class changed.");
  expect(rendered.text).not.toContain("this must not replace stored evidence");
});

test("renders an explicitly selected v1 email without introducing v2 presentation or actions", () => {
  const rendered = renderSelectedConciergeEmail({
    journeyType: "payment_outcome",
    templateKey: "payment_requires_action",
    locale: "en",
    subject: "Payment action required",
    body: "Hi {{nickname}}, review the studio message.",
    variables: { nickname: "must not render" },
    publicBaseUrl: "https://cloudandcorestudio.com",
    messageKey: "delivery-v1",
    presentationKey: "payment_requires_action:email:v1",
    actionUrl: null,
  });

  expect(rendered.presentationKey).toBe("payment_requires_action:email:v1");
  expect(rendered.text).toContain("Hi {{nickname}}, review the studio message.");
  expect(rendered.text).not.toContain("must not render");
  expect(rendered.html).not.toContain("Review payment");
});
