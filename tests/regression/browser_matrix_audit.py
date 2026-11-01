import json,subprocess,time,urllib.request,base64,os,sys
from websocket import create_connection
BASE='https://srchn.in'
PAGES=[
 ('home','/'),('discovery','/discovery/'),('discovery-eat','/discovery/?category=eat'),('discovery-empty','/discovery/?category=events&sub=Live+Music'),('discovery-pin','/discovery/?pincode=560025&category=drink'),('place-detail','/discovery/place/?id=n2641818345'),('localities','/localities/'),('locality','/localities/indiranagar/'),
 ('live','/live/'),('work','/work/'),('eat','/eat/'),('drink','/drink/'),('play','/play/'),('shop','/shop/'),('travel','/travel/'),('events','/events/'),('movies','/movies/'),('clubs','/clubs/'),
 ('collections','/collections/'),('plan','/plan/'),('claim','/claim-place/'),('contact','/contact/'),('club','/club/'),('legal','/legal/'),('privacy','/privacy/'),('about','/about/'),('credits','/credits/'),('feed','/feed/'),('studio','/studio/'),('request','/request/'),('submit','/submit-place/'),('buddy','/buddy/'),('bangalore','/bangalore/')]
WIDTHS=[320,360,375,390,412,768,1024,1280,1440,1920]
KEY={'home','discovery','discovery-pin','place-detail','localities','eat','feed','studio','club','plan'}
OUT='/tmp/master-browser-shots';os.makedirs(OUT,exist_ok=True)
PORT=9360
chrome=subprocess.Popen(['google-chrome','--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',f'--remote-debugging-port={PORT}','--user-data-dir=/tmp/chrome-master-browser-audit','about:blank'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
ws=None
try:
 for _ in range(80):
  try:
   tabs=json.load(urllib.request.urlopen(f'http://127.0.0.1:{PORT}/json',timeout=1));break
  except Exception:time.sleep(.25)
 else:raise RuntimeError('chrome did not start')
 page=next(t for t in tabs if t.get('type')=='page');ws=create_connection(page['webSocketDebuggerUrl'],timeout=60);mid=0;events=[]
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
  pump(0)
  mid+=1;ws.send(json.dumps({'id':mid,'method':method,'params':params or {}}));end=time.time()+timeout
  while time.time()<end:
   m=json.loads(ws.recv())
   if 'method' in m:events.append(m)
   if m.get('id')==mid:
    if 'error' in m:raise RuntimeError(m['error'])
    return m.get('result',{})
  raise TimeoutError(method)
 def evaljs(expr,await_promise=False,timeout=25):
  r=cmd('Runtime.evaluate',{'expression':expr,'awaitPromise':await_promise,'returnByValue':True,'timeout':timeout*1000},timeout+10)
  if 'exceptionDetails' in r:return {'error':str(r['exceptionDetails'])[:1000]}
  return r.get('result',{}).get('value')
 cmd('Page.enable');cmd('Runtime.enable');cmd('Network.enable');cmd('Log.enable')
 results=[]
 def audit(name,path,width,shot=False):
  global events
  events=[]
  mobile=width<768
  cmd('Emulation.setDeviceMetricsOverride',{'width':width,'height':844,'deviceScaleFactor':2 if mobile else 1,'mobile':mobile})
  cmd('Network.setCacheDisabled',{'cacheDisabled':False})
  cmd('Page.navigate',{'url':BASE+path})
  # readiness: document complete; discovery waits for status; club/feed wait for rendered content or bounded timeout
  for i in range(70):
   time.sleep(.2);pump(0)
   st=evaljs("JSON.stringify({ready:document.readyState,status:document.querySelector('#status')?.textContent||'',feed:document.querySelectorAll('#feed .card').length,club:document.body.innerText.length,results:document.querySelectorAll('#results .result').length})",timeout=5)
   try:st=json.loads(st)
   except:st={}
   if st.get('ready')=='complete':
    if name.startswith('discovery') and not st.get('status'):continue
    if name=='feed' and i<10:continue
    if name=='club' and (st.get('club') or 0)<100:continue
    break
  metrics=evaljs(r'''JSON.stringify((()=>{const w=innerWidth,d=document.documentElement,b=document.body,sw=Math.max(d.scrollWidth,b?b.scrollWidth:0);const bad=[];for(const x of document.querySelectorAll('body *')){const r=x.getBoundingClientRect(),cs=getComputedStyle(x);if(!r.width||!r.height||cs.display==='none'||cs.visibility==='hidden')continue;const scrollable=cs.overflowX==='auto'||cs.overflowX==='scroll';if(!scrollable&&(r.right>w+1||r.left<-1)){bad.push({tag:x.tagName,cls:String(x.className).slice(0,60),id:x.id,text:(x.textContent||'').replace(/\s+/g,' ').trim().slice(0,60),left:+r.left.toFixed(1),right:+r.right.toFixed(1),top:+r.top.toFixed(1),width:+r.width.toFixed(1)});if(bad.length>=20)break}}const taps=[];for(const x of document.querySelectorAll('a,button,input,select,summary,[role="button"]')){const r=x.getBoundingClientRect(),cs=getComputedStyle(x);if(!r.width||!r.height||cs.display==='none'||cs.visibility==='hidden')continue;if(r.width<32||r.height<32)taps.push({tag:x.tagName,cls:String(x.className).slice(0,50),text:(x.textContent||x.value||x.getAttribute('aria-label')||'').replace(/\s+/g,' ').trim().slice(0,50),w:+r.width.toFixed(1),h:+r.height.toFixed(1),top:+r.top.toFixed(1)})}const perf=performance.getEntriesByType('navigation')[0]||{};const paints={};for(const p of performance.getEntriesByType('paint'))paints[p.name]=p.startTime;let lcp=null;try{for(const p of performance.getEntriesByType('largest-contentful-paint'))lcp=p.startTime}catch(e){}const failedImgs=[...document.images].filter(i=>i.complete&&i.naturalWidth===0).map(i=>i.currentSrc||i.src).slice(0,20);const videos=[...document.querySelectorAll('video')].map(v=>({src:v.currentSrc||v.src,readyState:v.readyState,paused:v.paused,controls:v.controls,width:v.videoWidth,height:v.videoHeight}));const links=[...document.querySelectorAll('a[href]')].length,buttons=[...document.querySelectorAll('button')].length,forms=[...document.querySelectorAll('form')].length,inputs=[...document.querySelectorAll('input,select,textarea')].length;return {url:location.href,title:document.title,h1:[...document.querySelectorAll('h1')].map(x=>x.innerText.trim()).filter(Boolean),textLength:document.body.innerText.length,innerWidth:w,scrollWidth:sw,overflow:sw>w+1,offenders:bad,tapSmall:taps.slice(0,40),tapSmallCount:taps.length,status:document.querySelector('#status')?.textContent||'',notice:document.querySelector('#notice')?.textContent||'',resultCount:document.querySelectorAll('#results .result').length,feedCards:document.querySelectorAll('#feed .card').length,links,buttons,forms,inputs,failedImgs,videos,timing:{domContentLoaded:perf.domContentLoadedEventEnd||0,load:perf.loadEventEnd||0,response:perf.responseEnd||0,transferSize:perf.transferSize||0,encodedBodySize:perf.encodedBodySize||0,decodedBodySize:perf.decodedBodySize||0,paints,lcp}}})())''',False,35)
  try:metrics=json.loads(metrics)
  except:metrics={'raw':metrics}
  # classify relevant browser events since nav start
  errs=[];failed=[];console=[]
  for m in events:
   meth=m.get('method');p=m.get('params',{})
   if meth=='Network.loadingFailed' and not p.get('canceled'):failed.append({'type':p.get('type'),'errorText':p.get('errorText'),'blockedReason':p.get('blockedReason')})
   if meth=='Log.entryAdded':
    e=p.get('entry',{})
    if e.get('level') in ('error','warning'):console.append({'level':e.get('level'),'source':e.get('source'),'text':e.get('text','')[:500],'url':e.get('url','')})
   if meth=='Runtime.exceptionThrown':errs.append(str(p.get('exceptionDetails',{}))[:800])
  metrics.update({'page':name,'requested':BASE+path,'width':width,'networkFailures':failed[:30],'console':console[:30],'exceptions':errs[:10]})
  if shot:
   ss=cmd('Page.captureScreenshot',{'format':'jpeg','quality':76,'captureBeyondViewport':True},90)
   fn=f'{OUT}/{width}-{name}.jpg';open(fn,'wb').write(base64.b64decode(ss['data']));metrics['screenshot']=fn
  return metrics
 # all pages at phone and desktop
 for width in [390,1280]:
  for name,path in PAGES:
   r=audit(name,path,width,shot=(width==390 and name in {'home','discovery','feed','studio','club','localities','place-detail'}))
   results.append(r);print(width,name,'overflow',r.get('overflow'),'tap',r.get('tapSmallCount'),'h1',len(r.get('h1',[])),'err',len(r.get('exceptions',[])),flush=True)
 # key pages across full width matrix
 for width in WIDTHS:
  if width in (390,1280):continue
  for name,path in PAGES:
   if name not in KEY:continue
   r=audit(name,path,width,shot=(name in {'home','discovery','feed','studio'} and width in {320,768,1920}))
   results.append(r);print(width,name,'overflow',r.get('overflow'),'tap',r.get('tapSmallCount'),'h1',len(r.get('h1',[])),'err',len(r.get('exceptions',[])),flush=True)
 json.dump(results,open('/tmp/master-browser-audit.json','w'),indent=2)
finally:
 try:
  if ws:ws.close()
 except:pass
 chrome.terminate()
 try:chrome.wait(timeout=5)
 except:chrome.kill()
