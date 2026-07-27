import { META_TEMPLATE_CATALOG } from "../src/lib/messageTemplateCatalog.ts";
import {
  classifyLegacyTemplateRetirement,
  isConciergeMigratedEventType,
} from "../src/lib/whatsappTemplateConsolidation.ts";

const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

const now = new Date();
const usageStart = new Date(now.getTime() - 7 * 24 * 60 * 60_000);
const headers = {
  apikey: serviceRoleKey,
  authorization: `Bearer ${serviceRoleKey}`,
};

const legacyCatalog = new Map();
for (const variant of META_TEMPLATE_CATALOG) {
  const current = legacyCatalog.get(variant.name);
  legacyCatalog.set(variant.name, {
    name: variant.name,
    eventTypes: [...new Set([...(current?.eventTypes ?? []), variant.eventType])],
  });
}

const lastUsageByTemplate = new Map(
  await Promise.all(
    [...legacyCatalog.keys()].map(async (templateName) => {
      const query = new URLSearchParams({
        channel: "eq.whatsapp",
        created_at: `gte.${usageStart.toISOString()}`,
        "provider_payload->>template_name": `eq.${templateName}`,
        select: "created_at",
        order: "created_at.desc",
        limit: "1",
      });
      query.append("created_at", `lte.${now.toISOString()}`);
      const response = await fetch(
        `${supabaseUrl}/rest/v1/message_deliveries?${query.toString()}`,
        { headers },
      );
      if (!response.ok) {
        throw new Error(`delivery_usage_query_failed:${templateName}:${response.status}`);
      }
      const [latest] = await response.json();
      return [templateName, latest ? new Date(latest.created_at) : null];
    }),
  ),
);

const report = [...legacyCatalog.values()]
  .map((template) => {
    const stillRequired = template.eventTypes.some(
      (eventType) => !isConciergeMigratedEventType(eventType),
    );
    const lastUsedAt = lastUsageByTemplate.get(template.name) ?? null;
    return {
      ...template,
      lastUsedAt: lastUsedAt?.toISOString() ?? null,
      ...classifyLegacyTemplateRetirement({ now, lastUsedAt, stillRequired }),
    };
  })
  .sort((left, right) => left.name.localeCompare(right.name));

console.log(
  JSON.stringify(
    {
      generatedAt: now.toISOString(),
      zeroUsageWindowStartedAt: usageStart.toISOString(),
      eligible: report.filter((item) => item.eligible),
      retained: report.filter((item) => !item.eligible),
    },
    null,
    2,
  ),
);
