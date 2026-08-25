import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { YogaPromoBanner } from "@/components/member/YogaPromoBanner";
import { useYogaPromo } from "@/hooks/useYogaPromo";
import { captureYogaPromoAttribution, trackYogaPromo, YOGA_PROMO_PATH } from "@/lib/yogaPromo";
import { t, useI18n } from "@/lib/i18n";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export const Route = createFileRoute("/promo/yoga-lina")({ component: YogaLinaPromoPage });

function YogaLinaPromoPage() {
  const { dir } = useI18n();
  const navigate = useNavigate();
  const [authenticated, setAuthenticated] = useState(false);
  const [attributionReady, setAttributionReady] = useState(false);
  const promo = useYogaPromo({ autoClaim: authenticated && attributionReady });
  const refetchPromo = promo.refetch;
  useDocumentTitle("page.home.title");

  useEffect(() => {
    trackYogaPromo("yoga_promo_landing_viewed");
    void captureYogaPromoAttribution(window.location.search)
      .then(() => refetchPromo())
      .finally(() => setAttributionReady(true));
    void supabase.auth.getSession().then(({ data }) => setAuthenticated(Boolean(data.session)));
  }, [refetchPromo]);

  useEffect(() => {
    const status = promo.claim.data?.status;
    if (status === "claimed" || status === "already_claimed") {
      void navigate({ to: "/member/schedule", replace: true });
    }
  }, [navigate, promo.claim.data?.status]);

  async function act() {
    if (!authenticated) {
      trackYogaPromo("yoga_promo_signup_started");
      const returnTo = encodeURIComponent(YOGA_PROMO_PATH);
      window.location.assign(`/auth?mode=signup&returnTo=${returnTo}`);
      return;
    }
    const result = await promo.claim.mutateAsync();
    if (result.status === "claimed" || result.status === "already_claimed") {
      await navigate({ to: "/member/schedule" });
    }
  }

  return (
    <main dir={dir} className="min-h-[100dvh] bg-[#f5eddf] px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <header className="mb-7 text-center sm:mb-10">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.28em] text-[#9a6d22]">
            {t("promo.yoga.landingEyebrow")}
          </p>
          <h1 className="mt-3 font-display text-5xl leading-none text-[#071a32] sm:text-7xl">
            {t("promo.yoga.landingHeadline")}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[#516075] sm:text-base">
            {t("promo.yoga.landingBody")}
          </p>
        </header>
        <YogaPromoBanner
          status={promo.data}
          loading={promo.isLoading || !attributionReady}
          claimPending={promo.claim.isPending}
          publicAudience={!authenticated}
          onClaim={act}
        />
        <p className="mx-auto mt-5 max-w-2xl text-center text-xs leading-5 text-[#667085]">
          {t("promo.yoga.restriction")}
        </p>
      </div>
    </main>
  );
}
