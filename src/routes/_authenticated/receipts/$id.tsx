import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getReceiptById } from "@/lib/receipts.functions";
import { getPublicStudioSettings } from "@/lib/studioSettings.functions";
import { friendlyErrorMessage } from "@/lib/error-messages";
import { ArrowLeft, Printer } from "lucide-react";
import { labelForMethod, labelForStatus, t, useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/receipts/$id")({
  head: () => ({ meta: [{ title: "קבלה — Cloud & Core" }] }),
  component: ReceiptPage,
  errorComponent: ({ error }) => (
    <div className="max-w-xl mx-auto p-6 space-y-2">
      <p className="font-display text-2xl text-navy">{t("receipt.unavailable")}</p>
      <p className="text-sm text-slate">
        {friendlyErrorMessage(error, t("receipt.unavailableBody"))}
      </p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="max-w-xl mx-auto p-6">
      <p className="font-display text-2xl text-navy">{t("receipt.notFound")}</p>
      <p className="text-sm text-slate mt-2">{t("receipt.notFoundBody")}</p>
    </div>
  ),
});

function ReceiptPage() {
  useI18n();
  const { id } = Route.useParams();
  const router = useRouter();
  const fetcher = useServerFn(getReceiptById);
  const settingsFn = useServerFn(getPublicStudioSettings);
  const { data, isLoading, error } = useQuery({
    queryKey: ["receipt", id],
    queryFn: () => fetcher({ data: { id } }),
  });
  const { data: settings } = useQuery({
    queryKey: ["public-studio-settings"],
    queryFn: () => settingsFn(),
  });

  if (isLoading) return <div className="p-8 text-slate">{t("receipt.loading")}</div>;
  if (error || !data) {
    return (
      <div className="max-w-xl mx-auto p-6 space-y-3">
        <p className="font-display text-2xl text-navy">{t("receipt.unavailable")}</p>
        <p className="text-sm text-slate">
          {friendlyErrorMessage(error, t("receipt.unavailableBody"))}
        </p>
        <button
          onClick={() => router.history.back()}
          className="text-xs uppercase tracking-[0.2em] text-slate hover:text-navy"
        >
          ← {t("common.back")}
        </button>
      </div>
    );
  }

  const r: any = data;
  const currency = r.currency || "ILS";
  const ils = (n: number) =>
    new Intl.NumberFormat("he-IL", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n);

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

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6 print:p-0 print:max-w-none">
      <style>{`
        @media print {
          @page { margin: 14mm; }
          body { background: #fff !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>

      <div className="flex items-center justify-between gap-3 print:hidden">
        <button
          onClick={() => router.history.back()}
          className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.2em] text-slate hover:text-navy"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {t("common.back")}
        </button>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 py-2 border border-gold text-[11px] uppercase tracking-[0.18em] rounded-[2px] hover:bg-gold hover:text-ivory transition-colors"
        >
          <Printer className="h-3.5 w-3.5" /> {t("common.print")}
        </button>
      </div>

      <article className="bg-ivory border border-gold/30 rounded-[4px] p-6 sm:p-8 md:p-12 space-y-7 print:border-0 print:p-0">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 sm:gap-6 border-b border-gold/30 pb-5">
          <div className="min-w-0">
            <p className="eyebrow text-[10px] text-gold">{t("receipt.paymentReceipt")}</p>
            <h1 className="font-display italic text-2xl sm:text-3xl md:text-4xl text-navy mt-1 truncate">
              {studioName}
            </h1>
            <div className="mt-2 text-[11px] text-slate space-y-0.5">
              {settings?.address && <p className="truncate">{settings.address}</p>}
              {(settings?.public_phone || settings?.whatsapp_number) && (
                <p>{settings.public_phone ?? settings.whatsapp_number}</p>
              )}
              {settings?.contact_email && <p className="truncate">{settings.contact_email}</p>}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] uppercase tracking-[0.22em] text-slate">
              {t("receipt.number")}
            </p>
            <p className="font-display text-lg sm:text-xl md:text-2xl text-navy mt-1 break-all">
              {r.receipt_number}
            </p>
            <p className="text-xs text-slate mt-2">
              {issuedAt ? issuedAt.toLocaleDateString() : "—"}
            </p>
            <p className="text-[10px] uppercase tracking-[0.18em] mt-2 text-navy/70">
              {labelForStatus(status)}
            </p>
          </div>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm">
          <div className="min-w-0">
            <p className="eyebrow text-[10px] text-slate/80">{t("receipt.issuedTo")}</p>
            <p className="text-navy mt-1.5 font-medium truncate">{memberName}</p>
          </div>
          <div className="min-w-0">
            <p className="eyebrow text-[10px] text-slate/80">{t("receipt.paymentMethod")}</p>
            <p className="text-navy mt-1.5 uppercase tracking-[0.1em] text-[12px]">{methodLabel}</p>
            {provider && (
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate mt-1">
                {t("receipt.via", { provider })}
              </p>
            )}
            {paidAt && !sameDay && (
              <p className="text-[11px] text-slate mt-1">
                {t("receipt.paidOn", { date: paidAt.toLocaleDateString() })}
              </p>
            )}
          </div>
        </section>

        <section className="border-t border-b border-gold/20 py-5">
          <div className="flex items-baseline justify-between gap-4">
            <div className="min-w-0">
              <p className="text-navy text-base sm:text-lg truncate">
                {r.plan_name_snapshot ?? t("receipt.studioPayment")}
              </p>
              {credits != null && (
                <p className="text-xs text-slate mt-1">
                  {credits >= 999
                    ? t("receipt.unlimitedGranted")
                    : t("receipt.creditsGranted", { count: credits })}
                </p>
              )}
              {r.payment?.reference && (
                <p className="text-xs text-slate mt-1 break-all">
                  {t("receipt.ref", { ref: r.payment.reference })}
                </p>
              )}
            </div>
            <p className="font-display text-2xl sm:text-3xl numeric-display text-navy whitespace-nowrap">
              {ils(Number(r.amount))}
            </p>
          </div>
        </section>

        <section className="flex items-center justify-between text-sm">
          <p className="eyebrow text-[10px] text-slate/80">{t("receipt.totalPaid")}</p>
          <p className="font-display text-xl sm:text-2xl numeric-display text-navy">
            {ils(Number(r.amount))}
          </p>
        </section>

        {r.footer_note && (
          <p className="text-xs text-slate leading-relaxed border-t border-gold/20 pt-4 whitespace-pre-wrap">
            {r.footer_note}
          </p>
        )}

        <p className="text-[10px] text-slate/70 leading-relaxed border-t border-gold/10 pt-4">
          {t("receipt.legalNote")}
        </p>
      </article>
    </div>
  );
}
