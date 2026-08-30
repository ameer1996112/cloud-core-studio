import { createFileRoute } from "@tanstack/react-router";

import { InstagramPresentation } from "@/components/public/InstagramPresentation";
import { PublicShell } from "@/components/public/PublicShell";
import {
  getInstagramLandingData,
  type InstagramLandingData,
} from "@/lib/instagramLanding.functions";
import { VERIFIED_STUDIO_WHATSAPP, buildWhatsappHref } from "@/lib/instagramLanding";

type InstagramRouteData = Pick<
  InstagramLandingData,
  "address" | "contactEmail" | "whatsappNumber"
> & {
  whatsappHref: string;
};

const KIDS_WHATSAPP_MESSAGE =
  "مرحباً، وصلت من إنستغرام ومهتمة بحصة تجريبية لليوغا الهوائية للأطفال. عمر طفلي/طفلتي هو ___.";

export const Route = createFileRoute("/instagram")({
  head: () => ({
    meta: [
      { title: "Cloud & Core | Aerial Yoga & Pilates" },
      {
        name: "description",
        content:
          "Boutique aerial yoga and Pilates for women, plus small aerial-yoga groups for children in Hurfeish.",
      },
      { property: "og:title", content: "Cloud & Core Studio | Hurfeish" },
      {
        property: "og:description",
        content: "Movement, strength and calm for women and children in Hurfeish.",
      },
      { property: "og:image", content: "/images/classes/aerial-yoga-flow.webp" },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://cloudandcorestudio.com/instagram" },
      { name: "robots", content: "index, follow" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://cloudandcorestudio.com/instagram" }],
  }),
  loader: async (): Promise<InstagramRouteData> => {
    try {
      const settings = await getInstagramLandingData();
      const whatsappNumber = settings.whatsappNumber || VERIFIED_STUDIO_WHATSAPP;
      return {
        ...settings,
        whatsappNumber,
        whatsappHref: buildWhatsappHref(whatsappNumber, KIDS_WHATSAPP_MESSAGE),
      };
    } catch {
      return {
        address: null,
        contactEmail: null,
        whatsappNumber: VERIFIED_STUDIO_WHATSAPP,
        whatsappHref: buildWhatsappHref(VERIFIED_STUDIO_WHATSAPP, KIDS_WHATSAPP_MESSAGE),
      };
    }
  },
  component: InstagramLandingPage,
});

function InstagramLandingPage() {
  const { address, contactEmail, whatsappHref } = Route.useLoaderData();
  return (
    <PublicShell headerMode="compact" mainClassName="ig-editorial">
      <InstagramPresentation
        address={address}
        contactEmail={contactEmail}
        whatsappHref={whatsappHref}
      />
    </PublicShell>
  );
}
