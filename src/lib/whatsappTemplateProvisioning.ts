import { createHash, randomUUID } from "node:crypto";

export const CONFIRMED_PRODUCTION_WABA_ID = "1009561255148806";

export type MetaTemplatePayload = {
  name: string;
  language: string;
  category: string;
  components: unknown[];
};

export type TemplatePlanItem = MetaTemplatePayload & {
  action: "create" | "unchanged" | "content_drift" | "remote_duplicate";
  contentHash: string;
  remoteCount: number;
};

export type TemplateProvisioningMode = "plan" | "apply" | "refresh";

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stable(nested)]),
    );
  }
  return value;
}

export function templateContentHash(template: MetaTemplatePayload) {
  const content = stable({
    name: template.name,
    language: template.language,
    category: template.category,
    components: template.components,
  });
  return createHash("sha256").update(JSON.stringify(content)).digest("hex");
}

export async function buildTemplateReconciliationPlan(
  local: readonly MetaTemplatePayload[],
  remote: readonly MetaTemplatePayload[],
): Promise<TemplatePlanItem[]> {
  return local.map((template) => {
    const matching = remote.filter(
      (candidate) => candidate.name === template.name && candidate.language === template.language,
    );
    const contentHash = templateContentHash(template);
    let action: TemplatePlanItem["action"] = "create";
    if (matching.length > 1) action = "remote_duplicate";
    else if (matching.length === 1) {
      action = templateContentHash(matching[0]) === contentHash ? "unchanged" : "content_drift";
    }
    return { ...template, action, contentHash, remoteCount: matching.length };
  });
}

export function parseTemplateProvisioningArgs(argv: readonly string[]) {
  let mode: TemplateProvisioningMode = "plan";
  let wabaId: string | undefined;
  let only: string | undefined;
  let headerHandle: string | undefined;
  let scope: "all" | "concierge" | "unified" = "all";
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--apply") {
      if (mode === "refresh") throw new Error("template_mode_conflict");
      mode = "apply";
    } else if (argument === "--refresh") {
      if (mode === "apply") throw new Error("template_mode_conflict");
      mode = "refresh";
    } else if (argument === "--waba-id") wabaId = argv[(index += 1)];
    else if (argument?.startsWith("--waba-id=")) wabaId = argument.slice("--waba-id=".length);
    else if (argument === "--only") only = argv[(index += 1)];
    else if (argument?.startsWith("--only=")) only = argument.slice("--only=".length);
    else if (argument === "--header-handle") headerHandle = argv[(index += 1)];
    else if (argument?.startsWith("--header-handle=")) {
      headerHandle = argument.slice("--header-handle=".length);
    } else if (argument === "--scope") {
      const value = argv[(index += 1)];
      if (value !== "all" && value !== "concierge" && value !== "unified") {
        throw new Error(`invalid_template_scope:${value ?? ""}`);
      }
      scope = value;
    } else if (argument?.startsWith("--scope=")) {
      const value = argument.slice("--scope=".length);
      if (value !== "all" && value !== "concierge" && value !== "unified") {
        throw new Error(`invalid_template_scope:${value}`);
      }
      scope = value;
    } else if (argument !== "--plan" && argument !== "--check") {
      throw new Error(`unknown_template_argument:${argument}`);
    }
  }
  if (mode === "apply" && !wabaId) throw new Error("apply_requires_waba_id");
  if (mode === "refresh" && !wabaId) throw new Error("refresh_requires_waba_id");
  if (mode !== "plan" && wabaId !== CONFIRMED_PRODUCTION_WABA_ID) {
    throw new Error("apply_waba_id_not_confirmed");
  }
  return {
    mode,
    apply: mode === "apply",
    refresh: mode === "refresh",
    wabaId,
    only,
    scope,
    headerHandle,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function templateRequiresHeaderHandle(template: MetaTemplatePayload) {
  return template.components.some(
    (component) =>
      isRecord(component) && component.type === "HEADER" && component.format === "IMAGE",
  );
}

/**
 * Meta template creation accepts an uploaded media handle for IMAGE header examples. Runtime
 * delivery continues to use the catalog's public HTTPS URL; this function is only for creation.
 */
export function prepareTemplateForProviderCreate(
  template: MetaTemplatePayload,
  headerHandle?: string,
): MetaTemplatePayload {
  const safeHandle = headerHandle?.trim();
  if (templateRequiresHeaderHandle(template) && !safeHandle) {
    throw new Error("apply_requires_header_handle");
  }
  return {
    ...template,
    components: template.components.map((component) => {
      if (!isRecord(component) || component.type !== "HEADER" || component.format !== "IMAGE") {
        return component;
      }
      const example = isRecord(component.example) ? component.example : {};
      return { ...component, example: { ...example, header_handle: [safeHandle] } };
    }),
  };
}

export type TemplateProvisionDependencies = {
  wabaId: string;
  apply: boolean;
  templates: readonly MetaTemplatePayload[];
  lease: {
    acquire(owner: string): Promise<boolean>;
    release(owner: string): Promise<unknown>;
  };
  meta: {
    listAll(): Promise<MetaTemplatePayload[]>;
    create(template: MetaTemplatePayload): Promise<unknown>;
  };
};

export async function provisionWhatsappTemplates(input: TemplateProvisionDependencies) {
  const owner = `template-provisioner:${randomUUID()}`;
  const initialRemote = await input.meta.listAll();
  const initialPlan = await buildTemplateReconciliationPlan(input.templates, initialRemote);
  if (!input.apply) {
    return { applied: false, plan: initialPlan, created: 0, reconciledAfterError: 0 };
  }
  if (input.wabaId !== CONFIRMED_PRODUCTION_WABA_ID) throw new Error("apply_waba_id_not_confirmed");
  if (!(await input.lease.acquire(owner)))
    throw new Error("whatsapp_provisioning_lease_unavailable");

  let created = 0;
  let reconciledAfterError = 0;
  const errors: Array<{ name: string; language: string; error: string }> = [];
  try {
    const currentRemote = await input.meta.listAll();
    const plan = await buildTemplateReconciliationPlan(input.templates, currentRemote);
    for (const item of plan) {
      if (item.action !== "create") continue;
      const template: MetaTemplatePayload = {
        name: item.name,
        language: item.language,
        category: item.category,
        components: item.components,
      };
      try {
        await input.meta.create(template);
        created += 1;
      } catch (error) {
        const afterError = await input.meta.listAll();
        const reconciled = afterError.some(
          (remote) =>
            remote.name === template.name &&
            remote.language === template.language &&
            templateContentHash(remote) === templateContentHash(template),
        );
        if (reconciled) reconciledAfterError += 1;
        else {
          errors.push({
            name: template.name,
            language: template.language,
            error: error instanceof Error ? error.message : "template_create_failed",
          });
        }
      }
    }
    return { applied: true, plan, created, reconciledAfterError, errors };
  } finally {
    await input.lease.release(owner);
  }
}
