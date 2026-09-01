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
    await page.screenshot({
      path: resolve(SCREENSHOT_DIR, "account-delete-error-en-390.png"),
      fullPage: true,
    });

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
