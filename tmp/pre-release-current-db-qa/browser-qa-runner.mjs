import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const latest = JSON.parse(
  fs.readFileSync("tmp/pre-release-current-db-qa/latest-qa-api.json", "utf8"),
);
const completion = JSON.parse(
  fs.readFileSync("tmp/pre-release-current-db-qa/latest-qa-completion.json", "utf8"),
);
const { stamp, tag } = latest;
const base = "http://127.0.0.1:5173";
const outDir = path.resolve("tmp/pre-release-current-db-qa", `screenshots-${stamp}`);
fs.mkdirSync(outDir, { recursive: true });

const emails = {
  admin: `qa_pre_release_${stamp.toLowerCase()}.admin@example.com`,
  instructor: `qa_pre_release_${stamp.toLowerCase()}.instructor@example.com`,
  member: `qa_pre_release_${stamp.toLowerCase()}.member@example.com`,
};
const password = "E2ePass!23";
const devices = [
  { name: "phone390", width: 390, height: 844 },
  { name: "phone430", width: 430, height: 932 },
  { name: "ipad820", width: 820, height: 1180 },
  { name: "ipadLandscape", width: 1024, height: 768 },
  { name: "desktop1440", width: 1440, height: 900 },
];
const langs = [
  { code: "he", dir: "rtl" },
  { code: "ar", dir: "rtl" },
  { code: "en", dir: "ltr" },
];

const checks = [];
const bugs = [];
const consoleEvents = [];
const screenshots = [];

function record(name, result, data = {}) {
  checks.push({ name, result, ...data });
  if (result === "FAIL") {
    bugs.push({
      id: `BR-${String(bugs.length + 1).padStart(2, "0")}`,
      severity: data.severity || "High",
      name,
      ...data,
    });
  }
  console.log(result, name, data.error || "");
}

async function snapshot(page, name) {
  const file = path.join(
    outDir,
    `${String(screenshots.length + 1).padStart(3, "0")}-${name.replace(/[^a-z0-9_-]+/gi, "_")}.png`,
  );
  await page.screenshot({ path: file, fullPage: true });
  screenshots.push(file);
  return file;
}

async function waitReady(page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(700);
}

async function pageState(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_ELEMENT);
    let offender = null;
    while (walker.nextNode()) {
      const el = walker.currentNode;
      const r = el.getBoundingClientRect();
      if (r.width > window.innerWidth + 1 || r.right > window.innerWidth + 2 || r.left < -2) {
        offender = {
          tag: el.tagName,
          className: String(el.className || "").slice(0, 180),
          text: String(el.innerText || el.getAttribute("aria-label") || "").slice(0, 120),
          left: r.left,
          right: r.right,
          width: r.width,
        };
        break;
      }
    }
    const email = document.querySelector('input[type="email"], input[name="email"]');
    const passwordInput = document.querySelector('input[type="password"], input[name="password"]');
    return {
      url: location.pathname,
      docDir: doc.dir || getComputedStyle(doc).direction,
      bodyDir: getComputedStyle(body).direction,
      htmlLang: doc.lang,
      windowWidth: window.innerWidth,
      scrollWidth: Math.max(doc.scrollWidth, body.scrollWidth),
      overflow: Math.max(doc.scrollWidth, body.scrollWidth) > window.innerWidth + 1,
      offender,
      text: body.innerText.slice(0, 4000),
      emailDir: email ? email.dir || getComputedStyle(email).direction : null,
      passwordDir: passwordInput
        ? passwordInput.dir || getComputedStyle(passwordInput).direction
        : null,
    };
  });
}

async function setLang(page, lang) {
  await page.addInitScript((nextLang) => {
    localStorage.setItem("cc_lang", nextLang);
  }, lang);
}

