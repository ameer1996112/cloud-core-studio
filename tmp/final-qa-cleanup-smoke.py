
import asyncio, json, os, ssl, urllib.request, urllib.parse
from playwright.async_api import async_playwright

BASE = 'http://127.0.0.1:8080'
SUPA_URL = os.environ['SUPABASE_URL'].strip('"')
ANON = os.environ['SUPABASE_PUBLISHABLE_KEY'].strip('"')
STORAGE_KEY = os.environ.get('LOVABLE_BROWSER_SUPABASE_STORAGE_KEY', 'sb-banjmspemvzrqckajvwo-auth-token')
PWD = 'E2ePass!23'
results = []
console_events = []

def sign_in(email):
    body = json.dumps({'email': email, 'password': PWD}).encode()
    req = urllib.request.Request(
        f'{SUPA_URL}/auth/v1/token?grant_type=password',
        data=body,
        headers={'apikey': ANON, 'Content-Type': 'application/json', 'Authorization': f'Bearer {ANON}'},
        method='POST',
    )
    try:
        import certifi
        context = ssl.create_default_context(cafile=certifi.where())
    except Exception:
        context = ssl.create_default_context()
    with urllib.request.urlopen(req, context=context) as r:
        return json.loads(r.read())

def storage(session):
    return {
        'cookies': [{'name': 'cc_sb_access_token', 'value': session['access_token'], 'url': BASE, 'sameSite': 'Lax'}],
        'origins': [{'origin': BASE, 'localStorage': [{'name': STORAGE_KEY, 'value': json.dumps(session)}]}],
    }

async def check_page(browser, name, path, expected_prefix=None, role=None):
    state = None
    if role == 'admin':
        state = storage(sign_in('e2e_admin@test.local'))
    elif role == 'member':
        state = storage(sign_in('e2e_member@test.local'))
    ctx = await browser.new_context(viewport={'width': 390, 'height': 844}, storage_state=state)
    page = await ctx.new_page()
    page.on('console', lambda msg: console_events.append({'flow': name, 'type': msg.type, 'text': msg.text}) if msg.type in ['error'] else None)
    page.on('pageerror', lambda exc: console_events.append({'flow': name, 'type': 'pageerror', 'text': str(exc)}))
    try:
        await page.goto(BASE + path, wait_until='networkidle', timeout=15000)
        await page.wait_for_timeout(700)
        final_path = urllib.parse.urlparse(page.url).path
        text = (await page.locator('body').inner_text(timeout=5000))[:500]
        ok = bool(text.strip()) and (expected_prefix is None or final_path.startswith(expected_prefix))
        results.append({'flow': name, 'route': path, 'finalPath': final_path, 'expectedPrefix': expected_prefix, 'result': 'PASS' if ok else 'FAIL', 'textSample': text})
    except Exception as e:
        results.append({'flow': name, 'route': path, 'result': 'FAIL', 'error': str(e)})
    finally:
        await ctx.close()

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        try:
            await check_page(browser, '/auth loads', '/auth', '/auth')
            await check_page(browser, 'admin login /admin works', '/admin', '/admin', 'admin')
            await check_page(browser, 'member login /member works', '/member', '/member', 'member')
        finally:
            await browser.close()
    out = {'summary': {'passed': sum(1 for r in results if r['result']=='PASS'), 'failed': sum(1 for r in results if r['result']=='FAIL'), 'consoleErrors': len(console_events)}, 'results': results, 'consoleEvents': console_events}
    os.makedirs('tmp', exist_ok=True)
    with open('tmp/final-qa-cleanup-smoke.json', 'w') as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
    print(json.dumps(out, indent=2, ensure_ascii=False))
    if out['summary']['failed'] or out['summary']['consoleErrors']:
        raise SystemExit(1)

asyncio.run(main())
