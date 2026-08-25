import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

type Locale = "he" | "en" | "ar";
type DeviceName = "iphone-6.5" | "ipad-13";

type Layout = Record<
  DeviceName,
  {
    capture: {
      cssWidth: number;
      cssHeight: number;
      deviceScaleFactor: number;
      expectedWidth: number;
      expectedHeight: number;
    };
    appScreenshotMasks: Record<string, { width: number; height: number }>;
  }
>;

const ROOT = resolve(import.meta.dir, "../..");
const TOOL_DIR = resolve(ROOT, "tools/app-store-screenshots");
const CAPTURE_DIR = resolve(ROOT, "app-store-assets/captures");
const ENV_PATH = resolve(ROOT, ".env.app-store.local");
const layout = JSON.parse(readFileSync(resolve(TOOL_DIR, "layout.json"), "utf8")) as Layout;
const CAPTURE_SOURCE_REVISION = "85b833a58a01311d12481b47bc21a96cb7fcc946";
const EXPECTED_DEMO_EMAIL = "app-store-demo@cloud-core.local";
const EXPECTED_FIXED_TIME = "2026-08-25T14:30:00+03:00";
const EXPECTED_BROWSER_VERSION = "Google Chrome 151.0.7922.174";
const EXPECTED_GLOBAL_FIXTURE_HASH =
  "a0ba3447869dfbe8ee2529e5adfa046a55e3ed48c3766f1592e28b8d5200b5ab";

const screens = [
  { key: "01-home", route: "/member", ready: "main" },
  { key: "02-schedule", route: "/member/schedule", ready: "main" },
  { key: "03-bookings", route: "/member/bookings", ready: "main" },
  { key: "04-packages", route: "/member/packages", ready: "main" },
  { key: "05-profile", route: "/member/account", ready: "main" },
] as const;

const localeButtonLabels: Record<Locale, string> = {
  he: "עברית",
  en: "English",
  ar: "العربية",
};

function captureViewport(device: DeviceName, screen: string) {
  const config = layout[device].capture;
  if (device === "iphone-6.5") {
    return { width: config.cssWidth, height: config.cssHeight };
  }
  const aperture = layout[device].appScreenshotMasks[screen];
  return {
    width: config.cssWidth,
    height: Math.round((config.cssWidth * aperture.height) / aperture.width),
  };
}

function loadEnv(path: string) {
  if (!existsSync(path))
    throw new Error(`Missing ${path}. Copy the supplied local template first.`);
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const equals = line.indexOf("=");
    if (equals < 1) continue;
    const key = line.slice(0, equals).trim();
    const value = line
      .slice(equals + 1)
      .trim()
      .replace(/^(['"])(.*)\1$/, "$2");
    // This dedicated, gitignored file deliberately overrides the repository's
    // normal .env so capture can never inherit a production backend by accident.
    process.env[key] = value;
  }
}

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in ${ENV_PATH}`);
  return value;
}

function requireLoopbackUrl(name: string) {
  const value = required(name);
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} is not a valid URL`);
  }
  if (parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost") {
    throw new Error(`Refusing non-loopback ${name}: ${parsed.origin}`);
  }
  return value;
}

async function runRequired(command: string[], cwd: string) {
  const process = Bun.spawn(command, { cwd, stdout: "inherit", stderr: "inherit" });
  const exitCode = await process.exited;
  if (exitCode !== 0) throw new Error(`${command.join(" ")} exited with ${exitCode}`);
}

async function verifiedBrowserVersion(executablePath: string) {
  const process = Bun.spawn([executablePath, "--version"], {
    cwd: ROOT,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    process.exited,
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
  ]);
  if (exitCode !== 0) throw new Error(`Could not read Chrome version: ${stderr.trim()}`);
  const version = stdout.trim();
  if (version !== EXPECTED_BROWSER_VERSION) {
    throw new Error(`Chrome version must be ${EXPECTED_BROWSER_VERSION}; found ${version}`);
  }
  return version;
}

async function prepareCaptureSource() {
  const temporaryRoot = await mkdtemp(resolve(tmpdir(), "cloud-core-appstore-capture-"));
  const archivePath = resolve(temporaryRoot, "source.tar");
  const sourceRoot = resolve(temporaryRoot, "source");
  await mkdir(sourceRoot);
  try {
    await runRequired(
      ["git", "archive", "--format=tar", `--output=${archivePath}`, CAPTURE_SOURCE_REVISION],
      ROOT,
    );
    await runRequired(["tar", "-xf", archivePath, "-C", sourceRoot], ROOT);
    await runRequired(["bun", "install", "--frozen-lockfile"], sourceRoot);
  } catch (error) {
    await rm(temporaryRoot, { recursive: true, force: true });
    throw error;
  }
  return {
    root: sourceRoot,
    cleanup: () => rm(temporaryRoot, { recursive: true, force: true }),
  };
}

