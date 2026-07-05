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
  Empty,
  Field,
} from "@/components/admin-shared";
import { showApiError, showApiSuccess } from "@/lib/error-messages";
import { toast } from "sonner";
import { Plus, RotateCcw, CheckCircle2, FileText, X, XCircle } from "lucide-react";
import { labelForMethod, labelForStatus, t, useI18n } from "@/lib/i18n";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { getPlanDisplay } from "@/lib/planDisplay";

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

  const { data, isLoading } = useQuery({ queryKey: ["admin-payments"], queryFn: () => list({}) });
  const { data: summary } = useQuery({ queryKey: ["admin-revenue"], queryFn: () => sum() });
  const { data: members } = useQuery({ queryKey: ["admin-members"], queryFn: () => mem({}) });
  const plansFn = useServerFn(listPlans);
  const { data: plans } = useQuery({ queryKey: ["admin-plans"], queryFn: () => plansFn() });

  const [open, setOpen] = useState(false);
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
      showApiSuccess(t("payments.saved"));
      qc.invalidateQueries({ queryKey: ["admin-payments"] });
      qc.invalidateQueries({ queryKey: ["admin-revenue"] });
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
      setOpen(false);
      setForm({ member_id: "", plan_id: "", amount: 0, method: "cash", reference: "", notes: "" });
    },
    onError: (e) => showApiError(e, t("payments.saveError")),
  });

  const doRefund = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) =>
      refund({ data: { id, amount } }),
    onSuccess: () => {
      showApiSuccess(t("payments.refundSaved"));
      qc.invalidateQueries({ queryKey: ["admin-payments"] });
      qc.invalidateQueries({ queryKey: ["admin-revenue"] });
    },
    onError: (e) => showApiError(e, t("payments.refundError")),
  });

  const doConfirm = useMutation({
    mutationFn: (id: string) => confirmReceipt({ data: { payment_id: id } }),
    onSuccess: (r: any) => {
      if (r?.status === "already_confirmed")
        toast.info(t("payments.alreadyConfirmed", { receipt: r.receipt_number }));
      else
        showApiSuccess(
          t("payments.confirmed", { receipt: r?.receipt_number ?? t("status.issued") }),
        );
      qc.invalidateQueries({ queryKey: ["admin-payments"] });
      qc.invalidateQueries({ queryKey: ["admin-revenue"] });
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (e) => showApiError(e, t("payments.confirmError")),
  });

  const doCancel = useMutation({
    mutationFn: (id: string) => cancel({ data: { id } }),
    onSuccess: () => {
      showApiSuccess(t("payments.cancelled"));
      qc.invalidateQueries({ queryKey: ["admin-payments"] });
      qc.invalidateQueries({ queryKey: ["admin-revenue"] });
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (e) => showApiError(e, t("payments.cancelError")),
  });

  return (
    <AdminPageShell>
      <AdminPageHeader
        eyebrow={t("payments.title")}
        title={t("payments.title")}
        action={
          <button onClick={() => setOpen(true)} className="btn-navy hover:btn-navy-hover">
            <Plus className="h-3.5 w-3.5" /> {t("payments.record")}
          </button>
        }
      />

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <AdminMetricCard
          label={t("payments.month")}
          value={ils(summary?.monthRevenueIls ?? 0)}
          helper={t("payments.net")}
        />
        <AdminMetricCard
          label={t("payments.visible")}
          value={ils(totalShown)}
          helper={t("payments.records", { count: data?.length ?? 0 })}
        />
        <AdminMetricCard
          label={t("payments.outstanding")}
          value={summary?.outstandingCount ?? 0}
          helper={t("payments.pending")}
          accent={(summary?.outstandingCount ?? 0) > 0}
        />
      </section>

      {isLoading ? (
        <div className="editorial-panel py-12 text-center text-slate">{t("payments.loading")}</div>
      ) : (data ?? []).length === 0 ? (
        <Empty>{t("payments.empty")}</Empty>
      ) : (
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th className="text-start">{t("common.date")}</th>
                <th className="text-start">{t("common.member")}</th>
                <th className="text-start">{t("common.method")}</th>
                <th className="text-start">{t("common.plan")}</th>
                <th className="text-end">{t("common.amount")}</th>
                <th className="text-end">{t("common.status")}</th>
                <th className="text-end">{t("common.receipt")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(data as any[]).map((p) => {
                const receipt = Array.isArray(p.receipt) ? p.receipt[0] : p.receipt;
                const terminal = ["refunded", "partially_refunded", "failed", "cancelled"].includes(
                  p.status,
                );
                const canConfirm = !terminal && !receipt && Number(p.amount) > 0;
                return (
                  <tr key={p.id}>
                    <td className="text-slate whitespace-nowrap">
                      {new Date(p.created_at ?? p.paid_at).toLocaleDateString(locale)}
                    </td>
                    <td className="font-semibold">
                      {p.member?.name ? <bdi>{p.member.name}</bdi> : "—"}
                    </td>
                    <td className="text-xs font-medium text-slate">{labelForMethod(p.method)}</td>
                    <td className="text-slate">
                      {p.plan ? getPlanDisplay(p.plan, lang).name : "—"}
                    </td>
                    <td className="text-end numeric-display whitespace-nowrap">
                      {ils(Number(p.amount))}
                    </td>
                    <td className="text-end">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap ${STATUS_TONE[p.status] ?? "border-slate/30 text-slate"}`}
                      >
                        {labelForStatus(p.status)}
                      </span>
                    </td>
                    <td className="text-end">
                      {receipt ? (
                        <Link
                          to="/receipts/$id"
                          params={{ id: receipt.id }}
                          className="inline-flex max-w-[140px] items-center gap-1 truncate text-xs font-medium text-navy hover:text-gold"
                        >
                          <FileText className="h-3.5 w-3.5 shrink-0" />{" "}
                          <span dir="ltr" className="truncate inline-block">
                            {receipt.receipt_number}
                          </span>
                        </Link>
                      ) : (
                        <span className="text-xs text-slate/50">—</span>
                      )}
                    </td>
                    <td className="text-end whitespace-nowrap">
                      {canConfirm && (
                        <button
                          onClick={() => doConfirm.mutate(p.id)}
                          disabled={doConfirm.isPending}
                          className="btn-outline me-3 inline-flex items-center gap-1 px-2.5 py-1.5 text-xs hover:btn-outline-hover disabled:opacity-50"
                          title={t("payments.confirmTitle")}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />{" "}
                          {doConfirm.isPending && doConfirm.variables === p.id
                            ? t("payments.confirming")
                            : t("payments.confirmIssue")}
                        </button>
                      )}
                      {p.status === "pending" && (
                        <button
                          onClick={() => {
                            if (confirm(t("payments.cancelConfirm"))) doCancel.mutate(p.id);
                          }}
                          disabled={doCancel.isPending}
                          className="btn-ghost me-3 inline-flex items-center gap-1 px-0 text-xs text-slate hover:text-destructive disabled:opacity-50"
                          title={t("payments.cancelTitle")}
                        >
                          <XCircle className="h-3.5 w-3.5" />{" "}
                          {doCancel.isPending && doCancel.variables === p.id
                            ? t("payments.cancelling")
                            : t("common.cancel")}
                        </button>
                      )}
                      {p.status === "paid" && (
                        <button
                          onClick={() => {
                            const max = p.amount - p.refunded_amount;
                            const a = prompt(
                              t("payments.refundPrompt", { max: String(max) }),
                              String(max),
                            );
                            const n = Number(a);
                            if (a && !Number.isNaN(n) && n > 0)
                              doRefund.mutate({ id: p.id, amount: n });
                          }}
                          className="btn-ghost inline-flex items-center gap-1 px-0 text-xs hover:btn-ghost-hover"
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> {t("payments.refund")}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 bg-navy/40 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
            className="w-full max-h-[92vh] overflow-y-auto rounded-t-2xl border border-gold/30 bg-ivory p-6 shadow-[0_30px_60px_-28px_rgba(11,29,58,0.32)] md:max-w-lg md:rounded-2xl space-y-5"
          >
            <header className="flex items-center justify-between border-b border-gold/20 pb-4">
              <h3 className="font-display text-2xl">{t("payments.record")}</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn-ghost inline-flex h-9 w-9 items-center justify-center p-0 hover:btn-ghost-hover"
                aria-label={t("payments.close")}
              >
                <X className="h-4 w-4" />
              </button>
            </header>
            <Field label={t("common.member")}>
              <select
                required
                className="editorial-input"
                value={form.member_id}
                onChange={(e) => setForm({ ...form, member_id: e.target.value })}
              >
                <option value="">{t("payments.memberSelect")}</option>
                {(members ?? []).map((m: any) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("common.plan")}>
              <select
                className="editorial-input"
                value={form.plan_id}
                onChange={(e) => {
                  const planId = e.target.value;
                  const plan = (plans ?? []).find((p: any) => p.id === planId);
                  setForm({
                    ...form,
                    plan_id: planId,
                    amount: plan ? Number(plan.price_cents) / 100 : form.amount,
                  });
                }}
              >
                <option value="">{t("payments.noPlan")}</option>
                {(plans ?? [])
                  .filter((p: any) => p.active)
                  .map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {(p.price_cents / 100).toFixed(0)} {p.currency}
                    </option>
                  ))}
              </select>
            </Field>
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
