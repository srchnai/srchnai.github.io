/* SRCHN Club booking: register (name, mobile, email) + real email code + labelled demo SMS step + confirm. */
(function(){
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let ctx=null,smsDemo='',vals={};
const qs=location.search.slice(1);
fetch('/club/api/book/context?'+qs).then(r=>r.json()).then(d=>{
 if(!d.ok){$('#bk-place').innerHTML='<b>'+esc(d.error||'Place not found.')+'</b> <a href="/brands/">Explore brands</a>';$('#bk-f').style.display='none';return}
 ctx=d;
 if(d.kind==='brand'){
  let h='Booking at: <b>'+esc(d.brand.name)+'</b>';
  if(d.location)h+=' - '+esc(d.location.name)+(d.location.locality&&d.location.locality.toLowerCase()!==d.location.name.toLowerCase()?', '+esc(d.location.locality):'');
  $('#bk-place').innerHTML=h+'. Registration creates your SRCHN Club membership.';
  if(d.options&&d.options.length>1){
   const l=document.createElement('label');l.textContent='Location';
   const sel=document.createElement('select');sel.id='bk-loc';
   sel.style.cssText='border:1px solid #d6d6d6;border-radius:10px;padding:11px 12px;font:inherit';
   d.options.forEach(o=>{const op=document.createElement('option');op.value=o.id;op.textContent=o.name+(o.locality&&o.locality.toLowerCase()!==o.name.toLowerCase()?', '+o.locality:'');sel.append(op)});
   if(d.location)sel.value=d.location.id;
   l.append(sel);$('#bk-locwrap').append(l);
  }
 }else{
  $('#bk-place').innerHTML='Booking at: <b>'+esc(d.place.name)+'</b>'+(d.place.locality?', '+esc(d.place.locality):'')+' (open-data place record). Registration creates your SRCHN Club membership.';
 }
}).catch(()=>{$('#bk-place').textContent='Could not load the place. Check your connection and retry.'});
$('#bk-f').onsubmit=e=>{
 e.preventDefault();const f=e.target;
 vals={name:f.name.value.trim(),mobile:f.mobile.value.trim(),email:f.email.value.trim(),visit_date:f.visit_date.value,visit_time:f.visit_time.value,people:f.people.value};
 $('#bk-msg').textContent='Sending codes...';
 fetch('/club/api/book/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:vals.name,mobile:vals.mobile,email:vals.email})}).then(r=>r.json()).then(d=>{
  if(!d.ok){$('#bk-msg').textContent=d.error||'Could not send the codes.';return}
  smsDemo=d.sms_demo_code||'';$('#bk-sms').textContent=smsDemo;
  $('#bk-f').hidden=true;$('#bk-v').hidden=false;
  $('#bk-vmsg').textContent=d.email_code==='sent'?'Email code sent - check your inbox for the 6-digit code.':'The email could not be sent right now (daily limit or mail error). Go back and retry in a little while.';
 }).catch(()=>$('#bk-msg').textContent='Network error. Please try again.');
};
$('#bk-v').onsubmit=e=>{
 e.preventDefault();const f=e.target;
 if(f.sms.value!==smsDemo){$('#bk-vmsg').textContent='The demo SMS code does not match the code shown above.';return}
 const body={email:vals.email,code:f.code.value.trim(),visit_date:vals.visit_date,visit_time:vals.visit_time,people:vals.people,conditions_accepted:true};
 if(ctx.kind==='brand'){const sel=$('#bk-loc');body.location_id=sel?sel.value:(ctx.location&&ctx.location.id)}
 else{body.place_name=ctx.place.name;body.place_detail=ctx.place.locality||(ctx.place.ref?('Discovery record '+ctx.place.ref):'')}
 $('#bk-vmsg').textContent='Confirming...';
 fetch('/club/api/book/confirm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json()).then(d=>{
  if(!d.ok){$('#bk-vmsg').textContent=d.error||'Could not confirm the booking.';return}
  try{localStorage.setItem('srchn_club_token',d.token);
   const bk=JSON.parse(localStorage.getItem('srchn_bookings')||'{}');
   bk[body.location_id||('d:'+(ctx.place.ref||ctx.place.name))]=d.booking.booking_no;
   localStorage.setItem('srchn_bookings',JSON.stringify(bk));}catch(x){}
  $('#bk-v').hidden=true;const dn=$('#bk-done');dn.hidden=false;
  dn.innerHTML='<div class="cl-note"><b>Booking confirmed.</b><br/>Booking ID <b>'+esc(d.booking.booking_no)+'</b> - '+esc(d.booking.brand)+(d.booking.location?', '+esc(d.booking.location):'')+' on '+esc(d.booking.visit_date)+' for '+esc(d.booking.people)+' '+(+d.booking.people===1?'person':'people')+'.<br/>'+(d.email==='sent'?'A confirmation email was sent.':'The confirmation email could not be sent - the booking ID above is your record.')+'<br/>'+esc(d.payment_note)+'<br/><br/>The VISIT button for this place is now active on this device.</div>'
  +'<p style="display:flex;gap:10px;flex-wrap:wrap"><a class="br-btn br-btn-primary" href="/club/member/">GO TO YOUR MEMBERSHIP</a><button class="br-btn br-btn-ghost" data-demo-open="pay" data-brand="'+esc(d.booking.brand)+'" data-booking="'+esc(d.booking.booking_no)+'">PAY &middot; DEMO</button></p>';
 }).catch(()=>$('#bk-vmsg').textContent='Network error. Please try again.');
};
})();
