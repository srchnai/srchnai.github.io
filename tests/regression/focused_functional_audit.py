import json,subprocess,time,urllib.request,base64,os
from pathlib import Path
from websocket import create_connection
BASE='https://srchn.in'
PORT=9375
OUT='/tmp/master-qa-focused-shots';os.makedirs(OUT,exist_ok=True)
# tiny permissively self-generated test image, created locally for local-only Studio testing
from PIL import Image,ImageDraw
img=Image.new('RGB',(900,1600),(34,76,116));d=ImageDraw.Draw(img);d.rectangle((80,120,820,1480),outline=(240,240,240),width=12);d.ellipse((280,480,620,820),fill=(232,177,82));d.text((140,1300),'SRCHN QA TEST IMAGE',fill=(255,255,255))
TESTIMG='/tmp/studio-qa-test.png';img.save(TESTIMG)
chrome=subprocess.Popen(['google-chrome','--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',f'--remote-debugging-port={PORT}','--user-data-dir=/tmp/chrome-master-focused','about:blank'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
ws=None;mid=0;events=[]
try:
 for _ in range(80):
  try:
   tabs=json.load(urllib.request.urlopen(f'http://127.0.0.1:{PORT}/json',timeout=1));break
  except Exception:time.sleep(.25)
 else:raise RuntimeError('chrome did not start')
 page=next(t for t in tabs if t.get('type')=='page');ws=create_connection(page['webSocketDebuggerUrl'],timeout=60)
 def pump(timeout=.01):
  global events
  end=time.time()+timeout
  while time.time()<end:
   try:
    ws.settimeout(max(.01,end-time.time()));m=json.loads(ws.recv())
    if 'method' in m:events.append(m)
   except Exception:break
  ws.settimeout(60)
 def cmd(method,params=None,timeout=60):
  global mid
  pump(0);mid+=1;ws.send(json.dumps({'id':mid,'method':method,'params':params or {}}));end=time.time()+timeout
  while time.time()<end:
   m=json.loads(ws.recv())
   if 'method' in m:events.append(m)
   if m.get('id')==mid:
    if 'error' in m:raise RuntimeError(m['error'])
    return m.get('result',{})
  raise TimeoutError(method)
 def evaljs(expr,await_promise=False,timeout=30):
  r=cmd('Runtime.evaluate',{'expression':expr,'awaitPromise':await_promise,'returnByValue':True,'timeout':timeout*1000},timeout+10)
  if 'exceptionDetails' in r:return {'__error__':str(r['exceptionDetails'])[:1200]}
  return r.get('result',{}).get('value')
 def nav(url,width=390):
  global events
  events=[];cmd('Emulation.setDeviceMetricsOverride',{'width':width,'height':844,'deviceScaleFactor':2 if width<768 else 1,'mobile':width<768})
  cmd('Page.navigate',{'url':url})
  for _ in range(80):
   time.sleep(.2);pump(0)
   st=evaljs("document.readyState",timeout=5)
   if st=='complete':break
  time.sleep(.7);pump(0)
 def classify():
  errs=[];failed=[];req=[]
  for m in events:
   p=m.get('params',{})
   if m.get('method')=='Runtime.exceptionThrown':errs.append(str(p.get('exceptionDetails',{}))[:700])
   if m.get('method')=='Network.loadingFailed' and not p.get('canceled'):failed.append({'type':p.get('type'),'errorText':p.get('errorText'),'blockedReason':p.get('blockedReason')})
   if m.get('method')=='Network.requestWillBeSent':
    u=p.get('request',{}).get('url','')
    if u.startswith('http'):req.append(u)
  return errs,failed,req
 def metrics():
  v=evaljs(r'''JSON.stringify((()=>{const d=document,b=d.body,w=innerWidth;const sw=Math.max(d.documentElement.scrollWidth,b?b.scrollWidth:0);const txt=b?b.innerText:'';return {url:location.href,title:d.title,h1:[...d.querySelectorAll('h1')].map(x=>x.innerText.trim()).filter(Boolean),text:txt.slice(0,4000),textLength:txt.length,overflow:sw>w+1,scrollWidth:sw,innerWidth:w,links:[...d.querySelectorAll('a[href]')].map(a=>({text:(a.innerText||a.getAttribute('aria-label')||'').replace(/\s+/g,' ').trim(),href:a.href})).slice(0,120),buttons:[...d.querySelectorAll('button')].map(x=>({text:(x.innerText||x.getAttribute('aria-label')||'').replace(/\s+/g,' ').trim(),disabled:x.disabled})).slice(0,120),forms:[...d.querySelectorAll('form')].map(f=>({action:f.action,method:f.method,inputs:[...f.querySelectorAll('input,select,textarea,button')].map(x=>({tag:x.tagName,type:x.type,name:x.name,id:x.id,required:x.required,disabled:x.disabled,text:(x.innerText||x.value||x.getAttribute('aria-label')||'').replace(/\s+/g,' ').trim()})).slice(0,80)})),videos:[...d.querySelectorAll('video')].map(v=>({src:v.currentSrc||v.src,controls:v.controls,playsInline:v.playsInline,readyState:v.readyState,videoWidth:v.videoWidth,videoHeight:v.videoHeight,paused:v.paused,hidden:v.hidden})),failedImgs:[...d.images].filter(i=>i.complete&&i.naturalWidth===0).map(i=>i.currentSrc||i.src).slice(0,20)}})())''')
  return json.loads(v)
 cmd('Page.enable');cmd('Runtime.enable');cmd('Network.enable');cmd('DOM.enable')
 results={}
 # Studio: full local media flow and tabs, no uploads
 nav(BASE+'/studio/',390);studio={'mobile':metrics()}
 studio['beforeOwnDisabled']=evaljs("document.querySelector('#file').disabled")
 evaljs("document.querySelector('#own').click()")
 studio['afterOwnFileEnabled']=evaljs("!document.querySelector('#file').disabled")
 doc=cmd('DOM.getDocument',{'depth':1});node=cmd('DOM.querySelector',{'nodeId':doc['root']['nodeId'],'selector':'#file'})
 cmd('DOM.setFileInputFiles',{'nodeId':node['nodeId'],'files':[TESTIMG]})
 for _ in range(50):
  time.sleep(.2)
  if evaljs("!document.querySelector('#mk').disabled") is True:break
 for sel,val in [('#place','QA Test Place'),('#loc','Indiranagar'),('#credit','SRCHN QA generated test image'),('#csrc','https://example.com/source'),('#clic','https://creativecommons.org/licenses/by/4.0/'),('#cap','Local-only browser render test')]:
  evaljs(f"(()=>{{const e=document.querySelector('{sel}');e.value={json.dumps(val)};e.dispatchEvent(new Event('input',{{bubbles:true}}));e.dispatchEvent(new Event('change',{{bubbles:true}}))}})()")
 events=[]
 evaljs("document.querySelector('#mk').click()")
 ok=False
 for _ in range(100):
  time.sleep(.2);pump(0)
  if evaljs("!document.querySelector('#vid').hidden && !document.querySelector('#dl').hidden") is True:ok=True;break
 studio['renderedVideo']=ok
 studio['renderMessage']=evaljs("document.querySelector('#msg')?.textContent||''")
 studio['videosAfterRender']=metrics()['videos']
 studio['downloadReady']=evaljs("JSON.stringify({video:!!document.querySelector('#dl')?.href,credit:!!document.querySelector('#dlc')?.href})")
 errs,failed,req=classify();studio['renderExceptions']=errs;studio['renderNetworkFailures']=failed;studio['renderHttpRequests']=req
 evaljs("document.querySelector('#save').click()")
 time.sleep(.3)
 studio['savedLocalOnly']=evaljs("JSON.parse(localStorage.getItem('srchn-demo.saved')||'[]').length")
 tabs=evaljs("JSON.stringify([...document.querySelectorAll('nav[role=tablist] button')].map(b=>({t:b.dataset.t,label:b.innerText})))") or '[]'
 studio['tabs']=[];studio['tabErrors']=[]
 for tab in json.loads(tabs):
  t=tab['t'];evaljs(f"document.querySelector('nav[role=tablist] button[data-t={json.dumps(t)}]').click()");time.sleep(.15)
  sec=evaljs(f"JSON.stringify((()=>{{const s=document.querySelector('#t-'+{json.dumps(t)});return {{visible:!!s&&!s.hidden,text:(s?.innerText||'').replace(/\\s+/g,' ').trim().slice(0,500)}}}})())")
  sec=json.loads(sec);sec['tab']=t;studio['tabs'].append(sec)
  if not sec['visible'] or not sec['text']:studio['tabErrors'].append(t)
 studio['desktop']=metrics() if False else None
 ss=cmd('Page.captureScreenshot',{'format':'jpeg','quality':78,'captureBeyondViewport':False},90);fn=f'{OUT}/studio-mobile.jpg';open(fn,'wb').write(base64.b64decode(ss['data']));studio['screenshot']=fn
 results['studio']=studio
 # Club: non-submitting login and product preview surfaces
 nav(BASE+'/club/',390);club={'mobile':metrics()}
 club['hasRequiredCopy']={k:(k.lower() in club['mobile']['text'].lower()) for k in ['₹100','Aadhaar','authorised e-KYC','no participating brand has been confirmed','preview','cashback','priority entry','SRCHN PAY']}
 evaljs("[...document.querySelectorAll('button')].find(b=>b.innerText.includes('MEMBER LOGIN'))?.click()");time.sleep(.5)
 club['loginScreen']=metrics()
 club['loginHonesty']={k:(k.lower() in club['loginScreen']['text'].lower()) for k in ['email login verifies access to your email only','not verified','preview']}
 club['noPaymentSubmitted']=True
 results['club']=club
 # Claim/business onboarding page
 nav(BASE+'/claim-place/',390);claim={'mobile':metrics()}
 claim['honesty']={k:(k.lower() in claim['mobile']['text'].lower()) for k in ['not live in this preview','never implies verification','owner-authorised','no invented reviews']}
 results['claim']=claim
 # Request form validation only: never create a valid record
 nav(BASE+'/request/',390);events=[];request={'mobile':metrics()}
 evaljs("document.querySelector('#request button')?.click()");time.sleep(.5)
 request['afterEmptySubmit']=metrics();errs,failed,req=classify();request['emptySubmitExceptions']=errs;request['emptySubmitHttpRequests']=req
 request['stillOnPage']=request['afterEmptySubmit']['url'].startswith(BASE+'/request')
 results['request']=request
 # Submit-place paused state: controls disabled and no local save
 nav(BASE+'/submit-place/',390);submit={'mobile':metrics()}
 submit['paused']={k:(k.lower() in submit['mobile']['text'].lower()) for k in ['submissions are currently paused','nothing entered here is saved','submissions paused','deletion unavailable while paused']}
 submit['disabledButtons']=[b for b in submit['mobile']['buttons'] if b.get('disabled')]
 results['submit']=submit
 # Plan/profile source-of-truth wording
 nav(BASE+'/plan/',390);plan={'mobile':metrics()};plan['localVsServer']={k:(k.lower() in plan['mobile']['text'].lower()) for k in ['stays in this browser','signed-in pilot profile are separate']};results['plan']=plan
 nav(BASE+'/discovery/profile/',390);profile={'mobile':metrics()};profile['serverSideDisclosure']={k:(k.lower() in profile['mobile']['text'].lower()) for k in ['stored server-side','signed-in account','can be removed']};results['profile']=profile
 # Legal SPA: discover headings and legal links; open Terms and Privacy without submitting forms
 nav(BASE+'/legal/',390);legal={'mobile':metrics()}
 legal['headings']=evaljs("JSON.stringify([...document.querySelectorAll('h1,h2')].map(x=>x.innerText.trim()).filter(Boolean).slice(0,40))")
 legal['hasDisclosure']={k:(k.lower() in legal['mobile']['text'].lower()) for k in ['not legal advice','privacy','terms']}
 legal['openChecks']={}
 for label in ['Privacy','Terms']:
  nav(BASE+'/legal/',390)
  evaljs(f"[...document.querySelectorAll('a,button')].find(x=>(x.innerText||'').trim()==={json.dumps(label)})?.click()");time.sleep(.8)
  m=metrics();legal['openChecks'][label]={'url':m['url'],'title':m['title'],'textHasLabel':label.lower() in m['text'].lower(),'h1':m['h1']}
 results['legal']=legal
 # Privacy rendered content
 nav(BASE+'/privacy/',390);privacy={'mobile':metrics()};privacy['coverage']={k:(k.lower() in privacy['mobile']['text'].lower()) for k in ['local storage','cloudflare','openstreetmap','removal','not legal advice']};results['privacy']=privacy
 # Final events
 results['_meta']={'generated_at':time.strftime('%Y-%m-%dT%H:%M:%S%z'),'base':BASE}
 json.dump(results,open('/tmp/master-qa-focused-audit.json','w'),indent=2)
 print(json.dumps({k:{kk:v[kk] for kk in v if kk in ('renderedVideo','renderMessage','savedLocalOnly','tabErrors','hasRequiredCopy','loginHonesty','honesty','emptySubmitHttpRequests','paused','localVsServer','serverSideDisclosure','hasDisclosure','openChecks','coverage')} for k,v in results.items() if not k.startswith('_')},indent=2))
finally:
 try:
  if ws:ws.close()
 except:pass
 chrome.terminate()
 try:chrome.wait(timeout=5)
 except:chrome.kill()