async function seedLocalDemoAccount() {
  const url = requireLoopbackUrl("SUPABASE_URL");
  const viteUrl = requireLoopbackUrl("VITE_SUPABASE_URL");
  if (new URL(url).origin !== new URL(viteUrl).origin) {
    throw new Error("SUPABASE_URL and VITE_SUPABASE_URL must point to the same local origin");
  }
  requireLoopbackUrl("APP_STORE_BASE_URL");

  const serviceRole = required("SUPABASE_SERVICE_ROLE_KEY");
  const email = required("APP_STORE_DEMO_EMAIL");
  if (email !== EXPECTED_DEMO_EMAIL) {
    throw new Error(`APP_STORE_DEMO_EMAIL must be ${EXPECTED_DEMO_EMAIL}`);
  }
  const password = required("APP_STORE_DEMO_PASSWORD");
  const client = createClient(url, serviceRole, { auth: { persistSession: false } });
  const { data: listed, error: listError } = await client.auth.admin.listUsers();
  if (listError) throw listError;
  let user = listed.users.find((candidate) => candidate.email === email);

  if (user) {
    const { data, error } = await client.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
      user_metadata: {
        name: "",
        preferred_language: "he",
        notification_consent_version: "2",
        whatsapp_signup_opt_in_v2: false,
        marketing_updates_enabled: false,
      },
    });
    if (error) throw error;
    user = data.user;
  } else {
    const { data, error } = await client.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name: "",
        preferred_language: "he",
        notification_consent_version: "2",
        whatsapp_signup_opt_in_v2: false,
        marketing_updates_enabled: false,
      },
    });
    if (error) throw error;
    user = data.user;
  }

  const memberId = user.id;
  const cleanups = [
    ["bookings", client.from("bookings").delete().eq("member_id", memberId)],
    ["waitlist_entries", client.from("waitlist_entries").delete().eq("member_id", memberId)],
    ["member_plans", client.from("member_plans").delete().eq("member_id", memberId)],
    ["package_requests", client.from("package_requests").delete().eq("member_id", memberId)],
  ] as const;
  for (const [label, operation] of cleanups) {
    const { error } = await operation;
    if (error) throw new Error(`Failed to reset local ${label}: ${error.message}`);
  }

  const { error: profileError } = await client
    .from("profiles")
    .upsert({ id: memberId, role: "member" });
  if (profileError) throw profileError;
  const { error: memberError } = await client.from("members").delete().eq("id", memberId);
  if (memberError) throw memberError;

  const checks = await Promise.all([
    client.from("bookings").select("id", { count: "exact", head: true }).eq("member_id", memberId),
    client
      .from("waitlist_entries")
      .select("id", { count: "exact", head: true })
      .eq("member_id", memberId),
    client
      .from("member_plans")
      .select("id", { count: "exact", head: true })
      .eq("member_id", memberId),
  ]);
  for (const check of checks) {
    if (check.error) throw check.error;
    if (check.count !== 0)
      throw new Error("Local screenshot fixture did not stabilize to zero rows");
  }

  if (required("APP_STORE_FIXED_TIME") !== EXPECTED_FIXED_TIME) {
    throw new Error(`APP_STORE_FIXED_TIME must be ${EXPECTED_FIXED_TIME}`);
  }
  const fixedTime = new Date(EXPECTED_FIXED_TIME).toISOString();
  const [plansResult, classesResult, settingsResult] = await Promise.all([
    client
      .from("plans")
      .select("id,name,description,credits,duration_days,price_cents,currency,active")
      .eq("active", true)
      .order("price_cents"),
    client
      .from("classes")
      .select("id,title,starts_at,status,capacity,instructor_id,room_id")
      .eq("status", "scheduled")
      .gte("starts_at", fixedTime)
      .order("starts_at"),
    client.from("studio_settings").select("*").order("id"),
  ]);
  if (plansResult.error) throw plansResult.error;
  if (classesResult.error) throw classesResult.error;
  if (settingsResult.error) throw settingsResult.error;
  const globalFixture = {
    plans: plansResult.data,
    scheduledClasses: classesResult.data,
    studioSettings: settingsResult.data,
  };
  const globalFixtureHash = createHash("sha256")
    .update(JSON.stringify(globalFixture))
    .digest("hex");
  if (globalFixtureHash !== EXPECTED_GLOBAL_FIXTURE_HASH) {
    throw new Error(
      `Local global fixture hash differs from the approved capture fixture: ${globalFixtureHash}`,
    );
  }

  return {
    email,
    password,
    account: email,
    state: "no member detail row; localized generic-name empty state",
    globalFixtureHash,
    globalPlanNames: plansResult.data.map((plan) => plan.name),
    scheduledClassCount: classesResult.data.length,
  };
}

