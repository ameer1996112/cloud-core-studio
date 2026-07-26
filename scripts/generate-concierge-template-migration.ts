#!/usr/bin/env bun
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  CONCIERGE_TEMPLATE_CATALOG,
  validateConciergeTemplateCatalog,
} from "../src/lib/conciergeTemplateCatalog";

const validation = validateConciergeTemplateCatalog();
if (!validation.ok) {
  throw new Error(`invalid_concierge_template_catalog:${validation.errors.join(",")}`);
}

const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20260726223000_concierge_template_library.sql",
);
const catalog = JSON.stringify(
  CONCIERGE_TEMPLATE_CATALOG.map((entry) => {
    const content = [
      entry.templateKey,
      entry.channel,
      entry.locale,
      String(entry.version),
      entry.subjectTemplate ?? "",
      entry.bodyTemplate,
      entry.requiredVariables.join(","),
    ].join("\n");
    return {
      template_key: entry.templateKey,
      channel: entry.channel,
      locale: entry.locale,
      version: entry.version,
      required_variables: entry.requiredVariables,
      subject_template: entry.subjectTemplate,
      body_template: entry.bodyTemplate,
      content_hash: createHash("sha256").update(content).digest("hex"),
      first_person_voice_approved: entry.firstPersonVoiceApproved,
    };
  }),
);

const sql = `-- Complete reusable Concierge template library for every dispatchable locale/channel.
-- These templates are approved as the initial system library by the product owner.

WITH catalog AS (
  SELECT *
  FROM jsonb_to_recordset($catalog$${catalog}$catalog$::jsonb) AS template(
    template_key text,
    channel text,
    locale text,
    version integer,
    required_variables text[],
    subject_template text,
    body_template text,
    content_hash text,
    first_person_voice_approved boolean
  )
)
INSERT INTO public.concierge_template_versions(
  studio_id,
  template_key,
  channel,
  locale,
  version,
  lifecycle_status,
  subject_template,
  body_template,
  required_variables,
  content_hash,
  first_person_voice_approved,
  approved_at
)
SELECT
  studio.id,
  catalog.template_key,
  catalog.channel,
  catalog.locale,
  catalog.version,
  'approved',
  catalog.subject_template,
  catalog.body_template,
  catalog.required_variables,
  catalog.content_hash,
  catalog.first_person_voice_approved,
  now()
FROM public.studios AS studio
CROSS JOIN catalog
ON CONFLICT (studio_id, template_key, channel, locale, version) DO NOTHING;
`;

const existing = await readFile(migrationPath, "utf8").catch(() => null);
if (existing !== null && existing !== sql) {
  throw new Error("historical_concierge_template_migration_drift:create_a_new_versioned_migration");
}
if (existing === null) await writeFile(migrationPath, sql, "utf8");
console.log(
  `${existing === null ? "Generated" : "Validated"} ${CONCIERGE_TEMPLATE_CATALOG.length} Concierge templates.`,
);
