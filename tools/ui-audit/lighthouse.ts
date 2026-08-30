import AxeBuilder from "@axe-core/playwright";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, relative, resolve, sep } from "node:path";
import lighthouse from "lighthouse";
import { launch as launchChrome, type LaunchedChrome } from "chrome-launcher";
import { chromium, type Browser } from "playwright";
import { RouteDomAudit, RouteDomGatherer } from "./lighthouse-route-dom.mjs";

export type AuditLanguage = "he" | "ar" | "en";

export type LighthouseCase = {
  id: string;
  route: string;
  language: AuditLanguage;
};

export type LighthouseMeasurement = LighthouseCase & {
  lcpMs: number;
  cls: number;
  accessibilityScore: number;
  seriousOrCriticalAxeViolations: number;
};

export type AuditedDom = {
  finalPathname: string;
  expectedMarkerVisible: boolean;
  rootErrorBoundaryVisible: boolean;
  documentLanguage: string;
  documentDirection: string;
};

export const lighthouseCases: readonly LighthouseCase[] = [
  ...(["he", "ar", "en"] as const).map((language) => ({
    id: `home-${language}`,
    route: "/",
    language,
  })),
  ...(["he", "ar", "en"] as const).map((language) => ({
    id: `auth-${language}`,
    route: "/auth",
    language,
  })),
  ...(["he", "ar", "en"] as const).map((language) => ({
    id: `schedule-${language}`,
    route: "/member/schedule",
    language,
  })),
];

const LCP_LIMIT_MS = 2_500;
const CLS_LIMIT = 0.1;
const ROOT_ERROR_BOUNDARY_SELECTOR =
  "main#main-content > div.max-w-md.text-center > h1.font-display.text-3xl";

function normalizePath(path: string): string {
  return path.split(sep).join("/");
}

export function assertLighthouseBudgets(measurements: readonly LighthouseMeasurement[]): string[] {
  const violations: string[] = [];
  for (const measurement of measurements) {
    if (measurement.lcpMs >= LCP_LIMIT_MS) {
      violations.push(
        `${measurement.id} LCP ${measurement.lcpMs}ms is not under ${LCP_LIMIT_MS}ms`,
      );
    }
    if (measurement.cls >= CLS_LIMIT) {
      violations.push(`${measurement.id} CLS ${measurement.cls} is not under ${CLS_LIMIT}`);
    }
    if (measurement.accessibilityScore !== 1) {
      violations.push(
        `${measurement.id} accessibility ${measurement.accessibilityScore} is not exactly 1`,
      );
    }
    if (measurement.seriousOrCriticalAxeViolations !== 0) {
      violations.push(
        `${measurement.id} has ${measurement.seriousOrCriticalAxeViolations} serious/critical axe violations`,
      );
    }
  }
  return violations;
}

export function routeDomExpectation(testCase: LighthouseCase): {
  finalPathname: string;
  selector: string;
} {
  if (testCase.route === "/") return { finalPathname: "/auth", selector: "main.auth-page" };
  if (testCase.route === "/auth") return { finalPathname: "/auth", selector: "main.auth-page" };
  if (testCase.route === "/member/schedule") {
    return { finalPathname: "/member/schedule", selector: "main.public-safe-page" };
  }
  throw new Error(`no intended DOM expectation is configured for ${testCase.route}`);
}

export function assertIntendedAuditDom(testCase: LighthouseCase, dom: AuditedDom): void {
  const expectation = routeDomExpectation(testCase);
  if (dom.rootErrorBoundaryVisible) {
    throw new Error(`${testCase.id} rendered the root error boundary instead of its intended page`);
  }
  if (dom.finalPathname !== expectation.finalPathname) {
    throw new Error(
      `${testCase.id} ended at ${dom.finalPathname}; expected ${expectation.finalPathname}`,
    );
  }
  if (!dom.expectedMarkerVisible) {
    throw new Error(
      `${testCase.id} did not render its intended route marker ${expectation.selector}`,
    );
  }
  if (dom.documentLanguage !== testCase.language) {
    throw new Error(
      `${testCase.id} document language ${dom.documentLanguage}; expected ${testCase.language}`,
    );
  }
  const expectedDirection = testCase.language === "en" ? "ltr" : "rtl";
  if (dom.documentDirection !== expectedDirection) {
    throw new Error(
      `${testCase.id} document direction ${dom.documentDirection}; expected ${expectedDirection}`,
    );
  }
}

