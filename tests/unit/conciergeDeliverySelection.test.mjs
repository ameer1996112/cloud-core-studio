import { describe, expect, test } from "bun:test";
import {
  canOfferConciergeDeliverySelection,
  selectEligibleConciergeTemplates,
} from "../../src/lib/conciergeDeliverySelection.ts";

const source = {
  id: "source-whatsapp",
  template_key: "payment_requires_action",
  channel: "whatsapp",
  locale: "en",
  version: 1,
  lifecycle_status: "approved",
  approved_by: "admin-1",
  approved_at: "2026-07-26T00:00:00Z",
  content_hash: "source-hash",
  required_variables: ["member_name"],
  subject_template: null,
  body_template: "Hi {{member_name}}",
};
const v1 = {
  id: "candidate-v1",
  template_key: "payment_requires_action",
  channel: "whatsapp",
  locale: "en",
  source_template_id: "source-whatsapp",
  source_template_version: 1,
  source_content_hash: "source-hash",
  source_approved_by: "admin-1",
  source_approved_at: "2026-07-26T00:00:00Z",
  presentation_version: 1,
  presentation_key: "payment_requires_action:whatsapp:v1",
  presentation_hash: "presentation-v1-hash",
  presentation_contract: { schema: "concierge_presentation_v1" },
  email_shell_version: null,
  email_shell_hash: null,
  presentation_approved_by: null,
  presentation_approved_at: null,
  provider_template_name: "payment_requires_action",
  provider_content_hash: "v1-hash",
};
const v2 = {
  ...v1,
  id: "candidate-v2",
  presentation_version: 2,
  presentation_key: "payment_requires_action:whatsapp:v2",
  presentation_hash: "presentation-v2-hash",
  presentation_contract: { schema: "concierge_presentation_v2" },
  presentation_approved_by: "admin-2",
  presentation_approved_at: "2026-07-26T01:00:00Z",
  provider_template_name: "payment_requires_action_branded_v2",
  provider_content_hash: "v2-hash",
};
const selections = [
  {
    id: "live-selection",
    delivery_mode: "live",
    delivery_version_id: "candidate-v1",
  },
  {
    id: "test-selection",
    delivery_mode: "test_only",
    delivery_version_id: "candidate-v2",
  },
];

function deployment(overrides = {}) {
  return {
    waba_id: "waba-1",
    template_name: "payment_requires_action_branded_v2",
    language: "en_US",
    approval_status: "APPROVED",
    content_hash: "v2-hash",
    ...overrides,
  };
}

describe("Concierge delivery version selection", () => {
  test("does not offer v2 live before reviewed test-delivery evidence exists", () => {
    expect(
      canOfferConciergeDeliverySelection({
        candidate: v2,
        deliveryMode: "live",
        promotionEligibleVersionIds: [],
      }),
    ).toBe(false);
    expect(
      canOfferConciergeDeliverySelection({
        candidate: v2,
        deliveryMode: "live",
        promotionEligibleVersionIds: [v2.id],
      }),
    ).toBe(true);
    expect(
      canOfferConciergeDeliverySelection({
        candidate: v2,
        deliveryMode: "test_only",
        promotionEligibleVersionIds: [],
      }),
    ).toBe(true);
    expect(
      canOfferConciergeDeliverySelection({
        candidate: v1,
        deliveryMode: "live",
        promotionEligibleVersionIds: [],
      }),
    ).toBe(true);
  });

  test("defaults live to v1 while selecting v2 for test-only", () => {
    const live = selectEligibleConciergeTemplates({
      templates: [source],
      versions: [v1, v2],
      selections,
      deployments: [
        deployment({
          template_name: "payment_requires_action",
          content_hash: "v1-hash",
        }),
      ],
      deliveryMode: "live",
      wabaId: "waba-1",
    });
    const testOnly = selectEligibleConciergeTemplates({
      templates: [source],
      versions: [v1, v2],
      selections,
      deployments: [deployment()],
      deliveryMode: "test_only",
      wabaId: "waba-1",
    });

    expect(live).toEqual([
      expect.objectContaining({
        presentationVersion: 1,
        providerTemplateName: "payment_requires_action",
        providerContentHash: "v1-hash",
        selectionId: "live-selection",
      }),
    ]);
    expect(testOnly).toEqual([
      expect.objectContaining({
        presentationVersion: 2,
        providerTemplateName: "payment_requires_action_branded_v2",
        providerContentHash: "v2-hash",
        selectionId: "test-selection",
      }),
    ]);
  });

  test("requires complete source approval provenance and an exact scoped deployment", () => {
    for (const template of [
      { ...source, lifecycle_status: "draft" },
      { ...source, approved_by: null },
      { ...source, approved_at: null },
    ]) {
      expect(
        selectEligibleConciergeTemplates({
          templates: [template],
          versions: [v2],
          selections: [selections[1]],
          deployments: [deployment()],
          deliveryMode: "test_only",
          wabaId: "waba-1",
        }),
      ).toEqual([]);
    }

    for (const candidate of [
      { ...v2, source_template_id: "other-source" },
      { ...v2, source_content_hash: "stale-source-hash" },
      { ...v2, source_approved_by: "other-admin" },
      { ...v2, source_approved_at: "2026-07-25T00:00:00Z" },
      { ...v2, presentation_approved_by: null },
      { ...v2, presentation_approved_at: null },
    ]) {
      expect(
        selectEligibleConciergeTemplates({
          templates: [source],
          versions: [candidate],
          selections: [selections[1]],
          deployments: [deployment()],
          deliveryMode: "test_only",
          wabaId: "waba-1",
        }),
      ).toEqual([]);
    }

    for (const drift of [
      { waba_id: "other-waba" },
      { template_name: "other-template" },
      { language: "he" },
      { approval_status: "PENDING" },
      { content_hash: "drifted-hash" },
    ]) {
      expect(
        selectEligibleConciergeTemplates({
          templates: [source],
          versions: [v2],
          selections: [selections[1]],
          deployments: [deployment(drift)],
          deliveryMode: "test_only",
          wabaId: "waba-1",
        }),
      ).toEqual([]);
    }
  });
});
