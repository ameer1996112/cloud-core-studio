import { createFileRoute, redirect } from "@tanstack/react-router";
import { PublicShell } from "@/components/public/PublicShell";

const YOGA_PROMO_CANONICAL_URL = "https://cloudandcorestudio.com/promo/yoga-lina";
const YOGA_PROMO_TITLE = "יוגה עם לינה | Cloud & Core Studio";
const YOGA_PROMO_DESCRIPTION =
  "שיעור יוגה עם לינה ב-Cloud & Core Studio, כולל פרטי המבצע והצטרפות מאובטחת.";

export const Route = createFileRoute("/promo/yoga-lina")({
  head: () => ({
    meta: [
      { title: YOGA_PROMO_TITLE },
      { name: "description", content: YOGA_PROMO_DESCRIPTION },
      { name: "robots", content: "noindex, follow" },
      { property: "og:title", content: YOGA_PROMO_TITLE },
      { property: "og:description", content: YOGA_PROMO_DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: YOGA_PROMO_CANONICAL_URL },
    ],
    links: [{ rel: "canonical", href: YOGA_PROMO_CANONICAL_URL }],
  }),
  beforeLoad: ({ location }) => {
    throw redirect({
      href: `/promo/yoga-lina-launch${location.searchStr}`,
      replace: true,
      statusCode: 301,
    });
  },
  component: YogaLinaPromoRedirect,
});

function YogaLinaPromoRedirect() {
  return (
    <PublicShell headerMode="compact">
      <span aria-hidden="true" />
    </PublicShell>
  );
}
