"""Local production SSR, browser, accessibility, responsive, and visual QA for /app."""

import asyncio
import html
import json
import os
import re
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from playwright.async_api import async_playwright


BASE = os.environ.get("APP_BASE_URL", "http://127.0.0.1:4173").rstrip("/")
OUTPUT = Path("tmp/app-seo-remediation-qa")
ORIGIN = "https://cloudandcorestudio.com"
INSTALL_URL = "https://apps.apple.com/app/id6786035836"
VIEWPORTS = [(320, 568), (375, 812), (390, 844), (430, 932), (768, 1024), (1024, 768), (1440, 900)]
UTM = "utm_source=qa&utm_medium=browser&utm_campaign=release&utm_content=hero"
PRIVATE = "email=private%40example.com&token=secret&member_id=42"
LANGUAGES = {
    "ar": {
        "dir": "rtl",
        "title": "Cloud & Core | يوغا هوائية وبيلاتس في حرفيش",
        "description": "استوديو Cloud & Core في حرفيش لليوغا الهوائية، بيلاتس الفرشات و-HOT Pilates للنساء والأطفال. شوفي الجدول واحجزي من التطبيق.",
        "locale": "ar_IL",
        "h1": "يوغا هوائية وبيلاتس بحرفيش — الحجز بسهولة من التطبيق",
        "schedule": "شوفي الجدول واحجزي",
    },
    "he": {
        "dir": "rtl",
        "title": "Cloud & Core | יוגה אווירית ופילאטיס בחורפיש",
        "description": "סטודיו Cloud & Core בחורפיש ליוגה אווירית, פילאטיס מזרן ו-HOT Pilates לנשים ולילדים. צפייה בלוח והרשמה דרך האפליקציה.",
        "locale": "he_IL",
        "h1": "יוגה אווירית ופילאטיס בחורפיש — הרשמה קלה דרך האפליקציה",
        "schedule": "צפייה בלוח והרשמה",
    },
    "en": {
        "dir": "ltr",
        "title": "Cloud & Core | Aerial Yoga & Pilates in Hurfeish",
        "description": "Boutique aerial yoga, mat Pilates and HOT Pilates classes for women and children in Hurfeish. View the schedule and book through the Cloud & Core app.",
        "locale": "en_US",
        "h1": "Aerial Yoga and Pilates in Hurfeish — Easy Booking Through the App",
        "schedule": "View Schedule and Book",
    },
}
SAFE_UTM = {"utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "utm_id"}
QA = {"base": BASE, "locales": {}, "captures": [], "performance": {}}


def text(value):
    return re.sub(r"\s+", " ", html.unescape(value or "")).strip()


def route(value):
    return urlparse(value or "").path


def assert_safe_params(value, required=()):
    keys = set(parse_qs(urlparse(value or "").query, keep_blank_values=True))
    assert keys.issubset(SAFE_UTM), f"unsafe marketing URL: {value}"
    assert set(required).issubset(keys), f"missing safe UTM values: {value}"


def rgb(value):
    match = re.fullmatch(r"rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)", value)
    assert match, f"not an opaque RGB value: {value}"
    return tuple(int(item) for item in match.groups())


def contrast(foreground, background):
    def luminance(color):
        channels = []
        for component in color:
            item = component / 255
            channels.append(item / 12.92 if item <= 0.03928 else ((item + 0.055) / 1.055) ** 2.4)
        return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]

    light, dark = sorted((luminance(rgb(foreground)), luminance(rgb(background))), reverse=True)
    return (light + 0.05) / (dark + 0.05)


async def get(context, value, **options):
    response = await context.request.get(f"{BASE}{value}", **options)
    return response, await response.text()


