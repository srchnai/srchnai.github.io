/* SRCHN.PULSE client - discovery, buddy, planner. Data: live SRCHN listings + verified events only. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const venues=JSON.parse(($('pt-venues')||{}).textContent||'[]');
const events=JSON.parse(($('pt-events-data')||{}).textContent||'[]');

const MOODS=[
 {n:'THE DANCE FLOOR',img:'/parties/img/m-dance.jpg',t:'For people who don\u2019t believe in standing still.',c:'DJ nights, electronic, Bollywood, commercial, club',f:v=>/pub|bar|club|brew/i.test(v.category+v.name)},
 {n:'ROOFTOP AFTER DARK',img:'/parties/img/m-rooftop.jpg',t:'The skyline is better with company.',c:'Rooftop lounges, sunset sessions, premium dining, city views',f:v=>/roof|skyye|terrace|skyline/i.test(v.name+v.tagline)},
 {n:'BREWERY CULTURE',img:'/parties/img/m-brewery.jpg',t:'Good conversations. Better evenings.',c:'Microbreweries, craft beer, group tables, live entertainment',f:v=>/brew/i.test(v.category+v.name+v.tagline)},
 {n:'LIVE & LOUD',img:'/parties/img/m-live.jpg',t:'Some nights deserve a soundtrack.',c:'Live bands, independent artists, concerts, acoustic, festivals',f:v=>/live|music|band|concert/i.test(v.name+v.tagline+v.category)},
 {n:'DATE NIGHT',img:'/parties/img/m-date.jpg',t:'Make an ordinary evening extraordinary.',c:'Romantic dining, cocktail lounges, intimate, special occasions',f:v=>/restaurant|caf|dining|lounge/i.test(v.category+v.name)},
 {n:'THE SOCIAL CLUB',img:'/parties/img/m-social.jpg',t:'Come for the experience. Leave with stories.',c:'Singles mixers, networking, community, quiz nights, social events',f:v=>/social|mixer|community|event/i.test(v.category+v.name)},
 {n:'COMEDY & CULTURE',img:'/parties/img/m-comedy.jpg',t:'Laugh a little louder.',c:'Stand-up, improv, theatre, open mics, cultural',f:v=>/comedy|theatre|theater|improv|open mic|cultur/i.test(v.name+v.tagline+v.category)},
 {n:'THE BIG CELEBRATION',img:'/parties/img/m-celebration.jpg',t:'Make your occasion the occasion.',c:'Birthdays, anniversaries, bachelor/bachelorette, corporate, private events',f:v=>/pub|bar|brew|restaurant/i.test(v.category)},
 {n:'SUNDAY SESSIONS',img:'/parties/img/m-sunday.jpg',t:'Because weekends shouldn\u2019t end too soon.',c:'Brunch parties, sundowners, poolside, relaxed gatherings',f:v=>/caf|brew|restaurant|hotel|resort/i.test(v.category+v.name)},
 {n:'SOMETHING DIFFERENT',img:'/parties/img/m-different.jpg',t:'The plans you didn\u2019t know existed.',c:'Karaoke, gaming, bowling, themed, workshops, unusual activities',f:v=>/entertainment|other|experience|karaoke|gaming|bowling/i.test(v.category+v.name)}];

const AREAS=[
 {n:'Indiranagar',img:'/parties/img/indiranagar.jpg',id:'Craft beer, cocktail bars, social dining, DJ nights',lat:12.9719,lon:77.6412},
 {n:'Koramangala',img:'/parties/img/koramangala.jpg',id:'Clubs, group celebrations, dance floors, live music',lat:12.9352,lon:77.6245},
 {n:'Church Street',img:'/parties/img/church-street.jpg',id:'Pub crawls, live entertainment, social evenings',lat:12.9756,lon:77.6010},
 {n:'MG Road',img:'/parties/img/mg-road.jpg',id:'Pub crawls, live entertainment, social evenings',lat:12.9756,lon:77.6066},
 {n:'Brigade Road',img:'/parties/img/brigade-road.jpg',id:'Pub crawls, live entertainment, social evenings',lat:12.9710,lon:77.6077},
 {n:'Lavelle Road',img:'/parties/img/lavelle-road.jpg',id:'Premium lounges and quiet luxury evenings',lat:12.9698,lon:77.5961},
 {n:'UB City',img:'/parties/img/ub-city.jpg',id:'Premium lounges and quiet luxury evenings',lat:12.9716,lon:77.5958},
 {n:'HSR Layout',img:'/parties/img/hsr.jpg',id:'Community events, social mixers, pubs, casual nights',lat:12.9116,lon:77.6474},
 {n:'Whitefield',img:'/parties/img/whitefield.jpg',id:'Large breweries, team outings, music, celebrations',lat:12.9698,lon:77.7500},
 {n:'Marathahalli',img:'/parties/img/marathahalli.jpg',id:'Expandable locality filter',lat:12.9591,lon:77.6974},
 {n:'Sarjapur Road',img:'/parties/img/sarjapur.jpg',id:'Expandable locality filter',lat:12.9010,lon:77.6870},
 {n:'Jayanagar',img:'/parties/img/jayanagar.jpg',id:'Neighbourhood pubs, music, dining, relaxed evenings',lat:12.9308,lon:77.5838},
 {n:'JP Nagar',img:'/parties/img/jp-nagar.jpg',id:'Neighbourhood pubs, music, dining, relaxed evenings',lat:12.9077,lon:77.5850},
 {n:'Electronic City',img:'/parties/img/electronic-city.jpg',id:'Expandable locality filter',lat:12.8452,lon:77.6602},
 {n:'Hennur',img:'/parties/img/hennur.jpg',id:'Expandable locality filter',lat:13.0367,lon:77.6430},
 {n:'Frazer Town',img:'/parties/img/frazer-town.jpg',id:'Expandable locality filter',lat:12.9988,lon:77.6132}];

const SUGGESTED=['Rooftop parties','DJ nights','Live music','Breweries','Date night','Comedy shows','Birthday celebrations','Ladies\u2019 night','Social mixers','Weekend parties'];
const PROMPTS=['Find a rooftop for tonight.','Where can six friends celebrate a birthday?','Show me live music near Indiranagar.','Plan a date night under \u20B93,000.','Find a Saturday DJ night in Koramangala.','Find places with live music and food.','What\u2019s happening this weekend in Bengaluru?'];
const COLLS={rooftop:/roof|terrace|skyline/i,brewery:/brew/i,club:/club|pub|bar/i,live:/live|music|band/i,date:/restaurant|caf|dining|lounge/i,afterwork:/pub|bar|brew/i,group:/pub|bar|brew|restaurant/i,hidden:/caf|lounge|restaurant/i};

const venueHref=v=>v.recordId?'/discovery/place/?id='+encodeURIComponent(v.recordId):'/discovery/?q='+encodeURIComponent(v.name);
const vCard=v=>'<article class="pt-vcard"><h3><a href="'+esc(venueHref(v))+'">'+esc(v.name)+'</a></h3><p class="pt-vmeta">'+esc([v.category,v.locality].filter(Boolean).join(' \u00B7 '))+'</p>'+(v.tagline?'<p class="pt-vtag">'+esc(v.tagline)+'</p>':'')+(v.sourceLabel?'<p class="pt-src">'+esc(v.sourceLabel)+'</p>':'')+'<div class="pt-vacts"><a class="pt-vxplr" href="'+esc(venueHref(v))+'">VIEW PLACE</a>'+(v.club?'<a class="pt-vbook" href="/parties/book/?b='+esc(v.id)+'" data-city-book="'+esc(v.name)+'" data-city-category="'+esc(v.category)+'">BOOK DEMO</a>':'')+'</div></article>';

/* hero: mood select, suggested chips, search */
const moodSel=$('pt-mood');
if(moodSel)MOODS.forEach((m,i)=>{const o=document.createElement('option');o.value=i;o.textContent=m.n;moodSel.appendChild(o)});
const sugg=$('pt-sugg');
if(sugg)SUGGESTED.forEach(q=>{const b=document.createElement('button');b.type='button';b.textContent=q;b.onclick=()=>{const inp=$('pt-q');inp.value=q;applySearch();document.getElementById('edit').scrollIntoView({behavior:'smooth'})};sugg.appendChild(b)});
function applySearch(){
 const q=($('pt-q')||{}).value||'',loc=($('pt-loc')||{}).value||'',mi=($('pt-mood')||{}).value||'';
 let list=venues.slice();
 const when=($('pt-when')||{}).value||'';if(when){renderTonight(when==='Tonight'?'today':when==='Tomorrow'?'tomorrow':'weekend');$('tonight').scrollIntoView({behavior:'smooth'});}
 if(loc)list=list.filter(v=>(v.locality||'').toLowerCase()===loc.toLowerCase());
 if(mi!=='')list=list.filter(MOODS[+mi].f);
 if(q){const tokens=q.toLowerCase().split(/\s+/).filter(x=>!['in','near','the','a','for'].includes(x));list=list.filter(v=>tokens.every(w=>(v.name+' '+v.category+' '+(v.tagline||'')+' '+(v.locality||'')).toLowerCase().includes(w)))}
 renderEdit(list,q||loc||mi!==''?'Matching your search':null);
}
const sf=$('pt-search');if(sf)sf.onsubmit=e=>{e.preventDefault();applySearch();document.getElementById('edit').scrollIntoView({behavior:'smooth'})};

