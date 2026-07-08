import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getReceiptById } from "@/lib/receipts.functions";
import { getPublicStudioSettings } from "@/lib/studioSettings.functions";
import { getPlanDisplay } from "@/lib/planDisplay";
import { friendlyErrorMessage } from "@/lib/error-messages";
import { ArrowLeft, Printer } from "lucide-react";
import { getLocale, labelForMethod, labelForStatus, t, useI18n } from "@/lib/i18n";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { LtrInline } from "@/components/ui/bidi";
import { MemberEmptyState } from "@/components/member/PremiumClassCard";

type ReceiptPlan = {
  name?: string | null;
  description?: string | null;
  credits?: number | null;
  duration_days?: number | null;
  price_cents?: number | null;
  currency?: string | null;
};

type ReceiptPayment = {
  method?: string | null;
  provider?: string | null;
  paid_at?: string | null;
  reference?: string | null;
  plan?: ReceiptPlan | null;
};

type ReceiptDetail = {
  receipt_number: string;
  amount: number | string;
  currency?: string | null;
  studio_name_snapshot?: string | null;
  member_name_snapshot?: string | null;
  method_snapshot?: string | null;
  issued_at?: string | null;
  status?: string | null;
  plan_name_snapshot?: string | null;
  footer_note?: string | null;
  payment?: ReceiptPayment | null;
};

export const Route = createFileRoute("/_authenticated/receipts/$id")({
  component: ReceiptPage,
  errorComponent: ({ error }) => (
    <div className="member-page max-w-xl mx-auto p-6">
      <MemberEmptyState
        variant="payments"
        title={t("receipt.unavailable")}
        body={friendlyErrorMessage(error, t("receipt.unavailableBody"))}
      />
    </div>
  ),
  notFoundComponent: () => (
    <div className="member-page max-w-xl mx-auto p-6">
      <MemberEmptyState
        variant="payments"
        title={t("receipt.notFound")}
        body={t("receipt.notFoundBody")}
      />
    </div>
  ),
});

