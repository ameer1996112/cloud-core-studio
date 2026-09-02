/**
 * Headed, loopback-only aid for manual keyboard, VoiceOver, and browser-zoom review.
 * Payment and deletion mutations are classified by payload and fulfilled or aborted
 * at Playwright's request boundary; unrecognized mutations fail closed.
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import {
  BASE_URL,
  fixtureEnvironment,
  installLocalNetworkGuard,
  installMutationInterceptor,
  openDeletionDialog,
  openFixturePaymentSheet,
  prepareOnlinePayment,
  requireLoopbackUrl,
  signIn,
  switchLanguage,
} from "./member-ui-ux-milestone-2.helpers.mjs";

const testCase = process.env.MANUAL_QA_CASE || "packages-loaded";
const lang = process.env.MANUAL_QA_LANG || "en";
const supportedCases = new Set([
  "packages-loaded",
  "payment-summary",
  "payment-loading",
  "payment-error",
  "account-loaded",
  "deletion-dialog",
  "deletion-loading",
  "deletion-success",
  "deletion-error",
]);

async function main() {
  requireLoopbackUrl(BASE_URL);
  if (!supportedCases.has(testCase)) throw new Error("member_ui_ux_manual_qa_unknown_case");
  if (!new Set(["en", "he", "ar"]).has(lang)) {
    throw new Error("member_ui_ux_manual_qa_unknown_language");
  }

  const variables = await fixtureEnvironment();
  const windowSize = process.env.MANUAL_QA_WINDOW_SIZE;
  const browser = await chromium.launch({
    headless: false,
    ...(process.env.MANUAL_QA_BROWSER_PATH
      ? { executablePath: process.env.MANUAL_QA_BROWSER_PATH }
      : {}),
    ...(windowSize ? { args: [`--window-size=${windowSize}`] } : {}),
  });
  const context = await browser.newContext({ viewport: null });
  const network = { localHosts: new Set(), blockedRemote: new Set() };
  await installLocalNetworkGuard(context, network);
  const page = await context.newPage();
  await signIn(page, variables.QA_MEMBER_UI_UX_PASSWORD);
  await switchLanguage(page, lang);

  if (testCase === "packages-loaded") {
    await page.goto(`${BASE_URL}/member/packages`, { waitUntil: "networkidle" });
  } else if (testCase === "payment-summary") {
    await openFixturePaymentSheet(page, lang);
  } else if (testCase === "payment-loading" || testCase === "payment-error") {
    const interceptor = await installMutationInterceptor(page, {
      kind: "payment",
      mode: testCase === "payment-loading" ? "delayed-error" : "server-error",
    });
    await openFixturePaymentSheet(page, lang);
    const submit = await prepareOnlinePayment(page, lang);
    await submit.click();
    if (testCase === "payment-loading") {
      await page.waitForFunction(() => {
        const action = document.querySelector('[role="dialog"] button.btn-navy:last-of-type');
        return action instanceof HTMLButtonElement && action.disabled;
      });
    } else {
      await page.getByRole("alert").waitFor({ state: "visible" });
    }
    if (interceptor.state.count !== 1) throw new Error("manual_payment_request_count_mismatch");
  } else if (testCase === "account-loaded") {
    await page.goto(`${BASE_URL}/member/account`, { waitUntil: "networkidle" });
  } else if (testCase === "deletion-dialog") {
    await openDeletionDialog(page, lang);
  } else {
    const interceptor = await installMutationInterceptor(page, {
      kind: "deletion",
      mode:
        testCase === "deletion-loading"
          ? "delayed-success"
          : testCase === "deletion-success"
            ? "success"
            : "server-error",
    });
    const { confirm } = await openDeletionDialog(page, lang);
    await confirm.click();
    if (testCase === "deletion-loading") {
      await page.waitForFunction(() => {
        const action = document.querySelector('[role="alertdialog"] button:last-of-type');
        return action instanceof HTMLButtonElement && action.disabled;
      });
    } else {
      const result =
        testCase === "deletion-success"
          ? page.getByRole("status").filter({ has: page.getByRole("heading") })
          : page.getByRole("alert");
      await result.waitFor({ state: "visible" });
    }
    if (interceptor.state.count !== 1) throw new Error("manual_deletion_request_count_mismatch");
  }

  console.log(`member-ui-ux-manual-qa-ready:${testCase}:${lang}`);
  console.log(`member-ui-ux-manual-qa-local-hosts:${[...network.localHosts].sort().join(",")}`);
  console.log(`member-ui-ux-manual-qa-pid:${process.pid}`);
  const reportGeometry = async (captureEvidence = false) => {
    const geometry = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"], [role="alertdialog"]');
      const rect = dialog?.getBoundingClientRect();
      return {
        outerWidth,
        outerHeight,
        innerWidth,
        innerHeight,
        devicePixelRatio,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        dialog: rect
          ? { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left }
          : null,
      };
    });
    console.log(`member-ui-ux-manual-qa-geometry:${JSON.stringify(geometry)}`);
    if (captureEvidence && process.env.MANUAL_QA_EVIDENCE_PATH) {
      await mkdir(dirname(process.env.MANUAL_QA_EVIDENCE_PATH), { recursive: true });
      await page.screenshot({ path: process.env.MANUAL_QA_EVIDENCE_PATH, fullPage: false });
      console.log(`member-ui-ux-manual-qa-evidence:${process.env.MANUAL_QA_EVIDENCE_PATH}`);
    }
  };
  await reportGeometry();
  process.on("SIGUSR1", () => void reportGeometry(true));
  console.log("Close the browser window to end the manual session.");
  await new Promise((resolveClose) => browser.on("disconnected", resolveClose));
}

main().catch((error) => {
  console.error(
    `member-ui-ux-manual-qa-failed:${error instanceof Error ? error.message : "unknown"}`,
  );
  process.exit(1);
});
