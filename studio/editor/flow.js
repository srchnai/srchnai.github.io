const $=s=>document.querySelector(s),esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const KEY='srchn-demo.flow';
const CATS=['Cafes','Restaurants','Bars, pubs and breweries','Coworking spaces','Hotels, hostels and guest houses','Parks','Cinemas','Fitness','Shopping','Event spaces','Community spaces','Attractions'];
const LOCS=['Indiranagar','Koramangala','HSR Layout','Jayanagar','Whitefield','Basavanagudi','Yelahanka','Marathahalli','Hebbal','Rajajinagar','Banashankari','BTM Layout','Electronic City','Domlur','Bellandur'];
const LABEL={draft:'Draft',rejected_source:'Rejected: not made in SRCHN Studio',submitted:'Submitted, waiting for review',in_review:'In SRCHN review',changes:'Changes requested',approved:'Approved by SRCHN reviewer (demo), waiting for brand approval',ready:'Ready. Not published (no publishing system exists)'};
let S;try{S=JSON.parse(localStorage.getItem(KEY))}catch{S=null}
S=S||{name:'',cat:CATS[0],loc:LOCS[0],desc:'',credit:'',csrc:'',clic:'',source:'studio',perm:false,thumb:null,status:'draft',hist:[],last:null,pretend:'',comment:'',role:'venue'};
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(S))}catch{note('Could not save on this device (storage full or blocked). State is kept until you close the page.')}};
let msg='';const note=m=>{msg=m};
const today=()=>S.pretend?new Date(S.pretend+'T12:00:00'):new Date();
const iso=d=>d.toISOString().slice(0,10);
const log=(who,m)=>{S.hist.push({t:new Date().toISOString().slice(0,16).replace('T',' '),who,m})};
function checks(){return [['Business name entered',!!S.name.trim()],['Category and neighbourhood chosen',!!S.cat&&!!S.loc],['Description entered (facts only)',S.desc.trim().length>=20],['Permission to use the media confirmed',S.perm],['Media made in SRCHN Studio',S.source==='studio'],['Photo attached (kept on this device)',!!S.thumb],['Photo credit, source and licence entered',!!(S.credit&&S.credit.trim())],['Image source page URL and licence URL entered (https)',/^https:\/\/\S+$/.test((S.csrc||'').trim())&&/^https?:\/\/\S+$/.test((S.clic||'').trim())]]}
function elig(){if(S.status!=='ready'||!S.last)return ['Not applicable yet','The three-year check starts when a listing is ready.'];const a=today(),l=new Date(S.last+'T12:00:00');const m=(a.getFullYear()-l.getFullYear())*12+a.getMonth()-l.getMonth()-(a.getDate()<l.getDate()?1:0);
 if(m<0)return ['Check the date','The pretend date is before the last confirmation.'];if(m>=36)return ['On hold (simulated)','Three years or more since the listing was last confirmed. Under the proposed rule, recurring payments or revenue benefits could be ineligible until the listing is reviewed and renewed. Nothing is paid or stopped here.'];
 if(m>=30)return ['Due soon','About '+(36-m)+' month(s) left before the proposed three-year limit. Reconfirm the listing to stay eligible (simulation).'];return ['Current','Confirmed '+m+' month(s) ago. Within the proposed three-year limit (simulation).']}
function actions(){const st=S.status,r=S.role,a=[];
 if(r==='venue'){if(['draft','changes','rejected_source'].includes(st))a.push(['submit',st==='draft'?'Submit for review':'Resubmit for review']);if(st==='approved')a.push(['brandok','Record brand approval (demo click)']);if(st==='ready')a.push(['reconfirm','Reconfirm listing (sets last confirmed to the date above)'])}
 else{if(st==='submitted')a.push(['start','Start review']);if(st==='in_review'){a.push(['changes','Request changes (comment required)']);a.push(['approve','Approve content (demo)'])}}
 return a}
function doAct(k){const c=checks();
 if(k==='submit'){const miss=c.filter(x=>!x[1]&&x[0]!=='Media made in SRCHN Studio'&&x[0]!=='Photo attached (kept on this device)');if(miss.length){note('Cannot submit yet: '+miss.map(x=>x[0]).join('; ')+'.');return}
  if(S.source!=='studio'){S.status='rejected_source';log('System (demo rule)','Rejected: finished video or edits made outside SRCHN Studio are not accepted under the proposed rule. Remake it in SRCHN Studio and resubmit.');note('Rejected under the proposed Studio-only rule. Change the media source to Studio and resubmit.');return}
  S.status='submitted';S.comment='';log('Venue (demo)','Submitted for review.')}
 if(k==='start'){S.status='in_review';log('Reviewer (demo)','Started review.')}
 if(k==='changes'){const t=$('#fl-comment').value.trim();if(!t){note('Write what needs to change first.');return}S.status='changes';S.comment=t;log('Reviewer (demo)','Requested changes: '+t)}
 if(k==='approve'){const bad=c.filter(x=>!x[1]);if(bad.length){note('Cannot approve: '+bad.map(x=>x[0]).join('; ')+'.');return}S.status='approved';S.comment='';log('Reviewer (demo)','Approved the content. This is a click on this device, not a real review.')}
 if(k==='brandok'){S.status='ready';S.last=iso(today());log('Venue (demo)','Recorded brand approval (a click, not a signature). Listing confirmed '+S.last+'. Not published.')}
 if(k==='reconfirm'){S.last=iso(today());log('Venue (demo)','Reconfirmed the listing on '+S.last+'.')}
 save()}
