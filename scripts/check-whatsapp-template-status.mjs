#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const ENV_FILE = path.join(ROOT, ".env.whatsapp.local");
const REQUIRED_ENV = ["META_GRAPH_API_VERSION", "META_WABA_ID", "META_ACCESS_TOKEN"];

function loadLocalEnv() {
  if (!existsSync(ENV_FILE)) return;
  for (const line of readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.trim().replace(/^["']|["']$/g, "");
  }
}

function requireEnv() {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]?.trim());
  if (missing.length) throw new Error(`Missing required env vars: ${missing.join(", ")}`);
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

async function metaRequest(url) {
  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${process.env.META_ACCESS_TOKEN}`,
    },
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(formatMetaError(response, json));
  }
  return json;
}

async function fetchTemplates() {
  const templates = [];
  let after = "";
  do {
    const url = new URL(
      `https://graph.facebook.com/${process.env.META_GRAPH_API_VERSION}/${process.env.META_WABA_ID}/message_templates`,
    );
    url.searchParams.set("fields", "name,language,status,category,rejected_reason");
    url.searchParams.set("limit", "100");
    if (after) url.searchParams.set("after", after);
    const json = await metaRequest(url);
    templates.push(...(json.data ?? []));
    after = json.paging?.cursors?.after ?? "";
  } while (after);
  return templates;
}

try {
  loadLocalEnv();
  requireEnv();
  const templates = await fetchTemplates();
  if (!templates.length) {
    console.log("No templates found.");
  }
  for (const template of templates.sort((a, b) => a.name.localeCompare(b.name))) {
    const reason = template.rejected_reason ? ` rejection=${template.rejected_reason}` : "";
    console.log(
      `${template.name} language=${template.language} category=${template.category} status=${template.status}${reason}`,
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
