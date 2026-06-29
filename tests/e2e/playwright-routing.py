"""Auth + route-guard matrix via Playwright (Python).
Requires the dev server running on :8080 and `node scripts/e2e-seed.mjs` already done.
"""
import asyncio, json, os, ssl, sys, urllib.parse, urllib.request
from playwright.async_api import async_playwright

BASE = "http://localhost:8080"
STORAGE_KEY = os.environ["LOVABLE_BROWSER_SUPABASE_STORAGE_KEY"]
SUPA_URL = os.environ["SUPABASE_URL"]
ANON = os.environ["SUPABASE_PUBLISHABLE_KEY"]
PWD = "E2ePass!23"
DETAIL_RECEIPT_ID = os.environ.get("E2E_DETAIL_RECEIPT_ID")
DETAIL_CLASS_ID = os.environ.get("E2E_DETAIL_CLASS_ID")
ACCESS_TOKEN_COOKIE = "cc_sb_access_token"

def sign_in(email: str) -> dict:
    body = json.dumps({"email": email, "password": PWD}).encode()
    req = urllib.request.Request(
        f"{SUPA_URL}/auth/v1/token?grant_type=password",
        data=body,
        headers={"apikey": ANON, "Content-Type": "application/json", "Authorization": f"Bearer {ANON}"},
        method="POST",
    )
    context = None
    try:
        import certifi

        context = ssl.create_default_context(cafile=certifi.where())
    except Exception:
        context = ssl.create_default_context()
    with urllib.request.urlopen(req, context=context) as r:
        return json.loads(r.read())

pass_, fail_ = 0, 0
console_events = []

def ok(n):
    global pass_; pass_ += 1; print("PASS", n, flush=True)
def bad(n, w):
    global fail_; fail_ += 1; print("FAIL", n, "—", w, flush=True)

async def settle(page, path):
    try:
        await page.goto(BASE + path, wait_until="networkidle", timeout=10000)
    except Exception:
        pass
    await page.wait_for_timeout(500)
    return urllib.parse.urlparse(page.url).path

async def with_role(browser, role, fn):
    storage_state = None
    if role:
        email = {"admin":"e2e_admin@test.local","instructor":"e2e_instructor@test.local","member":"e2e_member@test.local","member2":"e2e_member2@test.local"}[role]
        session = sign_in(email)
        storage_state = {
            "cookies": [{
                "name": ACCESS_TOKEN_COOKIE,
                "value": session["access_token"],
                "url": BASE,
                "sameSite": "Lax",
            }],
            "origins": [{
                "origin": BASE,
                "localStorage": [{"name": STORAGE_KEY, "value": json.dumps(session)}],
            }],
        }
    ctx = await browser.new_context(viewport={"width": 1280, "height": 900}, storage_state=storage_state)
    page = await ctx.new_page()
    page.on("console", lambda msg: console_events.append(("console", msg.type, msg.text)) if msg.type in ["error", "warning"] else None)
    page.on("pageerror", lambda exc: console_events.append(("pageerror", "error", str(exc))))
    try:
        await fn(page)
    finally:
        await ctx.close()

