import { describe, expect, test } from "bun:test";
import {
  buildReadOnlyTemplateReconciliationPlan,
  buildTemplateReconciliationPlan,
  parseTemplateProvisioningArgs,
  prepareTemplateForProviderCreate,
  provisionWhatsappTemplates,
  refreshWhatsappTemplateDeployments,
  templateContentHash,
} from "../../src/lib/whatsappTemplateProvisioning.ts";
import { CONCIERGE_META_TEMPLATE_CATALOG } from "../../src/lib/conciergeTemplateCatalog.ts";

describe("WhatsApp v2 template provisioning", () => {
  test("is plan-only unless apply and the exact WABA are explicit", () => {
    expect(parseTemplateProvisioningArgs([])).toMatchObject({ apply: false, scope: "all" });
    expect(parseTemplateProvisioningArgs(["--scope", "concierge"])).toMatchObject({
      apply: false,
      scope: "concierge",
    });
    expect(parseTemplateProvisioningArgs(["--plan", "--local-only"])).toMatchObject({
      mode: "plan",
      localOnly: true,
    });
    expect(
      parseTemplateProvisioningArgs([
        "--apply",
        "--waba-id",
        "1009561255148806",
        "--header-handle-stdin",
      ]),
    ).toMatchObject({
      mode: "apply",
      headerHandleStdin: true,
    });
    expect(
      parseTemplateProvisioningArgs([
        "--refresh",
        "--waba-id",
        "1009561255148806",
        "--scope",
        "concierge",
      ]),
    ).toMatchObject({ mode: "refresh", scope: "concierge" });
    expect(() => parseTemplateProvisioningArgs(["--refresh"])).toThrow("refresh_requires_waba_id");
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
    expect(() =>
      parseTemplateProvisioningArgs(["--header-handle", "4::private-provider-handle"]),
    ).toThrow("private_media_handle_argv_forbidden");
    expect(() =>
      parseTemplateProvisioningArgs(["--header-handle=4::private-provider-handle"]),
    ).toThrow("private_media_handle_argv_forbidden");
    expect(() => parseTemplateProvisioningArgs(["--header-handle-stdin"])).toThrow(
      "header_handle_stdin_requires_apply_mode",
    );
  });

  test("performs an authenticated read-only provider reconciliation when available", async () => {
    let providerReads = 0;
    const template = {
      name: "booking_confirmed_first_branded_v2",
      language: "he",
      category: "UTILITY",
      components: [],
    };
    const remotePlan = await buildReadOnlyTemplateReconciliationPlan({
      templates: [template],
      remoteLookup: async () => {
        providerReads += 1;
        return [template];
      },
    });
    expect(remotePlan).toMatchObject({
      remoteLookup: { status: "succeeded", remoteCount: 1 },
      plan: [{ action: "unchanged" }],
    });
    expect(providerReads).toBe(1);

    const localPlan = await buildReadOnlyTemplateReconciliationPlan({
      templates: [template],
      localOnlyReason: "credentials_unavailable",
    });
    expect(localPlan).toMatchObject({
      remoteLookup: { status: "local_only", reason: "credentials_unavailable", remoteCount: 0 },
      plan: [{ action: "create" }],
    });
    expect(providerReads).toBe(1);
  });

  test("replaces image header URLs with an operator-provided Meta media handle for creation", () => {
    const template = {
      name: "booking_confirmed_first_branded_v2",
      language: "he",
      category: "UTILITY",
      components: [
        {
          type: "HEADER",
          format: "IMAGE",
          example: { header_handle: ["https://cloudandcorestudio.com/brand/header.webp"] },
        },
      ],
    };

    expect(() => prepareTemplateForProviderCreate(template)).toThrow(
      "apply_requires_header_handle",
    );
    expect(prepareTemplateForProviderCreate(template, "4::meta-uploaded-handle")).toMatchObject({
      components: [
        {
          type: "HEADER",
          example: { header_handle: ["4::meta-uploaded-handle"] },
        },
      ],
    });
  });

  test("hashes provider-only IMAGE header handles as the catalog header example", () => {
    const catalog = {
      name: "booking_confirmed_first_branded_v2",
      language: "he",
      category: "UTILITY",
      components: [
        {
          type: "HEADER",
          format: "IMAGE",
          example: {
            header_handle: ["https://cloudandcorestudio.com/brand/concierge-whatsapp-header.webp"],
          },
        },
        { type: "BODY", text: "Hi {{1}}" },
      ],
    };
    const provider = prepareTemplateForProviderCreate(catalog, "4::private-provider-handle");

    expect(templateContentHash(provider)).toBe(templateContentHash(catalog));
    expect(
      templateContentHash({
        ...provider,
        components: [provider.components[0], { type: "BODY", text: "Changed {{1}}" }],
      }),
    ).not.toBe(templateContentHash(catalog));
  });

  test("plan mode reports content drift without creating or acquiring a provider lease", async () => {
    let creates = 0;
    let leaseAcquires = 0;
    const result = await provisionWhatsappTemplates({
      wabaId: "1009561255148806",
      apply: false,
      templates: [
        {
          name: "booking_confirmed_first_branded_v2",
          language: "he",
          category: "UTILITY",
          components: [],
        },
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

  test("refresh reads and upserts only scoped templates without any create capability", async () => {
    let syncedRows;
    const sentinelHandle = "4::sentinel-should-not-appear";
    const remote = CONCIERGE_META_TEMPLATE_CATALOG.map((template, index) => ({
      ...template,
      id: `meta-${index}`,
      status: "APPROVED",
      rejected_reason: `provider detail ${sentinelHandle}`,
    }));
    const result = await refreshWhatsappTemplateDeployments({
      wabaId: "1009561255148806",
      templates: CONCIERGE_META_TEMPLATE_CATALOG,
      redactions: [sentinelHandle],
      meta: { listAll: async () => remote },
      sync: async (rows) => {
        syncedRows = rows;
      },
    });

    expect(result).toMatchObject({ refreshed: true, created: 0, count: remote.length });
    expect(JSON.stringify(result)).not.toContain(sentinelHandle);
    expect(syncedRows).toHaveLength(CONCIERGE_META_TEMPLATE_CATALOG.length);
    expect(syncedRows.every((row) => row.waba_id === "1009561255148806")).toBe(true);
    expect(syncedRows.every((row) => row.template_name.endsWith("_branded_v2"))).toBe(true);
    expect(syncedRows[0]).toMatchObject({
      provider_template_id: "meta-0",
      approval_status: "APPROVED",
      content_hash: templateContentHash(CONCIERGE_META_TEMPLATE_CATALOG[0]),
    });
    expect(JSON.stringify(syncedRows)).not.toContain(sentinelHandle);
  });

  test("refresh fails closed before listing or upserting for a wrong WABA or provider failure", async () => {
    let lists = 0;
    let syncs = 0;
    const input = {
      templates: [{ name: "one_branded_v2", language: "he", category: "UTILITY", components: [] }],
      meta: {
        listAll: async () => {
          lists += 1;
          throw new Error("provider_unavailable");
        },
      },
      sync: async () => {
        syncs += 1;
      },
    };

    await expect(
      refreshWhatsappTemplateDeployments({ ...input, wabaId: "wrong-waba" }),
    ).rejects.toThrow("apply_waba_id_not_confirmed");
    await expect(
      refreshWhatsappTemplateDeployments({ ...input, wabaId: "1009561255148806" }),
    ).rejects.toThrow("provider_unavailable");
    expect(lists).toBe(1);
    expect(syncs).toBe(0);
  });
});
