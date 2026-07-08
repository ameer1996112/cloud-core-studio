#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const ENV_FILE = path.join(ROOT, ".env.whatsapp.local");
const TEMPLATE_DIR = path.join(ROOT, "whatsapp/templates/he");
const REQUIRED_ENV = ["META_GRAPH_API_VERSION", "META_WABA_ID", "META_ACCESS_TOKEN"];
const DRY_RUN = process.argv.includes("--dry-run");
const ONLY_TEMPLATE = process.argv
  .find((argument) => argument.startsWith("--only="))
  ?.slice("--only=".length);

function loadLocalEnv() {
  if (!existsSync(ENV_FILE)) return;
  const raw = readFileSync(ENV_FILE, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.trim().replace(/^["']|["']$/g, "");
  }
}

function envReady() {
  return REQUIRED_ENV.every((key) => process.env[key]?.trim());
}

function requireEnvUnlessDryRun() {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]?.trim());
  if (missing.length && !DRY_RUN) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }
  return missing;
}

function graphBaseUrl() {
  return `https://graph.facebook.com/${process.env.META_GRAPH_API_VERSION}`;
}

function countVariables(text) {
  const matches = [...text.matchAll(/{{\s*(\d+)\s*}}/g)];
  return matches.length ? Math.max(...matches.map((match) => Number(match[1]))) : 0;
}

function assertNoBadValues(value, pathLabel) {
  if (value === null) throw new Error(`${pathLabel} must not be null`);
  if (typeof value === "string") {
    if (value.includes("undefined")) throw new Error(`${pathLabel} contains undefined`);
    if (value.trim() === "") throw new Error(`${pathLabel} must not be empty`);
  }
  if (Array.isArray(value)) {
    if (!value.length) throw new Error(`${pathLabel} must not be empty`);
    value.forEach((entry, index) => assertNoBadValues(entry, `${pathLabel}[${index}]`));
  } else if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      assertNoBadValues(entry, `${pathLabel}.${key}`);
    }
  }
}

function validateTemplate(template, fileName) {
  assertNoBadValues(template, fileName);
  if (!template.name) throw new Error(`${fileName}: template name is required`);
  if (template.category !== "UTILITY") throw new Error(`${fileName}: category must be UTILITY`);
  if (template.language !== "he") throw new Error(`${fileName}: language must be he`);
  if (!Array.isArray(template.components))
    throw new Error(`${fileName}: components must be an array`);

  const body = template.components.find((component) => component.type === "BODY");
  if (!body?.text?.trim()) throw new Error(`${fileName}: BODY text is required`);

  const expectedExamples = countVariables(body.text);
  const exampleRows = body.example?.body_text;
  const firstExampleRow = Array.isArray(exampleRows) ? exampleRows[0] : null;
  if (expectedExamples > 0) {
    if (!Array.isArray(firstExampleRow)) {
      throw new Error(`${fileName}: BODY examples are required for all variables`);
    }
    if (firstExampleRow.length < expectedExamples) {
      throw new Error(
        `${fileName}: expected ${expectedExamples} example values, found ${firstExampleRow.length}`,
      );
    }
    firstExampleRow.slice(0, expectedExamples).forEach((value, index) => {
      if (typeof value !== "string" || !value.trim()) {
        throw new Error(`${fileName}: example value for {{${index + 1}}} is empty`);
      }
    });
  }
}

async function readTemplates() {
  const files = (await readdir(TEMPLATE_DIR)).filter((file) => file.endsWith(".json")).sort();
  const templates = [];
  for (const file of files) {
    const fullPath = path.join(TEMPLATE_DIR, file);
    const template = JSON.parse(await readFile(fullPath, "utf8"));
    if (ONLY_TEMPLATE && template.name !== ONLY_TEMPLATE) continue;
    validateTemplate(template, file);
    templates.push({ file, template });
  }
  if (ONLY_TEMPLATE && templates.length === 0) {
    throw new Error(`No template found for --only=${ONLY_TEMPLATE}`);
  }
  return templates;
}

function formatMetaError(response, json) {
  const error = json?.error;
  if (!error) return `Meta API error ${response.status}`;

  const parts = [
    error.message,
    error.code ? `code=${error.code}` : "",
    error.error_subcode ? `subcode=${error.error_subcode}` : "",
    error.error_user_title ? `title=${error.error_user_title}` : "",
    error.error_user_msg ? `user_msg=${error.error_user_msg}` : "",
    error.error_data?.details ? `details=${error.error_data.details}` : "",
    error.fbtrace_id ? `fbtrace_id=${error.fbtrace_id}` : "",
  ].filter(Boolean);

  return parts.join(" | ");
}