function panel(){const c=checks(),st=S.status,e=elig(),acts=actions();
 const ok=c.filter(x=>x[1]).length;
 const card=`<div class="fl-card"><div class="fl-img" ${S.thumb?`style="background-image:url(${S.thumb})"`:''}>${S.thumb?'':'<span>No photo</span>'}</div><b>${esc(S.name||'Your business name')}</b><br><span class="note">${esc(S.cat)} · ${esc(S.loc)}</span><p class="note">${esc(S.desc||'Description appears here.')}</p>${S.credit?`<p class="note">Photo: ${esc(S.credit)}</p>`:''}<span class="badge sim">Demo card</span></div>`;
 const imm=S.thumb?`<div class="fl-imm" role="img" aria-label="Slow pan and zoom preview of the attached photo"><div style="background-image:url(${S.thumb})"></div><span class="badge sim">Photo-based motion preview</span></div>`:'<p class="note">Attach a photo to see the motion preview.</p>';
 return `<div class="grid"><div class="card"><h2>Status: ${esc(LABEL[st])}</h2>
 ${S.comment&&st==='changes'?`<p class="warn"><b>Reviewer comment:</b> ${esc(S.comment)}</p>`:''}
 ${msg?`<p class="warn" role="alert">${esc(msg)}</p>`:''}
 <h3>Checks (${ok} of ${c.length} pass)</h3><ul class="fl-ck">${c.map(x=>`<li>${x[1]?'Pass':'Open'}: ${esc(x[0])}</li>`).join('')}</ul>
 ${S.role==='reviewer'&&st==='in_review'?'<label>Comment for the venue (needed to request changes)<textarea id="fl-comment" rows="2"></textarea></label>':''}
 <div class="row">${acts.map(a=>`<button class="p" data-a="${a[0]}">${esc(a[1])}</button>`).join('')||'<span class="note">No action for this role in this state. Switch role above.</span>'}</div></div>
 <div class="card"><h2>Three content formats</h2><h3>1. Location video</h3><p class="note">Made in the Studio tab, in your browser. This sends the photo, name, neighbourhood and description to the Studio video step so you can make a real clip from them (test media only, not a brand or a publication). The photo copy kept here is small (about 480 px), so the clip will look soft.</p><button class="s" id="fl-tostudio" type="button"${S.thumb?'':' disabled'}>Send to the Studio video step</button><p class="note" id="fl-tsmsg" role="status"></p><h3>2. Immersive preview</h3>${imm}<h3>3. Discovery card</h3>${card}</div></div>
 <div class="card"><h2>Three-year listing check (simulation)</h2><p><b>${esc(e[0])}</b>. ${esc(e[1])}</p><p class="note">Last confirmed: ${S.last||'not yet'}. Proposed rule: brands and venues reconfirm a listing at least every three years or may become ineligible for recurring payments or revenue benefits until reviewed and renewed. Not enforced. No payment exists.</p></div>
 <div class="card"><h2>History</h2>${S.hist.length?`<table><tr><th>When</th><th>Who</th><th>What</th></tr>${S.hist.slice().reverse().map(h=>`<tr><td>${h.t}</td><td>${esc(h.who)}</td><td>${esc(h.m)}</td></tr>`).join('')}</table>`:'<p class="note">Nothing yet.</p>'}</div>`}
