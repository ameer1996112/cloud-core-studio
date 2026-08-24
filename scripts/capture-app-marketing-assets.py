#!/usr/bin/env python3
"""Generate app-marketing captures from an isolated local fixture only."""

import argparse
import asyncio
import hashlib
import importlib.metadata
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from urllib.parse import urlencode, urlparse

ROOT = Path(__file__).resolve().parents[1]
FIXTURE_CONFIG = ROOT / "tests/fixtures/app-marketing/vite.config.ts"
MANIFEST_FILE = ROOT / "tests/fixtures/app-marketing/asset-manifest.json"
MANUAL_REVIEW_FILE = ROOT / "tests/fixtures/app-marketing/manual-review.json"
REQUIREMENTS_FILE = ROOT / "tests/fixtures/app-marketing/requirements.txt"
HOST = "127.0.0.1"
LANGUAGES = ("ar", "he", "en")
PHONE_SCREENS = ("schedule", "booking", "bookings", "membership", "account")
SESSION_STARTS_AT = "2031-09-10T17:30:00.000Z"
STUDIO_TIME_ZONE = "Asia/Jerusalem"
PLAYWRIGHT_VERSION = "1.58.0"
STABILITY_ATTEMPTS = 2
CAPTURE_STABILITY_CSS = """
*, *::before, *::after {
  animation: none !important;
  caret-color: transparent !important;
  scroll-behavior: auto !important;
  transition: none !important;
}
.capture-phone[data-capture-kind="schedule"] .animate-fade-in {
  animation: none !important;
  opacity: 1 !important;
  transform: none !important;
  will-change: auto !important;
}
"""


def reject_production() -> None:
    if os.environ.get("NODE_ENV") == "production":
        raise RuntimeError("Refusing to capture assets with NODE_ENV=production.")


def preflight_toolchain() -> dict[str, str]:
    try:
        installed_version = importlib.metadata.version("playwright")
    except importlib.metadata.PackageNotFoundError as error:
        raise RuntimeError(
            "Python Playwright is not installed. Run `python3 -m pip install -r "
            "tests/fixtures/app-marketing/requirements.txt` and then "
            "`python3 -m playwright install chromium`."
        ) from error
    if installed_version != PLAYWRIGHT_VERSION:
        raise RuntimeError(
            f"Python Playwright {PLAYWRIGHT_VERSION} is required; found {installed_version}. "
            "Use tests/fixtures/app-marketing/requirements.txt."
        )
    if not REQUIREMENTS_FILE.exists() or f"playwright=={PLAYWRIGHT_VERSION}" not in REQUIREMENTS_FILE.read_text():
        raise RuntimeError(f"Missing pinned Playwright requirement: {REQUIREMENTS_FILE}")

    from playwright.sync_api import sync_playwright

    with sync_playwright() as playwright:
        executable = Path(playwright.chromium.executable_path)
    if not executable.exists():
        raise RuntimeError(
            f"Chromium is not installed at {executable}. Run `python3 -m playwright install chromium`."
        )
    return {"playwrightVersion": installed_version, "chromiumExecutable": str(executable)}


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


def stop_process(process: subprocess.Popen[bytes]) -> None:
    if process.poll() is not None:
        return
    process.terminate()
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=5)


def local_only(url: str, base_url: str) -> bool:
    return url.startswith(base_url + "/") or url == base_url


def stable_url_path(url: str, base_url: str) -> str:
    if not local_only(url, base_url):
        return url
    return urlparse(url).path or "/"


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


