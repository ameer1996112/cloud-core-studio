import { describe, expect, test } from "bun:test";
import { evaluateConciergeDispatch } from "../../src/lib/conciergeDispatch.ts";

const recipient = {
  id: "recipient-1",
  locale: "ar",
  isAdult: true,
  hasPush: true,
  consents: {
    in_app: new Set(["transactional", "operational", "schedule", "promotional", "receipt"]),
    push: new Set(["transactional", "operational", "schedule", "promotional"]),
    email: new Set(["transactional", "operational", "receipt"]),
    whatsapp: new Set(["transactional", "operational", "promotional"]),
  },
};

const channelControls = {
  in_app: true,
  push: true,
  email: true,
  whatsapp: true,
};

function action(overrides = {}) {
  return {
    id: "intent-booking",
    kind: "booking_confirmed",
    purpose: "transactional",
    priority: 3,
    eligibleAt: new Date("2026-07-26T10:00:00Z"),
    metadata: { firstBooking: false },
    ...overrides,
  };
}

function template(templateKey, channel, locale = "ar") {
  return {
    id: `${templateKey}:${channel}:${locale}`,
    templateKey,
    channel,
    locale,
    version: 1,
    requiredVariables: ["member_name"],
    subjectTemplate: null,
    bodyTemplate: "مرحباً {{member_name}}",
  };
}

