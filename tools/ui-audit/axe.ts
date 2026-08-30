import AxeBuilder from "@axe-core/playwright";
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, type Browser } from "playwright";
import { preview, type PreviewServer } from "vite";
import { assertEvidencePage, viewportSize } from "./capture";
import { auditScenarios } from "./fixtures";
import { validateCurrentManifest } from "./validate-manifest";

type AxeRecord = {
  scenarioId: string;
  language: string;
  viewport: string;
  ruleId: string;
  impact: string | null;
  selector: readonly string[];
  helpUrl: string;
};

const projectRoot = resolve(import.meta.dir, "../..");
const outputRoot = resolve(projectRoot, "artifacts/ui-audit/current");

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
  throw new Error(`No usable Chromium executable for axe. ${errors.join(" | ")}`);
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
  const { server, url } = await startPreview();
  const records: AxeRecord[] = [];
  let scans = 0;
  let browser: Browser | undefined;
  try {
    browser = await launchBrowser();
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    const visualScenarios = auditScenarios
      .filter((scenario) => scenario.kind === "visual")
      .sort((left, right) => left.scenarioId.localeCompare(right.scenarioId));
    const expectedScans = visualScenarios.reduce(
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
          const result = await new AxeBuilder({ page }).analyze();
          scans += 1;
          if (scans % 24 === 0) console.log(`Axe scanned ${scans}/${expectedScans}`);
          for (const violation of result.violations) {
            for (const node of violation.nodes) {
              records.push({
                scenarioId: scenario.scenarioId,
                language,
                viewport,
                ruleId: violation.id,
                impact: node.impact ?? violation.impact,
                selector: node.target,
                helpUrl: violation.helpUrl,
              });
            }
          }
        }
      }
    }
    await context.close();
  } finally {
    await browser?.close();
    server.httpServer.close();
  }

  records.sort((left, right) =>
    `${left.scenarioId}|${left.language}|${left.viewport}|${left.ruleId}|${left.selector.join("|")}`.localeCompare(
      `${right.scenarioId}|${right.language}|${right.viewport}|${right.ruleId}|${right.selector.join("|")}`,
    ),
  );
  const seriousOrCritical = records.filter(
    (record) => record.impact === "serious" || record.impact === "critical",
  );
  writeFileSync(
    resolve(outputRoot, "accessibility.json"),
    `${JSON.stringify({ scans, violationCount: records.length, seriousOrCriticalCount: seriousOrCritical.length, results: records }, null, 2)}\n`,
  );
  if (seriousOrCritical.length)
    throw new Error(
      `${seriousOrCritical.length} serious/critical axe violations; see artifacts/ui-audit/current/accessibility.json`,
    );
  console.log(
    `Axe passed ${scans} scenario/language/viewport scans with zero serious or critical violations`,
  );
}

if (import.meta.main) await main();