def validate_observation(screen: str, observation: dict[str, object]) -> None:
    state = observation["state"]
    if not isinstance(state, dict):
        raise RuntimeError(f"{screen} is missing its machine-readable capture state.")
    if screen == "schedule" and (
        state.get("availableClassCount") != 3
        or state.get("bookingAction") is not True
        or state.get("openSpots") != [5, 3, 6]
    ):
        raise RuntimeError(f"schedule did not render three available booking actions: {state}")
    if screen == "booking" and (state.get("bookingAction") is not True or state.get("openSpots") != 5):
        raise RuntimeError(f"booking did not render its open booking action: {state}")
    if screen == "bookings" and state.get("confirmed") is not True:
        raise RuntimeError(f"bookings did not render a confirmed booking: {state}")
    if screen == "membership" and (
        state.get("active") is not True
        or not isinstance(state.get("credits"), int)
        or state["credits"] <= 0
    ):
        raise RuntimeError(f"membership did not render active nonzero credits: {state}")
    if screen == "account" and state.get("completeFictionalProfile") is not True:
        raise RuntimeError(f"account did not render its complete fictional profile: {state}")
    if screen == "social":
        resources = observation.get("resourceUrls", [])
        if (
            "/brand/cloud-core-logo-full.svg" not in resources
            or "/images/auth/cloud-core-auth-hero.webp" not in resources
        ):
            raise RuntimeError(f"social card did not load the authentic logo and studio image: {resources}")


async def settle_page(page, selector: str) -> None:
    await page.wait_for_selector(selector)
    await page.add_style_tag(content=CAPTURE_STABILITY_CSS)
    samples = await page.evaluate(
        """
        async (targetSelector) => {
          window.scrollTo(0, 0);
          document.documentElement.scrollTop = 0;
          document.body.scrollTop = 0;
          await document.fonts.ready;
          await Promise.all([...document.images].map(async (image) => {
            if (!image.complete) await new Promise((resolve) => {
              image.addEventListener('load', resolve, { once: true });
              image.addEventListener('error', resolve, { once: true });
            });
            try { await image.decode(); } catch { /* a loaded SVG need not decode */ }
          }));
          const root = document.querySelector(targetSelector);
          const frames = [];
          for (let index = 0; index < 4; index += 1) {
            await new Promise(requestAnimationFrame);
            const rect = root.getBoundingClientRect();
            frames.push([rect.x, rect.y, rect.width, rect.height, document.documentElement.scrollHeight]);
          }
          return frames;
        }
        """,
        selector,
    )
    if len({json.dumps(sample) for sample in samples}) != 1:
        raise RuntimeError(f"Capture layout did not settle for {selector}: {samples}")


async def observe_page(page, selector: str, base_url: str) -> dict[str, object]:
    payload = await page.evaluate(
        """
        (targetSelector) => {
          const root = document.querySelector(targetSelector);
          const state = JSON.parse(root.dataset.captureState || "{}");
          const resources = [
            ...performance.getEntriesByType("resource").map((entry) => entry.name),
            ...[...document.images].map((image) => image.currentSrc || image.src),
          ];
          return { state, resources: [...new Set(resources)] };
        }
        """,
        selector,
    )
    return {
        "state": payload["state"],
        "resourceUrls": sorted({stable_url_path(url, base_url) for url in payload["resources"]}),
    }


async def run_network_probe(page, network_events: dict[str, list[str]]) -> dict[str, str]:
    probe = await page.evaluate(
        """
        async () => {
          const http = await fetch("https://example.invalid/capture-boundary", { mode: "no-cors" })
            .then(() => "resolved")
            .catch(() => "rejected");
          const webSocket = await new Promise((resolve) => {
            const socket = new WebSocket("wss://example.invalid/capture-boundary");
            socket.addEventListener("open", () => resolve("opened"), { once: true });
            socket.addEventListener("error", () => resolve("errored"), { once: true });
            socket.addEventListener("close", () => resolve("closed"), { once: true });
            setTimeout(() => resolve("timed-out"), 2_000);
          });
          return { http, webSocket };
        }
        """
    )
    if probe["http"] != "rejected" or probe["webSocket"] in {"opened", "timed-out"}:
        raise RuntimeError(f"Network boundary probe was not blocked: {probe}")
    if "https://example.invalid/capture-boundary" not in network_events["abortedHttp"]:
        raise RuntimeError("Network boundary did not intercept the deliberate external HTTP probe.")
    if "wss://example.invalid/capture-boundary" not in network_events["blockedWebSockets"]:
        raise RuntimeError("Network boundary did not intercept the deliberate external WebSocket probe.")
    return probe


