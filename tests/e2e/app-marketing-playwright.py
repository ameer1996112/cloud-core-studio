"""Local production SSR, browser, accessibility, responsive, and visual QA for /app."""

import asyncio
import html
import json
import os
import re
import shutil
from html.parser import HTMLParser
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


class HeadSnapshotParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.in_head = False
        self.in_title = False
        self.in_json_ld = False
        self.title_parts = []
        self.json_ld_parts = []
        self.meta = []
        self.links = []

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag == "head":
            self.in_head = True
        if not self.in_head:
            return
        if tag == "title":
            self.in_title = True
        elif tag == "meta":
            self.meta.append(attributes)
        elif tag == "link":
            self.links.append(attributes)
        elif tag == "script" and attributes.get("type") == "application/ld+json":
            self.in_json_ld = True

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False
        elif tag == "script":
            self.in_json_ld = False
        elif tag == "head":
            self.in_head = False

    def handle_data(self, data):
        if self.in_title:
            self.title_parts.append(data)
        if self.in_json_ld:
            self.json_ld_parts.append(data)

    @property
    def title(self):
        return text("".join(self.title_parts))

    @property
    def structured_data(self):
        assert self.json_ld_parts, "SSR response is missing JSON-LD"
        return json.loads("".join(self.json_ld_parts))


def parse_head_snapshot(markup):
    parser = HeadSnapshotParser()
    parser.feed(markup)
    return parser


def meta_values(snapshot, attribute, value):
    return [item.get("content") for item in snapshot.meta if item.get(attribute) == value]


