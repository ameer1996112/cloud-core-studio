import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listProgramTypes, upsertProgramType, archiveProgramType } from "@/lib/admin.functions";
import { useState } from "react";
import { Plus, Pencil, RotateCcw, X } from "lucide-react";
import {
  AdminPageShell,
  AdminPageHeader,
  AsyncState,
  Field,
  PersistentAnnouncement,
  ResponsiveDataList,
  type ResponsiveDataListColumn,
} from "@/components/admin-shared";
import { AdminDestructiveAction } from "@/components/admin/AdminDestructiveAction";
import { useI18n } from "@/lib/i18n";
import { safeErrorMessage } from "@/lib/error-messages";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { bidiDirectionFor } from "@/lib/bidi-format";

export const Route = createFileRoute("/_authenticated/admin/programs")({
  component: Page,
});

type ProgramType = {
  id: string;
  slug: string;
  name_en: string;
  name_he: string;
  name_ar: string;
  description_en: string | null;
  description_he: string | null;
  description_ar: string | null;
  age_groups: string[];
  level: string | null;
  default_duration_minutes: number;
  default_capacity: number;
  default_credit_cost: number;
  equipment: string[];
  color_tag: string;
  cover_image_url: string | null;
  sort_order: number;
  active: boolean;
};

const emptyForm: Omit<ProgramType, "id"> & { id?: string } = {
  slug: "",
  name_en: "",
  name_he: "",
  name_ar: "",
  description_en: "",
  description_he: "",
  description_ar: "",
  age_groups: [],
  level: "all-levels",
  default_duration_minutes: 60,
  default_capacity: 12,
  default_credit_cost: 1,
  equipment: [],
  color_tag: "",
  cover_image_url: "",
  sort_order: 0,
  active: true,
};

function defaultProgramColor() {
  if (typeof document === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue("--color-gold").trim();
}

function Page() {
  const { lang, t } = useI18n();
  useDocumentTitle("page.programs.title");
  const listFn = useServerFn(listProgramTypes);
  const saveFn = useServerFn(upsertProgramType);
  const archiveFn = useServerFn(archiveProgramType);
  const qc = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin-program-types"],
    queryFn: () => listFn(),
  });
  const [editing, setEditing] = useState<ProgramType | "new" | null>(null);
  const [outcome, setOutcome] = useState<{
    tone: "success" | "error";
    title: string;
    body?: string;
  } | null>(null);

  const saveMut = useMutation({
    mutationFn: (v: any) => saveFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-program-types"] });
      setOutcome({ tone: "success", title: t("common.saved") });
      setEditing(null);
    },
    onError: (saveError: unknown) =>
      setOutcome({
        tone: "error",
        title: t("admin.classes.failed"),
        body: safeErrorMessage(saveError, t("admin.classes.failed")),
      }),
  });

  const archiveMut = useMutation({
    mutationFn: (v: { id: string; active: boolean }) => archiveFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-program-types"] });
      setOutcome({ tone: "success", title: t("admin.classes.updated") });
    },
    onError: (archiveError: unknown) =>
      setOutcome({
        tone: "error",
        title: t("admin.classes.failed"),
        body: safeErrorMessage(archiveError, t("admin.classes.failed")),
      }),
  });

  const columns: ResponsiveDataListColumn<ProgramType>[] = [
    {
      id: "program",
      label: t("admin.programs.title"),
      cell: (program) => (
        <ProgramCard
          program={program}
          lang={lang}
          onEdit={() => {
            setOutcome(null);
            setEditing(program);
          }}
          onToggle={() =>
            archiveMut
              .mutateAsync({ id: program.id, active: !program.active })
              .then(() => undefined)
          }
        />
      ),
    },
    {
      id: "status",
      label: t("common.status"),
      cell: (program) =>
        program.active ? t("admin.programs.active") : t("admin.programs.inactive"),
    },
    {
      id: "duration",
      label: t("admin.programs.duration"),
      cell: (program) => `${program.default_duration_minutes} ${t("common.minutes")}`,
    },
    {
      id: "capacity",
      label: t("admin.programs.capacity"),
      cell: (program) => program.default_capacity,
    },
    {
      id: "credits",
      label: t("admin.programs.creditCost"),
      cell: (program) => program.default_credit_cost,
    },
  ];

  return (
    <AdminPageShell>
      <AdminPageHeader
        eyebrow={t("admin.programs.catalog")}
        title={t("admin.programs.title")}
        description={t("admin.programs.description")}
        action={
          <button
            type="button"
            onClick={() => {
              setOutcome(null);
              setEditing("new");
            }}
            className="btn-navy hover:btn-navy-hover"
          >
            <Plus className="h-3.5 w-3.5" /> {t("admin.programs.add")}
          </button>
        }
      />

      {outcome && !editing ? (
        <PersistentAnnouncement tone={outcome.tone} title={outcome.title}>
          {outcome.body ? <p>{outcome.body}</p> : null}
        </PersistentAnnouncement>
      ) : null}

      <AsyncState
        state={
          isLoading
            ? { status: "loading", label: t("common.loading") }
            : isError
              ? {
                  status: "error",
                  title: t("admin.classes.failed"),
                  body: safeErrorMessage(error, t("admin.classes.failed")),
                  retry: () => void refetch(),
                }
              : (data?.length ?? 0) === 0
                ? {
                    status: "empty",
                    title: t("admin.noPrograms"),
                    body: t("admin.noPrograms"),
                  }
                : { status: "ready", data: (data ?? []) as ProgramType[] }
        }
      >
        {(programs) => (
          <ResponsiveDataList
            caption={t("admin.programs.catalog")}
            columns={columns}
            data={programs}
            getRowKey={(program) => program.id}
          />
        )}
      </AsyncState>

      {editing && (
        <ProgramModal
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(v) => saveMut.mutate(v)}
          saving={saveMut.isPending}
          outcome={outcome}
        />
      )}
    </AdminPageShell>
  );
}