async def screenshot_loaded_target(page, selector: str, output: Path, base_url: str) -> dict[str, object]:
    await settle_page(page, selector)
    observation = await observe_page(page, selector, base_url)
    screen = selector.removeprefix('[data-capture-kind="').removesuffix('"]')
    validate_observation(screen, observation)
    width, height = (1200, 630) if screen == "social" else (390, 844)
    await page.screenshot(
        path=output,
        animations="disabled",
        caret="hide",
        scale="css",
        clip={"x": 0, "y": 0, "width": width, "height": height},
    )
    return observation


async def screenshot_target(page, url: str, selector: str, output: Path, base_url: str) -> dict[str, object]:
    await page.goto(url, wait_until="domcontentloaded")
    return await screenshot_loaded_target(page, selector, output, base_url)


def output_file(tmp: Path, lang: str, screen: str, attempt: int) -> Path:
    directory = tmp / f"attempt-{attempt}" / ("social" if screen == "social" else lang)
    directory.mkdir(parents=True, exist_ok=True)
    return directory / (f"{lang}.png" if screen == "social" else f"{screen}.png")


def destination_file(lang: str, screen: str) -> Path:
    directory = ROOT / "public/images/app-marketing" / ("social" if screen == "social" else lang)
    return directory / (f"{lang}.png" if screen == "social" else f"{screen}.png")


def preserve_unstable_pair(first: Path, second: Path, label: str) -> None:
    debug_directory = os.environ.get("APP_MARKETING_CAPTURE_DEBUG_DIR")
    if not debug_directory:
        return
    destination = Path(debug_directory)
    destination.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(first, destination / f"{label}-first.png")
    shutil.copyfile(second, destination / f"{label}-second.png")


def preserve_verified_output(source: Path, lang: str, screen: str) -> None:
    debug_directory = os.environ.get("APP_MARKETING_CAPTURE_DEBUG_DIR")
    if not debug_directory:
        return
    destination = Path(debug_directory) / ("social" if screen == "social" else lang)
    destination.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, destination / (f"{lang}.png" if screen == "social" else f"{screen}.png"))


def write_manifest(observations: dict[tuple[str, str], dict[str, object]]) -> None:
    assets: dict[str, dict[str, dict[str, object]]] = {}
    for lang in LANGUAGES:
        language_assets: dict[str, dict[str, object]] = {}
        for screen in (*PHONE_SCREENS, "social"):
            metadata = png_metadata(destination_file(lang, screen))
            metadata["observed"] = observations[(lang, screen)]
            if screen == "social":
                metadata["provenance"] = {
                    "officialLogo": "/brand/cloud-core-logo-full.svg",
                    "studioImage": "/images/auth/cloud-core-auth-hero.webp",
                    "people": False,
                }
            language_assets[screen] = metadata
        assets[lang] = language_assets
    manifest = {
        "version": 2,
        "generatedBy": "scripts/capture-app-marketing-assets.py",
        "session": {"startsAt": SESSION_STARTS_AT, "timeZone": STUDIO_TIME_ZONE},
        "captureEnvironment": {
            "viewport": {"phone": [390, 844], "social": [1200, 630]},
            "deviceScaleFactor": 1,
            "locale": "en-GB",
            "colorScheme": "light",
            "reducedMotion": "reduce",
            "serviceWorkers": "block",
        },
        "assets": assets,
        "manualReview": {
            "status": "required",
            "attestation": "tests/fixtures/app-marketing/manual-review.json",
        },
    }
    MANIFEST_FILE.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")


def approve_manual_review(reviewer: str, reviewed_at: str) -> None:
    if not MANIFEST_FILE.exists():
        raise RuntimeError("Capture assets first; no generated manifest is available to attest.")
    manifest = json.loads(MANIFEST_FILE.read_text())
    review_assets: dict[str, dict[str, object]] = {}
    for lang, assets in manifest["assets"].items():
        review_assets[lang] = {
            screen: {"sha256": asset["sha256"], "state": asset["observed"]["state"]}
            for screen, asset in assets.items()
        }
    review = {
        "version": 1,
        "status": "approved",
        "reviewer": reviewer,
        "reviewedAt": reviewed_at,
        "scope": "All 15 localized phone captures and 3 localized social cards inspected after the recorded capture.",
        "result": "No real identity, contact data, payment data, or contradictory session time is visible.",
        "assets": review_assets,
    }
    MANUAL_REVIEW_FILE.write_text(json.dumps(review, ensure_ascii=False, indent=2) + "\n")


