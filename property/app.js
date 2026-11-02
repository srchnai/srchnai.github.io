/* SRCHN.PROPERTY Phase 1 preview - client logic. No third-party trackers. */
(function(){
'use strict';
var D=window.SRCHN_PROPERTY||{categories:[],services:[],authorities:[],counts:{}};
var PHONE='+917710052202',PHONE_H='+91 77100 52202';
function $(s,r){return (r||document).querySelector(s)}
function $all(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function waLink(svc){var m='Hello SRCHN PROPERTY, I need assistance with '+(svc||'a property service')+'. Please help me understand the process, required documents and service charges.';return 'https://wa.me/917710052202?text='+encodeURIComponent(m)}
function store(k,v){try{if(v===undefined)return JSON.parse(localStorage.getItem(k)||'null');localStorage.setItem(k,JSON.stringify(v))}catch(e){return null}}

/* privacy-conscious click analytics: local counts only */
document.addEventListener('click',function(e){
 var t=e.target.closest('[data-track]');if(!t)return;
 var a=store('srchnp_analytics')||{};var k=t.getAttribute('data-track');
 a[k]=(a[k]||0)+1;a._total=(a._total||0)+1;store('srchnp_analytics',a);
});

/* mobile menu */
var menuBtn=$('#sh-menu'),mmenu=$('#mmenu');
if(menuBtn&&mmenu){menuBtn.addEventListener('click',function(){var open=mmenu.classList.toggle('open');menuBtn.setAttribute('aria-expanded',open?'true':'false');document.body.style.overflow=open?'hidden':''})}

/* mobile sticky bar: reveal only after scrolling past the hero CTAs */
var mbar=$('.mbar');
if(mbar){var mbarTick=function(){if(window.scrollY>420)mbar.classList.add('show');else mbar.classList.remove('show')};window.addEventListener('scroll',mbarTick,{passive:true});mbarTick()}

/* nav more panels: close on outside click */
document.addEventListener('click',function(e){$all('details.nav-more[open]').forEach(function(d){if(!d.contains(e.target))d.removeAttribute('open')})});

/* counts */
$all('[data-count]').forEach(function(el){var k=el.getAttribute('data-count');if(D.counts&&D.counts[k]!=null)el.textContent=D.counts[k]});

/* search */
function searchIndex(){
 var idx=[];
 D.categories.forEach(function(c){idx.push({type:'Category',name:c.name,text:(c.name+' '+c.desc).toLowerCase(),href:'/property/category/'+c.slug+'/'});
  (c.subcategories||[]).forEach(function(s){idx.push({type:'Subcategory',name:s,text:(s+' '+c.name).toLowerCase(),href:'/property/search/?q='+encodeURIComponent(s),cat:c.name})})});
 D.services.forEach(function(s){idx.push({type:'Service',name:s.name,text:(s.name+' '+(s.short||'')+' '+(s.subcategory||'')+' '+(s.authority||'')).toLowerCase(),href:'/property/service/'+s.id+'/',cat:s.category_name})});
 D.authorities.forEach(function(a){idx.push({type:'Authority',name:a.name,text:(a.name+' '+a.services+' '+a.group).toLowerCase(),href:'/property/authorities/#'+a.id})});
 return idx;
}
var IDX=null;
function runSearch(q,filter){
 if(!IDX)IDX=searchIndex();
 var words=q.toLowerCase().split(/\s+/).filter(Boolean);
 var res=!words.length?[]:IDX.filter(function(it){return words.every(function(w){return it.text.indexOf(w)>-1})});
 if(filter)res=res.filter(function(r){return r.type===filter});
 return res.slice(0,40);
}
function renderResults(el,res,q){
 if(!q){el.innerHTML='';return}
 if(!res.length){el.innerHTML='<div class="result-item"><h3>No matches for &ldquo;'+esc(q)+'&rdquo;</h3><p class="muted small">The Phase 1 catalogue is being verified and expanded. Call <a href="tel:'+PHONE+'"><b>'+PHONE_H+'</b></a> or <a href="'+waLink(q)+'">WhatsApp us</a> and we will point you to the right process.</p></div>';return}
 el.innerHTML=res.map(function(r){return '<a class="result-item" href="'+r.href+'"><span class="k">'+r.type+(r.cat?' · '+esc(r.cat):'')+'</span><h3>'+esc(r.name)+'</h3></a>'}).join('');
}
var sForm=$('#site-search');
if(sForm){sForm.addEventListener('submit',function(e){e.preventDefault();var q=$('#site-search-q').value.trim();if(q)location.href='/property/search/?q='+encodeURIComponent(q)})}
var srchPage=$('#search-results');
if(srchPage){
 var params=new URLSearchParams(location.search),q=params.get('q')||'';
 var qInput=$('#search-q');if(qInput)qInput.value=q;
 var fSel=$('#search-filter');
 function go(){var v=qInput?qInput.value.trim():q;var f=fSel?fSel.value:'';renderResults(srchPage,runSearch(v,f),v);
  var n=$('#search-count');if(n)n.textContent=v?(runSearch(v,f).length+' result(s) for "'+v+'"'):''}
 if(qInput)$('#search-go').addEventListener('click',go);
 if(qInput)qInput.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();go()}});
 if(fSel)fSel.addEventListener('change',go);
 go();
}