async function login(browser, role, viewport, lang = "he") {
  const ctx = await browser.newContext({
    viewport,
    locale: lang === "he" ? "he-IL" : lang === "ar" ? "ar" : "en-US",
  });
  const page = await ctx.newPage();
  page.on("console", (msg) => {
    if (["error", "warning"].includes(msg.type())) {
      consoleEvents.push({ role, viewport: viewport.name, type: msg.type(), text: msg.text() });
    }
  });
  page.on("pageerror", (err) =>
    consoleEvents.push({ role, viewport: viewport.name, type: "pageerror", text: err.message }),
  );
  await setLang(page, lang);
  await page.goto(`${base}/auth`);
  await waitReady(page);
  await page.locator('input[type="email"], input[name="email"]').first().fill(emails[role]);
  await page.locator('input[type="password"], input[name="password"]').first().fill(password);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(1800);
  return { ctx, page };
}

async function visit(page, route, label, expectedDir) {
  await page.goto(`${base}${route}`);
  await waitReady(page);
  const st = await pageState(page);
  const shot = await snapshot(page, label);
  if (st.overflow) {
    record(`no horizontal overflow ${label}`, "FAIL", {
      route,
      severity: "High",
      offender: st.offender,
      screenshot: shot,
    });
  } else {
    record(`no horizontal overflow ${label}`, "PASS", { route, screenshot: shot });
  }
  if (expectedDir && st.bodyDir !== expectedDir && st.docDir !== expectedDir) {
    record(`direction ${label}`, "FAIL", {
      route,
      expectedDir,
      actual: { doc: st.docDir, body: st.bodyDir },
      screenshot: shot,
    });
  } else if (expectedDir) {
    record(`direction ${label}`, "PASS", { route, dir: st.bodyDir || st.docDir });
  }
  if (/No image yet/i.test(st.text)) {
    record(`no ugly placeholder ${label}`, "FAIL", { route, severity: "Medium", screenshot: shot });
  } else {
    record(`no ugly placeholder ${label}`, "PASS", { route });
  }
  const leak = st.text.match(/(E2E|QA_TEST|e2e_[a-z0-9_@.\-]+|test\.local)/i);
  if (leak && !st.text.includes(tag)) {
    record(`no legacy E2E/QA data visible ${label}`, "FAIL", {
      route,
      severity: "Medium",
      leak: leak[0],
      screenshot: shot,
    });
  } else {
    record(`no legacy E2E/QA data visible ${label}`, "PASS", { route });
  }
  return st;
}

