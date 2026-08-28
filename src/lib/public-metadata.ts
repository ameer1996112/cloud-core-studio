export const SITE_ORIGIN = "https://cloudandcorestudio.com";
export const DEFAULT_SOCIAL_IMAGE_URL = `${SITE_ORIGIN}/images/classes/aerial-yoga-flow.webp`;

type PublicPageHeadOptions = {
  title: string;
  description: string;
  path: string;
  image?: string;
  robots?: "index, follow" | "noindex, follow" | "noindex, nofollow";
  openGraphTitle?: string;
  openGraphDescription?: string;
  locale?: string;
};

export function buildPublicPageHead({
  title,
  description,
  path,
  image = DEFAULT_SOCIAL_IMAGE_URL,
  robots = "index, follow",
  openGraphTitle = title,
  openGraphDescription = description,
  locale,
}: PublicPageHeadOptions) {
  const canonicalUrl = new URL(path, SITE_ORIGIN).toString();
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { name: "robots", content: robots },
      { property: "og:title", content: openGraphTitle },
      { property: "og:description", content: openGraphDescription },
      { property: "og:type", content: "website" },
      { property: "og:url", content: canonicalUrl },
      ...(locale ? [{ property: "og:locale", content: locale }] : []),
      { property: "og:image", content: image },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: image },
    ],
    links: [{ rel: "canonical", href: canonicalUrl }],
  };
}