/* save service */
function savedList(){return store('srchnp_saved')||[]}
$all('[data-save]').forEach(function(b){
 var id=b.getAttribute('data-save');
 function paint(){var on=savedList().indexOf(id)>-1;b.textContent=on?'Saved':'Save service';b.setAttribute('aria-pressed',on?'true':'false')}
 b.addEventListener('click',function(){var l=savedList();var i=l.indexOf(id);if(i>-1)l.splice(i,1);else l.push(id);store('srchnp_saved',l);paint()});
 paint();
});
/* dynamic whatsapp prefill */
$all('[data-wa]').forEach(function(a){a.href=waLink(a.getAttribute('data-wa'));a.target='_blank';a.rel='noopener'});

/* ---------- booking wizard ---------- */
var wizEl=$('#wizard');
if(wizEl){
 var opts='<option value="">Select a service</option>'+D.services.map(function(s){return '<option value="'+s.id+'">'+esc(s.name)+'</option>'}).join('')+'<option value="other">Something else / not sure</option>';
 var pre=new URLSearchParams(location.search).get('service')||'';
 var qmode=new URLSearchParams(location.search).get('mode');
 var state={service:'',property_type:'',locality:'',pincode:'',jurisdiction:'',name:'',mobile:'',email:'',applicant_type:'',description:'',documents:'',pref_date:'',pref_time:'',mode:'',consent:false};
 var wizT0=Date.now();
 var steps=[
  {t:'Select the service',sub:'Choose the service you need. Not sure? Pick "Something else" and describe it later.',f:function(){return f('Service','<select id="f-service" class="input">'+opts+'</select>',true)},r:function(){state.service=$('#f-service').value;return state.service}},
  {t:'Property type',sub:'What kind of property is this about?',f:function(){return radio('f-pt',['Residential apartment','Independent house / villa','Plot / site','Agricultural land','Commercial property','Industrial property','Other'])},r:function(){state.property_type=rv('f-pt');return state.property_type}},
  {t:'Property location',sub:'Locality and PIN code help us route your request to the right jurisdiction.',f:function(){return f('Locality','<input id="f-loc" type="text" maxlength="120" placeholder="e.g. Koramangala">',true)+f('PIN code','<input id="f-pin" type="text" inputmode="numeric" maxlength="6" placeholder="6-digit PIN">',false)},r:function(){state.locality=$('#f-loc').value.trim();state.pincode=$('#f-pin').value.trim();if(state.pincode&&!/^\d{6}$/.test(state.pincode)){alert('PIN code must be 6 digits.');return false}return state.locality}},
  {t:'Authority / jurisdiction',sub:'Which authority covers the property? Choose "Not sure" and we will work it out.',f:function(){return radio('f-jur',['Greater Bengaluru Authority / BBMP','BDA','Gram Panchayat','Other municipal body','Not sure'])},r:function(){state.jurisdiction=rv('f-jur');return state.jurisdiction}},
  {t:'About you',sub:'We use this only to contact you about this request.',f:function(){return f('Your name','<input id="f-name" type="text" maxlength="120" autocomplete="name">',true)+f('Mobile number','<input id="f-mob" type="tel" maxlength="14" inputmode="tel" autocomplete="tel" placeholder="10-digit mobile">',true)+f('Email (optional)','<input id="f-email" type="email" maxlength="160" autocomplete="email">',false)+radio('f-at',['Owner','Buyer','Seller','Tenant','Landlord','Power of Attorney holder','Legal heir','Other'],'Applicant type')},r:function(){state.name=$('#f-name').value.trim();state.mobile=$('#f-mob').value.replace(/[\s-]/g,'').replace(/^\+91/,'');state.email=$('#f-email').value.trim();state.applicant_type=rv('f-at');
   if(!state.name)return false;
   if(!/^[6-9]\d{9}$/.test(state.mobile)){alert('Enter a valid 10-digit Indian mobile number.');return false}
   if(state.email&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(state.email)){alert('That email address does not look right.');return false}
   if(!state.applicant_type){alert('Choose how you are related to this property.');return false}
   return true}},
  {t:'Describe the requirement',sub:'A few lines about what you need. Do not include passwords, OTPs or full ID numbers.',f:function(){return f('Requirement','<textarea id="f-desc" maxlength="1000" placeholder="e.g. I bought a flat in Whitefield and need the Khatha transferred to my name."></textarea>',true)},r:function(){state.description=$('#f-desc').value.trim();return state.description.length>=10?true:(alert('Please describe your requirement in a few words.'),false)}},
  {t:'Supporting documents',sub:'List the documents you already have (sale deed, Khatha, tax receipts...). Secure upload opens when our team contacts you - nothing is uploaded in this preview.',f:function(){return f('Documents you have','<textarea id="f-docs" maxlength="500" placeholder="e.g. Sale deed, previous Khatha, latest tax receipt"></textarea>',false)},r:function(){state.documents=$('#f-docs').value.trim();return true}},
  {t:'Preferred consultation time',sub:'Pick a preferred date and time. This is a preference, not a confirmed appointment.',f:function(){return f('Preferred date','<input id="f-date" type="date">',false)+f('Preferred time','<select id="f-time"><option value="">Any time</option><option>Morning (9am - 12pm)</option><option>Afternoon (12pm - 4pm)</option><option>Evening (4pm - 8pm)</option></select>',false)},r:function(){state.pref_date=$('#f-date').value;state.pref_time=$('#f-time').value;return true}},
  {t:'Assistance mode',sub:'How would you like to be helped?',f:function(){return radio('f-mode',(qmode==='quotation'?['Service quotation','Phone consultation','Online assistance','In-person assistance']:['Phone consultation','Online assistance','In-person assistance']))},r:function(){state.mode=rv('f-mode');return state.mode}},
  {t:'Review and submit',sub:'Check everything, then submit your enquiry.',f:function(){
    var s=D.services.filter(function(x){return x.id===state.service})[0];
    return '<div class="kv">'+
     '<dt>Service</dt><dd>'+esc(s?s.name:state.service)+'</dd>'+
     '<dt>Property type</dt><dd>'+esc(state.property_type)+'</dd>'+
     '<dt>Location</dt><dd>'+esc(state.locality)+(state.pincode?' - '+esc(state.pincode):'')+'</dd>'+
     '<dt>Jurisdiction</dt><dd>'+esc(state.jurisdiction)+'</dd>'+
     '<dt>Name</dt><dd>'+esc(state.name)+'</dd>'+
     '<dt>Mobile</dt><dd>'+esc(state.mobile)+'</dd>'+
     (state.email?'<dt>Email</dt><dd>'+esc(state.email)+'</dd>':'')+
     '<dt>Applicant type</dt><dd>'+esc(state.applicant_type)+'</dd>'+
     '<dt>Requirement</dt><dd>'+esc(state.description)+'</dd>'+
     (state.documents?'<dt>Documents</dt><dd>'+esc(state.documents)+'</dd>':'')+
     (state.pref_date?'<dt>Preferred</dt><dd>'+esc(state.pref_date)+' '+esc(state.pref_time)+'</dd>':'')+
     '<dt>Mode</dt><dd>'+esc(state.mode)+'</dd></div>'+
     '<div class="checkline" style="margin-top:18px"><input type="checkbox" id="f-consent"><label for="f-consent">I agree to be contacted by SRCHN.PROPERTY about this request by call, SMS or WhatsApp. I understand this enquiry is not a confirmed booking.</label></div>'},
   r:function(){state.consent=$('#f-consent').checked;if(!state.consent){alert('Please agree to be contacted so we can respond to your enquiry.')}return state.consent}}
 ];
 function f(label,control,req){return '<div class="field"><label class="'+(req?'req':'')+'">'+label+'</label>'+control+'</div>'}
 function radio(name,list,label){return '<div class="field">'+(label?'<label class="req">'+label+'</label>':'<label class="req">Choose one</label>')+'<div class="optgrid">'+list.map(function(o,i){return '<label class="opt"><input type="radio" name="'+name+'" value="'+esc(o)+'">'+esc(o)+'</label>'}).join('')+'</div></div>'}
 function rv(name){var r=$('input[name="'+name+'"]:checked');return r?r.value:''}
 var cur=0;
 function paint(){
  var st=steps[cur];
  $('#wiz-steps').innerHTML=steps.map(function(x,i){return '<span class="'+(i<=cur?'on':'')+'"></span>'}).join('');
  $('#wiz-body').innerHTML='<h2>Step '+(cur+1)+' of '+steps.length+' - '+st.t+'</h2><p class="sub">'+st.sub+'</p>'+st.f();
  if(cur===0){var sv=state.service||pre;if(sv)$('#f-service').value=sv;}
  if(qmode==='quotation'&&steps[cur].t==='Assistance mode'&&!state.mode){var qr=$('input[name="f-mode"]');if(qr)qr.checked=true}
  $('#wiz-back').style.visibility=cur===0?'hidden':'visible';
  $('#wiz-next').textContent=cur===steps.length-1?'Submit enquiry':'Continue';
 }
 $('#wiz-back').addEventListener('click',function(){if(cur>0){cur--;paint()}});
 $('#wiz-next').addEventListener('click',function(){
  if(steps[cur].r()===false)return;
  if(cur<steps.length-1){cur++;paint();window.scrollTo({top:0,behavior:'smooth'});return}
  submit();
 });
 function submit(){
  var btn=$('#wiz-next');btn.disabled=true;btn.textContent='Submitting...';
  var s=D.services.filter(function(x){return x.id===state.service})[0];
  var payload={elapsed:Date.now()-wizT0,service_id:state.service,service_name:s?s.name:state.service,property_type:state.property_type,locality:state.locality,pincode:state.pincode,jurisdiction:state.jurisdiction,name:state.name,mobile:state.mobile,email:state.email,applicant_type:state.applicant_type,description:state.description,documents:state.documents,preferred_date:state.pref_date,preferred_time:state.pref_time,assistance_mode:state.mode,consent:true,site2:$('#w-site2')?$('#w-site2').value:''};
  fetch('/property/api/requests',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)})
   .then(function(r){return r.json().then(function(j){return{ok:r.ok,status:r.status,body:j}})})
   .then(function(res){
    if(res.ok&&res.body.ok){done(res.body.ref,res.body.receipt_token,false)}
    else done(null,null,true,res.body&&res.body.error);
   })
   .catch(function(){done(null,null,true)});
 }
 function done(ref,token,local,err){
  var s=D.services.filter(function(x){return x.id===state.service})[0];
  var reqs=store('srchnp_requests')||[];
  var rec={ref:ref||('LOCAL-'+Date.now().toString(36).toUpperCase()),token:token||'',service:s?s.name:state.service,name:state.name,mobile:state.mobile,status:'NEW',at:new Date().toISOString(),local:!!local};
  reqs.unshift(rec);store('srchnp_requests',reqs.slice(0,50));
  var el=$('#wizard');
  el.innerHTML='<div class="confirm"><div class="ok-ic"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg></div>'+
   '<h2>Enquiry recorded</h2>'+
   '<p class="muted">Service: <b>'+esc(rec.service)+'</b></p>'+
   '<div class="refbox">Request reference<br><b>'+esc(rec.ref)+'</b>'+(token?'<br><span class="small muted">Tracking code: '+esc(token.slice(0,8))+'... (saved on this device)</span>':'')+'</div>'+
   (local?'<div class="banner" style="text-align:left">Saved on this device only. The online request store was not reachable'+(err?' ('+esc(err)+')':'')+', so this enquiry has not reached the team yet - please call or WhatsApp us to be sure.</div>'
        :'<p class="small muted">Status: NEW. This is a recorded enquiry, not a confirmed appointment. Our team contacts you on the mobile number given.</p>')+
   '<div class="hero-actions" style="justify-content:center;margin-top:20px">'+
   '<a class="btn btn-p" href="/property/track/">Track this request</a>'+
   '<a class="btn btn-o" href="tel:'+PHONE+'" data-track="call-after-booking">Call '+PHONE_H+'</a>'+
   '<a class="btn btn-o" href="'+waLink(rec.service)+'" target="_blank" rel="noopener" data-track="wa-after-booking">WhatsApp</a></div></div>';
  window.scrollTo({top:0,behavior:'smooth'});
 }
 paint();
}