async def assert_head(page, language):
    expected = LANGUAGES[language]
    canonical = f"{ORIGIN}/app/{language}"
    assert await page.locator("html").get_attribute("lang") == language
    assert await page.locator("html").get_attribute("dir") == expected["dir"]
    assert await page.title() == expected["title"]
    assert await page.locator('meta[name="description"]').get_attribute("content") == expected["description"]
    assert await page.locator('meta[name="robots"]').get_attribute("content") == "index, follow"
    assert await page.locator('meta[name="apple-itunes-app"]').get_attribute("content") == "app-id=6786035836"
    assert await page.locator('link[rel="canonical"]').get_attribute("href") == canonical
    assert await page.locator('link[rel="preload"][as="image"][href="/images/auth/cloud-core-auth-hero.webp"]').count() >= 1
    assert await page.locator('link[rel="alternate"][hreflang="x-default"]').get_attribute("href") == f"{ORIGIN}/app/ar"
    for code, locale in LANGUAGES.items():
        assert await page.locator(f'link[rel="alternate"][hreflang="{code}"]').get_attribute("href") == f"{ORIGIN}/app/{code}"
        if code != language:
            assert await page.locator(f'meta[property="og:locale:alternate"][content="{locale["locale"]}"]').count() == 1
    assert await page.locator('meta[property="og:url"]').get_attribute("content") == canonical
    assert await page.locator('meta[property="og:locale"]').get_attribute("content") == expected["locale"]
    social = f"{ORIGIN}/images/app-marketing/social/{language}.png"
    assert await page.locator('meta[property="og:image"]').get_attribute("content") == social
    assert await page.locator('meta[name="twitter:image"]').get_attribute("content") == social
    assert await page.locator("h1").count() == 1
    assert text(await page.locator("h1").text_content()) == expected["h1"]


async def assert_ssr_and_schema(context, page, language):
    response, initial = await get(context, f"/app/{language}?{UTM}&{PRIVATE}")
    assert response.status == 200
    assert LANGUAGES[language]["h1"] in text(initial)
    assert f'<html lang="{language}" dir="{LANGUAGES[language]["dir"]}"' in initial
    assert initial.count("<h1") == 1 and "noindex" not in initial.lower() and "/auth" not in response.url
    await page.goto(f"{BASE}/app/{language}?{UTM}&{PRIVATE}", wait_until="networkidle")
    await assert_head(page, language)
    await page.reload(wait_until="networkidle")
    await assert_head(page, language)
    data = json.loads(await page.locator('head script[type="application/ld+json"]').text_content())
    assert data["@context"] == "https://schema.org"
    health, app, faq = data["@graph"]
    assert [item["@type"] for item in data["@graph"]] == ["HealthClub", "SoftwareApplication", "FAQPage"]
    assert health["name"] == "Cloud & Core Studio"
    assert health["geo"] == {"@type": "GeoCoordinates", "latitude": 33.016109, "longitude": 35.349285}
    assert health["address"]["streetAddress"] == "Main Road 89"
    assert health["address"]["addressLocality"] == "Hurfeish"
    assert health["address"]["addressCountry"] == "IL"
    visible_phone = await page.locator('a[href^="tel:"]').first.get_attribute("href")
    visible_email = await page.locator('a[href^="mailto:"]').first.get_attribute("href")
    assert health["telephone"] == (visible_phone or "").removeprefix("tel:")
    assert health["email"] == (visible_email or "").removeprefix("mailto:")
    assert health["availableLanguage"] == ["ar", "he", "en"]
    assert len(health["makesOffer"]) == 4 and all(item["itemOffered"]["@type"] == "Service" for item in health["makesOffer"])
    assert not ({"aggregateRating", "ratingValue", "review", "openingHours", "openingHoursSpecification"} & set(health))
    assert app["url"] == f"{ORIGIN}/app/{language}"
    assert app["installUrl"] == app["downloadUrl"] == INSTALL_URL
    assert app["image"] == f"{ORIGIN}/brand/cloud-core-app-icon.svg"
    assert app["publisher"]["@id"] == health["@id"]
    faq_items = page.locator(".app-marketing__faq-item")
    assert await faq_items.count() == len(faq["mainEntity"]) == 6
    for index, entry in enumerate(faq["mainEntity"]):
        item = faq_items.nth(index)
        assert text(await item.locator("summary").text_content()) == entry["name"]
        assert text(await item.locator("p").text_content()) == entry["acceptedAnswer"]["text"]
    QA["locales"][language] = {"initial_http": response.status, "refresh": "pass", "schema": "pass"}


