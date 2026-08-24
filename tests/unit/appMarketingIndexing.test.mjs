import { describe, expect, test } from "bun:test";

import {
  buildRobotsHeadResponse,
  buildRobotsResponse,
  Route as RobotsRoute,
} from "../../src/routes/robots[.]txt";
import {
  buildSitemapHeadResponse,
  buildSitemapResponse,
  Route as SitemapRoute,
} from "../../src/routes/sitemap[.]xml";

const publicUrls = [
  "https://cloudandcorestudio.com/app/ar",
  "https://cloudandcorestudio.com/app/he",
  "https://cloudandcorestudio.com/app/en",
  "https://cloudandcorestudio.com/support",
  "https://cloudandcorestudio.com/privacy",
  "https://cloudandcorestudio.com/terms",
];

describe("public indexing responses", () => {
  test("builds a deterministic XML sitemap with only canonical public entries", async () => {
    const response = buildSitemapResponse();
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/xml; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=3600, s-maxage=86400, stale-while-revalidate=3600",
    );
    expect(body.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(body).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(body.endsWith("</urlset>\n")).toBe(true);

    for (const url of publicUrls) {
      expect(body).toContain(`<loc>${url}</loc>`);
    }
    for (const privateUrl of [
      "https://cloudandcorestudio.com/",
      "https://cloudandcorestudio.com/app",
      "https://cloudandcorestudio.com/auth",
      "https://cloudandcorestudio.com/admin",
      "https://cloudandcorestudio.com/instructor",
      "https://cloudandcorestudio.com/member",
      "https://cloudandcorestudio.com/schedule",
      "https://cloudandcorestudio.com/checkout",
      "https://cloudandcorestudio.com/payment",
      "https://cloudandcorestudio.com/api/",
    ]) {
      expect(body).not.toContain(`<loc>${privateUrl}</loc>`);
    }

    const parsed = body.match(/<loc>([^<]+)<\/loc>/g)?.map((entry) => entry.slice(5, -6));
    expect(parsed).toEqual(publicUrls);
    expect(await buildSitemapResponse().text()).toBe(body);
  });

  test("builds a UTF-8 robots policy that permits public marketing assets", async () => {
    const response = buildRobotsResponse();
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=3600, s-maxage=86400, stale-while-revalidate=3600",
    );
    expect(body).toContain("User-agent: *");
    expect(body).toContain("Allow: /");
    for (const publicPath of [
      "/app/ar",
      "/app/he",
      "/app/en",
      "/support",
      "/privacy",
      "/terms",
      "/images/",
      "/brand/",
    ]) {
      expect(body).toContain(`Allow: ${publicPath}`);
    }
    for (const privatePath of [
      "/auth",
      "/admin",
      "/instructor",
      "/member",
      "/checkout",
      "/payment",
      "/api/",
      "/_authenticated/",
    ]) {
      expect(body).toContain(`Disallow: ${privatePath}`);
    }
    expect(body).toContain("Sitemap: https://cloudandcorestudio.com/sitemap.xml");
    expect(body).not.toContain("noindex");
  });

  test("serves an empty sitemap HEAD response with the GET metadata", async () => {
    const getResponse = buildSitemapResponse();
    const headResponse = buildSitemapHeadResponse();
    const routeHeadResponse = SitemapRoute.options.server.handlers.HEAD({});

    expect(headResponse.status).toBe(200);
    expect(routeHeadResponse.status).toBe(200);
    expect(headResponse.headers.get("content-type")).toBe(getResponse.headers.get("content-type"));
    expect(headResponse.headers.get("cache-control")).toBe(
      getResponse.headers.get("cache-control"),
    );
    expect(headResponse.headers.get("content-length")).toBe(
      getResponse.headers.get("content-length"),
    );
    expect(await headResponse.text()).toBe("");
    expect(await routeHeadResponse.text()).toBe("");
  });

  test("serves an empty robots HEAD response with the GET metadata", async () => {
    const getResponse = buildRobotsResponse();
    const headResponse = buildRobotsHeadResponse();
    const routeHeadResponse = RobotsRoute.options.server.handlers.HEAD({});

    expect(headResponse.status).toBe(200);
    expect(routeHeadResponse.status).toBe(200);
    expect(headResponse.headers.get("content-type")).toBe(getResponse.headers.get("content-type"));
    expect(headResponse.headers.get("cache-control")).toBe(
      getResponse.headers.get("cache-control"),
    );
    expect(headResponse.headers.get("content-length")).toBe(
      getResponse.headers.get("content-length"),
    );
    expect(await headResponse.text()).toBe("");
    expect(await routeHeadResponse.text()).toBe("");
  });
});
