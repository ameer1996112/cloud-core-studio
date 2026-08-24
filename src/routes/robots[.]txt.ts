import { createFileRoute } from "@tanstack/react-router";
import { PUBLIC_SITEMAP_URL } from "@/lib/app-marketing";
import { buildRawTextResponse, type RawTextResponseMethod } from "@/lib/rawTextResponse";

const ROBOTS_CACHE_CONTROL = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=3600";
const ROBOTS_CONTENT_TYPE = "text/plain; charset=utf-8";

export function buildRobotsTxt() {
  return ["User-agent: *", "Allow: /", "", `Sitemap: ${PUBLIC_SITEMAP_URL}`, ""].join("\n");
}

function buildRobotsResponseForMethod(method: RawTextResponseMethod) {
  return buildRawTextResponse({
    body: buildRobotsTxt(),
    cacheControl: ROBOTS_CACHE_CONTROL,
    contentType: ROBOTS_CONTENT_TYPE,
    method,
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
