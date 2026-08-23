import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getStartContext } from "@tanstack/start-storage-context";

import { AppMarketingPage } from "@/components/app-marketing/AppMarketingPage";
import {
  APP_MARKETING_CANONICAL_URL,
  APP_MARKETING_OG_IMAGE,
  buildAppMarketingStructuredData,
  getAppMarketingMeta,
  parseAppMarketingSearch,
  resolveAppMarketingLang,
  type AppMarketingPublicProfile,
} from "@/lib/app-marketing";
import { getDownloadConfig } from "@/lib/download-config";
import {
  applyLang,
  DEFAULT_LOCALE,
  getActiveLang,
  getStoredLang,
  readLangCookieHeader,
  type Lang,
} from "@/lib/i18n";
import { getInstagramLandingData } from "@/lib/instagramLanding.functions";

export type AppMarketingRouteData = {
  lang: Lang;
  appStoreUrl: string;
  profile: AppMarketingPublicProfile;
};

const getSavedAppMarketingLang = createIsomorphicFn()
  .server(() => {
    const cookieHeader = getStartContext().request.headers.get("cookie");
    return readLangCookieHeader(cookieHeader) ?? DEFAULT_LOCALE;
  })
  .client(() => getStoredLang());

export const Route = createFileRoute("/app")({
  validateSearch: parseAppMarketingSearch,
  loaderDeps: ({ search }) => ({ explicitLang: search.lang }),
  loader: async ({ deps }): Promise<AppMarketingRouteData> => {
    const lang = resolveAppMarketingLang(deps.explicitLang, getSavedAppMarketingLang());
    const appStoreUrl = getDownloadConfig().appStoreUrl;

    try {
      const studio = await getInstagramLandingData();
      return {
        lang,
        appStoreUrl,
        profile: {
          address: studio.address,
          contactEmail: studio.contactEmail,
          instagramUrl: studio.instagramUrl,
          publicPhone: studio.publicPhone,
          whatsappNumber: studio.whatsappNumber,
        },
      };
    } catch {
      return {
        lang,
        appStoreUrl,
        profile: {
          address: null,
          contactEmail: null,
          instagramUrl: null,
          publicPhone: null,
          whatsappNumber: null,
        },
      };
    }
  },
  head: ({ loaderData }) => {
    const meta = getAppMarketingMeta(loaderData?.lang ?? DEFAULT_LOCALE);
    return {
      meta: [
        { title: meta.title },
        { name: "description", content: meta.description },
        { name: "robots", content: "index, follow" },
        { property: "og:title", content: meta.title },
        { property: "og:description", content: meta.description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: APP_MARKETING_CANONICAL_URL },
        { property: "og:locale", content: meta.locale },
        { property: "og:image", content: APP_MARKETING_OG_IMAGE },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: meta.title },
        { name: "twitter:description", content: meta.description },
        { name: "twitter:image", content: APP_MARKETING_OG_IMAGE },
      ],
      links: [
        { rel: "canonical", href: APP_MARKETING_CANONICAL_URL },
        { rel: "alternate", hrefLang: "he", href: `${APP_MARKETING_CANONICAL_URL}?lang=he` },
        { rel: "alternate", hrefLang: "ar", href: `${APP_MARKETING_CANONICAL_URL}?lang=ar` },
        { rel: "alternate", hrefLang: "en", href: `${APP_MARKETING_CANONICAL_URL}?lang=en` },
        { rel: "alternate", hrefLang: "x-default", href: APP_MARKETING_CANONICAL_URL },
      ],
    };
  },
  component: AppMarketingRoute,
});

function AppMarketingRoute() {
  const data = Route.useLoaderData();

  useEffect(() => {
    if (getActiveLang() !== data.lang) applyLang(data.lang);
  }, [data.lang]);

  const structuredData = JSON.stringify(buildAppMarketingStructuredData(data)).replace(/</g, "\\u003c");

  return (
    <>
      <script type="application/ld+json">{structuredData}</script>
      <AppMarketingPage lang={data.lang} appStoreUrl={data.appStoreUrl} profile={data.profile} />
    </>
  );
}
