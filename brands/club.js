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
  Promise.all([api('/club/api/me'),api('/club/api/brands'),api('/club/api/bookings'),api('/club/api/cashback'),api('/club/api/booking-options'),api('/club/api/verification'),api('/club/api/payments')]).then(rs=>{
    const me=rs[0];
    if(me.status===401){localStorage.removeItem('srchn_club_token');location.href='/club/#signin';return}
    const M=me.data.member,MS=me.data.membership,brands=(rs[1].data&&rs[1].data.brands)||[],bks=(rs[2].data&&rs[2].data.bookings)||[],cb=(rs[3].data&&rs[3].data.cashback)||[],opts=(rs[4].data&&rs[4].data.options)||[],pays=(rs[6].data&&rs[6].data.payments)||[];const VF=rs[5].data||{};
    const today=todayIST();
    const MOCK=/\.pages\.dev$/.test(location.hostname);
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
    h+=bks.length?'<div class="cl-bks">'+bks.map(k=>'<div class="cl-bk"><div class="cl-bk-top"><b>'+esc(k.booking_no)+'</b><span class="cl-pill'+(k.status==='CHECKED_IN'?' solid':'')+'">'+esc(k.status)+'</span></div><p class="cl-bk-name">'+esc(k.brand_name)+' \u00b7 '+esc(k.location_name)+'</p><p class="cl-sub">'+esc(k.visit_date)+(k.visit_time?' '+esc(k.visit_time):'')+' \u00b7 '+k.people+' guest'+(k.people>1?'s':'')+' \u00b7 '+(k.fee_inr?inr(k.fee_inr):'Free')+' \u00b7 '+(k.pay_status==='PAY_NOT_ENABLED'?'payment not yet enabled':k.pay_status==='MOCK_PAID'?'paid \u00b7 preview mock':esc(k.pay_status))+'</p>'+((k.status==='CONFIRMED'||(MOCK&&k.status==='CHECKED_IN'&&!pays.some(p=>p.booking_no===k.booking_no&&p.kind==='BILL')))?'<div class="cl-bk-actions">'+(k.status==='CONFIRMED'?((k.visit_date===today?'<button class="br-btn br-btn-primary cl-mini" data-ci="'+esc(k.booking_no)+'">Check in</button>':'')+(MOCK&&k.fee_inr&&k.pay_status!=='MOCK_PAID'?'<button class="br-btn br-btn-primary cl-mini" data-pf="'+esc(k.booking_no)+'">Pay fee (mock)</button>':'')+(!MOCK&&k.fee_inr&&k.pay_status==='PAY_NOT_ENABLED'?'<button class="br-btn br-btn-ghost cl-mini" data-dp="'+esc(k.booking_no)+'" data-amt="'+k.fee_inr+'" data-brand="'+esc(k.brand_name)+'">Pay</button>':'')+'<button class="br-btn br-btn-ghost cl-mini" data-cx="'+esc(k.booking_no)+'">Cancel</button>'):'')+(MOCK&&k.status==='CHECKED_IN'&&!pays.some(p=>p.booking_no===k.booking_no&&p.kind==='BILL')?'<button class="br-btn br-btn-primary cl-mini" data-pb="'+esc(k.booking_no)+'">Pay bill (mock)</button>':'')+'</div>':'')+'</div>').join('')+'</div>':'<p class="br-empty">No bookings yet. Use the booking form above at a participating Club location.</p>';
    h+='<h2 class="cl-h">Payment history</h2>';
    h+=pays.length?'<div class="cl-bks">'+pays.map(p=>'<div class="cl-bk"><div class="cl-bk-top"><b>'+(p.kind==='FEE'?'Booking fee':'Visit bill')+' \u00b7 '+inr(p.amount_inr)+'</b><span class="cl-pill solid">PAID \u00b7 preview mock</span></div><p class="cl-sub">'+esc(p.booking_no)+' \u00b7 '+dt(p.created_at)+'</p></div>').join('')+'</div>':'<p class="br-empty">No payments yet.</p>';
    h+='<div id="clm-demorcpts"></div>';
    h+='<div class="cl-note"><b>SRCHN PAY - configuration required, currently disabled.</b><br/>No real payments are taken on SRCHN.'+(MOCK?' Payments marked "preview mock" are demonstrations on this preview site only - no real charge was made.':'')+' <a href="/club/demo/#pay">See how SRCHN PAY will work - interface demo</a>.</div>';
    h+='<h2 class="cl-h">Cashback history</h2>';
    h+=cb.length?'<div class="cl-scroll"><table class="cl-table"><tr><th>DATE</th><th>AMOUNT</th><th>STATUS</th><th>NOTE</th></tr>'+cb.map(c=>'<tr><td>'+dt(c.created_at)+'</td><td>'+inr(c.cashback_inr)+'</td><td><span class="cl-pill">'+esc(c.status)+'</span></td><td>'+esc(c.note||'-')+'</td></tr>').join('')+'</table></div>':'<p class="br-empty">No cashback yet. Eligible cashback is up to 5% of the SRCHN success fee, capped at up to Rs 5,000 per 12-month membership period, and is credited only after the underlying payment and commission eligibility are confirmed.</p>';
    h+='<h2 class="cl-h">Identity verification</h2>';
    h+='<div class="cl-note"><b>Why verification may be requested.</b><br/>Some Club journeys may ask you to verify your identity when it is legally and commercially necessary - for example before higher-risk transactions. Browsing SRCHN never requires identity verification.<br/><br/><b>What would be requested.</b><br/>Only with your explicit consent, SRCHN would use DigiLocker to verify your name and date of birth from a document you choose and share in the official DigiLocker flow. SRCHN never sees or stores your DigiLocker password or OTP, and never collects your Aadhaar number.<br/><br/><b>What we store.</b><br/>Only the minimum verification result and an audit reference. You can withdraw consent at any time; withdrawal closes the verification record.<br/><br/>DigiLocker is a Government of India platform. SRCHN is not affiliated with, or endorsed by, DigiLocker, UIDAI or DigiYatra.</div>';
    h+='<div class="cl-card" style="margin-top:12px"><h3>VERIFICATION DEMOS</h3><p class="cl-sub">Interface mockups of the two verification steps - they run entirely on your device: no real verification, no OTP, nothing is captured or stored.</p><p style="display:flex;gap:10px;flex-wrap:wrap"><button class="br-btn br-btn-primary cl-mini" data-dv="digilocker">DigiLocker &middot; Aadhaar demo</button><button class="br-btn br-btn-ghost cl-mini" data-dv="face">Face verification demo</button></p></div>';
    const vc=VF.consent,vv=VF.verification;
    if(vc&&vc.status==='GIVEN'){
      h+='<div class="cl-card" style="margin-top:12px"><h3>VERIFICATION STATUS</h3><p class="cl-stat">'+(vv&&vv.status==='PROVIDER_DISABLED'?'NOT STARTED':esc(vv?vv.status:'-'))+'</p><p class="cl-sub">Consent given '+dt(vc.given_at)+' ('+esc(vc.text_version)+')'+(vv?' &middot; audit reference '+esc(vv.audit_ref):'')+'</p>'
        +'<p><button class="br-btn br-btn-primary" id="cl-vf-start" disabled>CONTINUE TO DIGILOCKER</button></p>'
        +'<p class="cl-sub"><b>DigiLocker integration - configuration required, currently disabled.</b> SRCHN requester onboarding and API approval are pending, so verification cannot start yet.</p>'
        +'<p><button class="br-btn br-btn-ghost cl-mini" id="cl-vf-withdraw">Withdraw consent</button></p><p class="cl-msg" id="cl-vf-msg"></p></div>';
    }else{
      h+='<form id="cl-vf" class="cl-form" style="margin-top:12px">'
        +(vc&&vc.status==='WITHDRAWN'?'<p class="cl-sub">You withdrew consent on '+dt(vc.withdrawn_at)+'. No identity data is stored.</p>':'')
        +'<label style="display:flex;flex-direction:row;align-items:flex-start;gap:8px"><input type="checkbox" name="accept" style="width:auto;margin-top:4px"/> <span>I consent to SRCHN requesting identity verification via DigiLocker for the purpose described above. I understand I can withdraw this consent at any time.</span></label>'
        +'<button class="br-btn br-btn-primary" type="submit">GIVE CONSENT AND CONTINUE</button><p class="cl-msg" id="cl-vf-msg"></p></form>';
    }
    h+='<p style="margin-top:22px"><button class="br-btn br-btn-ghost" id="clm-out">SIGN OUT</button></p>';
    clm.innerHTML=h;
    (function(){const box=clm.querySelector('#clm-demorcpts');if(!box)return;let rs=[];try{rs=JSON.parse(localStorage.getItem('srchn_pay_receipts')||'[]')}catch(e){}
      if(!rs.length)return;
      box.innerHTML='<h2 class="cl-h">Demo receipts (this device)</h2><div class="cl-bks">'+rs.map(r=>'<div class="cl-bk"><div class="cl-bk-top"><b>'+esc(r.ref)+'</b><span class="cl-pill">DEMO</span></div><p class="cl-bk-name">'+esc(r.brand)+'</p><p class="cl-sub">'+inr(r.amount)+' \u00b7 '+esc(({upi:'UPI',card:'Card',wallet:'SRCHN Wallet'})[r.method]||r.method)+(r.booking?' \u00b7 booking '+esc(r.booking):'')+' \u00b7 '+dt(r.ts)+'</p><p class="cl-sub">Demo only - no charge was made and no server record exists.</p></div>').join('')+'</div><p style="margin-top:8px"><button class="br-btn br-btn-ghost cl-mini" id="clm-clrrcpts">Clear demo receipts</button></p>';
      box.querySelector('#clm-clrrcpts').onclick=()=>{try{localStorage.removeItem('srchn_pay_receipts')}catch(e){}box.innerHTML=''};
    })();
    const ensureDemo=cb=>{if(window.SRCHN_DEMO)return cb(window.SRCHN_DEMO);const sc=document.createElement('script');sc.src='/brands/club-demo.js';sc.onload=()=>cb(window.SRCHN_DEMO);document.body.appendChild(sc)};
    clm.querySelectorAll('[data-dp]').forEach(x=>x.onclick=()=>ensureDemo(D=>D.pay({amount:+x.dataset.amt,brand:x.dataset.brand,booking:x.dataset.dp})));
    clm.querySelectorAll('[data-dv]').forEach(x=>x.onclick=()=>ensureDemo(D=>D[x.dataset.dv==='face'?'face':'digilocker']()));
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
    clm.querySelectorAll('[data-pf]').forEach(x=>x.onclick=()=>{if(!confirm('Preview mock: mark the booking fee as paid? No real charge is made.'))return;x.disabled=true;api('/club/api/mock-pay-fee',{json:{booking_no:x.dataset.pf}}).then(r=>{if(r.data&&r.data.ok)location.reload();else{alert((r.data&&r.data.error)||'Could not record the mock payment.');x.disabled=false}})});
    clm.querySelectorAll('[data-pb]').forEach(x=>x.onclick=()=>{const amt=parseInt(prompt('Preview mock bill payment - no real charge is made. Enter the bill amount in Rs:','850'));if(!amt||amt<1)return;x.disabled=true;api('/club/api/mock-pay-bill',{json:{booking_no:x.dataset.pb,bill_inr:amt}}).then(r=>{if(r.data&&r.data.ok)location.reload();else{alert((r.data&&r.data.error)||'Could not record the mock bill payment.');x.disabled=false}})});
    clm.querySelectorAll('[data-cx]').forEach(x=>x.onclick=()=>{if(!confirm('Cancel booking '+x.dataset.cx+'?'))return;x.disabled=true;api('/club/api/cancel-booking',{json:{booking_no:x.dataset.cx}}).then(r=>{if(r.data&&r.data.ok)location.reload();else{alert((r.data&&r.data.error)||'Could not cancel.');x.disabled=false}})});
    const vff=$('cl-vf');
    if(vff)vff.onsubmit=e=>{e.preventDefault();if(!vff.accept.checked){$('cl-vf-msg').textContent='Please tick the consent box to continue.';return}const b=vff.querySelector('button[type=submit]');b.disabled=true;$('cl-vf-msg').textContent='Recording consent...';api('/club/api/verification-consent',{json:{accept:true}}).then(r=>{const d=r.data||{};if(d.ok)location.reload();else{$('cl-vf-msg').textContent=d.error||'Could not record consent.';b.disabled=false}}).catch(()=>{$('cl-vf-msg').textContent='Network error. Please try again.';b.disabled=false})};
    const vfw=$('cl-vf-withdraw');
    if(vfw)vfw.onclick=()=>{if(!confirm('Withdraw your identity-verification consent? Your verification record will be closed and no identity data is stored.'))return;vfw.disabled=true;api('/club/api/verification-withdraw',{json:{}}).then(r=>{if(r.data&&r.data.ok)location.reload();else{alert((r.data&&r.data.error)||'Could not withdraw.');vfw.disabled=false}})};
  }).catch(()=>{clm.innerHTML='<p class="br-empty">Could not load your membership. Please try again.</p>'});
}
})();