/* ---------- track ---------- */
var trackEl=$('#track');
if(trackEl){
 var reqs=store('srchnp_requests')||[];
 var listEl=$('#my-requests');
 if(!reqs.length)listEl.innerHTML='<p class="muted small">No requests on this device yet. <a href="/property/book/"><u>Book a service</u></a> to get a reference.</p>';
 else listEl.innerHTML=reqs.map(function(r){
  return '<div class="doc-row"><div class="ic">SR</div><div class="n">'+esc(r.service)+'<div class="m">'+esc(r.ref)+' · '+new Date(r.at).toLocaleString('en-IN')+(r.local?' · saved on this device only':'')+'</div></div><span class="chip chip-blue">'+esc(r.status)+'</span>'+(r.ref&&r.ref.indexOf('SRP-')===0&&r.token?'<button class="btn btn-o" data-refresh="'+esc(r.ref)+'">Refresh status</button>':'')+'</div>';
 }).join('');
 listEl.addEventListener('click',function(e){
  var b=e.target.closest('[data-refresh]');if(!b)return;
  var ref=b.getAttribute('data-refresh');var rec=(store('srchnp_requests')||[]).filter(function(r){return r.ref===ref})[0];
  if(!rec||!rec.token)return;
  b.disabled=true;b.textContent='Checking...';
  fetch('/property/api/requests?id='+encodeURIComponent(ref)+'&token='+encodeURIComponent(rec.token))
   .then(function(r){return r.json()})
   .then(function(j){
    if(j&&j.request&&j.request.status){rec.status=j.request.status;var all=store('srchnp_requests')||[];store('srchnp_requests',all);location.reload()}
    else{b.textContent=(j&&j.error)||'Not found';b.disabled=false}
   }).catch(function(){b.textContent='Offline - try later';b.disabled=false});
 });
 var tl=$('#track-lookup');
 if(tl)tl.addEventListener('submit',function(e){e.preventDefault();
  var ref=$('#t-ref').value.trim(),tok=$('#t-token').value.trim();
  var out=$('#t-result');out.innerHTML='<p class="muted small">Checking...</p>';
  fetch('/property/api/requests?id='+encodeURIComponent(ref)+'&token='+encodeURIComponent(tok))
   .then(function(r){return r.json().then(function(j){return{ok:r.ok,body:j}})})
   .then(function(res){
    if(res.ok&&res.body.request){var q=res.body.request;
     out.innerHTML='<div class="factcard"><h3>'+esc(q.service_name||'Service request')+'</h3><div class="kv"><dt>Reference</dt><dd>'+esc(q.ref)+'</dd><dt>Status</dt><dd><span class="chip chip-blue">'+esc(q.status)+'</span></dd><dt>Submitted</dt><dd>'+new Date(q.created_at).toLocaleString('en-IN')+'</dd></div><p class="small muted" style="margin-top:10px">Statuses move NEW → CONTACTED → DOCUMENTS PENDING → UNDER REVIEW → IN PROGRESS → COMPLETED. A government application is never marked submitted unless submission is confirmed.</p></div>'}
    else out.innerHTML='<div class="banner">'+esc((res.body&&res.body.error)||'Could not find that request. Check the reference and tracking code.')+'</div>';
   }).catch(function(){out.innerHTML='<div class="banner">The request store is not reachable right now. Requests made on this device are listed above.</div>'});
 });
}

