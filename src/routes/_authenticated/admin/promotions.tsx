import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Archive, Eye, FlaskConical, Pause, Play, Plus, Save, Send } from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader, AdminPageShell, CardSkeleton } from "@/components/admin-shared";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import {
  getPromotionManager,
  previewPromotionAudience,
  savePromotionDraft,
  sendPromotionTest,
  transitionPromotion,
} from "@/lib/promotionManager.functions";
import { PROMOTION_CHANNELS, PROMOTION_LANGUAGES } from "@/lib/promotionCampaigns";
import { formatBidiValue } from "@/lib/bidi-format";

export const Route = createFileRoute("/_authenticated/admin/promotions")({ component: Page });

type Language = (typeof PROMOTION_LANGUAGES)[number];
type PromotionForm = ReturnType<typeof blankForm>;

const LANGUAGE_LABEL: Record<Language, string> = { he: "עברית", ar: "العربية", en: "English" };
const CHANNEL_LABEL = { in_app: "In-app", push: "iPhone push", whatsapp: "WhatsApp" };

function promotionShareUrl(slug: string, language: Language) {
  const url = new URL(`/promo/${slug}`, "https://cloudandcorestudio.com");
  url.searchParams.set("lang", language);
  url.searchParams.set("utm_source", "studio_share");
  url.searchParams.set("utm_medium", "promotion_link");
  url.searchParams.set("utm_campaign", slug);
  return url.toString();
}

function blankCopy() {
  return { eyebrow: "Cloud & Core", title: "", body: "", cta: "" };
}

function futureInput(days: number) {
  const value = new Date(Date.now() + days * 86_400_000);
  value.setSeconds(0, 0);
  return value.toISOString().slice(0, 16);
}

function blankForm() {
  return {
    promotionId: undefined as string | undefined,
    slug: "",
    name: "",
    promotionType: "announcement" as "announcement" | "free_class_credit",
    localizedContent: { he: blankCopy(), ar: blankCopy(), en: blankCopy() },
    actionUrl: "/member/schedule",
    audience: { kind: "all_marketing" as string, memberIds: undefined as string[] | undefined },
    channels: ["in_app"] as Array<(typeof PROMOTION_CHANNELS)[number]>,
    public: false,
    featured: true,
    priority: 50,
    claimLimit: 10,
    creditQuantity: 1,
    eligibleProgramTypeIds: [] as string[],
    startsAt: futureInput(1),
    endsAt: futureInput(8),
    creditExpiresAt: futureInput(22),
    whatsappTemplates: {
      he: { name: "", status: "pending" as const },
      ar: { name: "", status: "pending" as const },
      en: { name: "", status: "pending" as const },
    },
  };
}

function toInput(value: string | null | undefined) {
  return value ? new Date(value).toISOString().slice(0, 16) : "";
}

function formFromCampaign(campaign: any): PromotionForm {
  const fallback = blankForm();
  return {
    ...fallback,
    promotionId: campaign.id,
    slug: campaign.slug,
    name: campaign.name,
    promotionType: campaign.promotion_type,
    localizedContent: {
      he: { ...fallback.localizedContent.he, ...campaign.localized_content?.he },
      ar: { ...fallback.localizedContent.ar, ...campaign.localized_content?.ar },
      en: { ...fallback.localizedContent.en, ...campaign.localized_content?.en },
    },
    actionUrl: campaign.action_url,
    audience: campaign.audience ?? fallback.audience,
    channels: campaign.channels ?? fallback.channels,
    public: campaign.is_public,
    featured: campaign.is_featured,
    priority: campaign.priority,
    claimLimit: campaign.claim_limit,
    creditQuantity: campaign.credit_quantity,
    eligibleProgramTypeIds: campaign.eligibleProgramTypeIds ?? [],
    startsAt: toInput(campaign.starts_at),
    endsAt: toInput(campaign.ends_at),
    creditExpiresAt: toInput(campaign.credit_expires_at),
    whatsappTemplates: {
      he: { ...fallback.whatsappTemplates.he, ...campaign.whatsapp_templates?.he },
      ar: { ...fallback.whatsappTemplates.ar, ...campaign.whatsapp_templates?.ar },
      en: { ...fallback.whatsappTemplates.en, ...campaign.whatsapp_templates?.en },
    },
  };
}

function toIso(value: string) {
  return new Date(value).toISOString();
}

