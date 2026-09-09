import { EditorialImage } from "@/components/visual/EditorialImage";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Clock, ShieldCheck, XCircle } from "lucide-react";
import { buildAuthReturnToHref } from "@/lib/guest-auth-intent";
import { PublicShell } from "@/components/public/PublicShell";
import { MemberOutcomePanel } from "@/components/member/MemberOutcomePanel";
import { deriveMemberOutcome, type MemberOutcomeKind } from "@/lib/member-account-view-state";
import { t, useI18n } from "@/lib/i18n";
import { BidiValue } from "@/components/ui/bidi";

type PaymentResultStatus = "success" | "failed" | "cancelled" | "pending" | "missing";

type PaymentResultSearch = {
  status: PaymentResultStatus;
  paymentId?: string;
  audience?: "member" | "kids";
};

const RESULT_KIND: Record<PaymentResultStatus, MemberOutcomeKind> = {
  success: "payment-succeeded",
  pending: "payment-pending",
  cancelled: "payment-cancelled",
  failed: "payment-failed",
  missing: "payment-missing",
};

export const Route = createFileRoute("/payment-result")({
  validateSearch: (search): PaymentResultSearch => {
    const status = typeof search.status === "string" ? search.status : "pending";
    const safeStatus: PaymentResultStatus = [
      "success",
      "failed",
      "cancelled",
      "pending",
      "missing",
    ].includes(status)
      ? (status as PaymentResultStatus)
      : "pending";
    return {
      status: safeStatus,
      paymentId: typeof search.paymentId === "string" ? search.paymentId : undefined,
      audience: search.audience === "kids" ? "kids" : "member",
    };
  },
  component: PaymentResultPage,
});

function PaymentResultPage() {
  const { lang } = useI18n();
  const { status, paymentId, audience } = Route.useSearch();
  const outcome = deriveMemberOutcome({
    kind: RESULT_KIND[status],
    lang,
    body:
      audience === "kids" && status === "success"
        ? t("paymentResult.kidsSuccessBody")
        : status === "success"
          ? t("paymentResult.successBody")
          : status === "pending"
            ? t("paymentResult.pendingBody")
            : status === "cancelled"
              ? t("paymentResult.cancelledBody")
              : status === "failed"
                ? t("paymentResult.failedBody")
                : t("paymentResult.missingBody"),
  });
  const detail =
    audience === "kids" && status === "success"
      ? t("paymentResult.kidsSuccessDetail")
      : status === "success"
        ? t("paymentResult.successDetail")
        : status === "pending"
          ? t("paymentResult.pendingDetail")
          : status === "cancelled"
            ? t("paymentResult.cancelledDetail")
            : status === "failed"
              ? t("paymentResult.failedDetail")
              : t("paymentResult.missingDetail");
  const Icon =
    outcome.tone === "success"
      ? CheckCircle2
      : outcome.tone === "warning" || outcome.tone === "info"
        ? Clock
        : XCircle;
  const isSuccess = status === "success";
  const toneClass =
    outcome.tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 shadow-[0_0_0_9px_var(--cc-payment-success-ring)]"
      : outcome.tone === "warning" || outcome.tone === "info"
        ? "border-gold/40 bg-gold/10 text-gold shadow-[0_0_0_9px_var(--cc-alpha-gold-12)]"
        : "border-red-200 bg-red-50 text-red-600 shadow-[0_0_0_9px_var(--cc-payment-danger-ring)]";

  return (
    <PublicShell
      headerMode="compact"
      mainClassName="payment-result-page relative min-h-screen overflow-hidden bg-[var(--cc-payment-canvas)] px-5 py-[max(2.5rem,env(safe-area-inset-top))] text-navy"
    >
      <EditorialImage scene="fabric" className="payment-editorial-photo" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,var(--cc-alpha-white-92),var(--cc-alpha-paper-84)_44%,var(--cc-payment-surface-end)_100%)]" />
      <div className="pointer-events-none absolute inset-x-10 top-8 h-32 rounded-full bg-white/55 blur-3xl" />
      <section className="relative mx-auto flex min-h-[calc(100svh-5rem)] w-full max-w-md items-center">
        <div className="w-full rounded-[2rem] border border-white/80 bg-white/92 p-7 text-center shadow-[0_34px_92px_var(--cc-alpha-navy-16)] backdrop-blur-xl sm:p-8">
          <div className="mx-auto mb-6 flex flex-col items-center">
            <img
              src="/brand/cloud-core-wordmark.svg"
              alt="Cloud & Core"
              width={520}
              height={120}
              className="h-auto w-44 max-w-full"
            />
            <div className="mt-3 h-px w-24 bg-gradient-to-l from-transparent via-gold/70 to-transparent" />
          </div>

          <div
            className={`mx-auto flex h-[4.75rem] w-[4.75rem] items-center justify-center rounded-full border ${toneClass}`}
          >
            <Icon className="h-9 w-9" aria-hidden="true" />
          </div>

          <p className="member-eyebrow mt-7">Cloud &amp; Core Studio</p>
          <MemberOutcomePanel
            outcome={outcome}
            showAction={false}
            headingLevel="h1"
            className="mt-4 text-start"
          />

          <div className="mt-6 rounded-2xl border border-gold/20 bg-ivory/70 p-4 text-start">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-slate">{t("paymentResult.status")}</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-xs font-bold text-navy shadow-sm">
                <ShieldCheck className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
                {t("paymentResult.securedByHyp")}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate">{detail}</p>
            {paymentId && (
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-gold/20 pt-3 text-xs font-semibold text-slate">
                <span>{t("paymentResult.reference")}</span>
                <BidiValue kind="identifier" className="rounded-full bg-card px-3 py-1 text-navy">
                  {paymentId.slice(0, 8)}
                </BidiValue>
              </div>
            )}
          </div>

          <div className="mt-7 grid gap-3">
            <Link
              to={
                audience === "kids"
                  ? "/"
                  : isSuccess
                    ? buildAuthReturnToHref("/member/packages")
                    : "/auth"
              }
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-navy px-5 py-3 text-base font-semibold text-ivory shadow-[0_18px_38px_var(--cc-alpha-navy-22)] transition hover:bg-[var(--cc-palette-navy-900)]"
            >
              {audience === "kids"
                ? t("paymentResult.backToSite")
                : isSuccess
                  ? t("paymentResult.signInToPackage")
                  : t("paymentResult.backToSignIn")}
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              to="/member/schedule"
              className="inline-flex min-h-14 items-center justify-center rounded-full border border-gold/35 bg-card px-5 py-3 text-base font-semibold text-navy transition hover:border-gold/60 hover:bg-ivory"
            >
              {t("paymentResult.backToSchedule")}
            </Link>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
