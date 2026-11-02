/* Shared import validator, mirrored from review/discovery/validation.mjs. */
const kinds=['category','subcategory','place','image','description','translation','audio','merge','source'];
const fields=['title','place_id','category_id','subcategory_id','description','original_language','language','text','translation_status','source_url','licence','attribution','licence_url','author','rights_evidence','photo_url','audio_url','voice','coordinate_source','lat','lon','address','neighbourhood','website','phone','opening_hours','amenities','event_start','event_end','merge_into','reason'];
const present=x=>typeof x==='string'&&x.trim().length>0;
const https=v=>{try{let u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password}catch{return false}};
function validate(x){
 let errors=[];if(!x||typeof x!=='object'||Array.isArray(x))return ['Proposal must be an object.'];
 if(Object.keys(x).some(k=>!['id','kind','payload','status'].includes(k)))errors.push('Unknown proposal field.');
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(x.id||''))errors.push('A lowercase UUID is required.');
 if(!kinds.includes(x.kind))errors.push('Unsupported record kind.');
 let p=x.payload;if(!p||typeof p!=='object'||Array.isArray(p))return [...errors,'Payload must be an object.'];
 if(JSON.stringify(x).length>16000)errors.push('Proposal exceeds 16KB.');
 if(Object.keys(p).some(k=>!fields.includes(k)))errors.push('Unknown payload field.');
 for(let [k,v]of Object.entries(p)){if(typeof v!=='string'&&typeof v!=='number'&&v!==null)errors.push(k+': only text, numbers or null.');if(typeof v==='number'&&!Number.isFinite(v))errors.push(k+': invalid number.');if(typeof v==='string'&&(v.length>4000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v)))errors.push(k+': text too long or contains control characters.');if(k.endsWith('_url')&&v&&!https(v))errors.push(k+': use an HTTPS URL without credentials.');}
 for(let k of ['title','source_url','licence','attribution'])if(!present(p[k]))errors.push(k+' is required for import.');
 if(x.kind==='translation'&&(!['en-IN','hi-IN','kn-IN','ta-IN','te-IN','ml-IN','tcy'].includes(p.language)||!present(p.place_id)||!present(p.text)))errors.push('Translation needs place, supported language and text.');
 if(x.kind==='image'&&(!present(p.photo_url)||!present(p.author)||!present(p.rights_evidence)))errors.push('Image needs URL, author and rights evidence.');
 if(x.kind==='audio'&&(!present(p.audio_url)||!present(p.voice)||!present(p.place_id)))errors.push('Audio needs place, voice and permitted recording URL.');
 if(x.kind==='merge'&&(!present(p.place_id)||!present(p.merge_into)||p.place_id===p.merge_into||!present(p.reason)))errors.push('Merge needs two different IDs and a reason.');
 if(x.kind==='place'&&(p.lat!==undefined||p.lon!==undefined)&&(!Number.isFinite(p.lat)||!Number.isFinite(p.lon)||Math.abs(p.lat)>90||Math.abs(p.lon)>180||!present(p.coordinate_source)))errors.push('Coordinates need valid latitude, longitude and evidence.');
 return [...new Set(errors)];
}
function preflight(rows){if(!Array.isArray(rows)||!rows.length||rows.length>100)throw Error('Use an array of 1 to 100 proposals.');let seen=new Set();return rows.map((x,i)=>{let errors=validate(x);if(seen.has(x?.id))errors.push('Duplicate UUID in this file.');seen.add(x?.id);return {row:i+1,proposal:x,errors}})}

/* MIT. Prepared only, not deployed. Preview record review, never brand approval. */
const enc=new TextEncoder();
const hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(s))),x=>x.toString(16).padStart(2,'0')).join('');
const JSONR=(v,s=200,cookie)=>new Response(JSON.stringify(v),{status:s,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...(cookie?{'Set-Cookie':cookie}:{})}});
const cookie=(v,max)=>`__Secure-srchn_review=${v}; Path=/review/; HttpOnly; Secure; SameSite=Strict; Max-Age=${max}`;
const token=r=>(r.headers.get('Cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('__Secure-srchn_review='))?.slice(22)||'';
const randomHex=n=>Array.from(crypto.getRandomValues(new Uint8Array(n)),x=>x.toString(16).padStart(2,'0')).join('');
const uuid=s=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s);
async function auth(r,db,now){const t=token(r);if(!/^[a-f0-9]{64}$/.test(t))return null;return db.prepare("SELECT s.email FROM sessions s JOIN reviewers r ON r.email=s.email WHERE s.digest=? AND s.kind='session' AND s.expires>?").bind(await hash(t),now).first();}
// Read-only preview: no save, approval, dataset write or publishing action.
function stablePreview(x){if(Array.isArray(x))return '['+x.map(stablePreview).join(',')+']';if(x!==null&&typeof x==='object')return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+stablePreview(x[k])).join(',')+'}';return JSON.stringify(x)}
async function previewSnapshot(request,env){
 const origin=new URL(request.url).origin;
 const [dr,er]=await Promise.all(['/discovery/data.json','/discovery/official-fact-evidence.json'].map(p=>env.ASSETS.fetch(new Request(origin+p))));
 if(!dr.ok||!er.ok)throw Error('Source snapshot unavailable');
 const raw=await dr.text(),eRaw=await er.text(),data=JSON.parse(raw),evidence=JSON.parse(eRaw);
 if(!Array.isArray(data.records)||!Array.isArray(evidence)||evidence.length!==8)throw Error('Unsupported snapshot shape');
 const snapshot_hash=await hash(raw+'\n'+eRaw),records=[];const ids=new Set();
 for(const r of data.records){if(ids.has(r.id))throw Error('Duplicate source ID');ids.add(r.id)}
 for(const e of evidence){const r=data.records.find(x=>x.id===e.place_id);
  if(!r||!r.id.startsWith('official-')||r.verified!==false||r.photo!==null||stablePreview(e.evidence)!==stablePreview(r.factEvidence)||e.name!==r.name||r.sourceUrl!==e.evidence.sourceUrl||!e.evidence.checkedAt||!e.evidence.facts?.length||!e.description||Object.values(r.translations||{}).some(t=>t.audioStatus!=='not generated'))throw Error('Unbound or unsupported evidence');
  records.push({id:r.id,name:r.name,description:r.description,record_hash:await hash(stablePreview(r)),evidence_hash:await hash(stablePreview(e)),evidence_description:e.description,source_url:e.evidence.sourceUrl,checked_at:e.evidence.checkedAt,source_level:e.evidence.level,english_text:r.translations?.['en-IN']?.text||''});
 }
 return {snapshot_hash,records,public_records:data.records.length,published:false,read_only:true};
}
async function descriptionPreviewRoute(request,env,db,now){
 const s=await auth(request,db,now);if(!s)return JSONR({error:'Reviewer sign-in required.'},401);if(s.email!=='hi@srchn.in')return JSONR({error:'Private owner access only.'},403);
 if(!['GET','POST'].includes(request.method))return JSONR({error:'GET or POST required.'},405);
 let snapshot;try{snapshot=await previewSnapshot(request,env)}catch{return JSONR({error:'Snapshot validation failed. Nothing was changed.'},503)}
 if(request.method==='GET')return JSONR(snapshot);
 const reader=request.body?.getReader();if(!reader)return JSONR({error:'JSON body required.'},400);let chunks=[],size=0;for(;;){let {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>16000){await reader.cancel();return JSONR({error:'Preview limit is 16KB.'},413)}chunks.push(value)}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length}let b;try{b=JSON.parse(new TextDecoder().decode(bytes))}catch{return JSONR({error:'Invalid JSON.'},400)}
 if(!b||typeof b!=='object'||Array.isArray(b)||Object.keys(b).sort().join('|')!==['description','evidence_hash','place_id','record_hash','snapshot_hash'].sort().join('|'))return JSONR({error:'Only a description and exact snapshot references are supported.'},400);
 if(b.snapshot_hash!==snapshot.snapshot_hash)return JSONR({error:'Snapshot changed. Reload before previewing.'},409);
 const r=snapshot.records.find(x=>x.id===b.place_id);if(!r)return JSONR({error:'Only the eight existing source-backed English summaries are supported.'},400);
 if(r.record_hash!==b.record_hash||r.evidence_hash!==b.evidence_hash)return JSONR({error:'Record or evidence changed. Reload before previewing.'},409);
 if(typeof b.description!=='string'||!b.description.trim()||b.description.length>4000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(b.description))return JSONR({error:'Enter 1-4000 characters without control characters.'},400);
 const supported=b.description===r.evidence_description;
 return JSONR({place_id:r.id,name:r.name,before:r.description,proposed:b.description,changed:r.description!==b.description||r.english_text!==b.description,supported,decision:supported?(r.description===b.description&&r.english_text===b.description?'No-op: source-backed text already matches.':'Source-backed difference calculated. Nothing saved or published.'):'Blocked: new wording needs separate source review. Preview does not approve facts.',allowed_fields:['description','translations.en-IN.text'],snapshot_hash:snapshot.snapshot_hash,source_url:r.source_url,checked_at:r.checked_at,published:false,saved:false,independently_verified_added:0,media_added:0,translations_validated:0,audio_added:0});
}


