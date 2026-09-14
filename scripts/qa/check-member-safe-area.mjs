// Read-only browser regression for edge-to-edge iPhone layouts.
// QA_BASE_URL, optional QA_STORAGE_STATE, QA_SCREENSHOTS_DIR, QA_CHROME_PATH.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

const base = process.env.QA_BASE_URL || "http://127.0.0.1:8087";
const output = process.env.QA_SCREENSHOTS_DIR;
if (output) await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.QA_CHROME_PATH ? { executablePath: process.env.QA_CHROME_PATH } : {}),
});
try {
  let context = await browser.newContext({
    locale: "he-IL",
    ...(process.env.QA_STORAGE_STATE ? { storageState: process.env.QA_STORAGE_STATE } : {}),
  });
  let page = await context.newPage();
  let cdp = await context.newCDPSession(page);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const routes = process.env.QA_STORAGE_STATE
    ? ["/member", "/member/packages", "/auth"]
    : ["/auth"];
  for (const route of routes) {
    if (route === "/auth") {
      await context.close();
      context = await browser.newContext({ locale: "he-IL" });
      page = await context.newPage();
      cdp = await context.newCDPSession(page);
      page.on("pageerror", (error) => errors.push(error.message));
    }
    for (const [name, width, height, top] of [
      ["mobile", 390, 844, 0],
      ["island", 390, 844, 59],
      ["large-island", 430, 932, 62],
      ["desktop", 1440, 1000, 0],
    ]) {
      await page.setViewportSize({ width, height });
      await cdp.send("Emulation.setSafeAreaInsetsOverride", {
        insets: { top, bottom: top ? 34 : 0, left: 0, right: 0 },
      });
      await page.goto(base + route, { waitUntil: "networkidle" });
      assert.equal(new URL(page.url()).pathname, route, "Expected the real requested page");
      await page.evaluate(() => document.fonts.ready);
      const auth = route === "/auth";
      const selector =
        auth && width < 768
          ? ".ref-auth-header .auth-masthead-logo"
          : auth
            ? ".ref-auth-header"
            : ".studio-member-header-inner";
      const box = await page.locator(selector).boundingBox();
      assert(box, "Shared header must be visible");
      if (width < 768) {
        const minimum = top + (auth ? 16 : 10);
        assert(
          box.y >= minimum - 1,
          `${route}: header at ${box.y}, must clear safe area at ${minimum}`,
        );
        if (auth) {
          const controls = page.locator(".auth-language-switcher");
          const controlsBox = await controls.boundingBox();
          assert(
            controlsBox && controlsBox.y >= top,
            "Auth language controls must clear the safe area",
          );
          assert(
            controlsBox.x + controlsBox.width <= box.x ||
              box.x + box.width <= controlsBox.x ||
              controlsBox.y >= box.y + box.height ||
              box.y >= controlsBox.y + controlsBox.height,
            "Auth logo and language controls must not overlap",
          );
        }
      }
      assert(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        "No horizontal overflow",
      );
      if (output)
        await page.screenshot({
          path: `${output}/${route.split("/").filter(Boolean).join("-")}-${name}.png`,
        });
      console.log(
        JSON.stringify({ route, name, safeAreaTop: top, headerTop: box.y, passed: true }),
      );
    }
  }
  assert.deepEqual(errors, [], "No page errors");
} finally {
  await browser.close();
}