/* moods */
const mm=$('pt-moods');
if(mm){mm.innerHTML=MOODS.map((m,i)=>'<button class="pt-mood pt-mood-photo" data-i="'+i+'" type="button"><img src="'+m.img+'" alt="" loading="lazy" width="640" height="800"/><span class="pt-mood-ol"><span class="pt-mood-num">'+String(i+1).padStart(2,'0')+'</span><h3>'+esc(m.n)+'</h3><p>'+esc(m.t)+'</p><span class="pt-mood-cats">'+esc(m.c)+'</span></span></button>').join('');
 mm.querySelectorAll('.pt-mood').forEach(b=>b.onclick=()=>{
  mm.querySelectorAll('.pt-mood').forEach(x=>x.classList.remove('on'));b.classList.add('on');
  const m=MOODS[+b.dataset.i];if(moodSel)moodSel.value=b.dataset.i;
  renderEdit(venues.filter(m.f),m.n);document.getElementById('edit').scrollIntoView({behavior:'smooth'});});}

/* edit grid + collections */
let coll='all';
function renderEdit(list,label){
 const g=$('pt-edit-grid');if(!g)return;
 if(coll!=='all'&&!label)list=list.filter(v=>COLLS[coll].test(v.name+' '+(v.tagline||'')+' '+v.category));
 $('pt-edit-count').textContent=(label?label+': ':'')+list.length+' record'+(list.length===1?'':'s')+' from SRCHN listings and labelled source data'+(list.length?'':' - nothing listed here yet');
 g.innerHTML=list.length?list.slice(0,24).map(vCard).join('')+(list.length>24?'<p class="pt-more" style="grid-column:1/-1"><a class="pt-btn pt-btn-ghost" href="/discovery/?category=pulse">SEARCH ALL '+list.length+' MATCHING RECORDS</a></p>':''):'<div class="pt-empty" style="grid-column:1/-1"><p class="pt-empty-big">Nothing listed in this edit yet.</p><p>Venues appear here only from genuine SRCHN listings - never stock grids. Try another edit or ALL.</p></div>';
}
const pc=$('pt-coll');if(pc)pc.querySelectorAll('.pt-chip').forEach(b=>b.onclick=()=>{pc.querySelectorAll('.pt-chip').forEach(x=>x.classList.remove('on'));b.classList.add('on');coll=b.dataset.c;renderEdit(venues.slice())});
renderEdit(venues.slice());

