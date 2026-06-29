import asyncio, json, os, re
from datetime import datetime, timezone
from playwright.async_api import async_playwright, expect
BASE='http://127.0.0.1:8080'
STAMP=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
TAG=f'QA_PRE_RELEASE_AUTH_FIX_{STAMP}'
EMAIL=f'qa.authfix+{STAMP.lower()}@example.com'
NAME=f'{TAG}_Member'
PWD=f'AuthFix{STAMP}!Aa1'
console=[]
async def main():
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(headless=True)
  ctx=await browser.new_context(viewport={'width':390,'height':844}, locale='he-IL')
  page=await ctx.new_page()
  page.on('console', lambda msg: console.append({'type':msg.type,'text':msg.text}) if msg.type in ['error','warning'] else None)
  page.on('pageerror', lambda exc: console.append({'type':'pageerror','text':str(exc)}))
  await page.add_init_script("localStorage.setItem('cc_lang','he')")
  await page.goto(BASE+'/auth', wait_until='networkidle')
  await page.get_by_role('button', name=re.compile('יצירת חשבון')).click()
  await page.locator('input[autocomplete="name"]').fill(NAME)
  await page.locator('input[type="email"]').fill(EMAIL)
  await page.locator('input[type="password"]').fill(PWD)
  await page.get_by_role('button', name='שמירת מקום').click()
  await page.wait_for_timeout(7000)
  alerts=[]
  for i in range(await page.get_by_role('alert').count()):
   alerts.append(await page.get_by_role('alert').nth(i).inner_text())
  statuses=[]
  for i in range(await page.get_by_role('status').count()):
   statuses.append(await page.get_by_role('status').nth(i).inner_text())
  result={
   'tag':TAG,'email':EMAIL,'name':NAME,'url':page.url,
   'loginHeading':await page.get_by_role('heading', name='כניסה לסטודיו').is_visible(),
   'signupHeading':await page.get_by_role('heading', name='שמירת מקום').is_visible(),
   'alerts':alerts,'statuses':statuses,
   'emailValue': await page.locator('input[type="email"]').input_value() if await page.locator('input[type="email"]').count() else None,
   'passwordValue': await page.locator('input[type="password"]').input_value() if await page.locator('input[type="password"]').count() else None,
   'body':(await page.locator('body').inner_text())[:1500],
   'console':console,
  }
  await page.screenshot(path='tmp/auth-fix-signup-debug.png', full_page=True)
  await browser.close()
  open('tmp/auth-fix-signup-debug.json','w').write(json.dumps(result,ensure_ascii=False,indent=2))
  print(json.dumps(result,ensure_ascii=False,indent=2))
asyncio.run(main())
