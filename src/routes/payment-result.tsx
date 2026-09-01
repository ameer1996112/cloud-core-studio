import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Clock, ShieldCheck, XCircle } from "lucide-react";
import { buildAuthReturnToHref } from "@/lib/guest-auth-intent";
import { t, useI18n } from "@/lib/i18n";

type PaymentResultStatus = "success" | "failed" | "cancelled" | "pending" | "missing";

type PaymentResultSearch = {
  status: PaymentResultStatus;
  paymentId?: string;
  audience?: "member" | "kids";
};

type PaymentCopy = {
  title: string;
  body: string;
  detail: string;
  tone: "success" | "warning" | "error";
};

const PAYMENT_RESULT_KEYS = {
  success: {
    title: "paymentResult.success.title",
    body: "paymentResult.success.body",
    detail: "paymentResult.success.detail",
    tone: "success",
  },
  pending: {
    title: "paymentResult.pending.title",
    body: "paymentResult.pending.body",
    detail: "paymentResult.pending.detail",
    tone: "warning",
  },
  cancelled: {
    title: "paymentResult.cancelled.title",
    body: "paymentResult.cancelled.body",
    detail: "paymentResult.cancelled.detail",
    tone: "error",
  },
  failed: {
    title: "paymentResult.failed.title",
    body: "paymentResult.failed.body",
    detail: "paymentResult.failed.detail",
    tone: "error",
  },
  missing: {
    title: "paymentResult.missing.title",
    body: "paymentResult.missing.body",
    detail: "paymentResult.missing.detail",
    tone: "warning",
  },
} as const;

function paymentResultCopy(status: PaymentResultStatus): PaymentCopy {
  const keys = PAYMENT_RESULT_KEYS[status];
  return {
    title: t(keys.title),
    body: t(keys.body),
    detail: t(keys.detail),
    tone: keys.tone,
  };
}

function kidsPaymentSuccessCopy(): PaymentCopy {
  return {
    title: t("paymentResult.success.title"),
    body: t("paymentResult.kidsSuccess.body"),
    detail: t("paymentResult.kidsSuccess.detail"),
    tone: "success",
  };
}

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
  const { status, paymentId, audience } = Route.useSearch();
  const { dir } = useI18n();
  const copy =
    audience === "kids" && status === "success"
      ? kidsPaymentSuccessCopy()
      : paymentResultCopy(status);
  const Icon = copy.tone === "success" ? CheckCircle2 : copy.tone === "warning" ? Clock : XCircle;
  const isSuccess = status === "success";
  const toneClass =
    copy.tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 shadow-[0_0_0_9px_rgba(209,250,229,0.64)]"
      : copy.tone === "warning"
        ? "border-gold/40 bg-gold/10 text-gold shadow-[0_0_0_9px_rgba(212,175,106,0.12)]"
        : "border-red-200 bg-red-50 text-red-600 shadow-[0_0_0_9px_rgba(254,226,226,0.7)]";

  return (
    <main
      id="main-content"
      dir={dir}
      className="relative min-h-screen overflow-hidden bg-[#f7f1e8] px-5 py-[max(2.5rem,env(safe-area-inset-top))] text-navy"
    >
      <img
        src="/images/auth/cloud-core-auth-hero.webp"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.13] blur-[1px] saturate-[0.85]"
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.92),rgba(255,253,249,0.84)_44%,rgba(244,238,228,0.92)_100%)]" />
      <div className="pointer-events-none absolute inset-x-10 top-8 h-32 rounded-full bg-white/55 blur-3xl" />
      <section className="relative mx-auto flex min-h-[calc(100svh-5rem)] w-full max-w-md items-center">
        <div className="w-full rounded-[2rem] border border-white/80 bg-white/92 p-7 text-center shadow-[0_34px_92px_rgba(11,29,58,0.16)] backdrop-blur-xl sm:p-8">
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
          <h1 className="font-display mt-3 text-[clamp(2.55rem,12vw,4rem)] font-semibold leading-[0.95] text-navy">
            {copy.title}
          </h1>
          <p className="mx-auto mt-5 max-w-[19rem] text-[1.05rem] font-medium leading-8 text-slate">
            {copy.body}
          </p>

          <div className="mt-6 rounded-2xl border border-gold/20 bg-ivory/70 p-4 text-start">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-slate">{t("paymentResult.status")}</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold text-navy shadow-sm">
                <ShieldCheck className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
                {t("paymentResult.secure")}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate/90">{copy.detail}</p>
            {paymentId && (
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-gold/20 pt-3 text-xs font-semibold text-slate">
                <span>{t("paymentResult.reference")}</span>
                <span dir="ltr" className="rounded-full bg-white px-3 py-1 text-navy">
                  {paymentId.slice(0, 8)}
                </span>
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
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-navy px-5 py-3 text-base font-semibold text-ivory shadow-[0_18px_38px_rgba(11,29,58,0.22)] transition hover:bg-[#10274c]"
            >
              {audience === "kids"
                ? t("paymentResult.backToSite")
                : isSuccess
                  ? t("paymentResult.viewPackage")
                  : t("paymentResult.backToSignIn")}
              <ArrowLeft className="h-4 w-4 directional-icon-back" aria-hidden="true" />
            </Link>
            <Link
              to="/member/schedule"
              className="inline-flex min-h-14 items-center justify-center rounded-full border border-gold/35 bg-white/80 px-5 py-3 text-base font-semibold text-navy transition hover:border-gold/60 hover:bg-ivory"
            >
              {t("paymentResult.backToSchedule")}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