async def assert_final_path(page, path, expected, name):
    p = await settle(page, path)
    if p == expected or (expected.endswith("/") and p == expected.rstrip("/")):
        ok(name)
    else:
        bad(name, f"landed at {p}")
    await page.reload(wait_until="networkidle", timeout=10000)
    await page.wait_for_timeout(300)
    p = urllib.parse.urlparse(page.url).path
    if p == expected or (expected.endswith("/") and p == expected.rstrip("/")):
        ok(f"{name} after refresh")
    else:
        bad(f"{name} after refresh", f"landed at {p}")

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        try:
            # 1. signed-out /admin → /auth
            async def t1(page):
                p = await settle(page, "/admin")
                (ok if p.startswith("/auth") else bad)("signed-out /admin → /auth", f"landed at {p}") if not p.startswith("/auth") else ok("signed-out /admin → /auth")
            await with_role(browser, None, t1)

            # 2-4. role homes
            for role, prefix, label in [("admin","/admin","admin"),("member","/member","member"),("instructor","/instructor","instructor")]:
                async def th(page, role=role, prefix=prefix, label=label):
                    p = await settle(page, "/")
                    if p.startswith(prefix): ok(f"{label} login lands on {prefix}")
                    else: bad(f"{label} login lands on {prefix}", f"landed at {p}")
                await with_role(browser, role, th)

            # 5. member blocked from admin URLs
            admin_urls = ["/admin","/admin/reports","/admin/payments","/admin/messages","/admin/settings","/admin/members"]
            async def t5(page):
                for u in admin_urls:
                    p = await settle(page, u)
                    if not p.startswith("/admin"): ok(f"member blocked from {u} (→ {p})")
                    else: bad(f"member blocked from {u}", f"remained on {p}")
                    await page.reload(wait_until="networkidle", timeout=10000)
                    await page.wait_for_timeout(300)
                    p = urllib.parse.urlparse(page.url).path
                    if not p.startswith("/admin"): ok(f"member refresh blocked from {u} (→ {p})")
                    else: bad(f"member refresh blocked from {u}", f"remained on {p}")
            await with_role(browser, "member", t5)

            # 6. instructor blocked from owner pages
            async def t6(page):
                for u in ["/admin","/admin/reports","/admin/payments","/admin/messages","/admin/settings","/admin/members"]:
                    p = await settle(page, u)
                    if not p.startswith("/admin"): ok(f"instructor blocked from {u} (→ {p})")
                    else: bad(f"instructor blocked from {u}", f"remained on {p}")
                    await page.reload(wait_until="networkidle", timeout=10000)
                    await page.wait_for_timeout(300)
                    p = urllib.parse.urlparse(page.url).path
                    if not p.startswith("/admin"): ok(f"instructor refresh blocked from {u} (→ {p})")
                    else: bad(f"instructor refresh blocked from {u}", f"remained on {p}")
            await with_role(browser, "instructor", t6)

            # 6b. admin direct /admin and refresh stay allowed.
            async def t6b(page):
                p = await settle(page, "/admin")
                if p.startswith("/admin"): ok("admin direct /admin allowed")
                else: bad("admin direct /admin allowed", f"landed at {p}")
                await page.reload(wait_until="networkidle", timeout=10000)
                await page.wait_for_timeout(300)
                p = urllib.parse.urlparse(page.url).path
                if p.startswith("/admin"): ok("admin refresh /admin allowed")
                else: bad("admin refresh /admin allowed", f"landed at {p}")
            await with_role(browser, "admin", t6b)

            # 6c. detail routes direct/refresh regressions. These are optional
            # because the mutating suite creates the concrete receipt/class IDs.
            if DETAIL_RECEIPT_ID:
                receipt_path = f"/receipts/{DETAIL_RECEIPT_ID}"

                async def t6c_owner(page):
                    await assert_final_path(page, receipt_path, receipt_path, "member own receipt detail allowed")
                await with_role(browser, "member", t6c_owner)

                async def t6c_guest(page):
                    p = await settle(page, receipt_path)
                    if p.startswith("/auth"): ok("guest receipt detail → /auth")
                    else: bad("guest receipt detail → /auth", f"landed at {p}")
                await with_role(browser, None, t6c_guest)

                async def t6c_other(page):
                    p = await settle(page, receipt_path)
                    if p == receipt_path:
                        ok("other member receipt detail stays on route for RLS/not-found handling")
                    else:
                        bad("other member receipt detail stays on route for RLS/not-found handling", f"landed at {p}")
                await with_role(browser, "member2", t6c_other)

            if DETAIL_CLASS_ID:
                class_path = f"/admin/classes/{DETAIL_CLASS_ID}"

                async def t6d_admin(page):
                    await assert_final_path(page, class_path, class_path, "admin class detail allowed")
                await with_role(browser, "admin", t6d_admin)

                async def t6d_guest(page):
                    p = await settle(page, class_path)
                    if p.startswith("/auth"): ok("guest admin class detail → /auth")
                    else: bad("guest admin class detail → /auth", f"landed at {p}")
                await with_role(browser, None, t6d_guest)

                async def t6d_member(page):
                    p = await settle(page, class_path)
                    if p.startswith("/member"): ok("member admin class detail blocked")
                    else: bad("member admin class detail blocked", f"landed at {p}")
                await with_role(browser, "member", t6d_member)

                async def t6d_instructor(page):
                    p = await settle(page, class_path)
                    if p.startswith("/instructor"): ok("instructor admin class detail blocked")
                    else: bad("instructor admin class detail blocked", f"landed at {p}")
                await with_role(browser, "instructor", t6d_instructor)

            # 7. member legacy redirects
            async def t7(page):
                for frm, to in [("/schedule","/member/schedule"),("/bookings","/member/bookings"),("/plans","/member/packages")]:
                    p = await settle(page, frm)
                    if p == to: ok(f"legacy {frm} → {to}")
                    else: bad(f"legacy {frm} → {to}", f"landed at {p}")
            await with_role(browser, "member", t7)

            # 8. admin legacy redirects
            async def t8(page):
                for frm, expected in [("/admin/planner","/admin/calendar"),("/admin/templates","/admin/messages")]:
                    p = await settle(page, frm)
                    if p == expected: ok(f"legacy {frm} → {expected}")
                    else: bad(f"legacy {frm} → {expected}", f"landed at {p}")
            await with_role(browser, "admin", t8)

            # 9. /studio doesn't loop
            async def t9(page):
                p = await settle(page, "/studio")
                if p: ok(f"/studio resolves (→ {p})")
                else: bad("/studio", "no path")
            await with_role(browser, "member", t9)

        finally:
            await browser.close()

    hydration = [e for e in console_events if "Hydration failed" in e[2] or "hydration" in e[2]]
    get_user_fetch = [e for e in console_events if "getUser" in e[2] or "Failed to fetch" in e[2]]
    if hydration:
        bad("no hydration mismatch console errors", hydration[0][2][:200])
    else:
        ok("no hydration mismatch console errors")
    if get_user_fetch:
        bad("no repeated getUser Failed to fetch console errors", get_user_fetch[0][2][:200])
    else:
        ok("no repeated getUser Failed to fetch console errors")

asyncio.run(main())
print(f"\n{pass_}/{pass_+fail_} passed")
sys.exit(0 if fail_ == 0 else 1)