function Page() {
  useDocumentTitle("page.promotions.title");
  const getManager = useServerFn(getPromotionManager);
  const saveDraft = useServerFn(savePromotionDraft);
  const previewAudience = useServerFn(previewPromotionAudience);
  const sendTest = useServerFn(sendPromotionTest);
  const transition = useServerFn(transitionPromotion);
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "promotions"],
    queryFn: () => getManager(),
  });
  const [selectedId, setSelectedId] = useState<string | "new">("new");
  const [form, setForm] = useState<PromotionForm>(blankForm);
  const [testLanguage, setTestLanguage] = useState<Language>("he");

  useEffect(() => {
    if (selectedId === "new") return;
    const campaign = data?.campaigns?.find((item: any) => item.id === selectedId);
    if (campaign) setForm(formFromCampaign(campaign));
  }, [data?.campaigns, selectedId]);

  const selected = data?.campaigns?.find((item: any) => item.id === form.promotionId);
  const publishedLocked = Boolean(
    selected?.broadcast_dispatch_started_at ||
    selected?.broadcast_dispatched_at ||
    selected?.hasDeliveries,
  );
  const filteredScheduleUrl = `/member/schedule?program=${encodeURIComponent(
    (data?.programTypes ?? [])
      .filter((program: any) => form.eligibleProgramTypeIds.includes(program.id))
      .map((program: any) => program.slug)
      .join(","),
  )}`;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin", "promotions"] });
  const save = useMutation({
    mutationFn: () =>
      saveDraft({
        data: {
          ...form,
          startsAt: toIso(form.startsAt),
          endsAt: toIso(form.endsAt),
          creditExpiresAt:
            form.promotionType === "free_class_credit" ? toIso(form.creditExpiresAt) : null,
          whatsappTemplates: form.channels.includes("whatsapp") ? form.whatsappTemplates : null,
          audience: form.audience as any,
        },
      }),
    onSuccess: async (result) => {
      toast.success("Draft saved. Preview and test evidence was reset.");
      setSelectedId(result.promotionId);
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Save failed"),
  });
  const preview = useMutation({
    mutationFn: () => previewAudience({ data: { promotionId: form.promotionId! } }),
    onSuccess: async (result) => {
      toast.success(`Audience preview: ${result.eligibleCount} eligible members`);
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Preview failed"),
  });
  const testSend = useMutation({
    mutationFn: () =>
      sendTest({ data: { promotionId: form.promotionId!, language: testLanguage } }),
    onSuccess: async (result) => {
      toast.success(`Test delivered to ${result.sent} admin device(s)`);
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Test-send failed"),
  });
  const changeStatus = useMutation({
    mutationFn: (nextStatus: "scheduled" | "active" | "paused" | "archived") =>
      transition({ data: { promotionId: form.promotionId!, nextStatus } }),
    onSuccess: async (result) => {
      toast.success(`Campaign is ${result.nextStatus}`);
      await refresh();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Status change failed"),
  });

  const canOperate = Boolean(form.promotionId);
  const readiness = useMemo(
    () => [
      { label: "Audience preview", ready: Boolean(selected?.audience_previewed_at) },
      { label: "Test delivery", ready: Boolean(selected?.test_sent_at) },
      {
        label: "WhatsApp templates",
        ready:
          !form.channels.includes("whatsapp") ||
          PROMOTION_LANGUAGES.every(
            (language) => form.whatsappTemplates[language].status === "approved",
          ),
      },
    ],
    [form.channels, form.whatsappTemplates, selected],
  );

  if (isLoading || !data) return <CardSkeleton rows={6} />;

  return (
    <AdminPageShell className="space-y-6" dir="ltr">
      <AdminPageHeader
        eyebrow="Growth & retention"
        title="Promotions Manager"
        description="Create localized campaigns, verify the audience, test delivery, and activate only after every safety gate passes."
        action={
          <button
            type="button"
            className="btn-outline"
            onClick={() => {
              setSelectedId("new");
              setForm(blankForm());
            }}
          >
            <Plus className="h-4 w-4" /> New promotion
          </button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="settings-card self-start">
          <div className="settings-card-header">
            <h2 className="settings-card-title">Campaigns</h2>
          </div>
          <div className="settings-card-body space-y-2">
            {data.campaigns.map((campaign: any) => (
              <button
                key={campaign.id}
                type="button"
                onClick={() => setSelectedId(campaign.id)}
                className={`w-full rounded-xl border p-3 text-left ${
                  selectedId === campaign.id ? "border-gold bg-gold/10" : "border-gold/20"
                }`}
              >
                <span className="block font-semibold text-navy">{campaign.name}</span>
                <span className="mt-1 block text-xs uppercase tracking-wider text-slate">
                  {campaign.status} · {campaign.metrics.claims} claims
                </span>
              </button>
            ))}
          </div>
        </aside>

        <div className="space-y-6">
          <section className="settings-card">
            <header className="settings-card-header">
              <h2 className="settings-card-title">1. Campaign draft</h2>
              <p className="settings-card-helper">
                {publishedLocked
                  ? "Published campaigns are immutable. Use New promotion to create the next campaign."
                  : "Saving never activates or broadcasts."}
              </p>
            </header>
            <div className="settings-card-body space-y-5">
              <div className="grid gap-3 md:grid-cols-2">
                <Field
                  label="Internal name"
                  value={form.name}
                  onChange={(name) => setForm({ ...form, name })}
                />
                <Field
                  label="Slug"
                  value={form.slug}
                  onChange={(slug) => setForm({ ...form, slug })}
                />
                <SelectField
                  label="Promotion type"
                  value={form.promotionType}
                  onChange={(promotionType) =>
                    setForm({ ...form, promotionType: promotionType as any })
                  }
                  options={[
                    ["announcement", "Announcement / CTA"],
                    ["free_class_credit", "Limited free-class credit"],
                  ]}
                />
                <SelectField
                  label="Audience"
                  value={form.audience.kind}
                  onChange={(kind) => setForm({ ...form, audience: { kind } })}
                  options={[
                    ["all_marketing", "All active members"],
                    ["never_booked", "Never booked"],
                    ["no_upcoming", "No upcoming booking"],
                    ["inactive_14d", "Inactive for 14 days"],
                    ["low_credits", "Low credits"],
                    ["expiring_7d", "Package expires in 7 days"],
                    ["not_attended_program", "Has not attended promoted program"],
                    ["specific", "Specific member IDs"],
                  ]}
                />
              </div>

              {form.audience.kind === "specific" ? (
                <TextArea
                  label="Member IDs (comma or line separated)"
                  value={(form.audience.memberIds ?? []).join("\n")}
                  onChange={(value) =>
                    setForm({
                      ...form,
                      audience: {
                        kind: "specific",
                        memberIds: value
                          .split(/[\s,]+/)
                          .map((item) => item.trim())
                          .filter(Boolean),
                      },
                    })
                  }
                />
              ) : null}

              <div className="grid gap-4 lg:grid-cols-3">
                {PROMOTION_LANGUAGES.map((language) => (
                  <fieldset
                    key={language}
                    className="rounded-2xl border border-gold/20 p-4"
                    dir={language === "en" ? "ltr" : "rtl"}
                  >
                    <legend className="px-2 font-semibold text-navy">
                      {LANGUAGE_LABEL[language]}
                    </legend>
                    <div className="space-y-3">
                      <Field
                        label="Eyebrow"
                        value={form.localizedContent[language].eyebrow}
                        onChange={(eyebrow) => updateCopy(setForm, form, language, { eyebrow })}
                      />
                      <Field
                        label="Title"
                        value={form.localizedContent[language].title}
                        onChange={(title) => updateCopy(setForm, form, language, { title })}
                      />
                      <TextArea
                        label="Message"
                        value={form.localizedContent[language].body}
                        onChange={(body) => updateCopy(setForm, form, language, { body })}
                      />
                      <Field
                        label="CTA"
                        value={form.localizedContent[language].cta}
                        onChange={(cta) => updateCopy(setForm, form, language, { cta })}
                      />
                    </div>
                  </fieldset>
                ))}
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <DateField
                  label="Starts"
                  value={form.startsAt}
                  onChange={(startsAt) => setForm({ ...form, startsAt })}
                />
                <DateField
                  label="Ends"
                  value={form.endsAt}
                  onChange={(endsAt) => setForm({ ...form, endsAt })}
                />
                {form.promotionType === "free_class_credit" ? (
                  <DateField
                    label="Credit expires"
                    value={form.creditExpiresAt}
                    onChange={(creditExpiresAt) => setForm({ ...form, creditExpiresAt })}
                  />
                ) : null}
              </div>

              {form.promotionType === "free_class_credit" ? (
                <div className="settings-field">
                  <span className="settings-label">Filtered schedule destination</span>
                  <code className="settings-input block overflow-hidden text-ellipsis whitespace-nowrap text-xs">
                    {filteredScheduleUrl}
                  </code>
                </div>
              ) : (
                <Field
                  label="CTA destination"
                  value={form.actionUrl}
                  onChange={(actionUrl) => setForm({ ...form, actionUrl })}
                />
              )}
              <div>
                <p className="settings-label">Channels</p>
                <div className="mt-2 flex flex-wrap gap-3">
                  {PROMOTION_CHANNELS.map((channel) => (
                    <label key={channel} className="settings-toggle min-w-44">
                      <input
                        type="checkbox"
                        checked={form.channels.includes(channel)}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            channels: event.target.checked
                              ? [...form.channels, channel]
                              : form.channels.filter((item) => item !== channel),
                          })
                        }
                      />
                      <span className="settings-toggle-copy">
                        <span className="settings-toggle-label">{CHANNEL_LABEL[channel]}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {form.channels.includes("whatsapp") ? (
                <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
                  <p className="font-semibold text-navy">Approved Meta marketing templates</p>
                  <p className="mt-1 text-sm text-slate">
                    Status is verified from the production Meta deployment registry when you save.
                    Activation stays blocked until all three are approved.
                  </p>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    {PROMOTION_LANGUAGES.map((language) => (
                      <div key={language} className="space-y-2">
                        <Field
                          label={`${LANGUAGE_LABEL[language]} template`}
                          value={form.whatsappTemplates[language].name}
                          onChange={(name) =>
                            setForm({
                              ...form,
                              whatsappTemplates: {
                                ...form.whatsappTemplates,
                                [language]: {
                                  ...form.whatsappTemplates[language],
                                  name,
                                  status: "pending",
                                },
                              },
                            })
                          }
                        />
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate">
                          Meta status: {form.whatsappTemplates[language].status}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {form.promotionType === "free_class_credit" ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <Field
                    label="Claim cap"
                    type="number"
                    value={String(form.claimLimit)}
                    onChange={(claimLimit) => setForm({ ...form, claimLimit: Number(claimLimit) })}
                  />
                  <div>
                    <p className="settings-label">Eligible programs</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {data.programTypes.map((program: any) => (
                        <label
                          key={program.id}
                          className="flex items-center gap-2 rounded-xl border border-gold/20 p-3 text-sm text-navy"
                        >
                          <input
                            type="checkbox"
                            checked={form.eligibleProgramTypeIds.includes(program.id)}
                            onChange={(event) =>
                              setForm({
                                ...form,
                                eligibleProgramTypeIds: event.target.checked
                                  ? [...form.eligibleProgramTypeIds, program.id]
                                  : form.eligibleProgramTypeIds.filter((id) => id !== program.id),
                              })
                            }
                          />
                          {program.name_he} · {program.name_ar} · {program.name_en}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <button
                  className="settings-save-button"
                  type="button"
                  disabled={save.isPending || publishedLocked}
                  onClick={() => save.mutate()}
                >
                  <Save className="h-4 w-4" /> Save draft
                </button>
                <label className="settings-toggle">
                  <input
                    type="checkbox"
                    checked={form.public}
                    onChange={(event) => setForm({ ...form, public: event.target.checked })}
                  />
                  <span className="settings-toggle-copy">
                    <span className="settings-toggle-label">Public share page</span>
                  </span>
                </label>
                <label className="settings-toggle">
                  <input
                    type="checkbox"
                    checked={form.featured}
                    onChange={(event) => setForm({ ...form, featured: event.target.checked })}
                  />
                  <span className="settings-toggle-copy">
                    <span className="settings-toggle-label">Featured on Home</span>
                  </span>
                </label>
              </div>
              {form.public && form.slug ? (
                <div className="rounded-2xl border border-gold/20 bg-ivory/45 p-4">
                  <p className="settings-label">Localized public share links</p>
                  <p className="mt-1 text-xs text-slate">
                    Each link includes locale and campaign UTM attribution.
                  </p>
                  <div className="mt-3 grid gap-2">
                    {PROMOTION_LANGUAGES.map((language) => {
                      const shareUrl = formatBidiValue(
                        promotionShareUrl(
                          formatBidiValue(form.slug, "identifier").slice(1, -1),
                          language,
                        ),
                        "url",
                      );
                      return (
                        <div
                          key={language}
                          className="flex flex-col gap-2 rounded-xl border border-gold/15 bg-white p-3 sm:flex-row sm:items-center"
                        >
                          <span className="min-w-20 text-sm font-semibold text-navy">
                            {LANGUAGE_LABEL[language]}
                          </span>
                          <code className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-slate">
                            {shareUrl}
                          </code>
                          <button
                            type="button"
                            className="btn-outline"
                            onClick={() => {
                              void navigator.clipboard.writeText(shareUrl.slice(1, -1));
                              toast.success(`${LANGUAGE_LABEL[language]} link copied`);
                            }}
                          >
                            Copy link
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          <section className="settings-card">
            <header className="settings-card-header">
              <h2 className="settings-card-title">2. Verify and publish</h2>
              <p className="settings-card-helper">
                These are separate actions. Activation cannot run early.
              </p>
            </header>
            <div className="settings-card-body space-y-5">
              <div className="grid gap-3 sm:grid-cols-3">
                {readiness.map((item) => (
                  <StatusCard key={item.label} {...item} />
                ))}
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <button
                  type="button"
                  className="btn-outline"
                  disabled={!canOperate || preview.isPending}
                  onClick={() => preview.mutate()}
                >
                  <Eye className="h-4 w-4" /> Preview audience
                </button>
                <label className="settings-field max-w-40">
                  <span className="settings-label">Test language</span>
                  <select
                    className="settings-input"
                    value={testLanguage}
                    onChange={(event) => setTestLanguage(event.target.value as Language)}
                  >
                    {PROMOTION_LANGUAGES.map((language) => (
                      <option key={language} value={language}>
                        {LANGUAGE_LABEL[language]}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="btn-outline"
                  disabled={!canOperate || testSend.isPending}
                  onClick={() => testSend.mutate()}
                >
                  <FlaskConical className="h-4 w-4" /> Send test
                </button>
                <button
                  type="button"
                  className="btn-navy"
                  disabled={
                    !canOperate || !readiness.every((item) => item.ready) || changeStatus.isPending
                  }
                  onClick={() =>
                    changeStatus.mutate(
                      new Date(form.startsAt) > new Date() ? "scheduled" : "active",
                    )
                  }
                >
                  <Play className="h-4 w-4" /> Activate campaign
                </button>
              </div>
              {selected ? (
                <div className="flex flex-wrap gap-3 border-t border-gold/15 pt-4">
                  <span className="member-chip">Current: {selected.status}</span>
                  {selected.status === "active" || selected.status === "scheduled" ? (
                    <button
                      type="button"
                      className="btn-outline"
                      onClick={() => changeStatus.mutate("paused")}
                    >
                      <Pause className="h-4 w-4" /> Pause
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => changeStatus.mutate("archived")}
                  >
                    <Archive className="h-4 w-4" /> Archive
                  </button>
                </div>
              ) : null}
            </div>
          </section>

          {selected ? (
            <section className="settings-card">
              <header className="settings-card-header">
                <h2 className="settings-card-title">Performance</h2>
              </header>
              <div className="settings-card-body grid grid-cols-2 gap-3 sm:grid-cols-5">
                {Object.entries(selected.metrics).map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-gold/20 p-3">
                    <p className="text-xs uppercase tracking-wider text-slate">{label}</p>
                    <p className="mt-1 font-display text-2xl text-navy">{String(value)}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </AdminPageShell>
  );
}

function updateCopy(
  setForm: (value: PromotionForm) => void,
  form: PromotionForm,
  language: Language,
  patch: Partial<PromotionForm["localizedContent"][Language]>,
) {
  setForm({
    ...form,
    localizedContent: {
      ...form.localizedContent,
      [language]: { ...form.localizedContent[language], ...patch },
    },
  });
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="settings-field">
      <span className="settings-label">{label}</span>
      <input
        className="settings-input"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="settings-field">
      <span className="settings-label">{label}</span>
      <textarea
        className="settings-input min-h-24"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="settings-field">
      <span className="settings-label">{label}</span>
      <input
        className="settings-input"
        type="datetime-local"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[][];
}) {
  return (
    <label className="settings-field">
      <span className="settings-label">{label}</span>
      <select
        className="settings-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map(([option, copy]) => (
          <option key={option} value={option}>
            {copy}
          </option>
        ))}
      </select>
    </label>
  );
}
function StatusCard({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div
      className={`rounded-xl border p-3 ${ready ? "border-emerald-300 bg-emerald-50" : "border-amber-300 bg-amber-50"}`}
    >
      <p className="font-semibold text-navy">{label}</p>
      <p className="mt-1 text-xs text-slate">{ready ? "Ready" : "Required before activation"}</p>
    </div>
  );
}
