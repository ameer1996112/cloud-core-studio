/**
 * Headed, local-only aid for VoiceOver and actual browser-zoom review.
 * Requires a separately started loopback QA server and fixture; it never forwards
 * a payment or deletion mutation beyond Playwright's request boundary.
 */
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.APP_BASE_URL || "http://127.0.0.1:4176";
const testCase = process.env.MANUAL_QA_CASE || "packages-loaded";
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const fixtureEmail = "qa-member-ui@cloudcore.test";

function assertLocal(url) {
  const host = new URL(url).hostname;
  if (!new Set(["127.0.0.1", "localhost", "::1"]).has(host)) {
    throw new Error("member_ui_ux_manual_qa_refuses_non_local_target");
  }
}

async function env() {
  const contents = await readFile(resolve(process.cwd(), ".env.qa.local"), "utf8");
  return Object.fromEntries(
    contents
      .split(/\r?\n/)
      .filter((line) => line.includes("=") && !line.startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
}

async function signIn(page, password) {
  await page.goto(`${baseUrl}/auth`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "English" }).click();
  await page.getByLabel(/email/i).fill(fixtureEmail);
  await page.getByRole("textbox", { name: /password/i }).fill(password);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/member/, { timeout: 10_000 });
}

async function openPaymentSummary(page) {
  await page.goto(`${baseUrl}/member/packages`, { waitUntil: "networkidle" });
  await page
    .getByRole("button", { name: /choose/i })
    .first()
    .click();
}

async function openDeletionDialog(page) {
  await page.goto(`${baseUrl}/member/account`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /request account deletion/i }).click();
}

async function main() {
  assertLocal(baseUrl);
  const variables = await env();
  const browser = await chromium.launch({
    headless: false,
    ...(existsSync(chrome) ? { executablePath: chrome } : {}),
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await signIn(page, variables.QA_MEMBER_UI_UX_PASSWORD);
  await page.route("**/_serverFn/**", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    if (testCase === "deletion-success") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, status: "requested", duplicate: false }),
      });
      return;
    }
    await route.abort("failed");
  });

  if (testCase === "packages-loaded") await page.goto(`${baseUrl}/member/packages`);
  else if (testCase === "payment-summary") await openPaymentSummary(page);
  else if (testCase === "payment-error") {
    await openPaymentSummary(page);
    await page.getByRole("button", { name: /secure payment/i }).click();
    await page.getByRole("checkbox").check();
    await page
      .getByRole("button", { name: /secure payment/i })
      .last()
      .click();
  } else if (testCase === "deletion-dialog") await openDeletionDialog(page);
  else if (testCase === "deletion-success" || testCase === "deletion-error") {
    await openDeletionDialog(page);
    await page.getByRole("button", { name: /submit deletion request/i }).click();
  } else throw new Error("member_ui_ux_manual_qa_unknown_case");

  console.log(`member-ui-ux-manual-qa-ready:${testCase}`);
  console.log("Close the browser window to end the manual session.");
  await new Promise((resolveClose) => browser.on("disconnected", resolveClose));
}

main().catch((error) => {
  console.error(
    `member-ui-ux-manual-qa-failed:${error instanceof Error ? error.message : "unknown"}`,
  );
  process.exit(1);
});
