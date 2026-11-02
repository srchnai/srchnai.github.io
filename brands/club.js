/* SRCHN CLUB - public invite/sign-in + member area (monochrome, real data only) */
(function(){
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const inr=n=>'Rs '+Number(n||0).toLocaleString('en-IN');
const dt=ts=>ts?new Date(ts).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}):'-';
const todayIST=()=>new Date(Date.now()+330*60000).toISOString().slice(0,10);

/* ---- public page: invite request + member sign-in ---- */
const inv=$('cl-inv'),lg=$('cl-login'),vf=$('cl-verify');
if(inv){
  let email='';
  inv.onsubmit=e=>{
    e.preventDefault();const b=inv.querySelector('button');b.disabled=true;$('cl-inv-msg').textContent='Sending...';
    fetch('/club/api/invite-request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:inv.name.value,email:inv.email.value,city:inv.city.value,note:inv.note.value})})
    .then(r=>r.json().then(d=>{$('cl-inv-msg').textContent=d.message||d.error||'Something went wrong.';if(d.ok)inv.reset();b.disabled=false}))
    .catch(()=>{$('cl-inv-msg').textContent='Network error. Please try again.';b.disabled=false});
  };
  lg.onsubmit=e=>{
    e.preventDefault();email=lg.email.value.trim();const b=lg.querySelector('button');b.disabled=true;$('cl-login-msg').textContent='Sending...';
    fetch('/club/api/login/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})})
    .then(r=>r.json().then(d=>{$('cl-login-msg').textContent=d.message||d.error||'Something went wrong.';if(d.ok){vf.hidden=false;vf.code.focus()}b.disabled=false}))
    .catch(()=>{$('cl-login-msg').textContent='Network error. Please try again.';b.disabled=false});
  };
  vf.onsubmit=e=>{
    e.preventDefault();const b=vf.querySelector('button');b.disabled=true;$('cl-login-msg').textContent='Checking...';
    fetch('/club/api/login/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,code:vf.code.value.trim()})})
    .then(r=>r.json().then(d=>{
      if(d.ok&&d.token){localStorage.setItem('srchn_club_token',d.token);location.href='/club/member/'}
      else{$('cl-login-msg').textContent=d.error||'Could not sign you in.';b.disabled=false}
    }))
    .catch(()=>{$('cl-login-msg').textContent='Network error. Please try again.';b.disabled=false});
  };
}

/* ---- member area ---- */
const clm=$('clm');
if(clm){
  const T=localStorage.getItem('srchn_club_token')||'';
  if(!T){location.href='/club/#signin';return}
  const api=(p,o)=>{o=o||{};o.headers=o.headers||{};o.headers['Authorization']='Bearer '+T;if(o.json!==undefined){o.headers['Content-Type']='application/json';o.body=JSON.stringify(o.json)}return fetch(p,o).then(r=>r.json().then(d=>({status:r.status,data:d})))};
  Promise.all([api('/club/api/me'),api('/club/api/brands'),api('/club/api/bookings'),api('/club/api/cashback'),api('/club/api/booking-options')]).then(rs=>{
    const me=rs[0];
    if(me.status===401){localStorage.removeItem('srchn_club_token');location.href='/club/#signin';return}
    const M=me.data.member,MS=me.data.membership,brands=(rs[1].data&&rs[1].data.brands)||[],bks=(rs[2].data&&rs[2].data.bookings)||[],cb=(rs[3].data&&rs[3].data.cashback)||[],opts=(rs[4].data&&rs[4].data.options)||[];
    const today=todayIST();
    let h='<div class="cl-cards">'
      +'<div class="cl-card"><h3>MEMBERSHIP</h3><p class="cl-stat">'+esc(M.status)+'</p><p>'+esc(M.name)+' · '+esc(M.email)+'</p><p class="cl-sub">Member since '+dt(M.member_since)+' · 12-month period: '+dt(MS.period_start)+' - '+dt(MS.period_end)+'</p></div>'
      +'<div class="cl-card"><h3>CLUB CASHBACK THIS PERIOD</h3><p class="cl-stat">'+inr(MS.cashback_used_inr)+'</p><p class="cl-sub">of up to '+inr(MS.cashback_cap_inr)+' per 12-month membership period</p></div>'
      +'<div class="cl-card"><h3>BOOKINGS</h3><p class="cl-stat">'+MS.bookings+'</p><p class="cl-sub">visits booked with your membership</p></div></div>';
    h+='<h2 class="cl-h">Participating brands</h2>';
    h+=brands.length?'<div class="br-grid">'+brands.map(b=>'<article class="br-card"><a class="br-card-link" href="/brands/'+esc(b.slug)+'/">'+(b.logo?'<img class="br-card-logo" src="'+esc(b.logo)+'" alt=""/>':'<span class="br-card-initial" aria-hidden="true">'+esc((b.name||'?')[0])+'</span>')+'<h3>'+esc(b.name)+'</h3><p class="br-card-meta">'+esc([b.category,b.locality].filter(Boolean).join(' · '))+'</p>'+(b.tagline?'<p class="br-card-tag">'+esc(b.tagline)+'</p>':'')+'<span class="br-card-cta">Explore Brand</span></a></article>').join('')+'</div>':'<p class="br-empty">No Club brands are live yet. Participating brands appear here once approved.</p>';
    /* book a visit */
    h+='<h2 class="cl-h" id="book">Book a visit</h2>';
    if(!opts.length){
      h+='<p class="br-empty">No Club locations have booking enabled yet. When a participating brand activates booking, it appears here.</p>';
    }else{
      const maxD=new Date(Date.now()+60*86400000).toISOString().slice(0,10);
      h+='<form id="cl-book" class="cl-form">'
        +'<label>Brand and location<select name="location_id" required>'+opts.map((o,i)=>'<option value="'+esc(o.location_id)+'" data-i="'+i+'">'+esc(o.brand_name)+' · '+esc(o.location_name)+(o.locality?' ('+esc(o.locality)+')':'')+(o.fee_inr?' · fee '+inr(o.fee_inr):' · no fee')+'</option>').join('')+'</select></label>'
        +'<label>Visit date<input type="date" name="visit_date" required min="'+today+'" max="'+maxD+'" value="'+today+'"/></label>'
        +'<label>Visit time (optional)<input type="time" name="visit_time"/></label>'
        +'<label>Guests<input type="number" name="people" min="1" max="20" value="2" required/></label>'
        +'<div id="cl-book-terms" class="cl-note" hidden></div>'
        +'<label id="cl-book-accept-wrap" hidden style="display:flex;flex-direction:row;align-items:center;gap:8px"><input type="checkbox" name="accept" style="width:auto"/> I have read and accept the booking conditions</label>'
        +'<div class="cl-note">Booking creates a unique booking ID instantly. <b>SRCHN PAY is not yet enabled (configuration required)</b> - any booking fee is shown for transparency and no payment is taken.</div>'
        +'<button class="br-btn br-btn-primary" type="submit">CONFIRM BOOKING</button><p class="cl-msg" id="cl-book-msg"></p></form>';
    }
    /* booking history */
    h+='<h2 class="cl-h">Booking history</h2>';
    h+=bks.length?'<div class="cl-scroll"><table class="cl-table"><tr><th>BOOKING</th><th>BRAND</th><th>VISIT</th><th>FEE</th><th>STATUS</th><th></th></tr>'+bks.map(k=>'<tr><td>'+esc(k.booking_no)+'</td><td>'+esc(k.brand_name)+' · '+esc(k.location_name)+'</td><td>'+esc(k.visit_date)+(k.visit_time?' '+esc(k.visit_time):'')+' · '+k.people+' guest'+(k.people>1?'s':'')+'</td><td>'+(k.fee_inr?inr(k.fee_inr):'Free')+'<br/><span class="cl-sub">'+(k.pay_status==='PAY_NOT_ENABLED'?'payment not yet enabled':esc(k.pay_status))+'</span></td><td><span class="cl-pill'+(k.status==='CHECKED_IN'?' solid':'')+'">'+esc(k.status)+'</span></td><td>'+(k.status==='CONFIRMED'?((k.visit_date===today?'<button class="br-btn br-btn-primary cl-mini" data-ci="'+esc(k.booking_no)+'">Check in</button> ':'')+'<button class="br-btn br-btn-ghost cl-mini" data-cx="'+esc(k.booking_no)+'">Cancel</button>'):'')+'</td></tr>').join('')+'</table></div>':'<p class="br-empty">No bookings yet. Use the booking form above at a participating Club location.</p>';
    h+='<h2 class="cl-h">Payment history</h2><div class="cl-note"><b>SRCHN PAY - configuration required, currently disabled.</b><br/>No payments have been taken. When SRCHN PAY goes live, your payments appear here.</div>';
    h+='<h2 class="cl-h">Cashback history</h2>';
    h+=cb.length?'<div class="cl-scroll"><table class="cl-table"><tr><th>DATE</th><th>AMOUNT</th><th>STATUS</th><th>NOTE</th></tr>'+cb.map(c=>'<tr><td>'+dt(c.created_at)+'</td><td>'+inr(c.cashback_inr)+'</td><td><span class="cl-pill">'+esc(c.status)+'</span></td><td>'+esc(c.note||'-')+'</td></tr>').join('')+'</table></div>':'<p class="br-empty">No cashback yet. Eligible cashback is up to 5% of the SRCHN success fee, capped at up to Rs 5,000 per 12-month membership period, and is credited only after the underlying payment and commission eligibility are confirmed.</p>';
    h+='<div class="cl-note" style="margin-top:26px"><b>Identity verification - configuration required, currently disabled.</b><br/>Some Club journeys may ask you to verify your identity when legally and commercially necessary. SRCHN will never ask for your DigiLocker password or OTP.</div>';
    h+='<p style="margin-top:22px"><button class="br-btn br-btn-ghost" id="clm-out">SIGN OUT</button></p>';
    clm.innerHTML=h;
    $('clm-out').onclick=()=>{fetch('/club/api/logout',{method:'POST',headers:{Authorization:'Bearer '+T}}).finally(()=>{localStorage.removeItem('srchn_club_token');location.href='/club/'})};
    const bk=$('cl-book');
    if(bk){
      const sel=bk.location_id;
      const showTerms=()=>{const o=opts[+sel.selectedOptions[0].dataset.i];const has=!!(o&&o.terms);$('cl-book-terms').hidden=!has;$('cl-book-accept-wrap').hidden=!has;if(has)$('cl-book-terms').innerHTML='<b>Booking conditions</b><br/>'+esc(o.terms)};
      sel.onchange=showTerms;showTerms();
      bk.onsubmit=e=>{
        e.preventDefault();const b=bk.querySelector('button[type=submit]');b.disabled=true;$('cl-book-msg').textContent='Confirming...';
        api('/club/api/book',{json:{location_id:sel.value,visit_date:bk.visit_date.value,visit_time:bk.visit_time.value||'',people:bk.people.value,conditions_accepted:!$('cl-book-accept-wrap').hidden?bk.accept.checked===true:undefined}}).then(r=>{
          const d=r.data||{};
          if(d.ok){$('cl-book-msg').innerHTML='Confirmed. Booking ID <b>'+esc(d.booking.booking_no)+'</b>. '+esc(d.payment_note||'')+(d.email==='sent'?' Confirmation email sent.':' (Confirmation email could not be sent - your booking ID above is the record.)');setTimeout(()=>location.reload(),2600)}
          else{$('cl-book-msg').textContent=d.error||'Could not create the booking.';b.disabled=false}
        }).catch(()=>{$('cl-book-msg').textContent='Network error. Please try again.';b.disabled=false});
      };
    }
    clm.querySelectorAll('[data-ci]').forEach(x=>x.onclick=()=>{x.disabled=true;api('/club/api/check-in',{json:{booking_no:x.dataset.ci}}).then(r=>{if(r.data&&r.data.ok)location.reload();else{alert((r.data&&r.data.error)||'Check-in failed.');x.disabled=false}})});
    clm.querySelectorAll('[data-cx]').forEach(x=>x.onclick=()=>{if(!confirm('Cancel booking '+x.dataset.cx+'?'))return;x.disabled=true;api('/club/api/cancel-booking',{json:{booking_no:x.dataset.cx}}).then(r=>{if(r.data&&r.data.ok)location.reload();else{alert((r.data&&r.data.error)||'Could not cancel.');x.disabled=false}})});
  }).catch(()=>{clm.innerHTML='<p class="br-empty">Could not load your membership. Please try again.</p>'});
}
})();