/* beyond the dance floor */
const bg=$('pt-beyond-grid');
if(bg){
 const altCats=['Entertainment','Events and nightlife','Other','Travel and experiences'];
 const alts=venues.filter(v=>altCats.includes(v.category));
 bg.innerHTML=alts.length?alts.map(vCard).join(''):'<div class="pt-empty" style="grid-column:1/-1"><p class="pt-empty-big">Alternative experiences are on their way.</p><p>Karaoke, gaming, bowling, themed nights and workshops will appear here as genuine listings are verified. Tonight, the dance floor and brewery listings above are what Bengaluru has on SRCHN.</p></div>';
}

/* events: tonight filters + weekend tabs */
function dayOff(n){const d=new Date(Date.now()+330*60000+n*86400000);return d.toISOString().slice(0,10)}
function upcomingWeekday(name){const days=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];const want=days.indexOf(name);const now=new Date(Date.now()+330*60000);const cur=now.getUTCDay();let diff=(want-cur+7)%7;return dayOff(diff)}
const DATES={today:dayOff(0),tomorrow:dayOff(1),friday:upcomingWeekday('friday'),saturday:upcomingWeekday('saturday'),sunday:upcomingWeekday('sunday')};
function evtCard(e){
 return '<article class="pt-evt"><h3><a href="/parties/events/'+esc(e.id)+'/">'+esc(e.title)+'</a></h3>'
 +'<p class="pt-evt-line">'+esc([e.venue,e.locality].filter(Boolean).join(' \u00B7 '))+'</p>'
 +'<p class="pt-evt-line">'+esc([e.date,e.time?'from '+e.time:'',e.price,e.category,e.age].filter(Boolean).join(' \u00B7 '))+'</p>'
 +(v.sourceLabel?'<p class="pt-src">'+esc(v.sourceLabel)+'</p>':'')+'<div class="pt-vacts"><a class="pt-vxplr" href="/parties/events/'+esc(e.id)+'/">VIEW EVENT</a>'+(e.booking?'<a class="pt-vbook" href="'+esc(e.booking)+'" rel="noopener nofollow" target="_blank">BOOK TICKETS</a>':'')+'</div>'
 +'<p class="pt-evt-src">Source: '+esc(e.source)+' \u00B7 verified '+esc(e.verified)+'</p></article>';
}
function emptyEvt(txt){return '<div class="pt-empty"><p class="pt-empty-big">No verified events listed for this yet.</p><p>'+txt+'</p><p>We list events only when they verify against a genuine source. While listings build up, discover the venues that make the night:</p></div>'}
function showVenueHint(){return venues.filter(v=>v.club).slice(0,3).map(vCard).join('')}
function renderTonight(f){
 const box=$('pt-events');if(!box)return;
 let list=events.slice();
 if(DATES[f])list=list.filter(e=>e.date===DATES[f]);
 if(f==='near'){box.innerHTML=emptyEvt('Nearby event locations are not verified in this feed. Choose a locality or ask Buddy with an area name.');return}
 if(f==='weekend')list=events.filter(e=>[DATES.friday,DATES.saturday,DATES.sunday].includes(e.date));
 if(f==='free')list=events.filter(e=>/^(?:free(?: entry)?|(?:₹|rs\.?\s*)?0(?:\.00)?(?: entry)?)$/i.test(e.price.trim()));
 if(f==='u500'||f==='u1000'){const cap=f==='u500'?500:1000;list=events.filter(e=>{const m=String(e.price).replace(/[, ]/g,'').match(/\u20B9?(\d+)/);return m&&+m[1]<cap})}
 if(f==='music')list=events.filter(e=>/music|band|concert/i.test(e.category+e.title));
 if(f==='week')list=events.filter(e=>e.date>=dayOff(0)&&e.date<=dayOff(6));
 if(['nightlife','comedy','culture','food','sports'].includes(f)){const terms={nightlife:/night|dj|club|party|brew/i,comedy:/comedy|stand.up|improv/i,culture:/cultur|theatre|theater|art|exhibit|festival/i,food:/food|brunch|dining|tasting/i,sports:/sport|screening|match|run|fitness/i};list=events.filter(e=>terms[f].test(e.category+' '+e.title))}
 if(f==='dj')list=events.filter(e=>/dj|techno|electronic/i.test(e.category+e.title));
 if(f==='live')list=events.filter(e=>/live|band|comedy|show/i.test(e.category+e.title));
 if(f==='social')list=events.filter(e=>/mixer|social|quiz|meetup/i.test(e.category+e.title));
 box.innerHTML=list.length?list.map(evtCard).join(''):emptyEvt('Nothing verified for this filter yet.')+(list.length?'':showVenueHint());
}
const tf=$('pt-tonight-f');if(tf)tf.querySelectorAll('.pt-chip').forEach(b=>b.onclick=()=>{tf.querySelectorAll('.pt-chip').forEach(x=>x.classList.remove('on'));b.classList.add('on');renderTonight(b.dataset.f)});
renderTonight('today');
for(const [id,re] of Object.entries({live:/live|music|band|concert|gig/i,culture:/cultur|theatre|theater|art|exhibit|festival|food/i,social:/social|mixer|community|network|founder|meetup/i})){const el=$('pt-editorial-'+id);if(el){const found=events.filter(e=>re.test(e.category+' '+e.title));el.innerHTML=found.length?found.map(evtCard).join(''):emptyEvt('No source-labelled events in this collection yet.')}}
function renderWk(d){
 const box=$('pt-wk');if(!box)return;
 const list=events.filter(e=>e.date===DATES[d]);
 box.innerHTML=list.length?list.map(evtCard).join(''):emptyEvt('No verified '+d.charAt(0).toUpperCase()+d.slice(1)+' events yet ('+DATES[d]+').')+showVenueHint();
}
const wf=$('pt-wk-f');if(wf)wf.querySelectorAll('.pt-chip').forEach(b=>b.onclick=()=>{wf.querySelectorAll('.pt-chip').forEach(x=>x.classList.remove('on'));b.classList.add('on');renderWk(b.dataset.d)});
renderWk('friday');

