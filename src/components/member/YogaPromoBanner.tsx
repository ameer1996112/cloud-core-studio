import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useEffect, useRef } from "react";
import { t, useI18n } from "@/lib/i18n";
import { trackYogaPromo, type YogaPromoStatus } from "@/lib/yogaPromo";
import {
  YogaPromoPresentation,
  type YogaPromoVisualState,
} from "@/components/member/YogaPromoPresentation";

type Props = {
  status: YogaPromoStatus | undefined;
  loading?: boolean;
  claimPending?: boolean;
  publicAudience?: boolean;
  onClaim?: () => void;
  className?: string;
};

export function YogaPromoBanner({
  status,
  loading,
  claimPending,
  publicAudience = false,
  onClaim,
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
  const canClaim = state === "active" && Boolean(onClaim);
  const scheduleCta =
    state === "claimed" || state === "used" || state === "sold_out" || state === "ineligible";

  const action = canClaim ? (
    <button
      type="button"
      disabled={claimPending}
      onClick={() => {
        trackYogaPromo("yoga_promo_cta_clicked", { remaining: status?.remaining });
        onClaim?.();
      }}
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[var(--cc-yoga-promo-gold)] bg-[var(--cc-yoga-promo-gold)] px-5 text-sm font-bold text-[var(--cc-yoga-promo-ink)] transition hover:bg-[var(--cc-yoga-promo-gold-hover)] disabled:cursor-wait disabled:opacity-65"
    >
      {claimPending ? t("promo.yoga.claiming") : copy.cta}
      <ArrowLeft className="h-4 w-4 rtl:rotate-0 ltr:rotate-180" aria-hidden="true" />
    </button>
  ) : scheduleCta ? (
    <Link
      to="/member/schedule"
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[var(--cc-yoga-promo-gold)]/65 px-5 text-sm font-bold text-[var(--cc-yoga-promo-copy)] transition hover:bg-white/10"
    >
      {copy.cta}
      <ArrowLeft className="h-4 w-4 rtl:rotate-0 ltr:rotate-180" aria-hidden="true" />
    </Link>
  ) : null;

  return (
    <YogaPromoPresentation
      state={state}
      title={copy.title}
      body={copy.body}
      remaining={copy.remaining}
      restriction={state === "claimed" ? t("promo.yoga.restriction") : undefined}
      action={action}
      dir={dir}
      className={className}
    />
  );
}

type BannerState = YogaPromoVisualState;

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
