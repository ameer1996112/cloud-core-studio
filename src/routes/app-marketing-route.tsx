/* eslint-disable react-refresh/only-export-components -- shared static route support */
import { useEffect } from "react";

import { AppMarketingPage } from "@/components/app-marketing/AppMarketingPage";
import {
  APP_MARKETING_INSTALL_URL,
  APP_MARKETING_LANGS,
  buildAppMarketingStructuredData,
  getAppMarketingAlternates,
  getAppMarketingMeta,
  type AppMarketingPublicProfile,
} from "@/lib/app-marketing";
import { applyLang, getActiveLang, type Lang } from "@/lib/i18n";
import {
  getInstagramLandingData,
  type InstagramLandingData,
} from "@/lib/instagramLanding.functions";

const APP_MARKETING_HERO_IMAGE = "/images/auth/cloud-core-auth-hero.webp";

export type AppMarketingRouteData = {
  appStoreUrl: string;
  lang: Lang;
  profile: AppMarketingPublicProfile;
  trialPrice: number | null;
};

function getPublicProfile(studio: InstagramLandingData): AppMarketingPublicProfile {
  return {
    address: studio.address,
    contactEmail: studio.contactEmail,
    instagramUrl: studio.instagramUrl,
    publicPhone: studio.publicPhone,
    whatsappNumber: studio.whatsappNumber,
  };
}

function getCanonicalTrialPrice(studio: InstagramLandingData): number | null {
  if (!studio.trialClassAllowed) return null;
  const price = studio.adultPlans.find((plan) => plan.credits === 1)?.priceIls;
  return typeof price === "number" && Number.isFinite(price) && price > 0 ? price : null;
}

export async function getAppMarketingRouteLoader(lang: Lang): Promise<AppMarketingRouteData> {
  try {
    const studio = await getInstagramLandingData();
    return {
      appStoreUrl: APP_MARKETING_INSTALL_URL,
      lang,
      profile: getPublicProfile(studio),
      trialPrice: getCanonicalTrialPrice(studio),
    };
  } catch {
    return {
      appStoreUrl: APP_MARKETING_INSTALL_URL,
      lang,
      profile: {
        address: null,
        contactEmail: null,
        instagramUrl: null,
        publicPhone: null,
        whatsappNumber: null,
      },
      trialPrice: null,
    };
  }
}

export function getAppMarketingRouteHead(lang: Lang, loaderData?: AppMarketingRouteData) {
  const meta = getAppMarketingMeta(lang);
  const structuredData = loaderData
    ? JSON.stringify(
        buildAppMarketingStructuredData({
          lang,
          profile: loaderData.profile,
          trialPrice: loaderData.trialPrice,
          faqVisible: false,
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
      profile={data.profile}
      trialPrice={data.trialPrice}
    />
  );
}
