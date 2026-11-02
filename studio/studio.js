(function(){
const API='/studio/api';
const stu={
  token(){return localStorage.getItem('stu_token')||''},
  save(t,c){localStorage.setItem('stu_token',t);localStorage.setItem('stu_creator',JSON.stringify(c))},
  creator(){try{return JSON.parse(localStorage.getItem('stu_creator')||'null')}catch(e){return null}},
  clear(){localStorage.removeItem('stu_token');localStorage.removeItem('stu_creator')},
  async req(path,opts){
    opts=opts||{};opts.headers=opts.headers||{};
    if(opts.json!==undefined){opts.headers['Content-Type']='application/json';opts.body=JSON.stringify(opts.json)}
    const t=stu.token();if(t)opts.headers['Authorization']='Bearer '+t;
    const r=await fetch(API+path,opts);
    let d=null;try{d=await r.json()}catch(e){}
    if(r.status===401){stu.clear();if(!/join/.test(location.pathname)){location.href='/studio/join/';return null}}
    return {status:r.status,data:d};
  },
  esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))},
  err(el,m){el.textContent=m;el.style.display='block'},
  ok(el,m){el.textContent=m;el.style.display='block'}
};
window.stu=stu;
})();
