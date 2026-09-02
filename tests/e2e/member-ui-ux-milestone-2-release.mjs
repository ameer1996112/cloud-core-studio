/**
 * Milestone-2 release-gate browser suite.
 *
 * This suite authenticates against local Supabase, renders real fixture data, and
 * intercepts only the classified payment/deletion server functions. It never
 * forwards a payment or deletion mutation beyond Playwright's route boundary.
 */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

import {
  BASE_URL,
  COPY,
  FIXTURE_PLAN_NAME,
  FIXTURE_PRICE,
  assertDocumentLanguage,
  assertFocusedWithin,
  chromeLaunchOptions,
  fixtureEnvironment,
  installLocalNetworkGuard,
  installMutationInterceptor,
  openDeletionDialog,
  openFixturePaymentSheet,
  prepareOnlinePayment,
  requireLoopbackUrl,
  sanitizeDiagnostic,
  signIn,
  switchLanguage,
  waitForCount,
} from "./member-ui-ux-milestone-2.helpers.mjs";

const SCREENSHOT_DIR = resolve(
  process.cwd(),
  "docs/ui-ux-audit/screenshots/after/milestone-2-automated-closure",
);
const RESULT_PATH = resolve(
  process.cwd(),
  "docs/ui-ux-audit/validation/milestone-2-automated-closure-results.json",
);

const results = {
  startedAt: new Date().toISOString(),
  paymentPath: null,
  deletionPath: null,
  paymentCounts: {},
  deletionCounts: {},
  keyboard: [],
  responsive: [],
  axe: [],
  network: { localHosts: new Set(), blockedRemote: new Set() },
  consoleErrors: [],
};

function recordPath(kind, paths) {
  assert.equal(paths.size, 1, `${kind}_opaque_path_count`);
  const path = [...paths][0];
  const key = kind === "payment" ? "paymentPath" : "deletionPath";
  if (results[key]) assert.equal(results[key], path, `${kind}_opaque_path_changed_in_build`);
  results[key] = path;
}

async function createAuthenticatedPage(browser, password, options = {}) {
  const viewport = options.viewport ?? { width: 390, height: 844 };
  const context = await browser.newContext({ viewport });
  await installLocalNetworkGuard(context, results.network);
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    results.consoleErrors.push(sanitizeDiagnostic(message.text()));
  });
  await page.route("**/__playwright_payment_stub", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: '<!doctype html><html lang="en"><title>Payment handoff stub</title><h1>Payment handoff stub</h1></html>',
    }),
  );
  await signIn(page, password);
  const lang = options.lang ?? "en";
  await switchLanguage(page, lang);
  return { context, page, lang, viewport };
}

async function closeContext(holder) {
  await holder.context.close();
}

async function assertFeedbackFocus(page, feedback) {
  await feedback.waitFor({ state: "visible" });
  await page.waitForTimeout(50);
  assert(
    await feedback.evaluate((element) => element === document.activeElement),
    "persistent_feedback_did_not_receive_focus",
  );
}

async function assertPaymentError(page, lang = "en") {
  const alert = page.getByRole("alert");
  await alert.waitFor({ state: "visible" });
  const text = await alert.innerText();
  assert(text.includes(COPY[lang].retry), `payment_retry_copy_${lang}`);
  assert(!text.includes("qa-intercepted"), "payment_error_exposed_internal_detail");
  assert(!/stack|serverFn|opaque/i.test(text), "payment_error_exposed_transport_detail");
  await assertFeedbackFocus(page, alert);
  assert((await page.getByRole("dialog").innerText()).includes(FIXTURE_PLAN_NAME));
  return alert;
}

async function assertDeletionError(page, lang = "en") {
  const alert = page.getByRole("alert");
  await alert.waitFor({ state: "visible" });
  const text = await alert.innerText();
  assert(text.includes(COPY[lang].deleteError), `deletion_error_copy_${lang}`);
  assert(text.includes(COPY[lang].retry), `deletion_retry_copy_${lang}`);
  assert(text.includes(COPY[lang].support), `deletion_support_copy_${lang}`);
  assert(!text.includes("qa-intercepted"), "deletion_error_exposed_internal_detail");
  assert(!/account was deleted|account deleted/i.test(text), "deletion_error_claimed_deletion");
  await assertFeedbackFocus(page, alert);
  return alert;
}

