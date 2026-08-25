import { createFileRoute } from "@tanstack/react-router";
import { PUBLIC_INDEXING_URLS } from "@/lib/app-marketing";
import { buildRawTextResponse, type RawTextResponseMethod } from "@/lib/rawTextResponse";

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
  const entries = PUBLIC_INDEXING_URLS.map((url) => `    <url><loc>${escapeXml(url)}</loc></url>`);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    "</urlset>",
    "",
  ].join("\n");
}

function buildSitemapResponseForMethod(method: RawTextResponseMethod) {
  return buildRawTextResponse({
    body: buildSitemapXml(),
    cacheControl: SITEMAP_CACHE_CONTROL,
    contentType: SITEMAP_CONTENT_TYPE,
    method,
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