function ProgramCard({
  program,
  lang,
  onEdit,
  onToggle,
}: {
  program: ProgramType;
  lang: "en" | "he" | "ar";
  onEdit: () => void;
  onToggle: () => Promise<void>;
}) {
  const { t } = useI18n();
  const display = getProgramDisplay(program, lang);
  const category = displayCategory(program.level, lang);

  return (
    <article className="group relative flex min-w-0 flex-col overflow-hidden editorial-card transition-all duration-200 hover:border-gold/40">
      <div className="h-1 bg-gold/50" />
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-gold/25 bg-ivory px-3 py-1 text-xs font-medium text-slate">
                {category}
              </span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  program.active
                    ? "border border-gold/40 bg-gold/10 text-navy"
                    : "border border-slate/20 bg-sand/40 text-slate"
                }`}
              >
                {program.active ? t("admin.programs.active") : t("admin.programs.inactive")}
              </span>
            </div>
            <h2 className="font-display text-2xl leading-tight text-navy">
              <bdi>{display.name}</bdi>
            </h2>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={onEdit}
              aria-label={t("admin.programs.edit")}
              title={t("admin.programs.edit")}
              className="btn-ghost inline-flex h-11 w-11 items-center justify-center p-0 hover:btn-ghost-hover"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </button>
            {program.active ? (
              <AdminDestructiveAction
                objectName={display.name}
                consequence={t("admin.programs.archiveConsequence")}
                confirmLabel={t("admin.programs.archive")}
                pendingLabel={t("common.saving")}
                failureMessage={t("admin.classes.failed")}
                onConfirm={onToggle}
                triggerClassName="btn-ghost min-h-11 px-3 text-xs"
              />
            ) : (
              <button
                type="button"
                onClick={() => void onToggle().catch(() => undefined)}
                aria-label={t("admin.programs.reactivate")}
                title={t("admin.programs.reactivate")}
                className="btn-ghost inline-flex h-11 w-11 items-center justify-center p-0 hover:btn-ghost-hover"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        <p className="mt-5 text-sm leading-7 text-slate">
          {display.description || t("admin.programs.noDescription")}
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ProgramMetric
            label={t("admin.programs.duration")}
            value={`${program.default_duration_minutes} ${t("common.minutes")}`}
          />
          <ProgramMetric
            label={t("admin.programs.credits")}
            value={formatCredits(program.default_credit_cost, lang, t)}
          />
        </div>
      </div>
    </article>
  );
}

function ProgramModal({
  initial,
  onClose,
  onSave,
  saving,
  outcome,
}: {
  initial: ProgramType | null;
  onClose: () => void;
  onSave: (v: any) => void;
  saving: boolean;
  outcome: { tone: "success" | "error"; title: string; body?: string } | null;
}) {
  const { t } = useI18n();
  const [f, setF] = useState<typeof emptyForm>(() => ({
    ...emptyForm,
    ...(initial ?? {}),
    color_tag: initial?.color_tag ?? defaultProgramColor(),
    description_en: initial?.description_en ?? "",
    description_he: initial?.description_he ?? "",
    description_ar: initial?.description_ar ?? "",
    cover_image_url: initial?.cover_image_url ?? "",
  }));

  const set = (patch: Partial<typeof f>) => setF({ ...f, ...patch });

  return (
    <div className="fixed inset-0 z-50 bg-navy/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-3">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-gold/30 bg-ivory p-7 shadow-[0_30px_60px_-30px_var(--cc-alpha-navy-30)] space-y-6">
        <div className="flex items-center justify-between border-b border-gold/30 pb-4">
          <h3 className="font-display text-xl">
            {initial ? t("admin.programs.edit") : t("admin.programs.add")}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="btn-ghost inline-flex h-11 w-11 items-center justify-center p-0 hover:btn-ghost-hover"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
          <Field label={t("admin.programs.slug")}>
            <input
              dir={bidiDirectionFor("identifier")}
              className="editorial-input"
              value={f.slug}
              onChange={(e) =>
                set({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-") })
              }
            />
          </Field>
          <Field label={t("admin.programs.color")}>
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="h-10 w-12 cursor-pointer rounded-xl border border-gold/30 bg-ivory"
                value={f.color_tag}
                onChange={(e) => set({ color_tag: e.target.value })}
              />
              <input
                className="editorial-input"
                value={f.color_tag}
                onChange={(e) => set({ color_tag: e.target.value })}
              />
            </div>
          </Field>
        </div>

        <div className="space-y-5">
          <p className="eyebrow">{t("admin.programs.names")}</p>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="English">
              <input
                className="editorial-input"
                value={f.name_en}
                onChange={(e) => set({ name_en: e.target.value })}
              />
            </Field>
            <Field label="עברית">
              <input
                className="editorial-input text-right"
                dir="rtl"
                value={f.name_he}
                onChange={(e) => set({ name_he: e.target.value })}
              />
            </Field>
            <Field label="العربية">
              <input
                className="editorial-input text-right"
                dir="rtl"
                value={f.name_ar}
                onChange={(e) => set({ name_ar: e.target.value })}
              />
            </Field>
          </div>
        </div>

        <div className="space-y-5">
          <p className="eyebrow">{t("admin.programs.descriptions")}</p>
          <Field label="English">
            <textarea
              className="editorial-input"
              rows={2}
              value={f.description_en ?? ""}
              onChange={(e) => set({ description_en: e.target.value })}
            />
          </Field>
          <Field label="עברית">
            <textarea
              className="editorial-input text-right"
              dir="rtl"
              rows={2}
              value={f.description_he ?? ""}
              onChange={(e) => set({ description_he: e.target.value })}
            />
          </Field>
          <Field label="العربية">
            <textarea
              className="editorial-input text-right"
              dir="rtl"
              rows={2}
              value={f.description_ar ?? ""}
              onChange={(e) => set({ description_ar: e.target.value })}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-5 md:grid-cols-4">
          <Field label={t("admin.programs.duration")}>
            <input
              type="number"
              className="editorial-input"
              value={f.default_duration_minutes}
              onChange={(e) => set({ default_duration_minutes: +e.target.value })}
            />
          </Field>
          <Field label={t("admin.programs.capacity")}>
            <input
              type="number"
              className="editorial-input"
              value={f.default_capacity}
              onChange={(e) => set({ default_capacity: +e.target.value })}
            />
          </Field>
          <Field label={t("admin.programs.creditCost")}>
            <input
              type="number"
              className="editorial-input"
              value={f.default_credit_cost}
              onChange={(e) => set({ default_credit_cost: +e.target.value })}
            />
          </Field>
          <Field label={t("admin.programs.sortOrder")}>
            <input
              type="number"
              className="editorial-input"
              value={f.sort_order}
              onChange={(e) => set({ sort_order: +e.target.value })}
            />
          </Field>
        </div>

        <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
          <Field label={t("admin.programs.level")}>
            <input
              className="editorial-input"
              placeholder={t("admin.programs.levelPlaceholder")}
              value={f.level ?? ""}
              onChange={(e) => set({ level: e.target.value })}
            />
          </Field>
          <Field label={t("admin.programs.ageGroups")}>
            <input
              className="editorial-input"
              placeholder={t("admin.programs.ageGroupsPlaceholder")}
              value={f.age_groups.join(", ")}
              onChange={(e) =>
                set({
                  age_groups: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
          </Field>
          <Field label={t("admin.programs.coverImage")}>
            <input
              dir={bidiDirectionFor("url")}
              className="editorial-input"
              value={f.cover_image_url ?? ""}
              onChange={(e) => set({ cover_image_url: e.target.value })}
            />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate">
          <input
            type="checkbox"
            className="accent-navy"
            checked={f.active}
            onChange={(e) => set({ active: e.target.checked })}
          />
          {t("admin.programs.activeVisible")}
        </label>

        {outcome ? (
          <PersistentAnnouncement tone={outcome.tone} title={outcome.title}>
            {outcome.body ? <p>{outcome.body}</p> : null}
          </PersistentAnnouncement>
        ) : null}

        <div className="flex justify-end gap-3 pt-2 border-t border-gold/25">
          <button onClick={onClose} className="btn-ghost hover:btn-ghost-hover">
            {t("common.cancel")}
          </button>
          <button
            disabled={saving || !f.slug || !f.name_en || !f.name_he || !f.name_ar}
            onClick={() =>
              onSave({
                ...f,
                description_en: f.description_en || null,
                description_he: f.description_he || null,
                description_ar: f.description_ar || null,
                cover_image_url: f.cover_image_url || null,
                level: f.level || null,
                equipment: f.equipment ?? [],
              })
            }
            className="btn-navy hover:btn-navy-hover disabled:opacity-50"
          >
            {saving ? t("common.saving") : t("admin.programs.save")}
          </button>
        </div>
      </div>
    </div>
  );
}

function getProgramDisplay(p: ProgramType, lang: "en" | "he" | "ar") {
  if (lang === "he") {
    return {
      name: p.name_he || p.name_en,
      description: p.description_he || p.description_en || "",
    };
  }
  if (lang === "ar") {
    return {
      name: p.name_ar || p.name_en,
      description: p.description_ar || p.description_en || "",
    };
  }
  return { name: p.name_en, description: p.description_en || "" };
}

function ProgramMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-metric-card">
      <p className="admin-metric-card__label">{label}</p>
      <p className="mt-1 font-display text-lg leading-tight text-navy">{value}</p>
    </div>
  );
}

function displayCategory(level: string | null, lang: "en" | "he" | "ar") {
  const normalized = String(level ?? "").toLowerCase();
  if (normalized.includes("aerial")) {
    return lang === "he" ? "אווירי / יוגה" : lang === "ar" ? "هوائي / يوغا" : "Aerial / Yoga";
  }
  if (normalized.includes("pilates")) {
    return lang === "he" ? "פילאטיס" : lang === "ar" ? "بيلاتيس" : "Pilates";
  }
  if (normalized.includes("beginner")) {
    return lang === "he" ? "מתחילים" : lang === "ar" ? "مبتدئات" : "Beginner";
  }
  if (normalized.includes("advanced")) {
    return lang === "he" ? "מתקדמים" : lang === "ar" ? "متقدم" : "Advanced";
  }
  return lang === "he" ? "כל הרמות" : lang === "ar" ? "كل المستويات" : "All levels";
}

function formatCredits(count: number, _lang: "en" | "he" | "ar", translate: any) {
  if (count === 1) return translate("admin.programs.oneCredit");
  return translate("admin.programs.creditShort", { count });
}