async def assert_links_and_images(page, language):
    expected_utm = {"utm_source", "utm_medium", "utm_campaign", "utm_content"}
    switcher = page.locator(".app-marketing__language")
    assert await switcher.count() == 3
    active = 0
    for index in range(3):
        item = switcher.nth(index)
        code = await item.get_attribute("hreflang")
        assert code in LANGUAGES and route(await item.get_attribute("href")) == f"/app/{code}"
        assert_safe_params(await item.get_attribute("href"), expected_utm)
        active += int(await item.get_attribute("aria-current") == "page")
    assert active == 1
    schedules, stores, logins = page.locator("[data-schedule-link]"), page.locator("[data-app-store-link]"), page.locator("[data-auth-link], [data-login-link]")
    schedule_count, store_count, login_count = await schedules.count(), await stores.count(), await logins.count()
    assert schedule_count == store_count == 2 and login_count >= 3
    for index in range(schedule_count):
        item = schedules.nth(index)
        assert route(await item.get_attribute("href")) == "/member/schedule"
        assert text(await item.text_content()) == LANGUAGES[language]["schedule"]
        assert_safe_params(await item.get_attribute("href"), expected_utm)
    for index in range(login_count):
        assert route(await logins.nth(index).get_attribute("href")) == "/auth"
        assert_safe_params(await logins.nth(index).get_attribute("href"), expected_utm)
    configured_store_urls = set()
    for index in range(store_count):
        item = stores.nth(index)
        href = await item.get_attribute("href")
        assert href and href.startswith("https://apps.apple.com/") and "id6786035836" in href
        configured_store_urls.add(href)
        assert await item.get_attribute("target") == "_blank"
        assert await item.locator("img").get_attribute("alt") == await item.get_attribute("aria-label")
    assert len(configured_store_urls) == 1
    configured_env = os.environ.get("APP_STORE_URL") or os.environ.get("VITE_APP_STORE_URL")
    if configured_env:
        assert configured_store_urls == {configured_env}
    assert await page.locator('.app-marketing__maps-link[href*="33.016109,35.349285"]').count() == 1
    paths = {route(href) for href in await page.locator("footer a").evaluate_all("items => items.map(item => item.href)")}
    assert {"/support", "/privacy", "/terms", "/auth"}.issubset(paths)
    captures = page.locator("[data-app-screenshot]")
    assert await captures.count() == 5
    sources, alts, headings = set(), set(), set()
    for index in range(5):
        figure, image = captures.nth(index), captures.nth(index).locator("img")
        source, alt, heading = await image.get_attribute("src"), text(await image.get_attribute("alt")), text(await figure.locator("figcaption").text_content())
        assert source and f"/images/app-marketing/{language}/" in source and "generic" not in source.lower()
        assert alt and heading
        sources.add(source); alts.add(alt); headings.add(heading)
    assert len(sources) == len(alts) == len(headings) == 5
    await page.locator(".app-marketing__screens-section").scroll_into_view_if_needed()
    await page.locator("[data-app-screenshot] img").evaluate_all("items => items.forEach(item => { item.loading='eager' })")
    await page.wait_for_function("() => [...document.querySelectorAll('[data-app-screenshot] img')].every(image => image.complete && image.naturalWidth > 0)")
    ratios = await page.locator("[data-app-screenshot] img").evaluate_all("items => items.map(item => [item.naturalWidth/item.naturalHeight,item.getBoundingClientRect().width/item.getBoundingClientRect().height])")
    assert all(abs(natural - displayed) < 0.03 for natural, displayed in ratios)


