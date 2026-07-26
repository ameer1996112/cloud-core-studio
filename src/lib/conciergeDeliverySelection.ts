import type { ApprovedDispatchTemplate } from "@/lib/conciergeDispatch";
import type { ConciergeChannel } from "@/lib/conciergePolicy";

export type ConciergeSourceTemplateRow = {
  id: string;
  template_key: string;
  channel: ConciergeChannel;
  locale: "ar" | "he" | "en";
  version: number;
  lifecycle_status: string;
  approved_by: string | null;
  approved_at: string | null;
  required_variables: string[];
  subject_template: string | null;
  body_template: string;
};

export type ConciergeDeliveryVersionRow = {
  id: string;
  template_key: string;
  channel: ConciergeChannel;
  locale: "ar" | "he" | "en";
  source_template_version: number;
  presentation_version: number;
  provider_template_name: string | null;
  provider_content_hash: string | null;
};

export type ConciergeDeliverySelectionRow = {
  id: string;
  delivery_mode: "test_only" | "live";
  delivery_version_id: string;
};

export type WhatsappDeploymentRow = {
  waba_id: string;
  template_name: string;
  language: string;
  approval_status: string;
  content_hash: string;
};

function providerLanguage(locale: ConciergeSourceTemplateRow["locale"]) {
  return locale === "en" ? "en_US" : locale;
}

function sourceApproved(template: ConciergeSourceTemplateRow) {
  return (
    template.lifecycle_status === "approved" &&
    Boolean(template.approved_by) &&
    Boolean(template.approved_at)
  );
}

export function selectEligibleConciergeTemplates(input: {
  templates: readonly ConciergeSourceTemplateRow[];
  versions: readonly ConciergeDeliveryVersionRow[];
  selections: readonly ConciergeDeliverySelectionRow[];
  deployments: readonly WhatsappDeploymentRow[];
  deliveryMode: "shadow" | "test_only" | "live";
  wabaId: string;
}): ApprovedDispatchTemplate[] {
  const selectionMode = input.deliveryMode === "test_only" ? "test_only" : "live";

  return input.templates.flatMap((template) => {
    if (!sourceApproved(template)) return [];
    const candidateIds = new Set(
      input.selections
        .filter((selection) => selection.delivery_mode === selectionMode)
        .map((selection) => selection.delivery_version_id),
    );
    const version = input.versions.find(
      (candidate) =>
        candidateIds.has(candidate.id) &&
        candidate.template_key === template.template_key &&
        candidate.channel === template.channel &&
        candidate.locale === template.locale &&
        candidate.source_template_version === template.version,
    );
    if (!version) return [];
    const selection = input.selections.find(
      (candidate) =>
        candidate.delivery_mode === selectionMode && candidate.delivery_version_id === version.id,
    );
    if (!selection) return [];

    if (template.channel === "whatsapp") {
      if (!version.provider_template_name || !version.provider_content_hash) return [];
      const exactDeployment = input.deployments.some(
        (deployment) =>
          deployment.waba_id === input.wabaId &&
          deployment.template_name === version.provider_template_name &&
          deployment.language === providerLanguage(template.locale) &&
          deployment.approval_status.toUpperCase() === "APPROVED" &&
          deployment.content_hash === version.provider_content_hash,
      );
      if (!exactDeployment) return [];
    }

    return [
      {
        id: template.id,
        templateKey: template.template_key,
        channel: template.channel,
        locale: template.locale,
        version: template.version,
        requiredVariables: template.required_variables,
        subjectTemplate: template.subject_template,
        bodyTemplate: template.body_template,
        presentationVersion: version.presentation_version,
        providerTemplateName: version.provider_template_name,
        providerContentHash: version.provider_content_hash,
        selectionId: selection.id,
      },
    ];
  });
}
