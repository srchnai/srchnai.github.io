/* SRCHN city search. MIT licensed application code. See README.md for data licenses. */
const $ = s => document.querySelector(s);
const state = { places: null, controller: null, run: 0, voices: [], spoken: '', recognition: null };
const languages = {en:'Bangalore',kn:'ಬೆಂಗಳೂರು',hi:'बेंगलुरु',ta:'பெங்களூர்',te:'బెంగళూరు',ml:'ബെംഗളൂരു',mr:'बंगळूर',bn:'বেঙ্গালুরু',ur:'بنگلور',fr:'Bangalore',de:'Bangalore',es:'Bangalore',ja:'ベンガルール'};
const norm = s => s.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{M}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim();
const groups = [
 ['cafes',['cafe','cafes','coffee','ಕಾಫಿ','ಕೆಫೆ','कैफे','कॉफी','காபி','కాఫీ']],
 ['restaurants',['restaurant','restaurants','food','eat','ಊಟ','ರೆಸ್ಟೋರೆಂಟ್','खाना','रेस्तरां','உணவு','భోజనం']],
 ['bookstores',['bookstore','bookstores','books','bookshop','ಪುಸ್ತಕ','किताब','புத்தகம்']],
 ['hotels',['hotel','hotels','stay','ಹೋಟೆಲ್','होटल']],
 ['coworking',['coworking','workspace','workspaces']],
 ['malls',['mall','malls','shopping mall']],
 ['fitness',['gym','gyms','fitness']],
 ['supermarkets',['supermarket','supermarkets','groceries']],
 ['co-living',['coliving','co living','pg']],
 ['gaming',['gaming','games']],
 ['breweries',['brewery','breweries']],
 ['pubs-bars',['pub','pubs','bar','bars']]
];
const stops = new Set('where is are the a an i me my find show please places place in near around to of for and with bangalore bengaluru best good can you some visit new here settled open now today'.split(' '));
const areaAliases = [['ಇಂದಿರಾನಗರ','indiranagar'],['इंदिरानगर','indiranagar'],['இந்திராநகர்','indiranagar'],['ಕೋರಮಂಗಲ','koramangala'],['कोरमंगला','koramangala'],['ಜಯನಗರ','jayanagar'],['ಜಯನಗರದಲ್ಲಿ','jayanagar'],['व्हाइटफील्ड','whitefield'],['ವೈಟ್ ಫೀಲ್ಡ್','whitefield']];
function node(tag,text,cls){const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;}
function link(label,url){const a=node('a',label);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;}
function label(text,parent){parent.append(node('div',text,'section-label'));}
function lang(){const o=$('#language').selectedOptions[0];return {code:o.dataset.wiki,speech:o.value,city:languages[o.dataset.wiki]};}
function safeURL(raw){try{const u=new URL(raw);return u.protocol==='https:'?u.href:null;}catch{return null;}}
async function loadPlaces(){if(!state.places){const r=await fetch('./city/places.json');if(!r.ok)throw Error('Place index unavailable');state.places=await r.json();}return state.places;}
export function matchPlaces(query,rows){
 let q=norm(query);if(/^(hi|hello|hey|thanks|thank you)$/.test(q))return [];for(const [from,to] of areaAliases)q=q.replaceAll(from,to);
 const chosen=groups.filter(([,words])=>words.some(w=>new RegExp('(^|\\s)'+w+'($|\\s)','u').test(q)));
 for(const [,words] of chosen)for(const w of words)q=q.replace(new RegExp('(^|\\s)'+w+'(?=$|\\s)','gu'),' ');
 const tokens=q.split(/\s+/).filter(t=>t.length>1&&!stops.has(t));
 if(!tokens.length&&!chosen.length)return [];
 const seen=new Set(),out=[];
 for(const r of rows){
  if(seen.has(r.id))continue;
  if(chosen.length&&!chosen.some(([cat])=>r.category===cat))continue;
  const hay=norm(r.name+' '+r.area);
  if(tokens.length&&!tokens.every(t=>hay.includes(t)))continue;
  seen.add(r.id);out.push({...r,score:tokens.reduce((n,t)=>n+(norm(r.name).includes(t)?2:1),0)});
 }
 return out.sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name)).slice(0,8);
}
async function wiki(query,signal){
 const l=lang();let text=query;
 // Place/category searches use the place index, not weak encyclopedia associations.
 if(groups.some(([,words])=>words.some(w=>(' '+norm(query)+' ').includes(' '+w+' '))))return [];
 if(/^(hi|hello|hey|thanks|thank you)$/i.test(query.trim()))return [];

 let preferred='';
 if(l.code==='en'&&/^places to visit( in)?( bangalore| bengaluru)?$/i.test(query)){text='intitle:"List of tourist attractions in Bengaluru"';preferred='List of tourist attractions in Bengaluru';}
 if(l.code==='en'&&/^(bangalore|bengaluru) history$|^history of (bangalore|bengaluru)$/i.test(query)){text='intitle:"History of Bengaluru"';preferred='History of Bengaluru';}
 if(l.code==='en'&&/^(bangalore|bengaluru|namma) metro$/i.test(query)){text='intitle:"Namma Metro"';preferred='Namma Metro';}

 const p=new URLSearchParams({action:'query',generator:'search',gsrsearch:preferred?text:text+' '+l.city,gsrlimit:'6',gsrnamespace:'0',prop:'extracts|info',exintro:'1',explaintext:'1',exsentences:'4',inprop:'url',format:'json',origin:'*'});
 const r=await fetch(`https://${l.code}.wikipedia.org/w/api.php?${p}`,{signal,credentials:'omit'});if(!r.ok)throw Error('Wikipedia unavailable');
 const data=await r.json();if(data.error)throw Error('Wikipedia unavailable');
 const local=/bangalore|bengaluru|bengalour|ಬೆಂಗಳೂರು|बेंगल|बंगल|பெங்கள|பெங்க|బెంగళ|ബെംഗ|ബാംഗ|বেঙ্গাল|بنگلور|بنگلورو|ベンガル|バンガロ|бенгалур|бангалор/i;
 const tokens=norm(query).split(' ').filter(t=>t.length>2&&!stops.has(t));
 return Object.values(data.query?.pages||{}).filter(p=>(!preferred||p.title===preferred)&&(!tokens.length||preferred||tokens.some(t=>norm(p.title).includes(t)))&&p.extract&&local.test(p.title+' '+p.extract)&&safeURL(p.fullurl)).sort((a,b)=>a.index-b.index).slice(0,3);
}
function renderPlaces(hits){const container=$('#places');if(!hits.length)return;
 label('PLACES / OPEN-DATA MATCHES',container);
 container.append(node('p','Matches, not recommendations or a distance ranking. Names, addresses and coordinates may be incomplete. Check details before visiting.','muted'));
 for(const r of hits){const art=node('article');art.append(node('p',r.category.replaceAll('-',' ')+' · '+(r.area||'Bengaluru')+' · snapshot, not live','meta'),node('h3',r.name));
 const ls=node('div',null,'links');ls.append(link('Find on OpenStreetMap ↗',`https://www.openstreetmap.org/?mlat=${r.lat}&mlon=${r.lon}#map=18/${r.lat}/${r.lon}`));
 if(r.id.startsWith('osm:'))ls.append(link('Original OSM record ↗','https://www.openstreetmap.org/'+r.id.slice(4)));
 art.append(ls);container.append(art);}
}
function renderKnowledge(pages){const container=$('#knowledge');if(!pages.length)return;
 label('CITY INFORMATION / WIKIPEDIA EXCERPTS',container);
 container.append(node('p','Source excerpts, not generated answers. Retrieved '+new Date().toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})+'. Retrieval time does not verify the facts are current.','muted'));
 for(const p of pages){const art=node('article');art.append(node('h3',p.title),node('p',p.extract),link('Read source & contributors ↗',p.fullurl));container.append(art);}
}
async function search(query){
 if(/\b(porn|nude|nudes|rape|harass|kill|murder|bomb|steal|theft|buy drugs|illegal drugs|sexual)\b/i.test(query)){ $('#results').hidden=false;$('#result-title').textContent='City discovery only';$('#summary').textContent='This preview does not help with sexual content, harassment or wrongdoing. Try a Bangalore place, neighbourhood or city topic.';for(const id of ['#knowledge','#places','#next'])$(id).replaceChildren();$('#read').hidden=true;return;}
 const run=++state.run;state.controller?.abort();state.controller=new AbortController();const controller=state.controller;const timer=setTimeout(()=>controller.abort(),14000);
 window.speechSynthesis?.cancel();$('#query').value=query;$('#results').hidden=false;$('#result-title').textContent=query;$('#summary').textContent='Searching open place records and sourced city information...';
 for(const s of ['#knowledge','#places','#next'])$(s).replaceChildren();$('#read').hidden=true;$('#status').textContent='Searching Bangalore...';$('#submit').disabled=true;
 const [places,knowledge]=await Promise.allSettled([loadPlaces().then(rows=>matchPlaces(query,rows)),wiki(query,controller.signal)]);clearTimeout(timer);if(run!==state.run)return;
 $('#submit').disabled=false;
 const hits=places.status==='fulfilled'?places.value:[],pages=knowledge.status==='fulfilled'?knowledge.value:[];
 renderKnowledge(pages);renderPlaces(hits);
 $('#summary').textContent=`${hits.length} place matches · ${pages.length} city source excerpts. Source search, not an AI-generated answer.`;
 if(!hits.length&&!pages.length)$('#next').append(node('p','No reliable match found in these sources. Try a place name, neighbourhood, category or city topic. For languages with sparse source coverage, try English. This preview will not invent an answer.','notice'));
 if(places.status==='rejected')$('#next').append(node('p','The place index could not load. City excerpts are shown independently. Try again later.','notice'));
 if(knowledge.status==='rejected')$('#next').append(node('p','Wikipedia could not be reached in time. Local place matches still work; no AI fallback or invented answer has been used.','notice'));
 if(/open now|today|tonight|price|cost|fare|safe|hours|timing|available|weather|traffic/i.test(query))$('#next').append(node('p','This search cannot confirm current hours, prices, safety or availability. Check the official provider or contact the place before travelling.','notice'));
 state.spoken=pages.map(p=>p.title+'. '+p.extract).join('\n')||hits.map(r=>r.name+'. '+r.area).join('\n');$('#read').hidden=!state.spoken||!('speechSynthesis'in window);
 $('#status').textContent='Search complete. Follow the source before making plans.';
 $('#results').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
}
$('#search-form').addEventListener('submit',e=>{e.preventDefault();const q=$('#query').value.trim();if(q)search(q);});
document.querySelectorAll('[data-query]').forEach(b=>b.addEventListener('click',()=>search(b.dataset.query)));
$('#settings-toggle').addEventListener('click',()=>{const open=$('#settings').hidden;$('#settings').hidden=!open;$('#settings-toggle').setAttribute('aria-expanded',String(open));});
function updateVoices(){if(!('speechSynthesis'in window)){$('#voice').replaceChildren(node('option','Read-aloud is unavailable'));return;}state.voices=speechSynthesis.getVoices();const select=$('#voice');select.replaceChildren(node('option','Automatic matching voice'));select.options[0].value='';for(const [i,v]of state.voices.entries()){const o=node('option',`${v.name} · ${v.lang}${v.localService?' · device':' · service'}`);o.value=String(i);select.append(o);}}
updateVoices();if('speechSynthesis'in window)speechSynthesis.addEventListener('voiceschanged',updateVoices);
$('#read').addEventListener('click',()=>{const l=lang(),selected=$('#voice').value;const voice=selected!==''?state.voices[Number(selected)]:state.voices.find(v=>v.lang.toLowerCase().startsWith(l.speech.split('-')[0]));if(!voice){$('#status').textContent='No matching read-aloud voice is available on this device. Try another installed voice in Language & voice.';return;}speechSynthesis.cancel();const utter=new SpeechSynthesisUtterance(state.spoken);utter.voice=voice;utter.lang=voice.lang;utter.onerror=()=>$('#status').textContent='Read-aloud was interrupted or unavailable.';speechSynthesis.speak(utter);});
$('#language').addEventListener('change',()=>{document.documentElement.lang=lang().code;$('#status').textContent='Source language changed. Search again for excerpts in this language. Place names are not automatically translated.';window.speechSynthesis?.cancel();});
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
$('#mic').addEventListener('click',()=>{
 if(!SR){$('#status').textContent='Talk is not supported by this browser. Type your question instead.';return;}
 if(state.recognition){state.recognition.stop();return;}
 if(!$('#speech-consent').checked){$('#settings').hidden=false;$('#settings-toggle').setAttribute('aria-expanded','true');$('#status').textContent='Before using Talk, review the browser speech disclosure and opt in below.';$('#speech-consent').focus();return;}
 const r=new SR();state.recognition=r;r.lang=lang().speech;r.interimResults=false;r.continuous=false;
 r.onstart=()=>{$('#mic').classList.add('listening');$('#mic').setAttribute('aria-label','Stop listening');$('#status').textContent='Listening through your browser speech service. Tap the mic to stop.';};
 r.onresult=e=>{$('#query').value=e.results[0][0].transcript;$('#status').textContent='Check the recognised words, then tap Search. Nothing has been searched yet.';};
 r.onerror=e=>{$('#status').textContent=e.error==='not-allowed'?'Microphone permission was denied. Typing still works.':'Speech recognition is unavailable or did not hear you. Try typing instead.';};
 r.onend=()=>{state.recognition=null;$('#mic').classList.remove('listening');$('#mic').setAttribute('aria-label','Talk about Bangalore');};
 try{r.start();}catch{state.recognition=null;$('#status').textContent='Speech could not start. Type instead.';}
});
window.addEventListener('pagehide',()=>{state.recognition?.abort();window.speechSynthesis?.cancel();});
