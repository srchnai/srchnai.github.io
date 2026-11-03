/* SRCHN visits: Google sign-in or email OTP. No SMS. */
(function(){
const $=s=>document.querySelector(s),f=$('#bk-f'),v=$('#bk-v');
if(!f||!v)return;
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let ctx=null,vals={},busy=false;
const gid=()=>{try{return localStorage.getItem('srchn_google')||''}catch{return ''}};
const api=async(p,body)=>{const headers={'X-SRCHN-Google':gid()};if(body)headers['Content-Type']='application/json';const r=await fetch(p,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined});return r.json()};
$('#bk-google').href='/auth/google/start?next='+encodeURIComponent(location.pathname+location.search);
f.visit_date.min=new Date(Date.now()+330*60000).toISOString().slice(0,10);
f.visit_date.max=new Date(Date.now()+60*86400000).toISOString().slice(0,10);
api('/club/api/whoami').then(d=>{if(d.ok){f.email.value=d.email;f.name.value=d.name||'';$('#bk-identity').textContent='Signed in with Google as '+d.email+'. Choose your visit below.';f.querySelector('button[type=submit]').textContent='CONTINUE TO REVIEW'}}).catch(()=>{});
api('/club/api/book/context?'+location.search.slice(1)).then(d=>{
 if(!d.ok){$('#bk-place').textContent=d.error||'Place unavailable. Please try again later.';f.hidden=true;return}ctx=d;
 if(d.kind==='brand'){
  $('#bk-place').textContent='Booking at '+d.brand.name+'. Registration creates your SRCHN Club membership.';
  if(d.options&&d.options.length>1){const label=document.createElement('label');label.textContent='Location';const sel=document.createElement('select');sel.id='bk-loc';d.options.forEach(o=>{const op=document.createElement('option');op.value=o.id;op.textContent=o.name+(o.locality?', '+o.locality:'');sel.append(op)});if(d.location)sel.value=d.location.id;label.append(sel);$('#bk-locwrap').append(label)}
 }else $('#bk-place').textContent='Booking at '+d.place.name+(d.place.locality?', '+d.place.locality:'')+'. Registration creates your SRCHN Club membership.';
}).catch(()=>{$('#bk-place').textContent='Could not load the place. Please retry later.';f.hidden=true});
f.onsubmit=async e=>{
 e.preventDefault();if(!ctx||busy)return;busy=true;f.querySelector('button[type=submit]').disabled=true;
 vals={name:f.name.value.trim(),email:f.email.value.trim(),visit_date:f.visit_date.value,visit_time:f.visit_time.value,people:f.people.value};
 $('#bk-msg').textContent='Checking sign-in...';
 try{const d=await api('/club/api/book/start',{name:vals.name,email:vals.email});if(!d.ok)throw Error(d.error||'Could not continue.');
 if(!d.google&&d.email_code!=='sent')throw Error('The email could not be sent right now. Please retry later.');
 f.hidden=true;v.hidden=false;v.code.required=!d.google;v.code.parentElement.hidden=!!d.google;v.querySelector('.cl-note').textContent=d.google?'Google identity verified. Review your visit, then confirm.':'Enter the one-time code sent to your email.';
 $('#bk-vmsg').textContent='Visit: '+vals.visit_date+(vals.visit_time?' at '+vals.visit_time:'')+' for '+vals.people+' people. No payment is taken.';
 }catch(x){$('#bk-msg').textContent=x.message||'Network error. Please retry.'}finally{busy=false;f.querySelector('button[type=submit]').disabled=false}
};
v.onsubmit=async e=>{
 e.preventDefault();if(!ctx||busy)return;busy=true;v.querySelector('button').disabled=true;
 const body={email:vals.email,code:v.code.value.trim(),visit_date:vals.visit_date,visit_time:vals.visit_time,people:vals.people,conditions_accepted:$('#bk-accept')?$('#bk-accept').checked:false};
 if(ctx.kind==='brand'){const sel=$('#bk-loc');body.location_id=sel?sel.value:(ctx.location&&ctx.location.id)}else{body.place_name=ctx.place.name;body.place_detail=ctx.place.locality||''}
 $('#bk-vmsg').textContent='Confirming...';
 try{const d=await api('/club/api/book/confirm',body);if(!d.ok)throw Error(d.error||'Could not confirm.');
 try{localStorage.setItem('srchn_club_token',d.token);const bk=JSON.parse(localStorage.getItem('srchn_bookings')||'{}');bk[body.location_id||('d:'+(ctx.place.ref||ctx.place.name))]=d.booking.booking_no;if(ctx.kind==='brand')bk['b:'+ctx.brand.id]=d.booking.booking_no;localStorage.setItem('srchn_bookings',JSON.stringify(bk))}catch{}
 v.hidden=true;const done=$('#bk-done');done.hidden=false;done.innerHTML='<div class="cl-note"><b>Booking confirmed.</b><p>Booking ID '+esc(d.booking.booking_no)+' at '+esc(d.booking.brand)+' on '+esc(d.booking.visit_date)+' for '+esc(d.booking.people)+' people.</p><p>'+esc(d.payment_note)+'</p><p>'+(d.email==='sent'?'A confirmation email was sent.':'Keep your booking ID. The confirmation email could not be sent.')+'</p></div><p><a class="br-btn br-btn-primary" href="/club/member/">YOUR MEMBERSHIP</a></p>';
 }catch(x){$('#bk-vmsg').textContent=x.message||'Network error. Please retry.'}finally{busy=false;v.querySelector('button').disabled=false}
};
})();
