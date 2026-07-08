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

      <article className="member-card bg-ivory p-5 sm:p-8 md:p-12 space-y-7 print:border-0 print:p-0">
        <header className="grid grid-cols-1 gap-5 border-b border-gold/30 pb-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-6">
          <div className="min-w-0">
            <p className="eyebrow text-slate">{t("receipt.paymentReceipt")}</p>
            <h1 className="font-display text-2xl sm:text-3xl md:text-4xl text-navy mt-1 leading-tight break-words">
              {studioName}
            </h1>
            <div className="mt-2 space-y-0.5 text-xs text-slate">
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
          <div className="min-w-0 text-start sm:text-end sm:shrink-0">
            <p className="text-xs font-medium text-slate">{t("receipt.number")}</p>
            <p
              dir="ltr"
              className="font-display text-lg sm:text-xl md:text-2xl text-navy mt-1 break-words"
            >
              {r.receipt_number}
            </p>
            <p className="text-xs text-slate mt-2">
              <LtrInline>{formatDate(issuedAt)}</LtrInline>
            </p>
            <p className="mt-2 text-xs font-medium text-navy/70">{labelForStatus(status)}</p>
          </div>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm">
          <div className="min-w-0">
            <p className="eyebrow text-slate/80">{t("receipt.issuedTo")}</p>
            <p className="text-navy mt-1.5 font-medium truncate">{memberName}</p>
          </div>
          <div className="min-w-0">
            <p className="eyebrow text-slate/80">{t("receipt.paymentMethod")}</p>
            <p className="text-navy mt-1.5 text-sm font-medium">{methodLabel}</p>
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

        <section className="border-t border-b border-gold/20 py-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <p className="text-navy text-base sm:text-lg break-words">{planDisplayName}</p>
              {creditLine && <p className="text-xs text-slate mt-1">{creditLine}</p>}
              {r.payment?.reference && (
                <p dir="ltr" className="text-xs text-slate mt-1 break-all">
                  {t("receipt.ref", { ref: r.payment.reference })}
                </p>
              )}
            </div>
            <p className="font-display text-2xl sm:text-3xl numeric-display text-navy whitespace-nowrap sm:text-end">
              {formatAmount(Number(r.amount))}
            </p>
          </div>
        </section>

        <section className="flex items-center justify-between text-sm">
          <p className="eyebrow text-slate/80">{t("receipt.totalPaid")}</p>
          <p className="font-display text-xl sm:text-2xl numeric-display text-navy">
            {formatAmount(Number(r.amount))}
          </p>
        </section>

        {r.footer_note && (
          <p className="text-xs text-slate leading-relaxed border-t border-gold/20 pt-4 whitespace-pre-wrap">
            {r.footer_note}
          </p>
        )}

        <p className="border-t border-gold/10 pt-4 text-xs leading-relaxed text-slate/70">
          {t("receipt.legalNote")}
        </p>
      </article>
    </div>
  );
}
