#!/usr/bin/env python3
"""Generate localized, deterministic marketing captures from the local fixture only."""

import asyncio
import os
import socket
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import urlencode

from playwright.async_api import async_playwright


ROOT = Path(__file__).resolve().parents[1]
FIXTURE_CONFIG = ROOT / "tests/fixtures/app-marketing/vite.config.ts"
HOST = "127.0.0.1"
LANGUAGES = ("ar", "he", "en")
PHONE_SCREENS = ("schedule", "booking", "bookings", "membership", "account")


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


async def capture_assets() -> None:
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