async function testPaymentNavigationSafety(browser, password) {
  const holder = await createAuthenticatedPage(browser, password);
  try {
    const interceptor = await installMutationInterceptor(holder.page, {
      kind: "payment",
      mode: "server-error",
    });
    const { choose } = await openFixturePaymentSheet(holder.page, "en", "Enter");
    assert.equal(interceptor.state.count, 0, "opening_sheet_submitted_payment");
    results.paymentCounts["Opening payment sheet"] = 0;
    results.keyboard.push({ flow: "payment", action: "Enter opens sheet", result: "pass" });
    await holder.page.reload({ waitUntil: "networkidle" });
    assert.equal(interceptor.state.count, 0, "refresh_submitted_payment");
    results.paymentCounts["Refresh before submit"] = 0;
    await holder.page.goto(`${BASE_URL}/support`, { waitUntil: "networkidle" });
    await holder.page.goBack({ waitUntil: "networkidle" });
    assert.equal(interceptor.state.count, 0, "browser_back_submitted_payment");
    results.paymentCounts["Browser back before submit"] = 0;
    await openFixturePaymentSheet(holder.page);
    await holder.page.getByRole("button", { name: "Cancel", exact: true }).click();
    await choose.waitFor({ state: "visible" }).catch(() => undefined);
    assert.equal(interceptor.state.count, 0, "closing_sheet_submitted_payment");
    assert.equal(interceptor.state.unknown.length, 0);
    await interceptor.uninstall();
  } finally {
    await closeContext(holder);
  }
}

async function testPaymentDuplicate(browser, password, scenario, activation) {
  const holder = await createAuthenticatedPage(browser, password);
  try {
    await openFixturePaymentSheet(holder.page);
    const submit = await prepareOnlinePayment(holder.page);
    const interceptor = await installMutationInterceptor(holder.page, {
      kind: "payment",
      mode: "delayed-error",
    });
    if (activation === "pointer") {
      const box = await submit.boundingBox();
      assert(box, "payment_submit_geometry_missing");
      await Promise.all([
        holder.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2),
        holder.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2),
      ]);
    } else {
      await submit.focus();
      await holder.page.keyboard.press(activation);
      await holder.page.keyboard.press(activation);
      await holder.page.keyboard.press(activation);
    }
    await waitForCount(interceptor.state, 1);
    assert(await submit.isDisabled(), `payment_${scenario}_not_disabled`);
    assert(!/success|paid|complete/i.test(await submit.innerText()));
    results.paymentCounts[scenario] = interceptor.state.count;
    recordPath("payment", interceptor.state.paths);
    interceptor.release();
    await assertPaymentError(holder.page);
    assert.equal(interceptor.state.count, 1, `payment_${scenario}_duplicate_request`);
    assert.equal(interceptor.state.unknown.length, 0);
    results.keyboard.push({ flow: "payment", action: scenario, result: "pass" });
    await interceptor.uninstall();
  } finally {
    await closeContext(holder);
  }
}

async function testPaymentServerErrorRetry(browser, password) {
  const holder = await createAuthenticatedPage(browser, password);
  try {
    await openFixturePaymentSheet(holder.page);
    const submit = await prepareOnlinePayment(holder.page);
    const interceptor = await installMutationInterceptor(holder.page, {
      kind: "payment",
      sequence: ["server-error", "server-error"],
    });
    await submit.click();
    await waitForCount(interceptor.state, 1);
    await assertPaymentError(holder.page);
    results.paymentCounts["Initial server error"] = 1;
    const retry = holder.page.getByRole("button", { name: COPY.en.retry, exact: true });
    await retry.focus();
    await retry.press("Enter");
    await waitForCount(interceptor.state, 2);
    results.paymentCounts["Retry after server error"] = 1;
    recordPath("payment", interceptor.state.paths);
    assert.equal(interceptor.state.unknown.length, 0);
    results.keyboard.push({ flow: "payment", action: "Retry with Enter", result: "pass" });
    await interceptor.uninstall();
  } finally {
    await closeContext(holder);
  }
}

