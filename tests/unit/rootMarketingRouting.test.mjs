import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  isExplicitNativePlatformRequest,
  resolveRootEntryRedirect,
  resolveRootPublicRedirect,
} from "../../src/lib/app-marketing.ts";
import capacitorConfig from "../../capacitor.config.ts";

const root = resolve(import.meta.dir, "../..");
const rootRoute = readFileSync(resolve(root, "src/routes/index.tsx"), "utf8");

describe("root marketing routing", () => {
  test("uses request-scoped auth and a noindex SSR platform bridge", () => {
    expect(rootRoute).toContain("getAuthRouteContext");
    expect(rootRoute).toContain('name: "robots", content: "noindex,follow"');
    expect(rootRoute).toContain("RootPlatformBridge");
  });

  test("marks future native server loads explicitly", () => {
    expect(capacitorConfig.server?.url).toBe(
      "https://cloud-core-studio-6uthbm2yyq-zf.a.run.app?platform=native",
    );
  });

  test("recognizes only the explicit native platform marker", () => {
    expect(isExplicitNativePlatformRequest("?platform=native")).toBe(true);
    expect(isExplicitNativePlatformRequest("?platform=web")).toBe(false);
    expect(isExplicitNativePlatformRequest("?platform=native-app")).toBe(false);
    expect(isExplicitNativePlatformRequest("?utm_source=native")).toBe(false);
  });

  test("sends native visitors to auth without carrying request parameters", () => {
    expect(
      resolveRootPublicRedirect({
        isNative: true,
        saved: "en",
        accepted: ["he-IL"],
        search: "?platform=native&utm_source=app&returnTo=/member/packages",
      }),
    ).toBe("/auth");
  });

  test("sends authenticated visitors to their existing role homes before platform routing", () => {
    expect(resolveRootEntryRedirect({ role: "admin", isExplicitNative: true })).toBe("/admin");
    expect(resolveRootEntryRedirect({ role: "instructor", isExplicitNative: true })).toBe(
      "/instructor",
    );
    expect(resolveRootEntryRedirect({ role: "member", isExplicitNative: true })).toBe("/member");
  });

  test("sends an unauthenticated explicit native request to auth", () => {
    expect(resolveRootEntryRedirect({ role: null, isExplicitNative: true })).toBe("/auth");
    expect(resolveRootEntryRedirect({ role: null, isExplicitNative: false })).toBeNull();
  });

  test("routes ordinary web visitors through their saved locale and approved UTMs only", () => {
    expect(
      resolveRootPublicRedirect({
        isNative: false,
        saved: "he",
        accepted: ["en-US"],
        search: "?utm_source=instagram&utm_campaign=fall&returnTo=/member&platform=native",
      }),
    ).toBe("/app/he?utm_source=instagram&utm_campaign=fall");
  });

  test("uses navigator language before falling back to Arabic for web visitors", () => {
    expect(
      resolveRootPublicRedirect({
        isNative: false,
        saved: null,
        accepted: ["en-US", "ar;q=0.8"],
        search: "",
      }),
    ).toBe("/app/en");
    expect(
      resolveRootPublicRedirect({
        isNative: false,
        saved: null,
        accepted: ["fr-FR"],
        search: "",
      }),
    ).toBe("/app/ar");
  });

  test("keeps auth routing role-aware through the existing helpers", () => {
    expect(rootRoute).toContain("isExplicitNativePlatformRequest(window.location.search)");
    expect(rootRoute).toContain("Capacitor.isNativePlatform()");
    expect(rootRoute).toContain("window.localStorage.getItem(LANG_KEY)");
    expect(rootRoute).not.toContain("userAgent");
  });
});
