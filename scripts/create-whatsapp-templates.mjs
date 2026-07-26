#!/usr/bin/env bun
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  META_TEMPLATE_CATALOG,
  toMetaTemplateJson,
  validateMetaTemplateCatalog,
} from "../src/lib/messageTemplateCatalog.ts";
import {
  CONCIERGE_META_TEMPLATE_CATALOG,
  validateConciergeTemplateCatalog,
} from "../src/lib/conciergeTemplateCatalog.ts";
import {
  buildTemplateReconciliationPlan,
  parseTemplateProvisioningArgs,
  provisionWhatsappTemplates,
  templateContentHash,
} from "../src/lib/whatsappTemplateProvisioning.ts";

const ROOT = process.cwd();
const ENV_FILE = path.join(ROOT, ".env.whatsapp.local");

function loadLocalEnv() {
  if (!existsSync(ENV_FILE)) return;
  for (const line of readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
    const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || line.trim().startsWith("#") || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

function requireValue(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`missing_environment:${name}`);
  return value;
}

function graphBaseUrl() {
  return `https://graph.facebook.com/${requireValue("META_GRAPH_API_VERSION")}`;
}

async function metaRequest(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${requireValue("META_ACCESS_TOKEN")}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = payload?.error;
    throw new Error(
      [
        error?.message ?? `Meta API error ${response.status}`,
        error?.code && `code=${error.code}`,
        error?.error_subcode && `subcode=${error.error_subcode}`,
        error?.error_user_title && `title=${error.error_user_title}`,
        error?.error_user_msg && `user_msg=${error.error_user_msg}`,
        error?.error_data?.details && `details=${error.error_data.details}`,
        error?.fbtrace_id && `fbtrace_id=${error.fbtrace_id}`,
      ]
        .filter(Boolean)
        .join(" | "),
    );
  }
  return payload;
}

async function listAllMetaTemplates(wabaId) {
  const templates = [];
  let nextUrl = new URL(`${graphBaseUrl()}/${wabaId}/message_templates`);
  nextUrl.searchParams.set("fields", "name,language,status,category,components,rejected_reason");
  nextUrl.searchParams.set("limit", "100");
  while (nextUrl) {
    const payload = await metaRequest(nextUrl);
    templates.push(...(payload.data ?? []));
    nextUrl = payload.paging?.next ? new URL(payload.paging.next) : null;
  }
  return templates;
}

async function createMetaTemplate(wabaId, template) {
  return metaRequest(`${graphBaseUrl()}/${wabaId}/message_templates`, {
    method: "POST",
    body: JSON.stringify(template),
  });
}

function supabaseConfiguration() {
  return {
    url: process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim(),
    key: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  };
}

async function supabaseRequest(resource, body) {
  const { url, key } = supabaseConfiguration();
  if (!url || !key) throw new Error("missing_supabase_service_configuration");
  const response = await fetch(`${url}/rest/v1/${resource}`, {
    method: "POST",
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`supabase_template_lease_failed:${response.status}`);
  return payload;
}

async function syncDeploymentRecords(wabaId, localTemplates, remoteTemplates) {
  const { url, key } = supabaseConfiguration();
  if (!url || !key) return { synced: false, reason: "missing_supabase_service_configuration" };
  const rows = localTemplates.map((template) => {
    const remote = remoteTemplates.filter(
      (candidate) => candidate.name === template.name && candidate.language === template.language,
    );
    const exact = remote.find(
      (candidate) => templateContentHash(candidate) === templateContentHash(template),
    );
    return {
      waba_id: wabaId,
      template_name: template.name,
      language: template.language,
      version: "v2",
      category: template.category,
      content_hash: templateContentHash(template),
      provider_template_id: exact?.id ?? remote[0]?.id ?? null,
      approval_status:
        remote.length > 1
          ? "REMOTE_DUPLICATE"
          : exact
            ? (exact.status ?? "UNKNOWN")
            : remote.length
              ? "CONTENT_DRIFT"
              : "NOT_CREATED",
      provider_payload: {
        rejected_reason: exact?.rejected_reason ?? remote[0]?.rejected_reason ?? null,
      },
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });
  const response = await fetch(
    `${url}/rest/v1/whatsapp_template_deployments?on_conflict=waba_id,template_name,language`,
    {
      method: "POST",
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
        prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(rows),
    },
  );
  if (!response.ok) throw new Error(`supabase_template_sync_failed:${response.status}`);
  return { synced: true, count: rows.length };
}

loadLocalEnv();
const args = parseTemplateProvisioningArgs(process.argv.slice(2));
const catalogValidation = validateMetaTemplateCatalog();
if (!catalogValidation.ok)
  throw new Error(`invalid_template_catalog:${catalogValidation.errors.join(",")}`);
const conciergeValidation = validateConciergeTemplateCatalog();
if (!conciergeValidation.ok) {
  throw new Error(`invalid_concierge_template_catalog:${conciergeValidation.errors.join(",")}`);
}

const unifiedTemplates = META_TEMPLATE_CATALOG.map(toMetaTemplateJson);
const templatesForScope = {
  all: [...unifiedTemplates, ...CONCIERGE_META_TEMPLATE_CATALOG],
  concierge: CONCIERGE_META_TEMPLATE_CATALOG,
  unified: unifiedTemplates,
};
let templates = templatesForScope[args.scope];
if (args.only) templates = templates.filter((template) => template.name === args.only);
if (!templates.length) throw new Error(`template_not_found:${args.only ?? args.scope}`);

const lookupConfigured = Boolean(
  process.env.META_GRAPH_API_VERSION?.trim() &&
  process.env.META_ACCESS_TOKEN?.trim() &&
  (args.wabaId || process.env.META_WABA_ID?.trim()),
);
const wabaId = args.wabaId || process.env.META_WABA_ID?.trim();

if (!args.apply && !lookupConfigured) {
  const plan = await buildTemplateReconciliationPlan(templates, []);
  console.log(JSON.stringify({ mode: "plan", remoteLookup: false, plan }, null, 2));
  process.exit(0);
}

if (!wabaId) throw new Error("missing_environment:META_WABA_ID");
const result = await provisionWhatsappTemplates({
  wabaId,
  apply: args.apply,
  templates,
  lease: {
    acquire: async (owner) =>
      Boolean(
        await supabaseRequest("rpc/acquire_whatsapp_provisioning_lease", {
          p_waba_id: wabaId,
          p_owner: owner,
          p_lease_seconds: 300,
        }),
      ),
    release: async (owner) =>
      supabaseRequest("rpc/release_whatsapp_provisioning_lease", {
        p_waba_id: wabaId,
        p_owner: owner,
      }),
  },
  meta: {
    listAll: () => listAllMetaTemplates(wabaId),
    create: (template) => createMetaTemplate(wabaId, template),
  },
});
const synced = args.apply
  ? await syncDeploymentRecords(wabaId, templates, await listAllMetaTemplates(wabaId))
  : { synced: false, reason: "plan_only" };

console.log(
  JSON.stringify(
    { mode: args.apply ? "apply" : "plan", wabaId, ...result, deploymentSync: synced },
    null,
    2,
  ),
);
if (result.errors?.length) process.exitCode = 1;
