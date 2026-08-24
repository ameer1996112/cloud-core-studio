import { createFileRoute } from "@tanstack/react-router";

const PUBLIC_SITEMAP_URLS = [
  "https://cloudandcorestudio.com/app/ar",
  "https://cloudandcorestudio.com/app/he",
  "https://cloudandcorestudio.com/app/en",
  "https://cloudandcorestudio.com/support",
  "https://cloudandcorestudio.com/privacy",
  "https://cloudandcorestudio.com/terms",
] as const;

const SITEMAP_CACHE_CONTROL = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=3600";
const SITEMAP_CONTENT_TYPE = "application/xml; charset=utf-8";

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function buildSitemapXml() {
  const entries = PUBLIC_SITEMAP_URLS.map((url) => `    <url><loc>${escapeXml(url)}</loc></url>`);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    "</urlset>",
    "",
  ].join("\n");
}

function buildSitemapResponseForMethod(method: "GET" | "HEAD") {
  const body = buildSitemapXml();
  return new Response(method === "HEAD" ? null : body, {
    status: 200,
    headers: {
      "cache-control": SITEMAP_CACHE_CONTROL,
      "content-length": String(new TextEncoder().encode(body).byteLength),
      "content-type": SITEMAP_CONTENT_TYPE,
    },
  });
}

export function buildSitemapResponse() {
  return buildSitemapResponseForMethod("GET");
}

export function buildSitemapHeadResponse() {
  return buildSitemapResponseForMethod("HEAD");
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: () => buildSitemapResponse(),
      HEAD: () => buildSitemapHeadResponse(),
    },
  },
});