async function testPaymentFailureMode(browser, password, mode, resultKey) {
  const holder = await createAuthenticatedPage(browser, password);
  try {
    await openFixturePaymentSheet(holder.page);
    const submit = await prepareOnlinePayment(holder.page);
    const interceptor = await installMutationInterceptor(holder.page, { kind: "payment", mode });
    await submit.click();
    await waitForCount(interceptor.state, 1);
    await assertPaymentError(holder.page);
    assert.equal(holder.page.url(), `${BASE_URL}/member/packages`);
    results.paymentCounts[resultKey] = 1;
    recordPath("payment", interceptor.state.paths);
    assert.equal(interceptor.state.unknown.length, 0);
    await interceptor.uninstall();
  } finally {
    await closeContext(holder);
  }
}

async function testPaymentHandoff(browser, password) {
  const holder = await createAuthenticatedPage(browser, password);
  try {
    await openFixturePaymentSheet(holder.page);
    const submit = await prepareOnlinePayment(holder.page);
    const dialogText = await holder.page.getByRole("dialog").innerText();
    assert(dialogText.includes("redirected to the secure HYP payment page"));
    assert(!/payment (?:was|is) complete|payment success/i.test(dialogText));
    const interceptor = await installMutationInterceptor(holder.page, {
      kind: "payment",
      mode: "success",
    });
    await submit.click();
    await holder.page.waitForURL("**/__playwright_payment_stub");
    assert.equal(interceptor.state.count, 1);
    assert.equal(new URL(holder.page.url()).hostname, "127.0.0.1");
    results.paymentCounts["Successful handoff"] = 1;
    recordPath("payment", interceptor.state.paths);
    assert.equal(interceptor.state.unknown.length, 0);
    await interceptor.uninstall();
  } finally {
    await closeContext(holder);
  }
}