export function auditedDomFromLighthouse(
  testCase: LighthouseCase,
  lhr: { finalUrl?: string },
  artifacts: { RouteDom?: unknown },
): AuditedDom {
  if (typeof lhr.finalUrl !== "string") {
    throw new Error(`Lighthouse omitted finalUrl for ${testCase.id}`);
  }
  const routeDom = artifacts.RouteDom;
  if (
    !routeDom ||
    typeof routeDom !== "object" ||
    !("finalPathname" in routeDom) ||
    typeof routeDom.finalPathname !== "string" ||
    !("mainClasses" in routeDom) ||
    !Array.isArray(routeDom.mainClasses) ||
    !routeDom.mainClasses.every((className) => typeof className === "string") ||
    !("rootErrorBoundaryVisible" in routeDom) ||
    typeof routeDom.rootErrorBoundaryVisible !== "boolean" ||
    !("documentLanguage" in routeDom) ||
    typeof routeDom.documentLanguage !== "string" ||
    !("documentDirection" in routeDom) ||
    typeof routeDom.documentDirection !== "string"
  ) {
    throw new Error(`Lighthouse omitted a valid RouteDom artifact for ${testCase.id}`);
  }
  // Parse the report URL as a fail-closed check that Lighthouse recorded this
  // navigation. SPA redirects are represented by RouteDom's live pathname.
  new URL(lhr.finalUrl);
  const expectation = routeDomExpectation(testCase);
  const marker = expectation.selector.replace(/^main\./, "");
  return {
    finalPathname: routeDom.finalPathname,
    expectedMarkerVisible: routeDom.mainClasses.includes(marker),
    rootErrorBoundaryVisible: routeDom.rootErrorBoundaryVisible,
    documentLanguage: routeDom.documentLanguage,
    documentDirection: routeDom.documentDirection,
  };
}

const lighthouseConfig = {
  extends: "lighthouse:default" as const,
  artifacts: [{ id: "RouteDom", gatherer: { implementation: RouteDomGatherer } }],
  audits: [{ implementation: RouteDomAudit }],
  categories: {
    "best-practices": {
      title: "Best Practices",
      auditRefs: [{ id: "route-dom-validity", weight: 0, group: "best-practices-general" }],
    },
  },
};

function chromeExecutable(): string | undefined {
  return [
    process.env.PLAYWRIGHT_CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    chromium.executablePath(),
  ].find((candidate): candidate is string => Boolean(candidate && existsSync(candidate)));
}

async function unusedPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolvePromise);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("could not reserve a local port");
  const port = address.port;
  await new Promise<void>((resolvePromise, reject) =>
    server.close((error) => (error ? reject(error) : resolvePromise())),
  );
  return port;
}

