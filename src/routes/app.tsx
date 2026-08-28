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
} from "@/lib/locale";
import { getInstagramLandingData } from "@/lib/instagramLanding.functions";
import { buildPublicPageHead } from "@/lib/public-metadata";

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
    const baseHead = buildPublicPageHead({
      title: meta.title,
      description: meta.description,
      path: "/app",
      image: APP_MARKETING_OG_IMAGE,
      locale: meta.locale,
    });
    const structuredData = loaderData
      ? JSON.stringify(buildAppMarketingStructuredData(loaderData)).replace(/</g, "\\u003c")
      : undefined;

    return {
      meta: baseHead.meta,
      links: [
        ...baseHead.links,
        { rel: "alternate", hrefLang: "he", href: `${APP_MARKETING_CANONICAL_URL}?lang=he` },
        { rel: "alternate", hrefLang: "ar", href: `${APP_MARKETING_CANONICAL_URL}?lang=ar` },
        { rel: "alternate", hrefLang: "en", href: `${APP_MARKETING_CANONICAL_URL}?lang=en` },
        { rel: "alternate", hrefLang: "x-default", href: APP_MARKETING_CANONICAL_URL },
      ],
      scripts: structuredData
        ? [
            {
              type: "application/ld+json",
              children: structuredData,
            },
          ]
        : [],
    };
  },
  component: AppMarketingRoute,
});

function AppMarketingRoute() {
  const data = Route.useLoaderData();

  useEffect(() => {
    if (getActiveLang() !== data.lang) applyLang(data.lang);
  }, [data.lang]);

  return (
    <AppMarketingPage lang={data.lang} appStoreUrl={data.appStoreUrl} profile={data.profile} />
  );
}
