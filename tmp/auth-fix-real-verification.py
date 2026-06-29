import asyncio, json, os, re, ssl, urllib.parse, urllib.request
from datetime import datetime, timezone
from playwright.async_api import async_playwright, expect

BASE = 'http://127.0.0.1:8080'
SUPA_URL = os.environ['SUPABASE_URL'].strip('"')
ANON = os.environ['SUPABASE_PUBLISHABLE_KEY'].strip('"')
STORAGE_KEY = os.environ.get('LOVABLE_BROWSER_SUPABASE_STORAGE_KEY', 'sb-banjmspemvzrqckajvwo-auth-token')
PWD = 'E2ePass!23'
STAMP = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
TAG = f'QA_PRE_RELEASE_AUTH_FIX_{STAMP}'
QA_EMAIL = f'qa.authfix+{STAMP.lower()}@example.com'
QA_NAME = f'{TAG}_Member'
QA_PASSWORD = f'AuthFix{STAMP}!Aa1'
console_events = []
results = {'tag': TAG, 'qaEmail': QA_EMAIL, 'qaName': QA_NAME, 'steps': {}, 'localization': [], 'security': []}

def sign_in(email, password=PWD):
    body = json.dumps({'email': email, 'password': password}).encode()
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

async def attach_console(page, flow):
    page.on('console', lambda msg: console_events.append({'flow': flow, 'type': msg.type, 'text': msg.text}) if msg.type in ['error', 'warning'] else None)
    page.on('pageerror', lambda exc: console_events.append({'flow': flow, 'type': 'pageerror', 'text': str(exc)}))

async def fill_login(page, email, password):
    await page.locator('input[type="email"]').fill(email)
    await page.locator('input[type="password"]').fill(password)

