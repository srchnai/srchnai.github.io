(function(){'use strict';
const f=document.getElementById('pt-evt-f');if(!f)return;
f.onsubmit=e=>{e.preventDefault();const b=f.querySelector('button');const m=document.getElementById('pt-evt-msg');b.disabled=true;m.textContent='Sending...';
const o={};new FormData(f).forEach((v,k)=>o[k]=v);
fetch('/parties/api/events/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(o)}).then(r=>r.json().then(d=>{m.textContent=d.message||d.error||'Something went wrong.';if(d.ok)f.reset();b.disabled=false})).catch(()=>{m.textContent='Network error. Please try again.';b.disabled=false})};
})();