/* neighbourhood explorer */
function areaCount(a){return venues.filter(v=>(v.locality||'').toLowerCase().replace(/\s/g,'')===a.n.toLowerCase().replace(/\s/g,'')).length}
const al=$('pt-areas-list');
if(al){
 al.innerHTML=AREAS.map((a,i)=>{const n=areaCount(a);return '<button class="pt-area pt-area-photo" data-i="'+i+'" type="button"><img src="'+a.img+'" alt="" loading="lazy" width="640" height="800"/><span class="pt-area-ol"><b>'+esc(a.n)+' <span class="pt-area-n">'+(n?n+' listed':'')+'</span></b><span>'+esc(a.id)+'</span></span></button>'}).join('');
 al.querySelectorAll('.pt-area').forEach(b=>b.onclick=()=>{
  al.querySelectorAll('.pt-area').forEach(x=>x.classList.remove('on'));b.classList.add('on');
  const a=AREAS[+b.dataset.i];
  renderEdit(venues.filter(v=>(v.locality||'').toLowerCase().replace(/\s/g,'')===a.n.toLowerCase().replace(/\s/g,'')),a.n);
  document.getElementById('edit').scrollIntoView({behavior:'smooth'});});
}
/* buddy */
const BUDDY_AREAS=AREAS.map(a=>a.n.toLowerCase());
function buddyAnswer(q){
 const ql=q.toLowerCase();const area=AREAS.find(a=>ql.includes(a.n.toLowerCase()));
 let list=venues.slice(),why=[];
 if(area){list=list.filter(v=>(v.locality||'').toLowerCase().replace(/\s/g,'')===area.n.toLowerCase().replace(/\s/g,''));why.push('in '+area.n)}
 const asksEvents=/tonight|today|tomorrow|weekend|saturday|sunday|friday|happening|event|music|comedy|concert|festival|social|founder|culture/.test(ql);
 if(asksEvents){let es=events.slice();if(area)es=es.filter(e=>(e.locality||'').toLowerCase().includes(area.n.toLowerCase()));
  if(/tonight|today/.test(ql))es=es.filter(e=>e.date===DATES.today);else if(/tomorrow/.test(ql))es=es.filter(e=>e.date===DATES.tomorrow);else if(/weekend/.test(ql))es=es.filter(e=>[DATES.friday,DATES.saturday,DATES.sunday].includes(e.date));else for(const day of ['friday','saturday','sunday'])if(ql.includes(day))es=es.filter(e=>e.date===DATES[day]);
  const interest=/comedy/.test(ql)?/comedy|stand.up|improv/i:/live music|band|gig|concert/.test(ql)?/music|band|gig|concert/i:/festival|culture/.test(ql)?/festival|culture|theatre|exhibit/i:/social|founder|network/.test(ql)?/social|founder|network|meetup|mixer/i:/dj|dance/.test(ql)?/dj|dance|techno|electronic/i:null;if(interest)es=es.filter(e=>interest.test(e.category+' '+e.title));
  const cap=ql.match(/under\s*(?:₹|rs\.?\s*)?([0-9,]+)/);if(cap)es=es.filter(e=>{const m=String(e.price).replace(/,/g,'').match(/^(?:₹|rs\.?\s*)?(\d+(?:\.\d+)?)(?:\s*(?:per person|each|entry))?$/i);return m&&+m[1]<+cap[1].replace(/,/g,'')});
  return {text:es.length?'Matching source-labelled events. Confirm current admission, price and availability with the organiser.':'No source-labelled events match those dates, interests and budget in the current SRCHN feed. I cannot confirm there are no events in Bengaluru. Try the organiser source or browse Pulse venues.',evts:es.slice(0,8),venues:[],why:why.join(', ')};
 }
 if(/roof|terrace|skyline|sunset/.test(ql)){list=list.filter(v=>/roof|terrace|skyline/i.test(v.name+v.tagline));why.push('rooftop source match')}
 if(/brew|beer|craft/.test(ql)){list=list.filter(v=>/brew/i.test(v.category+v.name+v.tagline));why.push('breweries')}
 if(/under|₹|rs\.?|budget|cheap/.test(ql))return {text:'The venue records do not supply verified prices. I cannot guarantee your budget; these are source matches only.',venues:list.slice(0,6),why:why.join(', ')};
 if(/pulse|drink|nightlife|pub|bar/.test(ql))list=list.filter(v=>/pub|bar|brew|club|pulse/i.test(v.category));
 return {text:list.length?'Matching SRCHN records. Source records are not independently verified venues, opening hours or availability.':'No matching records in the current feed. I will not invent venue details.',venues:list.slice(0,6),why:why.join(', ')};
}
const bl=$('pt-buddy-log');
function bMsg(html,me){const d=document.createElement('div');d.className='pt-msg '+(me?'pt-msg-u':'pt-msg-b');d.innerHTML=html;bl.appendChild(d);bl.scrollTop=bl.scrollHeight}
function bRender(r){
 let h=esc(r.text);
 (r.evts||[]).forEach(e=>{h+='<a class="pt-bcard" href="/parties/events/'+esc(e.id)+'/"><b>'+esc(e.title)+'</b><span>'+esc([e.venue,e.locality,e.date,e.time].filter(Boolean).join(' \u00B7 '))+' \u00B7 Source: '+esc(e.source)+' \u00B7 verified '+esc(e.verified)+'</span></a>'});
 (r.venues||[]).forEach(v=>{h+='<a class="pt-bcard" href="'+esc(venueHref(v))+'"><b>'+esc(v.name)+'</b><span>'+esc([v.category,v.locality].filter(Boolean).join(' \u00B7 '))+' \u00B7 '+esc(v.sourceLabel||'SRCHN listing')+'</span></a>'});
 h+='<span style="display:block;margin-top:8px;font-size:11.5px;color:var(--tx3)">Source: SRCHN event and place records \u00B7 '+new Date(Date.now()+330*60000).toISOString().slice(0,10)+' \u00B7 bookings confirm only with the venue or organiser</span>';
 bMsg(h,false);
}
if(bl){
 const bp=$('pt-buddy-prompts');
 PROMPTS.forEach(p=>{const b=document.createElement('button');b.type='button';b.textContent=p;b.onclick=()=>{bMsg(esc(p),true);bRender(buddyAnswer(p))};bp.appendChild(b)});
 $('pt-buddy-f').onsubmit=e=>{e.preventDefault();const inp=$('pt-buddy-q');const q=inp.value.trim();if(!q)return;inp.value='';bMsg(esc(q),true);bRender(buddyAnswer(q))};
}

