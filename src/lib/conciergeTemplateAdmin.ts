import type { ConciergeChannel } from "@/lib/conciergePolicy";

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
