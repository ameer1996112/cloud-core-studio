import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, CreditCard, Pencil, Plus, X } from "lucide-react";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminMetricCard,
  AsyncState,
  Field,
  PersistentAnnouncement,
  ResponsiveDataList,
  type ResponsiveDataListColumn,
} from "@/components/admin-shared";
import { FieldMessage } from "@/components/ui/field-message";
import { listPlans, upsertPlan } from "@/lib/admin.functions";
import { useI18n, type Lang } from "@/lib/i18n";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { formatPlanPrice, getPlanDisplay } from "@/lib/planDisplay";
import { safeErrorMessage } from "@/lib/error-messages";
import { BidiValue } from "@/components/ui/bidi";

export const Route = createFileRoute("/_authenticated/admin/plans")({
  component: PlansPage,
});

type Plan = {
  id: string;
  name: string;
  description: string | null;
  credits: number;
  price_cents: number;
  currency: string;
  duration_days: number | null;
  active: boolean;
};

const emptyPlan = {
  name: "",
  description: "",
  credits: 4,
  price_cents: 28000,
  currency: "ILS",
  duration_days: 30,
  active: true,
};

function PlansPage() {
  const { lang, t } = useI18n();
  useDocumentTitle("page.plans.title");
  const listFn = useServerFn(listPlans);
  const saveFn = useServerFn(upsertPlan);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Plan | "new" | null>(null);
  const [outcome, setOutcome] = useState<{
    tone: "success" | "error";
    title: string;
    body?: string;
  } | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin-plans"],
    queryFn: () => listFn(),
  });

  const save = useMutation({
    mutationFn: (v: any) => saveFn({ data: v }),
    onSuccess: () => {
      setOutcome({ tone: "success", title: t("common.saved") });
      qc.invalidateQueries({ queryKey: ["admin-plans"] });
      setEditing(null);
    },
    onError: (saveError: unknown) =>
      setOutcome({
        tone: "error",
        title: t("admin.classes.failed"),
        body: safeErrorMessage(saveError, t("admin.classes.failed")),
      }),
  });

  const activePlans = (data ?? []).filter((p: Plan) => p.active);
  const totalCredits = activePlans.reduce((sum: number, p: Plan) => sum + (p.credits ?? 0), 0);
  const columns: ResponsiveDataListColumn<Plan>[] = [
    {
      id: "plan",
      label: t("common.plan"),
      cell: (plan) => (
        <PlanCard
          plan={plan}
          lang={lang}
          onEdit={() => {
            setOutcome(null);
            setEditing(plan);
          }}
        />
      ),
    },
    {
      id: "status",
      label: t("common.status"),
      cell: (plan) => (plan.active ? t("status.active") : t("status.inactive")),
    },
    {
      id: "credits",
      label: t("admin.plans.credits"),
      cell: (plan) => plan.credits,
    },
    {
      id: "duration",
      label: t("common.duration"),
      cell: (plan) => plan.duration_days ?? "—",
    },
    {
      id: "price",
      label: t("admin.plans.priceIls"),
      cell: (plan) => <BidiValue kind="currency">{formatPlanPrice(plan)}</BidiValue>,
    },
  ];

  return (
    <AdminPageShell>
      <AdminPageHeader
        title={t("nav.plans")}
        action={
          <button
            type="button"
            onClick={() => {
              setOutcome(null);
              setEditing("new");
            }}
            className="btn-navy hover:btn-navy-hover"
          >
            <Plus className="h-3.5 w-3.5" /> {t("admin.plans.add")}
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <AdminMetricCard label={t("admin.plans.activePackages")} value={activePlans.length} />
        <AdminMetricCard label={t("admin.plans.creditsAvailable")} value={totalCredits} />
        <AdminMetricCard label={t("admin.plans.visibleToMembers")} value={activePlans.length} />
      </div>

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
                    title: t("admin.plans.empty"),
                    body: t("admin.plans.empty"),
                  }
                : { status: "ready", data: (data ?? []) as Plan[] }
        }
      >
        {(plans) => (
          <ResponsiveDataList
            caption={t("nav.plans")}
            columns={columns}
            data={plans}
            getRowKey={(plan) => plan.id}
          />
        )}
      </AsyncState>

      {editing && (
        <PlanModal
          initial={editing === "new" ? null : editing}
          saving={save.isPending}
          onClose={() => setEditing(null)}
          onSave={(v) => save.mutate(v)}
          outcome={outcome}
        />
      )}
    </AdminPageShell>
  );
}