/* plan your night */
const PLAN_STOPS=[{t:'7:00 PM',l:'Dinner - suggested time'},{t:'8:30 PM',l:'Rooftop or brewery - suggested time'},{t:'10:00 PM',l:'Live music or DJ - suggested time'}];
const pp=$('pt-plan');
function stopRow(st){
 const d=document.createElement('div');d.className='pt-stop';
 d.innerHTML='<div><b>'+esc(st.t)+'</b><small>'+esc(st.l)+'</small></div><select>'+'<option value="">Choose a venue...</option>'+venues.map(v=>'<option value="'+esc(v.slug)+'">'+esc(v.name)+(v.locality?' \u00B7 '+esc(v.locality):'')+'</option>').join('')+'</select><button type="button" aria-label="Remove stop">\u00D7</button>';
 d.querySelector('button').onclick=()=>{if(pp.children.length>1)d.remove()};
 return d;
}
if(pp){
 PLAN_STOPS.forEach(st=>pp.appendChild(stopRow(st)));
 $('pt-plan-add').onclick=()=>{const h=19+pp.children.length;pp.appendChild(stopRow({t:String(Math.min(h,23))+':00',l:'Suggested time'}))};
 $('pt-plan-save').onclick=()=>{const plan=[...pp.querySelectorAll('.pt-stop')].map(r=>({t:r.querySelector('b').textContent,v:r.querySelector('select').value}));try{localStorage.setItem('srchn_night_plan',JSON.stringify(plan));$('pt-plan-msg').textContent='Saved on this device.'}catch(e){$('pt-plan-msg').textContent='Could not save on this device.'}};
 $('pt-plan-share').onclick=()=>{
  const rows=[...pp.querySelectorAll('.pt-stop')].map(r=>({t:r.querySelector('b').textContent,l:r.querySelector('small').textContent,v:r.querySelector('select').value}));
  const named=rows.filter(r=>r.v);
  if(!named.length){$('pt-plan-msg').textContent='Pick at least one venue first.';return}
  const txt='My SRCHN night plan (suggested timings):\n'+named.map(r=>'- '+r.t+' - '+r.v).join('\n')+'\nPlanned on srchn.in/parties/';
  if(navigator.clipboard)navigator.clipboard.writeText(txt).then(()=>{$('pt-plan-msg').textContent='Plan copied - paste it anywhere to share.'},()=>{$('pt-plan-msg').textContent=txt});
  else $('pt-plan-msg').textContent=txt;
 };
 try{const saved=JSON.parse(localStorage.getItem('srchn_night_plan')||'null');if(saved&&saved.length){pp.innerHTML='';saved.forEach(r=>{const row=stopRow({t:r.t,l:'Suggested time'});if(venues.some(v=>v.slug===r.v))row.querySelector('select').value=r.v;pp.appendChild(row)});$('pt-plan-msg').textContent='Restored your saved plan.'}}catch(e){}
}