async function waitForServer(baseUrl: string, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/auth`);
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await Bun.sleep(250);
  }
  throw new Error(`App server did not become ready: ${String(lastError)}`);
}

async function logIn(page: Page, baseUrl: string, email: string, password: string, locale: Locale) {
  await page.goto(`${baseUrl}/auth`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: localeButtonLabels[locale], exact: true }).click();
  await page.waitForFunction(
    (expected) =>
      document.documentElement.lang === expected &&
      document.documentElement.dir === (expected === "en" ? "ltr" : "rtl"),
    locale,
  );
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  try {
    await page.waitForURL((url) => url.pathname === "/member", { timeout: 30_000 });
  } catch (error) {
    const text = (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 800);
    throw new Error(`Login did not reach /member (${page.url()}): ${text}`, { cause: error });
  }
  await page.waitForFunction(
    (expected) =>
      document.documentElement.lang === expected &&
      document.documentElement.dir === (expected === "en" ? "ltr" : "rtl"),
    locale,
  );
}

function captureFontCss(locale: Locale) {
  const family = locale === "ar" ? "Noto Sans Arabic" : "Assistant";
  const prefix =
    locale === "ar"
      ? "noto-sans-arabic-arabic"
      : `assistant-${locale === "he" ? "hebrew" : "latin"}`;
  const packageDirectory =
    locale === "ar" ? "@fontsource/noto-sans-arabic" : "@fontsource/assistant";
  return [400, 500, 600, 700]
    .map((weight) => {
      const path = resolve(
        ROOT,
        "node_modules",
        packageDirectory,
        "files",
        `${prefix}-${weight}-normal.woff2`,
      );
      const data = readFileSync(path).toString("base64");
      return `@font-face { font-family: "${family}"; src: url(data:font/woff2;base64,${data}) format("woff2"); font-style: normal; font-weight: ${weight}; font-display: block; }`;
    })
    .join("\n");
}

async function stabilize(page: Page, readySelector: string, locale: Locale, device: DeviceName) {
  await page.locator(readySelector).first().waitFor({ state: "visible", timeout: 30_000 });
  await page.addStyleTag({ content: captureFontCss(locale) });
  await page.evaluate(async () => {
    await document.fonts.ready;
    const visibleImages = Array.from(document.images).filter((image) => {
      const rect = image.getBoundingClientRect();
      return (
        rect.bottom > 0 &&
        rect.top < window.innerHeight &&
        rect.right > 0 &&
        rect.left < window.innerWidth
      );
    });
    await Promise.all(visibleImages.map((image) => image.decode()));
    const failedImage = visibleImages.find((image) => image.complete && image.naturalWidth === 0);
    if (failedImage)
      throw new Error(`Image failed to decode: ${failedImage.currentSrc || failedImage.src}`);
    window.scrollTo(0, 0);
  });
  const fontCheck =
    locale === "ar"
      ? { family: "Noto Sans Arabic", sample: "الاستوديو" }
      : { family: "Assistant", sample: locale === "he" ? "הסטודיו" : "Studio" };
  await page.evaluate(async ({ family, sample }) => {
    await document.fonts.load(`16px "${family}"`, sample);
  }, fontCheck);
  await page.waitForFunction(
    ({ family, sample }) =>
      document.fonts.check(`16px "${family}"`, sample) &&
      Array.from(document.fonts).some((face) => face.family === family && face.status === "loaded"),
    fontCheck,
  );
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        caret-color: transparent !important;
      }
      html, body { scrollbar-width: none !important; }
      ::-webkit-scrollbar { display: none !important; }
      ${
        device === "iphone-6.5"
          ? `.member-mobile-header-pad {
               box-sizing: border-box !important;
               height: 82px !important;
               padding-top: 30px !important;
             }
             nav.fixed.bottom-0 {
               bottom: 0 !important;
               padding-bottom: 12px !important;
               background: linear-gradient(
                 to bottom,
                 transparent 0 calc(100% - 12px),
                 var(--color-surface-warm) calc(100% - 12px) 100%
               ) !important;
             }`
          : ""
      }
    `,
  });
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(async () => {
    const snapshot = () => ({
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
      body: document.body.getBoundingClientRect().toJSON(),
    });
    const first = snapshot();
    await new Promise<void>((resolveFrame) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame())),
    );
    return JSON.stringify(first) === JSON.stringify(snapshot());
  });
}