async function metaRequest(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${process.env.META_ACCESS_TOKEN}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(formatMetaError(response, json));
  }
  return json;
}

async function fetchExistingTemplates() {
  const existing = new Map();
  let after = "";
  do {
    const url = new URL(`${graphBaseUrl()}/${process.env.META_WABA_ID}/message_templates`);
    url.searchParams.set("fields", "name,language,status,category,rejected_reason");
    url.searchParams.set("limit", "100");
    if (after) url.searchParams.set("after", after);
    const json = await metaRequest(url);
    for (const template of json.data ?? []) {
      existing.set(`${template.name}:${template.language}`, template);
    }
    after = json.paging?.cursors?.after ?? "";
  } while (after);
  return existing;
}

async function fetchWabaReadiness() {
  const wabaUrl = new URL(`${graphBaseUrl()}/${process.env.META_WABA_ID}`);
  wabaUrl.searchParams.set("fields", "id,name,account_review_status,business_verification_status");
  const phoneUrl = new URL(`${graphBaseUrl()}/${process.env.META_WABA_ID}/phone_numbers`);
  phoneUrl.searchParams.set(
    "fields",
    "display_phone_number,verified_name,code_verification_status,platform_type,quality_rating,status",
  );

  const [waba, phones] = await Promise.all([metaRequest(wabaUrl), metaRequest(phoneUrl)]);
  return {
    waba,
    phones: phones.data ?? [],
  };
}

function logWabaReadiness(readiness) {
  const { waba, phones } = readiness;
  console.log(
    `WABA: ${waba.name ?? waba.id} review=${waba.account_review_status ?? "UNKNOWN"} business=${waba.business_verification_status ?? "UNKNOWN"}`,
  );

  if (!phones.length) {
    console.log("WABA phones: none");
    return;
  }

  for (const phone of phones) {
    console.log(
      `WABA phone: ${phone.display_phone_number ?? phone.verified_name ?? "unknown"} status=${phone.status ?? "UNKNOWN"} platform=${phone.platform_type ?? "UNKNOWN"} code=${phone.code_verification_status ?? "UNKNOWN"}`,
    );
  }
}

async function createTemplate(template) {
  const url = `${graphBaseUrl()}/${process.env.META_WABA_ID}/message_templates`;
  return metaRequest(url, {
    method: "POST",
    body: JSON.stringify(template),
  });
}

loadLocalEnv();
const missing = requireEnvUnlessDryRun();
const templates = await readTemplates();
console.log(`Validated ${templates.length} Hebrew utility templates.`);

let existing = new Map();
if (envReady()) {
  const [readiness, existingTemplates] = await Promise.all([
    fetchWabaReadiness(),
    fetchExistingTemplates(),
  ]);
  logWabaReadiness(readiness);
  existing = existingTemplates;
  console.log(`Fetched ${existing.size} existing templates from Meta.`);
} else if (DRY_RUN) {
  console.log(`Dry run without Meta lookup. Missing env vars: ${missing.join(", ")}`);
}

const results = { created: 0, skipped: 0, failed: 0, dryRun: 0 };
for (const { template } of templates) {
  const key = `${template.name}:${template.language}`;
  const current = existing.get(key);
  if (current) {
    results.skipped += 1;
    console.log(`skipped existing: ${template.name} status=${current.status ?? "UNKNOWN"}`);
    if (current.status === "REJECTED") {
      console.error(`rejected: ${template.name} reason=${current.rejected_reason ?? "unknown"}`);
      process.exitCode = 1;
      break;
    }
    continue;
  }

  if (DRY_RUN) {
    results.dryRun += 1;
    console.log(`dry-run would create: ${template.name}`);
    continue;
  }

  try {
    const created = await createTemplate(template);
    results.created += 1;
    console.log(`created: ${template.name} id=${created.id ?? "unknown"} status=pending approval`);
  } catch (error) {
    results.failed += 1;
    console.error(`failed: ${template.name} ${error instanceof Error ? error.message : error}`);
  }
}

console.log(
  `Summary: created=${results.created} skipped=${results.skipped} dryRun=${results.dryRun} failed=${results.failed}`,
);
if (results.failed > 0) process.exitCode = 1;