def assert_ssr_head(snapshot, language):
    expected = LANGUAGES[language]
    canonical = f"{ORIGIN}/app/{language}"
    assert snapshot.title == expected["title"]
    assert meta_values(snapshot, "name", "description") == [expected["description"]]
    assert meta_values(snapshot, "name", "robots") == ["index, follow"]
    assert meta_values(snapshot, "name", "apple-itunes-app") == ["app-id=6786035836"]
    assert meta_values(snapshot, "property", "og:title") == [expected["title"]]
    assert meta_values(snapshot, "property", "og:description") == [expected["description"]]
    assert meta_values(snapshot, "property", "og:type") == ["website"]
    assert meta_values(snapshot, "property", "og:url") == [canonical]
    assert meta_values(snapshot, "property", "og:locale") == [expected["locale"]]
    assert meta_values(snapshot, "name", "twitter:card") == ["summary_large_image"]
    assert meta_values(snapshot, "name", "twitter:title") == [expected["title"]]
    assert meta_values(snapshot, "name", "twitter:description") == [expected["description"]]
    social = f"{ORIGIN}/images/app-marketing/social/{language}.png"
    assert meta_values(snapshot, "property", "og:image") == [social]
    assert meta_values(snapshot, "name", "twitter:image") == [social]
    canonical_links = [item for item in snapshot.links if item.get("rel") == "canonical"]
    assert canonical_links == [{"rel": "canonical", "href": canonical}]
    alternates = {
        item.get("hreflang"): item.get("href")
        for item in snapshot.links
        if item.get("rel") == "alternate"
    }
    assert alternates == {
        "ar": f"{ORIGIN}/app/ar",
        "he": f"{ORIGIN}/app/he",
        "en": f"{ORIGIN}/app/en",
        "x-default": f"{ORIGIN}/app/ar",
    }
    assert any(
        item.get("rel") == "preload"
        and item.get("as") == "image"
        and item.get("href") == "/images/auth/cloud-core-auth-hero.webp"
        for item in snapshot.links
    )


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
    assert await page.locator('meta[property="og:title"]').get_attribute("content") == expected["title"]
    assert await page.locator('meta[property="og:description"]').get_attribute("content") == expected["description"]
    assert await page.locator('meta[property="og:type"]').get_attribute("content") == "website"
    assert await page.locator('meta[name="twitter:card"]').get_attribute("content") == "summary_large_image"
    assert await page.locator('meta[name="twitter:title"]').get_attribute("content") == expected["title"]
    assert await page.locator('meta[name="twitter:description"]').get_attribute("content") == expected["description"]
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
    ssr_head = parse_head_snapshot(initial)
    assert_ssr_head(ssr_head, language)
    ssr_data = ssr_head.structured_data
    await page.goto(f"{BASE}/app/{language}?{UTM}&{PRIVATE}", wait_until="networkidle")
    await assert_head(page, language)
    await page.reload(wait_until="networkidle")
    await assert_head(page, language)
    data = json.loads(await page.locator('head script[type="application/ld+json"]').text_content())
    assert data == ssr_data
    assert data["@context"] == "https://schema.org"
    health, app, faq = data["@graph"]
    assert [item["@type"] for item in data["@graph"]] == ["HealthClub", "SoftwareApplication", "FAQPage"]
    assert health["name"] == "Cloud & Core Studio"
    assert set(health) == {
        "@type", "@id", "name", "alternateName", "url", "logo", "image", "telephone",
        "email", "address", "geo", "availableLanguage", "makesOffer",
    } | ({"sameAs"} if "sameAs" in health else set())
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
    assert set(app) == {
        "@type", "@id", "name", "description", "applicationCategory", "operatingSystem",
        "url", "installUrl", "downloadUrl", "image", "publisher",
    }
    assert set(faq) == {"@type", "@id", "url", "mainEntity"}
    assert faq["url"] == f"{ORIGIN}/app/{language}"
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
    signups = page.locator("[data-create-account-link]")
    schedule_count, store_count, login_count = await schedules.count(), await stores.count(), await logins.count()
    assert schedule_count == store_count == 2 and login_count >= 3 and await signups.count() == 1
    for index in range(schedule_count):
        item = schedules.nth(index)
        assert route(await item.get_attribute("href")) == "/member/schedule"
        assert text(await item.text_content()) == LANGUAGES[language]["schedule"]
        assert_safe_params(await item.get_attribute("href"), expected_utm)
    for index in range(login_count):
        assert route(await logins.nth(index).get_attribute("href")) == "/auth"
        assert_safe_params(await logins.nth(index).get_attribute("href"), expected_utm)
    signup_href = await signups.get_attribute("href")
    signup_params = parse_qs(urlparse(signup_href).query, keep_blank_values=True)
    assert route(signup_href) == "/auth" and signup_params.pop("mode") == ["signup"]
    assert set(signup_params) == expected_utm
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
    sizes = await page.locator(".app-marketing a,.app-marketing summary").evaluate_all("items => items.map(item => {const b=item.getBoundingClientRect();return {label:(item.getAttribute('aria-label')||item.textContent||'').trim().slice(0,80),className:item.className,width:b.width,height:b.height}}).filter(item=>item.width&&item.height)")
    undersized = [item for item in sizes if item["width"] < 44 or item["height"] < 44]
    assert not undersized, f"undersized controls: {undersized}"
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
        await page.locator(".app-marketing img").evaluate_all("items => items.forEach(item => { item.loading='eager' })")
        await page.wait_for_function("() => [...document.querySelectorAll('.app-marketing img')].every(image => image.complete && image.naturalWidth > 0)")
        metrics = await page.evaluate("""() => {
          const box=selector=>document.querySelector(selector).getBoundingClientRect();
          const sections=[...document.querySelectorAll('.app-marketing__main > section')].map(item=>{const value=item.getBoundingClientRect();return {name:item.className,top:value.top,bottom:value.bottom,left:value.left,right:value.right,width:value.width,height:value.height}});
          const content=[...document.querySelectorAll('.app-marketing h1,.app-marketing h2,.app-marketing h3,.app-marketing p,.app-marketing a,.app-marketing summary')].filter(item=>item.getClientRects().length).map(item=>{const value=item.getBoundingClientRect();return {name:item.className,left:value.left,right:value.right,width:value.width,height:value.height}});
          const ratios=[...document.querySelectorAll('[data-app-screenshot] img')].filter(item=>item.getClientRects().length).map(item=>({src:item.getAttribute('src'),natural:item.naturalWidth/item.naturalHeight,displayed:item.getBoundingClientRect().width/item.getBoundingClientRect().height}));
          return {overflow:document.documentElement.scrollWidth-window.innerWidth,brand:box('.app-marketing__brand-link'),actions:box('.app-marketing__header-actions'),badge:box('[data-app-store-link]'),broken:[...document.images].filter(item=>!item.complete||!item.naturalWidth).map(item=>item.currentSrc),sections,content,ratios};
        }""")
        assert metrics["overflow"] <= 1, f"{language} {width}x{height}: {metrics['overflow']}px overflow"
        assert metrics["badge"]["width"] >= 44 and metrics["badge"]["height"] >= 40 and not metrics["broken"]
        assert all(item["width"] > 0 and item["height"] > 0 for item in metrics["sections"])
        assert all(
            next_item["top"] + 1 >= item["bottom"]
            for item, next_item in zip(metrics["sections"], metrics["sections"][1:])
        ), f"{language} section overlap at {width}px"
        assert all(
            item["left"] >= -1 and item["right"] <= width + 1 and item["width"] > 0 and item["height"] > 0
            for item in metrics["content"]
        ), f"{language} clipped or hidden content at {width}px"
        distorted = [item for item in metrics["ratios"] if abs(item["natural"] - item["displayed"]) >= 0.03]
        assert not distorted, f"{language} distorted images at {width}px: {distorted}"
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
        header = page.locator(".app-marketing__header")
        skip_link = page.locator(".app-marketing__skip-link")
        await page.evaluate("document.activeElement?.blur()")
        await header.evaluate("item => { item.style.visibility = 'hidden' }")
        await skip_link.evaluate("item => { item.style.visibility = 'hidden' }")
        try:
            for name, selector in sections.items():
                item = page.locator(selector)
                await item.scroll_into_view_if_needed()
                target = OUTPUT / f"app-{language}-{width}x{height}-{name}.png"
                await item.screenshot(path=target)
                QA["captures"].append(str(target))
        finally:
            await header.evaluate("item => { item.style.visibility = '' }")
            await skip_link.evaluate("item => { item.style.visibility = '' }")