fetch('/discovery/data.json').then(r=>r.json()).then(d=>{const known=new Set(venues.filter(v=>v.recordId).map(v=>v.recordId));for(const r of d.records.filter(r=>r.subcategories.some(s=>s.startsWith('pulse|')))){const key=r.id;if(known.has(key))continue;known.add(key);venues.push({id:r.id,recordId:r.id,slug:'source:'+r.id,name:r.name,category:r.subcategories.filter(s=>s.startsWith('pulse|')).map(s=>s.split('|')[1]).join(', '),tagline:'',locality:r.neighbourhood||'',lat:r.lat,lon:r.lon,club:false,sourceLabel:'OpenStreetMap source record - not independently verified'})}renderEdit(venues.slice());const names=[...new Set(venues.map(v=>v.locality).filter(Boolean))].sort();if($('pt-loc'))for(const name of names)if(![...$('pt-loc').options].some(o=>o.value===name)){const op=document.createElement('option');op.textContent=name;$('pt-loc').appendChild(op)}if(pp){for(const select of pp.querySelectorAll('select')){const old=select.value;select.innerHTML='<option value="">Choose a venue...</option>'+venues.map(v=>'<option value="'+esc(v.slug)+'">'+esc(v.name)+(v.locality?' · '+esc(v.locality):'')+(v.sourceLabel?' (source record)':'')+'</option>').join('');select.value=old}}}).catch(()=>{});

})();

