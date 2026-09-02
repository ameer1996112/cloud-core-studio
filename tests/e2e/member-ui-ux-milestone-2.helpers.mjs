import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export const BASE_URL = process.env.APP_BASE_URL || "http://127.0.0.1:4176";
export const FIXTURE_EMAIL = "qa-member-ui@cloudcore.test";
export const LOCAL_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
export const FIXTURE_PLAN_NAME = "Member package · 10 credits";
export const FIXTURE_PRICE = "₪199";
export const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

export const COPY = {
  en: {
    languageLabel: "English",
    choose: "Choose package",
    online: "Secure online payment",
    continue: "Continue to secure payment",
    submitPayment: "Submit for confirmation",
    deleteTrigger: "Request account deletion",
    deleteTitle: "Submit account deletion request?",
    deleteSubmit: "Submit deletion request",
    deleteSuccess: "Deletion request submitted",
    deleteDuplicate: "A deletion request is already open.",
    deleteError: "Could not send deletion request.",
    retry: "Retry",
    support: "Contact support",
    cancel: "Cancel",
  },
  he: {
    languageLabel: "עברית",
    choose: "בחירת חבילה",
    online: "תשלום אונליין מאובטח",
    continue: "המשך לתשלום מאובטח",
    submitPayment: "שליחת תשלום לאישור",
    deleteTrigger: "בקשת מחיקת חשבון",
    deleteTitle: "לשלוח בקשה למחיקת חשבון?",
    deleteSubmit: "שליחת בקשת מחיקה",
    deleteSuccess: "בקשת המחיקה נשלחה",
    deleteDuplicate: "כבר קיימת בקשת מחיקה פתוחה.",
    deleteError: "לא הצלחנו לשלוח בקשת מחיקה.",
    retry: "ניסיון נוסף",
    support: "פנייה לתמיכה",
    cancel: "ביטול",
  },
  ar: {
    languageLabel: "العربية",
    choose: "اختيار الباقة",
    online: "دفع آمن عبر الإنترنت",
    continue: "متابعة للدفع الآمن",
    submitPayment: "إرسال الدفع للتأكيد",
    deleteTrigger: "طلب حذف الحساب",
    deleteTitle: "إرسال طلب حذف الحساب؟",
    deleteSubmit: "إرسال طلب الحذف",
    deleteSuccess: "تم إرسال طلب الحذف",
    deleteDuplicate: "يوجد طلب حذف مفتوح بالفعل.",
    deleteError: "تعذر إرسال طلب الحذف.",
    retry: "إعادة المحاولة",
    support: "التواصل مع الدعم",
    cancel: "إلغاء",
  },
};

export function requireLoopbackUrl(value = BASE_URL) {
  const url = new URL(value);
  assert(LOOPBACK_HOSTS.has(url.hostname), `refusing_non_loopback_target:${url.hostname}`);
  return url;
}

export function parseEnvironment(contents) {
  return Object.fromEntries(
    contents
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1).replace(/^(\"|')(.*)\1$/, "$2")];
      }),
  );
}

export async function fixtureEnvironment() {
  return parseEnvironment(await readFile(resolve(process.cwd(), ".env.qa.local"), "utf8"));
}

export function chromeLaunchOptions(headless = true) {
  return {
    headless,
    ...(existsSync(LOCAL_CHROME) ? { executablePath: LOCAL_CHROME } : {}),
  };
}

export function sanitizeDiagnostic(value) {
  return String(value)
    .replace(/eyJ[A-Za-z0-9._-]+/g, "[redacted-token]")
    .replace(/[A-Za-z0-9_-]{80,}/g, "[redacted-secret]")
    .slice(0, 500);
}

export async function installLocalNetworkGuard(context, audit) {
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (!LOOPBACK_HOSTS.has(url.hostname)) {
      audit.blockedRemote.add(url.hostname);
      await route.abort("blockedbyclient");
      return;
    }
    audit.localHosts.add(url.host);
    await route.continue();
  });
}

export async function signIn(page, password) {
  await page.goto(`${BASE_URL}/auth`, { waitUntil: "networkidle" });
  const english = page.getByRole("button", { name: "English" });
  if (await english.isVisible()) await english.click();
  await page.getByLabel(/email/i).fill(FIXTURE_EMAIL);
  await page.getByRole("textbox", { name: /password/i }).fill(password);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/member(?:\/|$)/, { timeout: 15_000 });
}