async def assert_routes(browser, context):
    redirect_cases = [
        (
            "/app?lang=en&utm_source=qa&token=private",
            {"Cookie": "cc_lang=he", "Accept-Language": "ar-IL,ar;q=0.9"},
            "/app/en?utm_source=qa",
        ),
        ("/app?lang=en&utm_source=qa&token=private", {}, "/app/en?utm_source=qa"),
    ]
    for value, headers, expected in redirect_cases:
        response, _ = await get(context, value, headers=headers, max_redirects=0)
        assert response.status == 307 and response.headers["location"] == expected
    resolver, resolver_body = await get(context, "/app?utm_source=qa", max_redirects=0)
    assert resolver.status == 200
    assert resolver.headers["x-robots-tag"] == "noindex, follow"
    assert "noindex,follow" in resolver_body
    assert all(f'href="/app/{language}?utm_source=qa"' in resolver_body for language in LANGUAGES)
    saved_locale = await browser.new_context(locale="en-US", viewport={"width": 390, "height": 844})
    saved_page = await saved_locale.new_page()
    await saved_page.add_init_script("localStorage.setItem('cc_lang', 'he')")
    await saved_page.goto(f"{BASE}/app?utm_source=qa&token=private", wait_until="networkidle")
    await saved_page.wait_for_url(re.compile(r".*/app/he\?utm_source=qa$"), timeout=10000)
    assert await saved_page.locator("html").get_attribute("lang") == "he"
    await saved_locale.close()
    for locale, expected in (("en-US", "en"), ("fr-FR", "ar")):
        browser_locale = await browser.new_context(locale=locale, viewport={"width": 390, "height": 844})
        locale_page = await browser_locale.new_page()
        await locale_page.goto(f"{BASE}/app?utm_source=qa&token=private", wait_until="networkidle")
        await locale_page.wait_for_url(re.compile(rf".*/app/{expected}\?utm_source=qa$"), timeout=10000)
        assert await locale_page.locator("html").get_attribute("lang") == expected
        await browser_locale.close()
    for value, headers in (("/?platform=native&token=private", {}), ("/", {"User-Agent": "CloudCoreNative/1"})):
        response, _ = await get(context, value, headers=headers, max_redirects=0)
        assert response.status in (302, 303, 307, 308) and route(response.headers["location"]) == "/auth"
    iphone = {"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15"}
    response, body = await get(context, "/", headers=iphone, max_redirects=0)
    assert response.status == 200 and "noindex,follow" in body and "Opening Cloud &amp; Core" in body
    malformed, malformed_body = await get(
        context,
        "/",
        headers={"Cookie": "cc_sb_access_token=%E0%A4%A; cc_sb_refresh_token=not-a-jwt"},
        max_redirects=0,
    )
    assert malformed.status == 200
    assert "noindex,follow" in malformed_body and "Opening Cloud &amp; Core" in malformed_body
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
    durations = await page.locator(".app-marketing *").evaluate_all("""items => items.flatMap(item => {
      const style=getComputedStyle(item);
      const milliseconds=value=>value.split(',').map(part=>part.trim()).map(part=>part.endsWith('ms')?Number.parseFloat(part):part.endsWith('s')?Number.parseFloat(part)*1000:0);
      return [...milliseconds(style.animationDuration),...milliseconds(style.animationDelay),...milliseconds(style.transitionDuration),...milliseconds(style.transitionDelay)];
    })""")
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
    assert len(views) == 1 and views[0]["language"] == "en" and views[0]["route"] == "/app/en"
    assert "utm_campaign" not in views[0] and set(views[0]).issubset(allowed)
    active = page.locator('.app-marketing__language[aria-current="page"]')
    await active.evaluate("item=>{item.addEventListener('click',event=>event.preventDefault(),{once:true});item.click()}")
    assert not [item for item in await page.evaluate("window.__appSeoQaEvents") if item["event"] == "app_landing_language_change"]
    tracked_clicks = (
        ('.app-marketing__language[href*="/app/ar"]', "app_landing_language_change", "ar"),
        ("[data-app-store-link]", "app_landing_app_store_click", "en"),
        ("[data-schedule-link]", "app_landing_view_schedule", "en"),
        ("[data-create-account-link]", "app_landing_create_account", "en"),
        ("[data-auth-link]", "app_landing_login", "en"),
        (".app-marketing__maps-link", "app_landing_maps_click", "en"),
        ('.app-marketing a[href="/support"]', "app_landing_support_click", "en"),
    )
    for selector, expected_event, expected_language in tracked_clicks:
        item = page.locator(selector).first
        await item.evaluate("item=>{item.addEventListener('click',event=>event.preventDefault(),{once:true});item.click()}")
        matching = [entry for entry in await page.evaluate("window.__appSeoQaEvents") if entry["event"] == expected_event]
        assert matching and matching[-1]["language"] == expected_language
    for selector, expected_event in (
        ('.app-marketing a[href*="wa.me"]', "app_landing_whatsapp_click"),
        ('.app-marketing a[href*="instagram.com"]', "app_landing_instagram_click"),
    ):
        item = page.locator(selector).first
        if await item.count():
            await item.evaluate("item=>{item.addEventListener('click',event=>event.preventDefault(),{once:true});item.click()}")
            matching = [entry for entry in await page.evaluate("window.__appSeoQaEvents") if entry["event"] == expected_event]
            assert matching and matching[-1]["language"] == "en"
    events = await page.evaluate("window.__appSeoQaEvents")
    assert {
        "app_landing_language_change", "app_landing_app_store_click", "app_landing_view_schedule",
        "app_landing_create_account", "app_landing_login", "app_landing_maps_click",
        "app_landing_support_click",
    }.issubset({item["event"] for item in events})
    assert all(set(item).issubset(allowed) and "private@example.com" not in json.dumps(item) for item in events)
    assert all(item.get("route") == "/app/en" for item in events)
    data_layer = await page.evaluate("window.dataLayer")
    assert [item["event"] for item in data_layer] == [item["event"] for item in events]
    signup_href = await page.locator("[data-create-account-link]").get_attribute("href")
    signup_url = urlparse(signup_href)
    signup_search = parse_qs(signup_url.query)
    assert signup_url.path == "/auth" and signup_search["mode"] == ["signup"]
    assert signup_search["utm_source"] == ["qa"] and signup_search["utm_medium"] == ["browser"]
    signup_page = await context.new_page()
    await signup_page.goto(f"{BASE}{signup_href}", wait_until="networkidle")
    await signup_page.locator('input[name="name"]').wait_for(state="visible")
    await signup_page.close()
    marketing_resources = await page.evaluate("""performance.getEntriesByType('resource').map(item=>({
      name:item.name,initiatorType:item.initiatorType,transferSize:item.transferSize,
      encodedBodySize:item.encodedBodySize,decodedBodySize:item.decodedBodySize
    }))""")
    forbidden_marketing_bundles = re.compile(
        r"/(?:assets/)?(?:admin|payments?|stripe|supabase)[-.]|adminPush|memberPushDevice",
        re.I,
    )
    assert not any(forbidden_marketing_bundles.search(item["name"]) for item in marketing_resources)
    loaded_scripts = [
        item["name"] for item in marketing_resources
        if urlparse(item["name"]).netloc == urlparse(BASE).netloc
        and urlparse(item["name"]).path.endswith(".js")
    ]
    forbidden_auth_bootstrap = re.compile(
        r"(?:\.supabase\.co|/auth/v1/|/rest/v1/|/realtime/v1/)", re.I
    )
    auth_bootstrap_resources = [
        item["name"] for item in marketing_resources
        if forbidden_auth_bootstrap.search(item["name"])
    ]
    assert loaded_scripts
    assert not auth_bootstrap_resources, f"public marketing bootstrapped auth: {auth_bootstrap_resources}"
    await page.goto(f"{BASE}/app/en?{UTM}", wait_until="networkidle")
    await page.locator("[data-schedule-link]").first.click()
    await page.wait_for_url("**/member/schedule**")
    schedule_auth_href = await page.locator('a[href^="/auth?returnTo="]').first.get_attribute("href")
    return_to = parse_qs(urlparse(schedule_auth_href).query)["returnTo"][0]
    return_to_url = urlparse(return_to)
    assert return_to_url.path == "/member/schedule"
    assert set(parse_qs(return_to_url.query)) == {"utm_source", "utm_medium", "utm_campaign", "utm_content"}
    timing = await page.evaluate("""() => {
      const nav=performance.getEntriesByType('navigation')[0];
      return {domContentLoaded:nav.domContentLoadedEventEnd,load:nav.loadEventEnd,resources:performance.getEntriesByType('resource').map(item=>item.name)};
    }""")
    assert timing["domContentLoaded"] >= 0 and timing["load"] >= 0
    assert not any(re.search(r"/(admin|payments?|stripe|supabase)[-.]", item, re.I) for item in timing["resources"])
    local_lighthouse = Path("node_modules/.bin/lighthouse")
    system_lighthouse = shutil.which("lighthouse")
    lighthouse = {
        "status": "available" if local_lighthouse.exists() or system_lighthouse else "unavailable",
        "local_executable": str(local_lighthouse) if local_lighthouse.exists() else system_lighthouse,
    }
    if lighthouse["status"] == "unavailable":
        lighthouse["reason"] = "No local Lighthouse executable was found; no score, LCP, CLS, or INP was recorded."
    QA["performance"] = {"marketing_resources": marketing_resources, "navigation": timing, "lighthouse": lighthouse}
    await context.close()


def write_summary():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    manual_review = os.environ.get("APP_QA_MANUAL_REVIEW", "pending")
    QA["manual_review"] = {
        "status": "passed" if manual_review.startswith("passed:") else "pending",
        "notes": manual_review,
    }
    (OUTPUT / "qa-summary.json").write_text(json.dumps(QA, ensure_ascii=False, indent=2) + "\n")
    captures = "\n".join(f"- {item}" for item in QA["captures"])
    lighthouse = QA["performance"]["lighthouse"]
    lighthouse_note = (
        "Local Lighthouse executable available; run separately for scores."
        if lighthouse["status"] == "available"
        else lighthouse["reason"]
    )
    (OUTPUT / "qa-summary.md").write_text(
        "# App SEO remediation QA\n\n"
        f"- Base URL: {BASE}\n"
        "- Passed: SSR, redirects, browser analytics, keyboard/a11y semantics, contrast, reduced motion, responsive viewports, and safe route regressions.\n"
        f"- Lighthouse: {lighthouse_note}\n"
        f"- Manual review: {manual_review}\n\n"
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
