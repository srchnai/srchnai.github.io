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
const cookie=(v,max)=>`__Secure-srchn_review=${v}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${max}`;
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
  const budget=await env.BUDGETDB.prepare('INSERT INTO preview_mail_budget(key,count) VALUES(?,1) ON CONFLICT(key) DO UPDATE SET count=count+1 WHERE count<5 RETURNING count').bind('rv:'+u.hostname+':'+day).first();
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
 await db.prepare('CREATE TABLE IF NOT EXISTS stu_reports(id TEXT PRIMARY KEY,target_type TEXT NOT NULL,target_id TEXT NOT NULL,kind TEXT NOT NULL,note TEXT,contact_email TEXT,status TEXT NOT NULL,created_at INTEGER NOT NULL)').run();
 await db.prepare('CREATE TABLE IF NOT EXISTS stu_engagement(key TEXT PRIMARY KEY,count INTEGER NOT NULL)').run();
 try{await db.prepare("ALTER TABLE stu_creators ADD COLUMN featured INTEGER NOT NULL DEFAULT 0").run()}catch{}
 try{await db.prepare("ALTER TABLE stu_creators ADD COLUMN featured_note TEXT").run()}catch{}
 await db.prepare('CREATE TABLE IF NOT EXISTS stu_review_events(id TEXT PRIMARY KEY,submission_id TEXT NOT NULL,reviewer TEXT NOT NULL,action TEXT NOT NULL,from_status TEXT,to_status TEXT,notes TEXT,created_at INTEGER NOT NULL)').run();
}
function stuMail(env,body){return env.REVIEWMAIL.fetch(new Request('https://srchn-inference.internal/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}))}
async function stuAuth(request,db){
 const h=request.headers.get('Authorization')||'';const m=/^Bearer ([a-f0-9]{64})$/.exec(h);if(!m)return null;
 const row=await db.prepare('SELECT c.* FROM stu_sessions s JOIN stu_creators c ON c.id=s.creator_id WHERE s.token_hash=? AND s.expires_at>?').bind(await hash(m[1]),Date.now()).first();
 return row||null;
}
async function stuReviewer(request,env){
 const h=request.headers.get('Authorization')||'';const m=/^Bearer ([a-f0-9]{64})$/.exec(h);
 const raw=m?m[1]:token(request);
 if(!/^[a-f0-9]{64}$/.test(raw||''))return null;
 if(!env.REVIEWDB)return null;
 const now=Math.floor(Date.now()/1000);
 return env.REVIEWDB.prepare("SELECT s.email FROM sessions s JOIN reviewers r ON r.email=s.email WHERE s.digest=? AND s.kind='session' AND s.expires>?").bind(await hash(raw),now).first();
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
  if(!await otpBudget('so:'+u.hostname+':'+mailDay,20))return JSONR({error:'Verification email limit reached for today. Try again tomorrow.'},429);
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
  if(!await otpBudget('so:'+u.hostname+':'+mailDay,20))return JSONR({error:'Verification email limit reached for today. Try again tomorrow.'},429);
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
   const seq=(await db.prepare("SELECT COALESCE(MAX(CAST(substr(sub_no,-6) AS INTEGER)),0) AS n FROM stu_submissions").first()).n+1;
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
 // ---- Phase 4: public BRANDS discovery (approved content only) ----
 if(p==='/studio/api/brands'&&request.method==='GET'){
  const cat=clean(u.searchParams.get('category')||'',60),q=clean(u.searchParams.get('q')||'',80);
  const rows=await db.prepare("SELECT DISTINCT p.id,p.name,p.kind,p.primary_cat,p.secondary_cat,p.locality,p.city FROM stu_places p JOIN stu_submissions s ON s.place_id=p.id WHERE s.status IN ('APPROVED','PUBLISHED') ORDER BY p.name LIMIT 200").all();
  let list=rows.results||[];
  if(cat)list=list.filter(x=>[x.primary_cat,x.secondary_cat,x.kind].filter(Boolean).join(' ').toLowerCase().includes(cat.toLowerCase()));
  if(q)list=list.filter(x=>(x.name+' '+(x.locality||'')+' '+(x.city||'')).toLowerCase().includes(q.toLowerCase()));
  const out=[];
  for(const x of list){
   const subs=await db.prepare("SELECT items,content_pillar FROM stu_submissions WHERE place_id=? AND status IN ('APPROVED','PUBLISHED') ORDER BY created_at DESC").bind(x.id).all();
   let cover=null;const pillars={tour:0,product:0,marketing:0};let photos=0,videos=0;
   for(const r of subs.results||[]){pillars[r.content_pillar]=(pillars[r.content_pillar]||0)+1;
    for(const it of JSON.parse(r.items||'[]')){if(!it.media_id)continue;if(it.type==='photo')photos++;if(it.type==='video')videos++;
     if(!cover&&it.type==='photo')cover=it.media_id}}
   out.push({id:x.id,name:x.name,category:x.primary_cat||x.kind,locality:x.locality,city:x.city,cover,pillars,photos,videos});
  }
  return JSONR({brands:out});
 }
 if(p==='/studio/api/brand'&&request.method==='GET'){
  const id=clean(u.searchParams.get('id')||'',40);
  const place=await db.prepare('SELECT * FROM stu_places WHERE id=?').bind(id).first();
  if(!place)return JSONR({error:'Unknown brand.'},404);
  const subs=await db.prepare("SELECT * FROM stu_submissions WHERE place_id=? AND status IN ('APPROVED','PUBLISHED') ORDER BY created_at DESC").bind(id).all();
  if(!(subs.results||[]).length)return JSONR({error:'Unknown brand.'},404);
  const sections={tour:[],product:[],marketing:[]};const credits={};const facilities=new Set();
  for(const r of subs.results||[]){
   const cr=await db.prepare('SELECT display_name,creator_no FROM stu_creators WHERE id=?').bind(r.creator_id).first();
   const cname=cr?(cr.display_name||cr.creator_no):'SRCHN contributor';
   const det=JSON.parse(r.details||'{}');
   (det.facilities||[]).forEach(f=>facilities.add(f));
   for(const it of JSON.parse(r.items||'[]')){
    if(!it.media_id)continue;
    const m=await db.prepare('SELECT mime,meta FROM stu_media WHERE id=? AND status=\'ready\'').bind(it.media_id).first();
    if(!m)continue;
    const meta=JSON.parse(m.meta||'{}');
    (sections[r.content_pillar]||(sections[r.content_pillar]=[])).push({media_id:it.media_id,type:it.type,mime:m.mime,caption:it.caption||meta.caption||'',credit:it.credit||cname,creator:cname,creator_no:cr?cr.creator_no:'',duration_sec:meta.duration_sec||null,width:meta.width||null,height:meta.height||null,captured_at:meta.captured_at||null,motion_from_photo:meta.motion_from_photo===true});
    credits[cname]=cr?cr.creator_no:'';
   }
  }
  await db.prepare('INSERT INTO stu_engagement(key,count) VALUES(?,1) ON CONFLICT(key) DO UPDATE SET count=count+1').bind('brand_view:'+id).run();
  const det0=JSON.parse((subs.results[0]||{}).details||'{}');
  return JSONR({brand:{id:place.id,name:place.name,category:place.primary_cat||place.kind,secondary:place.secondary_cat,kind:place.kind,address:place.address,locality:place.locality,city:place.city,pincode:place.pincode,website:place.website,instagram:place.instagram,contact:place.contact,hours:place.hours||det0.hours,maps_link:place.maps_link,description:det0.description||''},sections,facilities:[...facilities],contributors:Object.entries(credits).map(([name,no])=>({name,creator_no:no}))});
 }
 // ---- Phases 5-6: distribution support, recognition, governance ----
 if(p==='/studio/api/creator'&&request.method==='GET'){
  const no=clean(u.searchParams.get('id')||'',20);
  const c=await db.prepare("SELECT creator_no,display_name,city,categories,bio,featured,featured_note,created_at FROM stu_creators WHERE creator_no=? AND lower(status)='active'").bind(no).first();
  if(!c)return JSONR({error:'Unknown creator.'},404);
  const subs=await db.prepare("SELECT sub_no,place_name,place_id,kind,content_pillar,items,status,created_at FROM stu_submissions WHERE creator_id=(SELECT id FROM stu_creators WHERE creator_no=?) AND status IN ('APPROVED','PUBLISHED') ORDER BY created_at DESC LIMIT 100").bind(no).all();
  let published=0;const works=[];
  for(const r of subs.results||[]){
   if(r.status==='PUBLISHED')published++;
   for(const it of JSON.parse(r.items||'[]')){if(it.media_id)works.push({media_id:it.media_id,type:it.type,caption:it.caption||'',place_name:r.place_name,place_id:r.place_id||'',pillar:r.content_pillar,sub_no:r.sub_no})}
  }
  return JSONR({creator:{creator_no:c.creator_no,display_name:c.display_name,city:c.city,categories:JSON.parse(c.categories||'[]'),bio:c.bio||'',featured:c.featured===1,featured_note:c.featured_note||'',member_since:c.created_at,approved:(subs.results||[]).length,published},works});
 }
 if(p==='/studio/api/featured'&&request.method==='GET'){
  const rows=await db.prepare("SELECT creator_no,display_name,city,featured_note FROM stu_creators WHERE featured=1 AND lower(status)='active' ORDER BY updated_at DESC LIMIT 12").all();
  return JSONR({featured:rows.results||[]});
 }
 const REPORT_KINDS=['report','takedown','correction','copyright','withdrawal','brand-correction'];
 if(p==='/studio/api/report'&&request.method==='POST'){
  if(request.headers.get('Origin')!==u.origin)return JSONR({error:'Origin refused.'},403);
  const raw=await request.text();if(raw.length>4096)return JSONR({error:'Too large.'},413);
  let b;try{b=JSON.parse(raw)}catch{return JSONR({error:'Invalid JSON.'},400)}
  const kind=clean(b.kind,40);if(!REPORT_KINDS.includes(kind))return JSONR({error:'Choose a valid request type.'},400);
  const tt=clean(b.target_type,20),tid=clean(b.target_id,60);if(!tt||!tid)return JSONR({error:'Missing target.'},400);
  const note=clean(b.note,1000);if(!note)return JSONR({error:'Please describe the issue.'},400);
  const em=clean(b.contact_email,160).toLowerCase();
  if(em&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em))return JSONR({error:'That email does not look right.'},400);
  await db.prepare('INSERT INTO stu_reports(id,target_type,target_id,kind,note,contact_email,status,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),tt,tid,kind,note,em,'OPEN',now).run();
  return JSONR({ok:true,message:'Thank you. Team SRCHN will review this and act on it.'},201);
 }
 // ---- BRANDS Phase 2: brand owner workspace (creator-auth) ----
 if(p==='/studio/api/workspace'&&request.method==='GET'){
  const c=await stuAuth(request,db);if(!c)return JSONR({error:'Sign in required.'},401);
  await brTables(db);
  const mem=(await db.prepare("SELECT m.brand_id,m.role,b.name,b.slug,b.category,b.status,(SELECT COUNT(*) FROM br_locations l WHERE l.brand_id=b.id AND l.status!='DELETED') AS locs FROM br_members m JOIN br_brands b ON b.id=m.brand_id WHERE m.creator_id=? AND m.status='ACTIVE' AND b.status!='DELETED' ORDER BY b.name").bind(c.id).all()).results||[];
  const claims=(await db.prepare('SELECT id,brand_id,requested_name,requested_category,requested_locality,claimant_role,status,review_note,created_at,decided_at FROM br_claims WHERE creator_id=? ORDER BY created_at DESC LIMIT 50').bind(c.id).all()).results||[];
  const prods=(await db.prepare("SELECT pr.id,pr.brand_id,pr.name,pr.category,pr.price_text,pr.status FROM br_products pr JOIN br_members m ON m.brand_id=pr.brand_id WHERE m.creator_id=? AND m.status='ACTIVE' AND pr.status!='DELETED' ORDER BY pr.created_at DESC LIMIT 100").bind(c.id).all()).results||[];
  const stats={},teams={};
  for(const m of mem){
   stats[m.brand_id]={
    views7d:((await db.prepare('SELECT COUNT(*) n FROM br_views WHERE brand_id=? AND ts>?').bind(m.slug,now-7*86400000).first())||{}).n||0,
    views30d:((await db.prepare('SELECT COUNT(*) n FROM br_views WHERE brand_id=? AND ts>?').bind(m.slug,now-30*86400000).first())||{}).n||0,
    submissions:((await db.prepare("SELECT COUNT(*) n FROM stu_submissions WHERE details LIKE '%'||?||'%'").bind(m.brand_id).first())||{}).n||0,
    videos:((await db.prepare("SELECT COUNT(*) n FROM br_media_links WHERE brand_id=? AND kind='video'").bind(m.brand_id).first())||{}).n||0};
   if(m.role==='owner'||m.role==='manager'){
    teams[m.brand_id]=(await db.prepare("SELECT mm.creator_id,mm.role,mm.status,mm.created_at,cr.display_name,cr.email FROM br_members mm LEFT JOIN stu_creators cr ON cr.id=mm.creator_id WHERE mm.brand_id=? AND mm.status='ACTIVE' ORDER BY mm.created_at").bind(m.brand_id).all()).results||[];
   }
  }
  await db.prepare("UPDATE br_subscriptions SET status='GRACE',updated_at=? WHERE status='ACTIVE' AND renew_at<?").bind(now,now).run();
  const subs={},invs={};
  for(const m of mem){
   subs[m.brand_id]=(await db.prepare("SELECT plan,status,price_inr,start_at,renew_at,note FROM br_subscriptions WHERE brand_id=? AND status IN ('ACTIVE','GRACE') ORDER BY created_at DESC LIMIT 1").bind(m.brand_id).first())||null;
   invs[m.brand_id]=(await db.prepare('SELECT inv_no,period,amount_inr,status,issued_at,paid_at FROM br_invoices WHERE brand_id=? ORDER BY issued_at DESC LIMIT 10').bind(m.brand_id).all()).results||[];
  }
  return JSONR({memberships:mem,claims,products:prods,stats,teams,subscriptions:subs,invoices:invs});
 }
 if(p==='/studio/api/workspace/analytics'&&request.method==='GET'){
  const c=await stuAuth(request,db);if(!c)return JSONR({error:'Sign in required.'},401);
  await brTables(db);
  const bid=clean(u.searchParams.get('brand_id')||'',40);
  const role=await brRole(db,bid,c.id);
  if(!role)return JSONR({error:'You do not have access to this brand.'},403);
  const b=await db.prepare('SELECT id,name,slug,status FROM br_brands WHERE id=?').bind(bid).first();
  if(!b)return JSONR({error:'Unknown brand.'},404);
  const daily=(await db.prepare("SELECT date(ts/1000,'unixepoch') d,COUNT(*) n FROM br_views WHERE brand_id=? AND ts>? GROUP BY d ORDER BY d").bind(b.slug,now-30*86400000).all()).results||[];
  const locs=(await db.prepare("SELECT name,locality,status,(SELECT COUNT(*) FROM br_locations l2 WHERE l2.brand_id=l.brand_id) x FROM br_locations l WHERE brand_id=? AND status!='DELETED'").bind(bid).all()).results||[];
  const subs=(await db.prepare("SELECT id,kind,status,created_at,details FROM stu_submissions WHERE details LIKE '%'||?||'%' ORDER BY created_at DESC LIMIT 20").bind(bid).all()).results||[];
  const media=(await db.prepare("SELECT kind,COUNT(*) n FROM br_media_links WHERE brand_id=? GROUP BY kind").bind(bid).all()).results||[];
  const sub=await db.prepare("SELECT plan,status,renew_at FROM br_subscriptions WHERE brand_id=? AND status IN ('ACTIVE','GRACE') ORDER BY created_at DESC LIMIT 1").bind(bid).first();
  return JSONR({brand:{id:b.id,name:b.name,status:b.status},views_daily:daily,locations:locs,submissions:subs,media,subscription:sub||null});
 }
 if(p==='/studio/api/workspace/member-save'&&request.method==='POST'){
  const c=await stuAuth(request,db);if(!c)return JSONR({error:'Sign in required.'},401);
  await brTables(db);
  if(request.headers.get('Origin')!==u.origin)return JSONR({error:'Origin refused.'},403);
  const b=await request.json().catch(()=>null);if(!b)return JSONR({error:'Invalid JSON.'},400);
  const bid=clean(b.brand_id,40);const role=await brRole(db,bid,c.id);
  if(role!=='owner')return JSONR({error:'Only the brand owner can manage team access.'},403);
  const em=clean(b.email,120).toLowerCase();if(!em||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em))return JSONR({error:'Enter the person\'s Studio email.'},400);
  const nr=clean(b.role,20);if(!['manager','location_manager','editor','finance','readonly'].includes(nr))return JSONR({error:'Role must be manager, location_manager, editor, finance or readonly. Owners are added by Team SRCHN.'},400);
  const cr=await db.prepare('SELECT id,email,display_name FROM stu_creators WHERE lower(email)=?').bind(em).first();
  if(!cr)return JSONR({error:'No SRCHN Studio account for that email. Ask them to join Studio first, then add them.'},404);
  if(cr.id===c.id)return JSONR({error:'That is you - you are already the owner.'},400);
  const ex=await db.prepare('SELECT id FROM br_members WHERE brand_id=? AND creator_id=?').bind(bid,cr.id).first();
  if(ex)await db.prepare("UPDATE br_members SET role=?,status='ACTIVE',added_by=? WHERE id=?").bind(nr,c.email||c.creator_no,ex.id).run();
  else await db.prepare('INSERT INTO br_members(id,brand_id,creator_id,role,status,added_by,created_at) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),bid,cr.id,nr,'ACTIVE',c.email||c.creator_no,now).run();
  await db.prepare('INSERT INTO br_audit(actor,action,brand_id,detail,ts) VALUES(?,?,?,?,?)').bind(c.email||c.creator_no,'member-save',bid,em+' as '+nr,now).run();
  return JSONR({ok:true,message:(cr.display_name||em)+' now has '+nr+' access.'});
 }
 if(p==='/studio/api/workspace/member-remove'&&request.method==='POST'){
  const c=await stuAuth(request,db);if(!c)return JSONR({error:'Sign in required.'},401);
  await brTables(db);
  if(request.headers.get('Origin')!==u.origin)return JSONR({error:'Origin refused.'},403);
  const b=await request.json().catch(()=>null);if(!b)return JSONR({error:'Invalid JSON.'},400);
  const bid=clean(b.brand_id,40);const role=await brRole(db,bid,c.id);
  if(role!=='owner')return JSONR({error:'Only the brand owner can manage team access.'},403);
  const mcid=clean(b.creator_id,40);
  const m=await db.prepare('SELECT * FROM br_members WHERE brand_id=? AND creator_id=?').bind(bid,mcid).first();
  if(!m)return JSONR({error:'Not a team member.'},404);
  if(m.role==='owner'){
   const owners=await db.prepare("SELECT COUNT(*) n FROM br_members WHERE brand_id=? AND role='owner' AND status='ACTIVE'").bind(bid).first();
   if((owners.n||0)<=1)return JSONR({error:'A brand needs at least one owner.'},400);
  }
  await db.prepare("UPDATE br_members SET status='REMOVED' WHERE id=?").bind(m.id).run();
  await db.prepare('INSERT INTO br_audit(actor,action,brand_id,detail,ts) VALUES(?,?,?,?,?)').bind(c.email||c.creator_no,'member-remove',bid,mcid.slice(0,8),now).run();
  return JSONR({ok:true,message:'Access removed.'});
 }
 if(p==='/studio/api/workspace/claim'&&request.method==='POST'){
  const c=await stuAuth(request,db);if(!c)return JSONR({error:'Sign in required.'},401);
  await brTables(db);
  if(request.headers.get('Origin')!==u.origin)return JSONR({error:'Origin refused.'},403);
  const b=await request.json().catch(()=>null);if(!b)return JSONR({error:'Invalid JSON.'},400);
  const bid=clean(b.brand_id,40),rname=clean(b.requested_name,120);
  const role=clean(b.claimant_role,60);if(!role)return JSONR({error:'Tell us your role: Owner, Manager or Authorised representative.'},400);
  const proof=clean(b.proof_note,600);if(!proof)return JSONR({error:'Tell us how we can verify your connection to this brand.'},400);
  let brand=null;
  if(bid){brand=await db.prepare("SELECT id,name FROM br_brands WHERE id=? AND status!='DELETED'").bind(bid).first();if(!brand)return JSONR({error:'Unknown brand.'},404)}
  else if(!rname)return JSONR({error:'Name the brand you want to add.'},400);
  const dup=await db.prepare("SELECT id FROM br_claims WHERE creator_id=? AND status IN ('PENDING','MORE_INFO') AND "+(bid?"brand_id=?":"requested_name=?")).bind(c.id,bid||rname).first();
  if(dup)return JSONR({error:'You already have an open claim for this brand.'},409);
  if(bid){const mem=await db.prepare("SELECT id FROM br_members WHERE brand_id=? AND creator_id=? AND status='ACTIVE'").bind(bid,c.id).first();if(mem)return JSONR({error:'You already manage this brand.'},409)}
  const id=crypto.randomUUID();
  await db.prepare('INSERT INTO br_claims(id,brand_id,requested_name,requested_category,requested_locality,creator_id,claimant_role,proof_note,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,bid||null,bid?null:rname,clean(b.requested_category,60),clean(b.requested_locality,60),c.id,role,proof,'PENDING',now).run();
  await db.prepare('INSERT INTO br_audit(actor,action,brand_id,detail,ts) VALUES(?,?,?,?,?)').bind(c.email||c.creator_no,'claim-submit',bid||null,bid?('claim on '+brand.name):('new brand request: '+rname),now).run();
  return JSONR({ok:true,claim_id:id,message:'Claim received. Team SRCHN verifies every claim manually and updates the status here.'},201);
 }
 if(p==='/studio/api/workspace/brand-save'&&request.method==='POST'){
  const c=await stuAuth(request,db);if(!c)return JSONR({error:'Sign in required.'},401);
  await brTables(db);
  if(request.headers.get('Origin')!==u.origin)return JSONR({error:'Origin refused.'},403);
  const b=await request.json().catch(()=>null);if(!b)return JSONR({error:'Invalid JSON.'},400);
  const bid=clean(b.brand_id,40);const role=await brRole(db,bid,c.id);
  if(!role||!['owner','manager','editor'].includes(role))return JSONR({error:'You do not have edit access to this brand.'},403);
  const br=await db.prepare("SELECT * FROM br_brands WHERE id=? AND status!='DELETED'").bind(bid).first();if(!br)return JSONR({error:'Unknown brand.'},404);
  const ns=br.status==='PUBLISHED'?'UNDER_REVIEW':br.status;
  await db.prepare('UPDATE br_brands SET tagline=?,description=?,website=?,socials=?,founded_year=?,founders=?,hq_city=?,status=?,updated_at=? WHERE id=?').bind(clean(b.tagline,200),clean(b.description,8000),clean(b.website,200),typeof b.socials==='string'?clean(b.socials,1000):JSON.stringify(b.socials||{}),clean(b.founded_year,10),clean(b.founders,200),clean(b.hq_city,60),ns,now,bid).run();
  await db.prepare('INSERT INTO br_audit(actor,action,brand_id,detail,ts) VALUES(?,?,?,?,?)').bind(c.email||c.creator_no,'owner-edit',bid,br.name,now).run();
  return JSONR({ok:true,status:ns,message:ns==='UNDER_REVIEW'?'Saved. Because the brand is live, Team SRCHN will re-check and republish it shortly.':'Saved.'});
 }
 if(p==='/studio/api/workspace/location-save'&&request.method==='POST'){
  const c=await stuAuth(request,db);if(!c)return JSONR({error:'Sign in required.'},401);
  await brTables(db);
  if(request.headers.get('Origin')!==u.origin)return JSONR({error:'Origin refused.'},403);
  const b=await request.json().catch(()=>null);if(!b)return JSONR({error:'Invalid JSON.'},400);
  const bid=clean(b.brand_id,40);const role=await brRole(db,bid,c.id);
  if(!role||!['owner','manager','editor','location_manager'].includes(role))return JSONR({error:'You do not have edit access to this brand.'},403);
  const name=clean(b.name,120);if(!name)return JSONR({error:'Location name required.'},400);
  const br=await db.prepare("SELECT id FROM br_brands WHERE id=? AND status!='DELETED'").bind(bid).first();if(!br)return JSONR({error:'Unknown brand.'},404);
  const lid=clean(b.location_id,40)||crypto.randomUUID();
  const ex=await db.prepare('SELECT * FROM br_locations WHERE id=? AND brand_id=?').bind(lid,bid).first();
  if(ex){
   const ns=ex.status==='PUBLISHED'?'UNDER_REVIEW':ex.status;
   await db.prepare('UPDATE br_locations SET name=?,address=?,locality=?,city=?,state=?,pincode=?,phone=?,hours=?,facilities=?,status=?,updated_at=? WHERE id=?').bind(name,clean(b.address,240),clean(b.locality,80),clean(b.city,80),clean(b.state,60),clean(b.pincode,6),clean(b.phone,30),clean(b.hours,200),JSON.stringify(Array.isArray(b.facilities)?b.facilities.slice(0,20).map(x=>clean(x,60)).filter(Boolean):[]),ns,now,lid).run();
   await db.prepare('INSERT INTO br_audit(actor,action,brand_id,detail,ts) VALUES(?,?,?,?,?)').bind(c.email||c.creator_no,'owner-location-edit',bid,name,now).run();
   return JSONR({ok:true,location_id:lid,status:ns,message:ns==='UNDER_REVIEW'?'Saved. This branch is live, so Team SRCHN will re-check and republish it shortly.':'Saved.'});
  }
  let slug=brSlug(name)||lid.slice(0,8);
  const clash=await db.prepare('SELECT id FROM br_locations WHERE brand_id=? AND slug=?').bind(bid,slug).first();if(clash)slug=slug+'-2';
  await db.prepare('INSERT INTO br_locations(id,brand_id,slug,name,address,locality,city,state,pincode,phone,hours,facilities,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(lid,bid,slug,name,clean(b.address,240),clean(b.locality,80),clean(b.city,80),clean(b.state,60),clean(b.pincode,6),clean(b.phone,30),clean(b.hours,200),JSON.stringify(Array.isArray(b.facilities)?b.facilities.slice(0,20).map(x=>clean(x,60)).filter(Boolean):[]),'DRAFT',now,now).run();
  await db.prepare('INSERT INTO br_audit(actor,action,brand_id,detail,ts) VALUES(?,?,?,?,?)').bind(c.email||c.creator_no,'owner-location-add',bid,name,now).run();
  return JSONR({ok:true,location_id:lid,status:'DRAFT',message:'Location saved. It goes live after Team SRCHN verifies the address and details.'},201);
 }
 if(p==='/studio/api/workspace/product-save'&&request.method==='POST'){
  const c=await stuAuth(request,db);if(!c)return JSONR({error:'Sign in required.'},401);
  await brTables(db);
  if(request.headers.get('Origin')!==u.origin)return JSONR({error:'Origin refused.'},403);
  const b=await request.json().catch(()=>null);if(!b)return JSONR({error:'Invalid JSON.'},400);
  const bid=clean(b.brand_id,40);const role=await brRole(db,bid,c.id);
  if(!role||!['owner','manager','editor'].includes(role))return JSONR({error:'You do not have edit access to this brand.'},403);
  const name=clean(b.name,160);if(!name)return JSONR({error:'Name the product or service.'},400);
  const pid=clean(b.product_id,40)||crypto.randomUUID();
  const ex=await db.prepare('SELECT * FROM br_products WHERE id=? AND brand_id=?').bind(pid,bid).first();
  if(ex){
   const ns=ex.status==='PUBLISHED'?'UNDER_REVIEW':ex.status;
   await db.prepare('UPDATE br_products SET name=?,description=?,category=?,price_text=?,availability=?,link=?,status=? WHERE id=?').bind(name,clean(b.description,1200),clean(b.category,60),clean(b.price_text,60),clean(b.availability,60),clean(b.link,300),ns,pid).run();
   return JSONR({ok:true,product_id:pid,status:ns,message:ns==='UNDER_REVIEW'?'Saved. Team SRCHN will re-check and republish it shortly.':'Saved.'});
  }
  await db.prepare('INSERT INTO br_products(id,brand_id,kind,name,description,category,price_text,availability,link,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(pid,bid,clean(b.kind,20)==='service'?'service':'product',name,clean(b.description,1200),clean(b.category,60),clean(b.price_text,60),clean(b.availability,60),clean(b.link,300),'DRAFT',now).run();
  await db.prepare('INSERT INTO br_audit(actor,action,brand_id,detail,ts) VALUES(?,?,?,?,?)').bind(c.email||c.creator_no,'owner-product-add',bid,name,now).run();
  return JSONR({ok:true,product_id:pid,status:'DRAFT',message:'Saved. It appears on your brand page after Team SRCHN approves it.'},201);
 }
 if(p==='/studio/api/workspace/submit'&&request.method==='POST'){
  const c=await stuAuth(request,db);if(!c)return JSONR({error:'Sign in required.'},401);
  await brTables(db);
  if(request.headers.get('Origin')!==u.origin)return JSONR({error:'Origin refused.'},403);
  const raw=await request.text();if(raw.length>32768)return JSONR({error:'Submission too large.'},413);
  const b=JSON.parse(raw);
  const bid=clean(b.brand_id,40);const role=await brRole(db,bid,c.id);
  if(!role||role==='readonly'||role==='finance')return JSONR({error:'You do not have content access to this brand.'},403);
  const br=await db.prepare("SELECT * FROM br_brands WHERE id=? AND status!='DELETED'").bind(bid).first();if(!br)return JSONR({error:'Unknown brand.'},404);
  if(!STU_PILLARS.includes(b.content_pillar))return JSONR({error:'Choose a content type.'},400);
  if(!b.rights||b.rights.confirm!==true)return JSONR({error:'Rights confirmation is required.'},400);
  const rawItems=(Array.isArray(b.items)?b.items:[]).slice(0,20);
  const items=[];
  for(const x of rawItems){
   const it={type:x.type==='video'?'video':'photo',caption:clean(x.caption,240),credit:clean(x.credit,120),aspect:x.aspect==='16:9'?'16:9':'9:16',media_status:'pending-upload'};
   const mid=clean(x.media_id,40);
   if(mid){
    const mrow=await db.prepare("SELECT id,kind,status FROM stu_media WHERE id=? AND creator_id=?").bind(mid,c.id).first();
    if(!mrow||mrow.status!=='ready'||mrow.kind!==it.type)return JSONR({error:'One of your uploads is missing or still uploading.'},400);
    it.media_id=mid;it.media_status='uploaded';
   }
   items.push(it);
  }
  if(!items.length||!items.some(i=>i.media_id))return JSONR({error:'Add at least one uploaded photo or video.'},400);
  const cnt=await db.prepare('SELECT count(*) AS n FROM stu_submissions WHERE created_at>?').bind(now-86400000).first();
  if(cnt&&cnt.n>=100)return JSONR({error:'Daily submission limit reached. Try again tomorrow.'},429);
  const seq=(await db.prepare("SELECT COALESCE(MAX(CAST(substr(sub_no,-6) AS INTEGER)),0) AS n FROM stu_submissions").first()).n+1;
  const subNo='SRCHN-STU-'+new Date(now).getUTCFullYear()+'-'+String(seq).padStart(6,'0');
  const details=JSON.stringify({brand_id:bid,brand_name:br.name,locality:clean(b.locality,80),city:clean(b.city,80)||'Bengaluru'});
  const rights=JSON.stringify({creator_type:'brand:'+role,confirmed:true});
  await db.prepare('INSERT INTO stu_submissions(id,sub_no,creator_id,place_id,place_name,kind,cats,content_pillar,subcats,items,details,rights,status,email_status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),subNo,c.id,null,br.name,'places',JSON.stringify([br.category]),b.content_pillar,JSON.stringify([]),JSON.stringify(items),details,rights,'SUBMITTED','pending',now,now).run();
  let es='failed';
  try{const r=await stuMail(env,{task:'studio_submission',submission_id:subNo,creator_name:c.full_name,creator_id:c.creator_no,creator_category:'Brand workspace ('+role+')',mobile:'+91 '+c.mobile,email:c.email,place_name:'[BRAND] '+br.name,location:clean(b.locality,80)||'-',main_category:br.category,content_type:b.content_pillar,subcategories:'-',photos:String(items.filter(i=>i.type==='photo').length),videos:String(items.filter(i=>i.type==='video').length),aspect_ratios:[...new Set(items.map(i=>i.aspect))].join(' '),captions:items.map(i=>i.caption).filter(Boolean).join(' | ')||'-',credits:items.map(i=>i.credit).filter(Boolean).join(' | ')||'-',submitted_at:new Date(now).toUTCString(),rights:'Confirmed by brand workspace',review_link:'https://srchn.in/studio/review/'});es=r.ok?'sent':'failed'}catch{es='failed'}
  await db.prepare('UPDATE stu_submissions SET email_status=? WHERE sub_no=?').bind(es,subNo).run();
  await db.prepare('INSERT INTO br_audit(actor,action,brand_id,detail,ts) VALUES(?,?,?,?,?)').bind(c.email||c.creator_no,'owner-submit',bid,subNo,now).run();
  return JSONR({ok:true,submission_id:subNo,status:'SUBMITTED',email:es,message:'Submitted. Team SRCHN reviews the media before it appears on your brand page.'},201);
 }
 // ---- Phase 3: Team SRCHN editorial review dashboard ----
 const STU_STATUSES=['SUBMITTED','UNDER_REVIEW','ADDITIONAL_INFORMATION_REQUIRED','APPROVED','SCHEDULED','PUBLISHED','REJECTED','ON_HOLD','WITHDRAWN','DUPLICATE'];
 if(p==='/studio/api/review/submissions'&&request.method==='GET'){
  const rv=await stuReviewer(request,env);if(!rv)return JSONR({error:'Reviewer sign-in required.'},401);
  const st=(u.searchParams.get('status')||'').toUpperCase();
  let rows;
  if(st==='NEW')rows=await db.prepare("SELECT sub_no,place_name,kind,content_pillar,status,email_status,created_at FROM stu_submissions WHERE status='SUBMITTED' ORDER BY created_at DESC LIMIT 200").all();
  else if(STU_STATUSES.includes(st))rows=await db.prepare('SELECT sub_no,place_name,kind,content_pillar,status,email_status,created_at FROM stu_submissions WHERE status=? ORDER BY created_at DESC LIMIT 200').bind(st).all();
  else rows=await db.prepare('SELECT sub_no,place_name,kind,content_pillar,status,email_status,created_at FROM stu_submissions ORDER BY created_at DESC LIMIT 200').all();
  const counts=await db.prepare('SELECT status,count(*) n FROM stu_submissions GROUP BY status').all();
  const usage=await db.prepare("SELECT COALESCE(SUM(bytes),0) s FROM stu_media WHERE status='ready'").first();
  return JSONR({reviewer:rv.email,submissions:rows.results||[],counts:counts.results||[],media_bytes:usage.s,media_limit:3000*1024*1024});
 }
 if(p==='/studio/api/review/submission'&&request.method==='GET'){
  const rv=await stuReviewer(request,env);if(!rv)return JSONR({error:'Reviewer sign-in required.'},401);
  const subNo=clean(u.searchParams.get('id')||'',30);
  const sub=await db.prepare('SELECT * FROM stu_submissions WHERE sub_no=?').bind(subNo).first();
  if(!sub)return JSONR({error:'Unknown submission.'},404);
  const creator=await db.prepare('SELECT creator_no,full_name,display_name,email,mobile,city,categories,status FROM stu_creators WHERE id=?').bind(sub.creator_id).first();
  const place=sub.place_id?await db.prepare('SELECT * FROM stu_places WHERE id=?').bind(sub.place_id).first():null;
  const items=JSON.parse(sub.items||'[]');
  for(const it of items){if(it.media_id){const m=await db.prepare('SELECT kind,mime,bytes,meta FROM stu_media WHERE id=?').bind(it.media_id).first();if(m){it.mime=m.mime;it.bytes=m.bytes;const meta=JSON.parse(m.meta||'{}');it.duration_sec=meta.duration_sec;it.width=meta.width;it.height=meta.height;it.motion_from_photo=meta.motion_from_photo===true}}}
  const dupes=await db.prepare('SELECT sub_no,status,created_at FROM stu_submissions WHERE place_name=? AND sub_no!=? ORDER BY created_at DESC LIMIT 10').bind(sub.place_name,subNo).all();
  const events=await db.prepare('SELECT reviewer,action,from_status,to_status,notes,created_at FROM stu_review_events WHERE submission_id=? ORDER BY created_at DESC LIMIT 100').bind(subNo).all();
  return JSONR({submission:{sub_no:sub.sub_no,place_name:sub.place_name,kind:sub.kind,cats:JSON.parse(sub.cats||'[]'),content_pillar:sub.content_pillar,subcats:JSON.parse(sub.subcats||'[]'),items,details:JSON.parse(sub.details||'{}'),rights:JSON.parse(sub.rights||'{}'),status:sub.status,email_status:sub.email_status,created_at:sub.created_at},creator,place,dupes:dupes.results||[],events:events.results||[]});
 }
 if(p==='/studio/api/review/status'&&request.method==='POST'){
  if(request.headers.get('Origin')!==u.origin)return JSONR({error:'Origin refused.'},403);
  const rv=await stuReviewer(request,env);if(!rv)return JSONR({error:'Reviewer sign-in required.'},401);
  const b=await request.json().catch(()=>null);if(!b)return JSONR({error:'Invalid JSON.'},400);
  const subNo=clean(b.submission_id,30),to=clean(b.status,40).toUpperCase(),reason=clean(b.reason,600),notes=clean(b.notes,1000);
  if(!STU_STATUSES.includes(to)||to==='SUBMITTED')return JSONR({error:'Choose a valid decision.'},400);
  if(to==='REJECTED'&&!reason)return JSONR({error:'A rejection needs a reason - it is shared with the creator.'},400);
  const sub=await db.prepare('SELECT * FROM stu_submissions WHERE sub_no=?').bind(subNo).first();
  if(!sub)return JSONR({error:'Unknown submission.'},404);
  if(sub.status===to)return JSONR({error:'Already '+to+'.'},409);
  await db.prepare('UPDATE stu_submissions SET status=?,updated_at=? WHERE sub_no=?').bind(to,now,subNo).run();
  await db.prepare('INSERT INTO stu_review_events(id,submission_id,reviewer,action,from_status,to_status,notes,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),subNo,rv.email,'status',sub.status,to,[reason,notes].filter(Boolean).join(' — '),now).run();
  const c=await db.prepare('SELECT display_name,email FROM stu_creators WHERE id=?').bind(sub.creator_id).first();
  let es='failed';
  if(c){try{es=(await stuMail(env,{task:'studio_status',to:c.email,name:c.display_name,submission_id:subNo,status:to,place_name:sub.place_name,reason})).ok?'sent':'failed'}catch{es='failed'}}
  await db.prepare('UPDATE stu_submissions SET email_status=? WHERE sub_no=?').bind('status_'+to.toLowerCase()+':'+es,subNo).run();
  return JSONR({ok:true,status:to,email:es});
 }
 if(p==='/studio/api/review/note'&&request.method==='POST'){
  if(request.headers.get('Origin')!==u.origin)return JSONR({error:'Origin refused.'},403);
  const rv=await stuReviewer(request,env);if(!rv)return JSONR({error:'Reviewer sign-in required.'},401);
  const b=await request.json().catch(()=>null);if(!b)return JSONR({error:'Invalid JSON.'},400);
  const subNo=clean(b.submission_id,30),note=clean(b.note,1000);
  if(!note)return JSONR({error:'Write the note first.'},400);
  await db.prepare('INSERT INTO stu_review_events(id,submission_id,reviewer,action,notes,created_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),subNo,rv.email,'note',note,now).run();
  return JSONR({ok:true});
 }
 if(p==='/studio/api/review/edit-meta'&&request.method==='POST'){
  if(request.headers.get('Origin')!==u.origin)return JSONR({error:'Origin refused.'},403);
  const rv=await stuReviewer(request,env);if(!rv)return JSONR({error:'Reviewer sign-in required.'},401);
  const b=await request.json().catch(()=>null);if(!b)return JSONR({error:'Invalid JSON.'},400);
  const subNo=clean(b.submission_id,30);
  const sub=await db.prepare('SELECT * FROM stu_submissions WHERE sub_no=?').bind(subNo).first();
  if(!sub)return JSONR({error:'Unknown submission.'},404);
  const det=JSON.parse(sub.details||'{}');const changes=[];
  const np=clean(b.place_name,120);
  if(np&&np!==sub.place_name){await db.prepare('UPDATE stu_submissions SET place_name=? WHERE sub_no=?').bind(np,subNo).run();if(sub.place_id)await db.prepare('UPDATE stu_places SET name=? WHERE id=?').bind(np,sub.place_id).run();changes.push('place_name: '+sub.place_name+' -> '+np)}
  let dd=false;
  for(const k of['address','locality','city','pincode','hours','phone','website']){if(typeof b[k]==='string'&&clean(b[k],200)!==(det[k]||'')){det[k]=clean(b[k],200);dd=true;changes.push(k)}}
  if(dd){await db.prepare('UPDATE stu_submissions SET details=? WHERE sub_no=?').bind(JSON.stringify(det),subNo).run();
   if(sub.place_id)await db.prepare('UPDATE stu_places SET address=?,locality=?,city=?,pincode=? WHERE id=?').bind(det.address||'',det.locality||'',det.city||'',det.pincode||'',sub.place_id).run()}
  if(typeof b.place_id==='string'&&clean(b.place_id,40)){
   const pid=clean(b.place_id,40);
   const pl=await db.prepare('SELECT id,name FROM stu_places WHERE id=?').bind(pid).first();
   if(!pl)return JSONR({error:'Unknown place record.'},404);
   if(pid!==sub.place_id){await db.prepare('UPDATE stu_submissions SET place_id=?,place_name=? WHERE sub_no=?').bind(pid,pl.name,subNo).run();changes.push('attached to place '+pl.name)}
  }
  if(!changes.length)return JSONR({error:'Nothing changed.'},400);
  await db.prepare('INSERT INTO stu_review_events(id,submission_id,reviewer,action,notes,created_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),subNo,rv.email,'edit','Metadata edited: '+changes.join(', '),now).run();
  return JSONR({ok:true,changes});
 }
 if(p==='/studio/api/review/delete'&&request.method==='POST'){
  if(request.headers.get('Origin')!==u.origin)return JSONR({error:'Origin refused.'},403);
  const rv=await stuReviewer(request,env);if(!rv)return JSONR({error:'Reviewer sign-in required.'},401);
  const b=await request.json().catch(()=>null);if(!b)return JSONR({error:'Invalid JSON.'},400);
  const subNo=clean(b.submission_id,30),why=clean(b.reason,400);
  if(!why)return JSONR({error:'A reason is required - deletions are audited.'},400);
  const sub=await db.prepare('SELECT * FROM stu_submissions WHERE sub_no=?').bind(subNo).first();
  if(!sub)return JSONR({error:'Unknown submission.'},404);
  const items=JSON.parse(sub.items||'[]');let mediaGone=0;
  for(const it of items){
   if(!it.media_id)continue;
   const other=await db.prepare("SELECT sub_no FROM stu_submissions WHERE sub_no!=? AND items LIKE '%'||?||'%' LIMIT 1").bind(subNo,it.media_id).first();
   if(other)continue;
   await db.prepare('DELETE FROM stu_media_chunks WHERE media_id=?').bind(it.media_id).run();
   await db.prepare('DELETE FROM stu_media WHERE id=?').bind(it.media_id).run();
   mediaGone++;
  }
  await db.prepare('INSERT INTO stu_review_events(id,submission_id,reviewer,action,from_status,notes,created_at) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),subNo,rv.email,'delete',sub.status,why,now).run();
  await db.prepare('DELETE FROM stu_submissions WHERE sub_no=?').bind(subNo).run();
  return JSONR({ok:true,deleted:subNo,media_removed:mediaGone});
 }
 if(p==='/studio/api/review/delete-media'&&request.method==='POST'){
  if(request.headers.get('Origin')!==u.origin)return JSONR({error:'Origin refused.'},403);
  const rv=await stuReviewer(request,env);if(!rv)return JSONR({error:'Reviewer sign-in required.'},401);
  const b=await request.json().catch(()=>null);if(!b)return JSONR({error:'Invalid JSON.'},400);
  let ids=(Array.isArray(b.media_ids)?b.media_ids:[]).map(x=>clean(x,40)).filter(x=>/^[0-9a-f-]{36}$/.test(x)).slice(0,50);
  const why=clean(b.reason,400);
  if(b.sweep_orphans===true){
   const hours=Math.min(168,Math.max(1,+b.older_than_hours||24));
   const all=await db.prepare("SELECT id FROM stu_media WHERE created_at<?").bind(now-hours*3600000).all();
   ids=(all.results||[]).map(r=>r.id);
  }
  if(!ids.length||!why)return JSONR({error:'Media ids and a reason are required.'},400);
  const gone=[],skipped=[];
  for(const mid of ids){
   const ref=await db.prepare("SELECT sub_no FROM stu_submissions WHERE items LIKE '%'||?||'%' LIMIT 1").bind(mid).first();
   const draft=await db.prepare("SELECT creator_id FROM stu_drafts WHERE payload LIKE '%'||?||'%' LIMIT 1").bind(mid).first();
   if(ref||draft){skipped.push(mid);continue}
   await db.prepare('DELETE FROM stu_media_chunks WHERE media_id=?').bind(mid).run();
   const d=await db.prepare('DELETE FROM stu_media WHERE id=?').bind(mid).run();
   if((d.meta&&d.meta.changes))gone.push(mid);
  }
  await db.prepare('INSERT INTO stu_review_events(id,submission_id,reviewer,action,notes,created_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),'media:'+gone.length,rv.email,'delete-media',why+' | removed '+gone.length+' unattached, skipped '+skipped.length+' referenced',now).run();
  return JSONR({ok:true,removed:gone.length,skipped_referenced:skipped.length});
 }
 if(p==='/studio/api/review/delete-place'&&request.method==='POST'){
  if(request.headers.get('Origin')!==u.origin)return JSONR({error:'Origin refused.'},403);
  const rv=await stuReviewer(request,env);if(!rv)return JSONR({error:'Reviewer sign-in required.'},401);
  const b=await request.json().catch(()=>null);if(!b)return JSONR({error:'Invalid JSON.'},400);
  const pid=clean(b.place_id,40),why=clean(b.reason,400);
  if(!why)return JSONR({error:'A reason is required - deletions are audited.'},400);
  const refs=await db.prepare('SELECT count(*) n FROM stu_submissions WHERE place_id=?').bind(pid).first();
  if(refs&&refs.n>0)return JSONR({error:'Submissions still reference this place. Remove them first.'},409);
  const pl=await db.prepare('DELETE FROM stu_places WHERE id=? RETURNING name').bind(pid).first();
  if(!pl)return JSONR({error:'Unknown place.'},404);
  await db.prepare('INSERT INTO stu_review_events(id,submission_id,reviewer,action,notes,created_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),'place:'+pid,rv.email,'delete-place',why+' ('+pl.name+')',now).run();
  await db.prepare('DELETE FROM stu_engagement WHERE key=?').bind('brand_view:'+pid).run();
  return JSONR({ok:true,deleted:pl.name});
 }
 if(p==='/studio/api/review/reports'&&request.method==='GET'){
  const rv=await stuReviewer(request,env);if(!rv)return JSONR({error:'Reviewer sign-in required.'},401);
  const rows=await db.prepare("SELECT * FROM stu_reports WHERE status='OPEN' ORDER BY created_at DESC LIMIT 200").all();
  return JSONR({reports:rows.results||[]});
 }
 if(p==='/studio/api/review/report-close'&&request.method==='POST'){
  if(request.headers.get('Origin')!==u.origin)return JSONR({error:'Origin refused.'},403);
  const rv=await stuReviewer(request,env);if(!rv)return JSONR({error:'Reviewer sign-in required.'},401);
  const b=await request.json().catch(()=>null);if(!b)return JSONR({error:'Invalid JSON.'},400);
  const r=await db.prepare("UPDATE stu_reports SET status='RESOLVED' WHERE id=? AND status='OPEN'").bind(clean(b.id,40)).run();
  return JSONR({ok:true,changed:(r.meta&&r.meta.changes)||0});
 }
 if(p==='/studio/api/review/feature'&&request.method==='POST'){
  if(request.headers.get('Origin')!==u.origin)return JSONR({error:'Origin refused.'},403);
  const rv=await stuReviewer(request,env);if(!rv)return JSONR({error:'Reviewer sign-in required.'},401);
  const b=await request.json().catch(()=>null);if(!b)return JSONR({error:'Invalid JSON.'},400);
  const no=clean(b.creator_no,20),note=clean(b.note,200),on=b.featured!==false;
  const r=await db.prepare('UPDATE stu_creators SET featured=?,featured_note=?,updated_at=? WHERE creator_no=?').bind(on?1:0,on?note:'',now,no).run();
  if(!(r.meta&&r.meta.changes))return JSONR({error:'Unknown creator.'},404);
  return JSONR({ok:true,featured:on});
 }
 if(p==='/studio/api/review/creator-update'&&request.method==='POST'){
  if(request.headers.get('Origin')!==u.origin)return JSONR({error:'Origin refused.'},403);
  const rv=await stuReviewer(request,env);if(!rv)return JSONR({error:'Reviewer sign-in required.'},401);
  const b=await request.json().catch(()=>null);if(!b)return JSONR({error:'Invalid JSON.'},400);
  const no=clean(b.creator_no,20),name=clean(b.name,80),bio=b.bio===undefined?null:clean(b.bio,400);
  if(!no||!name)return JSONR({error:'creator_no and name required.'},400);
  const r=await db.prepare("UPDATE stu_creators SET full_name=?,display_name=?,bio=COALESCE(?,bio),updated_at=? WHERE creator_no=?").bind(name,name,bio,now,no).run();
  if(!(r.meta&&r.meta.changes))return JSONR({error:'Unknown creator.'},404);
  return JSONR({ok:true});
 }
 if(p==='/studio/api/review/retry-email'&&request.method==='POST'){
  if(request.headers.get('Origin')!==u.origin)return JSONR({error:'Origin refused.'},403);
  const rv=await stuReviewer(request,env);if(!rv)return JSONR({error:'Reviewer sign-in required.'},401);
  const b=await request.json().catch(()=>null);if(!b)return JSONR({error:'Invalid JSON.'},400);
  const sub=await db.prepare('SELECT * FROM stu_submissions WHERE sub_no=?').bind(clean(b.submission_id,30),).first();
  if(!sub)return JSONR({error:'Unknown submission.'},404);
  const c=await db.prepare('SELECT * FROM stu_creators WHERE id=?').bind(sub.creator_id).first();
  const det=JSON.parse(sub.details||'{}');const items=JSON.parse(sub.items||'[]');
  let es='failed';
  try{
   const r=await stuMail(env,{task:'studio_submission',submission_id:sub.sub_no,creator_name:c.full_name,creator_id:c.creator_no,creator_category:JSON.parse(c.categories||'[]').join(', '),mobile:'+91 '+c.mobile,email:c.email,place_name:sub.place_name,location:[det.address,det.locality,det.city,det.pincode].filter(Boolean).join(', '),main_category:sub.kind,content_type:sub.content_pillar,subcategories:JSON.parse(sub.subcats||'[]').join(', ')||'-',photos:String(items.filter(i=>i.type==='photo').length),videos:String(items.filter(i=>i.type==='video').length),aspect_ratios:[...new Set(items.map(i=>i.aspect))].join(', ')||'-',captions:items.map(i=>i.caption).filter(Boolean).join(' | ')||'-',credits:items.map(i=>i.credit).filter(Boolean).join(' | ')||'-',submitted_at:new Date(sub.created_at).toUTCString(),rights:'Confirmed by contributor',review_link:'https://srchn.in/studio/review/'});
   es=r.ok?'sent':'failed';
  }catch{es='failed'}
  await db.prepare('UPDATE stu_submissions SET email_status=? WHERE sub_no=?').bind(es,sub.sub_no).run();
  return JSONR({ok:true,email:es});
 }
 if(p.startsWith('/studio/api/review/brand')||p==='/studio/api/review/brands'||p==='/studio/api/review/location-status'||p==='/studio/api/review/claims'||p==='/studio/api/review/claim-decide'||p==='/studio/api/review/claim-delete'||p==='/studio/api/review/brand-detail'||p==='/studio/api/review/product-status'||p==='/studio/api/review/subscription-save'||p==='/studio/api/review/subscription-renew'||p==='/studio/api/review/subscription-status'||p==='/studio/api/review/invoice-status'||p==='/studio/api/review/club'||p==='/studio/api/review/club-invite-decide'||p==='/studio/api/review/club-member-status'||p==='/studio/api/review/club-member-delete'||p==='/studio/api/review/club-booking-config'||p==='/studio/api/review/club-ledgers'||p==='/studio/api/review/club-settle'||p==='/studio/api/review/club-ledger-status'){const brR=await brReviewRoute(p,request,env,db,now);if(brR)return brR}
 const mm=/^\/studio\/api\/media\/([0-9a-f-]{36})$/.exec(p);
 if(mm&&request.method==='GET'){
  const id=mm[1];
  const m=await db.prepare("SELECT * FROM stu_media WHERE id=? AND status='ready'").bind(id).first();
  if(!m)return JSONR({error:'Not found.'},404);
  const c=await stuAuth(request,db);
  const rv=await stuReviewer(request,env);
  let pub=false;
  if(!c&&!rv){pub=!!(await db.prepare("SELECT sub_no FROM stu_submissions WHERE status IN ('APPROVED','PUBLISHED') AND items LIKE '%'||?||'%' LIMIT 1").bind(id).first());if(!pub)return JSONR({error:'Sign in required.'},401)}
  if(c&&c.id!==m.creator_id&&!rv)return JSONR({error:'Not your upload.'},403);
  const range=request.headers.get('Range');
  let start=0,end=m.bytes-1;
  if(range){const rm=/bytes=(\d+)-(\d*)/.exec(range);if(rm){start=+rm[1];if(rm[2])end=Math.min(+rm[2],m.bytes-1)}}
  if(start>=m.bytes||start>end)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+m.bytes}});
  const maxSpan=4*STU_CHUNK;
  if(end-start+1>maxSpan)end=start+maxSpan-1;
  const s0=Math.floor(start/STU_CHUNK),s1=Math.floor(end/STU_CHUNK);
  const rows=await db.prepare('SELECT seq,data,length(data) AS blen FROM stu_media_chunks WHERE media_id=? AND seq>=? AND seq<=? ORDER BY seq').bind(id,s0,s1).all();
  if((rows.results||[]).length!==s1-s0+1)return JSONR({error:'Media data incomplete.'},500);
  const toBytes=d=>{if(Array.isArray(d))return new Uint8Array(d);if(d instanceof ArrayBuffer)return new Uint8Array(d);if(ArrayBuffer.isView(d))return new Uint8Array(d.buffer,d.byteOffset,d.byteLength);if(typeof d==='string'){let b;try{b=atob(d)}catch{return new Uint8Array(0)}return Uint8Array.from(b,c=>c.charCodeAt(0))}return new Uint8Array(0)};
  const parts=(rows.results||[]).map(r=>toBytes(r.data));
  const total=parts.reduce((a,x)=>a+x.byteLength,0);
  if(!total)return JSONR({error:'Media data incomplete.'},500);
  const buf=new Uint8Array(total);let off=0;
  for(const x of parts){buf.set(x,off);off+=x.byteLength}
  const slice=buf.subarray(start-s0*STU_CHUNK,end-s0*STU_CHUNK+1);
  const h={'Content-Type':m.mime,'Accept-Ranges':'bytes','Cache-Control':pub?'public, max-age=86400':'private, max-age=3600','Content-Length':String(slice.byteLength)};
  if(range){h['Content-Range']='bytes '+start+'-'+end+'/'+m.bytes;return new Response(slice,{status:206,headers:h})}
  return new Response(slice,{status:200,headers:h});
 }
 return JSONR({error:'Not found.'},404);
}

/* ---------- SRCHN BRANDS (master spec) : public SSR + data model ---------- */
const BR_CATS=['Restaurants','Cafes','Breweries','Hotels and resorts','Co-living','Commercial offices','Coworking spaces','Retail','Beauty and wellness','Fitness and sports','Entertainment','Events and nightlife','Travel and experiences','Education','Healthcare','Lifestyle','Other'];
async function brTables(db){
 await db.prepare("CREATE TABLE IF NOT EXISTS br_brands(id TEXT PRIMARY KEY,slug TEXT UNIQUE NOT NULL,name TEXT NOT NULL,category TEXT NOT NULL,subcategory TEXT,tagline TEXT,description TEXT,website TEXT,socials TEXT,founded_year TEXT,founders TEXT,hq_city TEXT,verified INTEGER NOT NULL DEFAULT 0,club INTEGER NOT NULL DEFAULT 0,featured INTEGER NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'DRAFT',created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,published_at INTEGER)").run();
 await db.prepare("CREATE TABLE IF NOT EXISTS br_locations(id TEXT PRIMARY KEY,brand_id TEXT NOT NULL,slug TEXT NOT NULL,name TEXT NOT NULL,address TEXT,locality TEXT,city TEXT,state TEXT,pincode TEXT,lat REAL,lon REAL,phone TEXT,hours TEXT,facilities TEXT,booking_enabled INTEGER NOT NULL DEFAULT 0,visit_enabled INTEGER NOT NULL DEFAULT 0,pay_enabled INTEGER NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'DRAFT',created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,UNIQUE(brand_id,slug))").run();
 await db.prepare("CREATE TABLE IF NOT EXISTS br_media_links(id TEXT PRIMARY KEY,brand_id TEXT NOT NULL,location_id TEXT,media_id TEXT NOT NULL,kind TEXT NOT NULL DEFAULT 'photo',pillar TEXT NOT NULL,category TEXT,title TEXT,description TEXT,credit TEXT,featured INTEGER NOT NULL DEFAULT 0,pinned INTEGER NOT NULL DEFAULT 0,position INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL)").run();
 await db.prepare("CREATE TABLE IF NOT EXISTS br_faqs(id TEXT PRIMARY KEY,brand_id TEXT NOT NULL,location_id TEXT,q TEXT NOT NULL,a TEXT NOT NULL,position INTEGER NOT NULL DEFAULT 0)").run();
 await db.prepare("CREATE TABLE IF NOT EXISTS br_campaigns(id TEXT PRIMARY KEY,brand_id TEXT NOT NULL,title TEXT NOT NULL,pillar TEXT NOT NULL DEFAULT 'marketing',description TEXT,poster_media TEXT,video_media TEXT,start_at INTEGER,end_at INTEGER,locations TEXT,terms TEXT,cta_label TEXT,cta_url TEXT,status TEXT NOT NULL DEFAULT 'DRAFT',created_at INTEGER NOT NULL)").run();
 await db.prepare("CREATE TABLE IF NOT EXISTS br_products(id TEXT PRIMARY KEY,brand_id TEXT NOT NULL,location_id TEXT,kind TEXT NOT NULL DEFAULT 'product',name TEXT NOT NULL,description TEXT,category TEXT,price_text TEXT,availability TEXT,link TEXT,status TEXT NOT NULL DEFAULT 'DRAFT',created_at INTEGER NOT NULL)").run();
 await db.prepare("CREATE TABLE IF NOT EXISTS br_views(id INTEGER PRIMARY KEY AUTOINCREMENT,brand_id TEXT NOT NULL,location_id TEXT,kind TEXT NOT NULL,ts INTEGER NOT NULL)").run();
 await db.prepare("CREATE TABLE IF NOT EXISTS br_categories(name TEXT PRIMARY KEY,position INTEGER NOT NULL DEFAULT 0)").run();
 await db.prepare("CREATE TABLE IF NOT EXISTS br_audit(id INTEGER PRIMARY KEY AUTOINCREMENT,actor TEXT,action TEXT,brand_id TEXT,detail TEXT,ts INTEGER NOT NULL)").run();
 await db.prepare("CREATE TABLE IF NOT EXISTS br_claims(id TEXT PRIMARY KEY,brand_id TEXT,requested_name TEXT,requested_category TEXT,requested_locality TEXT,creator_id TEXT NOT NULL,claimant_role TEXT,proof_note TEXT,status TEXT NOT NULL DEFAULT 'PENDING',reviewer TEXT,review_note TEXT,created_at INTEGER NOT NULL,decided_at INTEGER)").run();
 await db.prepare("CREATE TABLE IF NOT EXISTS br_members(id TEXT PRIMARY KEY,brand_id TEXT NOT NULL,creator_id TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'owner',status TEXT NOT NULL DEFAULT 'ACTIVE',added_by TEXT,created_at INTEGER NOT NULL,UNIQUE(brand_id,creator_id))").run();
 await db.prepare("CREATE TABLE IF NOT EXISTS br_subscriptions(id TEXT PRIMARY KEY,brand_id TEXT NOT NULL,plan TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'ACTIVE',price_inr INTEGER NOT NULL,start_at INTEGER NOT NULL,renew_at INTEGER NOT NULL,note TEXT,created_by TEXT,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL)").run();
 await db.prepare("CREATE TABLE IF NOT EXISTS br_invoices(id TEXT PRIMARY KEY,inv_no TEXT UNIQUE NOT NULL,brand_id TEXT NOT NULL,subscription_id TEXT,period TEXT,amount_inr INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'ISSUED',pay_ref TEXT,issued_at INTEGER NOT NULL,paid_at INTEGER,created_by TEXT)").run();
 const c=await db.prepare('SELECT COUNT(*) AS n FROM br_categories').first();
 if(!c||!c.n){const st=await db.prepare('INSERT OR IGNORE INTO br_categories(name,position) VALUES(?,?)');let i=0;for(const n of BR_CATS){await st.bind(n,i++).run()}}
}
const brSlug=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60);
async function brRole(db,brandId,creatorId){const m=await db.prepare("SELECT role FROM br_members WHERE brand_id=? AND creator_id=? AND status='ACTIVE'").bind(brandId,creatorId).first();return m?m.role:null}
const brEsc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const brMediaUrl=id=>'/studio/api/media/'+encodeURIComponent(id);
function brNav(active){
 const items=[['/discovery/','i-compass','Explore'],['/brands/','i-shopping-bag','Brands'],['/studio/','i-clapperboard','Studio'],['/club/','i-users','Club'],['/bangalore/','i-sparkles','Your Local Buddy']];
 return items.map(([h,i,l])=>'<a '+(l===active?'aria-current="page" ':'')+'href="'+h+'"'+(l==='Your Local Buddy'?' rel="noopener" target="_blank"':'')+'><svg aria-hidden="true" class="icon"><use href="/assets/redesign/icons.svg#'+i+'"></use></svg><span>'+l+'</span></a>').join('');
}
function brChrome(o){
 const jsonld=(o.jsonld||[]).map(j=>'<script type="application/ld+json">'+JSON.stringify(j)+'</script>').join('\n');
 return '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8"/>\n<meta content="width=device-width,initial-scale=1" name="viewport"/>\n<title>'+brEsc(o.title)+'</title>\n<meta content="'+brEsc(o.desc)+'" name="description"/>\n<link href="'+o.canon+'" rel="canonical"/>\n<meta content="'+brEsc(o.title)+'" property="og:title"/><meta content="'+brEsc(o.desc)+'" property="og:description"/><meta content="website" property="og:type"/><meta content="'+o.canon+'" property="og:url"/>\n<link href="/assets/redesign/srchn-redesign.css" rel="stylesheet"/>\n<link href="/assets/brand/favicon.svg" rel="icon" type="image/svg+xml"/><link href="/assets/brand/favicon-32.png" rel="icon" sizes="any"/>\n<link href="/assets/brand/apple-touch-icon.png" rel="apple-touch-icon"/>\n<link href="/site.webmanifest" rel="manifest"/>\n<meta content="#ffffff" name="theme-color"/>\n<link href="/assets/brand/brand.css" rel="stylesheet"/>\n<link href="/assets/fonts/typography-base.css" rel="stylesheet"/>\n<link href="/brands/brands.css" rel="stylesheet"/>\n<link href="/discovery/vendor/leaflet.css" rel="stylesheet"/>\n'+jsonld+'\n</head>\n<body class="br-body">\n<header class="srchn-header"><a aria-label="SRCHN home" class="srchn-logo brand-logo-link" href="/"><span class="brand-lockup-nav" aria-hidden="true"><img class="brand-maze" src="/assets/brand/master-kit/02_Maze_Icon/PNG/srchn-maze-64.png" alt="" width="40" height="40" loading="eager" decoding="async"><img class="brand-wordmark" src="/assets/brand/master-kit/01_Master_Logo/PNG/SRCHN_Wordmark_Black.png" alt="" width="164" height="36" loading="eager" decoding="async"></span><img class="brand-logo brand-logo-icon" src="/assets/brand/master-kit/02_Maze_Icon/PNG/srchn-maze-64.png" alt="" width="40" height="40" loading="eager" decoding="async"></a><nav aria-label="Primary" class="srchn-nav">'+brNav(o.active||'Brands')+'</nav></header>\n<main>\n'+o.body+'\n</main>\n<footer class="br-footer"><p>SRCHN — SEE IT BEFORE YOU GO.</p><p class="br-footer-links"><a href="/brands/">Brands</a> · <a href="/studio/">Studio</a> · <a href="/club/">Club</a> · <a href="/property/">Property</a></p></footer>\n<script src="/discovery/vendor/leaflet.js" defer></script>\n<script src="/brands/brands.js" defer></script>\n<script src="/brands/club-demo.js" defer></script>\n</body>\n</html>';
}
function brCard(b){
 const loc=b.loc_count>0?b.loc_count+' location'+(b.loc_count>1?'s':''):'';
 return '<article class="br-card"><a class="br-card-link" href="/brands/'+brEsc(b.slug)+'/">'+(b.logo_media?'<img class="br-card-logo" src="'+brMediaUrl(b.logo_media)+'" alt="'+brEsc(b.name)+' logo" loading="lazy"/>':'<span class="br-card-initial" aria-hidden="true">'+brEsc((b.name||'?')[0])+'</span>')+'<h3>'+brEsc(b.name)+'</h3><p class="br-card-meta">'+brEsc([b.category,b.first_locality].filter(Boolean).join(' · '))+'</p>'+(b.tagline?'<p class="br-card-tag">'+brEsc(b.tagline)+'</p>':'')+(loc?'<p class="br-card-locs">'+loc+'</p>':'')+'<span class="br-card-cta">Explore Brand</span></a></article>';
}
async function brListQuery(db,where,args){
 return db.prepare("SELECT b.*,(SELECT COUNT(*) FROM br_locations l WHERE l.brand_id=b.id AND l.status='PUBLISHED') AS loc_count,(SELECT locality FROM br_locations l WHERE l.brand_id=b.id AND l.status='PUBLISHED' ORDER BY created_at LIMIT 1) AS first_locality,(SELECT media_id FROM br_media_links m WHERE m.brand_id=b.id AND m.pillar='identity' AND m.category='logo' LIMIT 1) AS logo_media FROM br_brands b WHERE "+where+" ORDER BY b.featured DESC,b.published_at DESC LIMIT 60").bind(...args).all();
}
async function brandsRoute(request,env){
 const u=new URL(request.url),p=u.pathname,now=Date.now(),db=env.DB;
 if(!db)return JSONR({error:'Brand storage unavailable.'},503);
 await brTables(db);
 /* public APIs */
 if(p==='/brands/api/search'&&request.method==='GET'){
  const q=(u.searchParams.get('q')||'').trim().slice(0,80),cat=(u.searchParams.get('category')||'').trim().slice(0,60),loc=(u.searchParams.get('locality')||'').trim().slice(0,60);
  let where="b.status='PUBLISHED'",args=[];
  if(q){where+=" AND (b.name LIKE ? OR b.category LIKE ? OR b.tagline LIKE ? OR b.description LIKE ?)";const w='%'+q+'%';args.push(w,w,w,w)}
  if(cat){where+=" AND b.category=?";args.push(cat)}
  if(loc){where+=" AND EXISTS(SELECT 1 FROM br_locations l WHERE l.brand_id=b.id AND l.status='PUBLISHED' AND l.locality=?)";args.push(loc)}
  if(u.searchParams.get('club')==='1'){where+=" AND b.club=1"}
  if(u.searchParams.get('multiloc')==='1'){where+=" AND (SELECT COUNT(*) FROM br_locations l WHERE l.brand_id=b.id AND l.status='PUBLISHED')>1"}
  if(u.searchParams.get('booking')==='1'){where+=" AND EXISTS(SELECT 1 FROM br_locations l WHERE l.brand_id=b.id AND l.status='PUBLISHED' AND l.booking_enabled=1)"}
  const rows=await brListQuery(db,where,args);
  return JSONR({brands:(rows.results||[]).map(b=>({slug:b.slug,name:b.name,category:b.category,tagline:b.tagline||'',locality:b.first_locality||'',locations:b.loc_count,club:b.club===1,verified:b.verified===1,logo:b.logo_media?brMediaUrl(b.logo_media):null}))});
 }
 if(p==='/brands/api/view'&&request.method==='POST'){
  const b=await request.json().catch(()=>null);if(!b)return JSONR({error:'Invalid JSON.'},400);
  const bid=clean(b.brand_id,40);if(!bid)return JSONR({error:'brand_id required.'},400);
  const kind=['brand','location','video'].includes(b.kind)?b.kind:'brand';
  await db.prepare('INSERT INTO br_views(brand_id,location_id,kind,ts) VALUES(?,?,?,?)').bind(bid,clean(b.location_id,40)||null,kind,now).run();
  return JSONR({ok:true});
 }
 if(p==='/brands/sitemap.xml'){
  const bs=await db.prepare("SELECT slug,published_at FROM br_brands WHERE status='PUBLISHED'").all();
  const ls=await db.prepare("SELECT b.slug AS bslug,l.slug AS lslug FROM br_locations l JOIN br_brands b ON b.id=l.brand_id WHERE l.status='PUBLISHED' AND b.status='PUBLISHED'").all();
  const urls=['<url><loc>'+u.origin+'/brands/</loc></url>'].concat((bs.results||[]).map(b=>'<url><loc>'+u.origin+'/brands/'+b.slug+'/</loc></url>')).concat((ls.results||[]).map(l=>'<url><loc>'+u.origin+'/brands/'+l.bslug+'/locations/'+l.lslug+'/</loc></url>'));
  return new Response('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+urls.join('\n')+'\n</urlset>',{headers:{'Content-Type':'application/xml; charset=utf-8'}});
 }
 /* SSR: landing */
 if(p==='/brands/'||p==='/brands'){
  const q=(u.searchParams.get('q')||'').trim().slice(0,80),cat=(u.searchParams.get('category')||'').trim().slice(0,60),loc=(u.searchParams.get('locality')||'').trim().slice(0,60);
  let where="b.status='PUBLISHED'",args=[];
  if(q){where+=" AND (b.name LIKE ? OR b.category LIKE ? OR b.tagline LIKE ?)";const w='%'+q+'%';args.push(w,w,w)}
  if(cat){where+=" AND b.category=?";args.push(cat)}
  if(loc){where+=" AND EXISTS(SELECT 1 FROM br_locations l WHERE l.brand_id=b.id AND l.status='PUBLISHED' AND l.locality=?)";args.push(loc)}
  const filtered=q||cat||loc;
  const all=await brListQuery(db,where,args);
  const brands=all.results||[];
  const cats=await db.prepare('SELECT name FROM br_categories ORDER BY position').all();
  const locs=await db.prepare("SELECT DISTINCT locality FROM br_locations WHERE status='PUBLISHED' AND locality IS NOT NULL AND locality!='' ORDER BY locality LIMIT 40").all();
  const trend=await db.prepare("SELECT b.*,(SELECT COUNT(*) FROM br_locations l WHERE l.brand_id=b.id AND l.status='PUBLISHED') AS loc_count,(SELECT locality FROM br_locations l WHERE l.brand_id=b.id AND l.status='PUBLISHED' ORDER BY created_at LIMIT 1) AS first_locality,(SELECT media_id FROM br_media_links m WHERE m.brand_id=b.id AND m.pillar='identity' AND m.category='logo' LIMIT 1) AS logo_media,(SELECT COUNT(*) FROM br_views v WHERE v.brand_id=b.slug AND v.ts>?) AS views7d FROM br_brands b WHERE b.status='PUBLISHED' AND (SELECT COUNT(*) FROM br_views v WHERE v.brand_id=b.slug AND v.ts>?)>0 ORDER BY views7d DESC LIMIT 8").bind(now-7*86400000,now-7*86400000).all();
  const multi=brands.filter(b=>b.loc_count>1);
  const clubBrands=brands.filter(b=>b.club===1);
  let body='<section class="br-hero br-hero-slim"><p class="br-eyebrow">SRCHN BRANDS</p><h1>MEET THE BRANDS THAT MAKE YOUR CITY.</h1><p class="br-lede">Explore the places, spaces and experiences behind the brands you love. Watch their stories, discover every location and see what awaits before you visit.</p></section>';
  body+='<section class="br-sec" id="explore"><h2>Explore brands</h2><form class="br-search" method="get" action="/brands/"><input type="search" name="q" value="'+brEsc(q)+'" placeholder="Search brands, categories, experiences..." aria-label="Search brands"/><select name="category" aria-label="Category"><option value="">All categories</option>'+(cats.results||[]).map(c=>'<option '+(cat===c.name?'selected ':'')+'value="'+brEsc(c.name)+'">'+brEsc(c.name)+'</option>').join('')+'</select><select name="locality" aria-label="Locality"><option value="">All localities</option>'+(locs.results||[]).map(l=>'<option '+(loc===l.locality?'selected ':'')+'value="'+brEsc(l.locality)+'">'+brEsc(l.locality)+'</option>').join('')+'</select><button class="br-btn br-btn-primary" type="submit">Search</button></form>';
  if(filtered)body+='<p class="br-result-note">'+brands.length+' result'+(brands.length===1?'':'s')+(q?' for &ldquo;'+brEsc(q)+'&rdquo;':'')+'. <a href="/brands/">Clear</a></p>';
  body+=brands.length?'<div class="br-grid">'+brands.map(brCard).join('')+'</div>':'<p class="br-empty">'+(filtered?'No brands match this search yet.':'Brands will appear here as Team SRCHN approves them.')+'</p>';
  body+='</section>';
  body+='<section class="br-sec"><div class="cl-note"><b>Interface demos.</b><br/>Tappable mockups of how SRCHN PAY checkout, DigiLocker brand-owner verification and DigiYatra-style face verification will work on SRCHN - no real payments, no real verification, nothing leaves your device.<br/><a href="/brands/demo/#pay">SRCHN PAY demo</a> &middot; <a href="/brands/demo/#digilocker">DigiLocker demo</a> &middot; <a href="/brands/demo/#face">Face verification demo</a></div></section>';
  if(!filtered){
   if((trend.results||[]).length)body+='<section class="br-sec"><h2>Trending this week</h2><div class="br-grid">'+trend.results.map(brCard).join('')+'</div></section>';
   body+='<section class="br-sec"><h2>Explore by category</h2><div class="br-chips">'+(cats.results||[]).map(c=>'<a class="br-chip" href="/brands/?category='+encodeURIComponent(c.name)+'">'+brEsc(c.name)+'</a>').join('')+'</div></section>';
   if((locs.results||[]).length)body+='<section class="br-sec"><h2>Explore by locality</h2><div class="br-chips">'+(locs.results||[]).map(l=>'<a class="br-chip" href="/brands/?locality='+encodeURIComponent(l.locality)+'">'+brEsc(l.locality)+'</a>').join('')+'</div></section>';
   if(multi.length)body+='<section class="br-sec"><h2>Multi-location brands</h2><div class="br-grid">'+multi.map(brCard).join('')+'</div></section>';
   body+='<section class="br-sec br-club"><h2>SRCHN CLUB</h2><p>SRCHN CLUB is an invite-only access layer for curated brands, places, spaces and experiences. Members see participating brands, member offers and booking privileges. It is not a public discount directory.</p>'+(clubBrands.length?'<div class="br-grid">'+clubBrands.map(brCard).join('')+'</div>':'<p class="br-empty">Participating brands will be shown here once approved for Club.</p>')+'<a class="br-btn br-btn-ghost" href="/club/">Learn about Club</a></section>';
   body+='<section class="br-sec br-onboard"><h2>Own a brand?</h2><p>Feature your brand on SRCHN with virtual tours, product stories and marketing videos - reviewed by Team SRCHN before anything goes live.</p><div class="br-price-grid"><div class="cl-card"><h3>VIRTUAL TOUR VIDEOS</h3><p>Interiors, exteriors, washrooms, building view, street view, facade, emergency exits, parking, lifts and cafeteria.</p></div><div class="cl-card"><h3>PRODUCT VIDEOS</h3><p>Categories, menu, facilities, founders, team, departments, town halls, hiring, ambassadors and influencers.</p></div><div class="cl-card"><h3>MARKETING VIDEOS</h3><p>Brand origin story, new product launches, festival offers, end-of-season sales, customer testimonials, CSR activities, weekly and monthly promotions, meetups and events.</p></div></div><div class="br-price-grid"><div class="cl-card"><h3>Rs 3,000 / month</h3><p>30 videos live on the SRCHN platform. Each video up to 30 seconds, 1080p HD quality.</p></div><div class="cl-card"><h3>Rs 30,000 one-time</h3><p>One-time listing fee starting from Rs 30,000 for 1 year - all videos included. Each video up to 30 seconds, 1080p HD quality.</p></div></div><a class="br-btn br-btn-primary" href="/studio/join/">FEATURE YOUR BRAND ON SRCHN</a></section>';
  }
  const jsonld=[{'@context':'https://schema.org','@type':'WebSite',name:'SRCHN',url:u.origin+'/'},{'@context':'https://schema.org','@type':'WebPage',name:'SRCHN BRANDS',description:'Discover the brands behind your city. Videos, locations, experiences - reviewed by Team SRCHN.',url:u.origin+'/brands/'}];
  return new Response(brChrome({title:'SRCHN BRANDS — Meet the brands that make your city.',desc:'Explore the places, spaces and experiences behind the brands you love. Watch their stories, discover every location and see what awaits before you visit.',canon:u.origin+'/brands/',body,jsonld}),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'public, max-age=120'}});
 }
 /* SSR: brand profile + branch pages */
 const m=/^\/brands\/([a-z0-9-]+)\/(?:locations\/([a-z0-9-]+)\/)?$/.exec(p);
 if(m&&m[1]!=='workspace'){
  const b=await db.prepare("SELECT * FROM br_brands WHERE slug=? AND status='PUBLISHED'").bind(m[1]).first();
  if(!b)return new Response(brChrome({title:'Brand not found — SRCHN BRANDS',desc:'This brand is not published on SRCHN.',canon:u.origin+'/brands/',body:'<section class="br-sec"><h1>Brand not found</h1><p>This brand is not published on SRCHN yet. <a href="/brands/">Explore brands</a>.</p></section>'}),{status:404,headers:{'Content-Type':'text/html; charset=utf-8'}});
  const locs=(await db.prepare("SELECT * FROM br_locations WHERE brand_id=? AND status='PUBLISHED' ORDER BY created_at").bind(b.id).all()).results||[];
  const media=(await db.prepare('SELECT * FROM br_media_links WHERE brand_id=? ORDER BY pinned DESC,featured DESC,position,created_at').bind(b.id).all()).results||[];
  const faqs=(await db.prepare('SELECT * FROM br_faqs WHERE brand_id=? ORDER BY position,rowid').bind(b.id).all()).results||[];
  const camps=(await db.prepare("SELECT * FROM br_campaigns WHERE brand_id=? AND status='PUBLISHED' AND (end_at IS NULL OR end_at=0 OR end_at>?) ORDER BY start_at DESC").bind(b.id,Math.floor(now/1000)).all()).results||[];
  if(m[2]){
   const l=locs.find(x=>x.slug===m[2]);
   if(!l)return new Response(brChrome({title:'Location not found — SRCHN BRANDS',desc:'This location is not published on SRCHN.',canon:u.origin+'/brands/'+b.slug+'/',body:'<section class="br-sec"><h1>Location not found</h1><p><a href="/brands/'+brEsc(b.slug)+'/">Back to '+brEsc(b.name)+'</a>.</p></section>'}),{status:404,headers:{'Content-Type':'text/html; charset=utf-8'}});
   const lmedia=media.filter(x=>x.location_id===l.id||!x.location_id);
   const lfaqs=faqs.filter(x=>x.location_id===l.id||!x.location_id);
   const dirs=l.lat&&l.lon?'https://www.google.com/maps/dir/?api=1&destination='+l.lat+','+l.lon:'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent([b.name,l.address,l.locality,l.city].filter(Boolean).join(' '));
   const facs=(()=>{try{return JSON.parse(l.facilities||'[]')}catch{return[]}})();
   let body='<nav class="br-crumb" aria-label="Breadcrumb"><a href="/brands/">Brands</a> / <a href="/brands/'+brEsc(b.slug)+'/">'+brEsc(b.name)+'</a> / <span>'+brEsc(l.name)+'</span></nav>';
   body+='<section class="br-sec"><p class="br-eyebrow">'+brEsc(b.category)+'</p><h1>'+brEsc(b.name)+' '+brEsc(l.name)+'</h1>'+(b.club?'<p class="br-club-badge">SRCHN CLUB</p>':'')+(l.address?'<p class="br-addr">'+brEsc([l.address,l.locality,l.city,l.state,l.pincode].filter(Boolean).join(', '))+'</p>':'')+'<div class="br-cta-row">'+(l.phone?'<a class="br-btn br-btn-ghost" href="tel:'+brEsc(l.phone)+'">Call</a>':'')+'<a class="br-btn br-btn-primary" href="'+brEsc(dirs)+'" rel="noopener" target="_blank">Directions</a>'+'<a class="br-btn br-btn-primary" href="/club/book/?l='+brEsc(l.id)+'">BOOK</a>'+'<a class="br-btn br-btn-ghost br-locked" data-visit-loc="'+brEsc(l.id)+'" href="/club/book/?l='+brEsc(l.id)+'">VISIT &middot; book first</a>'+'<button class="br-btn br-btn-ghost" data-demo-open="pay" data-brand="'+brEsc(b.name+' - '+l.name)+'">PAY &middot; DEMO</button></div>';
   body+='<dl class="br-facts">'+(l.locality?'<div><dt>Locality</dt><dd>'+brEsc(l.locality)+'</dd></div>':'')+(l.city?'<div><dt>City</dt><dd>'+brEsc(l.city)+'</dd></div>':'')+(l.hours?'<div><dt>Hours</dt><dd>'+brEsc(l.hours)+'</dd></div>':'')+'</dl>';
   if(facs.length)body+='<h2>Facilities</h2><ul class="br-list">'+facs.map(f=>'<li>'+brEsc(f)+'</li>').join('')+'</ul>';
   if(lmedia.length)body+='<h2>Videos and photos</h2><div class="br-media-grid">'+lmedia.map(x=>brMediaTile(x)).join('')+'</div>';
   body+='<p class="br-updated">Details last updated '+new Date(l.updated_at).toISOString().slice(0,10)+'.</p></section>';
   if(lfaqs.length)body+='<section class="br-sec"><h2>Questions about '+brEsc(b.name)+' '+brEsc(l.name)+'</h2>'+lfaqs.map(f=>'<details class="br-faq"><summary>'+brEsc(f.q)+'</summary><p>'+brEsc(f.a)+'</p></details>').join('')+'</section>';
   const jsonld=[{'@context':'https://schema.org','@type':'LocalBusiness',name:b.name+' '+l.name,address:{'@type':'PostalAddress',streetAddress:l.address||'',addressLocality:l.city||'Bengaluru',addressRegion:l.state||'Karnataka',postalCode:l.pincode||'',addressCountry:'IN'},url:u.origin+'/brands/'+b.slug+'/locations/'+l.slug+'/'},{'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Brands',item:u.origin+'/brands/'},{'@type':'ListItem',position:2,name:b.name,item:u.origin+'/brands/'+b.slug+'/'},{'@type':'ListItem',position:3,name:l.name}]}];
   if(lfaqs.length)jsonld.push({'@context':'https://schema.org','@type':'FAQPage',mainEntity:lfaqs.map(f=>({'@type':'Question',name:f.q,acceptedAnswer:{'@type':'Answer',text:f.a}}))});
   return new Response(brChrome({title:b.name+' '+l.name+', '+(((l.locality||'').toLowerCase()===(l.name||'').toLowerCase())?(l.city||'Bengaluru'):(l.locality||l.city||'Bengaluru'))+' — Videos, Location & Experiences | SRCHN',desc:'Explore '+b.name+' '+l.name+' through virtual tour videos, products, facilities, location details and available experiences on SRCHN. See it before you go.',canon:u.origin+'/brands/'+b.slug+'/locations/'+l.slug+'/',body,jsonld}),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'public, max-age=120'}});
  }
  /* master brand page */
  const socials=(()=>{try{return JSON.parse(b.socials||'{}')}catch{return{}}})();
  const hero=media.find(x=>x.featured&&x.pillar!=='identity')||media.find(x=>x.pillar!=='identity');
  const logo=media.find(x=>x.pillar==='identity'&&x.category==='logo');
  const anyBook=locs.some(l=>l.booking_enabled),anyPay=locs.some(l=>l.pay_enabled);
  let body='<nav class="br-crumb" aria-label="Breadcrumb"><a href="/brands/">Brands</a> / <span>'+brEsc(b.name)+'</span></nav>';
  body+='<section class="br-brand-head">'+(logo?'<img class="br-brand-logo" src="'+brMediaUrl(logo.media_id)+'" alt="'+brEsc(b.name)+' logo"/>':'')+'<p class="br-eyebrow">'+brEsc(b.category+(b.subcategory?' · '+b.subcategory:''))+'</p><h1>'+brEsc(b.name)+'</h1>'+(b.club?'<p class="br-club-badge">SRCHN CLUB</p>':'')+(b.tagline?'<p class="br-lede">'+brEsc(b.tagline)+'</p>':'')+(b.verified?'<p class="br-verified"><svg aria-hidden="true" class="icon"><use href="/assets/redesign/icons.svg#i-badge-check"></use></svg> Verified by SRCHN</p>':'');
  body+='<dl class="br-facts">'+(b.founded_year?'<div><dt>Founded</dt><dd>'+brEsc(b.founded_year)+'</dd></div>':'')+(b.founders?'<div><dt>Founders</dt><dd>'+brEsc(b.founders)+'</dd></div>':'')+(b.hq_city?'<div><dt>City</dt><dd>'+brEsc(b.hq_city)+'</dd></div>':'')+(locs.length?'<div><dt>Locations</dt><dd>'+locs.length+'</dd></div>':'')+'</dl>';
  body+='<div class="br-cta-row">'+(locs.length?'<a class="br-btn br-btn-primary" href="#locations">EXPLORE LOCATIONS</a>':'')+(locs.length?'<a class="br-btn br-btn-primary" href="/club/book/?b='+brEsc(b.id)+'">BOOK</a>':'')+(locs.length?'<a class="br-btn br-btn-ghost br-locked" data-visit-loc="'+brEsc(locs.map(x=>x.id).join(','))+'" href="/club/book/?b='+brEsc(b.id)+'">VISIT &middot; book first</a>':'')+'<button class="br-btn br-btn-ghost" data-demo-open="pay" data-brand="'+brEsc(b.name)+'">PAY &middot; DEMO</button>'+'<button class="br-btn br-btn-ghost" data-br-save="'+brEsc(b.id)+'" data-br-name="'+brEsc(b.name)+'">Save</button><button class="br-btn br-btn-ghost" data-br-share="'+brEsc(b.name+'" data-br-url="'+u.origin+'/brands/'+b.slug+'/')+'">Share</button><a class="br-btn br-btn-ghost" href="/club/">JOIN SRCHN CLUB</a></div>';
  if(b.website||Object.keys(socials).length)body+='<p class="br-links">'+(b.website?'<a href="'+brEsc(b.website)+'" rel="noopener" target="_blank">Official website</a> ':'')+Object.entries(socials).map(([k,v])=>'<a href="'+brEsc(v)+'" rel="noopener" target="_blank">'+brEsc(k)+'</a>').join(' ')+'</p>';
  body+='<p class="br-report"><button class="br-linkbtn" data-br-report="'+brEsc(b.id)+'" data-br-name="'+brEsc(b.name)+'">Report incorrect information</button></p></section>';
  if(hero)body+='<section class="br-hero-media"><div class="br-video-wrap">'+(hero.kind==='video'?'<video class="br-video" controls playsinline preload="none" poster="" src="'+brMediaUrl(hero.media_id)+'"></video>':'<img class="br-video" loading="lazy" src="'+brMediaUrl(hero.media_id)+'" alt="'+brEsc(hero.title||b.name)+'"/>')+'</div><p class="br-video-meta">'+brEsc(hero.title||b.name)+(hero.credit?' · '+brEsc(hero.credit):'')+'</p></section>';
  if(b.description)body+='<section class="br-sec"><h2>About '+brEsc(b.name)+'</h2><div class="br-prose">'+b.description.split(/\n{2,}/).map(x=>'<p>'+brEsc(x)+'</p>').join('')+'</div></section>';
  const pillars=[['tour','VIRTUAL TOUR'],['product','PRODUCTS'],['marketing','MARKETING']];
  const BR_SLOTS={tour:['Interiors','Exteriors','Washrooms','Building view','Street view','Facade','Emergency exits','Parking','Lifts','Cafeteria'],product:['Categories','Menu','Facilities','Founders','Team','Departments','Town halls','Hiring','Ambassadors','Influencers'],marketing:['Brand origin story','New product launches','Festival offers','End-of-season sales','Customer testimonials','CSR activities','Weekly promotions','Monthly promotions','Meetups','Events']};
  const slotSlug=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-');
  body+='<section class="br-sec"><div class="br-tabs" role="tablist">'+pillars.map(([k,l],i)=>'<button class="br-tab'+(i===0?' active':'')+'" role="tab" data-br-tab="'+k+'">'+l+'</button>').join('')+'</div>'+pillars.map(([k,l],i)=>{
   const items=media.filter(x=>x.pillar===k);
   const used=new Set();
   const slots=(BR_SLOTS[k]||[]).map(sn=>{
    const ss=slotSlug(sn);
    const hit=items.find(x=>!used.has(x.media_id)&&slotSlug(x.category||'')===ss);
    if(hit){used.add(hit.media_id);return brMediaTile(hit)}
    return '<figure class="br-media br-media-empty"><div class="br-media-ph" aria-hidden="true"><svg class="icon"><use href="/assets/redesign/icons.svg#i-clapperboard"></use></svg></div><figcaption>'+brEsc(sn)+' <span class="br-credit">video coming soon</span></figcaption></figure>';
   }).join('');
   const extra=items.filter(x=>!used.has(x.media_id)).map(x=>brMediaTile(x)).join('');
   const campsHtml=k==='marketing'&&camps.length?'<div class="br-camps">'+camps.map(c=>'<article class="br-camp"><h3>'+brEsc(c.title)+'</h3><p>'+brEsc(c.description||'')+'</p>'+(c.start_at?'<p class="br-camp-dates">'+new Date(c.start_at*1000).toISOString().slice(0,10)+(c.end_at?' → '+new Date(c.end_at*1000).toISOString().slice(0,10):'')+'</p>':'')+(c.terms?'<p class="br-camp-terms">'+brEsc(c.terms)+'</p>':'')+(c.cta_url?'<a class="br-btn br-btn-ghost" href="'+brEsc(c.cta_url)+'">'+brEsc(c.cta_label||'Learn more')+'</a>':'')+'</article>').join('')+'</div>':'';
   return '<div class="br-panel'+(i===0?' active':'')+'" data-br-panel="'+k+'"><div class="br-media-grid">'+slots+extra+'</div>'+campsHtml+'</div>';
  }).join('')+'</section>';
  if(locs.length){
   body+='<section class="br-sec" id="locations"><h2>Locations</h2><div class="br-loc-wrap"><div id="br-map" class="br-map" data-points="'+brEsc(JSON.stringify(locs.filter(l=>l.lat&&l.lon).map(l=>({lat:l.lat,lon:l.lon,name:b.name+' '+l.name,url:'/brands/'+b.slug+'/locations/'+l.slug+'/'}))))+'"></div><div class="br-loc-list">'+locs.map(l=>'<article class="br-loc"><h3><a href="/brands/'+brEsc(b.slug)+'/locations/'+brEsc(l.slug)+'/">'+brEsc(l.name)+'</a></h3><p>'+brEsc([l.address,l.locality,l.city].filter(Boolean).join(', '))+'</p>'+(l.hours?'<p class="br-loc-hours">'+brEsc(l.hours)+'</p>':'')+'<p class="br-loc-flags"><a class="br-flag" href="/club/book/?l='+brEsc(l.id)+'">Book</a><a class="br-flag br-locked" data-visit-loc="'+brEsc(l.id)+'" href="/club/book/?l='+brEsc(l.id)+'">Visit &middot; book first</a><button class="br-flag" data-demo-open="pay" data-brand="'+brEsc(b.name+' - '+l.name)+'">Pay demo</button></p></article>').join('')+'</div></div></section>';
  }
  if(faqs.length)body+='<section class="br-sec"><h2>Questions about '+brEsc(b.name)+'</h2>'+faqs.map(f=>'<details class="br-faq"><summary>'+brEsc(f.q)+'</summary><p>'+brEsc(f.a)+'</p></details>').join('')+'</section>';
  const jsonld=[{'@context':'https://schema.org','@type':'Organization',name:b.name,url:u.origin+'/brands/'+b.slug+'/',...(b.website?{sameAs:[b.website]}:{})},{'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Brands',item:u.origin+'/brands/'},{'@type':'ListItem',position:2,name:b.name}]}];
  for(const v of media.filter(x=>x.pillar!=='identity'))jsonld.push({'@context':'https://schema.org','@type':'VideoObject',name:v.title||b.name,description:v.description||b.tagline||b.name,contentUrl:u.origin+brMediaUrl(v.media_id),uploadDate:new Date(v.created_at).toISOString()});
  if(faqs.length)jsonld.push({'@context':'https://schema.org','@type':'FAQPage',mainEntity:faqs.map(f=>({'@type':'Question',name:f.q,acceptedAnswer:{'@type':'Answer',text:f.a}}))});
  return new Response(brChrome({title:(/bengaluru/i.test(b.name)?b.name:b.name+' Bengaluru')+' — Videos, Locations & Experiences | SRCHN',desc:(b.tagline||('Explore '+b.name+' through virtual tour videos, products, facilities, locations and experiences on SRCHN.')).slice(0,160)+' See it before you go.',canon:u.origin+'/brands/'+b.slug+'/',body,jsonld}),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'public, max-age=120'}});
 }
 return null;
}
function brMediaTile(x){
 if(x.kind==='video')return '<figure class="br-media"><video class="br-media-v" controls playsinline preload="none" src="'+brMediaUrl(x.media_id)+'"></video><figcaption>'+brEsc(x.title||'')+(x.credit?' <span class="br-credit">'+brEsc(x.credit)+'</span>':'')+'</figcaption></figure>';
 return '<figure class="br-media"><img class="br-media-img" loading="lazy" src="'+brMediaUrl(x.media_id)+'" alt="'+brEsc(x.title||'')+'"/><figcaption>'+brEsc(x.title||'')+(x.credit?' <span class="br-credit">'+brEsc(x.credit)+'</span>':'')+'</figcaption></figure>';
}
/* reviewer brand management (mounted inside studioRoute; rv already checked) */
async function brReviewRoute(p,request,env,db,now){
 const u=new URL(request.url);
 const rv=await stuReviewer(request,env);if(!rv)return JSONR({error:'Reviewer sign-in required.'},401);
 await brTables(db);
 if(p==='/studio/api/review/brands'&&request.method==='GET'){
  const bs=(await db.prepare("SELECT b.*,(SELECT COUNT(*) FROM br_locations l WHERE l.brand_id=b.id) AS locs,(SELECT COUNT(*) FROM br_media_links m WHERE m.brand_id=b.id) AS media FROM br_brands b WHERE b.status!='DELETED' ORDER BY b.updated_at DESC LIMIT 200").all()).results||[];
  return JSONR({brands:bs});
 }
 if(p==='/studio/api/review/claims'&&request.method==='GET'){
  const rows=(await db.prepare("SELECT k.*,c.display_name,c.creator_no,c.email AS creator_email,b.name AS brand_name FROM br_claims k LEFT JOIN stu_creators c ON c.id=k.creator_id LEFT JOIN br_brands b ON b.id=k.brand_id ORDER BY CASE k.status WHEN 'PENDING' THEN 0 WHEN 'MORE_INFO' THEN 1 ELSE 2 END,k.created_at DESC LIMIT 200").all()).results||[];
  return JSONR({claims:rows});
 }
 if(p==='/studio/api/review/claim-decide'&&request.method==='POST'){
  if(request.headers.get('Origin')!==u.origin)return JSONR({error:'Origin refused.'},403);
  const b=await request.json().catch(()=>null);if(!b)return JSONR({error:'Invalid JSON.'},400);
  const cl=await db.prepare('SELECT * FROM br_claims WHERE id=?').bind(clean(b.claim_id,40)).first();if(!cl)return JSONR({error:'Unknown claim.'},404);
  if(cl.status==='APPROVED'||cl.status==='REJECTED')return JSONR({error:'Claim already decided.'},409);
  const dec=clean(b.decision,12);
  const note=clean(b.note,600);
  if(!['approve','reject','more_info'].includes(dec))return JSONR({error:'decision must be approve, reject or more_info.'},400);
  if(dec!=='approve'&&!note)return JSONR({error:'A note is required so the claimant knows what to fix.'},400);
  let bid=cl.brand_id;
  if(dec==='approve'){
   if(!bid){
    bid=crypto.randomUUID();
    let slug=brSlug(cl.requested_name)||bid.slice(0,8);
    const clash=await db.prepare('SELECT id FROM br_brands WHERE slug=?').bind(slug).first();if(clash)slug=slug+'-2';
    await db.prepare('INSERT INTO br_brands(id,slug,name,category,subcategory,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind(bid,slug,cl.requested_name,cl.requested_category||'Other','','DRAFT',now,now).run();
   }
   const ex=await db.prepare('SELECT id FROM br_members WHERE brand_id=? AND creator_id=?').bind(bid,cl.creator_id).first();
   if(ex)await db.prepare("UPDATE br_members SET status='ACTIVE',role='owner',added_by=? WHERE id=?").bind(rv.email,ex.id).run();
   else await db.prepare("INSERT INTO br_members(id,brand_id,creator_id,role,status,added_by,created_at) VALUES(?,?,?,'owner','ACTIVE',?,?)").bind(crypto.randomUUID(),bid,cl.creator_id,rv.email,now).run();
  }
  const ns=dec==='approve'?'APPROVED':dec==='reject'?'REJECTED':'MORE_INFO';
  await db.prepare('UPDATE br_claims SET status=?,reviewer=?,review_note=?,decided_at=? WHERE id=?').bind(ns,rv.email,note,now,cl.id).run();
  await db.prepare('INSERT INTO br_audit(actor,action,brand_id,detail,ts) VALUES(?,?,?,?,?)').bind(rv.email,'claim-'+dec,bid||cl.brand_id,(cl.requested_name||'')+' '+(note||''),now).run();
  let es='skipped';
  try{
   const cr=await db.prepare('SELECT email,full_name,display_name FROM stu_creators WHERE id=?').bind(cl.creator_id).first();
   if(cr&&cr.email){
    const bn=cl.brand_id?(await db.prepare('SELECT name FROM br_brands WHERE id=?').bind(cl.brand_id).first()||{}).name:cl.requested_name;
    const r=await stuMail(env,{task:'studio_claim',to:cr.email,name:cr.display_name||cr.full_name,brand_name:bn||'your brand',status:ns,reason:note||''});
    es=r.ok?'sent':'failed';
   }
  }catch{es='failed'}
  return JSONR({ok:true,status:ns,brand_id:bid||null,email:es});
 }
 if(p==='/studio/api/review/brand-detail'&&request.method==='GET'){
  const id=clean(u.searchParams.get('id')||'',40);
  const b=await db.prepare("SELECT * FROM br_brands WHERE id=? AND status!='DELETED'").bind(id).first();
  if(!b)return JSONR({error:'Unknown brand.'},404);
  const locs=(await db.prepare("SELECT * FROM br_locations WHERE brand_id=? AND status!='DELETED' ORDER BY created_at").bind(id).all()).results||[];
  const prods=(await db.prepare("SELECT * FROM br_products WHERE brand_id=? AND status!='DELETED' ORDER BY created_at").bind(id).all()).results||[];
  const mems=(await db.prepare("SELECT m.role,m.status,m.created_at,c.display_name,c.creator_no,c.email FROM br_members m LEFT JOIN stu_creators c ON c.id=m.creator_id WHERE m.brand_id=?").bind(id).all()).results||[];
  const audit=(await db.prepare('SELECT actor,action,detail,ts FROM br_audit WHERE brand_id=? ORDER BY ts DESC LIMIT 20').bind(id).all()).results||[];
  await db.prepare("UPDATE br_subscriptions SET status='GRACE',updated_at=? WHERE brand_id=? AND status='ACTIVE' AND renew_at<?").bind(now,id,now).run();
  const sub=await db.prepare("SELECT * FROM br_subscriptions WHERE brand_id=? AND status IN ('ACTIVE','GRACE') ORDER BY created_at DESC LIMIT 1").bind(id).first();
  const invs=(await db.prepare('SELECT id,inv_no,period,amount_inr,status,pay_ref,issued_at,paid_at FROM br_invoices WHERE brand_id=? ORDER BY issued_at DESC LIMIT 20').bind(id).all()).results||[];
  const videos=((await db.prepare("SELECT COUNT(*) n FROM br_media_links WHERE brand_id=? AND kind='video'").bind(id).first())||{}).n||0;
  return JSONR({brand:b,locations:locs,products:prods,members:mems,audit,subscription:sub||null,invoices:invs,video_count:videos});
 }
 if(p==='/studio/api/review/product-status'&&request.method==='POST'){
  if(request.headers.get('Origin')!==u.origin)return JSONR({error:'Origin refused.'},403);
  const b=await request.json().catch(()=>null);if(!b)return JSONR({error:'Invalid JSON.'},400);
  const st=clean(b.status,20);
  if(!['DRAFT','UNDER_REVIEW','PUBLISHED','DELETED'].includes(st))return JSONR({error:'Unknown status.'},400);
  const r=await db.prepare('UPDATE br_products SET status=? WHERE id=?').bind(st,clean(b.product_id,40)).run();
  if(!(r.meta&&r.meta.changes))return JSONR({error:'Unknown product.'},404);
  await db.prepare('INSERT INTO br_audit(actor,action,brand_id,detail,ts) VALUES(?,?,?,?,?)').bind(rv.email,'product-'+st.toLowerCase(),clean(b.brand_id,40),clean(b.product_id,40),now).run();
  return JSONR({ok:true,status:st});
 }
 if(p==='/studio/api/review/subscription-save'&&request.method==='POST'){
  if(request.headers.get('Origin')!==u.origin)return JSONR({error:'Origin refused.'},403);
  const b=await request.json().catch(()=>null);if(!b)return JSONR({error:'Invalid JSON.'},400);
  const bid=clean(b.brand_id,40);
  const br=await db.prepare("SELECT id,name FROM br_brands WHERE id=? AND status!='DELETED'").bind(bid).first();if(!br)return JSONR({error:'Unknown brand.'},404);
  const plan=clean(b.plan,10);if(!['monthly','annual'].includes(plan))return JSONR({error:'plan must be monthly or annual.'},400);
  const note=clean(b.note,400);if(!note)return JSONR({error:'A documented note is required (payment reference or exception reason).'},400);
  const months=plan==='annual'?12:1,price=plan==='annual'?30000:3000;
  await db.prepare("UPDATE br_subscriptions SET status='SUPERSEDED',updated_at=? WHERE brand_id=? AND status IN ('ACTIVE','GRACE')").bind(now,bid).run();
  const id=crypto.randomUUID();
  await db.prepare('INSERT INTO br_subscriptions(id,brand_id,plan,status,price_inr,start_at,renew_at,note,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(id,bid,plan,'ACTIVE',price,now,now+months*30*86400000,note,rv.email,now,now).run();
  const seq=(await db.prepare('SELECT COUNT(*) n FROM br_invoices').first()).n+1;
  const invNo='SRCHN-INV-'+new Date(now).getUTCFullYear()+'-'+String(seq).padStart(5,'0');
  await db.prepare('INSERT INTO br_invoices(id,inv_no,brand_id,subscription_id,period,amount_inr,status,issued_at,created_by) VALUES(?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),invNo,bid,id,new Date(now).toISOString().slice(0,7)+' ('+plan+')',price,'ISSUED',now,rv.email).run();
  await db.prepare('INSERT INTO br_audit(actor,action,brand_id,detail,ts) VALUES(?,?,?,?,?)').bind(rv.email,'subscription-save',bid,plan+' '+invNo+' '+note,now).run();
  return JSONR({ok:true,subscription_id:id,invoice:invNo,message:'Plan recorded and invoice '+invNo+' issued. Mark it PAID only against a real payment reference.'});
 }
 if(p==='/studio/api/review/subscription-renew'&&request.method==='POST'){
  if(request.headers.get('Origin')!==u.origin)return JSONR({error:'Origin refused.'},403);
  const b=await request.json().catch(()=>null);if(!b)return JSONR({error:'Invalid JSON.'},400);
  const bid=clean(b.brand_id,40);
  const note=clean(b.note,400);if(!note)return JSONR({error:'A documented note is required (renewal discussion reference).'},400);
  const cur=await db.prepare("SELECT * FROM br_subscriptions WHERE brand_id=? AND status IN ('ACTIVE','GRACE') ORDER BY created_at DESC LIMIT 1").bind(bid).first();
  if(!cur)return JSONR({error:'No active or grace subscription to renew. Use subscription-save to start a new plan.'},404);
  const months=cur.plan==='annual'?12:1;
  const start=Math.max(now,cur.renew_at);
  await db.prepare("UPDATE br_subscriptions SET status='SUPERSEDED',updated_at=? WHERE id=?").bind(now,cur.id).run();
  const id=crypto.randomUUID();
  await db.prepare('INSERT INTO br_subscriptions(id,brand_id,plan,status,price_inr,start_at,renew_at,note,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(id,bid,cur.plan,'ACTIVE',cur.price_inr,start,start+months*30*86400000,note,rv.email,now,now).run();
  const seq=(await db.prepare('SELECT COUNT(*) n FROM br_invoices').first()).n+1;
  const invNo='SRCHN-INV-'+new Date(now).getUTCFullYear()+'-'+String(seq).padStart(5,'0');
  await db.prepare('INSERT INTO br_invoices(id,inv_no,brand_id,subscription_id,period,amount_inr,status,issued_at,created_by) VALUES(?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),invNo,bid,id,new Date(start).toISOString().slice(0,7)+' ('+cur.plan+' renewal)',cur.price_inr,'ISSUED',now,rv.email).run();
  await db.prepare('INSERT INTO br_audit(actor,action,brand_id,detail,ts) VALUES(?,?,?,?,?)').bind(rv.email,'subscription-renew',bid,invNo+' '+note,now).run();
  return JSONR({ok:true,subscription_id:id,invoice:invNo,message:'Renewal recorded and invoice '+invNo+' issued. Mark it PAID only against a real payment reference.'});
 }
 if(p==='/studio/api/review/subscription-status'&&request.method==='POST'){
  if(request.headers.get('Origin')!==u.origin)return JSONR({error:'Origin refused.'},403);
  const b=await request.json().catch(()=>null);if(!b)return JSONR({error:'Invalid JSON.'},400);
  const st=clean(b.status,12);if(!['ACTIVE','GRACE','CANCELLED','EXPIRED'].includes(st))return JSONR({error:'Unknown status.'},400);
  const note=clean(b.note,400);if(!note)return JSONR({error:'A documented note is required.'},400);
  const r=await db.prepare('UPDATE br_subscriptions SET status=?,note=?,updated_at=? WHERE id=?').bind(st,note,now,clean(b.subscription_id,40)).run();
  if(!(r.meta&&r.meta.changes))return JSONR({error:'Unknown subscription.'},404);
  await db.prepare('INSERT INTO br_audit(actor,action,brand_id,detail,ts) VALUES(?,?,?,?,?)').bind(rv.email,'subscription-'+st.toLowerCase(),clean(b.brand_id,40),note,now).run();
  return JSONR({ok:true,status:st});
 }
 if(p==='/studio/api/review/invoice-status'&&request.method==='POST'){
  if(request.headers.get('Origin')!==u.origin)return JSONR({error:'Origin refused.'},403);
  const b=await request.json().catch(()=>null);if(!b)return JSONR({error:'Invalid JSON.'},400);
  const st=clean(b.status,10);if(!['PAID','VOID','UNPAID'].includes(st))return JSONR({error:'Unknown status.'},400);
  const ref=clean(b.pay_ref,120);
  if(st==='PAID'&&!ref)return JSONR({error:'Recording PAID needs the real payment reference (UPI/bank ref).'},400);
  const r=await db.prepare('UPDATE br_invoices SET status=?,pay_ref=?,paid_at=? WHERE id=?').bind(st,ref||null,st==='PAID'?now:null,clean(b.invoice_id,40)).run();
  if(!(r.meta&&r.meta.changes))return JSONR({error:'Unknown invoice.'},404);
  await db.prepare('INSERT INTO br_audit(actor,action,brand_id,detail,ts) VALUES(?,?,?,?,?)').bind(rv.email,'invoice-'+st.toLowerCase(),clean(b.brand_id,40),ref||'',now).run();
  return JSONR({ok:true,status:st});
 }
 if(p==='/studio/api/review/brand-save'&&request.method==='POST'){
  if(request.headers.get('Origin')!==u.origin)return JSONR({error:'Origin refused.'},403);
  const b=await request.json().catch(()=>null);if(!b)return JSONR({error:'Invalid JSON.'},400);
  const name=clean(b.name,120);if(!name)return JSONR({error:'name required.'},400);
  const cat=clean(b.category,60)||'Other';
  const id=clean(b.id,40)||crypto.randomUUID();
  const slug=brSlug(clean(b.slug,60)||name)||crypto.randomUUID().slice(0,8);
  const ex=await db.prepare('SELECT id FROM br_brands WHERE id=?').bind(id).first();
  if(ex){await db.prepare('UPDATE br_brands SET slug=?,name=?,category=?,subcategory=?,tagline=?,description=?,website=?,socials=?,founded_year=?,founders=?,hq_city=?,verified=?,club=?,featured=?,updated_at=? WHERE id=?').bind(slug,name,cat,clean(b.subcategory,60),clean(b.tagline,200),clean(b.description,8000),clean(b.website,200),typeof b.socials==='string'?clean(b.socials,1000):JSON.stringify(b.socials||{}),clean(b.founded_year,10),clean(b.founders,200),clean(b.hq_city,60),b.verified?1:0,b.club?1:0,b.featured?1:0,now,id).run()}
  else{const clash=await db.prepare('SELECT id FROM br_brands WHERE slug=?').bind(slug).first();if(clash)return JSONR({error:'Slug already in use.'},409);
   await db.prepare('INSERT INTO br_brands(id,slug,name,category,subcategory,tagline,description,website,socials,founded_year,founders,hq_city,verified,club,featured,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,slug,name,cat,clean(b.subcategory,60),clean(b.tagline,200),clean(b.description,8000),clean(b.website,200),typeof b.socials==='string'?clean(b.socials,1000):JSON.stringify(b.socials||{}),clean(b.founded_year,10),clean(b.founders,200),clean(b.hq_city,60),b.verified?1:0,b.club?1:0,b.featured?1:0,'DRAFT',now,now).run()}
  await db.prepare('INSERT INTO br_audit(actor,action,brand_id,detail,ts) VALUES(?,?,?,?,?)').bind(rv.email,ex?'brand-update':'brand-create',id,name,now).run();
  return JSONR({ok:true,id,slug});
 }
 if(p==='/studio/api/review/brand-location'&&request.method==='POST'){
  if(request.headers.get('Origin')!==u.origin)return JSONR({error:'Origin refused.'},403);
  const b=await request.json().catch(()=>null);if(!b)return JSONR({error:'Invalid JSON.'},400);
  const bid=clean(b.brand_id,40);const br=await db.prepare("SELECT id,name FROM br_brands WHERE id=? AND status!='DELETED'").bind(bid).first();if(!br)return JSONR({error:'Unknown brand.'},404);
  const name=clean(b.name,120);if(!name)return JSONR({error:'location name required.'},400);
  const id=clean(b.id,40)||crypto.randomUUID();
  const slug=brSlug(clean(b.slug,60)||name)||crypto.randomUUID().slice(0,8);
  const facs=Array.isArray(b.facilities)?JSON.stringify(b.facilities.slice(0,40).map(x=>clean(x,80))):clean(b.facilities,1000);
  const ex=await db.prepare('SELECT id FROM br_locations WHERE id=?').bind(id).first();
  if(ex){await db.prepare('UPDATE br_locations SET slug=?,name=?,address=?,locality=?,city=?,state=?,pincode=?,lat=?,lon=?,phone=?,hours=?,facilities=?,booking_enabled=?,visit_enabled=?,pay_enabled=?,updated_at=? WHERE id=?').bind(slug,name,clean(b.address,300),clean(b.locality,80),clean(b.city,60)||'Bengaluru',clean(b.state,60)||'Karnataka',clean(b.pincode,10),typeof b.lat==='number'?b.lat:null,typeof b.lon==='number'?b.lon:null,clean(b.phone,20),clean(b.hours,200),facs,b.booking_enabled?1:0,b.visit_enabled?1:0,b.pay_enabled?1:0,now,id).run()}
  else{const clash=await db.prepare('SELECT id FROM br_locations WHERE brand_id=? AND slug=?').bind(bid,slug).first();if(clash)return JSONR({error:'Location slug already in use for this brand.'},409);
   await db.prepare('INSERT INTO br_locations(id,brand_id,slug,name,address,locality,city,state,pincode,lat,lon,phone,hours,facilities,booking_enabled,visit_enabled,pay_enabled,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,bid,slug,name,clean(b.address,300),clean(b.locality,80),clean(b.city,60)||'Bengaluru',clean(b.state,60)||'Karnataka',clean(b.pincode,10),typeof b.lat==='number'?b.lat:null,typeof b.lon==='number'?b.lon:null,clean(b.phone,20),clean(b.hours,200),facs,b.booking_enabled?1:0,b.visit_enabled?1:0,b.pay_enabled?1:0,'DRAFT',now,now).run()}
  await db.prepare('INSERT INTO br_audit(actor,action,brand_id,detail,ts) VALUES(?,?,?,?,?)').bind(rv.email,ex?'location-update':'location-create',bid,name,now).run();
  return JSONR({ok:true,id,slug});
 }
 if(p==='/studio/api/review/brand-status'&&request.method==='POST'){
  if(request.headers.get('Origin')!==u.origin)return JSONR({error:'Origin refused.'},403);
  const b=await request.json().catch(()=>null);if(!b)return JSONR({error:'Invalid JSON.'},400);
  const id=clean(b.brand_id,40),st=clean(b.status,20);
  if(!['DRAFT','PUBLISHED','UNPUBLISHED','DELETED'].includes(st))return JSONR({error:'Unknown status.'},400);
  const r=await db.prepare('UPDATE br_brands SET status=?,published_at=CASE WHEN ?=\'PUBLISHED\' AND published_at IS NULL THEN ? ELSE published_at END,updated_at=? WHERE id=?').bind(st,st,now,now,id).run();
  if(!(r.meta&&r.meta.changes))return JSONR({error:'Unknown brand.'},404);
  if(b.location_status){await db.prepare('UPDATE br_locations SET status=?,updated_at=? WHERE brand_id=?').bind(st==='PUBLISHED'?'PUBLISHED':st==='DELETED'?'DELETED':'DRAFT',now,id).run()}
  await db.prepare('INSERT INTO br_audit(actor,action,brand_id,detail,ts) VALUES(?,?,?,?,?)').bind(rv.email,'brand-'+st.toLowerCase(),id,clean(b.note,200),now).run();
  return JSONR({ok:true,status:st});
 }
 if(p==='/studio/api/review/location-status'&&request.method==='POST'){
  if(request.headers.get('Origin')!==u.origin)return JSONR({error:'Origin refused.'},403);
  const b=await request.json().catch(()=>null);if(!b)return JSONR({error:'Invalid JSON.'},400);
  const st=clean(b.status,20);if(!['DRAFT','PUBLISHED','UNPUBLISHED','DELETED'].includes(st))return JSONR({error:'Unknown status.'},400);
  const r=await db.prepare('UPDATE br_locations SET status=?,updated_at=? WHERE id=?').bind(st,now,clean(b.location_id,40)).run();
  if(!(r.meta&&r.meta.changes))return JSONR({error:'Unknown location.'},404);
  return JSONR({ok:true,status:st});
 }
 if(p==='/studio/api/review/brand-attach'&&request.method==='POST'){
  if(request.headers.get('Origin')!==u.origin)return JSONR({error:'Origin refused.'},403);
  const b=await request.json().catch(()=>null);if(!b)return JSONR({error:'Invalid JSON.'},400);
  const bid=clean(b.brand_id,40),mid=clean(b.media_id,64),pillar=clean(b.pillar,20);
  if(!['identity','tour','product','marketing'].includes(pillar))return JSONR({error:'pillar must be identity, tour, product or marketing.'},400);
  const br=await db.prepare("SELECT id FROM br_brands WHERE id=? AND status!='DELETED'").bind(bid).first();if(!br)return JSONR({error:'Unknown brand.'},404);
  if(pillar!=='identity'){const ok=await db.prepare("SELECT sub_no FROM stu_submissions WHERE status IN ('APPROVED','PUBLISHED') AND items LIKE '%'||?||'%' LIMIT 1").bind(mid).first();if(!ok)return JSONR({error:'Media must come from an approved or published submission.'},400)}
  const kind=clean(b.kind,10)==='video'?'video':'photo';
  const id=crypto.randomUUID();
  await db.prepare('INSERT INTO br_media_links(id,brand_id,location_id,media_id,kind,pillar,category,title,description,credit,featured,pinned,position,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,bid,clean(b.location_id,40)||null,mid,kind,pillar,clean(b.category,60),clean(b.title,160),clean(b.description,600),clean(b.credit,160),b.featured?1:0,b.pinned?1:0,typeof b.position==='number'?b.position:0,now).run();
  await db.prepare('INSERT INTO br_audit(actor,action,brand_id,detail,ts) VALUES(?,?,?,?,?)').bind(rv.email,'media-attach',bid,pillar+':'+mid.slice(0,12),now).run();
  return JSONR({ok:true,id});
 }
 if(p==='/studio/api/review/brand-detach'&&request.method==='POST'){
  if(request.headers.get('Origin')!==u.origin)return JSONR({error:'Origin refused.'},403);
  const b=await request.json().catch(()=>null);if(!b)return JSONR({error:'Invalid JSON.'},400);
  const r=await db.prepare('DELETE FROM br_media_links WHERE id=?').bind(clean(b.id,40)).run();
  return JSONR({ok:true,changed:(r.meta&&r.meta.changes)||0});
 }
 if(p==='/studio/api/review/brand-faq'&&request.method==='POST'){
  if(request.headers.get('Origin')!==u.origin)return JSONR({error:'Origin refused.'},403);
  const b=await request.json().catch(()=>null);if(!b)return JSONR({error:'Invalid JSON.'},400);
  if(b.delete){const r=await db.prepare('DELETE FROM br_faqs WHERE id=?').bind(clean(b.id,40)).run();return JSONR({ok:true,changed:(r.meta&&r.meta.changes)||0})}
  const bid=clean(b.brand_id,40),q=clean(b.q,300),a=clean(b.a,2000);
  if(!q||!a)return JSONR({error:'q and a required.'},400);
  const id=clean(b.id,40)||crypto.randomUUID();
  const ex=await db.prepare('SELECT id FROM br_faqs WHERE id=?').bind(id).first();
  if(ex)await db.prepare('UPDATE br_faqs SET q=?,a=?,position=?,location_id=? WHERE id=?').bind(q,a,typeof b.position==='number'?b.position:0,clean(b.location_id,40)||null,id).run();
  else await db.prepare('INSERT INTO br_faqs(id,brand_id,location_id,q,a,position) VALUES(?,?,?,?,?,?)').bind(id,bid,clean(b.location_id,40)||null,q,a,typeof b.position==='number'?b.position:0).run();
  return JSONR({ok:true,id});
 }
 if(p==='/studio/api/review/brand-delete'&&request.method==='POST'){
  if(request.headers.get('Origin')!==u.origin)return JSONR({error:'Origin refused.'},403);
  const b=await request.json().catch(()=>null);if(!b)return JSONR({error:'Invalid JSON.'},400);
  const id=clean(b.brand_id,40);
  await db.prepare('DELETE FROM br_media_links WHERE brand_id=?').bind(id).run();
  await db.prepare('DELETE FROM br_faqs WHERE brand_id=?').bind(id).run();
  await db.prepare('DELETE FROM br_campaigns WHERE brand_id=?').bind(id).run();
  await db.prepare('DELETE FROM br_products WHERE brand_id=?').bind(id).run();
  await db.prepare('DELETE FROM br_views WHERE brand_id=?').bind(id).run();
  await db.prepare('DELETE FROM br_locations WHERE brand_id=?').bind(id).run();
  const r=await db.prepare('DELETE FROM br_brands WHERE id=?').bind(id).run();
  await db.prepare('INSERT INTO br_audit(actor,action,brand_id,detail,ts) VALUES(?,?,?,?,?)').bind(rv.email,'brand-delete',id,clean(b.note,200),now).run();
  return JSONR({ok:true,changed:(r.meta&&r.meta.changes)||0});
 }
 if(p==='/studio/api/review/claim-delete'&&request.method==='POST'){
  if(request.headers.get('Origin')!==u.origin)return JSONR({error:'Origin refused.'},403);
  const b=await request.json().catch(()=>null);if(!b)return JSONR({error:'Invalid JSON.'},400);
  const id=clean(b.claim_id,40);
  const cl=await db.prepare('SELECT id,brand_id,requested_name,status FROM br_claims WHERE id=?').bind(id).first();
  if(!cl)return JSONR({error:'Unknown claim.'},404);
  const r=await db.prepare('DELETE FROM br_claims WHERE id=?').bind(id).run();
  await db.prepare('INSERT INTO br_audit(actor,action,brand_id,detail,ts) VALUES(?,?,?,?,?)').bind(rv.email,'claim-delete',cl.brand_id||null,'claim '+id+' ('+(cl.requested_name||'brand-claim')+', was '+cl.status+'): '+clean(b.note,160),now).run();
  return JSONR({ok:true,changed:(r.meta&&r.meta.changes)||0});
 }
 if(p==='/studio/api/review/club'&&request.method==='GET'){
  await clubTables(db);
  const invites=(await db.prepare("SELECT * FROM br_club_invites ORDER BY CASE status WHEN 'PENDING' THEN 0 ELSE 1 END,created_at DESC LIMIT 200").all()).results||[];
  const members=(await db.prepare('SELECT id,email,name,city,status,invited_at,member_since FROM br_club_members ORDER BY created_at DESC LIMIT 200').all()).results||[];
  return JSONR({invites,members});
 }
 if(p==='/studio/api/review/club-invite-decide'&&request.method==='POST'){
  await clubTables(db);
  const b=await request.json().catch(()=>null);if(!b)return JSONR({error:'Invalid JSON.'},400);
  const inv=await db.prepare('SELECT * FROM br_club_invites WHERE id=?').bind(clean(b.id,40)).first();
  if(!inv)return JSONR({error:'Unknown invite request.'},404);
  if(inv.status!=='PENDING')return JSONR({error:'Already decided.'},409);
  const dec=b.decision==='APPROVED'?'APPROVED':'DECLINED';
  await db.prepare('UPDATE br_club_invites SET status=?,reviewer=?,review_note=?,decided_at=? WHERE id=?').bind(dec,rv.email,clean(b.note,500)||null,now,inv.id).run();
  let member=null,email='skipped';
  if(dec==='APPROVED'){
   await db.prepare("INSERT INTO br_club_members(id,email,name,city,status,invited_by,invite_id,invited_at,created_at,updated_at) VALUES(?,?,?,?,'INVITED',?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET name=excluded.name,status='INVITED',invite_id=excluded.invite_id,invited_at=excluded.invited_at,updated_at=excluded.updated_at").bind(crypto.randomUUID(),inv.email,inv.name,inv.city||null,rv.email,inv.id,now,now,now).run();
   member=await db.prepare('SELECT id,email,status FROM br_club_members WHERE email=?').bind(inv.email).first();
   try{const r=await stuMail(env,{task:'club_invite',to:inv.email,name:inv.name});email=r.ok?'sent':'failed'}catch{email='failed'}
  }
  await db.prepare('INSERT INTO br_audit(actor,action,brand_id,detail,ts) VALUES(?,?,?,?,?)').bind(rv.email,'club-invite-'+dec.toLowerCase(),null,inv.email,now).run();
  return JSONR({ok:true,decision:dec,email,member});
 }
 if(p==='/studio/api/review/club-member-status'&&request.method==='POST'){
  await clubTables(db);
  const b=await request.json().catch(()=>null);if(!b)return JSONR({error:'Invalid JSON.'},400);
  const m=await db.prepare('SELECT * FROM br_club_members WHERE id=?').bind(clean(b.member_id,40)).first();
  if(!m)return JSONR({error:'Unknown member.'},404);
  const st=b.status==='SUSPENDED'?'SUSPENDED':b.status==='ACTIVE'?'ACTIVE':'';
  if(!st)return JSONR({error:'Status must be ACTIVE or SUSPENDED.'},400);
  if(m.status==='INVITED'&&st==='ACTIVE')return JSONR({error:'A member activates their own membership on first sign-in.'},400);
  await db.prepare('UPDATE br_club_members SET status=?,updated_at=? WHERE id=?').bind(st,now,m.id).run();
  if(st==='SUSPENDED')await db.prepare('DELETE FROM br_club_sessions WHERE member_id=?').bind(m.id).run();
  await db.prepare('INSERT INTO br_audit(actor,action,brand_id,detail,ts) VALUES(?,?,?,?,?)').bind(rv.email,'club-member-'+st.toLowerCase(),null,m.email,now).run();
  return JSONR({ok:true,status:st});
 }
 if(p==='/studio/api/review/club-booking-config'&&request.method==='POST'){
  await clubTables(db);
  const b=await request.json().catch(()=>null);if(!b)return JSONR({error:'Invalid JSON.'},400);
  const br=await db.prepare('SELECT * FROM br_brands WHERE id=?').bind(clean(b.brand_id,40)).first();
  if(!br)return JSONR({error:'Unknown brand.'},404);
  if(br.club!==1)return JSONR({error:'Brand must be approved for Club participation first.'},400);
  const loc=await db.prepare('SELECT * FROM br_locations WHERE id=? AND brand_id=?').bind(clean(b.location_id,40),br.id).first();
  if(!loc)return JSONR({error:'Unknown location for this brand.'},404);
  const fee=Math.max(0,Math.min(100000,parseInt(b.fee_inr)||0));
  const active=b.active?1:0;
  await db.prepare('INSERT INTO br_club_booking_config(brand_id,location_id,fee_inr,terms,active,updated_by,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(brand_id,location_id) DO UPDATE SET fee_inr=excluded.fee_inr,terms=excluded.terms,active=excluded.active,updated_by=excluded.updated_by,updated_at=excluded.updated_at').bind(br.id,loc.id,fee,clean(b.terms,2000)||null,active,rv.email,now).run();
  if(active&&!loc.booking_enabled)await db.prepare('UPDATE br_locations SET booking_enabled=1,updated_at=? WHERE id=?').bind(now,loc.id).run();
  await db.prepare('INSERT INTO br_audit(actor,action,brand_id,detail,ts) VALUES(?,?,?,?,?)').bind(rv.email,'club-booking-config',br.id,loc.name+' fee Rs'+fee+' active='+active,now).run();
  return JSONR({ok:true,fee_inr:fee,active:!!active});
 }
 if(p==='/studio/api/review/club-ledgers'&&request.method==='GET'){
  await clubTables(db);
  const bookings=(await db.prepare("SELECT k.booking_no,k.location_id,k.visit_date,k.visit_time,k.people,k.fee_inr,k.status,k.checked_in_at,k.created_at,COALESCE(b.name,k.place_name,'') AS brand_name,COALESCE(l.name,k.place_detail,'') AS location_name,m.email AS member_email,m.name AS member_name FROM br_club_bookings k LEFT JOIN br_brands b ON b.id=k.brand_id LEFT JOIN br_locations l ON l.id=k.location_id JOIN br_club_members m ON m.id=k.member_id ORDER BY k.created_at DESC LIMIT 200").all()).results||[];
  const commission=(await db.prepare('SELECT c.*,k.booking_no,m.email AS member_email FROM br_club_commission c LEFT JOIN br_club_bookings k ON k.id=c.booking_id LEFT JOIN br_club_members m ON m.id=k.member_id ORDER BY c.created_at DESC LIMIT 200').all()).results||[];
  const cashback=(await db.prepare('SELECT c.*,k.booking_no,m.email AS member_email FROM br_club_cashback c LEFT JOIN br_club_bookings k ON k.id=c.booking_id LEFT JOIN br_club_members m ON m.id=c.member_id ORDER BY c.created_at DESC LIMIT 200').all()).results||[];
  return JSONR({bookings,commission,cashback});
 }
 if(p==='/studio/api/review/club-settle'&&request.method==='POST'){
  await clubTables(db);
  const b=await request.json().catch(()=>null);if(!b)return JSONR({error:'Invalid JSON.'},400);
  const note=clean(b.note,500);if(!note)return JSONR({error:'A documented note is required.'},400);
  const k=await db.prepare('SELECT * FROM br_club_bookings WHERE booking_no=?').bind(clean(b.booking_no,20)).first();
  if(!k)return JSONR({error:'Unknown booking.'},404);
  if(k.status!=='CHECKED_IN')return JSONR({error:'Only a checked-in visit can be settled.'},409);
  const dup=await db.prepare("SELECT id FROM br_club_commission WHERE booking_id=? AND status!='REVERSED'").bind(k.id).first();
  if(dup)return JSONR({error:'This booking already has a commission record.'},409);
  const bill=Math.max(0,Math.min(10000000,parseInt(b.bill_inr)||0));
  const pct=Math.max(0,Math.min(100,parseFloat(b.fee_pct)||0));
  if(!bill||!pct)return JSONR({error:'Bill amount and agreed success-fee % are required.'},400);
  let cbpct=parseFloat(b.cashback_pct==null?5:b.cashback_pct);if(!(cbpct>=0))cbpct=5;
  cbpct=Math.max(0,Math.min(5,cbpct));
  const comm=Math.round(bill*pct/100);
  let cb=Math.round(comm*cbpct/100);
  const mem=await db.prepare('SELECT * FROM br_club_members WHERE id=?').bind(k.member_id).first();
  if(!mem)return JSONR({error:'Member record missing.'},404);
  const ps=mem.member_since||mem.joined_at||mem.invited_at;
  const used=((await db.prepare("SELECT COALESCE(SUM(cashback_inr),0) s FROM br_club_cashback WHERE member_id=? AND period_start=? AND status!='REVERSED'").bind(mem.id,ps).first())||{}).s||0;
  const room=Math.max(0,5000-used);
  let capped=false;
  if(cb>room){cb=room;capped=true}
  const cid=crypto.randomUUID();
  await db.prepare("INSERT INTO br_club_commission(id,booking_id,brand_id,bill_inr,fee_pct,commission_inr,status,note,created_at,updated_at) VALUES(?,?,?,?,?,?,'PENDING',?,?,?)").bind(cid,k.id,k.brand_id,bill,pct,comm,note,now,now).run();
  let cbid=null;
  if(cb>0){cbid=crypto.randomUUID();await db.prepare("INSERT INTO br_club_cashback(id,booking_id,member_id,commission_id,cashback_inr,status,period_start,note,created_at,updated_at) VALUES(?,?,?,?,?,'PENDING',?,?,?,?)").bind(cbid,k.id,mem.id,cid,cb,ps,note+(capped?' (capped at Rs 5,000 per 12-month membership period)':''),now,now).run()}
  await db.prepare('INSERT INTO br_audit(actor,action,brand_id,detail,ts) VALUES(?,?,?,?,?)').bind(rv.email,'club-settle',k.brand_id,k.booking_no+' bill Rs'+bill+' fee '+pct+'% = Rs'+comm+' cashback Rs'+cb+(capped?' (capped)':''),now).run();
  return JSONR({ok:true,commission_inr:comm,cashback_inr:cb,capped,status:'PENDING',message:'Recorded as PENDING. Nothing is charged or credited automatically - SRCHN PAY is configuration-required and disabled.'});
 }
 if(p==='/studio/api/review/club-ledger-status'&&request.method==='POST'){
  await clubTables(db);
  const b=await request.json().catch(()=>null);if(!b)return JSONR({error:'Invalid JSON.'},400);
  const note=clean(b.note,500);if(!note)return JSONR({error:'A documented note is required.'},400);
  const st=b.status==='CONFIRMED'?'CONFIRMED':b.status==='REVERSED'?'REVERSED':'';
  if(!st)return JSONR({error:'Status must be CONFIRMED or REVERSED.'},400);
  if(b.kind==='commission'){
   const c=await db.prepare('SELECT * FROM br_club_commission WHERE id=?').bind(clean(b.id,40)).first();
   if(!c)return JSONR({error:'Unknown commission record.'},404);
   await db.prepare('UPDATE br_club_commission SET status=?,note=?,updated_at=? WHERE id=?').bind(st,(c.note||'')+' | '+st+': '+note,now,c.id).run();
   if(st==='REVERSED')await db.prepare("UPDATE br_club_cashback SET status='REVERSED',updated_at=? WHERE commission_id=? AND status!='REVERSED'").bind(now,c.id).run();
   await db.prepare('INSERT INTO br_audit(actor,action,brand_id,detail,ts) VALUES(?,?,?,?,?)').bind(rv.email,'club-commission-'+st.toLowerCase(),c.brand_id,c.id+' :: '+note,now).run();
   return JSONR({ok:true,status:st});
  }
  if(b.kind==='cashback'){
   const c=await db.prepare('SELECT * FROM br_club_cashback WHERE id=?').bind(clean(b.id,40)).first();
   if(!c)return JSONR({error:'Unknown cashback record.'},404);
   if(st==='CONFIRMED'){
    const comm=await db.prepare('SELECT status FROM br_club_commission WHERE id=?').bind(c.commission_id).first();
    if(!comm||comm.status!=='CONFIRMED')return JSONR({error:'Cashback can be confirmed only after the underlying commission is confirmed.'},409);
   }
   await db.prepare('UPDATE br_club_cashback SET status=?,note=?,updated_at=? WHERE id=?').bind(st,(c.note||'')+' | '+st+': '+note,now,c.id).run();
   await db.prepare('INSERT INTO br_audit(actor,action,brand_id,detail,ts) VALUES(?,?,?,?,?)').bind(rv.email,'club-cashback-'+st.toLowerCase(),null,c.id+' :: '+note,now).run();
   return JSONR({ok:true,status:st});
  }
  return JSONR({error:'kind must be commission or cashback.'},400);
 }
 if(p==='/studio/api/review/club-member-delete'&&request.method==='POST'){
  await clubTables(db);
  const b=await request.json().catch(()=>null);if(!b)return JSONR({error:'Invalid JSON.'},400);
  const note=clean(b.note,200);if(!note)return JSONR({error:'A documented note is required.'},400);
  const m=await db.prepare('SELECT * FROM br_club_members WHERE id=?').bind(clean(b.member_id,40)).first();
  if(!m)return JSONR({error:'Unknown member.'},404);
  const nb=((await db.prepare('SELECT COUNT(*) n FROM br_club_bookings WHERE member_id=?').bind(m.id).first())||{}).n||0;
  if(nb)return JSONR({error:'Member has bookings - suspend instead of deleting.'},409);
  await db.batch([
   db.prepare('DELETE FROM br_club_cashback WHERE member_id=?').bind(m.id),
   db.prepare('DELETE FROM br_club_sessions WHERE member_id=?').bind(m.id),
   db.prepare('DELETE FROM br_club_members WHERE id=?').bind(m.id)
  ]);
  await db.prepare('INSERT INTO br_audit(actor,action,brand_id,detail,ts) VALUES(?,?,?,?,?)').bind(rv.email,'club-member-delete',null,m.email+' :: '+note,now).run();
  return JSONR({ok:true,deleted:m.email});
 }
 return null;
}


/* ---------- SRCHN CLUB (brief s8): invite-only membership, P4 ---------- */
async function clubTables(db){
 await db.prepare("CREATE TABLE IF NOT EXISTS br_club_invites(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL,city TEXT,note TEXT,status TEXT NOT NULL DEFAULT 'PENDING',reviewer TEXT,review_note TEXT,created_at INTEGER NOT NULL,decided_at INTEGER)").run();
 await db.prepare("CREATE TABLE IF NOT EXISTS br_club_members(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,city TEXT,status TEXT NOT NULL DEFAULT 'INVITED',invited_by TEXT,invite_id TEXT,invited_at INTEGER NOT NULL,joined_at INTEGER,member_since INTEGER,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL)").run();
 await db.prepare("CREATE TABLE IF NOT EXISTS br_club_sessions(token_hash TEXT PRIMARY KEY,member_id TEXT NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL)").run();
 await db.prepare("CREATE TABLE IF NOT EXISTS br_club_booking_config(brand_id TEXT NOT NULL,location_id TEXT NOT NULL,fee_inr INTEGER NOT NULL DEFAULT 0,terms TEXT,active INTEGER NOT NULL DEFAULT 0,updated_by TEXT,updated_at INTEGER NOT NULL,PRIMARY KEY(brand_id,location_id))").run();
 await db.prepare("CREATE TABLE IF NOT EXISTS br_club_bookings(id TEXT PRIMARY KEY,booking_no TEXT UNIQUE NOT NULL,member_id TEXT NOT NULL,brand_id TEXT NOT NULL,location_id TEXT NOT NULL,visit_date TEXT NOT NULL,visit_time TEXT,people INTEGER NOT NULL DEFAULT 1,fee_inr INTEGER NOT NULL DEFAULT 0,pay_status TEXT NOT NULL DEFAULT 'PAY_NOT_ENABLED',status TEXT NOT NULL DEFAULT 'CONFIRMED',conditions TEXT,checked_in_at INTEGER,cancelled_at INTEGER,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL)").run();
 await db.prepare("CREATE TABLE IF NOT EXISTS br_club_commission(id TEXT PRIMARY KEY,booking_id TEXT NOT NULL,brand_id TEXT NOT NULL,bill_inr INTEGER NOT NULL DEFAULT 0,fee_pct REAL NOT NULL DEFAULT 0,commission_inr INTEGER NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'PENDING',note TEXT,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL)").run();
 await db.prepare("CREATE TABLE IF NOT EXISTS br_club_cashback(id TEXT PRIMARY KEY,booking_id TEXT NOT NULL,member_id TEXT NOT NULL,commission_id TEXT,cashback_inr INTEGER NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'PENDING',period_start INTEGER NOT NULL,note TEXT,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL)").run();
 await db.prepare("CREATE TABLE IF NOT EXISTS br_club_consents(id TEXT PRIMARY KEY,member_id TEXT NOT NULL,purpose TEXT NOT NULL,scope TEXT NOT NULL,text_version TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'GIVEN',given_at INTEGER NOT NULL,withdrawn_at INTEGER)").run();
 await db.prepare("CREATE TABLE IF NOT EXISTS br_club_verification(id TEXT PRIMARY KEY,member_id TEXT NOT NULL,provider TEXT NOT NULL DEFAULT 'DIGILOCKER',status TEXT NOT NULL,audit_ref TEXT UNIQUE NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL)").run();
 try{await db.prepare('ALTER TABLE br_club_members ADD COLUMN mobile TEXT').run()}catch{}
 try{await db.prepare('ALTER TABLE br_club_bookings ADD COLUMN place_name TEXT').run()}catch{}
 try{await db.prepare('ALTER TABLE br_club_bookings ADD COLUMN place_detail TEXT').run()}catch{}
 await db.prepare("CREATE TABLE IF NOT EXISTS br_club_payments(id TEXT PRIMARY KEY,booking_id TEXT NOT NULL,booking_no TEXT NOT NULL,member_id TEXT NOT NULL,kind TEXT NOT NULL,amount_inr INTEGER NOT NULL DEFAULT 0,status TEXT NOT NULL,mock INTEGER NOT NULL DEFAULT 1,created_at INTEGER NOT NULL)").run();
}
async function clubAuth(request,db){
 const h=request.headers.get('Authorization')||'';const m=/^Bearer ([a-f0-9]{64})$/.exec(h);if(!m)return null;
 const s=await db.prepare('SELECT * FROM br_club_sessions WHERE token_hash=? AND expires_at>?').bind(await hash(m[1]),Date.now()).first();
 if(!s)return null;
 return db.prepare("SELECT * FROM br_club_members WHERE id=? AND status!='SUSPENDED'").bind(s.member_id).first();
}
async function clubRoute(request,env){
 const u=new URL(request.url),p=u.pathname,now=Date.now(),db=env.DB;
 if(!db)return JSONR({error:'Club storage unavailable.'},503);
 await clubTables(db);
 const CLUB_CAP=5000,EMAIL_RE2=/^[^@\s]+@[^@\s]+\.[^@\s]+$/;
 if(p==='/club/api/invite-request'&&request.method==='POST'){
  const b=await request.json().catch(()=>null);if(!b)return JSONR({error:'Invalid JSON.'},400);
  const name=clean(b.name,80),email=clean(b.email,254).toLowerCase(),city=clean(b.city,60),note=clean(b.note,500);
  if(!name||name.length<2)return JSONR({error:'Please share your name.'},400);
  if(!EMAIL_RE2.test(email))return JSONR({error:'Please share a valid email address.'},400);
  if(note&&PII.test(note))return JSONR({error:'Use a short note without emails, phone numbers, ID numbers or private information.'},400);
  const id=crypto.randomUUID();
  const saved=await db.prepare("INSERT INTO br_club_invites SELECT ?,?,?,?,?,'PENDING',NULL,NULL,?,NULL WHERE (SELECT COUNT(*) FROM br_club_invites WHERE created_at>?)<20 AND NOT EXISTS(SELECT 1 FROM br_club_invites WHERE email=? AND status='PENDING') RETURNING id").bind(id,name,email,city||null,note||null,now,now-86400000,email).first();
  if(!saved)return JSONR({error:'Your request is already with us, or too many requests today. Please try again tomorrow.'},429);
  return JSONR({ok:true,message:'Request received. SRCHN CLUB is invite-only - Team SRCHN reviews every request, and an invitation is not guaranteed.'},201);
 }
 if(p==='/club/api/login/start'&&request.method==='POST'){
  const b=await request.json().catch(()=>null);const email=clean(b&&b.email,254).toLowerCase();
  const generic={ok:true,message:'If a Club membership exists for this email, a sign-in code is on its way.'};
  if(!EMAIL_RE2.test(email))return JSONR(generic);
  const m=await db.prepare("SELECT * FROM br_club_members WHERE email=? AND status!='SUSPENDED'").bind(email).first();
  if(!m)return JSONR(generic);
  if(env.BUDGETDB){try{const ok=await env.BUDGETDB.prepare('INSERT INTO preview_mail_budget(key,count) VALUES(?,1) ON CONFLICT(key) DO UPDATE SET count=count+1 WHERE count<20 RETURNING count').bind('club:'+new Date(now).toISOString().slice(0,10)).first();if(!ok)return JSONR({error:'Too many codes requested today. Please try again tomorrow.'},429)}catch{}}
  const code=String(Math.floor(100000+Math.random()*900000));
  await db.prepare("INSERT INTO stu_otp(id,email,code_hash,purpose,expires_at,created_at) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(),email,await hash(code),'club_login',now+600000,now).run();
  try{await stuMail(env,{task:'club_otp',to:email,code,name:m.name})}catch{}
  return JSONR(generic);
 }
 if(p==='/club/api/login/verify'&&request.method==='POST'){
  const b=await request.json().catch(()=>null);const email=clean(b&&b.email,254).toLowerCase(),code=clean(b&&b.code,6);
  if(!email||!/^\d{6}$/.test(code||''))return JSONR({error:'Enter the 6-digit code.'},400);
  const row=await db.prepare("SELECT * FROM stu_otp WHERE email=? AND purpose='club_login' AND used_at IS NULL ORDER BY created_at DESC LIMIT 1").bind(email).first();
  if(!row||row.expires_at<now)return JSONR({error:'Code expired. Request a new one.'},400);
  if(row.code_hash!==await hash(code))return JSONR({error:'Incorrect code.'},400);
  const m=await db.prepare("SELECT * FROM br_club_members WHERE email=? AND status!='SUSPENDED'").bind(email).first();
  if(!m)return JSONR({error:'No active Club membership for this email.'},403);
  await db.prepare('UPDATE stu_otp SET used_at=? WHERE id=?').bind(now,row.id).run();
  if(m.status==='INVITED'){await db.prepare("UPDATE br_club_members SET status='ACTIVE',joined_at=?,member_since=?,updated_at=? WHERE id=?").bind(now,now,now,m.id).run()}
  const t=randomHex(32);
  await db.prepare('INSERT INTO br_club_sessions(token_hash,member_id,created_at,expires_at) VALUES(?,?,?,?)').bind(await hash(t),m.id,now,now+30*86400000).run();
  return JSONR({ok:true,token:t});
 }
 if(p==='/club/api/logout'&&request.method==='POST'){
  const h=request.headers.get('Authorization')||'';const m=/^Bearer ([a-f0-9]{64})$/.exec(h);
  if(m)await db.prepare('DELETE FROM br_club_sessions WHERE token_hash=?').bind(await hash(m[1])).run();
  return JSONR({signed_out:true});
 }
 if(p==='/club/api/me'&&request.method==='GET'){
  const m=await clubAuth(request,db);if(!m)return JSONR({signed_in:false},401);
  const ps=m.member_since||m.joined_at||m.invited_at;
  const used=((await db.prepare("SELECT COALESCE(SUM(cashback_inr),0) s FROM br_club_cashback WHERE member_id=? AND period_start=? AND status!='REVERSED'").bind(m.id,ps).first())||{}).s||0;
  const nb=((await db.prepare('SELECT COUNT(*) n FROM br_club_bookings WHERE member_id=?').bind(m.id).first())||{}).n||0;
  return JSONR({signed_in:true,member:{name:m.name,email:m.email,city:m.city||'',status:m.status,member_since:m.member_since||null},membership:{period_start:ps,period_end:ps+365*86400000,cashback_cap_inr:CLUB_CAP,cashback_used_inr:used,bookings:nb}});
 }
 if(p==='/club/api/brands'&&request.method==='GET'){
  const rows=await brListQuery(db,"b.status='PUBLISHED' AND b.club=1",[]);
  return JSONR({brands:(rows.results||[]).map(b=>({slug:b.slug,name:b.name,category:b.category,tagline:b.tagline||'',locality:b.first_locality||'',locations:b.loc_count,logo:b.logo_media?brMediaUrl(b.logo_media):null}))});
 }
 if(p==='/club/api/bookings'&&request.method==='GET'){
  const m=await clubAuth(request,db);if(!m)return JSONR({error:'Sign in required.'},401);
  const rows=(await db.prepare("SELECT k.booking_no,k.location_id,k.visit_date,k.visit_time,k.people,k.fee_inr,k.pay_status,k.status,k.checked_in_at,k.created_at,COALESCE(b.name,k.place_name,'') AS brand_name,b.slug AS brand_slug,COALESCE(l.name,k.place_detail,'') AS location_name,l.locality FROM br_club_bookings k LEFT JOIN br_brands b ON b.id=k.brand_id LEFT JOIN br_locations l ON l.id=k.location_id WHERE k.member_id=? ORDER BY k.created_at DESC LIMIT 100").bind(m.id).all()).results||[];
  return JSONR({bookings:rows});
 }
 if(p==='/club/api/cashback'&&request.method==='GET'){
  const m=await clubAuth(request,db);if(!m)return JSONR({error:'Sign in required.'},401);
  const rows=(await db.prepare('SELECT booking_id,cashback_inr,status,note,created_at FROM br_club_cashback WHERE member_id=? ORDER BY created_at DESC LIMIT 100').bind(m.id).all()).results||[];
  return JSONR({cashback:rows,cap_inr:CLUB_CAP,cap_period:'12-month membership period'});
 }
 if(p==='/club/api/booking-options'&&request.method==='GET'){
  const m=await clubAuth(request,db);if(!m)return JSONR({error:'Sign in required.'},401);
  const rows=(await db.prepare("SELECT c.location_id,c.fee_inr,c.terms,b.name AS brand_name,b.slug AS brand_slug,l.name AS location_name,l.locality FROM br_club_booking_config c JOIN br_brands b ON b.id=c.brand_id JOIN br_locations l ON l.id=c.location_id WHERE c.active=1 AND b.status='PUBLISHED' AND b.club=1 AND l.status='PUBLISHED' ORDER BY b.name,l.name").all()).results||[];
  return JSONR({options:rows});
 }
 if(p==='/club/api/book'&&request.method==='POST'){
  const m=await clubAuth(request,db);if(!m)return JSONR({error:'Club membership required.'},401);
  if(m.status!=='ACTIVE')return JSONR({error:'Membership is not active.'},403);
  const b=await request.json().catch(()=>null);if(!b)return JSONR({error:'Invalid JSON.'},400);
  const loc=await db.prepare("SELECT l.*,b.name AS brand_name,b.club AS brand_club,b.status AS brand_status FROM br_locations l JOIN br_brands b ON b.id=l.brand_id WHERE l.id=?").bind(clean(b.location_id,40)).first();
  if(!loc||loc.status!=='PUBLISHED'||loc.brand_status!=='PUBLISHED'||loc.brand_club!==1)return JSONR({error:'This location is not available for Club booking.'},404);
  const cfg=await db.prepare('SELECT * FROM br_club_booking_config WHERE brand_id=? AND location_id=? AND active=1').bind(loc.brand_id,loc.id).first();
  if(!cfg)return JSONR({error:'Booking is not configured for this location.'},404);
  const date=clean(b.visit_date,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return JSONR({error:'Choose a visit date.'},400);
  const today=new Date(now+330*60000).toISOString().slice(0,10);
  const maxd=new Date(now+60*86400000).toISOString().slice(0,10);
  if(date<today||date>maxd)return JSONR({error:'Choose a date between today and the next 60 days.'},400);
  const time=clean(b.visit_time,5);
  if(time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))return JSONR({error:'Choose a valid time.'},400);
  const people=Math.max(1,Math.min(20,parseInt(b.people)||1));
  if(cfg.terms&&b.conditions_accepted!==true)return JSONR({error:'Please review and accept the booking conditions.'},400);
  let id=null,bno=null;
  for(let i=0;i<3;i++){
   id=crypto.randomUUID();bno='SRCHN-CLB-'+randomHex(4).toUpperCase();
   try{await db.prepare("INSERT INTO br_club_bookings(id,booking_no,member_id,brand_id,location_id,visit_date,visit_time,people,fee_inr,pay_status,status,conditions,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,'PAY_NOT_ENABLED','CONFIRMED',?,?,?)").bind(id,bno,m.id,loc.brand_id,loc.id,date,time||null,people,cfg.fee_inr,cfg.terms||null,now,now).run();break}
   catch(e){id=null}
  }
  if(!id)return JSONR({error:'Could not create the booking. Please try again.'},500);
  let email='skipped';
  try{const r=await stuMail(env,{task:'club_booking',to:m.email,name:m.name,booking_no:bno,brand:loc.brand_name,location:loc.name,date,time:time||'',people:String(people),fee:String(cfg.fee_inr)});email=r.ok?'sent':'failed'}catch{email='failed'}
  return JSONR({ok:true,booking:{booking_no:bno,brand:loc.brand_name,location:loc.name,visit_date:date,visit_time:time||null,people,fee_inr:cfg.fee_inr,pay_status:'PAY_NOT_ENABLED',status:'CONFIRMED'},email,payment_note:cfg.fee_inr?('Booking fee Rs '+cfg.fee_inr+' - SRCHN PAY is not yet enabled (configuration required). No payment has been taken.'):'No booking fee. SRCHN PAY is not yet enabled (configuration required).'},201);
 }
 if(p==='/club/api/cancel-booking'&&request.method==='POST'){
  const m=await clubAuth(request,db);if(!m)return JSONR({error:'Sign in required.'},401);
  const b=await request.json().catch(()=>null);
  const k=await db.prepare('SELECT * FROM br_club_bookings WHERE booking_no=? AND member_id=?').bind(clean(b&&b.booking_no,20),m.id).first();
  if(!k)return JSONR({error:'Booking not found.'},404);
  if(k.status!=='CONFIRMED')return JSONR({error:'Only a confirmed booking can be cancelled.'},409);
  await db.prepare("UPDATE br_club_bookings SET status='CANCELLED',cancelled_at=?,updated_at=? WHERE id=?").bind(now,now,k.id).run();
  return JSONR({ok:true,status:'CANCELLED'});
 }
 if(p==='/club/api/check-in'&&request.method==='POST'){
  const m=await clubAuth(request,db);if(!m)return JSONR({error:'Sign in required.'},401);
  const b=await request.json().catch(()=>null);
  const k=await db.prepare('SELECT * FROM br_club_bookings WHERE booking_no=? AND member_id=?').bind(clean(b&&b.booking_no,20),m.id).first();
  if(!k)return JSONR({error:'Booking not found.'},404);
  if(k.status!=='CONFIRMED')return JSONR({error:'Only a confirmed booking can be checked in.'},409);
  const today=new Date(now+330*60000).toISOString().slice(0,10);
  if(k.visit_date!==today)return JSONR({error:'Check-in opens on the visit date ('+k.visit_date+').'},409);
  await db.prepare("UPDATE br_club_bookings SET status='CHECKED_IN',checked_in_at=?,updated_at=? WHERE id=?").bind(now,now,k.id).run();
  return JSONR({ok:true,status:'CHECKED_IN',checked_in_at:now});
 }
 if(p==='/club/api/payments'&&request.method==='GET'){
  const m=await clubAuth(request,db);if(!m)return JSONR({error:'Sign in required.'},401);
  const rows=(await db.prepare('SELECT booking_no,kind,amount_inr,status,mock,created_at FROM br_club_payments WHERE member_id=? ORDER BY created_at DESC LIMIT 100').bind(m.id).all()).results||[];
  return JSONR({payments:rows});
 }
 if(p==='/club/api/mock-pay-fee'&&request.method==='POST'){
  if(!/\.pages\.dev$/.test(u.hostname))return JSONR({error:'Not found.'},404);
  const m=await clubAuth(request,db);if(!m)return JSONR({error:'Sign in required.'},401);
  const b=await request.json().catch(()=>null);
  const k=await db.prepare('SELECT * FROM br_club_bookings WHERE booking_no=? AND member_id=?').bind(clean(b&&b.booking_no,20),m.id).first();
  if(!k)return JSONR({error:'Booking not found.'},404);
  if(k.status!=='CONFIRMED'&&k.status!=='CHECKED_IN')return JSONR({error:'This booking is not payable.'},409);
  if(k.pay_status==='MOCK_PAID')return JSONR({error:'The preview mock fee is already marked paid for this booking.'},409);
  if(!k.fee_inr)return JSONR({error:'This booking has no fee.'},400);
  const pid=crypto.randomUUID();
  await db.prepare("INSERT INTO br_club_payments(id,booking_id,booking_no,member_id,kind,amount_inr,status,mock,created_at) VALUES(?,?,?,?,'FEE',?,'MOCK_PAID',1,?)").bind(pid,k.id,k.booking_no,m.id,k.fee_inr,now).run();
  await db.prepare("UPDATE br_club_bookings SET pay_status='MOCK_PAID',updated_at=? WHERE id=?").bind(now,k.id).run();
  await db.prepare('INSERT INTO br_audit(actor,action,brand_id,detail,ts) VALUES(?,?,?,?,?)').bind(m.email,'club-mock-pay-fee',k.brand_id,k.booking_no+' fee Rs'+k.fee_inr+' (preview mock, no real charge)',now).run();
  return JSONR({ok:true,mock:true,payment:{booking_no:k.booking_no,kind:'FEE',amount_inr:k.fee_inr,status:'MOCK_PAID'},message:'Preview mock payment recorded - no real charge was made. SRCHN PAY remains configuration-required and disabled.'});
 }
 if(p==='/club/api/mock-pay-bill'&&request.method==='POST'){
  if(!/\.pages\.dev$/.test(u.hostname))return JSONR({error:'Not found.'},404);
  const m=await clubAuth(request,db);if(!m)return JSONR({error:'Sign in required.'},401);
  const b=await request.json().catch(()=>null);
  const k=await db.prepare('SELECT * FROM br_club_bookings WHERE booking_no=? AND member_id=?').bind(clean(b&&b.booking_no,20),m.id).first();
  if(!k)return JSONR({error:'Booking not found.'},404);
  if(k.status!=='CHECKED_IN')return JSONR({error:'Check in first - the bill is paid at the venue during your visit.'},409);
  const dup=await db.prepare("SELECT id FROM br_club_commission WHERE booking_id=? AND status!='REVERSED'").bind(k.id).first();
  if(dup)return JSONR({error:'The bill for this visit is already recorded.'},409);
  const bill=Math.max(1,Math.min(1000000,parseInt(b&&b.bill_inr)||0));
  const pct=20,cbpct=5;
  const comm=Math.round(bill*pct/100);
  let cb=Math.round(comm*cbpct/100);
  const ps=m.member_since||m.joined_at||m.invited_at;
  const used=((await db.prepare("SELECT COALESCE(SUM(cashback_inr),0) s FROM br_club_cashback WHERE member_id=? AND period_start=? AND status!='REVERSED'").bind(m.id,ps).first())||{}).s||0;
  const room=Math.max(0,CLUB_CAP-used);let capped=false;
  if(cb>room){cb=room;capped=true}
  const pid=crypto.randomUUID(),cid=crypto.randomUUID();
  const mnote='PREVIEW MOCK - no real charge. Bill settled at venue during visit; agreed success fee 20% illustration per Club terms.';
  await db.prepare("INSERT INTO br_club_payments(id,booking_id,booking_no,member_id,kind,amount_inr,status,mock,created_at) VALUES(?,?,?,?,'BILL',?,'MOCK_PAID',1,?)").bind(pid,k.id,k.booking_no,m.id,bill,now).run();
  await db.prepare("INSERT INTO br_club_commission(id,booking_id,brand_id,bill_inr,fee_pct,commission_inr,status,note,created_at,updated_at) VALUES(?,?,?,?,?,?,'PENDING',?,?,?)").bind(cid,k.id,k.brand_id,bill,pct,comm,mnote,now,now).run();
  let cbid=null;
  if(cb>0){cbid=crypto.randomUUID();await db.prepare("INSERT INTO br_club_cashback(id,booking_id,member_id,commission_id,cashback_inr,status,period_start,note,created_at,updated_at) VALUES(?,?,?,?,?,'PENDING',?,?,?,?)").bind(cbid,k.id,m.id,cid,cb,ps,mnote+(capped?' (capped at Rs 5,000 per 12-month membership period)':''),now,now).run()}
  await db.prepare('INSERT INTO br_audit(actor,action,brand_id,detail,ts) VALUES(?,?,?,?,?)').bind(m.email,'club-mock-pay-bill',k.brand_id,k.booking_no+' bill Rs'+bill+' fee '+pct+'% = Rs'+comm+' cashback Rs'+cb+' (preview mock, no real charge)',now).run();
  return JSONR({ok:true,mock:true,payment:{booking_no:k.booking_no,kind:'BILL',amount_inr:bill,status:'MOCK_PAID'},commission_inr:comm,cashback_inr:cb,capped,message:'Preview mock bill payment recorded - no real charge was made. Commission and cashback are PENDING illustration records. SRCHN PAY remains configuration-required and disabled.'});
 }
 const VTEXT='v1-2026-11-03';
 const VPURPOSE='Identity verification for SRCHN CLUB membership and higher-risk transaction journeys, when legally and commercially necessary.';
 const VSCOPE='Name and date-of-birth verification result from a document you choose and share in the official DigiLocker flow. SRCHN never receives or stores your DigiLocker password, OTP or Aadhaar number. Only the minimum verification result and an audit reference are stored.';
 if(p==='/club/api/verification'&&request.method==='GET'){
  const m=await clubAuth(request,db);if(!m)return JSONR({error:'Sign in required.'},401);
  const c=await db.prepare('SELECT * FROM br_club_consents WHERE member_id=? ORDER BY given_at DESC LIMIT 1').bind(m.id).first();
  const v=await db.prepare('SELECT * FROM br_club_verification WHERE member_id=? ORDER BY created_at DESC LIMIT 1').bind(m.id).first();
  return JSONR({provider:{name:'DigiLocker',enabled:false,label:'Configuration required - currently disabled'},consent:c?{status:c.status,given_at:c.given_at,withdrawn_at:c.withdrawn_at||null,text_version:c.text_version}:null,verification:v?{status:v.status,audit_ref:v.audit_ref,since:v.created_at}:null,purpose:VPURPOSE,scope:VSCOPE,text_version:VTEXT});
 }
 if(p==='/club/api/verification-consent'&&request.method==='POST'){
  const m=await clubAuth(request,db);if(!m)return JSONR({error:'Sign in required.'},401);
  const b=await request.json().catch(()=>null);
  if(!b||b.accept!==true)return JSONR({error:'Explicit consent is required to continue.'},400);
  const active=await db.prepare("SELECT id FROM br_club_consents WHERE member_id=? AND status='GIVEN'").bind(m.id).first();
  if(active)return JSONR({error:'Consent is already recorded. You can withdraw it below.'},409);
  const cid=crypto.randomUUID(),vid=crypto.randomUUID();
  const ref='VRF-'+crypto.randomUUID().replace(/-/g,'').slice(0,8).toUpperCase();
  await db.prepare('INSERT INTO br_club_consents(id,member_id,purpose,scope,text_version,status,given_at) VALUES(?,?,?,?,?,?,?)').bind(cid,m.id,VPURPOSE,VSCOPE,VTEXT,'GIVEN',now).run();
  await db.prepare('INSERT INTO br_club_verification(id,member_id,provider,status,audit_ref,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind(vid,m.id,'DIGILOCKER','PROVIDER_DISABLED',ref,now,now).run();
  await db.prepare('INSERT INTO br_audit(actor,action,brand_id,detail,ts) VALUES(?,?,?,?,?)').bind(m.email,'club-verify-consent',null,ref,now).run();
  return JSONR({ok:true,verification:{status:'PROVIDER_DISABLED',audit_ref:ref},message:'Consent recorded. The DigiLocker integration is configuration-required and currently disabled, so verification cannot start yet. You can withdraw consent at any time.'});
 }
 if(p==='/club/api/verification-start'&&request.method==='POST'){
  const m=await clubAuth(request,db);if(!m)return JSONR({error:'Sign in required.'},401);
  return JSONR({error:'DigiLocker integration is configuration-required and currently disabled. SRCHN requester onboarding and API approval are pending, so verification cannot start yet.',configuration_required:true},503);
 }
 if(p==='/club/api/verification-withdraw'&&request.method==='POST'){
  const m=await clubAuth(request,db);if(!m)return JSONR({error:'Sign in required.'},401);
  const c=await db.prepare("SELECT * FROM br_club_consents WHERE member_id=? AND status='GIVEN' ORDER BY given_at DESC LIMIT 1").bind(m.id).first();
  if(!c)return JSONR({error:'No active consent to withdraw.'},409);
  await db.prepare("UPDATE br_club_consents SET status='WITHDRAWN',withdrawn_at=? WHERE id=?").bind(now,c.id).run();
  await db.prepare("UPDATE br_club_verification SET status='WITHDRAWN',updated_at=? WHERE member_id=? AND status='PROVIDER_DISABLED'").bind(now,m.id).run();
  await db.prepare('INSERT INTO br_audit(actor,action,brand_id,detail,ts) VALUES(?,?,?,?,?)').bind(m.email,'club-verify-withdraw',null,'consent '+c.id.slice(0,8)+' withdrawn',now).run();
  return JSONR({ok:true,status:'WITHDRAWN',message:'Consent withdrawn. Your verification record has been closed; no identity data is stored.'});
 }
 if(p==='/club/api/book/context'&&request.method==='GET'){
  const lid=clean(u.searchParams.get('l')||'',40),bid=clean(u.searchParams.get('b')||'',40);
  if(lid){
   const loc=await db.prepare("SELECT l.id,l.name,l.locality,l.address,b.id AS brand_id,b.name AS brand_name,b.slug FROM br_locations l JOIN br_brands b ON b.id=l.brand_id WHERE l.id=? AND l.status='PUBLISHED' AND b.status='PUBLISHED'").bind(lid).first();
   if(!loc)return JSONR({error:'Place not found.'},404);
   const options=(await db.prepare("SELECT id,name,locality FROM br_locations WHERE brand_id=? AND status='PUBLISHED' ORDER BY created_at").bind(loc.brand_id).all()).results||[];
   return JSONR({ok:true,kind:'brand',brand:{id:loc.brand_id,name:loc.brand_name,slug:loc.slug},location:{id:loc.id,name:loc.name,locality:loc.locality||''},options});
  }
  if(bid){
   const b=await db.prepare("SELECT id,name,slug FROM br_brands WHERE id=? AND status='PUBLISHED'").bind(bid).first();
   if(!b)return JSONR({error:'Place not found.'},404);
   const options=(await db.prepare("SELECT id,name,locality FROM br_locations WHERE brand_id=? AND status='PUBLISHED' ORDER BY created_at").bind(b.id).all()).results||[];
   if(!options.length)return JSONR({error:'This brand has no published locations yet.'},404);
   return JSONR({ok:true,kind:'brand',brand:b,location:options.length===1?options[0]:null,options});
  }
  const place=clean(u.searchParams.get('place')||'',120);
  if(place)return JSONR({ok:true,kind:'place',place:{name:place,locality:clean(u.searchParams.get('locality')||'',80),ref:clean(u.searchParams.get('ref')||'',40)}});
  return JSONR({error:'No place specified.'},400);
 }
 if(p==='/club/api/book/start'&&request.method==='POST'){
  if(request.headers.get('Origin')!==u.origin)return JSONR({error:'Origin refused.'},403);
  const b=await request.json().catch(()=>null);if(!b)return JSONR({error:'Invalid JSON.'},400);
  const name=clean(b.name,80),email=clean(b.email,254).toLowerCase();
  let mobile=String(b.mobile||'').replace(/\D/g,'');if(mobile.length===12&&mobile.startsWith('91'))mobile=mobile.slice(2);
  if(!name||name.length<2)return JSONR({error:'Please share your full name.'},400);
  if(!/^[6-9]\d{9}$/.test(mobile))return JSONR({error:'Enter a valid 10-digit Indian mobile number.'},400);
  if(!EMAIL_RE2.test(email))return JSONR({error:'Please share a valid email address.'},400);
  let m=await db.prepare("SELECT * FROM br_club_members WHERE email=? AND status!='SUSPENDED'").bind(email).first();
  if(!m){const nid=crypto.randomUUID();await db.prepare("INSERT INTO br_club_members(id,email,name,city,status,invited_by,invited_at,created_at,updated_at,mobile) VALUES(?,?,?,?,'INVITED','self-service booking',?,?,?,?)").bind(nid,email,name,null,now,now,now,mobile).run();m=await db.prepare('SELECT * FROM br_club_members WHERE id=?').bind(nid).first()}
  else await db.prepare('UPDATE br_club_members SET name=?,mobile=?,updated_at=? WHERE id=?').bind(name,mobile,now,m.id).run();
  if(env.BUDGETDB){try{const ok=await env.BUDGETDB.prepare('INSERT INTO preview_mail_budget(key,count) VALUES(?,1) ON CONFLICT(key) DO UPDATE SET count=count+1 WHERE count<20 RETURNING count').bind('club:'+new Date(now).toISOString().slice(0,10)).first();if(!ok)return JSONR({error:'Too many codes requested today. Please try again tomorrow.'},429)}catch{}}
  const code=String(Math.floor(100000+Math.random()*900000));
  await db.prepare("INSERT INTO stu_otp(id,email,code_hash,purpose,expires_at,created_at) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(),email,await hash(code),'club_login',now+600000,now).run();
  let es='failed';try{const r=await stuMail(env,{task:'club_otp',to:email,code,name});es=r&&r.ok?'sent':'failed'}catch{}
  const sms=String(Math.floor(100000+Math.random()*900000));
  return JSONR({ok:true,email_code:es,sms_demo_code:sms,sms_note:'DEMO only - no SMS gateway is connected in this zero-spend build, so no SMS was sent. The demo SMS code is shown on screen.'});
 }
 if(p==='/club/api/book/confirm'&&request.method==='POST'){
  if(request.headers.get('Origin')!==u.origin)return JSONR({error:'Origin refused.'},403);
  const b=await request.json().catch(()=>null);if(!b)return JSONR({error:'Invalid JSON.'},400);
  const email=clean(b.email,254).toLowerCase(),code=clean(b.code,6);
  if(!/^\d{6}$/.test(code||''))return JSONR({error:'Enter the 6-digit email code.'},400);
  const row=await db.prepare("SELECT * FROM stu_otp WHERE email=? AND purpose='club_login' AND used_at IS NULL ORDER BY created_at DESC LIMIT 1").bind(email).first();
  if(!row||row.expires_at<now)return JSONR({error:'Code expired. Start the booking again.'},400);
  if(row.code_hash!==await hash(code))return JSONR({error:'Incorrect email code.'},400);
  const m=await db.prepare("SELECT * FROM br_club_members WHERE email=? AND status!='SUSPENDED'").bind(email).first();
  if(!m)return JSONR({error:'Registration was not found. Start the booking again.'},400);
  const date=clean(b.visit_date,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return JSONR({error:'Choose a visit date.'},400);
  const today=new Date(now+330*60000).toISOString().slice(0,10),maxd=new Date(now+60*86400000).toISOString().slice(0,10);
  if(date<today||date>maxd)return JSONR({error:'Choose a date between today and the next 60 days.'},400);
  const time=clean(b.visit_time,5);if(time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))return JSONR({error:'Choose a valid time.'},400);
  const people=Math.max(1,Math.min(20,parseInt(b.people)||1));
  let brandId='',locId='',placeName='',placeDetail='',brandName='',locName='',fee=0,terms=null;
  if(b.location_id){
   const loc=await db.prepare("SELECT l.*,b.name AS brand_name,b.status AS brand_status FROM br_locations l JOIN br_brands b ON b.id=l.brand_id WHERE l.id=?").bind(clean(b.location_id,40)).first();
   if(!loc||loc.status!=='PUBLISHED'||loc.brand_status!=='PUBLISHED')return JSONR({error:'This place is not available for booking.'},404);
   brandId=loc.brand_id;locId=loc.id;brandName=loc.brand_name;locName=loc.name+(loc.locality&&loc.locality.toLowerCase()!==loc.name.toLowerCase()?', '+loc.locality:'');
   const cfg=await db.prepare('SELECT * FROM br_club_booking_config WHERE brand_id=? AND location_id=? AND active=1').bind(loc.brand_id,loc.id).first();
   if(cfg){fee=cfg.fee_inr||0;terms=cfg.terms||null}
  }else{
   placeName=clean(b.place_name,120);if(!placeName)return JSONR({error:'No place specified.'},400);
   placeDetail=clean(b.place_detail,200);brandName=placeName;locName=placeDetail||'Open-data place';
  }
  if(terms&&b.conditions_accepted!==true)return JSONR({error:'Please review and accept the booking conditions.'},400);
  await db.prepare('UPDATE stu_otp SET used_at=? WHERE id=?').bind(now,row.id).run();
  if(m.status==='INVITED'){await db.prepare("UPDATE br_club_members SET status='ACTIVE',joined_at=?,member_since=?,updated_at=? WHERE id=?").bind(now,now,now,m.id).run()}
  const t=randomHex(32);
  await db.prepare('INSERT INTO br_club_sessions(token_hash,member_id,created_at,expires_at) VALUES(?,?,?,?)').bind(await hash(t),m.id,now,now+30*86400000).run();
  let id=null,bno=null;
  for(let i=0;i<3;i++){
   id=crypto.randomUUID();bno='SRCHN-CLB-'+randomHex(4).toUpperCase();
   try{await db.prepare("INSERT INTO br_club_bookings(id,booking_no,member_id,brand_id,location_id,visit_date,visit_time,people,fee_inr,pay_status,status,conditions,place_name,place_detail,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,'PAY_NOT_ENABLED','CONFIRMED',?,?,?,?,?)").bind(id,bno,m.id,brandId,locId,date,time||null,people,fee,terms,placeName||null,placeDetail||null,now,now).run();break}
   catch(e){id=null}
  }
  if(!id)return JSONR({error:'Could not create the booking. Please try again.'},500);
  let es='skipped';try{const r=await stuMail(env,{task:'club_booking',to:email,name:m.name,booking_no:bno,brand:brandName,location:locName,date,time:time||'',people:String(people),fee:String(fee)});es=r&&r.ok?'sent':'failed'}catch{}
  return JSONR({ok:true,token:t,booking:{booking_no:bno,brand:brandName,location:locName,visit_date:date,visit_time:time||null,people,fee_inr:fee,pay_status:'PAY_NOT_ENABLED',status:'CONFIRMED'},email:es,payment_note:'No payment taken - SRCHN PAY is configuration-required and currently disabled. The Pay button on place pages is a clearly labelled interface demo.'},201);
 }
 if(p==='/club/book/'||p==='/club/book'){
  let body='<section class="br-sec"><p class="br-eyebrow">SRCHN CLUB</p><h1>Book a visit</h1><div class="cl-note" id="bk-place">Loading place...</div>'
  +'<form id="bk-f" class="cl-form"><div id="bk-locwrap"></div>'
  +'<label>Full name<input required name="name" maxlength="80" autocomplete="name"/></label>'
  +'<label>Mobile number<input required name="mobile" inputmode="numeric" maxlength="12" placeholder="10-digit mobile" autocomplete="tel"/></label>'
  +'<label>Email<input required type="email" name="email" maxlength="254" autocomplete="email"/></label>'
  +'<label>Visit date<input required type="date" name="visit_date"/></label>'
  +'<label>Time (optional)<input type="time" name="visit_time"/></label>'
  +'<label>People<input type="number" name="people" min="1" max="20" value="2"/></label>'
  +'<p id="bk-terms-wrap" hidden><label style="display:flex;flex-direction:row;gap:8px;align-items:flex-start"><input type="checkbox" id="bk-accept" style="width:auto;margin-top:4px"/> <span id="bk-terms"></span></label></p>'
  +'<button class="br-btn br-btn-primary" type="submit">REGISTER AND SEND CODES</button>'
  +'<p class="cl-msg" id="bk-msg"></p></form>'
  +'<form id="bk-v" class="cl-form" hidden>'
  +'<p class="cl-note"><b>Two codes.</b> <b>Email:</b> a real one-time code was emailed to you (daily sending volume is limited). <b>SMS - DEMO:</b> no SMS gateway is connected in this zero-spend build, so no SMS was sent; the demo SMS code is shown here: <b id="bk-sms"></b></p>'
  +'<label>Email code<input required name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code"/></label>'
  +'<label>SMS code (demo)<input required name="sms" inputmode="numeric" pattern="[0-9]{6}" maxlength="6"/></label>'
  +'<button class="br-btn br-btn-primary" type="submit">CONFIRM BOOKING</button>'
  +'<p class="cl-msg" id="bk-vmsg"></p></form>'
  +'<div id="bk-done" hidden></div>'
  +'<p class="cl-note" style="margin-top:18px"><b>What is real and what is a demo.</b> Registration, the email code, your Club membership and the booking record are real. The SMS code is an on-screen demo - nothing is sent. Payment is not enabled anywhere on SRCHN; every Pay button is a labelled interface demo.</p>'
  +'</section><script src="/brands/book.js" defer></script>';
  return new Response(brChrome({title:'Book a visit | SRCHN CLUB',desc:'Book a visit at a listed place: register with name, mobile and email, verify with an email code (SMS step is a labelled demo), get a booking ID. No payment is taken.',canon:u.origin+'/club/book/',active:'Club',body}),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-cache'}});
 }
 if(p==='/club/'||p==='/club'){
  const clubBrands=(await brListQuery(db,"b.status='PUBLISHED' AND b.club=1",[])).results||[];
  let body='<section class="br-hero br-hero-slim"><p class="br-eyebrow">SRCHN CLUB</p><h1>AN INVITE-ONLY ACCESS LAYER.</h1><div class="cl-memcard"><div class="cl-memcard-row"><span>SRCHN CLUB</span><span>MEMBERSHIP</span></div><p class="cl-memcard-name">YOUR MEMBERSHIP</p><p class="cl-memcard-no">&middot;&middot;&middot;&middot; &middot;&middot;&middot;&middot;</p><p class="cl-memcard-sub">Brands &middot; places &middot; spaces &middot; experiences</p></div><p class="br-lede">A curated membership across participating brands, places, spaces and experiences - member offers, bookings, check-in and eligible cashback on SRCHN PAY. Not a public discount directory.</p></section>';
  body+='<section class="br-sec" id="invite"><h2>Request an invite</h2><p>Share your details and Team SRCHN will review your request. If approved, your invitation arrives by email.</p><form id="cl-inv" class="cl-form"><label>Full name<input required name="name" maxlength="80" autocomplete="name"/></label><label>Email<input required type="email" name="email" maxlength="254" autocomplete="email"/></label><label>City<input name="city" maxlength="60" value="Bengaluru"/></label><label>Anything you would like us to know (optional)<textarea name="note" maxlength="500" rows="3"></textarea></label><button class="br-btn br-btn-primary" type="submit">REQUEST AN INVITE</button><p class="cl-msg" id="cl-inv-msg"></p></form></section>';
  body+='<section class="br-sec" id="signin"><h2>Member sign-in</h2><p>Invited members sign in with their email - we send a one-time code, no password.</p><form id="cl-login" class="cl-form"><label>Email<input required type="email" name="email" maxlength="254" autocomplete="email"/></label><button class="br-btn br-btn-primary" type="submit">SEND SIGN-IN CODE</button></form><form id="cl-verify" class="cl-form" hidden><label>6-digit code<input required name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code"/></label><button class="br-btn br-btn-primary" type="submit">SIGN IN</button></form><p class="cl-msg" id="cl-login-msg"></p></section>';
  body+='<section class="br-sec"><h2>How Club works</h2><ol class="br-steps"><li><b>Receive an invitation.</b><br/>Club is invite-only. Team SRCHN reviews every request individually - an invitation is never guaranteed.</li><li><b>Sign in with your email.</b><br/>A one-time code, no password. Your first sign-in activates your membership.</li><li><b>Discover participating brands.</b><br/>Only brands approved for Club participation carry the SRCHN CLUB label.</li><li><b>Book a visit.</b><br/>Book at Club locations that have an active booking configuration. Every booking gets a unique booking ID.</li><li><b>Check in when you arrive.</b><br/>Check-in validates an eligible booking at that location.</li><li><b>Pay and earn eligible cashback.</b><br/>Payments through SRCHN PAY and eligible cashback follow the terms below.</li></ol></section>';
  body+='<section class="br-sec"><h2>Club cashback, explained properly</h2><p>Eligible members who pay through SRCHN PAY may receive cashback of up to 5% of the SRCHN success fee - calculated on SRCHN&#39;s fee, never on your total bill.</p><div class="cl-note"><b>Illustration only, not a guaranteed offer.</b><br/>Order Rs 1,000 &middot; agreed SRCHN success fee 20% = Rs 200 &middot; cashback 5% of the success fee = <b>Rs 10 to you</b>. The actual agreed rate and applicable terms apply to every transaction.</div><p>Cashback is capped at up to Rs 5,000 per 12-month membership period - not per transaction, not per calendar year. Cashback moves from pending to confirmed only after the underlying payment and commission eligibility are confirmed. Exclusions, caps, reversal rules and redemption conditions apply and are shown with your membership.</p></section>';
  body+='<section class="br-sec"><h2>Honest status of Club services</h2><div class="cl-note"><b>SRCHN PAY - configuration required, currently disabled.</b><br/>Payments are not yet enabled on SRCHN. No payment is taken today and no booking fee is charged. Booking and check-in work without payment until SRCHN PAY goes live.<br/><a href="/club/demo/#pay">See how SRCHN PAY will work - interface demo</a></div><div class="cl-note"><b>Identity verification - configuration required, currently disabled.</b><br/>Club membership and higher-risk transactions may include a clearly explained verification step when legally and commercially necessary. The DigiLocker integration is integration-ready, pending approval and credentials. SRCHN will never ask for your DigiLocker password or OTP and never imitates the DigiLocker interface.<br/><a href="/club/demo/#digilocker">See the DigiLocker verification demo</a> &middot; <a href="/club/demo/#face">See the face verification demo</a></div></section>';
  body+='<section class="br-sec"><h2>Participating brands</h2>'+(clubBrands.length?'<div class="br-grid">'+clubBrands.map(brCard).join('')+'</div>':'<p class="br-empty">Participating brands appear here once Team SRCHN approves them for Club.</p>')+'</section>';
  body+='<script src="/brands/club.js" defer></script>';
  return new Response(brChrome({title:'SRCHN CLUB — Invite-only membership, bookings and cashback | SRCHN',desc:'SRCHN CLUB is an invite-only access layer for participating brands, places, spaces and experiences. Members discover eligible brands, book visits, check in and earn eligible cashback.',canon:u.origin+'/club/',active:'Club',body}),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'public, max-age=120'}});
 }
 if(p==='/club/member/'||p==='/club/member'){
  const body='<section class="br-sec"><p class="br-eyebrow">SRCHN CLUB</p><h1>Your membership</h1><div id="clm"><p class="br-empty">Loading your membership...</p></div></section><script src="/brands/club.js" defer></script>';
  return new Response(brChrome({title:'Your SRCHN CLUB membership | SRCHN',desc:'Your SRCHN CLUB membership, bookings, payments and cashback.',canon:u.origin+'/club/member/',active:'Club',body}),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-cache'}});
 }
 return null;
}

export default{async fetch(request,env){
  const u=new URL(request.url);
  if(u.pathname==='/property/api/status'){return JSONR({ok:true,storage:!!env.DB,phase:1,market:'Bengaluru'})}
  if(u.pathname==='/property/api/requests'){try{return await propertyRequests(request,env)}catch{return JSONR({error:'Request storage unavailable.'},503)}}
  if(u.pathname==='/api/discovery-request'){try{return await discoveryRequest(request,env)}catch{return JSONR({error:'Request storage unavailable.'},503)}}
  if(u.pathname.startsWith('/discovery/api/pilot/')){try{return await pilotSaveRoute(request,env)}catch{return JSONR({error:'Saved places unavailable.'},503)}}
  if(u.pathname.startsWith('/review/api/')){try{return await reviewRoute(request,env)}catch(e){return JSONR({error:'Review unavailable.'},503)}}
  if(u.pathname==='/api/submit-place'){
    if(request.method!=='POST') return J({error:'Method not allowed.'},405);
    return submit(request,env);
  }
  if(u.pathname==='/api/delete-submission'){
    if(request.method!=='POST') return J({error:'Method not allowed.'},405);
    return del(request,env);
  }
  if(u.pathname.startsWith('/studio/api/')){try{return await studioRoute(request,env)}catch(e){return JSONR({error:'Studio unavailable.'},503)}}
  if(u.pathname==='/studio/brands/b/'||u.pathname==='/studio/brands/b'){
   try{
    const bid=(u.searchParams.get('id')||'').trim();
    if(/^[0-9a-f-]{36}$/.test(bid)&&env.DB){
     const pl=await env.DB.prepare('SELECT name,primary_cat,locality,city FROM stu_places WHERE id=?').bind(bid).first();
     if(pl){
      const asset=await env.ASSETS.fetch(request);
      if(asset.ok){
       let html=await asset.text();
       const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
       const t=esc(pl.name+' - SRCHN BRANDS');
       const d=esc([pl.primary_cat,pl.locality,pl.city].filter(Boolean).join(' · ')+' - original photos and videos, reviewed by Team SRCHN.');
       html=html.replace(/<title>[^<]*<\/title>/,'<title>'+t+'<\/title>');
       html=html.replace(/<meta content="[^"]*" name="description"\/>/,'<meta content="'+d+'" name="description"/>\n<meta content="'+t+'" property="og:title"/><meta content="'+d+'" property="og:description"/><meta content="website" property="og:type"/>');
       return new Response(html,{status:200,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache'}});
      }
     }
    }
   }catch{}
  }
  if((u.pathname==='/club'||u.pathname.startsWith('/club/'))&&!/\.(css|js|png|jpg|jpeg|svg|webp|ico|json|xml)$/.test(u.pathname)){try{const r=await clubRoute(request,env);if(r)return r}catch(e){return JSONR({error:'Club unavailable.'},503)}}
  if(u.pathname.startsWith('/brands/')&&!u.pathname.startsWith('/brands/demo/')&&(u.pathname==='/brands/sitemap.xml'||!/\.(css|js|png|jpg|jpeg|svg|webp|ico|json|xml)$/.test(u.pathname))){try{const r=await brandsRoute(request,env);if(r)return r}catch(e){return JSONR({error:'Brands unavailable.'},503)}}
  return env.ASSETS.fetch(request);
}};
