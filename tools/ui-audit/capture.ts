import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import { preview, type PreviewServer } from "vite";
import { auditScenarios } from "./fixtures";
import type { AuditScenario, AuditViewport, VisualAuditScenario } from "./types";
import { validateCurrentManifest } from "./validate-manifest";

const projectRoot = resolve(import.meta.dir, "../..");
const outputRoot = resolve(projectRoot, "artifacts/ui-audit/current");
const screenshotRoot = resolve(outputRoot, "screenshots");

export function routeFilename(route: string): string {
  return (
    route
      .toLowerCase()
      .replace(/\$/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "root"
  );
}

export function screenshotFilename(
  scenario: AuditScenario,
  language: string,
  viewport: string,
): string {
  return `${scenario.role}-${routeFilename(scenario.route)}-${language}-${viewport}-${scenario.state}.png`;
}

export function viewportSize(viewport: AuditViewport): { width: number; height: number } {
  const [width, height] = viewport.split("x").map(Number);
  return { width, height };
}

const representativeContent = new Map<string, string>([
  ["guest-auth-mode-signup-default", "Reserve your space"],
  ["guest-member-schedule-empty", "The schedule will be updated soon"],
  ["guest-payment-result-status-success-success", "Payment received"],
  ["guest-support-default", "cloudandcorestudio@gmail.com"],
  ["guest-app-default", "Aerial Yoga and Pilates in Hurfeish — Easy Booking Through the App"],
]);

export async function assertEvidencePage(
  page: Page,
  scenario: VisualAuditScenario,
  language: string,
): Promise<void> {
  const presentation = page.locator(scenario.evidence.marker);
  await presentation.waitFor({ state: "visible", timeout: 5_000 });
  const content = (await page.locator("main").innerText()).trim();
  if (content.length < 30) throw new Error(`${scenario.scenarioId}: fixture content is incomplete`);
  if (content.includes("Deterministic") || content.includes("UI evidence harness"))
    throw new Error(`${scenario.scenarioId}: placeholder metadata leaked into evidence`);
  if ((await page.locator("main h1").count()) !== 1)
    throw new Error(`${scenario.scenarioId}: route presentation must expose exactly one h1`);
  const expected = language === "en" ? representativeContent.get(scenario.scenarioId) : undefined;
  if (expected && !content.includes(expected))
    throw new Error(`${scenario.scenarioId}: missing representative content ${expected}`);
}

async function launchBrowser(): Promise<Browser> {
  const candidates = [
    process.env.PLAYWRIGHT_CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    chromium.executablePath(),
  ].filter((candidate): candidate is string => Boolean(candidate));
  const errors: string[] = [];
  for (const executablePath of [...new Set(candidates)]) {
    if (!existsSync(executablePath)) continue;
    try {
      return await chromium.launch({ executablePath, headless: true, timeout: 15_000 });
    } catch (error) {
      errors.push(`${executablePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(
    `No usable Chromium executable. Checked: ${candidates.join(", ")}.${errors.length ? ` Launch errors: ${errors.join(" | ")}` : ""}`,
  );
}

async function startPreview(): Promise<{ server: PreviewServer; url: string }> {
  if (!existsSync(resolve(outputRoot, "index.html")))
    throw new Error("UI audit build is missing; run bun run ui-audit:build first");
  const server = await preview({
    configFile: resolve(import.meta.dir, "vite.config.ts"),
    mode: "ui-audit",
    logLevel: "error",
    preview: { host: "127.0.0.1", port: 4179, strictPort: false },
  });
  const url = server.resolvedUrls?.local[0];
  if (!url) {
    server.httpServer.close();
    throw new Error("Vite preview did not expose a loopback URL");
  }
  return { server, url: url.replace(/\/$/, "") };
}

async function main(): Promise<void> {
  const manifestErrors = validateCurrentManifest(projectRoot);
  if (manifestErrors.length) throw new Error(manifestErrors.join("\n"));
  rmSync(screenshotRoot, { recursive: true, force: true });
  mkdirSync(screenshotRoot, { recursive: true });

  const { server, url } = await startPreview();
  const files: string[] = [];
  let browser: Browser | undefined;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage({ reducedMotion: "reduce" });
    const visualScenarios = auditScenarios
      .filter((scenario) => scenario.kind === "visual")
      .sort((left, right) => left.scenarioId.localeCompare(right.scenarioId));
    const expectedCount = visualScenarios.reduce(
      (count, scenario) => count + scenario.languages.length * scenario.viewports.length,
      0,
    );
    for (const scenario of visualScenarios) {
      for (const language of [...scenario.languages].sort()) {
        for (const viewport of [...scenario.viewports].sort()) {
          await page.setViewportSize(viewportSize(viewport));
          const query = new URLSearchParams({
            scenario: scenario.scenarioId,
            language,
            evidence: "1",
          });
          await page.goto(`${url}/?${query}`, { waitUntil: "load", timeout: 15_000 });
          await page.locator("main").waitFor({ state: "visible", timeout: 5_000 });
          await assertEvidencePage(page, scenario, language);
          const mainCount = await page.locator("main").count();
          if (mainCount !== scenario.expectedLandmarks.main)
            throw new Error(
              `${scenario.scenarioId}: expected one main landmark, found ${mainCount}`,
            );
          const filename = screenshotFilename(scenario, language, viewport);
          await page.screenshot({
            path: resolve(screenshotRoot, filename),
            animations: "disabled",
            fullPage: true,
          });
          files.push(filename);
          if (files.length % 24 === 0) console.log(`Captured ${files.length}/${expectedCount}`);
        }
      }
    }
  } finally {
    await browser?.close();
    server.httpServer.close();
  }

  writeFileSync(
    resolve(outputRoot, "capture-manifest.json"),
    `${JSON.stringify({ count: files.length, files }, null, 2)}\n`,
  );
  console.log(`Captured ${files.length} deterministic UI audit screenshots`);
}

if (import.meta.main) await main();
