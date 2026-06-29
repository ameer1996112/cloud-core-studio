import asyncio, json, os, ssl, urllib.parse, urllib.request
from datetime import datetime, timezone
from playwright.async_api import async_playwright, expect
BASE='http://127.0.0.1:8080'
SUPA_URL=os.environ['SUPABASE_URL'].strip('"')
ANON=os.environ['SUPABASE_PUBLISHABLE_KEY'].strip('"')
STORAGE_KEY=os.environ.get('LOVABLE_BROWSER_SUPABASE_STORAGE_KEY','sb-banjmspemvzrqckajvwo-auth-token')
PWD='E2ePass!23'
STAMP=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
console=[]
results={'localization':[],'security':[]}
def sign_in(email,password=PWD):
 body=json.dumps({'email':email,'password':password}).encode()
 req=urllib.request.Request(f'{SUPA_URL}/auth/v1/token?grant_type=password',data=body,headers={'apikey':ANON,'Content-Type':'application/json','Authorization':f'Bearer {ANON}'},method='POST')
 try:
  import certifi; ctx=ssl.create_default_context(cafile=certifi.where())
 except Exception:
  ctx=ssl.create_default_context()
 with urllib.request.urlopen(req,context=ctx) as r: return json.loads(r.read())
def storage(session):
 return {'cookies':[{'name':'cc_sb_access_token','value':session['access_token'],'url':BASE,'sameSite':'Lax'}],'origins':[{'origin':BASE,'localStorage':[{'name':STORAGE_KEY,'value':json.dumps(session)}]}]}
async def attach(page,flow):
 page.on('console', lambda msg: console.append({'flow':flow,'type':msg.type,'text':msg.text}) if msg.type in ['error','warning'] else None)
 page.on('pageerror', lambda exc: console.append({'flow':flow,'type':'pageerror','text':str(exc)}))
async def fill(page,email,password):
 await page.locator('input[type="email"]').fill(email)
 await page.locator('input[type="password"]').fill(password)
async def main():
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(headless=True)
  specs=[('he','עברית','האימייל או הסיסמה לא נכונים. נסו שוב.','rtl','כניסה לסטודיו'),('ar','العربية','البريد الإلكتروني أو كلمة المرور غير صحيحين. حاول مرة أخرى.','rtl','دخول الاستوديو'),('en','English',"Those credentials didn't match. Please try again.",'ltr','Enter the studio')]
  for code,label,expected,dir_,button in specs:
   ctx=await browser.new_context(viewport={'width':390,'height':844})
   page=await ctx.new_page(); await attach(page,f'invalid {code}')
   await page.add_init_script(f"localStorage.setItem('cc_lang','{code}')")
   await page.goto(BASE+'/auth',wait_until='networkidle')
   await page.get_by_role('button', name=label).click()
   await fill(page,f'invalid-authfix-{STAMP.lower()}@example.com','wrong-password')
   await page.get_by_role('button', name=button).click()
   await page.wait_for_timeout(3000)
   alert_text=''; alert_dir=None
   if await page.get_by_role('alert').count():
    alert=page.get_by_role('alert')
    alert_text=await alert.inner_text(); alert_dir=await alert.get_attribute('dir')
   raw_english=code in ['he','ar'] and ('Invalid login credentials' in alert_text or "Those credentials" in alert_text)
   leading=alert_text.strip().startswith(('.', '!', '?'))
   results['localization'].append({'language':code,'text':alert_text,'localized':expected in alert_text and not raw_english,'directionCorrect':alert_dir==dir_ and not leading,'dir':alert_dir,'result':'PASS' if expected in alert_text and not raw_english and alert_dir==dir_ and not leading else 'FAIL'})
   await ctx.close()
  async def smoke(name,role,route,expected):
   state=None
   if role:
    email={'admin':'e2e_admin@test.local','member':'e2e_member@test.local'}[role]
    state=storage(sign_in(email))
   ctx=await browser.new_context(viewport={'width':390,'height':844},storage_state=state)
   page=await ctx.new_page(); await attach(page,name)
   await page.goto(BASE+route,wait_until='networkidle',timeout=15000)
   await page.wait_for_timeout(600)
   path=urllib.parse.urlparse(page.url).path
   results['security'].append({'test':name,'expected':expected,'actual':path,'result':'PASS' if path.startswith(expected) else 'FAIL'})
   await ctx.close()
  await smoke('guest /admin redirects to /auth',None,'/admin','/auth')
  await smoke('member /admin redirects to /member','member','/admin','/member')
  await smoke('existing admin /admin works','admin','/admin','/admin')
  await browser.close()
 results['console']={'events':console,'hydrationErrors':len([e for e in console if 'hydration' in e['text'].lower() or 'did not match' in e['text'].lower()]),'getUserFailedFetchErrors':len([e for e in console if 'getuser' in e['text'].lower() or 'failed to fetch' in e['text'].lower()]),'otherConsoleErrors':len(console)}
 open('tmp/auth-fix-real-remaining-checks.json','w').write(json.dumps(results,ensure_ascii=False,indent=2))
 print(json.dumps(results,ensure_ascii=False,indent=2))
asyncio.run(main())
