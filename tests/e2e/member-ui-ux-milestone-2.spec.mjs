/**
 * Local authenticated QA smoke for milestone 2.
 *
 * The test deliberately signs in through /auth and uses no production/test bypass.
 * Run only after the local fixture and loopback QA server are running.
 */
import { mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const BASE_URL = process.env.APP_BASE_URL || "http://127.0.0.1:4176";
const ENV_PATH = resolve(process.cwd(), ".env.qa.local");
const FIXTURE_EMAIL = "qa-member-ui@cloudcore.test";
const LOCAL_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const SCREENSHOT_DIR = resolve(
  process.cwd(),
  "docs/ui-ux-audit/screenshots/after/milestone-2-authenticated-complete",
);

function parseEnv(contents) {
  return Object.fromEntries(
    contents
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        const value = line.slice(index + 1);
        return [line.slice(0, index), value.replace(/^(["'])(.*)\1$/, "$2")];
      }),
  );
}

function requireLocalBaseUrl() {
  const host = new URL(BASE_URL).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error("member_ui_ux_e2e_refuses_non_local_app_target");
  }
}

async function assertDeletionRecoveryLayout(page, { mobile }) {
  const wrapper = page.locator(".member-account-recovery-actions");
  const primary = page.locator(".member-account-recovery-actions__primary");
  const support = page.locator(".member-account-recovery-actions__support");
  await Promise.all([
    wrapper.waitFor({ state: "visible" }),
    primary.waitFor({ state: "visible" }),
    support.waitFor({ state: "visible" }),
  ]);
  await wrapper.evaluate((element) =>
    element.scrollIntoView({ block: "center", inline: "nearest" }),
  );

  const geometry = await page.evaluate(() => {
    const wrapperElement = document.querySelector(".member-account-recovery-actions");
    const primaryElement = document.querySelector(".member-account-recovery-actions__primary");
    const supportElement = document.querySelector(".member-account-recovery-actions__support");
    const mobileNav = document.querySelector(".member-bottom-nav-link")?.closest("nav");
    if (
      !(wrapperElement instanceof HTMLElement) ||
      !(primaryElement instanceof HTMLElement) ||
      !(supportElement instanceof HTMLElement)
    ) {
      return null;
    }

    const wrapperRect = wrapperElement.getBoundingClientRect();
    const primaryRect = primaryElement.getBoundingClientRect();
    const supportRect = supportElement.getBoundingClientRect();
    const navRect = mobileNav?.getBoundingClientRect() ?? null;
    const navStyle = mobileNav ? getComputedStyle(mobileNav) : null;
    const wrapperStyle = getComputedStyle(wrapperElement);
    const rowGap = Number.parseFloat(wrapperStyle.rowGap) || 0;
    const columnGap = Number.parseFloat(wrapperStyle.columnGap) || 0;
    const intersects = (first, second) =>
      first.left < second.right &&
      first.right > second.left &&
      first.top < second.bottom &&
      first.bottom > second.top;
    const inside = (inner, outer, tolerance = 1) =>
      inner.left >= outer.left - tolerance &&
      inner.top >= outer.top - tolerance &&
      inner.right <= outer.right + tolerance &&
      inner.bottom <= outer.bottom + tolerance;
    const viewport = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
    const navRendered = Boolean(
      navRect &&
      navStyle &&
      navStyle.display !== "none" &&
      navStyle.visibility !== "hidden" &&
      Number(navStyle.opacity) !== 0 &&
      navRect.width > 0 &&
      navRect.height > 0,
    );

    return {
      wrapperWidth: wrapperRect.width,
      primaryWidth: primaryRect.width,
      supportWidth: supportRect.width,
      primaryHeight: primaryRect.height,
      supportHeight: supportRect.height,
      rowGap,
      columnGap,
      verticalGap: supportRect.top - primaryRect.bottom,
      horizontalGap: supportRect.left - primaryRect.right,
      verticallyOrdered: primaryRect.bottom <= supportRect.top + 1,
      desktopAligned: Math.abs(primaryRect.top - supportRect.top) <= 1,
      actionsOverlap: intersects(primaryRect, supportRect),
      primaryInsideWrapper: inside(primaryRect, wrapperRect),
      supportInsideWrapper: inside(supportRect, wrapperRect),
      wrapperInsideViewport: inside(wrapperRect, viewport),
      primaryInsideViewport: inside(primaryRect, viewport),
      supportInsideViewport: inside(supportRect, viewport),
      navRendered,
      wrapperOverlapsNav: Boolean(navRendered && navRect && intersects(wrapperRect, navRect)),
      primaryOverlapsNav: Boolean(navRendered && navRect && intersects(primaryRect, navRect)),
      supportOverlapsNav: Boolean(navRendered && navRect && intersects(supportRect, navRect)),
      noHorizontalOverflow:
        document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    };
  });

  if (!geometry) throw new Error("deletion_recovery_layout_missing");
  const failures = [];
  const check = (condition, name) => {
    if (!condition) failures.push(name);
  };
  check(geometry.primaryHeight >= 44, "primary_height");
  check(geometry.supportHeight >= 44, "support_height");
  check(Math.max(geometry.rowGap, geometry.columnGap) > 0, "gap");
  check(!geometry.actionsOverlap, "action_overlap");
  check(geometry.primaryInsideWrapper, "primary_containment");
  check(geometry.supportInsideWrapper, "support_containment");
  check(geometry.wrapperInsideViewport, "wrapper_viewport");
  check(geometry.primaryInsideViewport, "primary_viewport");
  check(geometry.supportInsideViewport, "support_viewport");
  check(geometry.noHorizontalOverflow, "horizontal_overflow");

  if (mobile) {
    check(geometry.verticallyOrdered, "mobile_order");
    check(geometry.verticalGap >= geometry.rowGap - 1, "mobile_gap");
    check(Math.abs(geometry.primaryWidth - geometry.wrapperWidth) <= 2, "mobile_primary_width");
    check(Math.abs(geometry.supportWidth - geometry.wrapperWidth) <= 2, "mobile_support_width");
    check(geometry.navRendered, "mobile_nav_missing");
    check(!geometry.wrapperOverlapsNav, "mobile_wrapper_nav_overlap");
    check(!geometry.primaryOverlapsNav, "mobile_primary_nav_overlap");
    check(!geometry.supportOverlapsNav, "mobile_support_nav_overlap");
  } else {
    check(geometry.desktopAligned, "desktop_alignment");
    check(geometry.horizontalGap >= geometry.columnGap - 1, "desktop_gap");
  }

  if (failures.length > 0) {
    throw new Error(
      `deletion_recovery_layout_${mobile ? "mobile" : "desktop"}:${failures.join(",")}`,
    );
  }
}

async function main() {
  requireLocalBaseUrl();
  const env = parseEnv(await readFile(ENV_PATH, "utf8"));
  if (!env.QA_MEMBER_UI_UX_PASSWORD) throw new Error("member_ui_ux_fixture_password_missing");
  const browser = await chromium.launch({
    headless: true,
    ...(existsSync(LOCAL_CHROME) ? { executablePath: LOCAL_CHROME } : {}),
  });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await mkdir(SCREENSHOT_DIR, { recursive: true });
  const authNetwork = [];
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text().slice(0, 300));
  });
  page.on("response", (response) => {
    if (response.url().includes("/auth/v1/")) {
      const url = new URL(response.url());
      authNetwork.push({ host: url.host, path: url.pathname, status: response.status() });
    }
  });
  page.on("requestfailed", (request) => {
    if (request.url().includes("/auth/v1/")) {
      const url = new URL(request.url());
      authNetwork.push({ host: url.host, path: url.pathname, failed: true });
    }
  });
  try {
    await page.goto(`${BASE_URL}/auth`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "English" }).click();
    await page.getByLabel(/email/i).fill(FIXTURE_EMAIL);
    await page.getByRole("textbox", { name: /password/i }).fill(env.QA_MEMBER_UI_UX_PASSWORD);
    await page.locator('form button[type="submit"]').click();
    await page.waitForTimeout(1_500);
    if (!/\/member/.test(new URL(page.url()).pathname)) {
      const visibleStatus = (await page.locator("main").innerText())
        .replace(/\s+/g, " ")
        .slice(0, 500);
      throw new Error(
        `local_login_did_not_redirect:${visibleStatus}:auth=${JSON.stringify(authNetwork)}:console=${JSON.stringify(consoleErrors)}`,
      );
    }
    const authenticatedRoute = new URL(page.url()).pathname;
    const routeResults = [];
    for (const path of ["/member/packages", "/member/account", "/checkout"]) {
      await page.goto(`${BASE_URL}${path}`, { waitUntil: "networkidle" });
      const bodyText = (await page.locator("main").innerText()).replace(/\s+/g, " ");
      if (path === "/member/packages" && !bodyText.includes("Member package · 10 credits")) {
        throw new Error("local_fixture_package_data_not_rendered");
      }
      if (path === "/member/account" && !bodyText.includes("Member QA")) {
        throw new Error("local_fixture_member_data_not_rendered");
      }
      const name = path.replaceAll("/", "-").replace(/^-/, "") || "root";
      await page.screenshot({
        path: resolve(SCREENSHOT_DIR, `${name}-loaded-en-390.png`),
        fullPage: true,
      });
      routeResults.push({
        path,
        finalPath: new URL(page.url()).pathname,
        status: await page.title(),
        loadedFixtureData:
          path === "/member/packages"
            ? bodyText.includes("Member package · 10 credits")
            : path === "/member/account"
              ? bodyText.includes("Member QA")
              : null,
        noHorizontalOverflow: await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      });
    }

    await page.goto(`${BASE_URL}/member/packages`, { waitUntil: "networkidle" });
    const packageAction = page.getByRole("button", { name: /choose/i }).first();
    await packageAction.focus();
    await packageAction.press("Enter");
    await page.getByRole("button", { name: /secure payment/i }).click();
    await page.getByRole("checkbox").check();
    let paymentRequests = 0;
    await page.route("**/_serverFn/**", async (route) => {
      if (route.request().method() === "POST") {
        paymentRequests += 1;
        await route.abort("failed");
        return;
      }
      await route.continue();
    });
    const paymentSubmit = page.getByRole("button", { name: /secure payment/i }).last();
    await Promise.all([paymentSubmit.click(), paymentSubmit.click()]);
    await page.getByRole("alert").waitFor({ state: "visible" });
    await page.screenshot({
      path: resolve(SCREENSHOT_DIR, "packages-checkout-error-en-390.png"),
      fullPage: true,
    });

    await page.unroute("**/_serverFn/**");
    await page.goto(`${BASE_URL}/member/account`, { waitUntil: "networkidle" });
    const deletionTrigger = page.getByRole("button", { name: /request account deletion/i });
    await deletionTrigger.focus();
    await deletionTrigger.press("Enter");
    const dialog = page.getByRole("alertdialog");
    await dialog.waitFor({ state: "visible" });
    await page.keyboard.press("Escape");
    if (!(await deletionTrigger.evaluate((element) => element === document.activeElement))) {
      throw new Error("deletion_dialog_focus_not_restored");
    }
    await deletionTrigger.press("Space");
    let deletionRequests = 0;
    await page.route("**/_serverFn/**", async (route) => {
      if (route.request().method() === "POST") {
        deletionRequests += 1;
        await route.abort("failed");
        return;
      }
      await route.continue();
    });
    const confirm = page.getByRole("button", { name: /submit deletion request/i });
    await Promise.all([confirm.click(), confirm.click()]);
    await page.getByRole("alert").waitFor({ state: "visible" });
    const deletionRequestCountBeforeLayout = deletionRequests;
    await assertDeletionRecoveryLayout(page, { mobile: true });
    if (deletionRequests !== deletionRequestCountBeforeLayout) {
      throw new Error("deletion_recovery_mobile_created_request");
    }
    await page.screenshot({
      path: resolve(SCREENSHOT_DIR, "account-delete-error-en-390.png"),
      fullPage: true,
    });
    const deletionRequestCountBeforeDesktopLayout = deletionRequests;
    await page.setViewportSize({ width: 1440, height: 900 });
    await assertDeletionRecoveryLayout(page, { mobile: false });
    if (deletionRequests !== deletionRequestCountBeforeDesktopLayout) {
      throw new Error("deletion_recovery_desktop_created_request");
    }
    await page.setViewportSize({ width: 390, height: 844 });

    if (paymentRequests !== 1 || deletionRequests !== 1) {
      throw new Error(
        `duplicate_request_counts:payment=${paymentRequests},deletion=${deletionRequests}`,
      );
    }
    console.log(JSON.stringify({ authenticatedRoute, routeResults }));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(
    `member-ui-ux-e2e-smoke-failed:${error instanceof Error ? error.message : "unknown"}`,
  );
  process.exit(1);
});
