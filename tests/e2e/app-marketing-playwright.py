"""Public /app marketing-page regression checks via Playwright (Python)."""

import asyncio
import os
from pathlib import Path
from urllib.parse import urlparse

from playwright.async_api import async_playwright


BASE = os.environ.get("APP_BASE_URL", "http://127.0.0.1:4173")
WIDTHS = [320, 375, 390, 430, 768, 1024, 1440]
LANGUAGES = [
    ("he", "rtl", "אפליקציית Cloud & Core | יוגה אווירית ופילאטיס"),
    ("ar", "rtl", "تطبيق Cloud & Core | يوغا هوائية وبيلاتس"),
    ("en", "ltr", "Cloud & Core App | Aerial Yoga & Pilates"),
]
OUTPUT = Path("tmp/app-marketing-qa")


async def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 390, "height": 844})
        page = await context.new_page()

        for code, direction, expected_title in LANGUAGES:
            await page.goto(f"{BASE}/app?lang={code}", wait_until="networkidle")
            assert await page.locator("html").get_attribute("lang") == code
            assert await page.locator("html").get_attribute("dir") == direction
            assert await page.title() == expected_title
            assert await page.locator('link[rel="canonical"]').get_attribute("href") == (
                "https://cloudandcorestudio.com/app"
            )
            assert await page.locator("h1").count() == 1
            # JSON-LD is emitted by the SSR response for crawlers. React removes this
            # inert route-body script during hydration, so assert the public document.
            marketing_response = await context.request.get(f"{BASE}/app?lang={code}")
            assert marketing_response.status == 200
            assert (await marketing_response.text()).count('type="application/ld+json"') == 1
            assert await page.locator("[data-app-screenshot]").count() == 5
            assert "id6786035836" in (
                await page.locator("[data-app-store-link]").first.get_attribute("href")
            )
            assert urlparse(
                await page.locator("[data-auth-link]").first.get_attribute("href")
            ).path == "/auth"
            assert (
                await page.locator(".app-marketing__hero-actions .app-marketing__primary-cta").evaluate(
                    "el => getComputedStyle(el).color"
                )
                == "rgb(250, 247, 242)"
            )

        await page.goto(f"{BASE}/app?lang=en", wait_until="networkidle")
        await page.get_by_role("button", name="العربية").click()
        await page.wait_for_url("**/app?lang=ar")
        assert await page.locator("html").get_attribute("lang") == "ar"
        assert await page.locator("html").get_attribute("dir") == "rtl"

        expected_footer_paths = {"/support", "/privacy", "/terms", "/auth"}
        footer_paths = {
            urlparse(href).path
            for href in await page.locator("footer a").evaluate_all(
                "els => els.map(el => el.href)"
            )
        }
        assert expected_footer_paths.issubset(footer_paths)

        for width in WIDTHS:
            await page.set_viewport_size(
                {"width": width, "height": 844 if width < 600 else 900}
            )
            code = "he" if width in (375, 390, 1024) else "en"
            await page.goto(f"{BASE}/app?lang={code}", wait_until="networkidle")
            overflow = await page.evaluate(
                "document.documentElement.scrollWidth - window.innerWidth"
            )
            assert overflow <= 1, f"horizontal overflow at {width}px: {overflow}px"
            if width <= 430:
                brand = await page.locator(".app-marketing__brand-link").bounding_box()
                actions = await page.locator(".app-marketing__header-actions").bounding_box()
                assert brand and actions
                assert (
                    brand["x"] + brand["width"] <= actions["x"]
                    or actions["x"] + actions["width"] <= brand["x"]
                ), f"header controls overlap at {width}px"

        for path in ("/auth", "/support", "/privacy", "/terms"):
            response = await context.request.get(f"{BASE}{path}")
            assert response.status == 200, f"{path} returned {response.status}"

        for path in ("/member", "/admin", "/instructor"):
            response = await context.request.get(f"{BASE}{path}", max_redirects=0)
            assert response.status in (302, 303, 307, 308)
            assert urlparse(response.headers["location"]).path == "/auth"

        reduced = await browser.new_context(
            viewport={"width": 390, "height": 844}, reduced_motion="reduce"
        )
        reduced_page = await reduced.new_page()
        await reduced_page.goto(f"{BASE}/app?lang=he", wait_until="networkidle")
        max_animation_ms = await reduced_page.locator(".app-marketing *").evaluate_all(
            """
            els => Math.max(0, ...els.map(el => {
              const value = getComputedStyle(el).animationDuration.trim();
              if (value.endsWith('ms')) return Number.parseFloat(value);
              if (value.endsWith('s')) return Number.parseFloat(value) * 1000;
              return 0;
            }))
            """
        )
        assert max_animation_ms <= 0.01
        await reduced.close()

        await page.set_viewport_size({"width": 390, "height": 844})
        await page.goto(f"{BASE}/app?lang=he", wait_until="networkidle")
        await page.screenshot(path=OUTPUT / "app-he-390.png", full_page=True)
        await page.set_viewport_size({"width": 1440, "height": 900})
        await page.goto(f"{BASE}/app?lang=en", wait_until="networkidle")
        await page.screenshot(path=OUTPUT / "app-en-1440.png", full_page=True)

        await context.close()
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
