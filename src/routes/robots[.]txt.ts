import { createFileRoute } from "@tanstack/react-router";

const ROBOTS_CACHE_CONTROL = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=3600";
const ROBOTS_CONTENT_TYPE = "text/plain; charset=utf-8";

export function buildRobotsTxt() {
  return [
    "User-agent: *",
    "Allow: /",
    "Allow: /app/ar",
    "Allow: /app/he",
    "Allow: /app/en",
    "Allow: /support",
    "Allow: /privacy",
    "Allow: /terms",
    "Allow: /images/",
    "Allow: /brand/",
    "Disallow: /auth",
    "Disallow: /admin",
    "Disallow: /instructor",
    "Disallow: /member",
    "Disallow: /checkout",
    "Disallow: /payment",
    "Disallow: /api/",
    "Disallow: /_authenticated/",
    "Sitemap: https://cloudandcorestudio.com/sitemap.xml",
    "",
  ].join("\n");
}

function buildRobotsResponseForMethod(method: "GET" | "HEAD") {
  const body = buildRobotsTxt();
  return new Response(method === "HEAD" ? null : body, {
    status: 200,
    headers: {
      "cache-control": ROBOTS_CACHE_CONTROL,
      "content-length": String(new TextEncoder().encode(body).byteLength),
      "content-type": ROBOTS_CONTENT_TYPE,
    },
  });
}

export function buildRobotsResponse() {
  return buildRobotsResponseForMethod("GET");
}

export function buildRobotsHeadResponse() {
  return buildRobotsResponseForMethod("HEAD");
}

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () => buildRobotsResponse(),
      HEAD: () => buildRobotsHeadResponse(),
    },
  },
});
