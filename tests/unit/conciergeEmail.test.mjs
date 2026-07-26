import { expect, test } from "bun:test";
import {
  renderConciergeEmail,
  renderSelectedConciergeEmail,
} from "../../src/lib/conciergeEmail.ts";
import {
  TRANSACTIONAL_EMAIL_SHELL_HASH,
  TRANSACTIONAL_EMAIL_SHELL_VERSION,
} from "../../src/lib/transactionalEmail.ts";

const sourceContentHash = "a".repeat(64);
const presentationHash = "b".repeat(64);

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

test("renders an explicitly selected v1 email with its frozen legacy event and action", () => {
  const rendered = renderSelectedConciergeEmail({
    journeyType: "payment_outcome",
    templateKey: "payment_one_time_succeeded",
    locale: "en",
    subject: "Payment received",
    body: "Hi {{nickname}}, your payment is complete.",
    variables: { nickname: "must not render", amount: "₪120", payment_date: "26/07/2026" },
    publicBaseUrl: "https://cloudandcorestudio.com",
    messageKey: "delivery-v1",
    presentationKey: "payment_one_time_succeeded:email:v1",
    presentationHash,
    presentationContract: {
      schema: "concierge_presentation_v1",
      presentationKey: "payment_one_time_succeeded:email:v1",
      eventType: "payment_confirmed",
      actionUrl: "https://cloudandcorestudio.com/member/packages",
      sourceContentHash,
      facts: [
        { key: "amount", label: "Amount", ltr: true },
        { key: "payment_date", label: "Date", ltr: true },
      ],
    },
    renderedFacts: [
      { key: "amount", label: "Amount", value: "₪120", ltr: true },
      { key: "payment_date", label: "Date", value: "26/07/2026", ltr: true },
    ],
    emailShellVersion: TRANSACTIONAL_EMAIL_SHELL_VERSION,
    emailShellHash: TRANSACTIONAL_EMAIL_SHELL_HASH,
    sourceContentHash,
    actionUrl: "https://cloudandcorestudio.com/member/packages",
  });

  expect(rendered.presentationKey).toBe("payment_one_time_succeeded:email:v1");
  expect(rendered.text).toContain("Hi {{nickname}}, your payment is complete.");
  expect(rendered.text).not.toContain("must not render");
  expect(rendered.html).toContain("Payment update");
  expect(rendered.html).toContain("View membership");
  expect(rendered.text).toContain("Amount: \u2066₪120\u2069");
  expect(rendered.text).toContain("Date: \u206626/07/2026\u2069");
});

test("rejects selected email when the frozen shell identity drifts", () => {
  expect(() =>
    renderSelectedConciergeEmail({
      journeyType: "payment_outcome",
      templateKey: "payment_requires_action",
      locale: "en",
      subject: "Payment action required",
      body: "Review payment.",
      variables: {},
      publicBaseUrl: "https://cloudandcorestudio.com",
      messageKey: "delivery-drift",
      presentationKey: "payment_requires_action:email:v2",
      presentationHash,
      presentationContract: {
        schema: "concierge_presentation_v2",
        presentationKey: "payment_requires_action:email:v2",
        eventType: "payment_failed",
        categoryLabel: "Payment details",
        actionLabel: "Review payment",
        actionUrl: "https://cloudandcorestudio.com/member/packages",
        sourceContentHash,
        facts: [],
      },
      renderedFacts: [],
      emailShellVersion: TRANSACTIONAL_EMAIL_SHELL_VERSION,
      emailShellHash: "c".repeat(64),
      sourceContentHash,
      actionUrl: "https://cloudandcorestudio.com/member/packages",
    }),
  ).toThrow("concierge_presentation_evidence_mismatch");
});

test("rejects selected email when a rendered fact drifts from its frozen definition", () => {
  const base = {
    journeyType: "payment_outcome",
    templateKey: "payment_requires_action",
    locale: "en",
    subject: "Payment action required",
    body: "Review payment.",
    variables: { amount: "₪120" },
    publicBaseUrl: "https://cloudandcorestudio.com",
    messageKey: "delivery-fact-drift",
    presentationKey: "payment_requires_action:email:v2",
    presentationHash,
    presentationContract: {
      schema: "concierge_presentation_v2",
      presentationKey: "payment_requires_action:email:v2",
      categoryLabel: "Payment details",
      actionLabel: "Review payment",
      actionUrl: "https://cloudandcorestudio.com/member/packages",
      sourceContentHash,
      facts: [{ key: "amount", label: "Amount", ltr: true }],
    },
    emailShellVersion: TRANSACTIONAL_EMAIL_SHELL_VERSION,
    emailShellHash: TRANSACTIONAL_EMAIL_SHELL_HASH,
    sourceContentHash,
    actionUrl: "https://cloudandcorestudio.com/member/packages",
  };

  expect(() =>
    renderSelectedConciergeEmail({
      ...base,
      renderedFacts: [{ key: "amount", label: "Total", value: "₪120", ltr: true }],
    }),
  ).toThrow("concierge_presentation_evidence_mismatch");
  expect(() =>
    renderSelectedConciergeEmail({
      ...base,
      renderedFacts: [{ key: "amount", label: "Amount", value: "₪999", ltr: true }],
    }),
  ).toThrow("concierge_presentation_evidence_mismatch");
});

test("rejects a v1 event identity that is not the exact legacy event for the source key", () => {
  expect(() =>
    renderSelectedConciergeEmail({
      journeyType: "payment_outcome",
      templateKey: "payment_requires_action",
      locale: "en",
      subject: "Payment action required",
      body: "Review payment.",
      variables: {},
      publicBaseUrl: "https://cloudandcorestudio.com",
      messageKey: "delivery-v1-event-drift",
      presentationKey: "payment_requires_action:email:v1",
      presentationHash,
      presentationContract: {
        schema: "concierge_presentation_v1",
        presentationKey: "payment_requires_action:email:v1",
        eventType: "human_handoff",
        actionUrl: "https://cloudandcorestudio.com/member/packages",
        sourceContentHash,
        facts: [],
      },
      renderedFacts: [],
      emailShellVersion: TRANSACTIONAL_EMAIL_SHELL_VERSION,
      emailShellHash: TRANSACTIONAL_EMAIL_SHELL_HASH,
      sourceContentHash,
      actionUrl: "https://cloudandcorestudio.com/member/packages",
    }),
  ).toThrow("concierge_presentation_evidence_mismatch");
});
