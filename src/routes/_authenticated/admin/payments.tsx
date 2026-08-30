import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  listPayments,
  upsertPayment,
  refundPayment,
  cancelPayment,
  revenueSummary,
} from "@/lib/payments.functions";
import { confirmPaymentAndIssueReceipt } from "@/lib/receipts.functions";
import { listMembers, listPlans } from "@/lib/admin.functions";
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
import { AdminDestructiveAction } from "@/components/admin/AdminDestructiveAction";
import {
  paymentAuxiliaryViewState,
  paymentRecordFailureState,
  paymentSummaryViewState,
} from "@/components/admin/payments-view-state";
import { Plus, CheckCircle2, FileText, X } from "lucide-react";
import { labelForMethod, labelForStatus, t, useI18n } from "@/lib/i18n";
import { safeErrorMessage } from "@/lib/error-messages";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { getPlanDisplay } from "@/lib/planDisplay";
import { BidiValue } from "@/components/ui/bidi";
import { bidiDirectionFor, formatBidiValue } from "@/lib/bidi-format";

const STATUS_TONE: Record<string, string> = {
  paid: "border-gold/50 bg-gold/10 text-navy",
  pending: "border-gold/40 bg-ivory text-navy",
  draft: "border-slate/30 bg-ivory text-slate",
  refunded: "border-slate/40 bg-sand/40 text-slate",
  partially_refunded: "border-slate/40 bg-sand/40 text-slate",
  failed: "border-slate/40 bg-sand/40 text-slate",
  cancelled: "border-slate/40 bg-sand/40 text-slate",
};
export const Route = createFileRoute("/_authenticated/admin/payments")({
  component: PaymentsPage,
});

