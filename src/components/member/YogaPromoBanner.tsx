import { Link } from "@tanstack/react-router";
import { ArrowLeft, Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";
import { t, useI18n } from "@/lib/i18n";
import { trackYogaPromo, type YogaPromoStatus } from "@/lib/yogaPromo";

type Props = {
  status: YogaPromoStatus | undefined;
  loading?: boolean;
  claimPending?: boolean;
  publicAudience?: boolean;
  onClaim?: () => void;
  claimHref?: string;
  className?: string;
};

export function YogaPromoBanner({
  status,
  loading,
  claimPending,
  publicAudience = false,
  onClaim,
  claimHref,
  className = "",
}: Props) {
  const { dir } = useI18n();
  const viewed = useRef(false);
  useEffect(() => {
    if (!status || viewed.current) return;
    viewed.current = true;
    trackYogaPromo("yoga_promo_banner_viewed", {
      state: status.claimedByCurrentUser
        ? "claimed"
        : status.soldOut
          ? "sold_out"
          : status.active
            ? "active"
            : "inactive",
      remaining: status.remaining,
    });
  }, [status]);

  const state = loading || !status ? "loading" : getBannerState(status, publicAudience);
  const copy = bannerCopy(state, status);
  const canClaim = state === "active" && Boolean(onClaim || claimHref);
  const scheduleCta =
    state === "claimed" || state === "used" || state === "sold_out" || state === "ineligible";

  return (
    <aside
      dir={dir}
      className={`relative overflow-hidden rounded-[1.75rem] border border-[#d8ae58]/55 bg-[#071a32] px-5 py-6 text-[#fff8e9] shadow-[0_22px_60px_rgba(4,17,34,0.24)] sm:px-7 sm:py-7 ${className}`}
      aria-live="polite"
      data-promo-state={state}
    >
      <div className="pointer-events-none absolute inset-0 opacity-70 [background:radial-gradient(circle_at_12%_15%,rgba(217,174,88,.2),transparent_25%),radial-gradient(circle_at_88%_82%,rgba(255,248,233,.11),transparent_30%)]" />
      <div className="relative grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div>
          <div className="mb-3 flex items-center gap-2 text-[#e8bd66]">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            <span className="text-[0.68rem] font-semibold uppercase tracking-[0.24em]">
              Cloud &amp; Core
            </span>
          </div>
          <h2 className="font-display text-2xl leading-tight !text-[#fff8e9] sm:text-3xl">
            {copy.title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#fff8e9]/82 sm:text-base">
            {copy.body}
          </p>
          {copy.remaining ? (
            <p className="mt-3 text-sm font-bold text-[#efc36b]" data-testid="yoga-promo-remaining">
              {copy.remaining}
            </p>
          ) : null}
          {state === "claimed" ? (
            <p className="mt-2 text-xs text-[#fff8e9]/65">{t("promo.yoga.restriction")}</p>
          ) : null}
        </div>
        {canClaim && claimHref ? (
          <a
            href={claimHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              trackYogaPromo("yoga_promo_cta_clicked", { remaining: status?.remaining });
            }}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#efc36b] bg-[#efc36b] px-5 text-sm font-bold text-[#071a32] transition hover:bg-[#f8d88f]"
          >
            {copy.cta}
            <ArrowLeft className="h-4 w-4 rtl:rotate-0 ltr:rotate-180" aria-hidden="true" />
          </a>
        ) : canClaim ? (
          <button
            type="button"
            disabled={claimPending}
            onClick={() => {
              trackYogaPromo("yoga_promo_cta_clicked", { remaining: status?.remaining });
              onClaim?.();
            }}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#efc36b] bg-[#efc36b] px-5 text-sm font-bold text-[#071a32] transition hover:bg-[#f8d88f] disabled:cursor-wait disabled:opacity-65"
          >
            {claimPending ? t("promo.yoga.claiming") : copy.cta}
            <ArrowLeft className="h-4 w-4 rtl:rotate-0 ltr:rotate-180" aria-hidden="true" />
          </button>
        ) : scheduleCta ? (
          <Link
            to="/member/schedule"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#efc36b]/65 px-5 text-sm font-bold text-[#fff8e9] transition hover:bg-white/10"
          >
            {copy.cta}
            <ArrowLeft className="h-4 w-4 rtl:rotate-0 ltr:rotate-180" aria-hidden="true" />
          </Link>
        ) : null}
      </div>
    </aside>
  );
}

type BannerState =
  | "loading"
  | "active"
  | "claimed"
  | "used"
  | "sold_out"
  | "ineligible"
  | "inactive";

function getBannerState(status: YogaPromoStatus, publicAudience: boolean): BannerState {
  if (status.claimedByCurrentUser && status.creditAvailable) return "claimed";
  if (status.claimedByCurrentUser) return "used";
  if (status.soldOut) return "sold_out";
  if (!status.active) return "inactive";
  if (!publicAudience && !status.eligible) return "ineligible";
  return "active";
}

function bannerCopy(state: BannerState, status?: YogaPromoStatus) {
  if (state === "loading")
    return { title: t("promo.yoga.title"), body: t("promo.yoga.loading"), cta: "" };
  if (state === "claimed")
    return {
      title: t("promo.yoga.claimedTitle"),
      body: t("promo.yoga.claimedBody"),
      cta: t("promo.yoga.claimedCta"),
    };
  if (state === "used")
    return {
      title: t("promo.yoga.usedTitle"),
      body: t("promo.yoga.usedBody"),
      cta: t("promo.yoga.claimedCta"),
    };
  if (state === "sold_out")
    return {
      title: t("promo.yoga.soldOutTitle"),
      body: t("promo.yoga.soldOutBody"),
      cta: t("promo.yoga.claimedCta"),
    };
  if (state === "ineligible")
    return {
      title: t("promo.yoga.ineligibleTitle"),
      body: t("promo.yoga.ineligibleBody"),
      cta: t("promo.yoga.claimedCta"),
    };
  if (state === "inactive")
    return {
      title: t("promo.yoga.disabledTitle"),
      body: t("promo.yoga.disabledBody"),
      cta: "",
    };
  const remaining = Math.max(0, status?.remaining ?? 0);
  return {
    title: t("promo.yoga.title"),
    body: t("promo.yoga.activeBody"),
    remaining:
      remaining === 1
        ? t("promo.yoga.remaining.one")
        : t("promo.yoga.remaining.many", { remaining }),
    cta: t("promo.yoga.cta"),
  };
}