async def assert_accessibility(page, language):
    headings = await page.locator("h1,h2,h3").evaluate_all("items => items.map(item => Number(item.tagName.slice(1)))")
    assert headings.count(1) == 1 and all(next_level <= level + 1 for level, next_level in zip(headings, headings[1:]))
    await page.keyboard.press("Tab")
    assert await page.locator(":focus").get_attribute("href") == "#main-content"
    focus = await page.locator(":focus").evaluate("item => {const style=getComputedStyle(item);return [style.outlineStyle,style.outlineWidth,style.outlineOffset]}")
    assert focus[0] != "none" and focus[1] != "0px" and focus[2] != "0px"
    faq = page.locator(".app-marketing__faq-item").first
    await faq.locator("summary").focus()
    closed = await faq.locator("summary").evaluate("item => getComputedStyle(item,'::after').content")
    await page.keyboard.press("Enter")
    assert await faq.get_attribute("open") is not None and await faq.locator("p").is_visible()
    opened = await faq.locator("summary").evaluate("item => getComputedStyle(item,'::after').content")
    assert closed != opened and "−" in opened
    sizes = await page.locator(".app-marketing a,.app-marketing summary").evaluate_all("items => items.map(item => {const b=item.getBoundingClientRect();return [b.width,b.height]}).filter(([w,h])=>w&&h)")
    assert all(width >= 44 or height >= 44 for width, height in sizes)
    images = await page.locator(".app-marketing img").evaluate_all("items => items.map(item => ({alt:item.getAttribute('alt'),hidden:Boolean(item.closest('[aria-hidden=true]'))}))")
    assert all(item["alt"] is not None and (item["alt"] or item["hidden"]) for item in images)
    if language in {"ar", "he"}:
        transforms = await page.locator(".app-marketing__direction-icon").evaluate_all("items => items.map(item => getComputedStyle(item).transform)")
        assert all(item.startswith("matrix(-1") for item in transforms)
    pairs = await page.evaluate("""() => {
      const pair=(fg,bg)=>[getComputedStyle(document.querySelector(fg)).color,getComputedStyle(document.querySelector(bg)).backgroundColor];
      return [pair('.app-marketing__location h2','.app-marketing'),pair('.app-marketing__features h2','.app-marketing__features'),pair('.app-marketing__hero-actions .app-marketing__primary-cta','.app-marketing__hero-actions .app-marketing__primary-cta')];
    }""")
    assert all(contrast(*pair) >= 4.5 for pair in pairs)


async def assert_responsive(page, language):
    for width, height in VIEWPORTS:
        await page.set_viewport_size({"width": width, "height": height})
        await page.goto(f"{BASE}/app/{language}?{UTM}", wait_until="networkidle")
        metrics = await page.evaluate("""() => {
          const box=selector=>document.querySelector(selector).getBoundingClientRect();
          return {overflow:document.documentElement.scrollWidth-window.innerWidth,brand:box('.app-marketing__brand-link'),actions:box('.app-marketing__header-actions'),badge:box('[data-app-store-link]'),broken:[...document.images].filter(item=>!item.complete||!item.naturalWidth).map(item=>item.currentSrc)};
        }""")
        assert metrics["overflow"] <= 1, f"{language} {width}x{height}: {metrics['overflow']}px overflow"
        assert metrics["badge"]["width"] >= 44 and metrics["badge"]["height"] >= 40 and not metrics["broken"]
        if width <= 430:
            brand, actions = metrics["brand"], metrics["actions"]
            assert brand["x"] + brand["width"] <= actions["x"] or actions["x"] + actions["width"] <= brand["x"], f"{language} header overlap at {width}px"
        faq = page.locator(".app-marketing__faq-item").last
        await faq.locator("summary").click()
        assert await faq.locator("p").is_visible()


async def capture(page, language):
    sections = {"hero": ".app-marketing__hero", "showcase": ".app-marketing__screens-section", "classes": ".app-marketing__classes", "faq": ".app-marketing__faq", "location": ".app-marketing__location", "final-cta": ".app-marketing__final-cta"}
    for width, height in ((390, 844), (1440, 900)):
        await page.set_viewport_size({"width": width, "height": height})
        await page.goto(f"{BASE}/app/{language}?{UTM}", wait_until="networkidle")
        gallery_images = page.locator("[data-app-screenshot] img")
        await page.locator(".app-marketing__screens-section").scroll_into_view_if_needed()
        await gallery_images.evaluate_all("items => items.forEach(item => { item.loading='eager' })")
        await page.wait_for_function("() => [...document.querySelectorAll('[data-app-screenshot] img')].every(image => image.complete && image.naturalWidth > 0)")
        await gallery_images.evaluate_all("items => Promise.all(items.map(item => item.decode()))")
        full = OUTPUT / f"app-{language}-{width}x{height}-full.png"
        await page.screenshot(path=full, full_page=True)
        QA["captures"].append(str(full))
        for name, selector in sections.items():
            item = page.locator(selector)
            await item.scroll_into_view_if_needed()
            target = OUTPUT / f"app-{language}-{width}x{height}-{name}.png"
            await item.screenshot(path=target)
            QA["captures"].append(str(target))