async def click_lang(page, label):
    await page.get_by_role('button', name=label).click()
    await page.wait_for_timeout(250)

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)

        # Real signup in Hebrew
        ctx = await browser.new_context(viewport={'width': 390, 'height': 844}, locale='he-IL')
        page = await ctx.new_page()
        await attach_console(page, 'real signup')
        await page.add_init_script("localStorage.setItem('cc_lang', 'he')")
        await page.goto(BASE + '/auth', wait_until='networkidle')
        await expect(page.get_by_role('heading', name='כניסה לסטודיו')).to_be_visible()
        await page.get_by_role('button', name=re.compile('יצירת חשבון')).click()
        await expect(page.get_by_role('heading', name='שמירת מקום')).to_be_visible()
        await page.locator('input[autocomplete="name"]').fill(QA_NAME)
        await page.locator('input[type="email"]').fill(QA_EMAIL)
        await page.locator('input[type="password"]').fill(QA_PASSWORD)
        await page.get_by_role('button', name='שמירת מקום').click()
        await page.wait_for_timeout(5000)
        login_heading_visible = await page.get_by_role('heading', name='כניסה לסטודיו').is_visible()
        signup_heading_visible = await page.get_by_role('heading', name='שמירת מקום').is_visible()
        signup_alert = ''
        if await page.get_by_role('alert').count():
            signup_alert = await page.get_by_role('alert').inner_text()
        success_visible = await page.get_by_role('status').filter(has_text='ההרשמה הושלמה. אפשר להיכנס עכשיו.').is_visible()
        email_cleared = (await page.locator('input[type="email"]').input_value()) == ''
        password_cleared = (await page.locator('input[type="password"]').input_value()) == ''
        name_absent = await page.locator('input[autocomplete="name"]').count() == 0
        local_session = await page.evaluate(f"localStorage.getItem('{STORAGE_KEY}')")
        cookie_token = await page.context.cookies(BASE)
        has_auth_cookie = any(c.get('name') == 'cc_sb_access_token' for c in cookie_token)
        body = await page.locator('body').inner_text()
        protected_shell = any(s in body for s in ['התרגול שלך', 'ניהול סטודיו', 'מצב הסטודיו'])
        results['steps']['realSignup'] = {
            'successShown': success_visible,
            'returnedToLogin': '/auth' in page.url and login_heading_visible,
            'emailCleared': email_cleared,
            'passwordCleared': password_cleared,
            'nameFieldRemoved': name_absent,
            'localSessionCleared': local_session is None,
            'authCookieCleared': not has_auth_cookie,
            'protectedShellAbsent': not protected_shell,
            'url': page.url, 'signupHeadingStillVisible': signup_heading_visible, 'signupAlert': signup_alert, 'bodySample': (await page.locator('body').inner_text())[:800],
        }

        # Login after signup
        await fill_login(page, QA_EMAIL, QA_PASSWORD)
        await page.get_by_role('button', name='כניסה לסטודיו').click()
        await page.wait_for_timeout(3500)
        login_path = urllib.parse.urlparse(page.url).path
        login_alert = ''
        if await page.get_by_role('alert').count():
            login_alert = await page.get_by_role('alert').inner_text()
        login_result = 'member_redirect' if login_path.startswith('/member') else ('email_confirmation_or_login_blocked' if login_alert else 'unknown')
        results['steps']['loginAfterSignup'] = {'result': login_result, 'path': login_path, 'alert': login_alert}
        if login_path.startswith('/member'):
            # End browser session without deleting DB records.
            await page.evaluate(f"localStorage.removeItem('{STORAGE_KEY}'); document.cookie='cc_sb_access_token=; Path=/; Max-Age=0; SameSite=Lax'")
        await ctx.close()

        # Invalid credentials localization in HE/AR/EN.
        lang_specs = [
            ('he', 'עברית', 'האימייל או הסיסמה לא נכונים. נסו שוב.', 'rtl'),
            ('ar', 'العربية', 'البريد الإلكتروني أو كلمة المرور غير صحيحين. حاول مرة أخرى.', 'rtl'),
            ('en', 'English', "Those credentials didn't match. Please try again.", 'ltr'),
        ]
        for code, label, expected, direction in lang_specs:
            ctx = await browser.new_context(viewport={'width': 390, 'height': 844})
            page = await ctx.new_page()
            await attach_console(page, f'invalid credentials {code}')
            await page.add_init_script(f"localStorage.setItem('cc_lang', '{code}')")
            await page.goto(BASE + '/auth', wait_until='networkidle')
            await click_lang(page, label)
            await fill_login(page, f'bad-{STAMP.lower()}@example.com', 'wrong-password')
            submit_name = {'he': 'כניסה לסטודיו', 'ar': 'دخول الاستوديو', 'en': 'Enter the studio'}[code]
            await page.get_by_role('button', name=submit_name).click()
            await expect(page.get_by_role('alert')).to_contain_text(expected, timeout=10000)
            text = await page.get_by_role('alert').inner_text()
            alert_dir = await page.get_by_role('alert').get_attribute('dir')
            raw_english = code in ['he', 'ar'] and ('Invalid login credentials' in text or "Those credentials" in text)
            leading_punctuation = text.strip().startswith(('.', '!', '?'))
            results['localization'].append({
                'language': code,
                'text': text,
                'localized': expected in text and not raw_english,
                'directionCorrect': alert_dir == direction and not leading_punctuation,
                'dir': alert_dir,
                'result': 'PASS' if expected in text and not raw_english and alert_dir == direction and not leading_punctuation else 'FAIL',
            })
            await ctx.close()

        # Route/security smoke.
        async def smoke(name, role, route, expected_prefix):
            state = None
            if role:
                email = {'admin':'e2e_admin@test.local', 'member':'e2e_member@test.local'}[role]
                state = storage(sign_in(email))
            ctx = await browser.new_context(viewport={'width': 390, 'height': 844}, storage_state=state)
            page = await ctx.new_page()
            await attach_console(page, name)
            await page.goto(BASE + route, wait_until='networkidle', timeout=15000)
            await page.wait_for_timeout(800)
            path = urllib.parse.urlparse(page.url).path
            results['security'].append({
                'test': name,
                'expected': expected_prefix,
                'actual': path,
                'result': 'PASS' if path.startswith(expected_prefix) else 'FAIL',
            })
            await ctx.close()

        await smoke('guest /admin redirects to /auth', None, '/admin', '/auth')
        await smoke('member /admin redirects to /member', 'member', '/admin', '/member')
        await smoke('existing admin /admin works', 'admin', '/admin', '/admin')

        await browser.close()

    hydration = [e for e in console_events if 'hydration' in e['text'].lower() or 'did not match' in e['text'].lower()]
    get_user = [e for e in console_events if 'getuser' in e['text'].lower() or 'failed to fetch' in e['text'].lower()]
    results['console'] = {
        'events': console_events,
        'hydrationErrors': len(hydration),
        'getUserFailedFetchErrors': len(get_user),
        'otherConsoleErrors': len(console_events) - len(hydration) - len(get_user),
    }
    os.makedirs('tmp', exist_ok=True)
    with open('tmp/auth-fix-real-browser-result.json', 'w') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(json.dumps(results, indent=2, ensure_ascii=False))

asyncio.run(main())
