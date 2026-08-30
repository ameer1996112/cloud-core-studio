import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { build, preview } from "vite";

const auditRoot = resolve(fileURLToPath(new URL(".", import.meta.url)));
const outputRoot = mkdtempSync(resolve(tmpdir(), "member-home-layout-"));

async function launchBrowser() {
  const candidates = [
    process.env.PLAYWRIGHT_CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    chromium.executablePath(),
  ].filter(Boolean);

  for (const executablePath of [...new Set(candidates)]) {
    if (!existsSync(executablePath)) continue;
    try {
      return await chromium.launch({ executablePath, headless: true, timeout: 15_000 });
    } catch {
      // Try the next locally available browser.
    }
  }
  throw new Error(`No usable Chromium executable. Checked: ${candidates.join(", ")}`);
}

let browser;
let server;
try {
  await build({
    configFile: resolve(auditRoot, "vite.config.ts"),
    mode: "ui-audit",
    logLevel: "error",
    build: {
      outDir: outputRoot,
      emptyOutDir: true,
      rollupOptions: { input: resolve(auditRoot, "member-home-layout-fixture.html") },
    },
  });
  server = await preview({
    configFile: false,
    root: auditRoot,
    logLevel: "error",
    build: { outDir: outputRoot },
    preview: { host: "127.0.0.1", port: 4189, strictPort: false },
  });
  const url = server.resolvedUrls?.local[0];
  if (!url) throw new Error("Member home layout fixture server did not expose a loopback URL");

  browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${url}member-home-layout-fixture.html`, {
    waitUntil: "load",
    timeout: 15_000,
  });
  await page
    .locator("[data-member-home-layout-fixture]")
    .waitFor({ state: "visible", timeout: 5_000 });

  const geometry = await page.evaluate(() => {
    const rect = (selector) => {
      const element = document.querySelector(selector);
      if (!element) throw new Error(`Missing fixture element: ${selector}`);
      const box = element.getBoundingClientRect();
      return { left: box.left, right: box.right, width: box.width };
    };
    const style = (selector) => {
      const element = document.querySelector(selector);
      if (!element) throw new Error(`Missing fixture element: ${selector}`);
      const computed = getComputedStyle(element);
      return {
        display: computed.display,
        gridTemplateColumns: computed.gridTemplateColumns,
      };
    };
    return {
      viewportWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      intro: rect(".member-page-intro"),
      copy: rect(".member-page-intro__copy"),
      aside: rect(".member-page-intro__aside"),
      packageMini: rect(".member-home-package-mini"),
      introStyle: style(".member-page-intro"),
      packageMiniStyle: style(".member-home-package-mini"),
    };
  });

  const failures = [];
  if (geometry.scrollWidth > geometry.viewportWidth)
    failures.push(
      `page overflows horizontally (${geometry.scrollWidth}px > ${geometry.viewportWidth}px)`,
    );
  if (geometry.copy.width < geometry.intro.width * 0.9)
    failures.push(`intro copy is only ${geometry.copy.width}px of ${geometry.intro.width}px`);
  if (geometry.aside.width < geometry.intro.width * 0.9)
    failures.push(`package aside is only ${geometry.aside.width}px of ${geometry.intro.width}px`);
  if (geometry.packageMini.width < geometry.aside.width * 0.98)
    failures.push(
      `package card collapses to ${geometry.packageMini.width}px inside ${geometry.aside.width}px aside`,
    );
  if (geometry.packageMini.left < 0 || geometry.packageMini.right > geometry.viewportWidth)
    failures.push("package card is clipped outside the phone viewport");
  if (geometry.introStyle.display !== "grid")
    failures.push(`member intro is ${geometry.introStyle.display}, expected the designed grid`);
  if (geometry.introStyle.gridTemplateColumns.split(" ").length !== 1)
    failures.push(
      `member intro keeps multiple columns at phone width (${geometry.introStyle.gridTemplateColumns})`,
    );
  if (geometry.packageMiniStyle.display !== "flex")
    failures.push(
      `empty package card is ${geometry.packageMiniStyle.display}, expected a stable flex layout`,
    );

  if (failures.length) {
    throw new Error(`Member home 390x844 layout regression:\n- ${failures.join("\n- ")}`);
  }
  if (process.env.MEMBER_HOME_LAYOUT_SCREENSHOT) {
    await page.screenshot({
      path: process.env.MEMBER_HOME_LAYOUT_SCREENSHOT,
      fullPage: true,
      animations: "disabled",
    });
  }
  console.log(`Member home 390x844 layout passed: ${JSON.stringify(geometry)}`);
} finally {
  await browser?.close();
  server?.httpServer.close();
  rmSync(outputRoot, { recursive: true, force: true });
}