async function testSignedOutPaymentProtection(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await installLocalNetworkGuard(context, results.network);
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/member/packages`, { waitUntil: "networkidle" });
  assert(!new URL(page.url()).pathname.startsWith("/member/packages"));
  assert(!(await page.locator("body").innerText()).includes(FIXTURE_PLAN_NAME));
  await context.close();
}

async function testDeletionKeyboardAndNavigation(browser, password) {
  const holder = await createAuthenticatedPage(browser, password);
  try {
    const interceptor = await installMutationInterceptor(holder.page, {
      kind: "deletion",
      mode: "server-error",
    });
    const { trigger, dialog } = await openDeletionDialog(holder.page, "en", "Enter");
    assert.equal(interceptor.state.count, 0);
    results.deletionCounts["Open confirmation dialog"] = 0;
    const description = dialog.locator('[id][data-slot="alert-dialog-description"], [id]').filter({
      hasText: /account will not be deleted now/i,
    });
    assert(await description.first().isVisible(), "deletion_dialog_description_missing");
    await assertFocusedWithin(holder.page, dialog, "deletion_dialog_initial_focus_outside");
    const activeText = await holder.page.evaluate(() => document.activeElement?.textContent || "");
    assert(
      !activeText.includes("Submit deletion request"),
      "destructive_action_received_initial_focus",
    );
    const focusableCount = await dialog
      .locator("button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled])")
      .count();
    for (let index = 0; index < focusableCount + 2; index += 1) {
      await holder.page.keyboard.press("Tab");
      await assertFocusedWithin(holder.page, dialog, "deletion_dialog_tab_escape");
    }
    for (let index = 0; index < focusableCount + 2; index += 1) {
      await holder.page.keyboard.press("Shift+Tab");
      await assertFocusedWithin(holder.page, dialog, "deletion_dialog_shift_tab_escape");
    }
    await holder.page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    assert(await trigger.evaluate((element) => element === document.activeElement));
    assert.equal(interceptor.state.count, 0);
    results.deletionCounts["Escape from dialog"] = 0;
    const reopened = await openDeletionDialog(holder.page, "en", "Space");
    const cancel = reopened.dialog.getByRole("button", { name: COPY.en.cancel, exact: true });
    await cancel.focus();
    await cancel.press("Enter");
    await reopened.dialog.waitFor({ state: "hidden" });
    assert(await reopened.trigger.evaluate((element) => element === document.activeElement));
    assert.equal(interceptor.state.count, 0);
    results.deletionCounts["Cancel confirmation"] = 0;
    results.keyboard.push({
      flow: "deletion",
      action: "Enter/Space, Tab trap, Shift+Tab trap, Escape, Cancel, focus restoration",
      result: "pass",
    });
    await interceptor.uninstall();
  } finally {
    await closeContext(holder);
  }
}

async function testDeletionDuplicate(browser, password, scenario, activation) {
  const holder = await createAuthenticatedPage(browser, password);
  try {
    const { confirm } = await openDeletionDialog(holder.page);
    const interceptor = await installMutationInterceptor(holder.page, {
      kind: "deletion",
      mode: "delayed-error",
    });
    if (activation === "pointer") {
      const box = await confirm.boundingBox();
      assert(box, "deletion_confirm_geometry_missing");
      await Promise.all([
        holder.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2),
        holder.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2),
      ]);
    } else {
      await confirm.focus();
      await holder.page.keyboard.press(activation);
      await holder.page.keyboard.press(activation);
      await holder.page.keyboard.press(activation);
    }
    await waitForCount(interceptor.state, 1);
    assert(await confirm.isDisabled(), `deletion_${scenario}_not_disabled`);
    assert(!/success|deleted/i.test(await confirm.innerText()));
    results.deletionCounts[scenario] = 1;
    recordPath("deletion", interceptor.state.paths);
    interceptor.release();
    await assertDeletionError(holder.page);
    assert.equal(interceptor.state.count, 1, `deletion_${scenario}_duplicate_request`);
    assert.equal(interceptor.state.unknown.length, 0);
    results.keyboard.push({ flow: "deletion", action: scenario, result: "pass" });
    await interceptor.uninstall();
  } finally {
    await closeContext(holder);
  }
}

async function testDeletionSuccess(browser, password, mode = "success") {
  const holder = await createAuthenticatedPage(browser, password);
  try {
    const { confirm } = await openDeletionDialog(holder.page);
    const interceptor = await installMutationInterceptor(holder.page, { kind: "deletion", mode });
    await confirm.click();
    await waitForCount(interceptor.state, 1);
    const expected = mode === "duplicate-success" ? COPY.en.deleteDuplicate : COPY.en.deleteSuccess;
    const status = holder.page.getByRole("status").filter({ hasText: expected });
    await assertFeedbackFocus(holder.page, status);
    const statusText = await status.innerText();
    assert(!/account (?:was|is) deleted|account deleted/i.test(statusText));
    assert((await holder.page.locator("main").innerText()).includes("Member QA"));
    recordPath("deletion", interceptor.state.paths);
    if (mode === "success") {
      results.deletionCounts["Successful request"] = 1;
      await holder.page.reload({ waitUntil: "networkidle" });
      assert.equal(interceptor.state.count, 1);
      results.deletionCounts["Refresh after success"] = 0;
      await holder.page.goto(`${BASE_URL}/support`, { waitUntil: "networkidle" });
      await holder.page.goBack({ waitUntil: "networkidle" });
      assert.equal(interceptor.state.count, 1);
      results.deletionCounts["Browser back after success"] = 0;
    }
    assert.equal(interceptor.state.unknown.length, 0);
    await interceptor.uninstall();
  } finally {
    await closeContext(holder);
  }
}

async function testDeletionServerErrorRetry(browser, password) {
  const holder = await createAuthenticatedPage(browser, password);
  try {
    const { confirm } = await openDeletionDialog(holder.page);
    const interceptor = await installMutationInterceptor(holder.page, {
      kind: "deletion",
      sequence: ["server-error", "server-error"],
    });
    await confirm.click();
    await waitForCount(interceptor.state, 1);
    await assertDeletionError(holder.page);
    results.deletionCounts["Initial server error"] = 1;
    const retry = holder.page.getByRole("button", { name: COPY.en.retry, exact: true });
    await retry.focus();
    await retry.press("Enter");
    const retryDialog = holder.page.getByRole("alertdialog");
    await retryDialog.waitFor({ state: "visible" });
    await retryDialog.getByRole("button", { name: COPY.en.deleteSubmit, exact: true }).click();
    await waitForCount(interceptor.state, 2);
    await assertDeletionError(holder.page);
    results.deletionCounts["Retry after server error"] = 1;
    recordPath("deletion", interceptor.state.paths);
    assert.equal(interceptor.state.unknown.length, 0);
    results.keyboard.push({ flow: "deletion", action: "Retry with Enter", result: "pass" });
    await interceptor.uninstall();
  } finally {
    await closeContext(holder);
  }
}

async function testDeletionFailureMode(browser, password, mode, resultKey) {
  const holder = await createAuthenticatedPage(browser, password);
  try {
    const { confirm } = await openDeletionDialog(holder.page);
    const interceptor = await installMutationInterceptor(holder.page, { kind: "deletion", mode });
    await confirm.click();
    await waitForCount(interceptor.state, 1);
    await assertDeletionError(holder.page);
    assert((await holder.page.locator("main").innerText()).includes("Member QA"));
    results.deletionCounts[resultKey] = 1;
    recordPath("deletion", interceptor.state.paths);
    assert.equal(interceptor.state.unknown.length, 0);
    await interceptor.uninstall();
  } finally {
    await closeContext(holder);
  }
}

async function testSignedOutDeletionProtection(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await installLocalNetworkGuard(context, results.network);
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/member/account`, { waitUntil: "networkidle" });
  assert(!new URL(page.url()).pathname.startsWith("/member/account"));
  assert(!(await page.locator("body").innerText()).includes("Member QA"));
  await context.close();
}

