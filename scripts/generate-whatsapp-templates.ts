#!/usr/bin/env bun
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  META_TEMPLATE_CATALOG,
  toMetaTemplateJson,
  validateMetaTemplateCatalog,
} from "../src/lib/messageTemplateCatalog.ts";

const root = path.join(process.cwd(), "whatsapp/templates/v2");
const write = process.argv.includes("--write");
const validation = validateMetaTemplateCatalog();
if (!validation.ok) throw new Error(`invalid_template_catalog:${validation.errors.join(",")}`);

const drift = [];
for (const variant of META_TEMPLATE_CATALOG) {
  const directory = path.join(root, variant.language);
  const file = path.join(directory, `${variant.name}.${variant.metaLanguage}.json`);
  const expected = `${JSON.stringify(toMetaTemplateJson(variant), null, 2)}\n`;
  if (write) {
    await mkdir(directory, { recursive: true });
    await writeFile(file, expected, "utf8");
    continue;
  }
  const current = await readFile(file, "utf8").catch(() => null);
  if (current !== expected) drift.push(path.relative(process.cwd(), file));
}

if (drift.length) {
  console.error(`WhatsApp template catalog drift:\n${drift.join("\n")}`);
  process.exitCode = 1;
} else {
  console.log(`${write ? "Generated" : "Validated"} ${META_TEMPLATE_CATALOG.length} v2 templates.`);
}
