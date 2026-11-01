import json,subprocess,time,urllib.request
from pathlib import Path
from websocket import create_connection
AXE=Path('/tmp/axe.min.js').read_text();PORT=9381
urls=[('home','https://srchn.in/'),('discovery','https://srchn.in/discovery/'),('pin-filter','https://srchn.in/discovery/?pincode=560025&category=drink'),('localities','https://srchn.in/localities/'),('locality-alias','https://srchn.in/localities/indira-nagar/'),('place-detail','https://srchn.in/discovery/place/?id=w348121410'),('feed','https://srchn.in/feed/'),('about','https://srchn.in/about/'),('club','https://srchn.in/club/'),('studio','https://srchn.in/studio/'),('claim','https://srchn.in/claim-place/'),('request','https://srchn.in/request/'),('submit','https://srchn.in/submit-place/'),('plan','https://srchn.in/plan/'),('profile','https://srchn.in/discovery/profile/'),('privacy','https://srchn.in/privacy/'),('legal','https://srchn.in/legal/'),('contact','https://srchn.in/contact/'),('credits','https://srchn.in/credits/')]
chrome=subprocess.Popen(['google-chrome','--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',f'--remote-debugging-port={PORT}','--user-data-dir=/tmp/chrome-master-final-axe','about:blank'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
 for _ in range(80):
  try:tabs=json.load(urllib.request.urlopen(f'http://127.0.0.1:{PORT}/json',timeout=1));break
  except:time.sleep(.25)
 page=next(t for t in tabs if t.get('type')=='page');ws=create_connection(page['webSocketDebuggerUrl'],timeout=45);mid=0
 def cmd(m,p=None,t=45):
  global mid;mid+=1;ws.send(json.dumps({'id':mid,'method':m,'params':p or {}}));end=time.time()+t
  while time.time()<end:
   x=json.loads(ws.recv())
   if x.get('id')==mid:
    if 'error' in x:raise RuntimeError(x['error'])
    return x.get('result',{})
  raise TimeoutError(m)
 def ev(e,ap=False):
  r=cmd('Runtime.evaluate',{'expression':e,'awaitPromise':ap,'returnByValue':True,'timeout':30000},40)
  if 'exceptionDetails' in r:return {'error':str(r['exceptionDetails'])[:500]}
  return r.get('result',{}).get('value')
 cmd('Page.enable');cmd('Runtime.enable');out=[]
 for name,url in urls:
  cmd('Page.navigate',{'url':url})
  for _ in range(50):
   time.sleep(.2)
   if ev('document.readyState')=='complete':break
  time.sleep(1.5 if name in ('club','legal') else .5)
  ev(AXE)
  val=ev("axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa']},resultTypes:['violations']}).then(r=>({url:location.href,violations:r.violations.map(v=>({id:v.id,impact:v.impact,help:v.help,nodes:v.nodes.slice(0,5).map(n=>({target:n.target,summary:(n.failureSummary||'').slice(0,300)}))}))}))",True)
  out.append({'name':name,'requested':url,**val});print(name,len(val.get('violations',[])),flush=True)
 json.dump(out,open('/tmp/master-qa-final-axe-results.json','w'),indent=2)
finally:
 try:ws.close()
 except:pass
 chrome.terminate();chrome.wait(timeout=5)