const browser = await chromium.launch({ headless: true });
try {
  for (const lang of langs) {
    const ctx = await browser.newContext({ viewport: devices[0], locale: lang.code });
    const page = await ctx.newPage();
    page.on("console", (msg) => {
      if (["error", "warning"].includes(msg.type())) {
        consoleEvents.push({
          role: "guest",
          viewport: devices[0].name,
          lang: lang.code,
          type: msg.type(),
          text: msg.text(),
        });
      }
    });
    page.on("pageerror", (err) =>
      consoleEvents.push({
        role: "guest",
        viewport: devices[0].name,
        lang: lang.code,
        type: "pageerror",
        text: err.message,
      }),
    );
    await setLang(page, lang.code);
    await page.goto(`${base}/auth`);
    await waitReady(page);
    const st = await pageState(page);
    const shot = await snapshot(page, `auth-${lang.code}-390`);
    if (st.overflow) {
      record(`/auth no overflow ${lang.code} 390`, "FAIL", {
        route: "/auth",
        severity: "High",
        offender: st.offender,
        screenshot: shot,
      });
    } else {
      record(`/auth no overflow ${lang.code} 390`, "PASS", { screenshot: shot });
    }
    if (st.emailDir !== "ltr" || st.passwordDir !== "ltr") {
      record(`/auth inputs LTR ${lang.code}`, "FAIL", {
        route: "/auth",
        severity: "High",
        emailDir: st.emailDir,
        passwordDir: st.passwordDir,
        screenshot: shot,
      });
    } else {
      record(`/auth inputs LTR ${lang.code}`, "PASS");
    }
    const dirOk = st.bodyDir === lang.dir || st.docDir === lang.dir;
    record(`/auth direction ${lang.code}`, dirOk ? "PASS" : "FAIL", {
      route: "/auth",
      expectedDir: lang.dir,
      actual: { doc: st.docDir, body: st.bodyDir },
      screenshot: shot,
    });
    await ctx.close();
  }

  for (const route of ["/member", "/admin", "/instructor"]) {
    const ctx = await browser.newContext({ viewport: devices[0] });
    const page = await ctx.newPage();
    await page.goto(`${base}${route}`);
    await waitReady(page);
    const st = await pageState(page);
    await snapshot(page, `guest-block-${route}`);
    record(`guest blocked ${route}`, st.url.includes("/auth") ? "PASS" : "FAIL", {
      finalUrl: st.url,
      route,
      severity: "High",
    });
    await ctx.close();
  }

  const classId = completion.created.find((r) => r.table === "classes")?.id || "";
  const routeSets = {
    member: ["/member", "/member/schedule", "/member/bookings", "/member/packages"],
    admin: [
      "/admin",
      "/admin/pulse",
      "/admin/reports",
      "/admin/payments",
      "/admin/messages",
      "/admin/settings",
      `/admin/classes/${classId}`,
    ],
    instructor: ["/instructor"],
  };

  for (const vp of devices) {
    for (const lang of langs) {
      const { ctx, page } = await login(browser, "member", vp, lang.code);
      for (const route of routeSets.member) {
        await visit(page, route, `member-${lang.code}-${vp.name}-${route}`, lang.dir);
      }
      await ctx.close();
    }
  }

  for (const vp of devices) {
    for (const lang of langs) {
      const { ctx, page } = await login(browser, "admin", vp, lang.code);
      for (const route of routeSets.admin) {
        await visit(page, route, `admin-${lang.code}-${vp.name}-${route}`, lang.dir);
      }
      await ctx.close();
    }
  }

  for (const vp of devices) {
    for (const lang of langs) {
      const { ctx, page } = await login(browser, "instructor", vp, lang.code);
      for (const route of routeSets.instructor) {
        await visit(page, route, `instructor-${lang.code}-${vp.name}`, lang.dir);
      }
      await page.goto(`${base}/admin`);
      await waitReady(page);
      const st = await pageState(page);
      await snapshot(page, `instructor-admin-block-${lang.code}-${vp.name}`);
      const blocked =
        !st.url.startsWith("/admin") ||
        /not authorized|unauthorized|auth|אין|غير|Access/i.test(st.text);
      record(`instructor admin blocked ${lang.code} ${vp.name}`, blocked ? "PASS" : "FAIL", {
        finalUrl: st.url,
        severity: "High",
      });
      await ctx.close();
    }
  }

  const { ctx: mctx, page: mpage } = await login(browser, "member", devices[0], "he");
  await mpage.goto(`${base}/admin`);
  await waitReady(mpage);
  const mst = await pageState(mpage);
  await snapshot(mpage, "member-admin-block");
  const memberBlocked =
    !mst.url.startsWith("/admin") || /not authorized|unauthorized|auth|אין|Access/i.test(mst.text);
  record("member admin blocked", memberBlocked ? "PASS" : "FAIL", {
    finalUrl: mst.url,
    severity: "High",
  });
  await mctx.close();

  const badConsole = consoleEvents.filter(
    (e) => !/Download the React DevTools|module\.register|favicon|Console Ninja/i.test(e.text),
  );
  record("no console errors/warnings", badConsole.length ? "FAIL" : "PASS", {
    severity: "Medium",
    count: badConsole.length,
    samples: badConsole.slice(0, 10),
  });
} finally {
  await browser.close();
}

const result = {
  stamp,
  tag,
  base,
  screenshotsDir: outDir,
  checks,
  bugs,
  consoleEvents,
  screenshots,
};
const outPath = path.join("tmp/pre-release-current-db-qa", `browser-qa-${stamp}.json`);
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
fs.writeFileSync(
  "tmp/pre-release-current-db-qa/latest-browser-qa.json",
  JSON.stringify(result, null, 2),
);
console.log(`WROTE ${outPath}`);
console.log(
  `${checks.filter((c) => c.result === "PASS").length} passed · ${checks.filter((c) => c.result === "FAIL").length} failed · ${screenshots.length} screenshots`,
);
process.exit(bugs.length ? 1 : 0);
