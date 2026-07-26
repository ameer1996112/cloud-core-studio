import type { ConciergeChannel } from "@/lib/conciergePolicy";
import { renderConciergeEmail } from "@/lib/conciergeEmail";
import { buildConciergePresentation } from "@/lib/conciergePresentation";
import {
  conciergeWhatsappTemplateName,
  conciergeWhatsappTemplateDefinition,
  CONCIERGE_WHATSAPP_HEADER_URL,
} from "@/lib/conciergeTemplateCatalog";

export type ConciergeAdminTemplate = {
  id: string;
  template_key: string;
  channel: ConciergeChannel;
  locale: "ar" | "he" | "en";
  version: number;
  lifecycle_status: "draft" | "approved" | "retired";
  subject_template: string | null;
  body_template: string;
  required_variables: string[];
  approved_at: string | null;
  approved_by: string | null;
};

export type ConciergeTemplateFilters = {
  journey: string;
  channel: string;
  locale: string;
  query: string;
};

export type ConciergeWhatsappDeployment = {
  template_name: string;
  language: string;
  approval_status: string;
  content_hash: string | null;
};

export type ConciergeBrandedPreview = {
  channel: "email" | "whatsapp";
  locale: "he" | "ar" | "en";
  dir: "ltr" | "rtl";
  presentationKey: string;
  lifecycleStatus: "draft" | "approved";
  providerApprovalStatus: string | null;
  providerSyncStatus: "approved" | "stale" | "not_synced";
  subject: string | null;
  body: string;
  action: { label: string; url: string } | null;
  emailHtml: string | null;
  whatsappHeaderUrl: string | null;
  whatsappFooter: string | null;
};

const TEMPLATE_JOURNEYS: Record<string, string> = {
  booking_confirmed_first: "booking",
  booking_confirmed_repeat: "booking",
  booking_cancelled: "booking_cancellation",
  class_cancelled: "class_change",
  class_time_changed: "class_change",
  payment_outcome: "payment_outcome",
  payment_one_time_succeeded: "payment_outcome",
  payment_subscription_renewal_succeeded: "payment_outcome",
  payment_requires_action: "payment_outcome",
  payment_terminally_failed: "payment_outcome",
  payment_recovered: "payment_outcome",
  weekly_schedule: "weekly_schedule",
  retention: "retention",
  waitlist_offer: "waitlist",
  lead_to_trial: "lead_to_trial",
  recommendation: "recommendation",
  daily_briefing: "daily_briefing",
};

export function conciergeJourneyForTemplate(templateKey: string) {
  return TEMPLATE_JOURNEYS[templateKey] ?? templateKey;
}

export function isConciergeTemplateApproved(template: ConciergeAdminTemplate) {
  return (
    template.lifecycle_status === "approved" &&
    template.approved_by !== null &&
    template.approved_at !== null
  );
}

const PREVIEW_NAMES = { he: "נועה", ar: "نور", en: "Noa" } as const;

export function renderConciergeTemplatePreview(template: ConciergeAdminTemplate) {
  const values: Record<string, string> = {
    member_name: PREVIEW_NAMES[template.locale],
  };
  const render = (value: string | null) =>
    value?.replace(
      /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
      (_match, key: string) => values[key] ?? `{{${key}}}`,
    ) ?? null;
  return {
    subject: render(template.subject_template),
    body: render(template.body_template) ?? "",
  };
}

function previewVariables(locale: ConciergeBrandedPreview["locale"]) {
  return {
    member_name: locale === "he" ? "נועה" : locale === "ar" ? "نور" : "Noa",
    class_name: locale === "he" ? "פילאטיס מזרן" : locale === "ar" ? "بيلاتس مات" : "Mat Pilates",
    class_date: "28/07/2026",
    class_time: "18:00",
    amount: "₪350",
    offer_expires_at: "18:30",
  };
}

function whatsappCatalogAction(definition: ReturnType<typeof conciergeWhatsappTemplateDefinition>) {
  const buttons = definition?.components.find((component) => component.type === "BUTTONS");
  const button =
    buttons && "buttons" in buttons ? buttons.buttons.find((item) => item.type === "URL") : null;
  return button ? { label: button.text, url: button.url } : null;
}

