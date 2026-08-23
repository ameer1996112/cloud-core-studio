"""Public /app marketing-page regression checks via Playwright (Python)."""

import asyncio
import json
import os
from pathlib import Path
from urllib.parse import urlparse

from playwright.async_api import async_playwright


BASE = os.environ.get("APP_BASE_URL", "http://127.0.0.1:4173")
WIDTHS = [320, 375, 390, 430, 768, 1024, 1440]
LANGUAGES = [
    (
        "he",
        "rtl",
        "אפליקציית Cloud & Core | יוגה אווירית ופילאטיס",
        "צפייה בלוח השיעורים של Cloud & Core, הרשמה ליוגה אווירית ופילאטיס, ניהול הזמנות ומעקב אחרי המנוי.",
        "he_IL",
    ),
    (
        "ar",
        "rtl",
        "تطبيق Cloud & Core | يوغا هوائية وبيلاتس",
        "شاهدي جدول Cloud & Core، احجزي اليوغا الهوائية والبيلاتس، ديري حجوزاتك وتابعي اشتراكك.",
        "ar_AR",
    ),
    (
        "en",
        "ltr",
        "Cloud & Core App | Aerial Yoga & Pilates",
        "View the Cloud & Core class schedule, book aerial yoga and Pilates sessions, manage reservations and track your membership.",
        "en_US",
    ),
]
OUTPUT = Path("tmp/app-marketing-qa")


async def assert_gallery_loaded(page):
    gallery = page.locator(".app-marketing__screens-section")
    await gallery.scroll_into_view_if_needed()
    images = page.locator("[data-app-screenshot] img")
    assert await images.count() == 5
    await images.evaluate_all("images => images.forEach(image => { image.loading = 'eager' })")
    await page.wait_for_function(
        """
        () => [...document.querySelectorAll('[data-app-screenshot] img')]
          .every(image => image.complete && image.naturalWidth > 0)
        """
    )
    await images.evaluate_all(
        "images => Promise.all(images.map(image => image.decode()))"
    )
    await page.evaluate(
        "() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))"
    )


async def assert_dark_section_styles(page):
    assert await page.locator(".app-marketing__features h2").evaluate(
        "el => getComputedStyle(el).color"
    ) == "rgb(250, 247, 242)"
    assert await page.locator(".app-marketing__feature h3").first.evaluate(
        "el => getComputedStyle(el).color"
    ) == "rgb(250, 247, 242)"
    assert await page.locator(".app-marketing__final-copy h2").evaluate(
        "el => getComputedStyle(el).color"
    ) == "rgb(250, 247, 242)"
    final_cta = page.locator(
        ".app-marketing__final-actions .app-marketing__primary-cta"
    )
    assert await final_cta.evaluate(
        "el => getComputedStyle(el).backgroundColor"
    ) == "rgb(250, 247, 242)"
    assert await final_cta.evaluate(
        "el => getComputedStyle(el).color"
    ) == "rgb(11, 29, 58)"


async def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 390, "height": 844})
        page = await context.new_page()

        for code, direction, expected_title, expected_description, expected_locale in LANGUAGES:
            await page.goto(f"{BASE}/app?lang={code}", wait_until="networkidle")
            assert await page.locator("html").get_attribute("lang") == code
            assert await page.locator("html").get_attribute("dir") == direction
            assert await page.title() == expected_title
            assert await page.locator('link[rel="canonical"]').get_attribute("href") == (
                "https://cloudandcorestudio.com/app"
            )
            assert await page.locator('meta[name="description"]').get_attribute("content") == (
                expected_description
            )
            assert await page.locator('meta[name="robots"]').get_attribute("content") == (
                "index, follow"
            )
            assert await page.locator('meta[property="og:title"]').get_attribute("content") == (
                expected_title
            )
            assert await page.locator('meta[property="og:description"]').get_attribute(
                "content"
            ) == expected_description
            assert await page.locator('meta[property="og:type"]').get_attribute("content") == (
                "website"
            )
            assert await page.locator('meta[property="og:url"]').get_attribute("content") == (
                "https://cloudandcorestudio.com/app"
            )
            assert await page.locator('meta[property="og:locale"]').get_attribute("content") == (
                expected_locale
            )
            assert await page.locator('meta[name="twitter:card"]').get_attribute("content") == (
                "summary_large_image"
            )
            assert await page.locator('meta[name="twitter:title"]').get_attribute("content") == (
                expected_title
            )
            assert await page.locator('meta[name="twitter:description"]').get_attribute(
                "content"
            ) == expected_description
            expected_alternates = {
                "he": "https://cloudandcorestudio.com/app?lang=he",
                "ar": "https://cloudandcorestudio.com/app?lang=ar",
                "en": "https://cloudandcorestudio.com/app?lang=en",
                "x-default": "https://cloudandcorestudio.com/app",
            }
            for href_lang, href in expected_alternates.items():
                assert await page.locator(
                    f'link[rel="alternate"][hreflang="{href_lang}"]'
                ).get_attribute("href") == href
            assert await page.locator("h1").count() == 1
            structured_scripts = page.locator('head script[type="application/ld+json"]')
            assert await structured_scripts.count() == 1
            structured_data = await structured_scripts.first.text_content()
            parsed_structured_data = json.loads(structured_data)
            assert parsed_structured_data["@context"] == "https://schema.org"
            application, studio = parsed_structured_data["@graph"]
            assert application["@type"] == "SoftwareApplication"
            assert application["description"] == expected_description
            assert application["operatingSystem"] == "iPhone"
            assert application["applicationCategory"] == "HealthApplication"
            assert "id6786035836" in application["downloadUrl"]
            assert application["publisher"]["@id"] == studio["@id"]
            assert studio["@type"] == "HealthAndBeautyBusiness"
            forbidden_fields = {
                "aggregateRating",
                "review",
                "award",
                "offers",
                "price",
                "priceCurrency",
                "downloadCount",
            }
            assert forbidden_fields.isdisjoint(application)
            assert forbidden_fields.isdisjoint(studio)
            marketing_response = await context.request.get(f"{BASE}/app?lang={code}")
            assert marketing_response.status == 200
            assert (await marketing_response.text()).count('type="application/ld+json"') == 1
            screenshot_count = await page.locator("[data-app-screenshot]").count()
            assert screenshot_count == 5, (
                f"{code} rendered {screenshot_count} screenshots at {page.url}"
            )
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
            await assert_dark_section_styles(page)
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
        await assert_gallery_loaded(page)
        await page.screenshot(path=OUTPUT / "app-he-390.png", full_page=True)
        await page.set_viewport_size({"width": 1440, "height": 900})
        await page.goto(f"{BASE}/app?lang=en", wait_until="networkidle")
        await assert_gallery_loaded(page)
        await page.locator(".app-marketing__screens-section").screenshot(
            path=OUTPUT / "app-en-gallery-1440.png"
        )
        await page.screenshot(path=OUTPUT / "app-en-1440.png", full_page=True)

        await context.close()
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
