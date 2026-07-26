import { useState } from "react";
import { AdminSection } from "@/components/admin-shared";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  conciergeJourneyForTemplate,
  filterConciergeTemplates,
  isConciergeTemplateApproved,
  renderConciergeTemplatePreview,
  type ConciergeAdminTemplate,
} from "@/lib/conciergeTemplateAdmin";

export function ConciergeTemplateLibrary({
  templates,
  copy,
}: {
  templates: ConciergeAdminTemplate[];
  copy: Record<string, string>;
}) {
  const [journey, setJourney] = useState("");
  const [channel, setChannel] = useState("");
  const [locale, setLocale] = useState("");
  const [query, setQuery] = useState("");
  const journeys = [
    ...new Set(templates.map((template) => conciergeJourneyForTemplate(template.template_key))),
  ];
  const visible = filterConciergeTemplates(templates, { journey, channel, locale, query });

  return (
    <AdminSection title={copy.templateLibrary} eyebrow={copy.templates}>
      <p className="mb-4 text-sm text-slate">{copy.templateLibraryHint}</p>
      <div className="editorial-panel mb-4 grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
        <Input
          aria-label={copy.searchTemplates}
          placeholder={copy.searchTemplates}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <TemplateFilter
          label={copy.allJourneys}
          value={journey}
          onChange={setJourney}
          options={journeys.map((value) => ({
            value,
            label: value.replaceAll("_", " "),
          }))}
        />
        <TemplateFilter
          label={copy.allChannels}
          value={channel}
          onChange={setChannel}
          options={["in_app", "push", "email", "whatsapp"].map((value) => ({
            value,
            label: value.replace("_", " "),
          }))}
        />
        <TemplateFilter
          label={copy.allLanguages}
          value={locale}
          onChange={setLocale}
          options={[
            { value: "he", label: "עברית" },
            { value: "ar", label: "العربية" },
            { value: "en", label: "English" },
          ]}
        />
      </div>
      <p className="mb-3 text-xs text-slate">
        {visible.length} {copy.results}
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        {visible.map((template) => {
          const preview = renderConciergeTemplatePreview(template);
          const approved = isConciergeTemplateApproved(template);
          return (
            <article className="editorial-panel space-y-4 p-5" key={template.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium capitalize text-navy">
                    {template.template_key.replaceAll("_", " ")}
                  </h3>
                  <p className="mt-1 text-xs uppercase tracking-wide text-slate">
                    {template.channel.replace("_", " ")} · {template.locale} · v{template.version}
                  </p>
                </div>
                <Badge variant={approved ? "secondary" : "destructive"}>
                  {approved ? copy.approved : copy.draft}
                </Badge>
              </div>
              <div dir={template.locale === "en" ? "ltr" : "rtl"} lang={template.locale}>
                {preview.subject && (
                  <div className="mb-3">
                    <p className="mb-1 text-xs font-medium text-slate">{copy.subject}</p>
                    <p className="font-medium text-navy">{preview.subject}</p>
                  </div>
                )}
                <p className="mb-1 text-xs font-medium text-slate">{copy.body}</p>
                <p className="whitespace-pre-wrap leading-7 text-navy">{preview.body}</p>
              </div>
              <details className="border-t border-border pt-3 text-xs text-slate">
                <summary className="cursor-pointer font-medium">{copy.source}</summary>
                <p className="mt-2 whitespace-pre-wrap">{template.body_template}</p>
              </details>
              <div className="text-xs text-slate">
                {copy.variables}:{" "}
                {template.required_variables.length > 0
                  ? template.required_variables.map((variable) => `{{${variable}}}`).join(", ")
                  : "—"}
              </div>
            </article>
          );
        })}
        {visible.length === 0 && (
          <div className="editorial-panel p-5 text-sm text-slate lg:col-span-2">
            {copy.noTemplates}
          </div>
        )}
      </div>
    </AdminSection>
  );
}

function TemplateFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <select
      aria-label={label}
      className="h-10 rounded-md border border-input bg-background px-3 text-sm text-navy"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{label}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
