import { useEffect } from "react";
import { AppMarketingPage } from "./AppMarketingPage";
import { PublicShell } from "@/components/public/PublicShell";
import { applyLang } from "@/lib/i18n";
import type { AppMarketingRouteData } from "@/lib/app-marketing-route";
export function AppMarketingRoutePage({ data }: { data: AppMarketingRouteData }) {
  useEffect(() => {
    applyLang(data.lang);
  }, [data.lang]);

  return (
    <PublicShell
      showHeader={false}
      showFooter={false}
      mainClassName="app-marketing-shell-main"
      skipLinkClassName="app-marketing__skip-link"
    >
      <AppMarketingPage
        lang={data.lang}
        appStoreUrl={data.appStoreUrl}
        marketingUtm={data.marketingUtm}
        profile={data.profile}
        trialPrice={data.trialPrice}
      />
    </PublicShell>
  );
}
