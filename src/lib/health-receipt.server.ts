import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { healthReceiptHtml, type HealthReceipt } from "./health-receipt";

const require = createRequire(import.meta.url);
// Bound Chromium memory use per server process. Callers can retry while another PDF renders.
let rendering = false;
export async function renderHealthReceipt(receipt: HealthReceipt): Promise<Buffer> {
  if (rendering) throw new Error("Receipt renderer busy");
  rendering = true;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  try {
    const fonts = [
      "@fontsource/assistant/files/assistant-latin-400-normal.woff2",
      "@fontsource/assistant/files/assistant-hebrew-400-normal.woff2",
      "@fontsource/noto-sans-arabic/files/noto-sans-arabic-arabic-400-normal.woff2",
    ];
    const css = (
      await Promise.all(
        fonts.map(
          async (file, index) =>
            `@font-face { font-family: Receipt; unicode-range: ${["U+0000-024F", "U+0590-05FF", "U+0600-06FF,U+0750-077F,U+08A0-08FF,U+FB50-FDFF,U+FE70-FEFF"][index]}; src: url(data:font/woff2;base64,${(await readFile(require.resolve(file))).toString("base64")}) format('woff2'); }`,
        ),
      )
    ).join("\n");
    browser = await chromium.launch({
      headless: true,
      timeout: 15000,
      executablePath: process.env.HEALTH_PDF_CHROMIUM_PATH || undefined,
      args: ["--disable-dev-shm-usage", "--disable-background-networking"],
    });
    const instance = browser;
    deadline = setTimeout(() => void instance.close().catch(() => {}), 15000);
    const context = await browser.newContext({
      javaScriptEnabled: false,
      serviceWorkers: "block",
      acceptDownloads: false,
    });
    await context.route("**/*", (route) => route.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    await page.setContent(healthReceiptHtml(receipt, css), { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    // No file path, cookies, credentials, remote assets, tracing, or persisted PDF.
    return await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      tagged: true,
    });
  } finally {
    if (deadline) clearTimeout(deadline);
    await browser?.close().catch(() => {});
    rendering = false;
  }
}