async def assert_routes(browser, context):
    redirect_cases = [
        ("/app?lang=en&utm_source=qa&token=private", {}, "/app/en?utm_source=qa"),
        ("/app?utm_source=qa", {"Cookie": "cc_lang=he"}, "/app/he?utm_source=qa"),
        ("/app?utm_source=qa", {"Accept-Language": "en-US,en;q=0.8,ar;q=0.7"}, "/app/en?utm_source=qa"),
        ("/app?utm_source=qa", {}, "/app/ar?utm_source=qa"),
    ]
    for value, headers, expected in redirect_cases:
        response, _ = await get(context, value, headers=headers, max_redirects=0)
        assert response.status == 307 and response.headers["location"] == expected
    for value, headers in (("/?platform=native&token=private", {}), ("/", {"User-Agent": "CloudCoreNative/1"})):
        response, _ = await get(context, value, headers=headers, max_redirects=0)
        assert response.status in (302, 303, 307, 308) and route(response.headers["location"]) == "/auth"
    iphone = {"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15"}
    response, body = await get(context, "/", headers=iphone, max_redirects=0)
    assert response.status == 200 and "noindex,follow" in body and "Opening Cloud &amp; Core" in body
    malformed, _ = await get(context, "/", headers={"Cookie": "sb-invalid-auth-token=not-a-jwt"}, max_redirects=0)
    assert malformed.status < 500
    web = await browser.new_context(locale="en-US", viewport={"width": 390, "height": 844})
    root = await web.new_page()
    await root.goto(f"{BASE}/", wait_until="networkidle")
    await root.wait_for_url(re.compile(r".*/app/(ar|he|en)(?:\?.*)?$"), timeout=10000)
    assert await root.locator("html").get_attribute("lang") == route(root.url).rsplit("/", 1)[-1]
    await web.close()
    for value in ("/auth", "/support", "/privacy", "/terms", "/member/schedule", "/payment-result"):
        response, _ = await get(context, value)
        assert response.status == 200, f"{value} returned {response.status}"
    for value in ("/member", "/admin", "/instructor"):
        response, _ = await get(context, value, max_redirects=0)
        assert response.status in (302, 303, 307, 308) and route(response.headers["location"]) == "/auth"
    sitemap, sitemap_body = await get(context, "/sitemap.xml")
    robots, robots_body = await get(context, "/robots.txt")
    assert sitemap.status == robots.status == 200
    assert sitemap.headers["content-type"] == "application/xml; charset=utf-8"
    assert robots.headers["content-type"] == "text/plain; charset=utf-8"
    assert sitemap_body.count("<url><loc>") == 6 and "/app/he" in sitemap_body and "/auth" not in sitemap_body
    assert robots_body == "User-agent: *\nAllow: /\n\nSitemap: https://cloudandcorestudio.com/sitemap.xml\n"
    for value, body, response in (("/sitemap.xml", sitemap_body, sitemap), ("/robots.txt", robots_body, robots)):
        head = await context.request.head(f"{BASE}{value}")
        assert head.status == 200 and await head.text() == ""
        assert head.headers["content-type"] == response.headers["content-type"]
        assert head.headers["content-length"] == str(len(body.encode()))


async def assert_reduced_motion(browser):
    context = await browser.new_context(viewport={"width": 390, "height": 844}, reduced_motion="reduce")
    page = await context.new_page()
    await page.goto(f"{BASE}/app/he", wait_until="networkidle")
    durations = await page.locator(".app-marketing *").evaluate_all("items => items.map(item => {const value=getComputedStyle(item).animationDuration;return value.endsWith('ms')?Number.parseFloat(value):value.endsWith('s')?Number.parseFloat(value)*1000:0})")
    assert max(durations, default=0) <= 0.01
    await context.close()