async function runAxe(page, label, lang, viewport) {
  const scan = await new AxeBuilder({ page }).analyze();
  const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  for (const violation of scan.violations) {
    if (violation.impact && violation.impact in counts) counts[violation.impact] += 1;
  }
  results.axe.push({
    label,
    lang,
    viewport,
    ...counts,
    rules: scan.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      targets: violation.nodes.map((node) => node.target),
      summaries: violation.nodes.map((node) => node.failureSummary),
    })),
  });
  assert.equal(counts.critical, 0, `axe_critical_${label}_${lang}_${viewport}`);
  assert.equal(counts.serious, 0, `axe_serious_${label}_${lang}_${viewport}`);
}

async function screenshot(page, state, lang, viewport, enabled) {
  if (!enabled) return;
  await page.screenshot({
    path: resolve(SCREENSHOT_DIR, `${state}-${lang}-${viewport.width}x${viewport.height}.png`),
    fullPage: true,
  });
}

async function assertDialogInViewport(page, dialog) {
  const deadline = Date.now() + 1_000;
  let geometry;
  do {
    geometry = await dialog.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: innerWidth,
        height: innerHeight,
      };
    });
    if (
      geometry.left >= -1 &&
      geometry.right <= geometry.width + 1 &&
      geometry.top >= -1 &&
      geometry.bottom <= geometry.height + 1
    ) {
      return;
    }
    await page.waitForTimeout(50);
  } while (Date.now() < deadline);

  assert.fail(`dialog_overflow_after_settle:${JSON.stringify(geometry)}`);
}

