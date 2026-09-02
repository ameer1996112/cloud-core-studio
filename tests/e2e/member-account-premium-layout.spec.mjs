/**
 * Local authenticated layout verification for the premium member account page.
 *
 * Run only with the disposable local member fixture and loopback QA server.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";

const DEFAULT_BASE_URL = "http://127.0.0.1:4176";
const FIXTURE_EMAIL = "qa-member-ui@cloudcore.test";
const LOCAL_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const SCREENSHOT_DIR = resolve(
  process.cwd(),
  "docs/ui-ux-audit/screenshots/after/member-account-premium-polish",
);
const CASES = [
  { lang: "en", dir: "ltr", width: 320, height: 720 },
  { lang: "en", dir: "ltr", width: 390, height: 844 },
  { lang: "en", dir: "ltr", width: 1440, height: 900 },
  { lang: "he", dir: "rtl", width: 390, height: 844 },
  { lang: "he", dir: "rtl", width: 1440, height: 900 },
  { lang: "ar", dir: "rtl", width: 390, height: 844 },
  { lang: "ar", dir: "rtl", width: 1440, height: 900 },
];

function parseEnv(contents) {
  return Object.fromEntries(
    contents
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        const value = line.slice(index + 1);
        return [line.slice(0, index), value.replace(/^(?:"(.*)"|'(.*)')$/, "$1$2")];
      }),
  );
}

export function requireLoopbackBaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("member_account_layout_invalid_app_target");
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!new Set(["localhost", "127.0.0.1", "::1"]).has(hostname)) {
    throw new Error("member_account_layout_refuses_non_local_target");
  }
  return url.origin;
}

function requireCondition(condition, code) {
  if (!condition) throw new Error(code);
}

async function waitForDocumentLanguage(page, lang, dir) {
  await page.waitForFunction(
    ({ expectedLang, expectedDir }) =>
      document.documentElement.lang === expectedLang &&
      document.documentElement.dir === expectedDir,
    { expectedLang: lang, expectedDir: dir },
  );
}

async function authenticate(page, baseUrl, password) {
  await page.goto(`${baseUrl}/auth`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "English", exact: true }).click();
  await waitForDocumentLanguage(page, "en", "ltr");
  await page.locator('input[name="username"]').fill(FIXTURE_EMAIL);
  await page.locator('input[name="current-password"]').fill(password);
  let authStatus = "none";
  const observeAuthResponse = (response) => {
    if (new URL(response.url()).pathname.includes("/auth/v1/token")) {
      authStatus = String(response.status());
    }
  };
  page.on("response", observeAuthResponse);
  try {
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL((url) => url.pathname === "/member", { timeout: 15_000 });
  } catch {
    const path = new URL(page.url()).pathname.replace(/[^a-z0-9/_-]/gi, "");
    const hasAlert = await page
      .getByRole("alert")
      .isVisible()
      .catch(() => false);
    const invalidFields = await page
      .locator('form [aria-invalid="true"]')
      .count()
      .catch(() => -1);
    throw new Error(
      `member_account_login_redirect_failed_${path}_${authStatus}_${hasAlert}_${invalidFields}`,
    );
  } finally {
    page.off("response", observeAuthResponse);
  }
  requireCondition(
    new URL(page.url()).pathname === "/member",
    "member_account_login_redirect_failed",
  );
}

async function captureCompleteMemberPage(page, screenshotPath, viewportWidth, viewportHeight) {
  const markerAttribute = "data-qa-account-screenshot-flow";
  const styleId = "qa-account-screenshot-flow-style";
  const originalScroll = await page.evaluate(() => {
    const main = document.querySelector(".member-shell-main");
    if (!(main instanceof HTMLElement)) return null;
    return {
      windowX: window.scrollX,
      windowY: window.scrollY,
      mainLeft: main.scrollLeft,
      mainTop: main.scrollTop,
    };
  });
  requireCondition(originalScroll, "member_account_capture_scroller_missing");

  try {
    const expandedHeight = await page.evaluate(
      async ({ attribute, id }) => {
        const main = document.querySelector(".member-shell-main");
        const shell = main?.parentElement;
        if (!(main instanceof HTMLElement) || !(shell instanceof HTMLElement)) return 0;

        main.scrollLeft = 0;
        main.scrollTop = 0;
        shell.setAttribute(attribute, "");
        const style = document.createElement("style");
        style.id = id;
        // Evidence-only styles run after all real layout and dialog assertions.
        style.textContent = `
        html,
        body,
        #root {
          height: auto !important;
          min-height: 100vh !important;
          max-height: none !important;
          overflow: visible !important;
        }

        [${attribute}] {
          position: static !important;
          inset: auto !important;
          width: 100% !important;
          height: auto !important;
          min-height: 100vh !important;
          max-height: none !important;
          overflow: visible !important;
        }

        [${attribute}] > .member-shell-main {
          flex: none !important;
          width: 100% !important;
          height: auto !important;
          min-height: 100vh !important;
          max-height: none !important;
          overflow: visible !important;
        }

        [${attribute}] > .member-shell-main > nav {
          position: static !important;
          inset: auto !important;
          width: 100% !important;
        }
      `;
        document.head.append(style);
        window.scrollTo(0, 0);
        await new Promise((resolveFrame) => requestAnimationFrame(() => resolveFrame()));
        return document.documentElement.scrollHeight;
      },
      { attribute: markerAttribute, id: styleId },
    );

    requireCondition(
      expandedHeight > viewportHeight,
      "member_account_capture_not_taller_than_viewport",
    );
    const screenshot = await page.screenshot({ path: screenshotPath, fullPage: true });
    const metadata = await sharp(screenshot).metadata();
    const captureWidth = metadata.width ?? 0;
    const captureHeight = metadata.height ?? 0;
    requireCondition(
      Math.abs(captureWidth - viewportWidth) <= 1,
      "member_account_png_width_mismatch",
    );
    requireCondition(captureHeight > viewportHeight, "member_account_png_not_taller_than_viewport");
    requireCondition(
      Math.abs(captureHeight - expandedHeight) <= 2,
      "member_account_png_height_mismatch",
    );
    return { width: captureWidth, height: captureHeight };
  } finally {
    await page.evaluate(
      async ({ attribute, id, scroll }) => {
        document.getElementById(id)?.remove();
        document.querySelector(`[${attribute}]`)?.removeAttribute(attribute);
        await new Promise((resolveFrame) => requestAnimationFrame(() => resolveFrame()));
        const main = document.querySelector(".member-shell-main");
        if (main instanceof HTMLElement) {
          main.scrollLeft = scroll.mainLeft;
          main.scrollTop = scroll.mainTop;
        }
        window.scrollTo(scroll.windowX, scroll.windowY);
        await new Promise((resolveFrame) => requestAnimationFrame(() => resolveFrame()));
      },
      { attribute: markerAttribute, id: styleId, scroll: originalScroll },
    );
  }
}

async function inspectAccountLayout(page, baseUrl, testCase) {
  const { lang, dir, width, height } = testCase;
  await page.setViewportSize({ width, height });
  await page.goto(`${baseUrl}/member/account`, {
    waitUntil: "networkidle",
  });

  const languageSelect = page.locator("#profile-language");
  await languageSelect.waitFor({ state: "visible" });
  await languageSelect.selectOption(lang);
  await waitForDocumentLanguage(page, lang, dir);

  const heading = page.locator("h1").filter({ hasText: "Member QA" }).first();
  await heading.waitFor({ state: "visible" });
  await page.getByText("Member QA", { exact: true }).first().waitFor({ state: "visible" });

  const baseGeometry = await page.evaluate(() => {
    const root = document.documentElement;
    const content = document.querySelector(".member-account-page__content");
    const memberShellMain = document.querySelector(".member-shell-main");
    const legalLinks = [...document.querySelectorAll(".member-account-legal-links a")];
    const legalNav = document.querySelector(".member-account-legal-links");
    const legalStyle = legalNav ? getComputedStyle(legalNav) : null;
    return {
      noHorizontalOverflow: root.scrollWidth <= root.clientWidth,
      memberShellNoHorizontalOverflow:
        memberShellMain instanceof HTMLElement &&
        memberShellMain.scrollWidth <= memberShellMain.clientWidth + 1,
      contentWidth: content?.getBoundingClientRect().width ?? 0,
      legalCount: legalLinks.length,
      legalHeights: legalLinks.map((link) => link.getBoundingClientRect().height),
      legalRowGap: Number.parseFloat(legalStyle?.rowGap ?? "0"),
      legalColumnGap: Number.parseFloat(legalStyle?.columnGap ?? "0"),
    };
  });

  requireCondition(baseGeometry.noHorizontalOverflow, `horizontal_overflow_${lang}_${width}`);
  requireCondition(
    baseGeometry.memberShellNoHorizontalOverflow,
    `member_shell_horizontal_overflow_${lang}_${width}`,
  );
  requireCondition(baseGeometry.legalCount === 3, `legal_link_count_${lang}_${width}`);
  requireCondition(
    baseGeometry.legalRowGap > 0 && baseGeometry.legalColumnGap > 0,
    `legal_link_gap_${lang}_${width}`,
  );
  requireCondition(
    baseGeometry.legalHeights.every((linkHeight) => linkHeight >= 44),
    `legal_link_height_${lang}_${width}`,
  );
  if (width >= 1000) {
    requireCondition(
      baseGeometry.contentWidth > 0 && baseGeometry.contentWidth <= 961,
      `desktop_content_width_${lang}_${width}`,
    );
  }

  const touchGeometry = await page.evaluate(() => {
    const accountPage = document.querySelector(".member-account-page");
    if (!(accountPage instanceof HTMLElement)) return null;
    const isRendered = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity) !== 0 &&
        rect.width > 0 &&
        rect.height > 0 &&
        element.getClientRects().length > 0
      );
    };
    const stableKey = (element, index) => {
      if (element.id) return `id_${element.id.replace(/[^a-z0-9_-]/gi, "")}`;
      const stableClass = [...element.classList].find((name) =>
        /^(member-|btn-|editorial-input)/.test(name),
      );
      return `${element.tagName.toLowerCase()}_${stableClass || "control"}_${index}`;
    };
    const controls = [
      ...accountPage.querySelectorAll(
        'input:not([type]), input[type="text"], input[type="tel"], select, textarea, button, .member-account-legal-links a',
      ),
    ].filter(isRendered);
    const conciergeCheckbox = accountPage.querySelector("#concierge-paused");
    let conciergeLabelMissing = false;
    if (conciergeCheckbox instanceof HTMLInputElement && isRendered(conciergeCheckbox)) {
      const label = accountPage.querySelector('label[for="concierge-paused"]');
      if (label instanceof HTMLElement && isRendered(label)) controls.push(label);
      else conciergeLabelMissing = true;
    }
    const measurements = controls.map((element, index) => ({
      key:
        element instanceof HTMLLabelElement && element.htmlFor === "concierge-paused"
          ? "id_concierge-paused-label"
          : stableKey(element, index),
      height: element.getBoundingClientRect().height,
    }));
    const requiredIds = [
      "profile-name",
      "profile-phone",
      "profile-language",
      "profile-emergency-contact",
      "profile-energy-preference",
      "profile-save",
      "account-sign-out",
      "delete-reason",
      "account-delete-request",
    ];
    return {
      count: measurements.length,
      minimumHeight:
        measurements.length > 0
          ? Math.min(...measurements.map((measurement) => measurement.height))
          : 0,
      tooShort: measurements.filter((measurement) => measurement.height < 43.5),
      missingRequired: requiredIds.filter((id) => !controls.some((element) => element.id === id)),
      conciergeLabelMissing,
    };
  });

  requireCondition(touchGeometry, `touch_targets_missing_${lang}_${width}`);
  requireCondition(
    touchGeometry.missingRequired.length === 0,
    `touch_target_required_${touchGeometry.missingRequired[0] || "unknown"}`,
  );
  requireCondition(
    !touchGeometry.conciergeLabelMissing,
    "touch_target_id_concierge-paused-label_missing",
  );
  requireCondition(
    touchGeometry.tooShort.length === 0,
    `touch_target_height_${touchGeometry.tooShort[0]?.key || "unknown"}`,
  );

  const dangerZone = page.locator(".member-danger-zone");
  await dangerZone.scrollIntoViewIfNeeded();
  const dangerGeometry = await page.evaluate(() => {
    const panel = document.querySelector(".member-danger-zone");
    const action = document.querySelector(".member-danger-zone__action");
    const mobileNav = document.querySelector(".member-bottom-nav-link")?.closest("nav");
    if (!(panel instanceof HTMLElement) || !(action instanceof HTMLElement)) return null;
    const panelRect = panel.getBoundingClientRect();
    const actionRect = action.getBoundingClientRect();
    const navRect = mobileNav?.getBoundingClientRect();
    const navStyle = mobileNav ? getComputedStyle(mobileNav) : null;
    const navVisible =
      Boolean(navRect && navStyle) &&
      navStyle.display !== "none" &&
      navStyle.visibility !== "hidden" &&
      Number(navStyle.opacity) !== 0 &&
      navRect.width > 0 &&
      navRect.height > 0;
    const insideViewport = (rect) =>
      rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight;
    const intersects = (first, second) =>
      first.left < second.right &&
      first.right > second.left &&
      first.top < second.bottom &&
      first.bottom > second.top;
    const insidePanel =
      actionRect.left >= panelRect.left &&
      actionRect.top >= panelRect.top &&
      actionRect.right <= panelRect.right &&
      actionRect.bottom <= panelRect.bottom;
    return {
      panelDisplay: getComputedStyle(panel).display,
      panelWidth: panelRect.width,
      panelHeight: panelRect.height,
      panelInsideViewport: insideViewport(panelRect),
      actionHeight: actionRect.height,
      actionInsidePanel: insidePanel,
      actionInsideViewport: insideViewport(actionRect),
      navVisible,
      panelOverlapsNav: Boolean(navVisible && navRect && intersects(panelRect, navRect)),
      actionOverlapsNav: Boolean(navVisible && navRect && intersects(actionRect, navRect)),
    };
  });

  requireCondition(dangerGeometry, `danger_zone_missing_${lang}_${width}`);
  requireCondition(dangerGeometry.panelDisplay === "grid", `danger_zone_display_${lang}_${width}`);
  requireCondition(dangerGeometry.panelInsideViewport, `danger_zone_viewport_${lang}_${width}`);
  requireCondition(dangerGeometry.actionInsidePanel, `delete_action_panel_${lang}_${width}`);
  requireCondition(dangerGeometry.actionInsideViewport, `delete_action_viewport_${lang}_${width}`);
  requireCondition(dangerGeometry.actionHeight >= 44, `delete_action_height_${lang}_${width}`);
  if (width < 768) {
    requireCondition(dangerGeometry.navVisible, `mobile_nav_not_visible_${lang}_${width}`);
    requireCondition(!dangerGeometry.panelOverlapsNav, `danger_zone_nav_overlap_${lang}_${width}`);
    requireCondition(
      !dangerGeometry.actionOverlapsNav,
      `delete_action_nav_overlap_${lang}_${width}`,
    );
  }

  const deleteTrigger = page.locator("#account-delete-request");
  let deletionRequests = 0;
  const blockServerFunctionPosts = async (route) => {
    if (route.request().method() === "POST") {
      deletionRequests += 1;
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  };

  await page.route("**/_serverFn/**", blockServerFunctionPosts);
  let capture;
  try {
    await deleteTrigger.focus();
    await deleteTrigger.press("Enter");
    const dialog = page.getByRole("alertdialog");
    await dialog.waitFor({ state: "visible" });
    const dialogInsideViewport = await dialog.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return (
        rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight
      );
    });
    requireCondition(dialogInsideViewport, `dialog_viewport_${lang}_${width}`);
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    await page.waitForFunction(
      () => document.activeElement === document.querySelector("#account-delete-request"),
    );
    // Evidence-only capture runs after every real rendered/computed assertion.
    capture = await captureCompleteMemberPage(
      page,
      resolve(SCREENSHOT_DIR, `account-premium-${lang}-${width}.png`),
      width,
      height,
    );
    requireCondition(deletionRequests === 0, `deletion_request_count_${lang}_${width}`);
  } finally {
    await page.unroute("**/_serverFn/**", blockServerFunctionPosts);
  }

  return {
    case: `${lang}-${width}x${height}`,
    contentWidth: Math.round(baseGeometry.contentWidth),
    legalGap: Math.round(Math.min(baseGeometry.legalRowGap, baseGeometry.legalColumnGap)),
    panel: `${Math.round(dangerGeometry.panelWidth)}x${Math.round(dangerGeometry.panelHeight)}`,
    nav: dangerGeometry.navVisible ? "visible-clear" : "hidden",
    touchTargets: touchGeometry.count,
    minimumTouchHeight: Math.round(touchGeometry.minimumHeight * 10) / 10,
    capture: `${capture.width}x${capture.height}`,
    deletionRequests,
  };
}

async function main() {
  const baseUrl = requireLoopbackBaseUrl(process.env.APP_BASE_URL || DEFAULT_BASE_URL);
  const envPath = resolve(process.cwd(), process.env.ENV_PATH || ".env.qa.local");
  const env = parseEnv(await readFile(envPath, "utf8"));
  requireCondition(env.QA_MEMBER_UI_UX_PASSWORD, "member_account_layout_fixture_password_missing");

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      ...(existsSync(LOCAL_CHROME) ? { executablePath: LOCAL_CHROME } : {}),
    });
    const context = await browser.newContext({
      baseURL: baseUrl,
      viewport: { width: CASES[0].width, height: CASES[0].height },
    });
    const page = await context.newPage();
    await mkdir(SCREENSHOT_DIR, { recursive: true });
    await authenticate(page, baseUrl, env.QA_MEMBER_UI_UX_PASSWORD);

    const geometry = [];
    for (const testCase of CASES) {
      geometry.push(await inspectAccountLayout(page, baseUrl, testCase));
    }

    console.log(`member-account-premium-layout-pass:${CASES.length}`);
    console.log(`member-account-premium-layout-geometry:${JSON.stringify(geometry)}`);
  } finally {
    await browser?.close();
  }
}

main().catch((error) => {
  const firstLine = error instanceof Error ? error.message.split("\n", 1)[0] : "unknown";
  console.error(`member-account-premium-layout-failed:${firstLine.slice(0, 180)}`);
  process.exitCode = 1;
});