async function runCommand(
  command: string,
  args: string[],
  options: { cwd: string; env?: NodeJS.ProcessEnv; quiet?: boolean },
): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: options.quiet ? ["ignore", "pipe", "pipe"] : "inherit",
    });
    let stderr = "";
    if (options.quiet) {
      child.stderr?.on("data", (chunk) => {
        stderr += String(chunk);
      });
    }
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} exited ${code ?? signal}${stderr ? `\n${stderr}` : ""}`));
    });
  });
}

async function waitForProductionServer(url: string, child: ChildProcess): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`production server exited before becoming ready (${child.exitCode})`);
    }
    try {
      const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(2_000) });
      if (response.status < 500) return;
    } catch {
      // The server can refuse the connection during its initial module load.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error(`production server did not become ready within 30s: ${url}`);
}

function awaitProcessExit(child: ChildProcess, timeoutMs: number): Promise<boolean> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve(true);
  return new Promise((resolvePromise) => {
    const timeout = setTimeout(() => {
      child.off("exit", onExit);
      resolvePromise(false);
    }, timeoutMs);
    const onExit = () => {
      clearTimeout(timeout);
      resolvePromise(true);
    };
    child.once("exit", onExit);
  });
}

export async function stopProcess(
  child: ChildProcess | undefined,
  { gracefulTimeoutMs = 5_000, forceTimeoutMs = 5_000 } = {},
): Promise<void> {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  if (!child.kill("SIGTERM")) throw new Error("production server rejected SIGTERM");
  if (await awaitProcessExit(child, gracefulTimeoutMs)) return;
  if (!child.kill("SIGKILL")) throw new Error("production server rejected SIGKILL");
  if (!(await awaitProcessExit(child, forceTimeoutMs))) {
    throw new Error("production server did not exit after SIGKILL");
  }
}

export async function settleCleanupTasks(
  tasks: ReadonlyArray<undefined | (() => void | Promise<void>)>,
  primaryError?: Error,
): Promise<void> {
  const results = await Promise.allSettled(
    tasks.map((task) => (task ? Promise.resolve().then(task) : Promise.resolve())),
  );
  const failures = results
    .filter((result): result is PromiseRejectedResult => result.status === "rejected")
    .map((result) =>
      result.reason instanceof Error ? result.reason.message : String(result.reason),
    );
  if (failures.length === 0) return;
  const detail = `Cleanup failures: ${failures.join("; ")}`;
  if (primaryError) {
    primaryError.message = `${primaryError.message}\n${detail}`;
    return;
  }
  throw new AggregateError(
    results
      .filter((result): result is PromiseRejectedResult => result.status === "rejected")
      .map((result) => result.reason),
    detail,
  );
}

async function launchAxeBrowser(executablePath: string): Promise<Browser> {
  return chromium.launch({ executablePath, headless: true, timeout: 20_000 });
}

async function axeViolationCount(
  browser: Browser,
  baseUrl: string,
  testCase: LighthouseCase,
): Promise<number> {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    reducedMotion: "reduce",
  });
  try {
    await context.addCookies([
      { name: "cc_lang", value: testCase.language, url: baseUrl, sameSite: "Lax" },
    ]);
    const page = await context.newPage();
    await page.goto(`${baseUrl}${testCase.route}`, { waitUntil: "networkidle", timeout: 30_000 });
    await page.locator("main").first().waitFor({ state: "visible", timeout: 10_000 });
    const expectation = routeDomExpectation(testCase);
    assertIntendedAuditDom(testCase, {
      finalPathname: new URL(page.url()).pathname,
      expectedMarkerVisible: await page.locator(expectation.selector).first().isVisible(),
      rootErrorBoundaryVisible: await page
        .locator(ROOT_ERROR_BOUNDARY_SELECTOR)
        .first()
        .isVisible(),
      documentLanguage: (await page.locator("html").getAttribute("lang")) ?? "",
      documentDirection: (await page.locator("html").getAttribute("dir")) ?? "",
    });
    const result = await new AxeBuilder({ page }).analyze();
    return result.violations
      .flatMap((violation) => violation.nodes.map((node) => node.impact ?? violation.impact))
      .filter((impact) => impact === "serious" || impact === "critical").length;
  } finally {
    await context.close();
  }
}

async function auditCase(options: {
  baseUrl: string;
  testCase: LighthouseCase;
  chrome: LaunchedChrome;
  axeBrowser: Browser;
  outputDirectory: string;
}): Promise<LighthouseMeasurement> {
  const url = `${options.baseUrl}${options.testCase.route}`;
  const result = await lighthouse(
    url,
    {
      port: options.chrome.port,
      output: "json",
      logLevel: "error",
      onlyCategories: ["performance", "accessibility", "best-practices"],
      formFactor: "mobile",
      throttlingMethod: "simulate",
      screenEmulation: {
        mobile: true,
        width: 390,
        height: 844,
        deviceScaleFactor: 3,
        disabled: false,
      },
      extraHeaders: { Cookie: `cc_lang=${options.testCase.language}` },
      disableFullPageScreenshot: true,
    },
    lighthouseConfig,
  );
  if (!result) throw new Error(`Lighthouse returned no result for ${options.testCase.id}`);
  const artifacts = result.artifacts as unknown as {
    RouteDom?: unknown;
    Trace?: unknown;
  };
  assertIntendedAuditDom(
    options.testCase,
    auditedDomFromLighthouse(options.testCase, result.lhr, artifacts),
  );
  const lcpMs = result.lhr.audits["largest-contentful-paint"]?.numericValue;
  const cls = result.lhr.audits["cumulative-layout-shift"]?.numericValue;
  const accessibilityScore = result.lhr.categories.accessibility?.score;
  if (
    typeof lcpMs !== "number" ||
    !Number.isFinite(lcpMs) ||
    typeof cls !== "number" ||
    !Number.isFinite(cls) ||
    typeof accessibilityScore !== "number"
  ) {
    throw new Error(`Lighthouse omitted required metrics for ${options.testCase.id}`);
  }

  writeFileSync(
    resolve(options.outputDirectory, `${options.testCase.id}.json`),
    `${JSON.stringify(result.lhr, null, 2)}\n`,
  );
  const trace = artifacts.Trace;
  if (!trace) throw new Error(`Lighthouse omitted trace evidence for ${options.testCase.id}`);
  writeFileSync(
    resolve(options.outputDirectory, `${options.testCase.id}-trace.json`),
    `${JSON.stringify(trace)}\n`,
  );

  const seriousOrCriticalAxeViolations = await axeViolationCount(
    options.axeBrowser,
    options.baseUrl,
    options.testCase,
  );
  return {
    ...options.testCase,
    lcpMs: Math.round(lcpMs),
    cls: Number(cls.toFixed(4)),
    accessibilityScore,
    seriousOrCriticalAxeViolations,
  };
}

export async function runProductionAudits(
  projectRoot = resolve(import.meta.dir, "../.."),
  cases: readonly LighthouseCase[] = lighthouseCases,
) {
  const resolvedRoot = resolve(projectRoot);
  const outputDirectory = resolve(resolvedRoot, "artifacts/ui-audit/current/lighthouse");
  mkdirSync(outputDirectory, { recursive: true });
  console.log("Building production bundle once for Lighthouse…");
  await runCommand(process.execPath, ["run", "build"], { cwd: resolvedRoot });

  const executablePath = chromeExecutable();
  if (!executablePath) throw new Error("no local Chromium executable is available for Lighthouse");
  const port = await unusedPort();
  const baseUrl = `http://127.0.0.1:${port}`;
  let productionServer: ChildProcess | undefined;
  let chrome: LaunchedChrome | undefined;
  let axeBrowser: Browser | undefined;
  let primaryError: Error | undefined;
  try {
    productionServer = spawn(process.execPath, ["run", "start"], {
      cwd: resolvedRoot,
      env: {
        ...process.env,
        HOST: "127.0.0.1",
        PORT: String(port),
        NODE_ENV: "production",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let serverStderr = "";
    productionServer.stderr?.on("data", (chunk) => {
      serverStderr += String(chunk);
    });
    try {
      await waitForProductionServer(baseUrl, productionServer);
    } catch (error) {
      throw new Error(`${error instanceof Error ? error.message : String(error)}${serverStderr}`);
    }
    chrome = await launchChrome({
      chromePath: executablePath,
      chromeFlags: ["--headless", "--disable-gpu", "--no-first-run", "--no-default-browser-check"],
      logLevel: "silent",
    });
    axeBrowser = await launchAxeBrowser(executablePath);

    const measurements: LighthouseMeasurement[] = [];
    for (const testCase of cases) {
      const measurement = await auditCase({
        baseUrl,
        testCase,
        chrome,
        axeBrowser,
        outputDirectory,
      });
      measurements.push(measurement);
      console.log(
        `${measurement.id}: LCP ${measurement.lcpMs}ms, CLS ${measurement.cls}, accessibility ${measurement.accessibilityScore}, serious/critical axe ${measurement.seriousOrCriticalAxeViolations}`,
      );
    }

    const violations = assertLighthouseBudgets(measurements);
    const summaryPath = resolve(outputDirectory, "summary.json");
    writeFileSync(
      summaryPath,
      `${JSON.stringify(
        {
          schemaVersion: 1,
          environment: "local-production",
          mobile: true,
          limits: {
            lcpMsExclusive: LCP_LIMIT_MS,
            clsExclusive: CLS_LIMIT,
            accessibilityScore: 1,
            seriousOrCriticalAxeViolations: 0,
          },
          results: measurements,
          violations,
        },
        null,
        2,
      )}\n`,
    );
    if (violations.length > 0) {
      throw new Error(
        `Production Lighthouse budget failed:\n${violations.join("\n")}\nEvidence: ${normalizePath(relative(resolvedRoot, summaryPath))}`,
      );
    }
    return measurements;
  } catch (error) {
    primaryError = error instanceof Error ? error : new Error(String(error));
    throw primaryError;
  } finally {
    await settleCleanupTasks(
      [
        axeBrowser ? () => axeBrowser.close() : undefined,
        chrome ? () => chrome.kill() : undefined,
        () => stopProcess(productionServer),
      ],
      primaryError,
    );
  }
}

if (import.meta.main) {
  const diagnosticLanguage = process.env.UI_AUDIT_LANGUAGE as AuditLanguage | undefined;
  if (diagnosticLanguage && !["he", "ar", "en"].includes(diagnosticLanguage)) {
    throw new Error(`UI_AUDIT_LANGUAGE must be he, ar, or en; received ${diagnosticLanguage}`);
  }
  const cases = diagnosticLanguage
    ? lighthouseCases.filter(({ language }) => language === diagnosticLanguage)
    : lighthouseCases;
  await runProductionAudits(undefined, cases);
}
