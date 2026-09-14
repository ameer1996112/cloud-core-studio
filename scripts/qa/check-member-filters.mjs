// Read-only UI regression against the local member review backend.
// QA_BASE_URL, QA_STORAGE_STATE, QA_CHROME_PATH; never books or purchases.
import { chromium } from "playwright";
import assert from "node:assert/strict";
const base = process.env.QA_BASE_URL || "http://127.0.0.1:8087";
assert(
  ["127.0.0.1", "localhost"].includes(new URL(base).hostname),
  "Use an isolated local review server",
);
const browser = await chromium.launch({
  headless: true,
  ...(process.env.QA_CHROME_PATH ? { executablePath: process.env.QA_CHROME_PATH } : {}),
});
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    ...(process.env.QA_STORAGE_STATE ? { storageState: process.env.QA_STORAGE_STATE } : {}),
  });
  await context.addInitScript(() => {
    localStorage.setItem("cc_lang", "he");
    document.cookie = "cc_lang=he; path=/";
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${base}/member/schedule`, { waitUntil: "networkidle" });
  const trigger = page.locator(".schedule-tools-trigger");
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  const dates = dialog.locator(".member-schedule-segmented button");
  assert.equal(await dates.count(), 4, "All date scopes remain available");
  await dates.first().click();
  assert.equal(await dates.first().getAttribute("aria-pressed"), "true");
  await dialog.locator(".schedule-tools-clear").click();
  assert.equal(await dates.last().getAttribute("aria-pressed"), "true", "Reset restores all dates");
  const firstOption = dialog.locator(".schedule-option-group").first().locator("button").nth(1);
  if (await firstOption.count()) {
    await firstOption.click();
    assert.equal(await firstOption.getAttribute("aria-pressed"), "true");
    await dialog.locator(".schedule-tools-clear").click();
    assert.equal(await firstOption.getAttribute("aria-pressed"), "false");
  }
  await dialog.evaluate((el) =>
    Promise.all(
      el
        .getAnimations({ subtree: true })
        .filter((a) => a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => {})),
    ),
  );
  const close = dialog.getByRole("button", { name: /Close|סג|إغلاق/ });
  const box = await close.boundingBox();
  assert(box && box.width >= 44 && box.height >= 44, "Close control is at least 44×44");
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  await page.waitForFunction(() => document.activeElement?.matches(".schedule-tools-trigger"));
  assert(await trigger.evaluate((el) => document.activeElement === el), "Escape restores focus");
  const search = page.locator(".schedule-tools-search input");
  await search.fill("zz-no-matching-class-qa");
  await page.waitForFunction(() => document.querySelectorAll(".ref-session").length === 0);
  await search.fill("");
  assert.deepEqual(errors, []);
  console.log(
    "PASS: date and category selections, reset, search, 44px close control, Escape/focus; no transactions.",
  );
} finally {
  await browser.close();
}
