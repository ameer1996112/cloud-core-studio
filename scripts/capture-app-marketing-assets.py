#!/usr/bin/env python3
"""Generate localized, deterministic marketing captures from the local fixture only."""

import asyncio
import hashlib
import json
import os
import socket
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import urlencode

ROOT = Path(__file__).resolve().parents[1]
FIXTURE_CONFIG = ROOT / "tests/fixtures/app-marketing/vite.config.ts"
MANIFEST_FILE = ROOT / "tests/fixtures/app-marketing/asset-manifest.json"
HOST = "127.0.0.1"
LANGUAGES = ("ar", "he", "en")
PHONE_SCREENS = ("schedule", "booking", "bookings", "membership", "account")
SESSION_STARTS_AT = "2031-09-10T17:30:00.000Z"
STUDIO_TIME_ZONE = "Asia/Jerusalem"


def reject_production() -> None:
    if os.environ.get("NODE_ENV") == "production":
        raise RuntimeError("Refusing to capture assets with NODE_ENV=production.")


def free_loopback_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.bind((HOST, 0))
        return int(probe.getsockname()[1])


def wait_for_loopback_server(process: subprocess.Popen[bytes], port: int) -> None:
    deadline = time.monotonic() + 20
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError("The local app-marketing fixture server stopped before it became ready.")
        try:
            with socket.create_connection((HOST, port), timeout=0.25):
                return
        except OSError:
            time.sleep(0.2)
    raise RuntimeError("Timed out waiting for the local app-marketing fixture server.")


def local_only(url: str, base_url: str) -> bool:
    return url.startswith(base_url + "/") or url == base_url


def png_metadata(path: Path) -> dict[str, object]:
    content = path.read_bytes()
    if content[:8] != b"\x89PNG\r\n\x1a\n":
        raise RuntimeError(f"Expected a PNG capture at {path}.")
    return {
        "file": path.relative_to(ROOT).as_posix(),
        "dimensions": {
            "width": int.from_bytes(content[16:20], "big"),
            "height": int.from_bytes(content[20:24], "big"),
        },
        "sha256": hashlib.sha256(content).hexdigest(),
    }


def write_manifest() -> None:
    assets: dict[str, dict[str, dict[str, object]]] = {}
    for lang in LANGUAGES:
        language_assets: dict[str, dict[str, object]] = {}
        for screen in PHONE_SCREENS:
            file = ROOT / "public/images/app-marketing" / lang / f"{screen}.png"
            language_assets[screen] = png_metadata(file)
        language_assets["schedule"]["positiveState"] = {
            "availableClassCount": 3,
            "bookingAction": True,
            "openSpots": [5, 3, 6],
        }
        language_assets["booking"]["positiveState"] = {
            "bookingAction": True,
            "openSpots": 5,
        }
        language_assets["bookings"]["positiveState"] = {"confirmed": True}
        language_assets["membership"]["positiveState"] = {"active": True, "credits": 8}
        language_assets["account"]["positiveState"] = {
            "completeFictionalProfile": True,
            "profileName": {
                "ar": "عضوة تجريبية",
                "he": "חברת סטודיו",
                "en": "Demo Member",
            }[lang],
        }
        social = png_metadata(ROOT / "public/images/app-marketing/social" / f"{lang}.png")
        social["provenance"] = {
            "officialLogo": "/brand/cloud-core-logo-full.svg",
            "studioImage": "/images/auth/cloud-core-auth-hero.webp",
            "people": False,
        }
        language_assets["social"] = social
        assets[lang] = language_assets

    manifest = {
        "version": 1,
        "generatedBy": "scripts/capture-app-marketing-assets.py",
        "session": {"startsAt": SESSION_STARTS_AT, "timeZone": STUDIO_TIME_ZONE},
        "assets": assets,
        "manualVisualInspection": {
            "status": "required",
            "scope": "Review all locales for pixel-level privacy and session consistency after capture.",
        },
    }
    MANIFEST_FILE.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")


async def capture_assets() -> None:
    from playwright.async_api import async_playwright

    port = free_loopback_port()
    base_url = f"http://{HOST}:{port}"
    command = [
        "bun",
        "x",
        "--bun",
        "vite",
        "--config",
        str(FIXTURE_CONFIG),
        "--host",
        HOST,
        "--port",
        str(port),
        "--strictPort",
        "--mode",
        "development",
    ]
    process = subprocess.Popen(command, cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    try:
        wait_for_loopback_server(process, port)
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(headless=True)
            try:
                phone_context = await browser.new_context(
                    viewport={"width": 390, "height": 844},
                    device_scale_factor=1,
                    timezone_id=STUDIO_TIME_ZONE,
                )
                await phone_context.add_init_script("window.MARKETING_CAPTURE_FIXTURE = '1';")

                async def block_external(route):
                    if local_only(route.request.url, base_url):
                        await route.continue_()
                    else:
                        await route.abort()

                await phone_context.route("**/*", block_external)
                page = await phone_context.new_page()
                for lang in LANGUAGES:
                    target = ROOT / "public/images/app-marketing" / lang
                    target.mkdir(parents=True, exist_ok=True)
                    for screen in PHONE_SCREENS:
                        query = urlencode({"lang": lang, "screen": screen})
                        await page.goto(f"{base_url}/?{query}", wait_until="networkidle")
                        await page.wait_for_selector(f'[data-capture-kind="{screen}"]')
                        await page.screenshot(path=target / f"{screen}.png", clip={"x": 0, "y": 0, "width": 390, "height": 844})

                social_context = await browser.new_context(
                    viewport={"width": 1200, "height": 630},
                    device_scale_factor=1,
                    timezone_id=STUDIO_TIME_ZONE,
                )
                await social_context.add_init_script("window.MARKETING_CAPTURE_FIXTURE = '1';")
                await social_context.route("**/*", block_external)
                social_page = await social_context.new_page()
                social_target = ROOT / "public/images/app-marketing/social"
                social_target.mkdir(parents=True, exist_ok=True)
                for lang in LANGUAGES:
                    query = urlencode({"lang": lang, "screen": "social"})
                    await social_page.goto(f"{base_url}/?{query}", wait_until="networkidle")
                    await social_page.wait_for_selector('[data-capture-kind="social"]')
                    await social_page.screenshot(path=social_target / f"{lang}.png", clip={"x": 0, "y": 0, "width": 1200, "height": 630})
                write_manifest()
                await social_context.close()
                await phone_context.close()
            finally:
                await browser.close()
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()


def main() -> int:
    try:
        reject_production()
        asyncio.run(capture_assets())
    except Exception as error:
        print(f"app-marketing capture failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