function render(){const p=$('#fl-panel');p.innerHTML=panel();p.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{note('');doAct(b.dataset.a);render()});msg=''}
function build(){const s=$('#t-flow');s.innerHTML=`<h2>Brand workspace <span class="badge sim">local demonstration</span></h2>
<p class="sub warn">Everything here runs in your browser and is saved only on this device. It shows how a listing could move from draft to ready. No real brand, signature, subscription, payment or publication exists. One person plays both roles. "Approve" is a click, not a verified decision.</p>
<style>.fl-card{border:1px solid #e5e5e5;border-radius:14px;padding:10px;max-width:280px}.fl-img{height:140px;border-radius:10px;background:#e5e5e5 center/cover;display:flex;align-items:center;justify-content:center;color:#737373;margin-bottom:6px}.fl-imm{position:relative;height:200px;max-width:300px;overflow:hidden;border-radius:14px;background:#222}.fl-imm div{position:absolute;inset:-12%;background:center/cover;animation:flpan 9s ease-in-out infinite alternate}.fl-imm .badge{position:absolute;left:6px;bottom:6px;margin:0}@keyframes flpan{from{transform:scale(1) translate(-3%,-2%)}to{transform:scale(1.18) translate(3%,2%)}}@media(prefers-reduced-motion:reduce){.fl-imm div{animation:none}}.fl-ck{padding-left:18px;margin:4px 0}</style>
<div class="card"><h2>Listing details</h2><div class="grid"><label>Business name<input type="text" id="fl-name" maxlength="80"></label><label>Category<select id="fl-cat">${CATS.map(c=>`<option>${esc(c)}</option>`).join('')}</select></label><label>Neighbourhood<select id="fl-loc">${LOCS.map(c=>`<option>${esc(c)}</option>`).join('')}</select></label><label>Media source<select id="fl-src"><option value="studio">Made in SRCHN Studio</option><option value="other">Edited in another tool (will be rejected)</option></select></label></div>
<label>Photo credit: creator, source and licence (carried into any video made from it)<input type="text" id="fl-credit" maxlength="110" placeholder="e.g. Name, Wikimedia Commons, CC BY-SA 4.0"></label> <label>Image source page URL (the page where the photo comes from)<input type="url" id="fl-csrc" maxlength="400" placeholder="https://commons.wikimedia.org/wiki/File:..."></label> <label>Licence URL<input type="url" id="fl-clic" maxlength="300" placeholder="https://creativecommons.org/licenses/by-sa/4.0"></label>
<label>Description, facts only (at least 20 characters)<textarea id="fl-desc" rows="3" maxlength="300"></textarea></label>
<label>Photo (stays on this device; a small copy is saved in this browser)<input type="file" id="fl-file" accept="image/jpeg,image/png,image/webp"></label>
<label class="chk"><input type="checkbox" id="fl-perm"> I own this photo or have permission to use it.</label>
<div class="grid"><label>Acting as<select id="fl-role"><option value="venue">Venue or brand (demo)</option><option value="reviewer">SRCHN reviewer (demo)</option></select></label><label>Pretend today's date (to test the three-year check)<input type="date" id="fl-today"></label></div>
<div class="row"><button class="s" id="fl-reset" type="button">Reset this demo</button></div></div>
<div id="fl-panel" aria-live="polite"></div>`;
 const bind=(id,k,ev='input')=>{const e=$(id);if(e.type==='checkbox')e.checked=!!S[k];else e.value=S[k]||'';e.addEventListener(ev==='input'&&e.type==='checkbox'?'change':ev,()=>{S[k]=e.type==='checkbox'?e.checked:e.value;save();render()})};
 bind('#fl-name','name');bind('#fl-cat','cat','change');bind('#fl-loc','loc','change');bind('#fl-src','source','change');bind('#fl-desc','desc');bind('#fl-credit','credit');bind('#fl-csrc','csrc');bind('#fl-clic','clic');bind('#fl-perm','perm');bind('#fl-role','role','change');bind('#fl-today','pretend','change');
 $('#fl-file').addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;const im=new Image(),u=URL.createObjectURL(f);im.onload=()=>{const m=480,r=Math.min(1,m/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*r);c.height=Math.round(im.height*r);c.getContext('2d').drawImage(im,0,0,c.width,c.height);S.thumb=c.toDataURL('image/jpeg',.7);URL.revokeObjectURL(u);save();render()};im.onerror=()=>{note('That file could not be read as an image.');render()};im.src=u});
 $('#fl-reset').onclick=()=>{try{localStorage.removeItem(KEY)}catch{}S={name:'',cat:CATS[0],loc:LOCS[0],desc:'',credit:'',csrc:'',clic:'',source:'studio',perm:false,thumb:null,status:'draft',hist:[],last:null,pretend:'',comment:'',role:'venue'};build();render()};
 render()}
let built=false;const open=()=>{if(!built){build();built=true}};
document.querySelector('nav button[data-t=flow]').addEventListener('click',open);
if(location.hash==='#flow')document.querySelector('nav button[data-t=flow]').click();
document.querySelectorAll('nav button').forEach(b=>b.addEventListener('click',()=>{const r=$('#rules-box');if(r)r.hidden=b.dataset.t!=='studio'}));

