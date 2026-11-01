export const kinds=['category','subcategory','place','image','description','translation','audio','merge','source'];
const fields=['title','place_id','category_id','subcategory_id','description','original_language','language','text','translation_status','source_url','licence','attribution','licence_url','author','rights_evidence','photo_url','audio_url','voice','coordinate_source','lat','lon','address','neighbourhood','website','phone','opening_hours','amenities','event_start','event_end','merge_into','reason'];
const present=x=>typeof x==='string'&&x.trim().length>0;
const https=v=>{try{let u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password}catch{return false}};
export function validate(x){
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
export function preflight(rows){if(!Array.isArray(rows)||!rows.length||rows.length>100)throw Error('Use an array of 1 to 100 proposals.');let seen=new Set();return rows.map((x,i)=>{let errors=validate(x);if(seen.has(x?.id))errors.push('Duplicate UUID in this file.');seen.add(x?.id);return {row:i+1,proposal:x,errors}})}
