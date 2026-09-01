import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "bun:test";

const root = resolve(import.meta.dir, "../..");
const routeFiles = [
  "src/routes/auth_.reset.tsx",
  "src/routes/reset-password.tsx",
  "src/routes/member.schedule.tsx",
  "src/routes/checkout.tsx",
  "src/routes/payment-result.tsx",
  "src/routes/privacy.tsx",
  "src/routes/terms.tsx",
  "src/routes/support.tsx",
  "src/routes/download.tsx",
  "src/routes/instagram.tsx",
  "src/routes/promo.yoga-lina.tsx",
  "src/routes/app.tsx",
];

function source(file) {
  return readFileSync(resolve(root, file), "utf8");
}

describe("public route shell ownership", () => {
  test("the full-screen auth route uses its chrome-free shell without owning main", () => {
    const routeSource = source("src/routes/auth.tsx");
    const shellSource = source("src/components/auth/AuthShell.tsx");

    expect(routeSource).toContain('from "@/components/auth/AuthShell"');
    expect(routeSource).toContain("<AuthShell");
    expect(routeSource).not.toMatch(/<main\b/);
    expect(shellSource.match(/<main\b/g)).toHaveLength(1);
    expect(shellSource).toContain('id="main-content"');
    expect(shellSource).not.toMatch(/<header\b|<footer\b/);
  });

  test.each(routeFiles)("%s composes PublicShell without owning main or hardcoding RTL", (file) => {
    const routeSource = source(file);

    expect(routeSource).toContain('from "@/components/public/PublicShell"');
    expect(routeSource).toContain("<PublicShell");
    expect(routeSource).not.toMatch(/<main\b/);
    expect(routeSource).not.toContain('dir="rtl"');
  });

  test("the app marketing page leaves the main landmark and document direction to the route shell", () => {
    const pageSource = source("src/components/app-marketing/AppMarketingPage.tsx");

    expect(pageSource).not.toMatch(/<main\b/);
    expect(pageSource).not.toContain('dir="rtl"');
    expect(pageSource).not.toContain("dir={LANG_META[lang].dir}");
  });

  test("the root fallback delegates skip ownership to the pathname contract", () => {
    const rootSource = source("src/routes/__root.tsx");

    expect(rootSource).toContain('from "@/lib/public-shell-paths"');
    expect(rootSource).toContain("shouldShowRootSkipLink(pathname)");
    expect(rootSource).toContain('className="global-skip-link"');
  });

  test("PublicShell routes own their skip link while authenticated routes keep the fallback", async () => {
    const { shouldShowRootSkipLink } = await import("../../src/lib/public-shell-paths.ts");

    expect(shouldShowRootSkipLink("/auth/reset")).toBe(false);
    expect(shouldShowRootSkipLink("/auth/reset/")).toBe(false);
    expect(shouldShowRootSkipLink("/app")).toBe(false);
    expect(shouldShowRootSkipLink("/app/ar")).toBe(false);
    expect(shouldShowRootSkipLink("/app/he/")).toBe(false);
    expect(shouldShowRootSkipLink("/app/en")).toBe(false);
    expect(shouldShowRootSkipLink("/member/bookings")).toBe(true);
  });
});
