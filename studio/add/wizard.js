(function(){
'use strict';
const $=id=>document.getElementById(id);
const SUBCATS={
 tour:{main:['Interiors','Exteriors','Washrooms','Building View','Street View','Facade','Emergency Exits','Parking','Lifts','Cafeteria'],
       extra:['Reception','Entrance','Lobby','Waiting Area','Meeting Rooms','Conference Rooms','Workstations','Cabins','Amenities','Swimming Pool','Gym','Rooftop','Garden','Restaurant Area','Event Space','Accessibility Features','Other']},
 product:{main:['Categories','Menu','Facilities','Founders','Team','Departments','Town Halls','Hiring','Ambassadors','Influencers'],
       extra:['Products','Services','Signature Dishes','Bestsellers','New Arrivals','Product Demonstrations','Customer Experience','Technology','Manufacturing','Behind the Scenes','Team Culture','Leadership','Other']},
 marketing:{main:['Brand Origin Story','New Product Launches','Festival Offers','End-of-Season Sales','Customer Testimonials','CSR Activities','Weekly Promotions','Monthly Promotions','Meetups','Events'],
       extra:['Grand Opening','Reopening','Anniversary','Seasonal Campaigns','Special Offers','Limited Editions','Influencer Collaborations','Brand Partnerships','Community Activities','Public Relations','Founder Interviews','Customer Stories','Event Highlights','Other']}
};
const STEP_LABELS={1:'STEP 01 — WHAT ARE YOU ADDING?',2:'STEP 02 — FIND THE LOCATION',3:'STEP 03 — CHOOSE YOUR CONTENT TYPE',4:'STEP 04 — UPLOAD PHOTOS OR VIDEOS',5:'STEP 05 — ADD DETAILS AND CREDITS',6:'STEP 06 — REVIEW YOUR CONTRIBUTION',7:'STEP 07 — SUBMITTED'};

const W={step:1,kind:'',dupe_mode:'',place_id:'',place:null,pillar:'',subcats:new Set(),media:[],lat:null,lon:null,submitting:false};

/* ---------- auth gate ---------- */
stu.req('/me').then(r=>{if(r&&r.status===401)return; if(!r||r.status!==200){location.href='/studio/join/'}else{W.me=r.data.creator;loadDraft()}});

/* ---------- nav ---------- */
function showStep(n){
 W.step=n;
 document.querySelectorAll('.wiz-step').forEach(s=>s.hidden=+s.dataset.step!==n);
 const bar=$('wiz-progress');bar.innerHTML='';
 for(let i=1;i<=7;i++){const t=document.createElement('i');if(i<=n)t.className='on';bar.appendChild(t)}
 $('wiz-step-label').textContent=STEP_LABELS[n]||'';
 $('w-back').style.visibility=n===1||n===7?'hidden':'visible';
 $('w-next').textContent=n===6?'SUBMIT TO TEAM SRCHN':'Continue';
 $('wiz-nav').style.display=n===7?'none':'flex';
 $('wiz-err').style.display='none';
 if(n===2)initMap();
 if(n===6)renderReview();
 window.scrollTo({top:0,behavior:'smooth'});
 saveDraft();
}
$('w-back').addEventListener('click',()=>{if(W.step>1)showStep(W.step-1)});
$('w-next').addEventListener('click',async()=>{
 if(W.step===2&&!W.place_id){
  const ok=await ensurePlace();
  if(!ok)return;
 }
 const err=validateStep(W.step);
 if(err){stu.err($('wiz-err'),err);return}
 if(W.step===6){doSubmit();return}
 showStep(W.step+1);
});
function validateStep(n){
 if(n===1&&!W.kind)return 'Choose what you are adding: a place, a space or an experience.';
 if(n===2){
  if(!$('w-name').value.trim())return 'The place needs a name.';
  if(!$('w-pcat').value.trim())return 'Add a primary category.';
  if(!$('w-addr').value.trim())return 'Add the address.';
  if(!$('w-loc').value.trim())return 'Add the locality.';
  if(!$('w-city').value.trim())return 'Add the city.';
  if(!/^\d{6}$/.test($('w-pin').value.trim()))return 'Add a valid 6-digit PIN code.';
  if(!$('w-state').value.trim())return 'Add the state.';
 }
 if(n===3){
  if(!W.pillar)return 'Choose a content type: virtual tour, product or marketing.';
  if(!W.subcats.size)return 'Pick at least one subcategory.';
 }
 if(n===4){
  if(!W.media.length)return 'Add at least one photo or video.';
  if(W.media.some(m=>m.working))return 'Please wait until all files finish preparing.';
  if(W.media.some(m=>m.error||!m.blob))return 'One of your files could not be used - remove it or replace it.';
  if(W.media.length>8)return 'A submission can carry up to 8 media items. Remove a few.';
 }
 if(n===5){
  if(W.media.some(m=>!m.caption.trim()))return 'Every photo and video needs a caption.';
  if(W.media.some(m=>!m.credit.trim()))return 'Every photo and video needs a credit.';
  const tp=$('w-creator-type').value;
  if(/Another creator|business supplied|Other authorised/.test(tp)){
   if(!$('w-tp-name').value.trim()||!$('w-tp-source').value.trim()||!$('w-tp-licence').value.trim())
    return 'For third-party content, add the creator name, source and permission details.';
  }
 }
 if(n===6&&!$('w-confirm').checked)return 'Please confirm the rights declaration to submit.';
 return null;
}

/* ---------- step 1: kind ---------- */
document.querySelectorAll('#kind-cards .wiz-card').forEach(c=>c.addEventListener('click',()=>{
 document.querySelectorAll('#kind-cards .wiz-card').forEach(x=>x.classList.remove('sel'));
 c.classList.add('sel');W.kind=c.dataset.kind;
 $('w-dates-wrap').hidden=W.kind!=='experiences';
}));

/* ---------- step 2: place search + dupe ---------- */
let suggestTimer=null;
$('w-name').addEventListener('input',()=>{
 clearTimeout(suggestTimer);W.place_id='';$('w-dupe').hidden=true;
 const q=$('w-name').value.trim();
 if(q.length<2){$('w-suggest').hidden=true;return}
 suggestTimer=setTimeout(async()=>{
  const r=await stu.req('/places?q='+encodeURIComponent(q));
  const box=$('w-suggest');box.innerHTML='';
  if(r&&r.status===200&&r.data.places.length){
   r.data.places.forEach(pl=>{
    const b=document.createElement('button');
    b.type='button';
    b.innerHTML=stu.esc(pl.name)+'<small>'+stu.esc([pl.kind,pl.locality,pl.city,pl.pincode].filter(Boolean).join(' · '))+'</small>';
    b.addEventListener('click',()=>{selectDupe(pl)});
    box.appendChild(b);
   });
   box.hidden=false;
  }else box.hidden=true;
 },300);
});
async function ensurePlace(){
 const name=$('w-name').value.trim();if(!name)return true;
 const r=await stu.req('/places',{method:'POST',json:{name,pincode:$('w-pin').value.trim(),kind:W.kind,primary_cat:$('w-pcat').value.trim(),secondary_cat:$('w-scat')?$('w-scat').value.trim():'',address:$('w-addr').value.trim(),locality:$('w-loc').value.trim(),city:$('w-city').value.trim(),state:$('w-state').value.trim(),website:$('w-website')?$('w-website').value.trim():'',hours:$('w-hours')?$('w-hours').value.trim():''}});
 if(r&&(r.status===201||r.status===200)&&r.data&&(r.data.place&&r.data.place.id)){W.place_id=r.data.place.id;return true}
 if(r&&r.data&&r.data.error){const e=$('w-err');if(e){e.textContent=r.data.error;e.hidden=false}}
 return false;
}
function selectDupe(pl){
 $('w-suggest').hidden=true;
 W.place_id=pl.id;
 $('w-name').value=pl.name;
 if(pl.locality)$('w-loc').value=pl.locality;
 if(pl.city)$('w-city').value=pl.city;
 if(pl.pincode)$('w-pin').value=pl.pincode;
 $('w-dupe-detail').textContent=' '+(pl.name)+(pl.locality?', '+pl.locality:'')+(pl.city?', '+pl.city:'');
 $('w-dupe').hidden=false;
}
document.querySelectorAll('[data-dupe]').forEach(b=>b.addEventListener('click',async()=>{
 W.dupe_mode=b.dataset.dupe;
 const name=$('w-name').value.trim(),pin=$('w-pin').value.trim();
 const r=await stu.req('/places',{method:'POST',json:{name,pincode:pin,kind:W.kind,primary_cat:$('w-pcat').value.trim()}});
 if(r&&r.data&&r.data.place&&r.data.place.id){W.place_id=r.data.place.id}
 document.querySelectorAll('[data-dupe]').forEach(x=>x.classList.remove('stu-btn-primary'));
 b.classList.add('stu-btn-primary');
}));
/* map */
let map=null,marker=null;
function initMap(){}
function setPin(lat,lon){
 W.lat=lat;W.lon=lon;
 const link='https://www.google.com/maps?q='+lat.toFixed(6)+','+lon.toFixed(6);
 $('w-maps').value=link;
 $('w-map-hint').textContent='Current coordinates saved as a directions link. Check the venue address before submitting.';
}
function bindGeo(){const g=$('w-geoloc');if(g)g.addEventListener('click',e=>{e.preventDefault();
 if(!navigator.geolocation){$('w-map-hint').textContent='This browser has no location access - enter the venue address or a directions link instead.';return}
 navigator.geolocation.getCurrentPosition(pos=>{setPin(pos.coords.latitude,pos.coords.longitude);if(map)map.setView([pos.coords.latitude,pos.coords.longitude],16)},()=>{$('w-map-hint').textContent='Location permission was not granted - enter the venue address or a directions link instead.'},{timeout:10000});
})}
bindGeo();

/* ---------- step 3: pillar + subcats ---------- */
document.querySelectorAll('#pillar-cards .wiz-card').forEach(c=>c.addEventListener('click',()=>{
 document.querySelectorAll('#pillar-cards .wiz-card').forEach(x=>x.classList.remove('sel'));
 c.classList.add('sel');W.pillar=c.dataset.pillar;W.subcats.clear();renderSubcats();
}));
function renderSubcats(){
 $('subcats-wrap').hidden=false;
 const mk=(list,box)=>{box.innerHTML='';list.forEach(s=>{
  const l=document.createElement('label');const cb=document.createElement('input');
  cb.type='checkbox';cb.value=s;
  cb.addEventListener('change',()=>{cb.checked?W.subcats.add(s):W.subcats.delete(s)});
  l.appendChild(cb);l.appendChild(document.createTextNode(s));box.appendChild(l);
 })};
 mk(SUBCATS[W.pillar].main,$('subcats-main'));
 mk(SUBCATS[W.pillar].extra,$('subcats-extra'));
}

/* ---------- step 4: media ---------- */
const drop=$('w-drop');
['dragover','dragenter'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('over')}));
['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('over')}));
drop.addEventListener('drop',e=>{[...e.dataTransfer.files].forEach(f=>addFile(f))});
$('w-pick-photo').addEventListener('click',()=>$('w-file-photo').click());
$('w-pick-video').addEventListener('click',()=>$('w-file-video').click());
$('w-pick-cam').addEventListener('click',()=>$('w-file-cam').click());
$('w-file-photo').addEventListener('change',e=>{[...e.target.files].forEach(f=>addFile(f));e.target.value=''});
$('w-file-video').addEventListener('change',e=>{[...e.target.files].forEach(f=>addFile(f));e.target.value=''});
$('w-file-cam').addEventListener('change',e=>{[...e.target.files].forEach(f=>addFile(f));e.target.value=''});

function addFile(f){
 if(W.media.length>=8){stu.err($('wiz-err'),'A submission can carry up to 8 media items.');window.scrollTo(0,0);return}
 if(/^image\//.test(f.type))return addPhoto(f);
 if(/^video\//.test(f.type))return addVideo(f);
 stu.err($('wiz-err'),'"'+f.name+'" is not a supported photo or video format.');
}

/* photos: normalise to exact 1080p (short side = 1080), JPEG, no crop, no stretch */
function addPhoto(f){
 if(!['image/jpeg','image/png','image/webp'].includes(f.type)){
  stu.err($('wiz-err'),'"'+f.name+'": this format is not supported by the upload pipeline - convert it to JPG and try again.');return;
 }
 const m={kind:'photo',name:f.name,working:true,caption:'',credit:'',captured_at:'',source:'',motion_from_photo:false};
 W.media.push(m);renderMedia();
 const img=new Image();
 img.onload=()=>{
  URL.revokeObjectURL(img.src);
  const w=img.naturalWidth,h=img.naturalHeight;
  if(Math.min(w,h)<1080){m.working=false;m.error='Below 1080p HD - SRCHN requires exactly 1080p, so this photo cannot be used.';renderMedia();return}
  const sc=1080/Math.min(w,h),tw=Math.round(w*sc),th=Math.round(h*sc);
  const cv=document.createElement('canvas');cv.width=tw;cv.height=th;
  cv.getContext('2d').drawImage(img,0,0,tw,th);
  const toJpeg=q=>new Promise(res=>cv.toBlob(res,'image/jpeg',q));
  (async()=>{
   let blob=await toJpeg(0.85);
   if(blob.size>1150000)blob=await toJpeg(0.72);
   if(blob.size>1200000){m.working=false;m.error='Could not get this photo under the size limit at 1080p - try a simpler crop.';renderMedia();return}
   m.blob=blob;m.mime='image/jpeg';m.w=tw;m.h=th;
   m.aspect=tw>=th?'16:9':'9:16';
   m.preview=cv.toDataURL('image/jpeg',0.6);
   m.working=false;renderMedia();
  })();
 };
 img.onerror=()=>{m.working=false;m.error='Could not read this image file.';renderMedia()};
 img.src=URL.createObjectURL(f);
}

/* videos: exact 1080p, <=30s, re-encode on device when needed */
function addVideo(f){
 if(!['video/mp4','video/webm','video/quicktime'].includes(f.type)){
  stu.err($('wiz-err'),'"'+f.name+'": videos must be MP4, MOV or WEBM.');return;
 }
 const v=document.createElement('video');
 v.preload='metadata';v.muted=true;v.playsInline=true;
 const url=URL.createObjectURL(f);
 const metaTimeout=setTimeout(()=>{URL.revokeObjectURL(url);stu.err($('wiz-err'),'"'+f.name+'": this browser could not read the video - try exporting it as MP4 (H.264) or WEBM.')},15000);
 v.onloadedmetadata=()=>{
  clearTimeout(metaTimeout);
  const dur=v.duration,vw=v.videoWidth,vh=v.videoHeight;
  if(!vw||!vh||!isFinite(dur)){URL.revokeObjectURL(url);stu.err($('wiz-err'),'"'+f.name+'": could not read this video.');return}
  if(Math.min(vw,vh)<1080){URL.revokeObjectURL(url);stu.err($('wiz-err'),'"'+f.name+'" is below 1080p HD - SRCHN requires exactly 1080p, so this video cannot be used.');return}
  const exact=(vw===1920&&vh===1080)||(vw===1080&&vh===1920);
  if(dur<=30&&exact&&(f.type==='video/mp4'||f.type==='video/webm')&&f.size<=26000000){
   const m={kind:'video',name:f.name,working:false,blob:f,mime:f.type,w:vw,h:vh,duration:dur,aspect:vw>=vh?'16:9':'9:16',caption:'',credit:'',captured_at:'',source:'',motion_from_photo:false};
   const th=document.createElement('video');th.src=url;th.muted=true;th.playsInline=true;th.controls=true;th.preload='metadata';
   m.previewEl=th;W.media.push(m);renderMedia();return;
  }
  openTrim(f,v,url,dur,vw,vh);
 };
 v.onerror=()=>{clearTimeout(metaTimeout);URL.revokeObjectURL(url);stu.err($('wiz-err'),'"'+f.name+'": this browser could not read the video. Try MP4 (H.264) or WEBM.')};
 v.src=url;
}

let trimCtx=null;
function openTrim(f,v,url,dur,vw,vh){
 if(typeof MediaRecorder==='undefined'||!v.captureStream&&!v.mozCaptureStream){
  stu.err($('wiz-err'),'This browser cannot prepare 1080p clips on-device. Try current Chrome, Edge or Safari.');URL.revokeObjectURL(url);return;
 }
 $('w-trim').hidden=false;$('w-encode').hidden=true;
 const maxStart=Math.max(0,dur-30);
 const slider=$('w-trim-start');slider.max=maxStart;slider.value=0;
 $('w-trim-info').textContent='"'+f.name+'" is '+Math.round(dur)+'s. Pick where your 30-second clip starts.';
 const tv=$('w-trim-video');tv.src=url;tv.currentTime=0;
 slider.oninput=()=>{tv.currentTime=+slider.value};
 trimCtx={f,v:url?tv:null,url,dur,vw,vh,slider};
}
$('w-trim-cancel').addEventListener('click',()=>{if(trimCtx)URL.revokeObjectURL(trimCtx.url);trimCtx=null;$('w-trim').hidden=true});
$('w-trim-go').addEventListener('click',async()=>{
 if(!trimCtx)return;
 const{f,url,vw,vh,slider}=trimCtx;
 $('w-encode').hidden=false;$('w-trim-go').disabled=true;
 try{
  const out=await encodeVideo(url,vw,vh,+slider.value,Math.min(30,trimCtx.dur-+slider.value),(frac,label)=>{
   $('w-encode-fill').style.width=Math.round(frac*100)+'%';
   $('w-encode-label').textContent=label;
  });
  const m={kind:'video',name:f.name,working:false,blob:out.blob,mime:out.mime,w:out.w,h:out.h,duration:out.duration,aspect:out.w>=out.h?'16:9':'9:16',caption:'',credit:'',captured_at:'',source:'',motion_from_photo:false};
  const th=document.createElement('video');th.src=URL.createObjectURL(out.blob);th.muted=true;th.playsInline=true;th.controls=true;th.preload='metadata';
  m.previewEl=th;W.media.push(m);renderMedia();
  URL.revokeObjectURL(url);trimCtx=null;$('w-trim').hidden=true;
 }catch(err){
  $('w-encode-label').textContent='Could not prepare this clip on your device. Try a shorter or simpler video.';
 }finally{$('w-trim-go').disabled=false}
});

/* canvas re-encode to exact 1080p, preserving aspect (no stretch, no crop) */
function encodeVideo(url,vw,vh,start,dur,progress){
 return new Promise((resolve,reject)=>{
  const sc=1080/Math.min(vw,vh),tw=Math.round(vw*sc),th=Math.round(vh*sc);
  const v=document.createElement('video');
  v.src=url;v.muted=false;v.playsInline=true;v.preload='auto';
  const cv=document.createElement('canvas');cv.width=tw;cv.height=th;
  const cx=cv.getContext('2d');
  const srcStream=(v.captureStream||v.mozCaptureStream).call(v);
  const outStream=new MediaStream([...cv.captureStream(30).getVideoTracks(),...srcStream.getAudioTracks()]);
  const mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/mp4'].find(t=>MediaRecorder.isTypeSupported(t))||'video/webm';
  const rec=new MediaRecorder(outStream,{mimeType:mime,videoBitsPerSecond:4000000,audioBitsPerSecond:128000});
  const chunks=[];rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
  rec.onstop=()=>{
   const blob=new Blob(chunks,{type:mime.split(';')[0]});
   if(blob.size>26000000)return reject(new Error('too big'));
   resolve({blob,mime:blob.type,w:tw,h:th,duration:dur});
  };
  rec.onerror=reject;
  const t0=performance.now();
  v.onseeked=()=>{
   const draw=()=>{
    if(v.currentTime>=start+dur||v.ended){rec.stop();v.pause();return}
    cx.drawImage(v,0,0,tw,th);
    progress(Math.min(1,(v.currentTime-start)/dur),'Preparing 1080p clip on your device… '+Math.round((v.currentTime-start))+'s / '+Math.round(dur)+'s');
    requestAnimationFrame(draw);
   };
   rec.start(250);v.play().then(()=>draw()).catch(reject);
  };
  v.onloadedmetadata=()=>{v.currentTime=start};
  v.onerror=reject;
 });
}

/* photo -> 30s labelled motion video (Ken Burns), clearly identified as generated */
async function makeMotion(m){
 if(m.kind!=='photo'||m.working)return;
 m.working=true;renderMedia();
 try{
  const img=new Image();
  await new Promise((res,rej)=>{img.onload=res;img.onerror=rej;img.src=m.preview});
  const portrait=m.h>m.w,tw=portrait?1080:1920,th=portrait?1920:1080;
  const cv=document.createElement('canvas');cv.width=tw;cv.height=th;
  const cx=cv.getContext('2d');
  const stream=cv.captureStream(30);
  const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/mp4'].find(t=>MediaRecorder.isTypeSupported(t))||'video/webm';
  const rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:4000000});
  const chunks=[];rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
  const dur=10; // photo motion default 10s (within the 30s cap)
  const done=new Promise(res=>{rec.onstop=res});
  rec.start(250);
  const cover=Math.max(tw/m.w,th/m.h);
  const t0=performance.now();
  await new Promise(res=>{
   const frame=()=>{
    const t=(performance.now()-t0)/1000;
    if(t>=dur){res();return}
    const k=1+0.12*(t/dur); // gentle zoom
    const dw=m.w*cover*k,dh=m.h*cover*k;
    const dx=(tw-dw)/2+Math.sin(t/dur*Math.PI)*tw*0.02; // subtle pan
    cx.fillStyle='#000';cx.fillRect(0,0,tw,th);
    cx.drawImage(img,dx,(th-dh)/2,dw,dh);
    requestAnimationFrame(frame);
   };
   frame();
  });
  rec.stop();await done;
  const blob=new Blob(chunks,{type:mime.split(';')[0]});
  if(blob.size>26000000)throw new Error('too big');
  const mv={kind:'video',name:m.name.replace(/\.\w+$/,'')+' (photo motion)',working:false,blob,mime:blob.type,w:tw,h:th,duration:dur,aspect:tw>=th?'16:9':'9:16',caption:'',credit:'',captured_at:'',source:'',motion_from_photo:true};
  const tv=document.createElement('video');tv.src=URL.createObjectURL(blob);tv.muted=true;tv.playsInline=true;tv.controls=true;tv.preload='metadata';
  mv.previewEl=tv;
  const idx=W.media.indexOf(m);W.media.splice(idx+1,0,mv);
 }catch(e){/* leave photo as-is */}
 m.working=false;renderMedia();
}

function renderMedia(){
 const list=$('w-media-list');list.innerHTML='';
 W.media.forEach((m,i)=>{
  const node=$('w-media-tpl').content.firstElementChild.cloneNode(true);
  const thumb=node.querySelector('.wiz-media-thumb');
  if(m.kind==='photo'){thumb.style.backgroundImage='url('+(m.preview||'')+')'}
  else if(m.previewEl){thumb.appendChild(m.previewEl)}
  node.querySelector('.wiz-media-name').textContent=m.name;
  const bits=[];
  if(m.w)bits.push(m.w+'×'+m.h+' ('+m.aspect+')');
  if(m.duration)bits.push(Math.round(m.duration)+'s');
  if(m.blob)bits.push((m.blob.size/1048576).toFixed(1)+' MB');
  if(m.motion_from_photo)bits.push('photo motion (generated)');
  node.querySelector('.wiz-media-meta').textContent=bits.join(' · ');
  const st=node.querySelector('.wiz-media-status');
  if(m.error){st.textContent=m.error;st.className='wiz-media-status warn'}
  else if(m.working){st.textContent='Preparing…';st.className='wiz-media-status warn'}
  else st.textContent='Ready';
  node.querySelector('[data-act="left"]').disabled=i===0;
  node.querySelector('[data-act="right"]').disabled=i===W.media.length-1;
  node.querySelector('[data-act="motion"]').style.display=m.kind==='photo'?'':'none';
  node.addEventListener('click',e=>{
   const act=e.target.dataset&&e.target.dataset.act;if(!act)return;
   if(act==='remove')W.media.splice(i,1);
   if(act==='left'&&i>0){const t=W.media[i-1];W.media[i-1]=W.media[i];W.media[i]=t}
   if(act==='right'&&i<W.media.length-1){const t=W.media[i+1];W.media[i+1]=W.media[i];W.media[i]=t}
   if(act==='motion')makeMotion(m);
   renderMedia();
  });
  list.appendChild(node);
 });
}

/* ---------- step 5: per-item details ---------- */
$('w-creator-type').addEventListener('change',()=>{
 $('w-third-party').hidden=!/Another creator|business supplied|Other authorised/.test($('w-creator-type').value);
});
function renderItems(){
 const box=$('w-items');box.innerHTML='';
 W.media.forEach((m,i)=>{
  const d=document.createElement('div');d.className='wiz-item';
  const th=document.createElement('div');th.className='wiz-item-thumb';
  if(m.kind==='photo')th.style.backgroundImage='url('+(m.preview||'')+')';
  d.appendChild(th);
  const f=document.createElement('div');f.className='wiz-item-fields';
  f.innerHTML='<div class="stu-field"><label>Caption '+(i+1)+' of '+W.media.length+(m.motion_from_photo?' — photo motion (generated from a photograph)':'')+'</label><input data-k="caption" maxlength="240" placeholder="What does this show?"/></div>'
   +'<div class="stu-field"><label>Photographer / videographer credit</label><input data-k="credit" maxlength="120" placeholder="Name to show with the credit"/></div>'
   +'<div class="stu-field"><label>Date captured (optional)</label><input data-k="captured_at" type="date"/></div>';
  d.appendChild(f);
  f.querySelectorAll('input').forEach(inp=>{
   inp.value=m[inp.dataset.k]||'';
   inp.addEventListener('input',()=>{m[inp.dataset.k]=inp.value});
  });
  box.appendChild(d);
 });
}

/* ---------- step 6: review ---------- */
function renderReview(){
 const r=$('w-review');
 const photos=W.media.filter(m=>m.kind==='photo'),videos=W.media.filter(m=>m.kind==='video');
 const kinds={places:'Place',spaces:'Space',experiences:'Experience'};
 const pillars={tour:'Virtual tour content',product:'Product content',marketing:'Marketing content'};
 let h='';
 h+='<section><h3>Creator</h3><dl><dt>Name</dt><dd>'+stu.esc(W.me?W.me.display_name:'')+'</dd><dt>Creator ID</dt><dd>'+stu.esc(W.me?W.me.creator_no:'')+'</dd></dl></section>';
 h+='<section><h3>'+(kinds[W.kind]||'')+'</h3><dl><dt>Name</dt><dd>'+stu.esc($('w-name').value.trim())+'</dd><dt>Category</dt><dd>'+stu.esc($('w-pcat').value.trim())+($('w-scat').value.trim()?' · '+stu.esc($('w-scat').value.trim()):'')+'</dd><dt>Location</dt><dd>'+stu.esc([$('w-addr').value.trim(),$('w-loc').value.trim(),$('w-city').value.trim(),$('w-pin').value.trim(),$('w-state').value.trim(),$('w-country').value.trim()].filter(Boolean).join(', '))+'</dd>'+(W.kind==='experiences'&&$('w-dates').value.trim()?'<dt>Dates</dt><dd>'+stu.esc($('w-dates').value.trim())+'</dd>':'')+'</dl></section>';
 h+='<section><h3>Content</h3><dl><dt>Type</dt><dd>'+(pillars[W.pillar]||'')+'</dd><dt>Subcategories</dt><dd>'+stu.esc([...W.subcats].join(', '))+'</dd><dt>Photos</dt><dd>'+photos.length+'</dd><dt>Videos</dt><dd>'+videos.length+'</dd><dt>Aspect ratios</dt><dd>'+stu.esc([...new Set(W.media.map(m=>m.aspect))].join(', '))+'</dd></dl>';
 h+='<div class="wiz-review-thumbs">'+W.media.map(m=>'<div title="'+stu.esc(m.name)+'" style="'+(m.kind==='photo'?'background-image:url('+m.preview+')':'')+'"></div>').join('')+'</div></section>';
 h+='<section><h3>Credits</h3><dl>'+W.media.map(m=>'<dt>'+stu.esc(m.name)+'</dt><dd>'+stu.esc(m.caption)+' — '+(m.credit?stu.esc(m.credit):'<em>credit missing</em>')+(m.motion_from_photo?' (photo motion, generated)':'')+'</dd>').join('')+'</dl></section>';
 h+='<section><h3>Rights</h3><dl><dt>Created by</dt><dd>'+stu.esc($('w-creator-type').value)+'</dd>'+($('w-third-party').hidden?'':'<dt>Original creator</dt><dd>'+stu.esc($('w-tp-name').value.trim())+'</dd><dt>Source</dt><dd>'+stu.esc($('w-tp-source').value.trim())+'</dd><dt>Permission</dt><dd>'+stu.esc($('w-tp-licence').value.trim())+'</dd>')+'</dl></section>';
 r.innerHTML=h;
}

/* ---------- upload + submit ---------- */
async function uploadOne(m,onStep){
 const r1=await stu.req('/media/start',{method:'POST',json:{kind:m.kind,mime:m.mime,bytes:m.blob.size}});
 if(!r1||r1.status!==201)throw new Error((r1&&r1.data&&r1.data.error)||'Could not start upload.');
 const id=r1.data.media_id,cs=r1.data.chunk_size,n=r1.data.chunk_count;
 for(let s=0;s<n;s++){
  const part=m.blob.slice(s*cs,(s+1)*cs);
  const rc=await stu.req('/media/chunk?id='+id+'&seq='+s,{method:'POST',body:part,headers:{'Content-Type':'application/octet-stream'}});
  if(!rc||rc.status!==201)throw new Error('A chunk failed to upload - check your connection and retry.');
  onStep((s+1)/n);
 }
 const rf=await stu.req('/media/finish',{method:'POST',json:{media_id:id,caption:m.caption,credit:m.credit,aspect:m.aspect,captured_at:m.captured_at,duration_sec:m.duration,width:m.w,height:m.h,source:m.source,motion_from_photo:m.motion_from_photo}});
 if(!rf||rf.status!==201)throw new Error((rf&&rf.data&&rf.data.error)||'Could not finish upload.');
 return id;
}
async function doSubmit(){
 if(W.submitting)return;W.submitting=true;
 const btn=$('w-next');btn.disabled=true;btn.textContent='Uploading…';
 try{
  for(let i=0;i<W.media.length;i++){
   const m=W.media[i];
   btn.textContent='Uploading '+(i+1)+' of '+W.media.length+'…';
   m.media_id=await uploadOne(m,()=>{});
  }
  btn.textContent='Submitting…';
  const payload={
   kind:W.kind,cats:[W.kind],
   place_id:W.place_id||undefined,
   place_name:$('w-name').value.trim(),
   content_pillar:W.pillar,
   subcats:[...W.subcats],
   items:W.media.map(m=>({type:m.kind,caption:m.caption,credit:m.credit,aspect:m.aspect,media_id:m.media_id})),
   address:$('w-addr').value.trim(),locality:$('w-loc').value.trim(),city:$('w-city').value.trim(),
   pincode:$('w-pin').value.trim(),state:$('w-state').value.trim(),country:$('w-country').value.trim(),
   dates:$('w-dates').value.trim(),description:$('w-desc').value.trim(),
   rights:{confirm:true,creator_type:$('w-creator-type').value,
    third_party:$('w-third-party').hidden?null:{name:$('w-tp-name').value.trim(),source:$('w-tp-source').value.trim(),licence:$('w-tp-licence').value.trim()}},
   place_extra:{primary_cat:$('w-pcat').value.trim(),secondary_cat:$('w-scat').value.trim(),website:$('w-web').value.trim(),instagram:$('w-insta').value.trim(),contact:$('w-contact').value.trim(),booking_url:$('w-book').value.trim(),maps_link:$('w-maps').value.trim(),hours:$('w-hours').value.trim()}
  };
  const r=await stu.req('/submissions',{method:'POST',json:payload});
  if(!r)return;
  if(r.status===201){
   await stu.req('/drafts',{method:'DELETE'});
   renderDone(r.data);showStep(7);
  }else stu.err($('wiz-err'),(r.data&&r.data.error)||'Submission failed - please try again.');
 }catch(err){
  stu.err($('wiz-err'),err.message||'Upload failed - check your connection and try again.');
 }finally{
  W.submitting=false;btn.disabled=false;btn.textContent='SUBMIT TO TEAM SRCHN';
 }
}
function renderDone(d){
 const emailLine=d.email==='sent'
  ?'A notification email has been sent to Team SRCHN.'
  :'The notification email to Team SRCHN could not be sent - your submission is safely recorded and visible in the review queue.';
 $('w-done').innerHTML=
  '<p>Your submission has been received. Our editorial team will review the location, information and media before publication. Your content will not be publicly visible until it is approved by Team SRCHN.</p>'
  +'<p class="wiz-subid">'+stu.esc(d.submission_id)+'</p>'
  +'<dl><dt>Date submitted</dt><dd>'+new Date().toLocaleString('en-IN',{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'})+'</dd>'
  +'<dt>Creator</dt><dd>'+stu.esc(W.me?W.me.display_name:'')+' ('+stu.esc(W.me?W.me.creator_no:'')+')</dd>'
  +'<dt>Submitted place</dt><dd>'+stu.esc($('w-name').value.trim())+'</dd>'
  +'<dt>Current status</dt><dd>SUBMITTED</dd>'
  +'<dt>Notification</dt><dd>'+emailLine+'</dd></dl>';
}

/* ---------- drafts ---------- */
let draftTimer=null;
function saveDraft(){
 if(W.step>=7)return;
 clearTimeout(draftTimer);
 draftTimer=setTimeout(()=>{
  const d={step:W.step,kind:W.kind,place_id:W.place_id,pillar:W.pillar,subcats:[...W.subcats],lat:W.lat,lon:W.lon,
   fields:{name:$('w-name').value,pcat:$('w-pcat').value,scat:$('w-scat').value,addr:$('w-addr').value,loc:$('w-loc').value,city:$('w-city').value,pin:$('w-pin').value,state:$('w-state').value,country:$('w-country').value,dates:$('w-dates').value,web:$('w-web').value,insta:$('w-insta').value,contact:$('w-contact').value,book:$('w-book').value,maps:$('w-maps').value,hours:$('w-hours').value,desc:$('w-desc').value,creator_type:$('w-creator-type').value,tpn:$('w-tp-name').value,tps:$('w-tp-source').value,tpl:$('w-tp-licence').value},
   mediaMeta:W.media.map(m=>({kind:m.kind,name:m.name,caption:m.caption,credit:m.credit,captured_at:m.captured_at}))};
  stu.req('/drafts',{method:'PUT',body:JSON.stringify(d),headers:{'Content-Type':'application/json'}}).then(r=>{
   $('w-draft-state').textContent=(r&&r.status===200)?'Draft saved '+new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}):'';
  });
 },800);
}
async function loadDraft(){
 const r=await stu.req('/drafts');
 if(r&&r.status===200&&r.data.draft){
  const d=r.data.draft;
  Object.entries(d.fields||{}).forEach(([k,v])=>{const el=$('w-'+({tpn:'tp-name',tps:'tp-source',tpl:'tp-licence'}[k]||k));if(el)el.value=v});
  if(d.kind){W.kind=d.kind;const c=document.querySelector('#kind-cards [data-kind="'+d.kind+'"]');if(c)c.classList.add('sel');$('w-dates-wrap').hidden=W.kind!=='experiences'}
  if(d.pillar){W.pillar=d.pillar;const c=document.querySelector('#pillar-cards [data-pillar="'+d.pillar+'"]');if(c)c.classList.add('sel');renderSubcats();
   (d.subcats||[]).forEach(s=>{W.subcats.add(s);const cb=document.querySelector('#subcats-wrap input[value="'+CSS.escape(s)+'"]');if(cb)cb.checked=true});
  }
  W.place_id=d.place_id||'';
  if(d.lat&&d.lon){W.lat=d.lat;W.lon=d.lon}
  $('w-third-party').hidden=!/Another creator|business supplied|Other authorised/.test($('w-creator-type').value);
  if((d.mediaMeta||[]).length)$('w-draft-state').textContent='Draft restored - please re-add your '+(d.mediaMeta.length)+' media file(s) (files cannot be stored in a draft).';
 }
 showStep(1);
}
['w-name','w-pcat','w-scat','w-addr','w-loc','w-city','w-pin','w-state','w-country','w-dates','w-web','w-insta','w-contact','w-book','w-maps','w-hours','w-desc','w-tp-name','w-tp-source','w-tp-licence'].forEach(id=>$(id).addEventListener('input',saveDraft));

/* step 5 renders when entering */
const origShow=showStep;
showStep=function(n){if(n===5)renderItems();origShow(n)};
})();
