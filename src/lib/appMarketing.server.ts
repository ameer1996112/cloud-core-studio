import type { AppMarketingPublicProfile } from "@/lib/app-marketing";
import { getDownloadConfig } from "@/lib/download-config";
import { loadInstagramLandingData, type InstagramLandingData } from "@/lib/instagramLanding.server";

export type AppMarketingPublicData = {
  appStoreUrl: string;
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

export async function loadAppMarketingPublicData(): Promise<AppMarketingPublicData> {
  const appStoreUrl = getDownloadConfig().appStoreUrl;

  try {
    const studio = await loadInstagramLandingData();
    return {
      appStoreUrl,
      profile: getPublicProfile(studio),
      trialPrice: getCanonicalTrialPrice(studio),
    };
  } catch {
    return {
      appStoreUrl,
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