export async function switchLanguage(page, lang) {
  await page.goto(`${BASE_URL}/member/account`, { waitUntil: "networkidle" });
  await page.locator("#profile-language").selectOption(lang);
  await page.waitForFunction(
    ({ expectedLang, expectedDir }) =>
      document.documentElement.lang === expectedLang &&
      document.documentElement.dir === expectedDir,
    { expectedLang: lang, expectedDir: lang === "en" ? "ltr" : "rtl" },
  );
}

export async function assertDocumentLanguage(page, lang) {
  const state = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    visibleText: document.body.innerText,
  }));
  assert.equal(state.lang, lang, `html_lang_${lang}`);
  assert.equal(state.dir, lang === "en" ? "ltr" : "rtl", `html_dir_${lang}`);
  assert(state.scrollWidth <= state.clientWidth, `horizontal_overflow_${lang}`);
  assert(!/(?:member|packages|profile|common)\.[A-Za-z][A-Za-z0-9_.-]*/.test(state.visibleText));
}

export function classifyServerFunction(request) {
  const url = new URL(request.url());
  if (!LOOPBACK_HOSTS.has(url.hostname) || !url.pathname.startsWith("/_serverFn/")) return null;
  if (request.method() !== "POST") return { kind: "safe-read", path: url.pathname };
  const body = request.postData() || "";
  if (
    body.includes('"plan_id"') &&
    body.includes('"payment_method"') &&
    body.includes('"recurring"') &&
    body.includes('"checkout"')
  ) {
    return { kind: "payment", path: url.pathname };
  }
  if (body.includes('"reason"') && !body.includes('"plan_id"')) {
    return { kind: "deletion", path: url.pathname };
  }
  if (body.includes('"preferredLanguage"')) {
    return { kind: "language-preference", path: url.pathname };
  }
  return { kind: "unknown", path: url.pathname };
}

function encodedValue(value, nextId) {
  if (typeof value === "string") return { t: 1, s: value };
  if (typeof value === "boolean") return { t: 2, s: value ? 2 : 3 };
  if (value === undefined) return { t: 2, s: 1 };
  if (value === null) return { t: 2, s: 0 };
  if (typeof value === "number") return { t: 0, s: value };
  const id = nextId.value++;
  const keys = Object.keys(value);
  return {
    t: 10,
    i: id,
    p: { k: keys, v: keys.map((key) => encodedValue(value[key], nextId)) },
    o: 0,
  };
}

export function serializeServerFunctionResult(result) {
  const ids = { value: 1 };
  return JSON.stringify({
    t: 10,
    i: 0,
    p: {
      k: ["result", "error", "context"],
      v: [
        encodedValue(result, ids),
        encodedValue(undefined, ids),
        { t: 11, i: ids.value++, p: { k: [], v: [] }, o: 0 },
      ],
    },
    o: 0,
  });
}

export async function fulfillServerFunctionResult(route, result) {
  await route.fulfill({
    status: 200,
    headers: { "content-type": "application/json", "x-tss-serialized": "true" },
    body: serializeServerFunctionResult(result),
  });
}