function ReceiptPage() {
  const { lang, dir } = useI18n();
  useDocumentTitle("page.receipt.title");
  const { id } = Route.useParams();
  const router = useRouter();
  const fetcher = useServerFn(getReceiptById);
  const settingsFn = useServerFn(getPublicStudioSettings);
  const { data, isLoading, error } = useQuery({
    queryKey: ["receipt", id],
    queryFn: () => fetcher({ data: { id } }),
    retry: false,
  });
  const { data: settings } = useQuery({
    queryKey: ["public-studio-settings"],
    queryFn: () => settingsFn(),
  });

  if (isLoading) {
    return (
      <div dir={dir} className="member-page member-card mx-auto max-w-xl p-8 text-slate">
        {t("receipt.loading")}
      </div>
    );
  }
  if (!data) {
    return (
      <div dir={dir} className="member-page max-w-xl mx-auto p-6">
        <MemberEmptyState
          variant="payments"
          title={t("receipt.notFound")}
          body={t("receipt.notFoundBody")}
          primaryAction={{ label: t("common.back"), onClick: () => router.history.back() }}
        />
      </div>
    );
  }
  if (error) {
    return (
      <div dir={dir} className="member-page max-w-xl mx-auto p-6">
        <MemberEmptyState
          variant="payments"
          title={t("receipt.unavailable")}
          body={friendlyErrorMessage(error, t("receipt.unavailableBody"))}
          primaryAction={{ label: t("common.back"), onClick: () => router.history.back() }}
        />
      </div>
    );
  }

  const r = data as ReceiptDetail;
  const currency = r.currency || "ILS";
  const formatAmount = (n: number) => {
    if (currency === "ILS" && (lang === "he" || lang === "ar")) return `₪${Number(n).toFixed(0)}`;
    return new Intl.NumberFormat(getLocale(), {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n);
  };

  const studioName = r.studio_name_snapshot ?? settings?.studio_name ?? "Studio";
  const memberName = r.member_name_snapshot ?? "Member";
  const methodKey = (r.method_snapshot ?? r.payment?.method ?? "").toLowerCase();
  const methodLabel = labelForMethod(methodKey);
  const provider =
    r.payment?.provider && r.payment.provider !== "manual" ? r.payment.provider : null;
  const issuedAt = r.issued_at ? new Date(r.issued_at) : null;
  const paidAt = r.payment?.paid_at ? new Date(r.payment.paid_at) : null;
  const sameDay = issuedAt && paidAt && issuedAt.toDateString() === paidAt.toDateString();
  const credits = r.payment?.plan?.credits ?? null;
  const status = (r.status ?? "issued").toString();
  const planDisplayName = r.payment?.plan
    ? getPlanDisplay(r.payment.plan, lang).name
    : (r.plan_name_snapshot ?? t("receipt.studioPayment"));
  const locale = getLocale();
  const formatDate = (value: Date | null) => (value ? value.toLocaleDateString(locale) : "—");
  const creditLine =
    credits == null
      ? null
      : credits >= 999
        ? t("receipt.unlimitedGranted")
        : credits === 1
          ? t("receipt.creditGranted.one")
          : t("receipt.creditGranted.other", { count: credits });

  return (
    <div
      dir={dir}
      className="member-page member-receipt-shell max-w-2xl mx-auto p-4 pb-28 sm:p-6 sm:pb-10 space-y-6 print:p-0 print:max-w-none"
    >
      <style>{`
        @media print {
          @page { margin: 14mm; }
          body { background: #fff !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>

      <div className="flex items-center justify-between gap-3 print:hidden">
        <button onClick={() => router.history.back()} className="btn-ghost hover:btn-ghost-hover">
          <ArrowLeft className="h-3.5 w-3.5 directional-icon-back" /> {t("common.back")}
        </button>
        <button onClick={() => window.print()} className="btn-outline">
          <Printer className="h-3.5 w-3.5" /> {t("common.print")}
        </button>
      </div>

      <article className="member-card relative overflow-hidden bg-[#fffdf8] p-0 shadow-[0_28px_70px_-42px_rgba(11,29,58,0.45)] print:border-0 print:p-0 print:shadow-none">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-gold/25 via-navy to-gold/35" />

        <header className="px-5 pb-6 pt-7 sm:px-8 md:px-10">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="inline-flex rounded-full border border-gold/25 bg-white/70 px-3 py-1 text-xs font-semibold text-slate">
                {t("receipt.paymentReceipt")}
              </div>
              <div className="mt-4 flex items-center gap-3">
                <img
                  src="/brand/cloud-core-logo-full.png"
                  alt="Cloud & Core"
                  className="h-auto w-36 shrink-0 sm:w-44"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div className="mt-4 max-w-sm space-y-1 text-xs leading-5 text-slate">
                <p className="font-semibold text-navy break-words">{studioName}</p>
                {settings?.address && <p className="break-words">{settings.address}</p>}
                {(settings?.public_phone || settings?.whatsapp_number) && (
                  <p dir="ltr" className="member-ltr-value break-words">
                    {settings.public_phone ?? settings.whatsapp_number}
                  </p>
                )}
                {settings?.contact_email && (
                  <p dir="ltr" className="member-ltr-value break-all">
                    {settings.contact_email}
                  </p>
                )}
              </div>
            </div>

            <div className="min-w-0 rounded-2xl border border-gold/25 bg-ivory/80 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] sm:w-56 sm:shrink-0">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-slate">{t("receipt.number")}</p>
                <span className="rounded-full border border-navy/10 bg-navy/5 px-2.5 py-1 text-[0.68rem] font-semibold text-navy">
                  {labelForStatus(status)}
                </span>
              </div>
              <p dir="ltr" className="mt-3 font-display text-2xl leading-tight text-navy break-all">
                {r.receipt_number}
              </p>
              <p className="mt-2 text-xs font-medium text-slate">
                <LtrInline>{formatDate(issuedAt)}</LtrInline>
              </p>
            </div>
          </div>
        </header>

        <div className="mx-5 border-t border-gold/20 sm:mx-8 md:mx-10" />

        <section className="grid gap-3 px-5 py-5 text-sm sm:grid-cols-2 sm:px-8 md:px-10">
          <div className="min-w-0 rounded-2xl border border-gold/20 bg-white/55 p-4">
            <p className="eyebrow text-slate/80">{t("receipt.issuedTo")}</p>
            <p className="mt-2 text-base font-semibold text-navy break-words">{memberName}</p>
          </div>
          <div className="min-w-0 rounded-2xl border border-gold/20 bg-white/55 p-4">
            <p className="eyebrow text-slate/80">{t("receipt.paymentMethod")}</p>
            <p className="mt-2 text-base font-semibold text-navy">{methodLabel}</p>
            {provider && (
              <p className="mt-1 text-xs font-medium text-slate">
                {t("receipt.via", { provider })}
              </p>
            )}
            {paidAt && !sameDay && (
              <p className="mt-1 text-xs text-slate">
                {t("receipt.paidOn", { date: formatDate(paidAt) })}
              </p>
            )}
          </div>
        </section>

        <section className="px-5 pb-5 sm:px-8 md:px-10">
          <div className="rounded-[22px] border border-gold/25 bg-ivory/70 p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <p className="eyebrow text-slate/80">{t("receipt.studioPayment")}</p>
                <p className="mt-2 text-lg font-semibold leading-tight text-navy break-words">
                  {planDisplayName}
                </p>
                {creditLine && <p className="mt-1 text-xs text-slate">{creditLine}</p>}
                {r.payment?.reference && (
                  <p dir="ltr" className="mt-1 text-xs text-slate break-all">
                    {t("receipt.ref", { ref: r.payment.reference })}
                  </p>
                )}
              </div>
              <p className="numeric-display font-display text-4xl leading-none text-navy sm:text-end">
                {formatAmount(Number(r.amount))}
              </p>
            </div>
          </div>
        </section>

        <section className="mx-5 mb-5 rounded-[24px] bg-navy px-5 py-5 text-ivory shadow-[0_20px_45px_-30px_rgba(11,29,58,0.75)] sm:mx-8 sm:flex sm:items-center sm:justify-between sm:px-6 md:mx-10">
          <p className="text-xs font-semibold text-ivory/70">{t("receipt.totalPaid")}</p>
          <p className="numeric-display mt-2 font-display text-4xl leading-none sm:mt-0">
            {formatAmount(Number(r.amount))}
          </p>
        </section>

        <div className="space-y-4 px-5 pb-7 sm:px-8 md:px-10">
          {r.footer_note && (
            <div className="rounded-2xl border border-gold/20 bg-white/50 p-4 text-center">
              <p className="text-sm leading-relaxed text-slate whitespace-pre-wrap">
                {r.footer_note}
              </p>
            </div>
          )}

          <p className="border-t border-gold/10 pt-4 text-xs leading-relaxed text-slate/70">
            {t("receipt.legalNote")}
          </p>
        </div>
      </article>
    </div>
  );
}