export function buildConciergeBrandedPreview(
  template: ConciergeAdminTemplate,
  deployments: ConciergeWhatsappDeployment[],
  expectedContentHashes: Record<string, string> = {},
): ConciergeBrandedPreview | null {
  if (template.channel !== "email" && template.channel !== "whatsapp") return null;

  const locale = template.locale;
  const variables = previewVariables(locale);
  const journeyType = conciergeJourneyForTemplate(template.template_key);
  const presentation = buildConciergePresentation({
    journeyType,
    templateKey: template.template_key,
    locale,
    subject: template.subject_template,
    body: template.body_template,
    variables,
    publicBaseUrl: "https://cloudandcorestudio.com",
  });
  const isWhatsapp = template.channel === "whatsapp";
  const providerLanguage = locale === "en" ? "en_US" : locale;
  const whatsappDefinition = isWhatsapp
    ? conciergeWhatsappTemplateDefinition(template.template_key, locale)
    : null;
  const deployment = isWhatsapp
    ? deployments.find(
        (row) =>
          row.template_name === conciergeWhatsappTemplateName(template.template_key) &&
          row.language === providerLanguage,
      )
    : null;
  const expectedContentHash = whatsappDefinition
    ? (expectedContentHashes[`${whatsappDefinition.name}:${whatsappDefinition.language}`] ?? null)
    : null;
  const presentationKey = isWhatsapp ? `${template.template_key}:whatsapp:v2` : presentation.key;
  const email = isWhatsapp
    ? null
    : renderConciergeEmail({
        journeyType,
        templateKey: template.template_key,
        locale,
        subject: template.subject_template ?? "",
        body: template.body_template,
        variables,
        publicBaseUrl: "https://cloudandcorestudio.com",
        messageKey: `admin-preview:${template.id}`,
        presentationKey,
        actionUrl: presentation.action?.url ?? null,
      });

  return {
    channel: template.channel,
    locale,
    dir: locale === "en" ? "ltr" : "rtl",
    presentationKey,
    lifecycleStatus: template.lifecycle_status === "approved" ? "approved" : "draft",
    providerApprovalStatus: deployment?.approval_status ?? null,
    providerSyncStatus:
      deployment?.approval_status?.toUpperCase() === "APPROVED" &&
      deployment.content_hash !== null &&
      deployment.content_hash === expectedContentHash
        ? "approved"
        : deployment?.approval_status?.toUpperCase() === "APPROVED"
          ? "stale"
          : "not_synced",
    subject: template.subject_template ? presentation.subject : null,
    body: whatsappDefinition
      ? (whatsappDefinition.components
          .find((component) => component.type === "BODY")
          ?.text.replaceAll("{{1}}", variables.member_name) ?? presentation.body)
      : presentation.body,
    action: whatsappDefinition ? whatsappCatalogAction(whatsappDefinition) : presentation.action,
    emailHtml: email?.html ?? null,
    whatsappHeaderUrl: isWhatsapp ? CONCIERGE_WHATSAPP_HEADER_URL : null,
    whatsappFooter: whatsappDefinition
      ? (whatsappDefinition.components.find((component) => component.type === "FOOTER")?.text ??
        null)
      : null,
  };
}

export function filterConciergeTemplates(
  templates: ConciergeAdminTemplate[],
  filters: ConciergeTemplateFilters,
) {
  const query = filters.query.trim().toLocaleLowerCase();
  return templates.filter(
    (template) =>
      (!filters.journey ||
        conciergeJourneyForTemplate(template.template_key) === filters.journey) &&
      (!filters.channel || template.channel === filters.channel) &&
      (!filters.locale || template.locale === filters.locale) &&
      (!query ||
        [
          template.template_key,
          template.subject_template ?? "",
          template.body_template,
          template.channel,
          template.locale,
        ].some((value) => value.toLocaleLowerCase().includes(query))),
  );
}