export function deferred() {
  let resolvePromise;
  const promise = new Promise((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}

export async function installMutationInterceptor(page, options) {
  const state = {
    kind: options.kind,
    count: 0,
    paths: new Set(),
    unknown: [],
    release: null,
    attempts: [],
  };
  if (options.mode === "delayed-error" || options.mode === "delayed-success") {
    state.release = deferred();
  }
  const handler = async (route) => {
    const classification = classifyServerFunction(route.request());
    if (!classification || classification.kind === "safe-read") return route.fallback();
    if (classification.kind === "language-preference") return route.fallback();
    if (classification.kind === "unknown") {
      state.unknown.push(classification.path);
      await route.abort("blockedbyclient");
      return;
    }
    if (classification.kind !== options.kind) {
      state.unknown.push(`cross_flow:${classification.kind}:${classification.path}`);
      await route.abort("blockedbyclient");
      return;
    }
    state.count += 1;
    state.paths.add(classification.path);
    state.attempts.push(state.count);
    let mode = Array.isArray(options.sequence)
      ? options.sequence[Math.min(state.count - 1, options.sequence.length - 1)]
      : options.mode;
    if (mode === "delayed-error" || mode === "delayed-success") {
      await state.release.promise;
      mode = mode === "delayed-error" ? "server-error" : "success";
    }
    if (mode === "network-error") return route.abort("failed");
    if (mode === "server-error") {
      return route.fulfill({
        status: 500,
        contentType: "text/plain; charset=utf-8",
        body: "qa-intercepted-server-error",
      });
    }
    if (mode === "validation-error") {
      return route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({ error: "qa-intercepted-validation-error" }),
      });
    }
    if (mode === "invalid-json") {
      return route.fulfill({ status: 200, contentType: "application/json", body: "{" });
    }
    if (mode === "invalid-response") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ unexpected: true }),
      });
    }
    if (options.kind === "payment") {
      const result =
        mode === "missing-redirect"
          ? { status: "ready", provider: "hyp", payment_id: "qa-contract-payment" }
          : mode === "unknown-status"
            ? { status: "unknown", provider: "hyp", payment_id: "qa-contract-payment" }
            : {
                status: "ready",
                provider: "hyp",
                payment_id: "qa-contract-payment",
                checkout_url: `${BASE_URL}/__playwright_payment_stub`,
              };
      return fulfillServerFunctionResult(route, result);
    }
    const deletionResult =
      mode === "invalid-success"
        ? { ok: true, duplicate: false }
        : { ok: true, status: "requested", duplicate: mode === "duplicate-success" };
    return fulfillServerFunctionResult(route, deletionResult);
  };
  await page.route("**/_serverFn/**", handler);
  return {
    state,
    release: () => state.release?.resolve(),
    uninstall: () => page.unroute("**/_serverFn/**", handler),
  };
}

export async function openFixturePaymentSheet(page, lang = "en", activation = "click") {
  await page.goto(`${BASE_URL}/member/packages`, { waitUntil: "networkidle" });
  const card = page
    .getByRole("heading", { name: FIXTURE_PLAN_NAME })
    .locator("xpath=ancestor::article");
  await card.waitFor({ state: "visible" });
  assert((await card.innerText()).includes(FIXTURE_PRICE), "fixture_authoritative_price_missing");
  const choose = card.getByRole("button", { name: COPY[lang].choose });
  if (activation === "Enter") {
    await choose.focus();
    await choose.press("Enter");
  } else {
    await choose.click();
  }
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible" });
  assert((await dialog.innerText()).includes(FIXTURE_PLAN_NAME));
  assert((await dialog.innerText()).includes(FIXTURE_PRICE));
  return { card, choose, dialog };
}

export async function prepareOnlinePayment(page, lang = "en") {
  const copy = COPY[lang];
  await page.getByRole("button", { name: new RegExp(copy.online, "i") }).click();
  await page.getByRole("button", { name: copy.continue, exact: true }).click();
  await page.getByRole("checkbox").check();
  const semanticAction = page.getByRole("button", { name: copy.submitPayment, exact: true });
  await semanticAction.waitFor({ state: "visible" });
  return page.getByRole("dialog").locator("button.btn-navy").last();
}

export async function openDeletionDialog(page, lang = "en", activation = "click") {
  await page.goto(`${BASE_URL}/member/account`, { waitUntil: "networkidle" });
  const trigger = page.getByRole("button", { name: COPY[lang].deleteTrigger, exact: true });
  if (activation === "Enter") {
    await trigger.focus();
    await trigger.press("Enter");
  } else if (activation === "Space") {
    await trigger.focus();
    await trigger.press("Space");
  } else {
    await trigger.click();
  }
  const dialog = page.getByRole("alertdialog", { name: COPY[lang].deleteTitle });
  await dialog.waitFor({ state: "visible" });
  const semanticConfirm = dialog.getByRole("button", {
    name: COPY[lang].deleteSubmit,
    exact: true,
  });
  await semanticConfirm.waitFor({ state: "visible" });
  return {
    trigger,
    dialog,
    confirm: dialog.getByRole("button").last(),
  };
}

export async function waitForCount(state, expected, timeout = 5_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (state.count === expected) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 20));
  }
  assert.equal(state.count, expected, `request_count_timeout_${state.kind}`);
}

export async function assertFocusedWithin(page, locator, message) {
  const focused = await locator.evaluate((element) => element.contains(document.activeElement));
  assert(focused, message);
}