async function pilotSaveRoute(request,env){
 const u=new URL(request.url),p=u.pathname;if(env.REVIEW_ON!=='1'||!env.REVIEWDB)return JSONR({error:'Saved places unavailable.'},503);
 if(!u.hostname.endsWith('.srchn-city-preview.pages.dev'))return JSONR({error:'Preview only.'},403);
 if(request.method!=='GET'&&request.headers.get('Origin')!==u.origin)return JSONR({error:'Origin refused.'},403);
 const db=env.REVIEWDB,now=Math.floor(Date.now()/1000),s=await auth(request,db,now);if(!s)return JSONR({error:'Sign in required.'},401);
 await db.prepare('CREATE TABLE IF NOT EXISTS discovery_saved_places(email TEXT NOT NULL,place_id TEXT NOT NULL,category TEXT NOT NULL,subcategory TEXT NOT NULL,payload TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(email,place_id))').run();
 async function pilotRecord(id){if(!/^[nwr][0-9]+$/.test(id||''))return null;const asset=await env.ASSETS.fetch(new Request(u.origin+'/discovery/cafes/data.json'));if(!asset.ok)return null;const d=await asset.json();const r=(d.records||[]).find(x=>x.id===id);if(!r)return null;return {id:r.id,name:r.name,lat:r.lat,lon:r.lon,address:r.address||null,locality:r.locality,pincode:r.pincode,osmUrl:r.osmUrl,source:r.source,verified:false};}
 if(p==='/discovery/api/pilot/saved'&&request.method==='GET'){const rows=await db.prepare('SELECT place_id,payload,created_at FROM discovery_saved_places WHERE email=? ORDER BY created_at DESC LIMIT 200').bind(s.email).all();return JSONR({saved:(rows.results||[]).map(r=>{let x;try{x=JSON.parse(r.payload)}catch{x={}};return {place_id:r.place_id,...x,created_at:r.created_at}})});}
 if(p==='/discovery/api/pilot/save'&&['POST','DELETE'].includes(request.method)){
  const raw=await request.text();if(raw.length>2048)return JSONR({error:'Too large.'},413);let b;try{b=JSON.parse(raw)}catch{return JSONR({error:'Invalid JSON.'},400)};const r=await pilotRecord(String(b.place_id||''));if(!r)return JSONR({error:'Choose a cafe from the pilot source data.'},400);
  if(request.method==='DELETE'){const done=await db.prepare('DELETE FROM discovery_saved_places WHERE email=? AND place_id=?').bind(s.email,r.id).run();return JSONR({saved:false,deleted:(done.meta&&done.meta.changes)||0});}
  const done=await db.prepare('INSERT INTO discovery_saved_places(email,place_id,category,subcategory,payload,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(email,place_id) DO NOTHING').bind(s.email,r.id,'eat','Cafés',JSON.stringify(r),Date.now()).run();const changes=(done.meta&&done.meta.changes)||0;return JSONR({saved:true,duplicate:changes===0,place:r});
 }
 return JSONR({error:'Not found.'},404);
}