describe("dispatch-time concierge evaluation", () => {
  test("arbitrates all actions and chooses an urgent class change", () => {
    const result = evaluateConciergeDispatch({
      now: new Date("2026-07-26T21:00:00Z"),
      recipient,
      recentContacts: [],
      pendingActions: [
        action(),
        action({
          id: "urgent",
          kind: "class_cancelled",
          purpose: "operational",
          priority: 1,
          urgent: true,
          metadata: {},
        }),
      ],
      channelControls,
      approvedTemplates: [
        template("class_cancelled", "in_app"),
        template("class_cancelled", "push"),
        template("class_cancelled", "whatsapp"),
      ],
      variables: { member_name: "ليان" },
    });
    expect(result).toMatchObject({
      selectedActionId: "urgent",
      suppressionReason: null,
      channels: ["in_app", "push", "whatsapp"],
    });
  });

  test("uses push for repeat booking and WhatsApp for a first booking", () => {
    const common = {
      now: new Date("2026-07-26T10:05:00Z"),
      recipient,
      recentContacts: [],
      channelControls,
      variables: { member_name: "ليان" },
    };
    expect(
      evaluateConciergeDispatch({
        ...common,
        pendingActions: [action()],
        approvedTemplates: [
          template("booking_confirmed_repeat", "in_app"),
          template("booking_confirmed_repeat", "push"),
        ],
      }).channels,
    ).toEqual(["in_app", "push"]);
    expect(
      evaluateConciergeDispatch({
        ...common,
        pendingActions: [action({ metadata: { firstBooking: true } })],
        approvedTemplates: [
          template("booking_confirmed_first", "in_app"),
          template("booking_confirmed_first", "whatsapp"),
        ],
      }).channels,
    ).toEqual(["in_app", "whatsapp"]);
  });

  test("suppresses a channel when its exact locale template is missing", () => {
    const result = evaluateConciergeDispatch({
      now: new Date("2026-07-26T10:05:00Z"),
      recipient,
      recentContacts: [],
      pendingActions: [action()],
      channelControls,
      approvedTemplates: [template("booking_confirmed_repeat", "in_app", "en")],
      variables: { member_name: "ليان" },
    });
    expect(result.channels).toEqual([]);
    expect(result.suppressionReason).toBe("missing_approved_locale_template");
    expect(result.attentionReasons).toEqual([
      "missing_template:booking_confirmed_repeat:in_app:ar",
      "missing_template:booking_confirmed_repeat:push:ar",
    ]);
  });

  test("rejects templates with missing render variables", () => {
    const result = evaluateConciergeDispatch({
      now: new Date("2026-07-26T10:05:00Z"),
      recipient,
      recentContacts: [],
      pendingActions: [action()],
      channelControls,
      approvedTemplates: [
        template("booking_confirmed_repeat", "in_app"),
        template("booking_confirmed_repeat", "push"),
      ],
      variables: {},
    });
    expect(result.channels).toEqual([]);
    expect(result.suppressionReason).toBe("missing_template_variables");
  });

  test("rejects undeclared placeholders instead of rendering undefined", () => {
    const drifted = {
      ...template("booking_confirmed_repeat", "in_app"),
      requiredVariables: [],
      bodyTemplate: "مرحباً {{member_name}} — {{class_name}}",
    };
    const result = evaluateConciergeDispatch({
      now: new Date("2026-07-26T10:05:00Z"),
      recipient,
      recentContacts: [],
      pendingActions: [action()],
      channelControls: { ...channelControls, push: false },
      approvedTemplates: [drifted],
      variables: { member_name: "ليان" },
    });
    expect(result.channels).toEqual([]);
    expect(result.suppressionReason).toBe("missing_template_variables");
    expect(result.reasonCodes).toContain("missing_variables:in_app:class_name");
  });

  test("does not claim unavailable or unconsented payment channels", () => {
    const paymentRecipient = {
      ...recipient,
      hasPush: false,
      consents: {
        ...recipient.consents,
        push: new Set(),
        email: new Set(),
        whatsapp: new Set(["transactional"]),
      },
    };
    const result = evaluateConciergeDispatch({
      now: new Date("2026-07-26T10:05:00Z"),
      recipient: paymentRecipient,
      recentContacts: [],
      pendingActions: [
        action({
          id: "payment",
          kind: "payment_outcome",
          purpose: "transactional",
          metadata: { paymentOutcome: "payment_terminally_failed" },
        }),
      ],
      channelControls,
      approvedTemplates: [template("payment_terminally_failed", "in_app")],
      variables: { member_name: "ليان" },
    });
    expect(result.channels).toEqual(["in_app"]);
    expect(result.selectedTemplateKey).toBe("payment_terminally_failed");
  });

  test("keeps in-app durable but blocks disabled external channels", () => {
    const result = evaluateConciergeDispatch({
      now: new Date("2026-07-26T10:05:00Z"),
      recipient,
      recentContacts: [],
      pendingActions: [action()],
      channelControls: { ...channelControls, push: false },
      approvedTemplates: [
        template("booking_confirmed_repeat", "in_app"),
        template("booking_confirmed_repeat", "push"),
      ],
      variables: { member_name: "ليان" },
    });
    expect(result.channels).toEqual(["in_app"]);
    expect(result.reasonCodes).toContain("channel_disabled:push");
  });

  test("keeps a promotional in-app message eligible without external marketing consent", () => {
    const inAppOnlyRecipient = {
      ...recipient,
      hasPush: false,
      consents: {
        in_app: new Set(["promotional"]),
        push: new Set(),
        email: new Set(),
        whatsapp: new Set(),
      },
    };
    const result = evaluateConciergeDispatch({
      now: new Date("2026-07-26T10:05:00Z"),
      recipient: inAppOnlyRecipient,
      recentContacts: [],
      pendingActions: [
        action({
          id: "retention",
          kind: "retention",
          purpose: "promotional",
          priority: 6,
          metadata: { retentionStage: "initial" },
        }),
      ],
      channelControls,
      approvedTemplates: [template("retention", "in_app")],
      variables: { member_name: "ليان" },
    });

    expect(result).toMatchObject({
      selectedActionId: "retention",
      suppressionReason: null,
      channels: ["in_app"],
    });
  });

  test("does not silently substitute locale or bypass quiet hours", () => {
    const result = evaluateConciergeDispatch({
      now: new Date("2026-07-26T19:00:00Z"),
      recipient,
      recentContacts: [],
      pendingActions: [action()],
      channelControls,
      approvedTemplates: [
        template("booking_confirmed_repeat", "in_app"),
        template("booking_confirmed_repeat", "push"),
      ],
      variables: { member_name: "ليان" },
    });
    expect(result).toMatchObject({
      selectedActionId: null,
      suppressionReason: "quiet_hours",
      postponed: true,
      channels: [],
    });
  });
});