function PaymentsPage() {
  const { lang, locale } = useI18n();
  useDocumentTitle("page.payments.title");
  const list = useServerFn(listPayments);
  const sum = useServerFn(revenueSummary);
  const mem = useServerFn(listMembers);
  const create = useServerFn(upsertPayment);
  const refund = useServerFn(refundPayment);
  const cancel = useServerFn(cancelPayment);
  const confirmReceipt = useServerFn(confirmPaymentAndIssueReceipt);
  const qc = useQueryClient();

  const ils = (n: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "ILS",
      maximumFractionDigits: 0,
    }).format(n);

  const paymentsQuery = useQuery({
    queryKey: ["admin-payments"],
    queryFn: () => list({}),
  });
  const summaryQuery = useQuery({ queryKey: ["admin-revenue"], queryFn: () => sum() });
  const membersQuery = useQuery({ queryKey: ["admin-members"], queryFn: () => mem({}) });
  const plansFn = useServerFn(listPlans);
  const plansQuery = useQuery({ queryKey: ["admin-plans"], queryFn: () => plansFn() });
  const { data, isLoading, isError, error, refetch } = paymentsQuery;

  const [open, setOpen] = useState(false);
  const [refundAmounts, setRefundAmounts] = useState<Record<string, string>>({});
  const [outcome, setOutcome] = useState<{
    tone: "success" | "error";
    title: string;
    body?: string;
  } | null>(null);
  const [form, setForm] = useState({
    member_id: "",
    plan_id: "" as string,
    amount: 0,
    method: "cash" as const,
    reference: "",
    notes: "",
  });

  const totalShown = useMemo(
    () =>
      (data ?? [])
        .filter((p: any) => p.status === "paid")
        .reduce((a: number, r: any) => a + Number(r.amount) - Number(r.refunded_amount ?? 0), 0),
    [data],
  );

  const save = useMutation({
    mutationFn: () =>
      create({
        data: { ...form, plan_id: form.plan_id || null, amount: Number(form.amount) } as any,
      }),
    onSuccess: () => {
      setOutcome({ tone: "success", title: t("payments.saved") });
      qc.invalidateQueries({ queryKey: ["admin-payments"] });
      qc.invalidateQueries({ queryKey: ["admin-revenue"] });
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
      setOpen(false);
      setForm({ member_id: "", plan_id: "", amount: 0, method: "cash", reference: "", notes: "" });
    },
    onError: (saveError) => {
      const failure = paymentRecordFailureState(saveError, t("payments.saveError"));
      setOpen(failure.open);
      setOutcome(failure.outcome);
    },
  });

  const doRefund = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) =>
      refund({ data: { id, amount } }),
    onSuccess: () => {
      setOutcome({ tone: "success", title: t("payments.refundSaved") });
      qc.invalidateQueries({ queryKey: ["admin-payments"] });
      qc.invalidateQueries({ queryKey: ["admin-revenue"] });
    },
    onError: (refundError) =>
      setOutcome({
        tone: "error",
        title: t("payments.refundError"),
        body: safeErrorMessage(refundError, t("payments.refundError")),
      }),
  });

  const doConfirm = useMutation({
    mutationFn: (id: string) => confirmReceipt({ data: { payment_id: id } }),
    onSuccess: (r: any) => {
      setOutcome({
        tone: "success",
        title:
          r?.status === "already_confirmed"
            ? t("payments.alreadyConfirmed", {
                receipt: formatBidiValue(r.receipt_number, "identifier"),
              })
            : t("payments.confirmed", {
                receipt: r?.receipt_number
                  ? formatBidiValue(r.receipt_number, "identifier")
                  : t("status.issued"),
              }),
      });
      qc.invalidateQueries({ queryKey: ["admin-payments"] });
      qc.invalidateQueries({ queryKey: ["admin-revenue"] });
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (confirmError) =>
      setOutcome({
        tone: "error",
        title: t("payments.confirmError"),
        body: safeErrorMessage(confirmError, t("payments.confirmError")),
      }),
  });

  const doCancel = useMutation({
    mutationFn: (id: string) => cancel({ data: { id } }),
    onSuccess: () => {
      setOutcome({ tone: "success", title: t("payments.cancelled") });
      qc.invalidateQueries({ queryKey: ["admin-payments"] });
      qc.invalidateQueries({ queryKey: ["admin-revenue"] });
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (cancelError) =>
      setOutcome({
        tone: "error",
        title: t("payments.cancelError"),
        body: safeErrorMessage(cancelError, t("payments.cancelError")),
      }),
  });

  const summaryState = paymentSummaryViewState({
    payments: paymentsQuery,
    summary: summaryQuery,
    retry: () => {
      void paymentsQuery.refetch();
      void summaryQuery.refetch();
    },
    loadingLabel: t("payments.loading"),
    errorTitle: t("payments.summaryLoadError"),
    errorBody: t("payments.summaryLoadError"),
  });
  const membersState = paymentAuxiliaryViewState({
    ...membersQuery,
    retry: () => void membersQuery.refetch(),
    loadingLabel: t("common.loading"),
    errorTitle: t("payments.membersLoadError"),
    errorBody: t("payments.membersLoadError"),
  });
  const plansState = paymentAuxiliaryViewState({
    ...plansQuery,
    retry: () => void plansQuery.refetch(),
    loadingLabel: t("common.loading"),
    errorTitle: t("payments.plansLoadError"),
    errorBody: t("payments.plansLoadError"),
  });

  const columns: ResponsiveDataListColumn<NonNullable<typeof data>[number]>[] = [
    {
      id: "date",
      label: t("common.date"),
      cell: (payment) => (
        <span className="whitespace-nowrap text-slate">
          <BidiValue kind="localized-date">
            {new Date(payment.created_at ?? payment.paid_at).toLocaleDateString(locale)}
          </BidiValue>
        </span>
      ),
    },
    {
      id: "member",
      label: t("common.member"),
      cell: (payment) => (
        <span className="font-semibold">
          {payment.member?.name ? <bdi>{payment.member.name}</bdi> : "—"}
        </span>
      ),
    },
    {
      id: "details",
      label: t("common.method"),
      cell: (payment) => (
        <span className="text-xs font-medium text-slate">
          {labelForMethod(payment.method)} ·{" "}
          {payment.plan ? getPlanDisplay(payment.plan, lang).name : t("payments.noPlan")}
        </span>
      ),
    },
    {
      id: "amount",
      label: t("common.amount"),
      cell: (payment) => (
        <BidiValue kind="currency" className="numeric-display whitespace-nowrap">
          {ils(Number(payment.amount))}
        </BidiValue>
      ),
    },
    {
      id: "status",
      label: t("common.status"),
      cell: (payment) => (
        <span
          className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_TONE[payment.status] ?? "border-slate/30 text-slate"}`}
        >
          {labelForStatus(payment.status)}
        </span>
      ),
    },
    {
      id: "receipt",
      label: t("common.receipt"),
      cell: (payment) => {
        const receipt = Array.isArray(payment.receipt) ? payment.receipt[0] : payment.receipt;
        return receipt ? (
          <Link
            to="/receipts/$id"
            params={{ id: receipt.id }}
            className="inline-flex max-w-[140px] items-center gap-1 text-xs font-medium text-navy hover:text-gold"
          >
            <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <BidiValue kind="identifier" className="truncate">
              {receipt.receipt_number}
            </BidiValue>
          </Link>
        ) : (
          <span className="text-xs text-slate/50">—</span>
        );
      },
    },
    {
      id: "actions",
      label: t("common.status"),
      cell: (payment) => {
        const receipt = Array.isArray(payment.receipt) ? payment.receipt[0] : payment.receipt;
        const terminal = ["refunded", "partially_refunded", "failed", "cancelled"].includes(
          payment.status,
        );
        const canConfirm = !terminal && !receipt && Number(payment.amount) > 0;
        const maxRefund = Number(payment.amount) - Number(payment.refunded_amount ?? 0);
        const refundValue = refundAmounts[payment.id] ?? String(maxRefund);
        return (
          <div className="flex min-w-0 flex-wrap gap-2">
            {canConfirm ? (
              <button
                type="button"
                onClick={() => doConfirm.mutate(payment.id)}
                disabled={doConfirm.isPending}
                className="btn-outline inline-flex min-h-11 items-center gap-2 px-3 text-xs disabled:opacity-50"
                title={t("payments.confirmTitle")}
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                {doConfirm.isPending && doConfirm.variables === payment.id
                  ? t("payments.confirming")
                  : t("payments.confirmIssue")}
              </button>
            ) : null}
            {payment.status === "pending" ? (
              <AdminDestructiveAction
                objectName={payment.member?.name ?? t("payments.title")}
                consequence={t("payments.cancelConfirm")}
                confirmLabel={t("common.cancel")}
                pendingLabel={t("payments.cancelling")}
                failureMessage={t("payments.cancelError")}
                onConfirm={() => doCancel.mutateAsync(payment.id).then(() => undefined)}
                triggerClassName="btn-ghost inline-flex min-h-11 items-center gap-2 px-3 text-xs text-destructive"
              />
            ) : null}
            {payment.status === "paid" && maxRefund > 0 ? (
              <AdminDestructiveAction
                objectName={payment.member?.name ?? t("payments.title")}
                consequence={t("payments.refundPrompt", { max: String(maxRefund) })}
                confirmLabel={t("payments.refund")}
                pendingLabel={t("common.saving")}
                failureMessage={t("payments.refundError")}
                confirmDisabled={
                  !Number.isFinite(Number(refundValue)) ||
                  Number(refundValue) <= 0 ||
                  Number(refundValue) > maxRefund
                }
                onConfirm={() =>
                  doRefund
                    .mutateAsync({ id: payment.id, amount: Number(refundValue) })
                    .then(() => undefined)
                }
                triggerClassName="btn-ghost inline-flex min-h-11 items-center gap-2 px-3 text-xs"
              >
                <label className="block text-start">
                  <span className="field-label">
                    {t("payments.refundPrompt", { max: String(maxRefund) })}
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={maxRefund}
                    value={refundValue}
                    onChange={(event) =>
                      setRefundAmounts((current) => ({
                        ...current,
                        [payment.id]: event.target.value,
                      }))
                    }
                    className="editorial-input"
                  />
                </label>
              </AdminDestructiveAction>
            ) : null}
          </div>
        );
      },
    },
  ];

  return (
    <AdminPageShell>
      <AdminPageHeader
        eyebrow={t("payments.title")}
        title={t("payments.title")}
        action={
          <button
            onClick={() => {
              setOutcome(null);
              setOpen(true);
            }}
            className="btn-navy hover:btn-navy-hover"
          >
            <Plus className="h-3.5 w-3.5" /> {t("payments.record")}
          </button>
        }
      />

      <AsyncState state={summaryState}>
        {({ payments, summary }) => (
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <AdminMetricCard
              label={t("payments.month")}
              value={<BidiValue kind="currency">{ils(summary.monthRevenueIls)}</BidiValue>}
              helper={t("payments.net")}
            />
            <AdminMetricCard
              label={t("payments.visible")}
              value={<BidiValue kind="currency">{ils(totalShown)}</BidiValue>}
              helper={t("payments.records", { count: payments.length })}
            />
            <AdminMetricCard
              label={t("payments.outstanding")}
              value={summary.outstandingCount}
              helper={t("payments.pending")}
              accent={summary.outstandingCount > 0}
            />
          </section>
        )}
      </AsyncState>

      {outcome ? (
        <PersistentAnnouncement tone={outcome.tone} title={outcome.title}>
          {outcome.body ? <p>{outcome.body}</p> : null}
        </PersistentAnnouncement>
      ) : null}

      <AsyncState
        state={
          isLoading
            ? { status: "loading", label: t("payments.loading") }
            : isError
              ? {
                  status: "error",
                  title: t("payments.saveError"),
                  body: safeErrorMessage(error, t("payments.saveError")),
                  retry: () => void refetch(),
                }
              : (data?.length ?? 0) === 0
                ? { status: "empty", title: t("payments.empty"), body: t("payments.empty") }
                : { status: "ready", data: data ?? [] }
        }
      >
        {(payments) => (
          <ResponsiveDataList
            caption={t("payments.title")}
            columns={columns}
            data={payments}
            getRowKey={(payment) => payment.id}
          />
        )}
      </AsyncState>

      {open && (
        <div className="fixed inset-0 z-50 bg-navy/40 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
            className="w-full max-h-[92vh] overflow-y-auto rounded-t-2xl border border-gold/30 bg-ivory p-6 shadow-[0_30px_60px_-28px_var(--cc-alpha-navy-32)] md:max-w-lg md:rounded-2xl space-y-5"
          >
            <header className="flex items-center justify-between border-b border-gold/20 pb-4">
              <h3 className="font-display text-2xl">{t("payments.record")}</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn-ghost inline-flex h-11 w-11 items-center justify-center p-0 hover:btn-ghost-hover"
                aria-label={t("payments.close")}
              >
                <X className="h-4 w-4" />
              </button>
            </header>
            <PaymentRecordFailureAnnouncement outcome={outcome} />
            <AsyncState state={membersState}>
              {(members) => (
                <Field label={t("common.member")}>
                  <select
                    required
                    className="editorial-input"
                    value={form.member_id}
                    onChange={(e) => setForm({ ...form, member_id: e.target.value })}
                  >
                    <option value="">{t("payments.memberSelect")}</option>
                    {members.map((m: any) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </AsyncState>
            <AsyncState state={plansState}>
              {(plans) => (
                <Field label={t("common.plan")}>
                  <select
                    className="editorial-input"
                    value={form.plan_id}
                    onChange={(e) => {
                      const planId = e.target.value;
                      const plan = plans.find((p: any) => p.id === planId);
                      setForm({
                        ...form,
                        plan_id: planId,
                        amount: plan ? Number(plan.price_cents) / 100 : form.amount,
                      });
                    }}
                  >
                    <option value="">{t("payments.noPlan")}</option>
                    {plans
                      .filter((p: any) => p.active)
                      .map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ·{" "}
                          {formatBidiValue(
                            `${(p.price_cents / 100).toFixed(0)} ${p.currency}`,
                            "currency",
                          )}
                        </option>
                      ))}
                  </select>
                </Field>
              )}
            </AsyncState>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t("payments.amountIls")}>
                <input
                  type="number"
                  min={0}
                  step="1"
                  required
                  className="editorial-input"
                  value={form.amount || ""}
                  onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                />
              </Field>
              <Field label={t("common.method")}>
                <select
                  className="editorial-input"
                  value={form.method}
                  onChange={(e) => setForm({ ...form, method: e.target.value as any })}
                >
                  <option value="cash">{t("method.cash")}</option>
                  <option value="bit">Bit</option>
                  <option value="transfer">{t("method.transfer")}</option>
                  <option value="other">{t("method.other")}</option>
                </select>
              </Field>
            </div>
            <Field label={t("payments.reference")}>
              <input
                dir={bidiDirectionFor("identifier")}
                className="editorial-input"
                value={form.reference}
                onChange={(e) => setForm({ ...form, reference: e.target.value })}
                placeholder={t("payments.referencePlaceholder")}
              />
            </Field>
            <Field label={t("payments.notes")}>
              <textarea
                className="editorial-input min-h-20"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-gold/20">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn-ghost hover:btn-ghost-hover"
              >
                {t("common.cancel")}
              </button>
              <button
                type="submit"
                disabled={save.isPending || !form.member_id || !form.amount}
                className="btn-navy hover:btn-navy-hover disabled:opacity-60"
              >
                {save.isPending ? t("common.saving") : t("payments.recordShort")}
              </button>
            </div>
          </form>
        </div>
      )}
    </AdminPageShell>
  );
}

export function PaymentRecordFailureAnnouncement({
  outcome,
}: {
  outcome: { tone: "success" | "error"; title: string; body?: string } | null;
}) {
  if (outcome?.tone !== "error") return null;
  return (
    <PersistentAnnouncement tone="error" title={outcome.title}>
      {outcome.body ? <p>{outcome.body}</p> : null}
    </PersistentAnnouncement>
  );
}