async function reviewRoute(request,env){
 const u=new URL(request.url),p=u.pathname;
 // Code cannot turn on merely because a browser supplied a role or email.
 if(env.REVIEW_ON!=='1'||!env.REVIEWDB||!env.BUDGETDB||!env.REVIEWMAIL)return JSONR({error:'Review is not available.'},503);
 const db=env.REVIEWDB,now=Math.floor(Date.now()/1000);
 if(!u.hostname.endsWith('.srchn-city-preview.pages.dev'))return JSONR({error:'Preview only.'},403);
 if(request.method!=='GET'&&request.headers.get('Origin')!==u.origin)return JSONR({error:'Origin refused.'},403);
 if(p==='/review/api/discovery-admin-preview')return descriptionPreviewRoute(request,env,db,now);
 await db.prepare('DELETE FROM sessions WHERE expires<=?').bind(now).run();
 if(p==='/review/api/me'&&request.method==='GET'){const s=await auth(request,db,now);return JSONR({signed_in:!!s,role:s?'reviewer':null});}
 if(p==='/review/api/logout'&&request.method==='POST'){const t=token(request);if(t)await db.prepare('DELETE FROM sessions WHERE digest=?').bind(await hash(t)).run();return JSONR({signed_out:true},200,cookie('',0));}
 if(p==='/review/api/request'&&request.method==='POST'){
  let raw=await request.text();if(raw.length>1024)return JSONR({error:'Too large.'},413);let b;try{b=JSON.parse(raw)}catch{return JSONR({error:'Bad request.'},400)}
  const email=typeof b.email==='string'?b.email.trim().toLowerCase():'';
  const allowed=await db.prepare("SELECT email FROM reviewers WHERE email=? AND role='reviewer'").bind(email).first();
  if(!allowed)return JSONR({message:'If this address has reviewer access, a code can be sent.'});
  const k='otp:'+email,previous=await db.prepare('SELECT requested_at FROM sessions WHERE digest=?').bind(k).first();
  if(previous&&previous.requested_at>now-60)return JSONR({error:'Wait one minute before another code.'},429);
  // Rejection sampling, no modulo bias.
  const a=new Uint32Array(1);do{crypto.getRandomValues(a)}while(a[0]>=4294000000);const code=String(a[0]%1000000).padStart(6,'0');
  const nonce=randomHex(16),dig=nonce+':'+await hash(nonce+':'+code+':'+email);
  const reserved=await db.prepare("INSERT INTO sessions(digest,email,kind,expires,attempts,requested_at,code_digest) VALUES(?,?,'otp',?,0,?,?) ON CONFLICT(digest) DO UPDATE SET email=excluded.email,expires=excluded.expires,attempts=0,requested_at=excluded.requested_at,code_digest=excluded.code_digest WHERE sessions.requested_at<=? RETURNING email").bind(k,email,now+600,now,dig,now-60).first();
  if(!reserved)return JSONR({error:'Wait one minute before another code.'},429);
  const day=new Date(now*1000).toISOString().slice(0,10);
  // EXACT same table and binding as guide, not an extra five/day allowance.
  const budget=await env.BUDGETDB.prepare('INSERT INTO preview_mail_budget(key,count) VALUES(?,1) ON CONFLICT(key) DO UPDATE SET count=count+1 WHERE count<5 RETURNING count').bind(day).first();
  if(!budget){await db.prepare('DELETE FROM sessions WHERE digest=? AND requested_at=?').bind(k,now).run();return JSONR({error:'Daily preview email allowance reached.'},429)}
  const sent=await env.REVIEWMAIL.fetch(new Request('https://srchn-inference.internal/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({task:'smtp_review',to:email,code})}));
  if(!sent.ok){await db.prepare('DELETE FROM sessions WHERE digest=? AND requested_at=?').bind(k,now).run();return JSONR({error:'Email unavailable.'},503)}
  return JSONR({message:'Code requested. Check your email.'});
 }
 if(p==='/review/api/verify'&&request.method==='POST'){
  const raw=await request.text();if(raw.length>1024)return JSONR({error:'Too large.'},413);let b;try{b=JSON.parse(raw)}catch{return JSONR({error:'Bad request.'},400)}
  const email=String(b.email||'').trim().toLowerCase();if(!/^\d{6}$/.test(b.code||''))return JSONR({error:'Code invalid.'},400);
  const row=await db.prepare("UPDATE sessions SET attempts=attempts+1 WHERE digest=? AND kind='otp' AND expires>? AND attempts<5 AND email IN (SELECT email FROM reviewers) RETURNING code_digest").bind('otp:'+email,now).first();
  if(!row)return JSONR({error:'Code expired or unavailable.'},400);const nonce=row.code_digest.split(':')[0];
  if(row.code_digest!==nonce+':'+await hash(nonce+':'+b.code+':'+email))return JSONR({error:'Code invalid.'},400);
  const used=await db.prepare('DELETE FROM sessions WHERE digest=? AND code_digest=? RETURNING email').bind('otp:'+email,row.code_digest).first();if(!used)return JSONR({error:'Code already used.'},400);
  const t=randomHex(32);await db.prepare("INSERT INTO sessions(digest,email,kind,expires,attempts,requested_at) VALUES(?,?,'session',?,0,?)").bind(await hash(t),email,now+43200,now).run();
  return JSONR({signed_in:true},200,cookie(t,43200));
 }
 const s=await auth(request,db,now);if(!s)return JSONR({error:'Reviewer sign-in required.'},401);
 if(p.startsWith('/review/api/media')&&s.email!=='hi@srchn.in')return JSONR({error:'Private owner access only.'},403);
 if(p==='/review/api/media'&&request.method==='GET'){
  const r=await db.prepare('SELECT id,title,mime,size,credit,rights,created_at,actor FROM private_media ORDER BY created_at DESC LIMIT 100').all();const usage=await db.prepare('SELECT COALESCE(SUM(size),0) AS bytes FROM private_media').first();return JSONR({items:r.results||[],bytes:usage.bytes,limit:20000000,private:true});
 }
 if(p==='/review/api/media-upload'&&request.method==='POST'){
  const length=Number(request.headers.get('Content-Length'));if(length>1010000)return JSONR({error:'Maximum file size is 1 MB.'},413);
  const reader=request.body?.getReader();if(!reader)return JSONR({error:'Empty upload.'},400);const chunks=[];let total=0;for(;;){const part=await reader.read();if(part.done)break;total+=part.value.byteLength;if(total>1010000){await reader.cancel();return JSONR({error:'Maximum file size is 1 MB.'},413)}chunks.push(part.value)}const body=new Uint8Array(total);let offset=0;for(const part of chunks){body.set(part,offset);offset+=part.byteLength}let f;try{f=await new Response(body,{headers:{'Content-Type':request.headers.get('Content-Type')||''}}).formData()}catch{return JSONR({error:'Invalid upload form.'},400)}
  const file=f.get('file'),title=String(f.get('title')||'').trim(),credit=String(f.get('credit')||'').trim(),rights=String(f.get('rights')||'').trim();if(!file||typeof file.arrayBuffer!=='function'||file.size<1||file.size>1000000||!title||title.length>120||!credit||credit.length>500||!rights||rights.length>500||f.get('permission')!=='yes')return JSONR({error:'Choose a file up to 1 MB, title, full credit and rights evidence, and confirm permission.'},400);
  const allowed=['image/jpeg','image/png','image/webp','video/mp4','video/webm'];if(!allowed.includes(file.type))return JSONR({error:'Only JPEG, PNG, WebP, MP4 and WebM are supported. No documents, SVG or executables.'},400);const bytes=await file.arrayBuffer(),a=new Uint8Array(bytes),text=(start,n)=>String.fromCharCode(...a.slice(start,start+n));const good=file.type==='image/jpeg'?a[0]===255&&a[1]===216&&a[2]===255:file.type==='image/png'?a[0]===137&&text(1,3)==='PNG':file.type==='image/webp'?text(0,4)==='RIFF'&&text(8,4)==='WEBP':file.type==='video/mp4'?text(4,4)==='ftyp':a[0]===26&&a[1]===69&&a[2]===223&&a[3]===163;if(!good)return JSONR({error:'File content does not match its media type.'},400);
  if(/[\u0000-\u001f\u007f]/.test(title+credit+rights))return JSONR({error:'Remove control characters.'},400);const id=crypto.randomUUID();const row=await db.prepare('INSERT INTO private_media(id,title,mime,size,bytes,credit,rights,created_at,actor) SELECT ?,?,?,?,?,?,?,?,? WHERE (SELECT COALESCE(SUM(size),0) FROM private_media)+?<=20000000 AND (SELECT count(*) FROM private_media)<100 RETURNING id').bind(id,title,file.type,file.size,bytes,credit,rights,Date.now(),s.email,file.size).first();if(!row)return JSONR({error:'Private media limit reached (20 MB or 100 files). Delete an existing item first.'},409);return JSONR({id,stored:true,private:true,published:false,rights_verified:false});
 }
 if(p==='/review/api/media-file'&&request.method==='GET'){
  const id=u.searchParams.get('id');if(!uuid(id||''))return JSONR({error:'Invalid media reference.'},400);const row=await db.prepare('SELECT mime,bytes FROM private_media WHERE id=?').bind(id).first();if(!row)return JSONR({error:'Media not found.'},404);const bytes=new Uint8Array(row.bytes),headers={'Content-Type':row.mime,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Disposition':'inline','Content-Length':String(bytes.byteLength),'Accept-Ranges':'bytes','Content-Security-Policy':"default-src 'none'; media-src 'self'; sandbox allow-same-origin"};const range=request.headers.get('Range');if(range){const m=/^bytes=(\d*)-(\d*)$/.exec(range);if(!m||(!m[1]&&!m[2]))return new Response(null,{status:416,headers:{...headers,'Content-Range':'bytes */'+bytes.length,'Content-Length':'0'}});let start=m[1]?Number(m[1]):Math.max(0,bytes.length-Number(m[2])),end=m[1]&&m[2]?Math.min(Number(m[2]),bytes.length-1):bytes.length-1;if(start> end||start>=bytes.length)return new Response(null,{status:416,headers:{...headers,'Content-Range':'bytes */'+bytes.length,'Content-Length':'0'}});const part=bytes.slice(start,end+1);return new Response(part,{status:206,headers:{...headers,'Content-Length':String(part.length),'Content-Range':`bytes ${start}-${end}/${bytes.length}`}})}return new Response(bytes,{headers});
 }
 if(p==='/review/api/media-delete'&&request.method==='POST'){
  let b;try{b=await request.json()}catch{return JSONR({error:'Bad request.'},400)}if(!uuid(b.id||''))return JSONR({error:'Invalid reference.'},400);await db.prepare('DELETE FROM private_media WHERE id=?').bind(b.id).run();return JSONR({deleted:true});
 }

 if(p.startsWith('/review/api/discovery-admin')){
  if(s.email!=='hi@srchn.in')return JSONR({error:'Private owner access only.'},403);
  await db.prepare("CREATE TABLE IF NOT EXISTS discovery_editorial(id TEXT PRIMARY KEY,kind TEXT NOT NULL,payload TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',updated_at INTEGER NOT NULL,actor TEXT NOT NULL)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS discovery_editorial_audit(id TEXT PRIMARY KEY,record_id TEXT,action TEXT,actor TEXT,timestamp INTEGER)").run();
  const kinds=['category','subcategory','place','image','description','translation','audio','merge','source'];
  if(p==='/review/api/discovery-admin'&&request.method==='GET'){const rows=await db.prepare('SELECT id,kind,payload,status,updated_at FROM discovery_editorial ORDER BY updated_at DESC LIMIT 500').all();return JSONR({records:rows.results||[],public:false,auto_publish:false})}
  if(p==='/review/api/discovery-admin-import'&&request.method==='POST'){
   const reader=request.body?.getReader();if(!reader)return JSONR({error:'JSON body required.'},400);let chunks=[],size=0;for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>1000000){await reader.cancel();return JSONR({error:'Import limit is 1 MB.'},413)}chunks.push(part.value)}const bytes=new Uint8Array(size);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.byteLength}let rows;try{rows=JSON.parse(new TextDecoder().decode(bytes))}catch{return JSONR({error:'Invalid JSON.'},400)}
   let checked;try{checked=preflight(rows)}catch(e){return JSONR({error:e.message},400)}const invalid=checked.filter(r=>r.errors.length);if(invalid.length)return JSONR({error:'No proposals imported. Correct every rejected row.',rows:invalid.map(r=>({row:r.row,errors:r.errors}))},400);
   const existing=await db.prepare("SELECT id FROM discovery_editorial WHERE id IN (SELECT json_extract(value,'$.id') FROM json_each(?))").bind(JSON.stringify(rows)).all();if(existing.results?.length)return JSONR({error:'No proposals imported. One or more UUIDs already exist. Refresh saved proposals; imports never overwrite them.',existing_ids:existing.results.map(x=>x.id)},409);
   const total=await db.prepare('SELECT count(*) AS n FROM discovery_editorial').first();if(total.n+rows.length>500)return JSONR({error:'No proposals imported. Private editorial limit is 500 records.'},429);
   await db.prepare("CREATE TRIGGER IF NOT EXISTS discovery_editorial_capacity BEFORE INSERT ON discovery_editorial WHEN NOT EXISTS(SELECT 1 FROM discovery_editorial WHERE id=NEW.id) AND (SELECT count(*) FROM discovery_editorial)>=500 BEGIN SELECT RAISE(ABORT,'editorial_capacity'); END").run();
   const time=Date.now(),safe=rows.map(x=>({id:x.id,kind:x.kind,payload:x.payload})),audits=safe.map(x=>({id:crypto.randomUUID(),record_id:x.id}));
   try{await db.batch([db.prepare("INSERT INTO discovery_editorial(id,kind,payload,status,updated_at,actor) SELECT json_extract(value,'$.id'),json_extract(value,'$.kind'),json_extract(value,'$.payload'),'pending',?,? FROM json_each(?)").bind(time,s.email,JSON.stringify(safe)),db.prepare("INSERT INTO discovery_editorial_audit(id,record_id,action,actor,timestamp) SELECT json_extract(value,'$.id'),json_extract(value,'$.record_id'),'import:pending',?,? FROM json_each(?)").bind(s.email,time,JSON.stringify(audits))])}catch{return JSONR({error:'Import not committed. A concurrent edit or storage limit prevented the batch. Refresh before retrying.'},409)}
   return JSONR({imported:safe.length,ids:safe.map(x=>x.id),status:'pending',private:true,published:false,notice:'All proposals saved privately as pending. No public data or merge changed.'},201);
  }
  if(request.method!=='POST')return JSONR({error:'POST required.'},405);
  const raw=await request.text();if(raw.length>16000)return JSONR({error:'Maximum16KB.'},413);let b;try{b=JSON.parse(raw)}catch{return JSONR({error:'Invalid JSON.'},400)}
  if(!uuid(b.id||''))return JSONR({error:'UUID required.'},400);
  if(p==='/review/api/discovery-admin-delete'){await db.batch([db.prepare('DELETE FROM discovery_editorial WHERE id=?').bind(b.id),db.prepare('DELETE FROM discovery_editorial_audit WHERE record_id=?').bind(b.id)]);return JSONR({deleted:true,published:false})}
  if(p!=='/review/api/discovery-admin-save')return JSONR({error:'Not found.'},404);
  if(!kinds.includes(b.kind)||!b.payload||typeof b.payload!=='object'||Array.isArray(b.payload))return JSONR({error:'Valid kind and payload required.'},400);
  const allowed=['title','place_id','category_id','subcategory_id','description','original_language','language','text','translation_status','source_url','licence','attribution','licence_url','author','rights_evidence','photo_url','audio_url','voice','coordinate_source','lat','lon','address','neighbourhood','website','phone','opening_hours','amenities','event_start','event_end','merge_into','reason'];
  if(Object.keys(b.payload).some(k=>!allowed.includes(k)))return JSONR({error:'Unknown payload field.'},400);
  for(const [key,value] of Object.entries(b.payload)){if(typeof value!=='string'&&typeof value!=='number'&&value!==null)return JSONR({error:'Only text, numbers and null values.'},400);if(typeof value==='string'&&(value.length>4000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)))return JSONR({error:'Text too long or control characters.'},400);if(key.endsWith('_url')&&value){try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)throw 0}catch{return JSONR({error:'Source and media URLs must use HTTPS.'},400)}}}
  if(!String(b.payload.title||'').trim())return JSONR({error:'Title required.'},400);
  const status=['pending','changes_requested','approved','rejected','removed'].includes(b.status)?b.status:'pending';
  if(status==='approved'&&(!b.payload.source_url||!b.payload.attribution||!b.payload.licence))return JSONR({error:'Approval requires source URL, licence and attribution.'},400);
  if(b.kind==='translation'&&(!['en-IN','hi-IN','kn-IN','ta-IN','te-IN','ml-IN','tcy'].includes(b.payload.language)||!b.payload.place_id||!b.payload.text))return JSONR({error:'Translation needs place, supported language and text.'},400);
  if(b.kind==='image'&&(!b.payload.photo_url||!b.payload.author||!b.payload.rights_evidence))return JSONR({error:'Image needs URL, author and rights evidence. Private upload remains in media library.'},400);
  if(b.kind==='audio'&&(!b.payload.audio_url||!b.payload.voice||!b.payload.place_id))return JSONR({error:'Audio needs place, voice and permitted recording URL.'},400);
  if(b.kind==='place'&&(b.payload.lat!==undefined||b.payload.lon!==undefined)){if(!Number.isFinite(b.payload.lat)||!Number.isFinite(b.payload.lon)||b.payload.lat< -90||b.payload.lat>90||b.payload.lon< -180||b.payload.lon>180||!b.payload.coordinate_source)return JSONR({error:'Valid coordinates and coordinate evidence required.'},400)}
  if(b.kind==='merge'&&(!String(b.payload.place_id||'').trim()||!String(b.payload.merge_into||'').trim()||b.payload.place_id===b.payload.merge_into||!String(b.payload.reason||'').trim()))return JSONR({error:'Merge needs two different source IDs and an identity-evidence reason.'},400);
  const prior=await db.prepare('SELECT kind FROM discovery_editorial WHERE id=?').bind(b.id).first();if(prior&&prior.kind!==b.kind)return JSONR({error:'Record kind cannot change.'},409);const total=await db.prepare('SELECT count(*) AS n FROM discovery_editorial').first();if(!prior&&total.n>=500)return JSONR({error:'Private editorial limit of 500 records reached.'},429);
  await db.batch([db.prepare('INSERT INTO discovery_editorial(id,kind,payload,status,updated_at,actor) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,payload=excluded.payload,status=excluded.status,updated_at=excluded.updated_at,actor=excluded.actor').bind(b.id,b.kind,JSON.stringify(b.payload),status,Date.now(),s.email),db.prepare('INSERT INTO discovery_editorial_audit VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),b.id,'save:'+status,s.email,Date.now())]);return JSONR({saved:true,id:b.id,status,published:false,notice:'Editorial review only. A reviewed build is required to publish.'});
 }
 if(p==='/review/api/discovery-requests'&&request.method==='GET'){if(s.email!=='hi@srchn.in')return JSONR({error:'Private owner access only.'},403);const r=await db.prepare('SELECT id,category,listing,note,status,created_at FROM discovery_requests ORDER BY created_at DESC LIMIT 100').all();return JSONR({requests:r.results||[],private:true,confirmed:false})}
 if(p==='/review/api/operations'&&request.method==='GET'){
  const rows=await db.prepare('SELECT id,type,payload,status,created_at,updated_at,closed_at FROM private_records ORDER BY updated_at DESC LIMIT 500').all();const history=await db.prepare('SELECT record_id,actor,status,timestamp FROM private_record_history ORDER BY timestamp DESC LIMIT 1000').all();return JSONR({records:rows.results||[],history:history.results||[],private:true,owner:'hi@srchn.in',public:false});
 }
 if(p==='/review/api/operations-save'&&request.method==='POST'){
  const raw=await request.text();if(raw.length>4096)return JSONR({error:'Too large.'},413);let b;try{b=JSON.parse(raw)}catch{return JSONR({error:'Bad request.'},400)}
  const types=['creator','brand','media','referral','takedown'];if(!uuid(b.id||'')||!types.includes(b.type)||!b.payload||typeof b.payload!=='object')return JSONR({error:'Invalid record.'},400);
  const required=['title','description','reference'];const extra={creator:['contact_email','eligibility_evidence','agreement_reference'],brand:['representative_email','authority_evidence','venue_reference','correction_request'],media:['creator_reference','venue_reference','version_label','supersedes_reference','rights_evidence'],referral:['creator_reference','brand_reference','attribution_reference','evidence_reference'],takedown:['affected_reference','reason','resolution_note']}[b.type];const allowed=[...required,...extra];
  if(Object.keys(b.payload).some(k=>!allowed.includes(k))||required.some(k=>typeof b.payload[k]!=='string')||extra.some(k=>b.payload[k]!==undefined&&(typeof b.payload[k]!=='string'||b.payload[k].length>300))||!b.payload.title.trim()||b.payload.title.length>120||b.payload.description.length>1000||b.payload.reference.length>300)return JSONR({error:'Check record fields and lengths.'},400);
  if(extra.filter(k=>k.endsWith('_email')).some(k=>b.payload[k]&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.payload[k])))return JSONR({error:'Check contact email format. A saved email is not identity verification.'},400);
  if(Object.values(b.payload).some(v=>/[\u0000-\u001f\u007f]/.test(v)))return JSONR({error:'Control characters are not allowed.'},400);
  if(b.payload.reference){try{const u=new URL(b.payload.reference);if(u.protocol!=='https:'||u.username||u.password)throw 0}catch{return JSONR({error:'Reference must be HTTPS. Do not include passwords or private access tokens.'},400)}}
  const statuses={creator:['draft','pending_eligibility','invited','archived'],brand:['draft','awaiting_representative','correction_requested','archived'],media:['draft','awaiting_permission','needs_review','archived'],referral:['unverified','disputed','archived'],takedown:['open','in_review','closed']};if(!statuses[b.type].includes(b.status))return JSONR({error:'Unsupported status. Real verification, brand approval, publication and payouts are not enabled.'},400);
  if(b.type==='referral'&&b.payload.reference){const dup=await db.prepare("SELECT id FROM private_records WHERE type='referral' AND json_extract(payload,'$.reference')=? AND id<>?").bind(b.payload.reference,b.id).first();if(dup)return JSONR({error:'This referral reference already has an attribution record. Review it instead of double-attributing.'},409);}
  const old=await db.prepare('SELECT type FROM private_records WHERE id=?').bind(b.id).first();if(old&&old.type!==b.type)return JSONR({error:'Record type cannot change.'},409);
  const count=await db.prepare('SELECT count(*) AS n FROM private_records').first();if(!old&&count.n>=500)return JSONR({error:'Private preview limit500records reached.'},429);
  const time=Date.now(),closed=b.type==='takedown'&&b.status==='closed'?time:null;
  await db.batch([db.prepare('INSERT INTO private_records(id,type,payload,status,created_at,updated_at,closed_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,status=excluded.status,updated_at=excluded.updated_at,closed_at=excluded.closed_at').bind(b.id,b.type,JSON.stringify(b.payload),b.status,time,time,closed),db.prepare('INSERT INTO private_record_history(id,record_id,actor,status,timestamp) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),b.id,s.email,b.status,time)]);
  return JSONR({ok:true,id:b.id,private:true,published:false,brand_approved:false,payout:false});
 }
 if(p==='/review/api/operations-delete'&&request.method==='POST'){
  let b;try{b=await request.json()}catch{return JSONR({error:'Bad request.'},400)}if(!uuid(b.id||''))return JSONR({error:'Invalid reference.'},400);
  await db.batch([db.prepare('DELETE FROM private_record_history WHERE record_id=?').bind(b.id),db.prepare('DELETE FROM private_records WHERE id=?').bind(b.id)]);return JSONR({deleted:true});
 }
 if(p==='/review/api/studio-submit'&&request.method==='POST'){
  const raw=await request.text();if(raw.length>4096)return JSONR({error:'Too large.'},413);
  let b;try{b=JSON.parse(raw)}catch{return JSONR({error:'Bad request.'},400)}
  const fields=['name','address','link','note'];if(fields.some(k=>typeof b[k]!=='string')||!uuid(b.ref||''))return JSONR({error:'Invalid draft reference or fields.'},400);
  if(!b.name.trim()||b.name.length>120||!b.address.trim()||b.address.length>200||b.link.length>200||b.note.length>500||b.permission!==true)return JSONR({error:'Check venue details, media permission and field lengths.'},400);
  if(/[\u0000-\u001f\u007f]/.test(fields.map(k=>b[k]).join(''))||/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|(?:\+?\d[\s().-]?){10,}|\b[A-Z]{5}\d{4}[A-Z]\b/.test([b.name,b.address,b.note].join(' ')))return JSONR({error:'Remove contacts, personal identifiers or control characters.'},400);
  let link;try{link=new URL(b.link);if(link.protocol!=='https:'||link.username||link.password||!link.hostname.includes('.')||/^(localhost|127\.|10\.|192\.168\.|169\.254\.)/i.test(link.hostname))throw 0}catch{return JSONR({error:'Use an existing public HTTPS media reference, not a local file or private URL.'},400)}
  if(!CATS.includes(b.category))return JSONR({error:'Choose a supported venue category.'},400);
  const count=await db.prepare('SELECT count(*) AS n FROM submissions WHERE created_at>?').bind(Date.now()-86400000).first();if(count.n>=100)return JSONR({error:'Daily preview record limit reached.'},429);
  await db.prepare("INSERT OR IGNORE INTO submissions(id,created_at,kind,name,category,address,link,note,status) VALUES(?,?,'studio',?,?,?,?,?,'pending')").bind(b.ref,Date.now(),b.name.trim(),b.category,b.address.trim(),link.href,b.note.trim()).run();
  return JSONR({ok:true,ref:b.ref,preview_only:true,published:false,brand_approved:false,media_uploaded:false});
 }
 if(p==='/review/api/submissions'&&request.method==='GET'){
  const rows=await db.prepare('SELECT id,created_at,kind,name,category,address,link,note,status FROM submissions WHERE created_at>? ORDER BY created_at DESC LIMIT 100').bind(Date.now()-30*86400000).all();return JSONR({submissions:rows.results||[],notice:'Preview records only. No brand approval or publishing.'});
 }
 if(p==='/review/api/decision'&&request.method==='POST'){
  const raw=await request.text();if(raw.length>2048)return JSONR({error:'Too large.'},413);let b;try{b=JSON.parse(raw)}catch{return JSONR({error:'Bad request.'},400)}
  if(!uuid(String(b.ref||''))||!['approved','changes_requested','rejected'].includes(b.decision)||typeof b.note!=='string'||b.note.length>300||/[\u0000-\u001f\u007f]/.test(b.note))return JSONR({error:'Invalid decision or note (max 300 characters).'},400);
  const found=await db.prepare('SELECT id FROM submissions WHERE id=? AND created_at>?').bind(b.ref,Date.now()-30*86400000).first();if(!found)return JSONR({error:'Submission not found.'},404);
  await db.batch([db.prepare('INSERT INTO review_events(id,submissionref,reviewer,decision,note,timestamp) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),b.ref,s.email,b.decision,b.note,Date.now()),db.prepare('UPDATE submissions SET status=? WHERE id=?').bind(b.decision,b.ref)]);
  return JSONR({ok:true,preview_only:true,published:false,brand_approved:false});
 }
 return JSONR({error:'Not found.'},404);
}

const CATS=["attractions", "bars-pubs", "cafes", "cinemas", "clubs", "community-spaces", "coworking", "event-spaces", "fast-food", "fitness", "galleries", "ice-cream", "malls", "museums", "parks", "resorts", "restaurants", "shopping", "sports-centres", "stays", "theatres", "turfs", "other"];
const DAY=86400000, CAP=100;
const J=(o,s)=>new Response(JSON.stringify(o),{status:s||200,headers:{'content-type':'application/json','cache-control':'no-store'}});
const PII=/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|(?:\+?\d[\s().-]?){10,}|\b\d{4}\s?\d{4}\s?\d{4}\b|\b[A-Z]{5}\d{4}[A-Z]\b/;
const clean=(v,n)=>String(v==null?'':v).replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,n);
async function submit(request,env){
  if(!env.DB||env.INTAKE_ON!=='1') return J({error:'Submissions are switched off right now.'},503);
  const u=new URL(request.url), o=request.headers.get('origin');
  if(!o||new URL(o).host!==u.host) return J({error:'Not allowed.'},403);
  const len=+(request.headers.get('content-length')||0);
  if(len>4096) return J({error:'Too large.'},413);
  let raw; try{raw=await request.text()}catch(e){return J({error:'Bad request.'},400)}
  if(raw.length>4096) return J({error:'Too large.'},413);
  let d; try{d=JSON.parse(raw)}catch(e){return J({error:'Bad request.'},400)}
  if(d&&d.site2) return J({ok:true}); // honeypot: pretend success, store nothing
  const kind=d.kind==='correction'?'correction':'new';
  const name=clean(d.name,120),address=clean(d.address,200),note=clean(d.note,500);
  let link=clean(d.link,200);
  const category=CATS.includes(d.category)?d.category:'other';
  if(!name||!address) return J({error:'Please enter the place name and address.'},400);
  if(link){try{const l=new URL(link);if(l.protocol!=='https:'&&l.protocol!=='http:')throw 0;link=l.href.slice(0,200)}catch(e){return J({error:'The link must start with https://'},400)}}
  if(PII.test([name,address,link,note].join(' \n '))) return J({error:'Please remove email addresses, phone numbers or ID numbers and try again.'},400);
  const now=Date.now();
  try{
    const c=await env.DB.prepare('SELECT COUNT(*) AS n FROM submissions WHERE created_at>?').bind(now-DAY).first();
    if(c&&c.n>=CAP) return J({error:'Daily limit reached. Please try again tomorrow.'},429);
    const id=crypto.randomUUID();
    await env.DB.prepare('INSERT INTO submissions(id,created_at,kind,name,category,address,link,note,status) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,now,kind,name,category,address,link,note,'pending').run();
    // best-effort second purge path; the scheduled worker is the primary one
    try{await env.DB.prepare('DELETE FROM submissions WHERE created_at<?').bind(now-30*DAY).run()}catch(e){}
    return J({ok:true,ref:id});
  }catch(e){return J({error:'Could not save this right now.'},500)}
}
async function del(request,env){
  if(!env.DB||env.INTAKE_ON!=='1') return J({error:'Submissions are switched off right now.'},503);
  const u=new URL(request.url), o=request.headers.get('origin');
  if(!o||new URL(o).host!==u.host) return J({error:'Not allowed.'},403);
  let raw; try{raw=await request.text()}catch(e){return J({error:'Bad request.'},400)}
  if(raw.length>512) return J({error:'Too large.'},413);
  let d; try{d=JSON.parse(raw)}catch(e){return J({error:'Bad request.'},400)}
  const ref=clean(d&&d.ref,64);
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(ref)) return J({error:'That reference is not valid.'},400);
  try{const r=await env.DB.prepare('DELETE FROM submissions WHERE id=?').bind(ref).run();
    const n=r&&r.meta?r.meta.changes:0;
    if(!n) return J({error:'No entry found for that reference. It may already be deleted.'},404);
    return J({ok:true,deleted:true});
  }catch(e){return J({error:'Could not delete right now.'},500)}
}

async function discoveryRequest(request,env){
 const u=new URL(request.url);if(!env.DB)return JSONR({error:'Request storage unavailable.'},503);
 const db=env.DB;
 await db.prepare('CREATE TABLE IF NOT EXISTS discovery_requests(id TEXT PRIMARY KEY,token_hash TEXT NOT NULL,category TEXT NOT NULL,listing TEXT NOT NULL,note TEXT NOT NULL,status TEXT NOT NULL,created_at INTEGER NOT NULL)').run();
 const now=Date.now();await db.prepare('DELETE FROM discovery_requests WHERE created_at<?').bind(now-30*86400000).run();
 if(request.method==='POST'){
 if(request.headers.get('Origin')!==u.origin)return JSONR({error:'Origin refused.'},403);
 const raw=await request.text();if(raw.length>2048)return JSONR({error:'Maximum request size exceeded.'},413);let b;try{b=JSON.parse(raw)}catch{return JSONR({error:'Invalid JSON.'},400)}
 const known={"work": ["wework-prestige-cube", "wework-embassy-one", "bhive-mg-road", "awfis-shantiniketan-pod"], "eat": ["mtr-lalbagh", "jw-kitchen"], "play": ["play-arena", "breakout-koramangala"], "shop": ["ikea-nagasandra", "decathlon-brigade"], "travel": ["jw-marriott-bengaluru", "taj-west-end"], "events": ["bts-2026", "didac-2026"], "movies": ["pvr-koramangala", "pvr-vr-bengaluru"], "clubs": ["runners-high", "bangpypers"]};if(!known[b.category]?.includes(b.listing)||typeof b.listing!=='string'||!/^[a-z0-9-]{1,90}$/.test(b.listing)||typeof b.note!=='string'||b.note.length<3||b.note.length>500||/[\u0000-\u001f\u007f]/.test(b.note)||PII.test(b.note))return JSONR({error:'Use a short request without emails, phone numbers, ID numbers or private information.'},400);
 const count=await db.prepare('SELECT count(*) AS n FROM discovery_requests WHERE created_at>?').bind(now-86400000).first();if(count.n>=100)return JSONR({error:'Daily request limit reached.'},429);
 const id=crypto.randomUUID(),t=randomHex(32);const saved=await db.prepare('INSERT INTO discovery_requests SELECT ?,?,?,?,?,?,? WHERE (SELECT count(*) FROM discovery_requests WHERE created_at>?)<100 RETURNING id').bind(id,await hash(t),b.category,b.listing,b.note,'received_not_confirmed',now,now-86400000).first();if(!saved)return JSONR({error:'Daily request limit reached.'},429);return JSONR({ok:true,id,receipt_token:t,status:'received_not_confirmed',message:'Saved for SRCHN review. Not sent to the venue or club. Not a booking, membership, ticket or promised reply.',retention_days:30},201);
 }
 if(!['GET','DELETE'].includes(request.method))return JSONR({error:'Method not allowed.'},405);
 if(request.method==='DELETE'&&request.headers.get('Origin')!==u.origin)return JSONR({error:'Origin refused.'},403);
 const id=u.searchParams.get('id')||'',t=request.headers.get('X-Receipt-Token')||'';if(!uuid(id)||!/^([a-f0-9]{64})$/.test(t))return JSONR({error:'Valid reference and receipt token required.'},401);
 const row=await db.prepare('SELECT id,category,listing,status,created_at FROM discovery_requests WHERE id=? AND token_hash=?').bind(id,await hash(t)).first();if(!row)return JSONR({error:'Request not found.'},404);
 if(request.method==='DELETE'){await db.prepare('DELETE FROM discovery_requests WHERE id=? AND token_hash=?').bind(id,await hash(t)).run();return JSONR({deleted:true})}return JSONR({request:row,confirmed:false});
}


async function propertyRequests(request,env){
 const u=new URL(request.url);
 if(!env.DB)return JSONR({error:'Request storage unavailable.'},503);
 const db=env.DB;
 await db.prepare('CREATE TABLE IF NOT EXISTS property_requests(id TEXT PRIMARY KEY,ref TEXT UNIQUE NOT NULL,token_hash TEXT NOT NULL,name TEXT NOT NULL,mobile TEXT NOT NULL,email TEXT,service_id TEXT,service_name TEXT,property_type TEXT,locality TEXT,pincode TEXT,jurisdiction TEXT,applicant_type TEXT,description TEXT,documents TEXT,preferred_date TEXT,preferred_time TEXT,assistance_mode TEXT,status TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL)').run();
 const now=Date.now();
 if(request.method==='POST'){
  if(request.headers.get('Origin')!==u.origin)return JSONR({error:'Origin refused.'},403);
  const raw=await request.text();if(raw.length>16384)return JSONR({error:'Maximum request size exceeded.'},413);
  let b;try{b=JSON.parse(raw)}catch{return JSONR({error:'Invalid JSON.'},400)}
  if(b&&b.site2&&(typeof b.elapsed!=='number'||b.elapsed<2500))return JSONR({ok:true,ref:'SRP-00000000',message:'received'});
  const name=clean(b.name,120),mobile=String(b.mobile||'').replace(/[\s-]/g,'').replace(/^\+91/,''),email=clean(b.email,160);
  const sid=clean(b.service_id,90),sname=clean(b.service_name,160);
  if(!name)return JSONR({error:'Please enter your name.'},400);
  if(!/^[6-9]\d{9}$/.test(mobile))return JSONR({error:'Please enter a valid 10-digit Indian mobile number.'},400);
  if(email&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))return JSONR({error:'That email address does not look right.'},400);
  if(!/^[a-z0-9-]{1,90}$/.test(sid))return JSONR({error:'Please choose a valid service.'},400);
  const desc=clean(b.description,1000);if(desc.length<10)return JSONR({error:'Please describe your requirement in a few words.'},400);
  if(b.consent!==true)return JSONR({error:'Consent to be contacted is required.'},400);
  const count=await db.prepare('SELECT count(*) AS n FROM property_requests WHERE created_at>?').bind(now-86400000).first();
  if(count&&count.n>=50)return JSONR({error:'Daily request limit reached. Please call or WhatsApp us instead.'},429);
  const id=crypto.randomUUID(),ref='SRP-'+randomHex(4).toUpperCase(),t=randomHex(32);
  const saved=await db.prepare('INSERT INTO property_requests SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE (SELECT count(*) FROM property_requests WHERE created_at>?)<50 RETURNING ref')
   .bind(id,ref,await hash(t),name,mobile,email||null,sid,sname||sid,clean(b.property_type,60),clean(b.locality,120),/^\d{6}$/.test(b.pincode||'')?b.pincode:null,clean(b.jurisdiction,60),clean(b.applicant_type,60),desc,clean(b.documents,500),clean(b.preferred_date,20),clean(b.preferred_time,40),clean(b.assistance_mode,60),'NEW',now,now,now-86400000).first();
  if(!saved)return JSONR({error:'Daily request limit reached. Please call or WhatsApp us instead.'},429);
  let email_sent=false;
  if(email&&env.REVIEWMAIL&&env.BUDGETDB){try{
   const day=new Date(now).toISOString().slice(0,10);
   const budget=await env.BUDGETDB.prepare('INSERT INTO preview_mail_budget(key,count) VALUES(?,1) ON CONFLICT(key) DO UPDATE SET count=count+1 WHERE count<20 RETURNING count').bind('bc:'+day).first();
   if(budget){
    const track='https://srchn.in/property/track/?id='+ref+'&token='+t;
    const sent=await env.REVIEWMAIL.fetch(new Request('https://srchn-inference.internal/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({task:'booking_confirm',to:email,name,service:sname||sid,ref,mobile:'+91 '+mobile,track})}));
    email_sent=sent.ok;
   }
  }catch{}}
  return JSONR({ok:true,ref,receipt_token:t,status:'NEW',email:email?(email_sent?'sent':'not_sent'):null,message:'Enquiry recorded. This is not a confirmed appointment. Our team contacts you on the mobile number given.'},201);
 }
 if(request.method==='GET'){
  const ref=clean(u.searchParams.get('id')||'',40),t=clean(u.searchParams.get('token')||'',64);
  if(!/^SRP-[0-9A-F]{8}$/.test(ref)||!/^[a-f0-9]{64}$/.test(t))return JSONR({error:'Valid reference and tracking code required.'},401);
  const row=await db.prepare('SELECT ref,service_name,status,created_at,updated_at FROM property_requests WHERE ref=? AND token_hash=?').bind(ref,await hash(t)).first();
  if(!row)return JSONR({error:'Request not found.'},404);
  return JSONR({request:row});
 }
 if(request.method==='DELETE'){
  if(request.headers.get('Origin')!==u.origin)return JSONR({error:'Origin refused.'},403);
  const ref=clean(u.searchParams.get('id')||'',40),t=clean(u.searchParams.get('token')||'',64);
  if(!/^SRP-[0-9A-F]{8}$/.test(ref)||!/^[a-f0-9]{64}$/.test(t))return JSONR({error:'Valid reference and tracking code required.'},401);
  const row=await db.prepare("SELECT ref,status FROM property_requests WHERE ref=? AND token_hash=?").bind(ref,await hash(t)).first();
  if(!row)return JSONR({error:'Request not found.'},404);
  if(['COMPLETED','REJECTED','CANCELLED'].includes(row.status))return JSONR({request:{ref:row.ref,status:row.status}});
  await db.prepare("UPDATE property_requests SET status='CANCELLED',updated_at=? WHERE ref=?").bind(now,ref).run();
  return JSONR({request:{ref,status:'CANCELLED'}});
 }
 return JSONR({error:'Method not allowed.'},405);
}


/* ---------- SRCHN STUDIO 2.0 API (Phase 1: creator onboarding + wizard data) ---------- */
const STU_CATS=['Individual Contributor','Influencer','Blogger','Vlogger','Writer','Editor','Photographer','Videographer','Filmmaker','Social Media Creator','Digital Marketer','Graphic Designer','Creative Agency','Media Production Team','Business Owner','Student Creator','Other'];
const STU_KINDS=['places','spaces','experiences'],STU_PILLARS=['tour','product','marketing'];
async function stuTables(db){
 await db.prepare('CREATE TABLE IF NOT EXISTS stu_creators(id TEXT PRIMARY KEY,creator_no TEXT UNIQUE NOT NULL,full_name TEXT NOT NULL,display_name TEXT,mobile TEXT NOT NULL,email TEXT UNIQUE NOT NULL,city TEXT,lang TEXT,categories TEXT,bio TEXT,socials TEXT,status TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL)').run();
 await db.prepare('CREATE TABLE IF NOT EXISTS stu_otp(id TEXT PRIMARY KEY,email TEXT NOT NULL,code_hash TEXT NOT NULL,purpose TEXT NOT NULL,payload TEXT,expires_at INTEGER NOT NULL,used_at INTEGER,created_at INTEGER NOT NULL)').run();
 await db.prepare('CREATE TABLE IF NOT EXISTS stu_sessions(token_hash TEXT PRIMARY KEY,creator_id TEXT NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL)').run();
 await db.prepare('CREATE TABLE IF NOT EXISTS stu_places(id TEXT PRIMARY KEY,name TEXT NOT NULL,kind TEXT,primary_cat TEXT,secondary_cat TEXT,address TEXT,locality TEXT,city TEXT,pincode TEXT,state TEXT,country TEXT,website TEXT,instagram TEXT,contact TEXT,booking_url TEXT,maps_link TEXT,hours TEXT,created_by TEXT,created_at INTEGER NOT NULL)').run();
 await db.prepare('CREATE TABLE IF NOT EXISTS stu_submissions(id TEXT PRIMARY KEY,sub_no TEXT UNIQUE NOT NULL,creator_id TEXT NOT NULL,place_id TEXT,place_name TEXT,kind TEXT,cats TEXT,content_pillar TEXT,subcats TEXT,items TEXT,details TEXT,rights TEXT,status TEXT NOT NULL,email_status TEXT,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL)').run();
 await db.prepare('CREATE TABLE IF NOT EXISTS stu_drafts(creator_id TEXT PRIMARY KEY,payload TEXT,updated_at INTEGER NOT NULL)').run();
 await db.prepare('CREATE TABLE IF NOT EXISTS stu_media(id TEXT PRIMARY KEY,creator_id TEXT NOT NULL,kind TEXT NOT NULL,mime TEXT NOT NULL,bytes INTEGER NOT NULL,chunk_count INTEGER NOT NULL,status TEXT NOT NULL,meta TEXT,created_at INTEGER NOT NULL)').run();
 await db.prepare('CREATE TABLE IF NOT EXISTS stu_media_chunks(media_id TEXT NOT NULL,seq INTEGER NOT NULL,data BLOB NOT NULL,PRIMARY KEY(media_id,seq))').run();
}
function stuMail(env,body){return env.REVIEWMAIL.fetch(new Request('https://srchn-inference.internal/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}))}
async function stuAuth(request,db){
 const h=request.headers.get('Authorization')||'';const m=/^Bearer ([a-f0-9]{64})$/.exec(h);if(!m)return null;
 const row=await db.prepare('SELECT c.* FROM stu_sessions s JOIN stu_creators c ON c.id=s.creator_id WHERE s.token_hash=? AND s.expires_at>?').bind(await hash(m[1]),Date.now()).first();
 return row||null;
}
async function studioRoute(request,env){
 const u=new URL(request.url),p=u.pathname,now=Date.now(),db=env.DB;
 if(!db)return JSONR({error:'Studio storage unavailable.'},503);
 await stuTables(db);
 const mailDay=new Date(now).toISOString().slice(0,10);
 async function otpBudget(key,cap){if(!env.BUDGETDB)return true;try{return !!(await env.BUDGETDB.prepare('INSERT INTO preview_mail_budget(key,count) VALUES(?,1) ON CONFLICT(key) DO UPDATE SET count=count+1 WHERE count<'+cap+' RETURNING count').bind(key).first())}catch{return false}}
 if(p==='/studio/api/join/start'&&request.method==='POST'){
  if(request.headers.get('Origin')!==u.origin)return JSONR({error:'Origin refused.'},403);
  const b=await request.json().catch(()=>null);if(!b)return JSONR({error:'Invalid JSON.'},400);
  const full=clean(b.full_name,120),disp=clean(b.display_name,80)||full,email=clean(b.email,160).toLowerCase(),mobile=String(b.mobile||'').replace(/[\s-]/g,'').replace(/^\+91/,'');
  if(!full)return JSONR({error:'Please enter your full name.'},400);
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))return JSONR({error:'That email address does not look right.'},400);
  if(!/^[6-9]\d{9}$/.test(mobile))return JSONR({error:'Please enter a valid 10-digit Indian mobile number.'},400);
  const cats=(Array.isArray(b.categories)?b.categories:[]).filter(c=>STU_CATS.includes(c));
  if(!cats.length)return JSONR({error:'Please pick at least one creator category.'},400);
  const payload=JSON.stringify({full_name:full,display_name:disp,mobile,email,city:clean(b.city,80),lang:clean(b.language,40),categories:cats,bio:clean(b.bio,600),socials:{instagram:clean(b.instagram,120),youtube:clean(b.youtube,120),other:clean(b.other_link,120)}});
  const dupe=await db.prepare('SELECT creator_no FROM stu_creators WHERE email=?').bind(email).first();
  if(dupe)return JSONR({error:'This email already has a creator profile. Sign in instead.',creator_no:dupe.creator_no},409);
  const cnt=await db.prepare('SELECT count(*) AS n FROM stu_otp WHERE email=? AND created_at>?').bind(email,now-86400000).first();
  if(cnt&&cnt.n>=5)return JSONR({error:'Too many codes requested today. Try again tomorrow.'},429);
  if(!await otpBudget('so:'+mailDay,20))return JSONR({error:'Verification email limit reached for today. Try again tomorrow.'},429);
  const code=String(Math.floor(100000+Math.random()*900000)),id=crypto.randomUUID();
  await db.prepare('INSERT INTO stu_otp(id,email,code_hash,purpose,payload,expires_at,created_at) VALUES(?,?,?,?,?,?,?)').bind(id,email,await hash(code),'join',payload,now+600000,now).run();
  let sent=false;try{sent=(await stuMail(env,{task:'studio_otp',to:email,code,name:disp})).ok}catch{}
  if(!sent)return JSONR({error:'The verification email could not be sent right now. Nothing was saved - please try again.'},502);
  return JSONR({ok:true,email,sent:true,message:'Verification code sent to '+email+'. It expires in 10 minutes.'},201);
 }
 if(p==='/studio/api/join/verify'&&request.method==='POST'){
  if(request.headers.get('Origin')!==u.origin)return JSONR({error:'Origin refused.'},403);
  const b=await request.json().catch(()=>null);if(!b)return JSONR({error:'Invalid JSON.'},400);
  const email=clean(b.email,160).toLowerCase(),code=clean(b.code,6);
  const row=await db.prepare("SELECT * FROM stu_otp WHERE email=? AND purpose='join' AND used_at IS NULL ORDER BY created_at DESC LIMIT 1").bind(email).first();
  if(!row||row.expires_at<now)return JSONR({error:'Code expired. Request a new one.'},410);
  if(row.code_hash!==await hash(code))return JSONR({error:'That code does not match.'},401);
  await db.prepare('UPDATE stu_otp SET used_at=? WHERE id=?').bind(now,row.id).run();
  const d=JSON.parse(row.payload),cid=crypto.randomUUID(),cno='SRC-'+randomHex(4).toUpperCase();
  await db.prepare('INSERT INTO stu_creators(id,creator_no,full_name,display_name,mobile,email,city,lang,categories,bio,socials,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(cid,cno,d.full_name,d.display_name,d.mobile,d.email,d.city,d.lang,JSON.stringify(d.categories),d.bio,JSON.stringify(d.socials),'ACTIVE',now,now).run();
  const t=randomHex(32);
  await db.prepare('INSERT INTO stu_sessions(token_hash,creator_id,created_at,expires_at) VALUES(?,?,?,?)').bind(await hash(t),cid,now,now+30*86400000).run();
  return JSONR({ok:true,session:t,creator:{creator_no:cno,display_name:d.display_name,email}},201);
 }
 if(p==='/studio/api/login/start'&&request.method==='POST'){
  if(request.headers.get('Origin')!==u.origin)return JSONR({error:'Origin refused.'},403);
  const b=await request.json().catch(()=>null);if(!b)return JSONR({error:'Invalid JSON.'},400);
  const email=clean(b.email,160).toLowerCase();
  const c=await db.prepare('SELECT display_name FROM stu_creators WHERE email=?').bind(email).first();
  if(!c)return JSONR({error:'No creator profile for this email. Join first.'},404);
  if(!await otpBudget('so:'+mailDay,20))return JSONR({error:'Verification email limit reached for today. Try again tomorrow.'},429);
  const code=String(Math.floor(100000+Math.random()*900000));
  await db.prepare('INSERT INTO stu_otp(id,email,code_hash,purpose,expires_at,created_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),email,await hash(code),'login',now+600000,now).run();
  let sent=false;try{sent=(await stuMail(env,{task:'studio_otp',to:email,code,name:c.display_name})).ok}catch{}
  if(!sent)return JSONR({error:'The verification email could not be sent right now. Please try again.'},502);
  return JSONR({ok:true,sent:true},201);
 }
 if(p==='/studio/api/login/verify'&&request.method==='POST'){
  if(request.headers.get('Origin')!==u.origin)return JSONR({error:'Origin refused.'},403);
  const b=await request.json().catch(()=>null);if(!b)return JSONR({error:'Invalid JSON.'},400);
  const email=clean(b.email,160).toLowerCase(),code=clean(b.code,6);
  const row=await db.prepare("SELECT * FROM stu_otp WHERE email=? AND purpose='login' AND used_at IS NULL ORDER BY created_at DESC LIMIT 1").bind(email).first();
  if(!row||row.expires_at<now)return JSONR({error:'Code expired. Request a new one.'},410);
  if(row.code_hash!==await hash(code))return JSONR({error:'That code does not match.'},401);
  await db.prepare('UPDATE stu_otp SET used_at=? WHERE id=?').bind(now,row.id).run();
  const c=await db.prepare('SELECT id,creator_no,display_name,email FROM stu_creators WHERE email=?').bind(email).first();
  const t=randomHex(32);
  await db.prepare('INSERT INTO stu_sessions(token_hash,creator_id,created_at,expires_at) VALUES(?,?,?,?)').bind(await hash(t),c.id,now,now+30*86400000).run();
  return JSONR({ok:true,session:t,creator:{creator_no:c.creator_no,display_name:c.display_name,email}},201);
 }
 if(p==='/studio/api/me'&&request.method==='GET'){
  const c=await stuAuth(request,db);if(!c)return JSONR({error:'Sign in required.'},401);
  return JSONR({creator:{creator_no:c.creator_no,full_name:c.full_name,display_name:c.display_name,email:c.email,mobile:c.mobile,city:c.city,lang:c.lang,categories:JSON.parse(c.categories||'[]'),bio:c.bio,socials:JSON.parse(c.socials||'{}'),status:c.status}});
 }
 if(p==='/studio/api/drafts'){
  const c=await stuAuth(request,db);if(!c)return JSONR({error:'Sign in required.'},401);
  if(request.method==='PUT'){
   if(request.headers.get('Origin')!==u.origin)return JSONR({error:'Origin refused.'},403);
   const raw=await request.text();if(raw.length>65536)return JSONR({error:'Draft too large.'},413);
   await db.prepare('INSERT INTO stu_drafts(creator_id,payload,updated_at) VALUES(?,?,?) ON CONFLICT(creator_id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at').bind(c.id,raw,now).run();
   return JSONR({ok:true,saved_at:now});
  }
  if(request.method==='GET'){const d=await db.prepare('SELECT payload,updated_at FROM stu_drafts WHERE creator_id=?').bind(c.id).first();return JSONR({draft:d?JSON.parse(d.payload):null,updated_at:d?d.updated_at:null});}
  if(request.method==='DELETE'){await db.prepare('DELETE FROM stu_drafts WHERE creator_id=?').bind(c.id).run();return JSONR({deleted:true});}
  return JSONR({error:'Method not allowed.'},405);
 }
 if(p==='/studio/api/places'){
  if(request.method==='GET'){
   const q=clean(u.searchParams.get('q')||'',80);if(q.length<2)return JSONR({places:[]});
   const rows=await db.prepare('SELECT id,name,kind,locality,city,pincode FROM stu_places WHERE lower(name) LIKE ? ORDER BY created_at DESC LIMIT 10').bind('%'+q.toLowerCase()+'%').all();
   return JSONR({places:rows.results||[]});
  }
  if(request.method==='POST'){
   if(request.headers.get('Origin')!==u.origin)return JSONR({error:'Origin refused.'},403);
   const c=await stuAuth(request,db);if(!c)return JSONR({error:'Sign in required.'},401);
   const b=await request.json().catch(()=>null);if(!b)return JSONR({error:'Invalid JSON.'},400);
   const name=clean(b.name,160);if(!name)return JSONR({error:'Place name is required.'},400);
   const pin=clean(b.pincode,6);
   const dupe=await db.prepare('SELECT id,name,locality,city,pincode FROM stu_places WHERE lower(name)=? AND pincode=?').bind(name.toLowerCase(),pin).first();
   if(dupe)return JSONR({exists:true,place:dupe,message:'THIS PLACE IS ALREADY ON SRCHN.'},200);
   const id=crypto.randomUUID();
   await db.prepare('INSERT INTO stu_places(id,name,kind,primary_cat,secondary_cat,address,locality,city,pincode,state,country,website,instagram,contact,booking_url,maps_link,hours,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,name,clean(b.kind,20),clean(b.primary_cat,80),clean(b.secondary_cat,80),clean(b.address,240),clean(b.locality,80),clean(b.city,80),pin,clean(b.state,60),clean(b.country,60)||'India',clean(b.website,160),clean(b.instagram,160),clean(b.contact,40),clean(b.booking_url,160),clean(b.maps_link,200),clean(b.hours,120),c.id,now).run();
   return JSONR({ok:true,place:{id,name}},201);
  }
  return JSONR({error:'Method not allowed.'},405);
 }
 if(p==='/studio/api/submissions'){
  const c=await stuAuth(request,db);if(!c)return JSONR({error:'Sign in required.'},401);
  if(request.method==='GET'){
   const rows=await db.prepare('SELECT sub_no,place_name,kind,content_pillar,status,email_status,created_at FROM stu_submissions WHERE creator_id=? ORDER BY created_at DESC LIMIT 50').bind(c.id).all();
   return JSONR({submissions:rows.results||[]});
  }
  if(request.method==='POST'){
   if(request.headers.get('Origin')!==u.origin)return JSONR({error:'Origin refused.'},403);
   const raw=await request.text();if(raw.length>32768)return JSONR({error:'Submission too large.'},413);
   const b=JSON.parse(raw);
   if(!STU_KINDS.includes(b.kind))return JSONR({error:'Choose what you are adding: a place, a space or an experience.'},400);
   if(!STU_PILLARS.includes(b.content_pillar))return JSONR({error:'Choose a content type.'},400);
   const placeName=clean(b.place_name,160);if(!placeName)return JSONR({error:'Place name is required.'},400);
   if(!b.rights||b.rights.confirm!==true)return JSONR({error:'Rights confirmation is required.'},400);
   const subcats=(Array.isArray(b.subcats)?b.subcats:[]).map(x=>clean(x,60)).filter(Boolean).slice(0,30);
   const rawItems=(Array.isArray(b.items)?b.items:[]).slice(0,20);
   const items=[];
   for(const x of rawItems){
    const it={type:x.type==='video'?'video':'photo',caption:clean(x.caption,240),credit:clean(x.credit,120),aspect:x.aspect==='16:9'?'16:9':'9:16',media_status:'pending-upload'};
    const mid=clean(x.media_id,40);
    if(mid){
     const mrow=await db.prepare("SELECT id,kind,status FROM stu_media WHERE id=? AND creator_id=?").bind(mid,c.id).first();
     if(!mrow||mrow.status!=='ready'||mrow.kind!==it.type)return JSONR({error:'One of your uploads is missing or still uploading. Please re-check step 4.'},400);
     it.media_id=mid;it.media_status='uploaded';
    }
    items.push(it);
   }
   if(!items.length)return JSONR({error:'Add at least one photo or video.'},400);
   if(!items.some(i=>i.media_id))return JSONR({error:'At least one item must have an uploaded file.'},400);
   const cnt=await db.prepare('SELECT count(*) AS n FROM stu_submissions WHERE created_at>?').bind(now-86400000).first();
   if(cnt&&cnt.n>=100)return JSONR({error:'Daily submission limit reached. Try again tomorrow.'},429);
   const seq=(await db.prepare('SELECT count(*) AS n FROM stu_submissions').first()).n+1;
   const subNo='SRCHN-STU-'+new Date(now).getUTCFullYear()+'-'+String(seq).padStart(6,'0');
   const id=crypto.randomUUID();
   const details=JSON.stringify({address:clean(b.address,240),locality:clean(b.locality,80),city:clean(b.city,80),pincode:clean(b.pincode,6),state:clean(b.state,60),country:clean(b.country,60)||'India',dates:clean(b.dates,120),descriptions:clean(b.description,1000)});
   const rights=JSON.stringify({creator_type:clean(b.rights.creator_type,60),third_party:b.rights.third_party?{name:clean(b.rights.third_party.name,120),source:clean(b.rights.third_party.source,200),licence:clean(b.rights.third_party.licence,200)}:null,confirmed:true});
   await db.prepare('INSERT INTO stu_submissions(id,sub_no,creator_id,place_id,place_name,kind,cats,content_pillar,subcats,items,details,rights,status,email_status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,subNo,c.id,clean(b.place_id,40)||null,placeName,b.kind,JSON.stringify(b.cats||[]),b.content_pillar,JSON.stringify(subcats),JSON.stringify(items),details,rights,'SUBMITTED','pending',now,now).run();
   await db.prepare('DELETE FROM stu_drafts WHERE creator_id=?').bind(c.id).run();
   let es='failed';
   try{
    const det=JSON.parse(details);
    const r=await stuMail(env,{task:'studio_submission',submission_id:subNo,creator_name:c.full_name,creator_id:c.creator_no,creator_category:JSON.parse(c.categories||'[]').join(', '),mobile:'+91 '+c.mobile,email:c.email,place_name:placeName,location:[det.address,det.locality,det.city,det.pincode].filter(Boolean).join(', '),main_category:b.kind,content_type:b.content_pillar,subcategories:subcats.join(', ')||'-',photos:String(items.filter(i=>i.type==='photo').length),videos:String(items.filter(i=>i.type==='video').length),aspect_ratios:[...new Set(items.map(i=>i.aspect))].join(', ')||'-',captions:items.map(i=>i.caption).filter(Boolean).join(' | ')||'-',credits:items.map(i=>i.credit).filter(Boolean).join(' | ')||'-',submitted_at:new Date(now).toUTCString(),rights:'Confirmed by contributor',review_link:'https://srchn.in/studio/review/'});
    es=r.ok?'sent':'failed';
   }catch{es='failed'}
   await db.prepare('UPDATE stu_submissions SET email_status=? WHERE id=?').bind(es,id).run();
   return JSONR({ok:true,submission_id:subNo,status:'SUBMITTED',email:es,message:'Your submission has been received. Our editorial team will review the location, information and media before publication.'},201);
  }
  return JSONR({error:'Method not allowed.'},405);
 }
 // ---- media: chunked zero-spend storage in D1 (photos<=1.2MB, videos<=26MB, 30s) ----
 const STU_MEDIA_MAX_TOTAL=3000*1024*1024,STU_MEDIA_MAX_CREATOR=200*1024*1024,STU_CHUNK=950*1024;
 if(p==='/studio/api/media/start'&&request.method==='POST'){
  if(request.headers.get('Origin')!==u.origin)return JSONR({error:'Origin refused.'},403);
  const c=await stuAuth(request,db);if(!c)return JSONR({error:'Sign in required.'},401);
  const b=await request.json().catch(()=>null);if(!b)return JSONR({error:'Invalid JSON.'},400);
  const kind=b.kind==='video'?'video':b.kind==='photo'?'photo':'';
  if(!kind)return JSONR({error:'Choose photo or video.'},400);
  const mime=clean(b.mime,60),bytes=Math.floor(+b.bytes||0);
  const okMimes=kind==='photo'?['image/jpeg','image/png','image/webp']:['video/mp4','video/webm','video/quicktime'];
  if(!okMimes.includes(mime))return JSONR({error:kind==='photo'?'Photos must be JPG, PNG or WEBP.':'Videos must be MP4, WEBM or MOV.'},400);
  const maxB=kind==='photo'?1200000:26000000;
  if(!bytes||bytes>maxB)return JSONR({error:kind==='photo'?'Photo must be 1.2 MB or smaller after on-device optimisation.':'Video must be 26 MB or smaller after on-device optimisation.'},400);
  const tot=(await db.prepare("SELECT COALESCE(SUM(bytes),0) s FROM stu_media WHERE status!='receiving'").first()).s;
  if(tot+bytes>STU_MEDIA_MAX_TOTAL)return JSONR({error:'Studio media storage is full right now. Please try again later.'},507);
  const mine=(await db.prepare("SELECT COALESCE(SUM(bytes),0) s FROM stu_media WHERE creator_id=? AND status!='receiving'").bind(c.id).first()).s;
  if(mine+bytes>STU_MEDIA_MAX_CREATOR)return JSONR({error:'You have reached your media storage limit. Delete older uploads or contact Team SRCHN.'},507);
  const id=crypto.randomUUID(),chunks=Math.ceil(bytes/STU_CHUNK);
  await db.prepare("INSERT INTO stu_media(id,creator_id,kind,mime,bytes,chunk_count,status,meta,created_at) VALUES(?,?,?,?,?,?,'receiving','{}',?)").bind(id,c.id,kind,mime,bytes,chunks,now).run();
  return JSONR({ok:true,media_id:id,chunk_size:STU_CHUNK,chunk_count:chunks},201);
 }
 if(p==='/studio/api/media/chunk'&&request.method==='POST'){
  if(request.headers.get('Origin')!==u.origin)return JSONR({error:'Origin refused.'},403);
  const c=await stuAuth(request,db);if(!c)return JSONR({error:'Sign in required.'},401);
  const id=clean(u.searchParams.get('id')||'',40),seq=Math.floor(+u.searchParams.get('seq'));
  const m=await db.prepare("SELECT * FROM stu_media WHERE id=? AND creator_id=?").bind(id,c.id).first();
  if(!m||m.status!=='receiving')return JSONR({error:'Unknown or finished upload.'},404);
  if(!(seq>=0&&seq<m.chunk_count))return JSONR({error:'Bad chunk number.'},400);
  const raw=new Uint8Array(await request.arrayBuffer());
  if(!raw.length||raw.length>STU_CHUNK+1024)return JSONR({error:'Bad chunk size.'},400);
  await db.prepare('INSERT OR REPLACE INTO stu_media_chunks(media_id,seq,data) VALUES(?,?,?)').bind(id,seq,raw).run();
  return JSONR({ok:true,seq},201);
 }
 if(p==='/studio/api/media/finish'&&request.method==='POST'){
  if(request.headers.get('Origin')!==u.origin)return JSONR({error:'Origin refused.'},403);
  const c=await stuAuth(request,db);if(!c)return JSONR({error:'Sign in required.'},401);
  const b=await request.json().catch(()=>null);if(!b)return JSONR({error:'Invalid JSON.'},400);
  const id=clean(b.media_id,40);
  const m=await db.prepare("SELECT * FROM stu_media WHERE id=? AND creator_id=?").bind(id,c.id).first();
  if(!m||m.status!=='receiving')return JSONR({error:'Unknown or finished upload.'},404);
  const got=(await db.prepare('SELECT count(*) n,COALESCE(SUM(length(data)),0) s FROM stu_media_chunks WHERE media_id=?').bind(id).first());
  if(got.n!==m.chunk_count||got.s!==m.bytes)return JSONR({error:'Upload incomplete - some chunks are missing. Please retry the upload.'},409);
  const meta=JSON.stringify({caption:clean(b.caption,240),credit:clean(b.credit,120),aspect:b.aspect==='16:9'?'16:9':'9:16',captured_at:clean(b.captured_at,40),duration_sec:Math.min(30,Math.max(0,+b.duration_sec||0))||null,width:Math.floor(+b.width||0)||null,height:Math.floor(+b.height||0)||null,source:clean(b.source,200),motion_from_photo:b.motion_from_photo===true});
  await db.prepare("UPDATE stu_media SET status='ready',meta=? WHERE id=?").bind(meta,id).run();
  return JSONR({ok:true,media_id:id},201);
 }
 const mm=/^\/studio\/api\/media\/([0-9a-f-]{36})$/.exec(p);
 if(mm&&request.method==='GET'){
  const id=mm[1];
  const m=await db.prepare("SELECT * FROM stu_media WHERE id=? AND status='ready'").bind(id).first();
  if(!m)return JSONR({error:'Not found.'},404);
  const c=await stuAuth(request,db);
  const rv=await (async()=>{const t=(request.headers.get('Authorization')||'').replace(/^Bearer /,'');if(!/^[a-f0-9]{64}$/.test(t))return null;return db.prepare("SELECT email FROM sessions WHERE digest=? AND kind='session' AND expires>?").bind(await hash(t),now).first()})();
  if(!c&&!rv)return JSONR({error:'Sign in required.'},401);
  if(c&&c.id!==m.creator_id)return JSONR({error:'Not your upload.'},403);
  const range=request.headers.get('Range');
  let start=0,end=m.bytes-1;
  if(range){const rm=/bytes=(\d+)-(\d*)/.exec(range);if(rm){start=+rm[1];if(rm[2])end=Math.min(+rm[2],m.bytes-1)}}
  if(start>=m.bytes||start>end)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+m.bytes}});
  const maxSpan=4*STU_CHUNK;
  if(end-start+1>maxSpan)end=start+maxSpan-1;
  const s0=Math.floor(start/STU_CHUNK),s1=Math.floor(end/STU_CHUNK);
  const rows=await db.prepare('SELECT seq,data FROM stu_media_chunks WHERE media_id=? AND seq>=? AND seq<=? ORDER BY seq').bind(id,s0,s1).all();
  if((rows.results||[]).length!==s1-s0+1)return JSONR({error:'Media data incomplete.'},500);
  const total=(rows.results||[]).reduce((a,r)=>a+r.data.byteLength,0);
  const buf=new Uint8Array(total);let off=0;
  for(const r of rows.results){buf.set(new Uint8Array(r.data),off);off+=r.data.byteLength}
  const slice=buf.subarray(start-s0*STU_CHUNK,end-s0*STU_CHUNK+1);
  const h={'Content-Type':m.mime,'Accept-Ranges':'bytes','Cache-Control':'private, max-age=3600','Content-Length':String(slice.byteLength)};
  if(range){h['Content-Range']='bytes '+start+'-'+end+'/'+m.bytes;return new Response(slice,{status:206,headers:h})}
  return new Response(slice,{status:200,headers:h});
 }
 return JSONR({error:'Not found.'},404);
}

export default{async fetch(request,env){
  const u=new URL(request.url);
  if(u.pathname==='/property/api/status'){return JSONR({ok:true,storage:!!env.DB,phase:1,market:'Bengaluru'})}
  if(u.pathname==='/property/api/requests'){try{return await propertyRequests(request,env)}catch{return JSONR({error:'Request storage unavailable.'},503)}}
  if(u.pathname==='/api/discovery-request'){try{return await discoveryRequest(request,env)}catch{return JSONR({error:'Request storage unavailable.'},503)}}
  if(u.pathname.startsWith('/discovery/api/pilot/')){try{return await pilotSaveRoute(request,env)}catch{return JSONR({error:'Saved places unavailable.'},503)}}
  if(u.pathname.startsWith('/review/api/')){try{return await reviewRoute(request,env)}catch{return JSONR({error:'Review unavailable.'},503)}}
  if(u.pathname==='/api/submit-place'){
    if(request.method!=='POST') return J({error:'Method not allowed.'},405);
    return submit(request,env);
  }
  if(u.pathname==='/api/delete-submission'){
    if(request.method!=='POST') return J({error:'Method not allowed.'},405);
    return del(request,env);
  }
  if(u.pathname.startsWith('/studio/api/')){try{return await studioRoute(request,env)}catch(e){return JSONR({error:'Studio unavailable.'},503)}}
  return env.ASSETS.fetch(request);
}};
