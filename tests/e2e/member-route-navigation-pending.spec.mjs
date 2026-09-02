import { chromium } from "playwright";
import { existsSync } from "node:fs";

const baseUrl = process.env.APP_BASE_URL || "http://127.0.0.1:4176";
const fixtureEmail = "qa-member-ui@cloudcore.test";
const fixturePassword = process.env.QA_MEMBER_UI_UX_PASSWORD;

if (!fixturePassword) throw new Error("member_navigation_fixture_password_missing");
if (!["127.0.0.1", "localhost"].includes(new URL(baseUrl).hostname)) {
  throw new Error("member_navigation_test_refuses_non_local_target");
}

const localChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const browser = await chromium.launch({
  headless: true,
  ...(existsSync(localChrome) ? { executablePath: localChrome } : {}),
});
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });

try {
  await page.goto(`${baseUrl}/auth`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "English" }).click();
  await page.getByLabel(/email/i).fill(fixtureEmail);
  await page.getByRole("textbox", { name: /password/i }).fill(fixturePassword);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/member(?:\/|$)/);

  await page.goto(`${baseUrl}/member/schedule`, { waitUntil: "networkidle" });
  await page
    .getByRole("heading", { name: /^schedule$/i })
    .first()
    .waitFor();

  await page.route(
    "**/_serverFn/**",
    async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1_200));
      await route.continue();
    },
    { times: 1 },
  );
  await page.route(
    "**/assets/account-*.js",
    async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1_200));
      await route.continue();
    },
    { times: 1 },
  );

  const accountLink = page.locator('a[href="/member/account"]').first();
  await accountLink.evaluate((element) => element.click());
  await page.waitForURL(/\/member\/account$/);

  const { staleScheduleVisible, loadingStatusVisible } = await page.evaluate(() => {
    const staleSchedule = [...document.querySelectorAll("h1, h2, h3")].find(
      (heading) => heading.textContent?.trim().toLowerCase() === "schedule",
    );
    const loadingStatus = document.querySelector('.member-route-skeleton--account[role="status"]');
    const loadingRect = loadingStatus?.getBoundingClientRect();
    return {
      staleScheduleVisible: Boolean(staleSchedule?.getClientRects().length),
      loadingStatusVisible: Boolean(loadingRect && loadingRect.width > 0 && loadingRect.height > 0),
    };
  });

  if (staleScheduleVisible || !loadingStatusVisible) {
    throw new Error(
      `member_navigation_stale_content:staleSchedule=${staleScheduleVisible}:loading=${loadingStatusVisible}`,
    );
  }

  await page
    .getByRole("heading", { name: /^Member QA$/ })
    .first()
    .waitFor({ timeout: 10_000 });
  console.log("member-route-navigation-pending:pass");
} finally {
  await browser.close();
}