/* ---------- document vault (IndexedDB, this browser only) ---------- */
var vaultEl=$('#vault');
if(vaultEl){
 var DBN='srchn-property-vault',ST='docs',db=null;
 function openDb(cb){var r=indexedDB.open(DBN,1);
  r.onupgradeneeded=function(e){var d=e.target.result;if(!d.objectStoreNames.contains(ST))d.createObjectStore(ST,{keyPath:'id',autoIncrement:true})};
  r.onsuccess=function(e){db=e.target.result;cb()};r.onerror=function(){ $('#vault-list').innerHTML='<div class="banner">This browser could not open the local document store.</div>'}}
 function allDocs(cb){var t=db.transaction(ST,'readonly').objectStore(ST).getAll();t.onsuccess=function(){cb(t.result||[])}}
 function paint(){
  allDocs(function(docs){
   var q=($('#vault-q')?$('#vault-q').value:'').toLowerCase();
   var tag=($('#vault-f')?$('#vault-f').value:'');
   var rows=docs.filter(function(d){return(!q||d.name.toLowerCase().indexOf(q)>-1||(d.tags||'').toLowerCase().indexOf(q)>-1)&&(!tag||d.cat===tag)});
   var el=$('#vault-list');
   if(!rows.length){el.innerHTML='<p class="muted small" style="margin-top:14px">No documents '+(docs.length?'match':'yet')+'. Files you add stay in this browser only.</p>';return}
   el.innerHTML=rows.map(function(d){
    return '<div class="doc-row"><div class="ic">'+esc((d.name.split('.').pop()||'DOC').slice(0,4).toUpperCase())+'</div><div class="n">'+esc(d.name)+'<div class="m">'+esc(d.cat)+(d.tags?' · '+esc(d.tags):'')+' · '+(d.size/1024).toFixed(0)+' KB · '+new Date(d.at).toLocaleDateString('en-IN')+'</div></div><button class="btn btn-o" data-dl="'+d.id+'">Download</button><button class="btn btn-o" data-del="'+d.id+'">Delete</button></div>';
   }).join('');
  });
 }
 var drop=$('#vault-drop'),file=$('#vault-file');
 if(drop){
  drop.addEventListener('click',function(){file.click()});
  file.addEventListener('change',function(){
   var files=Array.prototype.slice.call(file.files);if(!files.length)return;
   var cat=$('#vault-cat').value,tags=$('#vault-tags').value.trim();
   openDb(function(){var t=db.transaction(ST,'readwrite').objectStore(ST);var left=files.length;
    files.forEach(function(fl){t.add({name:fl.name,type:fl.type,size:fl.size,cat:cat,tags:tags,at:Date.now(),blob:fl}).onsuccess=function(){if(--left===0){file.value='';paint()}}});});
  });
  $('#vault-q').addEventListener('input',function(){openDb(paint)});
  $('#vault-f').addEventListener('change',function(){openDb(paint)});
  $('#vault-list').addEventListener('click',function(e){
   var dl=e.target.closest('[data-dl]'),del=e.target.closest('[data-del]');
   if(dl)openDb(function(){db.transaction(ST,'readonly').objectStore(ST).get(+dl.getAttribute('data-dl')).onsuccess=function(ev){var d=ev.target.result;if(!d)return;var u=URL.createObjectURL(d.blob);var a=document.createElement('a');a.href=u;a.download=d.name;a.click();setTimeout(function(){URL.revokeObjectURL(u)},4000)}});
   if(del&&confirm('Delete this document from this browser?'))openDb(function(){db.transaction(ST,'readwrite').objectStore(ST).delete(+del.getAttribute('data-del')).onsuccess=paint});
  });
  openDb(paint);
 }
}

