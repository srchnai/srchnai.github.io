(function(){
function toast(m){var t=document.querySelector('.br-toast');if(!t){t=document.createElement('div');t.className='br-toast';document.body.appendChild(t)}t.textContent=m;t.classList.add('show');setTimeout(function(){t.classList.remove('show')},2200)}
/* tabs */
document.querySelectorAll('[data-br-tab]').forEach(function(b){b.addEventListener('click',function(){
 document.querySelectorAll('[data-br-tab]').forEach(function(x){x.classList.toggle('active',x===b)});
 document.querySelectorAll('[data-br-panel]').forEach(function(p){p.classList.toggle('active',p.getAttribute('data-br-panel')===b.getAttribute('data-br-tab'))});
})});
/* pause other videos when one plays */
document.addEventListener('play',function(e){if(e.target.tagName==='VIDEO'){document.querySelectorAll('video').forEach(function(v){if(v!==e.target)v.pause()})}},true);
/* save (device-local, honest) */
document.querySelectorAll('[data-br-save]').forEach(function(b){b.addEventListener('click',function(){
 try{var k='br_saved',s=JSON.parse(localStorage.getItem(k)||'[]');var id=b.getAttribute('data-br-save'),n=b.getAttribute('data-br-name');
 if(s.indexOf(id)<0){s.push(id);localStorage.setItem(k,JSON.stringify(s));toast(n+' saved on this device')}else{s=s.filter(function(x){return x!==id});localStorage.setItem(k,JSON.stringify(s));toast('Removed from saved')}}catch(e){toast('Saving is not available in this browser')}
})});
/* share */
document.querySelectorAll('[data-br-share]').forEach(function(b){b.addEventListener('click',function(){
 var url=b.getAttribute('data-br-url'),name=b.getAttribute('data-br-share');
 if(navigator.share){navigator.share({title:name+' - SRCHN BRANDS',url:url}).catch(function(){})}
 else if(navigator.clipboard){navigator.clipboard.writeText(url).then(function(){toast('Link copied')},function(){toast('Copy failed')})}
 else toast('Copy this link: '+url)
})});
/* report */
document.querySelectorAll('[data-br-report]').forEach(function(b){b.addEventListener('click',function(){
 var note=window.prompt('What is incorrect about '+b.getAttribute('data-br-name')+'? Team SRCHN will review it.');if(!note)return;
 fetch('/studio/api/report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'correction',target:b.getAttribute('data-br-name'),note:note.slice(0,500)})}).then(function(r){toast(r.ok?'Reported - Team SRCHN will review.':'Could not send the report.')},function(){toast('Could not send the report.')})
})});

/* view beacon */
try{var path=location.pathname;var meta=document.querySelector('link[rel=canonical]');
 fetch('/brands/api/view',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({brand_id:(path.match(/^\/brands\/([a-z0-9-]+)/)||[])[1]||'landing',location_id:(path.match(/locations\/([a-z0-9-]+)/)||[])[1]||null,kind:'brand'})}).catch(function(){})}catch(e){}
})();
