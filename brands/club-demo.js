/* SRCHN interface mockups - SRCHN PAY, DigiLocker verification, face verification.
   Pure client-side demos: no network calls, no storage, no camera capture, no real payments. */
(function(){
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const inr=n=>'Rs '+Number(n||0).toLocaleString('en-IN');
const DEMO_PILL='<span class="cd-pill">DEMO</span>';
let overlay=null,stream=null,timers=[];
function later(fn,ms){timers.push(setTimeout(fn,ms));}
function close(){
  if(stream){stream.getTracks().forEach(t=>t.stop());stream=null;}
  timers.forEach(clearTimeout);timers=[];
  if(overlay){overlay.remove();overlay=null;document.body.style.overflow='';}
}
function sheet(html,full){
  close();
  overlay=document.createElement('div');overlay.className='cd-overlay';
  overlay.innerHTML='<div class="'+(full?'cd-full':'cd-sheet')+'" role="dialog" aria-modal="true">'+html+'</div>';
  document.body.appendChild(overlay);document.body.style.overflow='hidden';
  overlay.addEventListener('click',e=>{if(e.target===overlay)close()});
  overlay.querySelectorAll('[data-cd-close]').forEach(b=>b.onclick=close);
  document.addEventListener('keydown',function k(e){if(e.key==='Escape'){close();document.removeEventListener('keydown',k)}});
  return overlay.firstChild;
}
function steps(n,total){let s='<div class="cd-steps">';for(let i=1;i<=total;i++)s+='<span class="cd-dot'+(i<n?' done':i===n?' now':'')+'"></span>';return s+'</div>';}
function head(title,sub){return '<div class="cd-top"><div><p class="cd-eyebrow">'+title+'</p></div>'+DEMO_PILL+'<button class="cd-x" data-cd-close aria-label="Close">&times;</button></div>'+(sub?'<p class="cd-sub2">'+sub+'</p>':'');}

/* ---------- SRCHN PAY demo ---------- */
function pay(opts){
  opts=opts||{};
  const amount=opts.amount||850,brand=opts.brand||'Demo Bistro - Indiranagar',refCtx=opts.booking||'';
  let method='upi';
  const fee=Math.round(amount*0.20),cb=Math.max(1,Math.round(fee*0.05));
  const ref='DEMO-PAY-'+Math.random().toString(36).slice(2,8).toUpperCase();
  function summary(){
    const el=sheet(head('SRCHN PAY','Interface mockup - no real payment is taken, nothing is charged.')
      +steps(1,4)
      +'<h3 class="cd-h">Confirm your payment</h3>'
      +'<div class="cd-receipt">'
      +'<div class="cd-row"><span>'+esc(brand)+'</span><b>'+inr(amount)+'</b></div>'
      +(refCtx?'<div class="cd-row cd-dim"><span>Booking</span><span>'+esc(refCtx)+'</span></div>':'')
      +'<div class="cd-row cd-dim"><span>SRCHN success fee (20% illustration)</span><span>'+inr(fee)+'</span></div>'
      +'<div class="cd-row cd-total"><span>You pay</span><b>'+inr(amount)+'</b></div>'
      +'</div>'
      +'<p class="cd-note">Eligible cashback illustration: <b>'+inr(cb)+'</b> (5% of the SRCHN fee) would move to pending after this payment. Cashback is on SRCHN&#39;s fee, never on your bill.</p>'
      +'<div class="cd-actions"><button class="br-btn br-btn-primary" id="cd-next">CONTINUE</button></div>');
    el.querySelector('#cd-next').onclick=methods;
  }
  function methods(){
    const opt=(id,t,s,ic)=>'<button class="cd-opt'+(method===id?' sel':'')+'" data-m="'+id+'"><span class="cd-ic">'+ic+'</span><span class="cd-opt-t"><b>'+t+'</b><span>'+s+'</span></span><span class="cd-radio"></span></button>';
    const el=sheet(head('SRCHN PAY','Interface mockup - no real payment is taken, nothing is charged.')
      +steps(2,4)
      +'<h3 class="cd-h">Choose a payment method</h3>'
      +'<div class="cd-opts">'
      +opt('upi','UPI','GPay, PhonePe, Paytm and any UPI app','<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#111" stroke-width="1.8"><path d="M7 3l10 9-4 1 4 8-10-9 4-1z"/></svg>')
      +opt('card','Card','Visa, Mastercard, RuPay - credit or debit','<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#111" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/></svg>')
      +opt('wallet','SRCHN Wallet','Balance and eligible cashback','<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#111" stroke-width="1.8"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 15h2"/></svg>')
      +'</div>'
      +'<div class="cd-actions"><button class="br-btn br-btn-ghost" id="cd-back">BACK</button><button class="br-btn br-btn-primary" id="cd-pay">PAY '+inr(amount)+' &middot; DEMO</button></div>'
      +'<p class="cd-note">In the real flow this button opens your chosen payment app or a secure card page. This demo goes nowhere and stores nothing.</p>');
    el.querySelectorAll('.cd-opt').forEach(o=>o.onclick=()=>{method=o.dataset.m;el.querySelectorAll('.cd-opt').forEach(x=>x.classList.toggle('sel',x===o));});
    el.querySelector('#cd-back').onclick=summary;
    el.querySelector('#cd-pay').onclick=processing;
  }
  function processing(){
    const el=sheet(head('SRCHN PAY','Interface mockup - no real payment is taken, nothing is charged.')
      +steps(3,4)
      +'<h3 class="cd-h">Processing</h3>'
      +'<div class="cd-proc"><span class="cd-spinner"></span><p id="cd-proc-msg" class="cd-proc-msg">Contacting your bank...</p></div>');
    const msgs=['Contacting your bank...','Confirming the payment...','Recording the receipt...'];
    msgs.forEach((m,i)=>later(()=>{const p=el.querySelector('#cd-proc-msg');if(p)p.textContent=m;},i*750));
    later(success,msgs.length*750+350);
  }
  function success(){
    const el=sheet(head('SRCHN PAY','Interface mockup - no real payment is taken, nothing is charged.')
      +steps(4,4)
      +'<div class="cd-done"><span class="cd-check"><svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="#fff" stroke-width="3"><path d="M4 12.5l5 5L20 6.5"/></svg></span>'
      +'<h3 class="cd-h" style="text-align:center">Payment successful &middot; Demo</h3></div>'
      +'<div class="cd-receipt">'
      +'<div class="cd-row"><span>Amount</span><b>'+inr(amount)+'</b></div>'
      +'<div class="cd-row"><span>Method</span><span>'+({upi:'UPI',card:'Card',wallet:'SRCHN Wallet'})[method]+'</span></div>'
      +'<div class="cd-row"><span>Reference</span><span>'+ref+'</span></div>'
      +'<div class="cd-row"><span>Status</span><span><b>DEMO - no charge made</b></span></div>'
      +'<div class="cd-row cd-dim"><span>Cashback</span><span>'+inr(cb)+' pending (illustration)</span></div>'
      +'</div>'
      +'<p class="cd-note">This demo did not charge anything, did not contact any bank, and did not change any booking, payment or ledger record. SRCHN PAY is configuration-required and currently disabled.</p>'
      +'<div class="cd-actions"><button class="br-btn br-btn-primary" data-cd-close>DONE</button></div>');
  }
  summary();
}

/* ---------- DigiLocker (Aadhaar) verification demo ---------- */
function digilocker(){
  function consent(){
    const el=sheet(head('IDENTITY VERIFICATION','Interface mockup - no real verification runs and no data leaves your device.')
      +steps(1,4)
      +'<h3 class="cd-h">Verify with DigiLocker</h3>'
      +'<p class="cd-body">SRCHN would verify your <b>name and date of birth</b> from a document you choose and share in the official DigiLocker flow. SRCHN never sees or stores your DigiLocker password or OTP and never collects your Aadhaar number.</p>'
      +'<label class="cd-consent"><input type="checkbox" id="cd-c"/> <span>I consent to SRCHN requesting identity verification via DigiLocker. I can withdraw consent at any time.</span></label>'
      +'<div class="cd-actions"><button class="br-btn br-btn-primary" id="cd-go">CONTINUE &middot; DEMO</button></div>'
      +'<p class="cd-note">DigiLocker is a Government of India platform. SRCHN is not affiliated with, or endorsed by, DigiLocker, UIDAI or DigiYatra.</p>');
    el.querySelector('#cd-go').onclick=()=>{if(!el.querySelector('#cd-c').checked){el.querySelector('#cd-go').classList.add('cd-shake');setTimeout(()=>el.querySelector('#cd-go').classList.remove('cd-shake'),500);return;}handoff();};
  }
  function handoff(){
    const el=sheet(head('IDENTITY VERIFICATION','Interface mockup - no real verification runs and no data leaves your device.')
      +steps(2,4)
      +'<h3 class="cd-h">Secure handoff to DigiLocker</h3>'
      +'<div class="cd-handoff"><div class="cd-ho-box"><b>SRCHN</b><span>verification request</span></div><div class="cd-ho-arrow" id="cd-ho-a">&#8594;</div><div class="cd-ho-box"><b>DigiLocker</b><span>you choose the document</span></div></div>'
      +'<div class="cd-proc"><span class="cd-spinner"></span><p id="cd-ho-msg" class="cd-proc-msg">Opening the official DigiLocker share flow...</p></div>');
    const msgs=['Opening the official DigiLocker share flow...','You pick the document to share...','DigiLocker confirms your consent...'];
    msgs.forEach((m,i)=>later(()=>{const p=el.querySelector('#cd-ho-msg');if(p)p.textContent=m;},i*850));
    later(otp,msgs.length*850+400);
  }
  function otp(){
    const el=sheet(head('IDENTITY VERIFICATION','Interface mockup - no real verification runs and no data leaves your device.')
      +steps(3,4)
      +'<h3 class="cd-h">Aadhaar OTP</h3>'
      +'<p class="cd-body">In the real flow, UIDAI sends a one-time code to the Aadhaar-linked mobile. This demo sends nothing and needs no code - the boxes fill themselves.</p>'
      +'<div class="cd-otp">'+Array.from({length:6},(_,i)=>'<span class="cd-otp-b" id="cd-o'+i+'"></span>').join('')+'</div>'
      +'<p class="cd-proc-msg" id="cd-otp-msg">Waiting for OTP...</p>');
    const code='274915';
    for(let i=0;i<6;i++)later(()=>{const b=el.querySelector('#cd-o'+i);if(b){b.textContent=code[i];b.classList.add('on')}const m=el.querySelector('#cd-otp-msg');if(m)m.textContent='Verifying code...';},600+i*420);
    later(verified,600+6*420+500);
  }
  function verified(){
    const el=sheet(head('IDENTITY VERIFICATION','Interface mockup - no real verification runs and no data leaves your device.')
      +steps(4,4)
      +'<div class="cd-done"><span class="cd-check"><svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="#fff" stroke-width="3"><path d="M4 12.5l5 5L20 6.5"/></svg></span>'
      +'<h3 class="cd-h" style="text-align:center">Identity verified &middot; Demo</h3></div>'
      +'<div class="cd-idcard"><div class="cd-id-top"><span class="cd-id-photo"><svg viewBox="0 0 24 24" width="30" height="30" fill="#9a9a9a"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z"/></svg></span><div><b>Aarav Sharma</b><span class="cd-id-sub">Fictional demo profile</span></div><span class="cd-pill">VERIFIED</span></div>'
      +'<div class="cd-row"><span>Date of birth</span><span>1 January 1990</span></div>'
      +'<div class="cd-row"><span>Aadhaar</span><span>XXXX XXXX 1234</span></div>'
      +'<div class="cd-row"><span>Source</span><span>DigiLocker &middot; Aadhaar (demo)</span></div></div>'
      +'<p class="cd-note">What SRCHN would store: only the verification result and an audit reference - never the document, OTP, or full Aadhaar number. This demo used a fictional profile and stored nothing.</p>'
      +'<div class="cd-actions"><button class="br-btn br-btn-primary" data-cd-close>DONE</button></div>');
  }
  consent();
}

/* ---------- Face verification demo (Bumble-style) ---------- */
function face(){
  const el=sheet(
    '<div class="cd-top dark"><p class="cd-eyebrow" style="color:#fff">FACE VERIFICATION</p>'+DEMO_PILL+'<button class="cd-x dark" data-cd-close aria-label="Close">&times;</button></div>'
    +'<p class="cd-sub2" style="color:#bdbdbd">Interface mockup - no photo or video is captured, stored or uploaded. No real face matching runs.</p>'
    +'<div class="cd-stage"><video id="cd-cam" class="cd-cam" autoplay playsinline muted hidden></video><div class="cd-sim" id="cd-sim"><span class="cd-face-svg"><svg viewBox="0 0 24 24" width="86" height="86" fill="#3d3d3d"><circle cx="12" cy="8" r="4.2"/><path d="M3.5 21.5c0-5 3.8-7.6 8.5-7.6s8.5 2.6 8.5 7.6z"/></svg></span><span class="cd-scan"></span></div>'
    +'<div class="cd-oval"></div></div>'
    +'<div class="cd-ring-wrap"><svg class="cd-ring" viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" fill="none" stroke="#333" stroke-width="3"/><circle id="cd-prog" cx="20" cy="20" r="17" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="107" stroke-dashoffset="107" stroke-linecap="round" transform="rotate(-90 20 20)"/></svg><p class="cd-prompt" id="cd-prompt">Center your face in the oval</p></div>'
    +'<p class="cd-note" style="color:#8a8a8a">DigiYatra-style experience. SRCHN is not affiliated with, or endorsed by, DigiYatra.</p>',true);
  const vid=el.querySelector('#cd-cam'),sim=el.querySelector('#cd-sim');
  if(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia){
    navigator.mediaDevices.getUserMedia({video:{facingMode:'user'},audio:false}).then(s=>{
      if(!overlay){s.getTracks().forEach(t=>t.stop());return;}
      stream=s;vid.srcObject=s;vid.hidden=false;sim.style.display='none';
    }).catch(()=>{/* simulated view stays */});
  }
  const prompts=['Center your face in the oval','Slowly turn your head left','Now turn right','Look straight and blink'];
  const prog=el.querySelector('#cd-prog'),pr=el.querySelector('#cd-prompt');
  prompts.forEach((p,i)=>{
    later(()=>{pr.textContent=p;prog.style.transition='stroke-dashoffset 1.6s linear';prog.style.strokeDashoffset=String(107-(107*(i+1)/(prompts.length+1)));},i*1700);
  });
  later(()=>{pr.textContent='Matching with your verification photo...';prog.style.strokeDashoffset='8';},prompts.length*1700);
  later(()=>{
    if(!overlay)return;
    el.querySelector('.cd-stage').innerHTML='<div class="cd-done" style="margin:90px 0"><span class="cd-check big"><svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="#fff" stroke-width="3"><path d="M4 12.5l5 5L20 6.5"/></svg></span></div>';
    pr.textContent='Face verified - Demo';
    prog.style.strokeDashoffset='0';
    if(stream){stream.getTracks().forEach(t=>t.stop());stream=null;}
    const foot=document.createElement('div');foot.className='cd-actions';foot.innerHTML='<button class="br-btn br-btn-primary" data-cd-close>DONE</button>';
    el.appendChild(foot);foot.querySelector('button').onclick=close;
  },prompts.length*1700+2200);
}

window.SRCHN_DEMO={pay,digilocker,face,close};
function bind(root){
  (root||document).querySelectorAll('[data-demo-open]').forEach(b=>{
    if(b._cd)return;b._cd=1;
    b.addEventListener('click',e=>{e.preventDefault();const k=b.dataset.demoOpen;
      if(k==='pay')pay({amount:+(b.dataset.amt||0)||undefined,brand:b.dataset.brand,booking:b.dataset.booking});
      else if(k==='digilocker')digilocker();
      else if(k==='face')face();});
  });
}
bind(document);
if(location.hash==='#pay')pay();else if(location.hash==='#digilocker')digilocker();else if(location.hash==='#face')face();
})();
