"""Auth + route-guard matrix via Playwright (Python).
Requires the dev server running on :8080 and `node scripts/e2e-seed.mjs` already done.
"""
import asyncio, json, os, sys, urllib.parse, urllib.request
from playwright.async_api import async_playwright

BASE = "http://localhost:8080"
STORAGE_KEY = os.environ["LOVABLE_BROWSER_SUPABASE_STORAGE_KEY"]
SUPA_URL = os.environ["SUPABASE_URL"]
ANON = os.environ["SUPABASE_PUBLISHABLE_KEY"]
PWD = "E2ePass!23"

def sign_in(email: str) -> dict:
    body = json.dumps({"email": email, "password": PWD}).encode()
    req = urllib.request.Request(
        f"{SUPA_URL}/auth/v1/token?grant_type=password",
        data=body,
        headers={"apikey": ANON, "Content-Type": "application/json", "Authorization": f"Bearer {ANON}"},
        method="POST",
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

pass_, fail_ = 0, 0
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
    ctx = await browser.new_context(viewport={"width": 1280, "height": 900})
    page = await ctx.new_page()
    if role:
        email = {"admin":"e2e_admin@test.local","instructor":"e2e_instructor@test.local","member":"e2e_member@test.local"}[role]
        session = sign_in(email)
        await page.goto(BASE + "/")
        await page.evaluate(
            "([k, v]) => window.localStorage.setItem(k, v)",
            [STORAGE_KEY, json.dumps(session)],
        )
    try:
        await fn(page)
    finally:
        await ctx.close()

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
            await with_role(browser, "member", t5)

            # 6. instructor blocked from owner pages
            async def t6(page):
                for u in ["/admin/reports","/admin/payments","/admin/messages","/admin/settings","/admin/members"]:
                    p = await settle(page, u)
                    if not p.startswith("/admin"): ok(f"instructor blocked from {u} (→ {p})")
                    else: bad(f"instructor blocked from {u}", f"remained on {p}")
            await with_role(browser, "instructor", t6)

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

asyncio.run(main())
print(f"\n{pass_}/{pass_+fail_} passed")
sys.exit(0 if fail_ == 0 else 1)