async def capture_assets(*, write_assets: bool, verify_state_regression: bool = False) -> dict[str, object]:
    from playwright.async_api import async_playwright

    port = free_loopback_port()
    base_url = f"http://{HOST}:{port}"
    print(f"app-marketing fixture port: {port}")
    command = [
        "bun", "x", "--bun", "vite", "--config", str(FIXTURE_CONFIG), "--host", HOST,
        "--port", str(port), "--strictPort", "--mode", "development",
    ]
    process = subprocess.Popen(command, cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        wait_for_loopback_server(process, port)
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(
                headless=True,
                args=[
                    "--disable-gpu",
                    "--disable-lcd-text",
                    "--disable-font-subpixel-positioning",
                    "--font-render-hinting=none",
                    "--force-color-profile=srgb",
                ],
            )
            try:
                network_events = {"abortedHttp": [], "blockedWebSockets": []}

                async def block_external(route):
                    if local_only(route.request.url, base_url):
                        await route.continue_()
                    else:
                        network_events["abortedHttp"].append(route.request.url)
                        await route.abort()

                async def block_web_socket(route):
                    network_events["blockedWebSockets"].append(route.url)
                    await route.close(code=1008, reason="Capture fixture blocks WebSockets")

                context_options = {
                    "device_scale_factor": 1,
                    "locale": "en-GB",
                    "timezone_id": STUDIO_TIME_ZONE,
                    "color_scheme": "light",
                    "reduced_motion": "reduce",
                    "service_workers": "block",
                }
                phone_context = await browser.new_context(viewport={"width": 390, "height": 844}, **context_options)
                await phone_context.add_init_script("window.MARKETING_CAPTURE_FIXTURE = '1';")
                await phone_context.route("**/*", block_external)
                await phone_context.route_web_socket("**/*", block_web_socket)
                page = await phone_context.new_page()
                probe_url = f"{base_url}/?{urlencode({'lang': 'en', 'screen': 'schedule'})}"
                await page.goto(probe_url, wait_until="domcontentloaded")
                await settle_page(page, '[data-capture-kind="schedule"]')
                network_probe = await run_network_probe(page, network_events)
                if verify_state_regression:
                    regression_url = f"{base_url}/?{urlencode({'lang': 'en', 'screen': 'membership', 'fixture-state': 'invalid'})}"
                    try:
                        await screenshot_target(page, regression_url, '[data-capture-kind="membership"]', Path(os.devnull), base_url)
                    except RuntimeError as error:
                        if "active nonzero credits" not in str(error):
                            raise
                        return {"networkProbe": network_probe, "stateRegression": "blocked"}
                    raise RuntimeError("Fixture state regression unexpectedly passed capture validation.")

                social_context = await browser.new_context(viewport={"width": 1200, "height": 630}, **context_options)
                await social_context.add_init_script("window.MARKETING_CAPTURE_FIXTURE = '1';")
                await social_context.route("**/*", block_external)
                await social_context.route_web_socket("**/*", block_web_socket)
                social_page = await social_context.new_page()
                observations: dict[tuple[str, str], dict[str, object]] = {}
                with tempfile.TemporaryDirectory(prefix="app-marketing-capture-") as temporary_directory:
                    temporary = Path(temporary_directory)
                    for lang in LANGUAGES:
                        for screen in PHONE_SCREENS:
                            query = urlencode({"lang": lang, "screen": screen})
                            selector = f'[data-capture-kind="{screen}"]'
                            first = output_file(temporary, lang, screen, 1)
                            second = output_file(temporary, lang, screen, 2)
                            await page.goto(f"{base_url}/?{query}", wait_until="domcontentloaded")
                            await settle_page(page, selector)
                            first_observation = await screenshot_loaded_target(page, selector, first, base_url)
                            second_observation = await screenshot_loaded_target(page, selector, second, base_url)
                            if hashlib.sha256(first.read_bytes()).digest() != hashlib.sha256(second.read_bytes()).digest():
                                preserve_unstable_pair(first, second, f"{lang}-{screen}")
                                raise RuntimeError(f"Unstable capture bytes for {lang}/{screen} after {STABILITY_ATTEMPTS} attempts.")
                            if first_observation != second_observation:
                                raise RuntimeError(f"Unstable capture observation for {lang}/{screen}.")
                            observations[(lang, screen)] = second_observation
                        query = urlencode({"lang": lang, "screen": "social"})
                        selector = '[data-capture-kind="social"]'
                        first = output_file(temporary, lang, "social", 1)
                        second = output_file(temporary, lang, "social", 2)
                        await social_page.goto(f"{base_url}/?{query}", wait_until="domcontentloaded")
                        await settle_page(social_page, selector)
                        first_observation = await screenshot_loaded_target(social_page, selector, first, base_url)
                        second_observation = await screenshot_loaded_target(social_page, selector, second, base_url)
                        if hashlib.sha256(first.read_bytes()).digest() != hashlib.sha256(second.read_bytes()).digest():
                            preserve_unstable_pair(first, second, f"social-{lang}")
                            raise RuntimeError(f"Unstable capture bytes for social/{lang} after {STABILITY_ATTEMPTS} attempts.")
                        if first_observation != second_observation:
                            raise RuntimeError(f"Unstable capture observation for social/{lang}.")
                        observations[(lang, "social")] = second_observation
                    hashes = {
                        f"{lang}/{screen}": hashlib.sha256(output_file(temporary, lang, screen, 2).read_bytes()).hexdigest()
                        for lang in LANGUAGES
                        for screen in (*PHONE_SCREENS, "social")
                    }
                    for lang in LANGUAGES:
                        for screen in (*PHONE_SCREENS, "social"):
                            preserve_verified_output(output_file(temporary, lang, screen, 2), lang, screen)
                    if write_assets:
                        for lang in LANGUAGES:
                            for screen in (*PHONE_SCREENS, "social"):
                                target = destination_file(lang, screen)
                                target.parent.mkdir(parents=True, exist_ok=True)
                                shutil.copyfile(output_file(temporary, lang, screen, 2), target)
                        write_manifest(observations)
                await social_context.close()
                await phone_context.close()
                return {"networkProbe": network_probe, "hashes": hashes}
            finally:
                await browser.close()
    finally:
        stop_process(process)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--preflight", action="store_true", help="Verify the pinned Python Playwright and Chromium runtime.")
    parser.add_argument("--verify-network", action="store_true", help="Run external HTTP/WebSocket probes without writing assets.")
    parser.add_argument("--verify-stability", action="store_true", help="Capture every target twice into temporary files without writing assets.")
    parser.add_argument("--verify-state-regression", action="store_true", help="Prove an invalid fixture state is rejected without writing assets.")
    parser.add_argument("--approve-manual-review", action="store_true", help="Write an attestation for the current manifest hashes.")
    parser.add_argument("--reviewer", help="Required reviewer name for --approve-manual-review.")
    parser.add_argument("--reviewed-at", help="Required YYYY-MM-DD date for --approve-manual-review.")
    return parser.parse_args()


def main() -> int:
    try:
        reject_production()
        args = parse_args()
        if args.approve_manual_review:
            if not args.reviewer or not args.reviewed_at:
                raise RuntimeError("--approve-manual-review requires --reviewer and --reviewed-at YYYY-MM-DD.")
            approve_manual_review(args.reviewer, args.reviewed_at)
            print(f"manual review attested by {args.reviewer} for {args.reviewed_at}")
            return 0
        toolchain = preflight_toolchain()
        if args.preflight:
            print(json.dumps(toolchain, sort_keys=True))
            return 0
        result = asyncio.run(
            capture_assets(
                write_assets=not (args.verify_network or args.verify_stability or args.verify_state_regression),
                verify_state_regression=args.verify_state_regression,
            )
        )
        print(json.dumps(result, sort_keys=True))
    except Exception as error:
        print(f"app-marketing capture failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
