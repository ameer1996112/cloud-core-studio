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
import { BidiValue } from "@/components/ui/bidi";
import { formatBidiValue } from "@/lib/bidi-format";
import { AsyncState } from "@/components/ui/async-state";
import { MemberOutcomePanel } from "@/components/member/MemberOutcomePanel";
import {
  deriveMemberOutcome,
  isExpiredMemberSession,
  memberRecoveryKind,
} from "@/lib/member-account-view-state";

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
  errorComponent: ReceiptRouteError,
  notFoundComponent: ReceiptNotFound,
});

function ReceiptRouteError({ error }: { error: Error }) {
  const { lang, dir } = useI18n();
  return (
    <div dir={dir} className="member-page max-w-xl mx-auto p-6">
      <MemberOutcomePanel
        outcome={deriveMemberOutcome({
          kind: "receipt-unavailable",
          lang,
          body: friendlyErrorMessage(error, t("receipt.unavailableBody")),
        })}
      />
    </div>
  );
}

function ReceiptNotFound() {
  const { lang, dir } = useI18n();
  return (
    <div dir={dir} className="member-page max-w-xl mx-auto p-6">
      <MemberOutcomePanel outcome={deriveMemberOutcome({ kind: "missing-receipt", lang })} />
    </div>
  );
}

function ReceiptPage() {
  const { lang, dir } = useI18n();
  useDocumentTitle("page.receipt.title");
  const { id } = Route.useParams();
  const router = useRouter();
  const fetcher = useServerFn(getReceiptById);
  const settingsFn = useServerFn(getPublicStudioSettings);
  const { data, isLoading, error, refetch } = useQuery({
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
      <div dir={dir} className="member-page mx-auto max-w-xl p-6">
        <AsyncState
          state={{ status: "loading", label: t("receipt.loading") }}
          className="member-card"
        />
      </div>
    );
  }
  if (error) {
    const recoveryKind = memberRecoveryKind({
      online: typeof navigator === "undefined" || navigator.onLine,
      sessionExpired: isExpiredMemberSession(error),
    });
    const kind = recoveryKind === "account-failed" ? "receipt-unavailable" : recoveryKind;
    return (
      <div dir={dir} className="member-page max-w-xl mx-auto p-6">
        <MemberOutcomePanel
          outcome={deriveMemberOutcome({
            kind,
            lang,
            body:
              kind === "receipt-unavailable"
                ? friendlyErrorMessage(error, t("receipt.unavailableBody"))
                : undefined,
            nextAction:
              kind === "receipt-unavailable" ? { label: t("common.retry"), href: "." } : undefined,
          })}
          onAction={kind === "expired-session" ? undefined : () => void refetch()}
        />
      </div>
    );
  }
  if (!data) {
    return (
      <div dir={dir} className="member-page max-w-xl mx-auto p-6">
        <MemberOutcomePanel outcome={deriveMemberOutcome({ kind: "missing-receipt", lang })} />
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
          body { background: var(--cc-surface-raised) !important; }
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

      <article className="member-card relative overflow-hidden bg-[var(--cc-surface-canvas)] p-0 shadow-[0_28px_70px_-42px_var(--cc-alpha-navy-45)] print:border-0 print:p-0 print:shadow-none">
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
                  <p className="break-words">
                    <BidiValue kind="phone" className="member-ltr-value">
                      {settings.public_phone ?? settings.whatsapp_number}
                    </BidiValue>
                  </p>
                )}
                {settings?.contact_email && (
                  <p className="break-all">
                    <BidiValue kind="email" className="member-ltr-value">
                      {settings.contact_email}
                    </BidiValue>
                  </p>
                )}
              </div>
            </div>

            <div className="min-w-0 rounded-2xl border border-gold/25 bg-ivory/80 p-4 shadow-[inset_0_1px_0_var(--cc-alpha-white-80)] sm:w-56 sm:shrink-0">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-slate">{t("receipt.number")}</p>
                <span className="rounded-full border border-navy/10 bg-navy/5 px-2.5 py-1 text-[0.68rem] font-semibold text-navy">
                  {labelForStatus(status)}
                </span>
              </div>
              <p className="mt-3 font-display text-2xl leading-tight text-navy break-all">
                <BidiValue kind="identifier">{r.receipt_number}</BidiValue>
              </p>
              <p className="mt-2 text-xs font-medium text-slate">
                <BidiValue kind="localized-date">{formatDate(issuedAt)}</BidiValue>
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
                {t("receipt.paidOn", {
                  date: formatBidiValue(formatDate(paidAt), "localized-date", dir),
                })}
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
                  <p className="mt-1 text-xs text-slate break-all">
                    {t("receipt.ref", {
                      ref: formatBidiValue(r.payment.reference, "identifier", dir),
                    })}
                  </p>
                )}
              </div>
              <p className="numeric-display font-display text-4xl leading-none text-navy sm:text-end">
                <BidiValue kind="currency">{formatAmount(Number(r.amount))}</BidiValue>
              </p>
            </div>
          </div>
        </section>

        <section className="mx-5 mb-5 flex items-end justify-between gap-4 rounded-[24px] border border-navy/10 bg-white/75 px-5 py-5 shadow-[0_18px_46px_-34px_var(--cc-alpha-navy-45)] sm:mx-8 sm:px-6 md:mx-10">
          <p className="text-xs font-semibold text-slate">{t("receipt.totalPaid")}</p>
          <p className="numeric-display font-display text-4xl leading-none text-navy whitespace-nowrap">
            <BidiValue kind="currency">{formatAmount(Number(r.amount))}</BidiValue>
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
