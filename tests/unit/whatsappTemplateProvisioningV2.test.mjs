import { describe, expect, test } from "bun:test";
import {
  buildTemplateReconciliationPlan,
  parseTemplateProvisioningArgs,
  provisionWhatsappTemplates,
} from "../../src/lib/whatsappTemplateProvisioning.ts";

describe("WhatsApp v2 template provisioning", () => {
  test("is plan-only unless apply and the exact WABA are explicit", () => {
    expect(parseTemplateProvisioningArgs([])).toMatchObject({ apply: false, scope: "all" });
    expect(parseTemplateProvisioningArgs(["--scope", "concierge"])).toMatchObject({
      apply: false,
      scope: "concierge",
    });
    expect(() => parseTemplateProvisioningArgs(["--scope", "other"])).toThrow(
      "invalid_template_scope",
    );
    expect(() => parseTemplateProvisioningArgs(["--apply"])).toThrow("apply_requires_waba_id");
    expect(() =>
      parseTemplateProvisioningArgs(["--apply", "--waba-id", "not-the-production-waba"]),
    ).toThrow("apply_waba_id_not_confirmed");
    expect(
      parseTemplateProvisioningArgs(["--apply", "--waba-id", "1009561255148806"]),
    ).toMatchObject({ apply: true, wabaId: "1009561255148806" });
  });

  test("plan mode reports content drift without creating or acquiring a provider lease", async () => {
    let creates = 0;
    let leaseAcquires = 0;
    const result = await provisionWhatsappTemplates({
      wabaId: "1009561255148806",
      apply: false,
      templates: [
        { name: "booking_confirmed_first_branded_v2", language: "he", category: "UTILITY", components: [] },
      ],
      lease: {
        acquire: async () => {
          leaseAcquires += 1;
          return true;
        },
        release: async () => undefined,
      },
      meta: {
        listAll: async () => [
          {
            name: "booking_confirmed_first_branded_v2",
            language: "he",
            category: "UTILITY",
            components: [{ type: "BODY", text: "old copy" }],
          },
        ],
        create: async () => {
          creates += 1;
        },
      },
    });

    expect(result).toMatchObject({ applied: false, created: 0 });
    expect(result.plan).toEqual([expect.objectContaining({ action: "content_drift" })]);
    expect(creates).toBe(0);
    expect(leaseAcquires).toBe(0);
  });

  test("skips exact content, plans missing content, and refuses in-place drift", async () => {
    const local = [
      { name: "cc_booking_confirmed_v2", language: "he", category: "UTILITY", components: [] },
      { name: "cc_booking_confirmed_v2", language: "ar", category: "UTILITY", components: [] },
      { name: "cc_booking_confirmed_v2", language: "en_US", category: "UTILITY", components: [] },
    ];
    const remote = [
      { name: "cc_booking_confirmed_v2", language: "he", category: "UTILITY", components: [] },
      {
        name: "cc_booking_confirmed_v2",
        language: "ar",
        category: "UTILITY",
        components: [{ type: "BODY", text: "different" }],
      },
    ];
    expect(await buildTemplateReconciliationPlan(local, remote)).toEqual([
      expect.objectContaining({ language: "he", action: "unchanged" }),
      expect.objectContaining({ language: "ar", action: "content_drift" }),
      expect.objectContaining({ language: "en_US", action: "create" }),
    ]);
  });

  test("uses a shared lease and reconciles after provider errors", async () => {
    const calls = [];
    const result = await provisionWhatsappTemplates({
      wabaId: "1009561255148806",
      apply: true,
      templates: [
        { name: "cc_human_handoff_v2", language: "he", category: "UTILITY", components: [] },
      ],
      lease: {
        acquire: async () => true,
        release: async () => calls.push("released"),
      },
      meta: {
        listAll: async () =>
          calls.includes("created")
            ? [{ name: "cc_human_handoff_v2", language: "he", category: "UTILITY", components: [] }]
            : [],
        create: async () => {
          calls.push("created");
          throw new Error("provider_timeout");
        },
      },
    });
    expect(result).toMatchObject({ created: 0, reconciledAfterError: 1 });
    expect(calls).toEqual(["created", "released"]);
  });
});