async def assert_analytics_and_performance(browser):
    context = await browser.new_context(viewport={"width": 390, "height": 844})
    await context.add_init_script("""(() => {
      window.dataLayer=[];window.__appSeoQaEvents=[];
      window.addEventListener('cloudcore:analytics',event=>window.__appSeoQaEvents.push(event.detail));
    })()""")
    page = await context.new_page()
    await page.goto(f"{BASE}/app/en?utm_source=qa&utm_medium=browser&utm_campaign=private%40example.com", wait_until="networkidle")
    await page.wait_for_timeout(250)
    events = await page.evaluate("window.__appSeoQaEvents")
    views = [item for item in events if item["event"] == "app_landing_view"]
    allowed = {"event", "language", "route", "utm_source", "utm_medium", "utm_campaign", "device_type", "cta_location"}
    assert len(views) == 1 and "utm_campaign" not in views[0] and set(views[0]).issubset(allowed)
    active = page.locator('.app-marketing__language[aria-current="page"]')
    await active.evaluate("item=>{item.addEventListener('click',event=>event.preventDefault(),{once:true});item.click()}")
    assert not [item for item in await page.evaluate("window.__appSeoQaEvents") if item["event"] == "app_landing_language_change"]
    for selector in ('.app-marketing__language[href*="/app/ar"]', "[data-app-store-link]", "[data-schedule-link]"):
        item = page.locator(selector).first
        await item.evaluate("item=>{item.addEventListener('click',event=>event.preventDefault(),{once:true});item.click()}")
    events = await page.evaluate("window.__appSeoQaEvents")
    assert {"app_landing_language_change", "app_landing_app_store_click", "app_landing_view_schedule"}.issubset({item["event"] for item in events})
    assert all(set(item).issubset(allowed) and "private@example.com" not in json.dumps(item) for item in events)
    marketing_resources = await page.evaluate("performance.getEntriesByType('resource').map(item=>item.name)")
    assert not any(re.search(r"/(admin|payments?|stripe|supabase)[-.]", item, re.I) for item in marketing_resources)
    await page.goto(f"{BASE}/app/en?{UTM}", wait_until="networkidle")
    await page.locator("[data-schedule-link]").first.click()
    await page.wait_for_url("**/member/schedule**")
    timing = await page.evaluate("""() => {
      const nav=performance.getEntriesByType('navigation')[0];
      return {domContentLoaded:nav.domContentLoadedEventEnd,load:nav.loadEventEnd,resources:performance.getEntriesByType('resource').map(item=>item.name)};
    }""")
    assert timing["domContentLoaded"] >= 0 and timing["load"] >= 0
    assert not any(re.search(r"/(admin|payments?|stripe|supabase)[-.]", item, re.I) for item in timing["resources"])
    QA["performance"] = {"marketing_resources": marketing_resources, "navigation": timing, "lighthouse": "blocked: no local lighthouse package or CLI; npx --no-install lighthouse --version attempted the registry and failed ENOTFOUND; no install or download was performed"}
    await context.close()


def write_summary():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    (OUTPUT / "qa-summary.json").write_text(json.dumps(QA, ensure_ascii=False, indent=2) + "\n")
    captures = "\n".join(f"- {item}" for item in QA["captures"])
    (OUTPUT / "qa-summary.md").write_text(
        "# App SEO remediation QA\n\n"
        f"- Base URL: {BASE}\n"
        "- Passed: SSR, redirects, browser analytics, keyboard/a11y semantics, contrast, reduced motion, responsive viewports, and safe route regressions.\n"
        "- Lighthouse blocker: no local package or CLI; npx --no-install lighthouse --version attempted the registry and failed ENOTFOUND. qa-summary.json contains real Navigation Timing and resource evidence; no score or INP is fabricated.\n"
        "- Inspect captures for direction, clipping, text readability, imagery, CTA prominence, and spacing.\n\n"
        "## Captures\n\n" + captures + "\n"
    )


async def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 390, "height": 844})
        page = await context.new_page()
        try:
            await assert_routes(browser, context)
            for language in LANGUAGES:
                await assert_ssr_and_schema(context, page, language)
                await assert_links_and_images(page, language)
                await assert_accessibility(page, language)
                await assert_responsive(page, language)
                await capture(page, language)
            await assert_reduced_motion(browser)
            await assert_analytics_and_performance(browser)
            write_summary()
        finally:
            await context.close()
            await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
