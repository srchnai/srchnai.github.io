(function(){
  var KEY='srchn-mylist.v1';
  function read(){try{var v=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(v)?v:[]}catch(e){return[]}}
  var b=document.querySelector('[data-save]');
  if(b){var pid=b.getAttribute('data-save');
    var paint=function(){var on=read().indexOf(pid)>-1;b.setAttribute('aria-pressed',on?'true':'false');b.textContent=on?'\u2665 Saved to My List':'\u2661 Save place'};
    b.addEventListener('click',function(){var c=read(),i=c.indexOf(pid);if(i>-1)c.splice(i,1);else c.push(pid);try{localStorage.setItem(KEY,JSON.stringify(c))}catch(e){}paint()});paint();}
  var s=document.querySelector('[data-share]');
  if(s){s.addEventListener('click',function(){var u=location.href.split('#')[0],t=s.getAttribute('data-share');
    if(navigator.share){navigator.share({title:t,url:u}).catch(function(){})}
    else if(navigator.clipboard){navigator.clipboard.writeText(u).then(function(){s.textContent='Link copied'},function(){s.textContent=u})}
    else{s.textContent=u}})}
  var f=document.querySelector('.ph-img');
  if(f){f.addEventListener('error',function(){var w=f.parentNode;w.classList.add('ph-missing');f.remove()})}
})();
