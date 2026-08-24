/* eslint-disable react-refresh/only-export-components -- shared static route support */
import { useEffect } from "react";
import { createIsomorphicFn } from "@tanstack/react-start";

import { AppMarketingPage } from "@/components/app-marketing/AppMarketingPage";
import {
  APP_MARKETING_INSTALL_URL,
  APP_MARKETING_LANGS,
  buildAppMarketingStructuredData,
  getAppMarketingAlternates,
  getAppMarketingMeta,
  sanitizeMarketingUtm,
  type AppMarketingPublicProfile,
} from "@/lib/app-marketing";
import {
  getAppMarketingPublicData,
  type AppMarketingPublicData,
} from "@/lib/appMarketing.functions";
import { applyLang, getActiveLang, type Lang } from "@/lib/i18n";

const APP_MARKETING_HERO_IMAGE = "/images/auth/cloud-core-auth-hero.webp";

const getAppMarketingRoutePublicData = createIsomorphicFn()
  .server(async () => {
    const { loadAppMarketingPublicData } = await import("@/lib/appMarketing.server");
    return loadAppMarketingPublicData();
  })
  .client(() => getAppMarketingPublicData());

export type AppMarketingRouteData = {
  appStoreUrl: string;
  lang: Lang;
  marketingUtm: Record<string, string>;
  profile: AppMarketingPublicProfile;
  trialPrice: number | null;
};

export async function getAppMarketingRouteLoader(
  lang: Lang,
  search = "",
  getPublicData: () => Promise<AppMarketingPublicData> = getAppMarketingRoutePublicData,
): Promise<AppMarketingRouteData> {
  const publicData = await getPublicData();
  const marketingUtm = Object.fromEntries(sanitizeMarketingUtm(search));

  return {
    ...publicData,
    lang,
    marketingUtm,
  };
}

export function getAppMarketingRouteHead(lang: Lang, loaderData?: AppMarketingRouteData) {
  const meta = getAppMarketingMeta(lang);
  const structuredData = loaderData
    ? JSON.stringify(
        buildAppMarketingStructuredData({
          lang,
          profile: loaderData.profile,
          trialPrice: loaderData.trialPrice,
          faqVisible: true,
        }),
      ).replace(/</g, "\\u003c")
    : undefined;

  return {
    meta: [
      { title: meta.title },
      { name: "description", content: meta.description },
      { name: "robots", content: "index, follow" },
      { name: "apple-itunes-app", content: "app-id=6786035836" },
      { property: "og:title", content: meta.title },
      { property: "og:description", content: meta.description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: meta.canonical },
      { property: "og:locale", content: meta.locale },
      ...APP_MARKETING_LANGS.filter((locale) => locale !== lang).map((locale) => ({
        property: "og:locale:alternate",
        content: getAppMarketingMeta(locale).locale,
      })),
      { property: "og:image", content: meta.ogImage },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: meta.title },
      { name: "twitter:description", content: meta.description },
      { name: "twitter:image", content: meta.ogImage },
    ],
    links: [
      { rel: "canonical", href: meta.canonical },
      ...getAppMarketingAlternates(lang),
      { rel: "preload", as: "image", href: APP_MARKETING_HERO_IMAGE },
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
}

export function AppMarketingRoutePage({ data }: { data: AppMarketingRouteData }) {
  useEffect(() => {
    if (getActiveLang() !== data.lang) applyLang(data.lang);
  }, [data.lang]);

  return (
    <AppMarketingPage
      lang={data.lang}
      appStoreUrl={data.appStoreUrl}
      marketingUtm={data.marketingUtm}
      profile={data.profile}
      trialPrice={data.trialPrice}
    />
  );
}