async function runResponsiveInteractionGroup(browser, password, config) {
  const holder = await createAuthenticatedPage(browser, password, config);
  const viewportLabel = `${config.viewport.width}x${config.viewport.height}`;
  const lang = config.lang;
  const copy = COPY[lang];
  try {
    await holder.page.goto(`${BASE_URL}/member/packages`, { waitUntil: "networkidle" });
    await assertDocumentLanguage(holder.page, lang);
    assert((await holder.page.locator("main").innerText()).includes(FIXTURE_PLAN_NAME));
    await screenshot(holder.page, "packages-loaded", lang, config.viewport, config.capture);
    if (config.axe) await runAxe(holder.page, "packages-loaded", lang, viewportLabel);

    const { dialog: paymentDialog } = await openFixturePaymentSheet(holder.page, lang);
    await assertDocumentLanguage(holder.page, lang);
    assert.equal(await paymentDialog.getAttribute("dir"), lang === "en" ? "ltr" : "rtl");
    const price = paymentDialog.locator('bdi[dir="auto"]').filter({ hasText: FIXTURE_PRICE });
    assert.equal(await price.count(), 1, `bidi_price_isolation_count_${lang}_${viewportLabel}`);
    assert(await price.isVisible(), `bidi_price_isolation_${lang}_${viewportLabel}`);
    const paymentSubmit = await prepareOnlinePayment(holder.page, lang);
    await assertDialogInViewport(holder.page, paymentDialog);
    await screenshot(holder.page, "payment-summary", lang, config.viewport, config.capture);
    if (config.axe) await runAxe(holder.page, "payment-summary", lang, viewportLabel);

    const paymentInterceptor = await installMutationInterceptor(holder.page, {
      kind: "payment",
      mode: "delayed-error",
    });
    await paymentSubmit.click();
    await waitForCount(paymentInterceptor.state, 1);
    assert(await paymentSubmit.isDisabled());
    await screenshot(holder.page, "payment-loading", lang, config.viewport, config.capture);
    if (config.axe) await runAxe(holder.page, "payment-loading", lang, viewportLabel);
    paymentInterceptor.release();
    await assertPaymentError(holder.page, lang);
    await assertDocumentLanguage(holder.page, lang);
    await screenshot(holder.page, "payment-error", lang, config.viewport, config.capture);
    if (config.axe) await runAxe(holder.page, "payment-error", lang, viewportLabel);
    recordPath("payment", paymentInterceptor.state.paths);
    await paymentInterceptor.uninstall();

    await holder.page.goto(`${BASE_URL}/member/account`, { waitUntil: "networkidle" });
    await assertDocumentLanguage(holder.page, lang);
    assert((await holder.page.locator("main").innerText()).includes("Member QA"));
    const deleteTrigger = holder.page.getByRole("button", {
      name: copy.deleteTrigger,
      exact: true,
    });
    const triggerBox = await deleteTrigger.boundingBox();
    assert(triggerBox && triggerBox.height >= 44 && triggerBox.width >= 44, "delete_touch_target");
    await screenshot(holder.page, "account-loaded", lang, config.viewport, config.capture);
    if (config.axe) await runAxe(holder.page, "account-loaded", lang, viewportLabel);

    const { dialog: deletionDialog, confirm } = await openDeletionDialog(holder.page, lang);
    await assertDialogInViewport(holder.page, deletionDialog);
    await assertFocusedWithin(holder.page, deletionDialog, "responsive_dialog_focus_outside");
    await screenshot(holder.page, "deletion-dialog", lang, config.viewport, config.capture);
    if (config.axe) await runAxe(holder.page, "deletion-dialog", lang, viewportLabel);

    const deletionSuccess = await installMutationInterceptor(holder.page, {
      kind: "deletion",
      mode: "delayed-success",
    });
    await confirm.click();
    await waitForCount(deletionSuccess.state, 1);
    assert(await confirm.isDisabled());
    await screenshot(holder.page, "deletion-loading", lang, config.viewport, config.capture);
    if (config.axe) await runAxe(holder.page, "deletion-loading", lang, viewportLabel);
    deletionSuccess.release();
    const success = holder.page.getByRole("status").filter({ hasText: copy.deleteSuccess });
    await assertFeedbackFocus(holder.page, success);
    await assertDocumentLanguage(holder.page, lang);
    await screenshot(holder.page, "deletion-success", lang, config.viewport, config.capture);
    if (config.axe) await runAxe(holder.page, "deletion-success", lang, viewportLabel);
    recordPath("deletion", deletionSuccess.state.paths);
    await deletionSuccess.uninstall();

    await holder.page.goto(`${BASE_URL}/member/account`, { waitUntil: "networkidle" });
    const errorDialog = await openDeletionDialog(holder.page, lang);
    const deletionError = await installMutationInterceptor(holder.page, {
      kind: "deletion",
      mode: "server-error",
    });
    await errorDialog.confirm.click();
    await waitForCount(deletionError.state, 1);
    await assertDeletionError(holder.page, lang);
    await assertDocumentLanguage(holder.page, lang);
    await screenshot(holder.page, "deletion-error", lang, config.viewport, config.capture);
    if (config.axe) await runAxe(holder.page, "deletion-error", lang, viewportLabel);
    recordPath("deletion", deletionError.state.paths);
    await deletionError.uninstall();

    results.responsive.push({
      lang,
      viewport: viewportLabel,
      states: 9,
      noHorizontalOverflow: true,
      rtlPriceIsolation: lang === "en" ? "not-applicable" : true,
      result: "pass",
    });
  } finally {
    await closeContext(holder);
  }
}

