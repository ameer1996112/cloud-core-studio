import { createFileRoute } from "@tanstack/react-router";

const ROBOTS_CACHE_CONTROL = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=3600";

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

export function buildRobotsResponse() {
  return new Response(buildRobotsTxt(), {
    status: 200,
    headers: {
      "cache-control": ROBOTS_CACHE_CONTROL,
      "content-type": "text/plain; charset=utf-8",
    },
  });
}

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () => buildRobotsResponse(),
    },
  },
});