document.addEventListener('click',async e=>{if(!e.target||e.target.id!=='fl-tostudio')return;const m=document.getElementById('fl-tsmsg');try{const d=window.__flowState&&window.__flowState();}catch(_){}
 let st={};try{st=JSON.parse(localStorage.getItem('srchn-demo.flow')||'{}')}catch(_){}
 if(!st.thumb){m.textContent='Attach a photo first.';return}
 const b=await (await fetch(st.thumb)).blob(),f=new File([b],'demo-photo.jpg',{type:'image/jpeg'});
 const own=document.getElementById('own');if(!st.perm){m.textContent='Tick the permission box in the listing first.';return}if(!(st.credit||'').trim()){m.textContent='Enter the photo credit, source and licence first.';return}if(!/^https:\/\/\S+$/.test((st.csrc||'').trim())||!/^https?:\/\/\S+$/.test((st.clic||'').trim())){m.textContent='Enter the image source page URL and the licence URL first (https links).';return}
 document.querySelector('nav button[data-t=studio]').click();
 own.checked=true;own.dispatchEvent(new Event('change'));
 const inp=document.getElementById('file');inp.disabled=false;const dt=new DataTransfer();dt.items.add(f);inp.files=dt.files;inp.dispatchEvent(new Event('change'));
 window.__demoMedia=true;const set=(id,v)=>{const x=document.getElementById(id);if(x)x.value=v};set('place',(st.name||'').slice(0,60));set('loc',(st.loc||'').slice(0,40));set('cap',(st.desc||'').slice(0,120));set('credit',(st.credit||'').slice(0,110));set('csrc',(st.csrc||'').slice(0,400));set('clic',(st.clic||'').slice(0,300));
 const mm=document.getElementById('msg');if(mm)mm.textContent='Loaded from the Brand workspace demo. Check the preview, then choose Make photo-based video.';
});

(function(){const sec=document.getElementById('t-profile');if(!sec)return;const K='srchn-demo.creator';let C={};try{C=JSON.parse(localStorage.getItem(K)||'{}')}catch(_){}
 const esc=t=>String(t||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 const d=document.createElement('div');d.className='card';d.style.margin='12px 16px';
 d.innerHTML='<h2>Creator profile card <span class="badge sim">Local demo, eligibility pending</span></h2><p class="note">A preview of how a hyper-local creator page could look. It uses only what you type here, on this device. No person, follower, earnings, approval or venue relationship exists; nothing is published.</p><label for="cp-focus">Focus (what you would cover)</label><select id="cp-focus"><option>Food and cafes</option><option>Parks and outdoors</option><option>Events and culture</option><option>Fitness and sport</option><option>Coworking and work spots</option><option>Stays</option></select><label for="cp-bio">Short bio (facts about your coverage only)</label><textarea id="cp-bio" maxlength="160" rows="2"></textarea><div id="cp-card" aria-live="polite"></div>';
 sec.appendChild(d);
 const fo=d.querySelector('#cp-focus'),bio=d.querySelector('#cp-bio'),out=d.querySelector('#cp-card');fo.value=C.focus||fo.value;bio.value=C.bio||'';
 function draw(){let st={};try{st=JSON.parse(localStorage.getItem('srchn-demo.flow')||'{}')}catch(_){}
  const nm=(document.getElementById('pname')||{}).value||'',lc=(document.getElementById('ploc')||{}).value||'';
  const lst=st.name?('Demo listing in the Brand workspace: '+esc(st.name)+' (placeholder; no real venue or relationship)'):'No demo listing yet. Start one in the Brand workspace tab.';
  out.innerHTML='<div style="margin-top:12px;border:1px solid #e5e5e5;border-radius:14px;padding:14px;background:#fff"><b style="font-size:18px">'+esc(nm||'Your display name')+'</b><br><span class="note">'+esc(lc||'Your neighbourhood')+' · '+esc(fo.value)+'</span><p>'+esc(bio.value||'Your bio appears here.')+'</p><table><tr><td>Published posts</td><td>0 (publishing is planned)</td></tr><tr><td>Followers, earnings</td><td>No data</td></tr><tr><td>Eligibility</td><td>Pending. No review exists in this preview.</td></tr><tr><td>Collaboration</td><td>'+lst+'</td></tr></table><span class="badge sim">Demo card, not a live profile</span></div>'}
 ['input','change'].forEach(ev=>{[fo,bio,document.getElementById('pname'),document.getElementById('ploc')].forEach(x=>x&&x.addEventListener(ev,()=>{try{localStorage.setItem(K,JSON.stringify({focus:fo.value,bio:bio.value}))}catch(_){}draw()}))});
 document.querySelector('nav button[data-t=profile]')&&document.querySelector('nav button[data-t=profile]').addEventListener('click',draw);draw();
})();