async function runResponsiveLoadedOnly(browser, password, config) {
  const holder = await createAuthenticatedPage(browser, password, config);
  const viewportLabel = `${config.viewport.width}x${config.viewport.height}`;
  try {
    await holder.page.goto(`${BASE_URL}/member/packages`, { waitUntil: "networkidle" });
    await assertDocumentLanguage(holder.page, config.lang);
    const { dialog } = await openFixturePaymentSheet(holder.page, config.lang);
    await assertDialogInViewport(holder.page, dialog);
    await assertDocumentLanguage(holder.page, config.lang);
    await holder.page.getByRole("button", { name: COPY[config.lang].cancel, exact: true }).click();
    const deletion = await openDeletionDialog(holder.page, config.lang);
    await assertDialogInViewport(holder.page, deletion.dialog);
    await assertDocumentLanguage(holder.page, config.lang);
    results.responsive.push({
      lang: config.lang,
      viewport: viewportLabel,
      states: 3,
      noHorizontalOverflow: true,
      rtlPriceIsolation: config.lang === "en" ? "not-applicable" : true,
      result: "pass",
    });
  } finally {
    await closeContext(holder);
  }
}

function serializableResults() {
  return {
    ...results,
    finishedAt: new Date().toISOString(),
    network: {
      localHosts: [...results.network.localHosts].sort(),
      blockedRemote: [...results.network.blockedRemote].sort(),
    },
  };
}

