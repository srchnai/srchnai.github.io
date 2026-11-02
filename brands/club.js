/* SRCHN CLUB - public invite/sign-in + member area (monochrome, real data only) */
(function(){
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const inr=n=>'Rs '+Number(n||0).toLocaleString('en-IN');
const dt=ts=>ts?new Date(ts).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}):'-';

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
  const api=p=>fetch(p,{headers:{Authorization:'Bearer '+T}}).then(r=>r.json().then(d=>({status:r.status,data:d})));
  Promise.all([api('/club/api/me'),api('/club/api/brands'),api('/club/api/bookings'),api('/club/api/cashback')]).then(rs=>{
    const me=rs[0];
    if(me.status===401){localStorage.removeItem('srchn_club_token');location.href='/club/#signin';return}
    const M=me.data.member,MS=me.data.membership,brands=(rs[1].data&&rs[1].data.brands)||[],bks=(rs[2].data&&rs[2].data.bookings)||[],cb=(rs[3].data&&rs[3].data.cashback)||[];
    let h='<div class="cl-cards">'
      +'<div class="cl-card"><h3>MEMBERSHIP</h3><p class="cl-stat">'+esc(M.status)+'</p><p>'+esc(M.name)+' · '+esc(M.email)+'</p><p class="cl-sub">Member since '+dt(M.member_since)+' · 12-month period: '+dt(MS.period_start)+' - '+dt(MS.period_end)+'</p></div>'
      +'<div class="cl-card"><h3>CLUB CASHBACK THIS PERIOD</h3><p class="cl-stat">'+inr(MS.cashback_used_inr)+'</p><p class="cl-sub">of up to '+inr(MS.cashback_cap_inr)+' per 12-month membership period</p></div>'
      +'<div class="cl-card"><h3>BOOKINGS</h3><p class="cl-stat">'+MS.bookings+'</p><p class="cl-sub">visits booked with your membership</p></div></div>';
    h+='<h2 class="cl-h">Participating brands</h2>';
    h+=brands.length?'<div class="br-grid">'+brands.map(b=>'<article class="br-card"><a class="br-card-link" href="/brands/'+esc(b.slug)+'/">'+(b.logo?'<img class="br-card-logo" src="'+esc(b.logo)+'" alt=""/>':'<span class="br-card-initial" aria-hidden="true">'+esc((b.name||'?')[0])+'</span>')+'<h3>'+esc(b.name)+'</h3><p class="br-card-meta">'+esc([b.category,b.locality].filter(Boolean).join(' · '))+'</p>'+(b.tagline?'<p class="br-card-tag">'+esc(b.tagline)+'</p>':'')+'<span class="br-card-cta">Explore Brand</span></a></article>').join('')+'</div>':'<p class="br-empty">No Club brands are live yet. Participating brands appear here once approved.</p>';
    h+='<h2 class="cl-h">Booking history</h2>';
    h+=bks.length?'<div class="cl-scroll"><table class="cl-table"><tr><th>BOOKING</th><th>BRAND</th><th>VISIT</th><th>FEE</th><th>STATUS</th></tr>'+bks.map(k=>'<tr><td>'+esc(k.booking_no)+'</td><td>'+esc(k.brand_name)+' · '+esc(k.location_name)+'</td><td>'+esc(k.visit_date)+(k.visit_time?' '+esc(k.visit_time):'')+' · '+k.people+' guest'+(k.people>1?'s':'')+'</td><td>'+(k.fee_inr?inr(k.fee_inr):'Free')+'<br/><span class="cl-sub">'+(k.pay_status==='PAY_NOT_ENABLED'?'payment not yet enabled':esc(k.pay_status))+'</span></td><td><span class="cl-pill'+(k.status==='CHECKED_IN'?' solid':'')+'">'+esc(k.status)+'</span></td></tr>').join('')+'</table></div>':'<p class="br-empty">No bookings yet. Book from a participating brand page with the BOOK NOW action.</p>';
    h+='<h2 class="cl-h">Payment history</h2><div class="cl-note"><b>SRCHN PAY - configuration required, currently disabled.</b><br/>No payments have been taken. When SRCHN PAY goes live, your payments appear here.</div>';
    h+='<h2 class="cl-h">Cashback history</h2>';
    h+=cb.length?'<div class="cl-scroll"><table class="cl-table"><tr><th>DATE</th><th>AMOUNT</th><th>STATUS</th><th>NOTE</th></tr>'+cb.map(c=>'<tr><td>'+dt(c.created_at)+'</td><td>'+inr(c.cashback_inr)+'</td><td><span class="cl-pill">'+esc(c.status)+'</span></td><td>'+esc(c.note||'-')+'</td></tr>').join('')+'</table></div>':'<p class="br-empty">No cashback yet. Eligible cashback is up to 5% of the SRCHN success fee, capped at up to Rs 5,000 per 12-month membership period, and is credited only after the underlying payment and commission eligibility are confirmed.</p>';
    h+='<div class="cl-note" style="margin-top:26px"><b>Identity verification - configuration required, currently disabled.</b><br/>Some Club journeys may ask you to verify your identity when legally and commercially necessary. SRCHN will never ask for your DigiLocker password or OTP.</div>';
    h+='<p style="margin-top:22px"><button class="br-btn br-btn-ghost" id="clm-out">SIGN OUT</button></p>';
    clm.innerHTML=h;
    $('clm-out').onclick=()=>{fetch('/club/api/logout',{method:'POST',headers:{Authorization:'Bearer '+T}}).finally(()=>{localStorage.removeItem('srchn_club_token');location.href='/club/'})};
  }).catch(()=>{clm.innerHTML='<p class="br-empty">Could not load your membership. Please try again.</p>'});
}
})();