function PlanCard({ plan, lang, onEdit }: { plan: Plan; lang: Lang; onEdit: () => void }) {
  const { t } = useI18n();
  const display = getPlanDisplay(plan, lang);
  const price = formatPlanPrice(plan);

  return (
    <div className="editorial-card overflow-hidden hover:editorial-card-hover">
      <div className={`h-1 ${plan.active ? "bg-gold" : "bg-slate/30"}`} />
      <div className="p-5 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-xl text-navy leading-tight">{display.name}</p>
            <p className="text-sm text-slate mt-1.5">{display.description || plan.name}</p>
          </div>
          <button
            onClick={onEdit}
            aria-label={t("admin.plans.edit")}
            className="btn-ghost inline-flex h-11 w-11 shrink-0 items-center justify-center p-0 hover:btn-ghost-hover"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>

        <div>
          <p className="numeric-display text-4xl text-navy">
            <BidiValue kind="currency">{price}</BidiValue>
          </p>
          <p className="eyebrow text-slate mt-1">
            {plan.duration_days
              ? t("admin.plans.days", { count: plan.duration_days })
              : t("admin.plans.noExpiry")}
          </p>
        </div>

        <div className="space-y-2 border-t border-gold/20 pt-4 text-sm text-navy">
          <Benefit>{display.adminLine}</Benefit>
          <Benefit>{plan.active ? t("admin.plans.visible") : t("admin.plans.hidden")}</Benefit>
        </div>
      </div>
    </div>
  );
}

function Benefit({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2">
      <Check className="h-3.5 w-3.5 text-gold" /> {children}
    </p>
  );
}

function PlanModal({
  initial,
  saving,
  onClose,
  onSave,
  outcome,
}: {
  initial: Plan | null;
  saving: boolean;
  onClose: () => void;
  onSave: (v: any) => void;
  outcome: { tone: "success" | "error"; title: string; body?: string } | null;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState(() => ({
    ...emptyPlan,
    ...(initial ?? {}),
    description: initial?.description ?? "",
    duration_days: initial?.duration_days ?? null,
  }));

  const set = (patch: Partial<typeof form>) => setForm({ ...form, ...patch });
  const isCanonical = typeof form.description === "string" && form.description.startsWith("cloud_");

  return (
    <div className="fixed inset-0 z-50 bg-navy/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-3">
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-gold/30 bg-ivory p-7 shadow-[0_30px_60px_-30px_var(--cc-alpha-navy-30)] space-y-6">
        <div className="flex items-center justify-between border-b border-gold/30 pb-4">
          <div>
            <p className="eyebrow">{t("admin.plans.setup")}</p>
            <h3 className="font-display text-xl mt-1">
              {initial ? t("admin.plans.edit") : t("admin.plans.add")}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="btn-ghost inline-flex h-11 w-11 items-center justify-center p-0 hover:btn-ghost-hover"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-4">
          <Field label={t("admin.plans.internalName")}>
            <input
              className="editorial-input"
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
            />
          </Field>
          <Field label={isCanonical ? t("admin.plans.packageCode") : t("admin.plans.description")}>
            <input
              className="editorial-input"
              aria-describedby="plan-description-help"
              value={form.description ?? ""}
              readOnly={isCanonical}
              onChange={(e) => set({ description: e.target.value })}
            />
            <FieldMessage id="plan-description-help">
              {isCanonical
                ? t("admin.plans.internalCode", { code: form.description })
                : t("admin.plans.description")}
            </FieldMessage>
          </Field>
          <div className="grid sm:grid-cols-3 gap-3">
            <Field label={t("admin.plans.credits")}>
              <input
                type="number"
                className="editorial-input"
                value={form.credits}
                onChange={(e) => set({ credits: Number(e.target.value) })}
              />
            </Field>
            <Field label={t("admin.plans.priceIls")}>
              <input
                type="number"
                className="editorial-input"
                value={Math.round((form.price_cents ?? 0) / 100)}
                onChange={(e) => set({ price_cents: Number(e.target.value) * 100 })}
              />
            </Field>
            <Field label={t("calendar.day")}>
              <input
                type="number"
                className="editorial-input"
                value={form.duration_days ?? ""}
                placeholder={t("admin.plans.noExpiry")}
                onChange={(e) =>
                  set({ duration_days: e.target.value ? Number(e.target.value) : null })
                }
              />
            </Field>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-navy">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => set({ active: e.target.checked })}
            />
            {t("admin.plans.visible")}
          </label>
        </div>

        {outcome ? (
          <PersistentAnnouncement tone={outcome.tone} title={outcome.title}>
            {outcome.body ? <p>{outcome.body}</p> : null}
          </PersistentAnnouncement>
        ) : null}

        <div className="flex justify-end gap-2 border-t border-gold/30 pt-4">
          <button onClick={onClose} className="btn-outline hover:btn-outline-hover">
            {t("common.cancel")}
          </button>
          <button
            disabled={saving}
            onClick={() =>
              onSave({
                ...form,
                currency: "ILS",
                description: form.description || null,
                duration_days: form.duration_days || null,
              })
            }
            className="btn-navy hover:btn-navy-hover disabled:opacity-50"
          >
            <CreditCard className="h-3.5 w-3.5" /> {t("admin.plans.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