async function main() {
  requireLoopbackUrl();
  const environment = await fixtureEnvironment();
  assert(environment.QA_MEMBER_UI_UX_PASSWORD, "fixture_password_missing");
  await mkdir(SCREENSHOT_DIR, { recursive: true });
  const browser = await chromium.launch(chromeLaunchOptions(true));
  try {
    await testPaymentNavigationSafety(browser, environment.QA_MEMBER_UI_UX_PASSWORD);
    await testPaymentDuplicate(
      browser,
      environment.QA_MEMBER_UI_UX_PASSWORD,
      "Rapid double-click",
      "pointer",
    );
    await testPaymentDuplicate(
      browser,
      environment.QA_MEMBER_UI_UX_PASSWORD,
      "Repeated Enter",
      "Enter",
    );
    await testPaymentDuplicate(
      browser,
      environment.QA_MEMBER_UI_UX_PASSWORD,
      "Repeated Space",
      "Space",
    );
    await testPaymentServerErrorRetry(browser, environment.QA_MEMBER_UI_UX_PASSWORD);
    await testPaymentFailureMode(
      browser,
      environment.QA_MEMBER_UI_UX_PASSWORD,
      "network-error",
      "Network error",
    );
    await testPaymentFailureMode(
      browser,
      environment.QA_MEMBER_UI_UX_PASSWORD,
      "invalid-response",
      "Invalid response",
    );
    await testPaymentFailureMode(
      browser,
      environment.QA_MEMBER_UI_UX_PASSWORD,
      "missing-redirect",
      "Missing redirect URL",
    );
    await testPaymentFailureMode(
      browser,
      environment.QA_MEMBER_UI_UX_PASSWORD,
      "unknown-status",
      "Unknown status",
    );
    await testPaymentFailureMode(
      browser,
      environment.QA_MEMBER_UI_UX_PASSWORD,
      "invalid-json",
      "Invalid JSON",
    );
    await testPaymentHandoff(browser, environment.QA_MEMBER_UI_UX_PASSWORD);
    await testSignedOutPaymentProtection(browser);

    await testDeletionKeyboardAndNavigation(browser, environment.QA_MEMBER_UI_UX_PASSWORD);
    await testDeletionDuplicate(
      browser,
      environment.QA_MEMBER_UI_UX_PASSWORD,
      "Rapid double-click",
      "pointer",
    );
    await testDeletionDuplicate(
      browser,
      environment.QA_MEMBER_UI_UX_PASSWORD,
      "Repeated Enter",
      "Enter",
    );
    await testDeletionDuplicate(
      browser,
      environment.QA_MEMBER_UI_UX_PASSWORD,
      "Repeated Space",
      "Space",
    );
    await testDeletionSuccess(browser, environment.QA_MEMBER_UI_UX_PASSWORD, "success");
    await testDeletionSuccess(browser, environment.QA_MEMBER_UI_UX_PASSWORD, "duplicate-success");
    await testDeletionServerErrorRetry(browser, environment.QA_MEMBER_UI_UX_PASSWORD);
    await testDeletionFailureMode(
      browser,
      environment.QA_MEMBER_UI_UX_PASSWORD,
      "validation-error",
      "Validation error",
    );
    await testDeletionFailureMode(
      browser,
      environment.QA_MEMBER_UI_UX_PASSWORD,
      "network-error",
      "Network error",
    );
    await testDeletionFailureMode(
      browser,
      environment.QA_MEMBER_UI_UX_PASSWORD,
      "invalid-success",
      "Invalid response",
    );
    await testDeletionFailureMode(
      browser,
      environment.QA_MEMBER_UI_UX_PASSWORD,
      "invalid-json",
      "Invalid JSON",
    );
    await testSignedOutDeletionProtection(browser);

    const fullMatrix = [
      ...["en", "he", "ar"].flatMap((lang) => [
        { lang, viewport: { width: 390, height: 844 }, capture: true, axe: lang === "en" },
        { lang, viewport: { width: 1440, height: 900 }, capture: true, axe: lang !== "he" },
      ]),
      { lang: "en", viewport: { width: 320, height: 720 }, capture: false, axe: false },
      { lang: "he", viewport: { width: 320, height: 720 }, capture: true, axe: false },
      { lang: "ar", viewport: { width: 320, height: 720 }, capture: true, axe: true },
      { lang: "en", viewport: { width: 768, height: 1024 }, capture: true, axe: false },
    ];
    for (const config of fullMatrix) {
      await runResponsiveInteractionGroup(browser, environment.QA_MEMBER_UI_UX_PASSWORD, config);
    }
    for (const viewport of [
      { width: 360, height: 800 },
      { width: 430, height: 932 },
      { width: 1366, height: 768 },
    ]) {
      await runResponsiveLoadedOnly(browser, environment.QA_MEMBER_UI_UX_PASSWORD, {
        lang: "en",
        viewport,
      });
    }
  } finally {
    await browser.close();
  }

  assert(results.paymentPath?.startsWith("/_serverFn/"));
  assert(results.deletionPath?.startsWith("/_serverFn/"));
  assert.notEqual(results.paymentPath, results.deletionPath, "mutation_paths_must_be_distinct");
  assert.equal(results.network.blockedRemote.size, 0, "unexpected_remote_request_attempted");
  assert(!results.consoleErrors.some((message) => /eyJ|authorization|bearer/i.test(message)));
  await writeFile(RESULT_PATH, `${JSON.stringify(serializableResults(), null, 2)}\n`, "utf8");
  console.log(
    JSON.stringify({
      paymentPath: results.paymentPath,
      deletionPath: results.deletionPath,
      paymentCounts: results.paymentCounts,
      deletionCounts: results.deletionCounts,
      responsiveRows: results.responsive.length,
      axeRows: results.axe.length,
      localHosts: [...results.network.localHosts].sort(),
      blockedRemoteCount: results.network.blockedRemote.size,
    }),
  );
}

main().catch(async (error) => {
  try {
    await writeFile(
      RESULT_PATH,
      `${JSON.stringify({ ...serializableResults(), error: sanitizeDiagnostic(error) }, null, 2)}\n`,
      "utf8",
    );
  } catch {
    // The primary failure remains the useful diagnostic.
  }
  console.error(`member-ui-ux-release-gate-failed:${sanitizeDiagnostic(error)}`);
  process.exit(1);
});