/* ---------- preview admin ---------- */
var admEl=$('#admin');
if(admEl){
 var overlay=store('srchnp_admin_overlay')||{};
 function catRows(){
  var q=($('#a-q')?$('#a-q').value:'').toLowerCase();
  var rows=D.services.map(function(s){var o=overlay[s.id]||{};return Object.assign({},s,o)});
  if(q)rows=rows.filter(function(s){return(s.name+' '+s.category_name+' '+(s.subcategory||'')).toLowerCase().indexOf(q)>-1});
  $('#a-cat').innerHTML='<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Service</th><th>Category</th><th>Subcategory</th><th>Status</th><th></th></tr></thead><tbody>'+
   rows.map(function(s){return '<tr><td><b>'+esc(s.name)+'</b></td><td>'+esc(s.category_name)+'</td><td>'+esc(s.subcategory||'')+'</td><td>'+(s.status==='unavailable'?'<span class="chip">Unavailable</span>':'<span class="chip chip-ok">Available</span>')+(overlay[s.id]?' <span class="chip chip-blue">local edit</span>':'')+'</td><td><button class="btn btn-o" data-tgl="'+s.id+'">'+(s.status==='unavailable'?'Enable':'Disable')+'</button></td></tr>'}).join('')+'</tbody></table></div>';
  $('#a-cat-count').textContent=rows.length+' of '+D.services.length+' service records';
 }
 $('#a-q').addEventListener('input',catRows);
 $('#a-cat').addEventListener('click',function(e){var b=e.target.closest('[data-tgl]');if(!b)return;
  var id=b.getAttribute('data-tgl');var base=D.services.filter(function(s){return s.id===id})[0];
  var cur=(overlay[id]&&overlay[id].status)||base.status;
  overlay[id]=Object.assign({},overlay[id],{status:cur==='unavailable'?'available':'unavailable'});
  store('srchnp_admin_overlay',overlay);catRows();});
 /* duplicate check */
 var seen={},dups=[];D.services.forEach(function(s){var k=s.name.toLowerCase();if(seen[k])dups.push(s.name);seen[k]=1});
 $('#a-dups').innerHTML=dups.length?'<div class="banner">Possible duplicate names: '+esc(dups.join(', '))+'</div>':'<p class="small muted">No duplicate service names in the catalogue.</p>';
 /* export csv */
 $('#a-export').addEventListener('click',function(){
  var rows=[['id','name','category','subcategory','authority','status','sources']].concat(D.services.map(function(s){return[s.id,s.name,s.category_name,s.subcategory||'',s.authority||'',s.status,(s.sources||[]).map(function(x){return x.url}).join(' | ')]}));
  var csv=rows.map(function(r){return r.map(function(c){return '"'+String(c==null?'':c).replace(/"/g,'""')+'"'}).join(',')}).join('\n');
  var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='srchn-property-catalogue.csv';a.click();setTimeout(function(){URL.revokeObjectURL(a.href)},4000);
 });
 /* requests (local device) */
 var reqs=store('srchnp_requests')||[];
 $('#a-req').innerHTML=reqs.length?'<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Ref</th><th>Service</th><th>Name</th><th>Mobile</th><th>Status</th><th>When</th></tr></thead><tbody>'+reqs.map(function(r){return '<tr><td>'+esc(r.ref)+'</td><td>'+esc(r.service)+'</td><td>'+esc(r.name)+'</td><td>'+esc(r.mobile)+'</td><td>'+esc(r.status)+(r.local?' (local)':'')+'</td><td>'+new Date(r.at).toLocaleString('en-IN')+'</td></tr>'}).join('')+'</tbody></table></div>':'<p class="small muted">No booking enquiries recorded on this device. Requests submitted with backend storage are held in the operations store and are not listed in this preview panel.</p>';
 /* analytics */
 var an=store('srchnp_analytics')||{};
 $('#a-an').innerHTML='<div class="counts">'+[['Total tracked clicks',an._total||0],['Call clicks',an['call-header']||0],['Booking starts',an['book-header']||0],['WhatsApp clicks',an['wa-hero']||0]].map(function(x){return '<div class="count"><b>'+x[1]+'</b><span>'+x[0]+' (this browser)</span></div>'}).join('')+'</div>';
 catRows();
}

/* rotating hero search suggestions (paused for reduced motion / while typing) */
(function(){
 var inp=document.getElementById('site-search-q');if(!inp)return;
 if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 var sug=['Register my property','Transfer my Khatha','Get an Encumbrance Certificate','Draft a Sale Deed','Prepare a Rental Agreement','Verify property ownership','Transfer BESCOM connection','Convert agricultural land'];
 var i=0;setInterval(function(){if(document.activeElement!==inp&&!inp.value){i=(i+1)%sug.length;inp.placeholder=sug[i]}},2600);
})();

/* Your Property Buddy - curated answers, catalogue fallback */
(function(){
 var root=document.getElementById('buddy');if(!root)return;
 var out=document.getElementById('buddy-out'),qin=document.getElementById('buddy-q'),form=document.getElementById('buddy-form');
 function svcCard(s){return '<div class="card"><span class="catnum">'+esc(s.category_name||'SERVICE').toUpperCase()+'</span><h3><a href="/property/service/'+s.id+'/">'+esc(s.name)+'</a></h3><p class="desc">'+esc(s.short)+'</p><div class="svc-actions"><a class="btn btn-p" href="/property/book/?service='+s.id+'">Book</a><a class="btn btn-o" href="/property/service/'+s.id+'/">Details</a></div></div>'}
 function ctas(firstSvc){return '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:4px"><a class="btn btn-p" href="/property/book/'+(firstSvc?'?service='+firstSvc:'')+'">Book a service</a><a class="btn btn-o" href="tel:+917710052202">Call '+PHONE_H+'</a><span class="chip chip-blue">General information - not legal advice</span></div>'}
 function renderAnswer(b){
  var svcs=b.services.map(function(id){return D.services.filter(function(s){return s.id===id})[0]}).filter(Boolean);
  var docs=[];svcs.forEach(function(s){(s.required_documents||[]).forEach(function(d){if(docs.indexOf(d)<0&&docs.length<8)docs.push(d)})});
  out.innerHTML='<div class="b-answer">'+
   '<div class="card"><span class="catnum">PROPERTY BUDDY</span><h3>'+esc(b.q)+'</h3><p class="desc" style="margin-top:8px">'+esc(b.intro)+'</p></div>'+
   '<div class="card"><h3>Recommended verified services</h3><div class="grid grid-2" style="margin-top:12px">'+svcs.map(svcCard).join('')+'</div></div>'+
   (docs.length?'<div class="card"><h3>Documents typically required</h3><div class="b-doc">'+docs.map(function(d){return '<span class="chip">'+esc(d)+'</span>'}).join('')+'</div></div>':'')+
   '<div class="card"><h3>Jurisdiction</h3><p class="desc" style="margin-top:8px">'+esc(b.jurisdiction)+'</p>'+(b.note?'<div class="note" style="margin-top:12px">'+esc(b.note)+'</div>':'')+'</div>'+
   ctas(svcs[0]?svcs[0].id:'')+'</div>';
  out.scrollIntoView({behavior:'smooth',block:'nearest'});
 }
 root.addEventListener('click',function(e){var c=e.target.closest('[data-bq]');if(!c)return;var b=D.buddy.filter(function(x){return x.id===c.getAttribute('data-bq')})[0];if(b)renderAnswer(b)});
 form.addEventListener('submit',function(){
  var q=qin.value.trim();if(!q)return;
  var hit=D.buddy.filter(function(x){return x.q.toLowerCase()===q.toLowerCase()})[0];
  if(hit){renderAnswer(hit);return}
  var stop={'how':1,'do':1,'i':1,'my':1,'the':1,'a':1,'an':1,'to':1,'of':1,'for':1,'me':1,'what':1,'is':1,'are':1,'can':1,'you':1,'we':1,'it':1,'this':1,'that':1,'your':1,'and':1,'or':1,'in':1,'on':1,'get':1,'want':1,'need':1,'check':1,'does':1,'am':1};
  var words=q.toLowerCase().split(/\s+/).filter(function(w){return w&&!stop[w]});
  var res=runSearch(q).filter(function(r){return r.type==='Service'});
  if(!res.length)res=runSearch(words.join(' ')).filter(function(r){return r.type==='Service'});
  if(!res.length){var seen={};var wl=words.slice().sort(function(a,b){return b.length-a.length});res=[];for(var wi=0;wi<wl.length&&res.length<6;wi++){runSearch(wl[wi]).forEach(function(r){if(r.type==='Service'&&!seen[r.href]&&res.length<6){seen[r.href]=1;res.push(r)}})}}
  res=res.slice(0,6);
  var more=runSearch(words.join(' ')||q).filter(function(r){return r.type!=='Service'}).slice(0,4);
  out.innerHTML='<div class="b-answer"><div class="card"><span class="catnum">PROPERTY BUDDY</span><h3>Closest matches in the verified catalogue</h3>'+
   (res.length?'<div class="grid grid-2" style="margin-top:12px">'+res.map(function(r){var m=r.href.match(/\/service\/([a-z0-9-]+)\//);var s=m&&D.services.filter(function(x){return x.id===m[1]})[0];return s?svcCard(s):''}).join('')+'</div>':'<p class="desc" style="margin-top:10px">No direct catalogue match yet. Call or WhatsApp us - a specialist will map your situation to the right process.</p>')+'</div>'+
   (more.length?'<div class="card"><h3>Related catalogue areas</h3><div class="b-doc">'+more.map(function(r){return '<a class="chip" href="'+r.href+'">'+esc(r.name)+'</a>'}).join('')+'</div></div>':'')+
   ctas(res.length?'':'')+'</div>';
 });
 var pq=new URLSearchParams(location.search).get('q');
 if(pq){var b=D.buddy.filter(function(x){return x.id===pq})[0];if(b){renderAnswer(b)}else{qin.value=pq;var qb=D.buddy.filter(function(x){return x.q.toLowerCase().indexOf(pq.toLowerCase())>-1})[0];if(qb)renderAnswer(qb)}}
})();

/* PIN code authority helper */
(function(){
 var f=document.getElementById('pin-form');if(!f)return;
 var out=document.getElementById('pin-out');
 var map={};(D.localities||[]).forEach(function(l){l.pins.forEach(function(p){map[p]=l.name})});
 f.addEventListener('submit',function(){
  var v=document.getElementById('pin-in').value.trim();
  if(!/^\d{6}$/.test(v)){out.innerHTML='<div class="note warn">Enter a valid 6-digit PIN code.</div>';return}
  var loc=map[v];
  if(loc){out.innerHTML='<div class="card"><span class="catnum">INDICATIVE - CONFIRM WITH THE AUTHORITY</span><h3>'+esc(v)+' &middot; '+esc(loc)+'</h3><p class="desc" style="margin-top:8px">This PIN generally falls under the <b>Greater Bengaluru Authority / BBMP</b> for Khatha and property tax, with registrations at the jurisdictional Sub-Registrar Office. Fringe pockets can differ - verify on the official portals below.</p><div class="b-doc"><a class="chip chip-blue" href="https://bbmpeaasthi.karnataka.gov.in/" target="_blank" rel="noopener">Check on e-Aasthi (GBA/BBMP)</a><a class="chip" href="https://eswathu.karnataka.gov.in/" target="_blank" rel="noopener">e-Swathu (panchayat)</a><a class="chip" href="/property/authorities/">Full directory</a></div></div>'}
  else{out.innerHTML='<div class="card"><h3>'+esc(v)+' is outside our indicative locality table</h3><p class="desc" style="margin-top:8px">We do not guess jurisdictions. Check your property record on e-Aasthi (GBA/BBMP). If it is not there, check e-Swathu for gram panchayat records, or Bhoomi for revenue land records - or call us and we will help you identify the authority.</p><div class="b-doc"><a class="chip chip-blue" href="https://bbmpeaasthi.karnataka.gov.in/" target="_blank" rel="noopener">e-Aasthi</a><a class="chip chip-blue" href="https://eswathu.karnataka.gov.in/" target="_blank" rel="noopener">e-Swathu</a><a class="chip chip-blue" href="https://landrecords.karnataka.gov.in/" target="_blank" rel="noopener">Bhoomi</a><a class="chip" href="tel:+917710052202">Call +91 77100 52202</a></div></div>'}
 });
})();
})();