/* Pulse reuses source records by ID. No copies or production writes. */
(()=>{const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const box=document.getElementById('pt-beverage-grid');if(!box)return;fetch('/discovery/data.json').then(r=>r.json()).then(d=>{const rows=d.records.filter(r=>r.subcategories.some(s=>s.startsWith('pulse|')));document.getElementById('pt-beverage-count').textContent=rows.length+' unique source records in PULSE. No new or duplicate business records created.';document.getElementById('pt-beverage-categories').innerHTML=d.taxonomy.pulse.map(s=>'<a class="pt-chip" href="/discovery/?category=pulse&sub='+encodeURIComponent(s)+'">'+esc(s)+' ('+(d.counts['pulse|'+s]||0)+')</a>').join('');box.innerHTML=rows.slice(0,6).map(r=>'<article class="pt-vcard"><p class="pt-vmeta">SOURCE RECORD</p><h3>'+esc(r.name)+'</h3><p>'+esc(r.neighbourhood||r.address||'Bengaluru source record')+'</p><div class="pt-vacts"><a href="/discovery/place/?id='+encodeURIComponent(r.id)+'">VIEW PLACE</a><a href="https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(r.lat+','+r.lon)+'" target="_blank" rel="noopener">VISIT</a><a href="/parties/demo/#book" data-city-book="'+esc(r.name)+'" data-city-category="pulse">BOOK DEMO</a><button data-demo-open="pay" data-brand="'+esc(r.name)+'">PAY DEMO</button></div></article>').join('')}).catch(()=>document.getElementById('pt-beverage-count').textContent='Source records could not load. Open Search all Pulse venues to try again.')})();