async function captureLocale(
  browser: Browser,
  device: DeviceName,
  locale: Locale,
  baseUrl: string,
  credentials: { email: string; password: string },
) {
  const config = layout[device].capture;
  const context: BrowserContext = await browser.newContext({
    viewport: { width: config.cssWidth, height: config.cssHeight },
    deviceScaleFactor: config.deviceScaleFactor,
    locale: locale === "ar" ? "ar" : locale === "he" ? "he-IL" : "en-US",
    timezoneId: required("APP_STORE_TIMEZONE"),
    colorScheme: "light",
    reducedMotion: "reduce",
    serviceWorkers: "block",
  });

  const fixedTime = new Date(required("APP_STORE_FIXED_TIME")).valueOf();
  await context.addInitScript(
    ({ time }) => {
      const NativeDate = Date;
      class FixedDate extends NativeDate {
        constructor(...args: ConstructorParameters<typeof Date>) {
          super(...(args.length ? args : [time]));
        }
        static now() {
          return time;
        }
      }
      Object.defineProperty(window, "Date", { value: FixedDate });
    },
    { time: fixedTime },
  );

  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") process.stderr.write(`browser console: ${message.text()}\n`);
  });
  page.on("requestfailed", (request) => {
    process.stderr.write(
      `browser request failed: ${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}\n`,
    );
  });
  await logIn(page, baseUrl, credentials.email, credentials.password, locale);
  const outputDir = resolve(CAPTURE_DIR, device, locale);
  await mkdir(outputDir, { recursive: true });

  for (const screen of screens) {
    await page.setViewportSize(captureViewport(device, screen.key));
    await page.goto(`${baseUrl}${screen.route}`, { waitUntil: "networkidle" });
    await stabilize(page, screen.ready, locale, device);
    const output = resolve(outputDir, `${screen.key}-${locale}.png`);
    await page.screenshot({ path: output, fullPage: false, animations: "disabled", type: "png" });
    const size = await Bun.file(output).arrayBuffer();
    if (size.byteLength < 20_000) throw new Error(`Capture appears incomplete: ${output}`);
    process.stdout.write(`captured ${device}/${locale}/${screen.key}\n`);
  }

  await context.close();
}

async function main() {
  loadEnv(ENV_PATH);
  const baseUrl = requireLoopbackUrl("APP_STORE_BASE_URL").replace(/\/$/, "");
  const credentials = await seedLocalDemoAccount();
  const preparedSource = await prepareCaptureSource();
  const server = Bun.spawn(["bun", "run", "dev", "--host", "127.0.0.1", "--port", "5173"], {
    cwd: preparedSource.root,
    env: { ...process.env },
    stdout: "pipe",
    stderr: "pipe",
  });

  try {
    await waitForServer(baseUrl);
    const executablePath =
      process.env.PLAYWRIGHT_CHROME_PATH ??
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    const browserVersion = await verifiedBrowserVersion(executablePath);
    const browser = await chromium.launch({ executablePath, headless: true });
    try {
      const devices = (process.env.APP_STORE_DEVICES?.split(",") ?? [
        "iphone-6.5",
        "ipad-13",
      ]) as DeviceName[];
      const locales = (process.env.APP_STORE_LOCALES?.split(",") ?? ["he", "en", "ar"]) as Locale[];
      for (const device of devices) {
        if (!(device in layout)) throw new Error(`Unknown capture device: ${device}`);
        for (const locale of locales) {
          if (!(locale in localeButtonLabels)) throw new Error(`Unknown capture locale: ${locale}`);
          await captureLocale(browser, device, locale, baseUrl, credentials);
        }
      }
      const captureFiles = devices.flatMap((device) =>
        locales.flatMap((locale) =>
          screens.map((screen) => {
            const path = resolve(CAPTURE_DIR, device, locale, `${screen.key}-${locale}.png`);
            const viewport = captureViewport(device, screen.key);
            const scale = layout[device].capture.deviceScaleFactor;
            return {
              path: path.slice(CAPTURE_DIR.length + 1),
              sha256: createHash("sha256").update(readFileSync(path)).digest("hex"),
              width: viewport.width * scale,
              height: viewport.height * scale,
            };
          }),
        ),
      );
      await writeFile(
        resolve(CAPTURE_DIR, "capture-report.json"),
        `${JSON.stringify(
          {
            captureSourceRevision: CAPTURE_SOURCE_REVISION,
            account: credentials.account,
            memberState: credentials.state,
            fixedTime: required("APP_STORE_FIXED_TIME"),
            timezone: required("APP_STORE_TIMEZONE"),
            globalFixtureHash: credentials.globalFixtureHash,
            globalPlanNames: credentials.globalPlanNames,
            scheduledClassCount: credentials.scheduledClassCount,
            browserVersion,
            devices,
            locales,
            captureFiles,
          },
          null,
          2,
        )}\n`,
      );
    } finally {
      await browser.close();
    }
  } finally {
    server.kill();
    await server.exited;
    await preparedSource.cleanup();
  }
}

await main();
