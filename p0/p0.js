/* SRCHN homepage preview P0 shim (plain JS, no dependencies). Preview only.
   1. Google Analytics and the /e event call run only after an explicit yes. DNT / GPC = no.
   2. Floating Ask button stays hidden on small screens until the visitor scrolls, so it never covers the first-screen actions.
   3. Device-only note for saved places and an analytics settings control. */
(function () {
  'use strict';
  var KEY = 'srchn-consent.v1', GA = 'G-PYG52RY07Q', root = document.documentElement;
  function stored() { try { var v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v && typeof v.analytics === 'boolean' ? v.analytics : null; } catch (e) { return null; } }
  function save(v) { try { localStorage.setItem(KEY, JSON.stringify({ analytics: v, at: new Date().toISOString() })); } catch (e) {} }
  var signal = navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.globalPrivacyControl === true;
  function allowed() { return !signal && stored() === true; }
  // Block the event beacon until consent.
  var realFetch = window.fetch;
  window.fetch = function (input, init) {
    try {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      if (/srchn-api\.gireeshchalla\.workers\.dev\/e(\?|$)/.test(url)) return Promise.resolve(new Response(null, { status: 204 }));
    } catch (e) {}
    return realFetch.apply(this, arguments);
  };
  if (navigator.sendBeacon) {
    var rb = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function (u) { if (/srchn-api\.gireeshchalla\.workers\.dev\/e(\?|$)/.test(String(u))) return true; return rb.apply(null, arguments); };
  }
  var gaOn = false;
  function loadGA() {
    if (gaOn || !allowed()) return; gaOn = true;
    // Preview: transport is stubbed. Consent state and UI work, but nothing is ever sent to Google or the production measurement property.
    window.dataLayer = window.dataLayer || []; window.gtag = function () { window.dataLayer.push(arguments); };
    window.__p0_ga = 'stubbed-in-preview'; window.gtag('js', new Date()); window.gtag('config', GA);
  }
  var bar;
  function closeBar() { if (bar) { bar.remove(); bar = null; } root.classList.remove('p0-banner'); }
  function choose(v) { save(v); closeBar(); if (v) loadGA(); }
  function openBar() {
    if (bar) return;
    bar = document.createElement('div'); bar.className = 'p0-consent'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Analytics choice');
    bar.innerHTML = '<p>Optional: allow Google Analytics to count visits. No analytics data is sent unless you say yes. <a href="/legal/">Privacy</a></p><div class="p0-row"><button type="button" class="p0-yes">Allow analytics</button><button type="button" class="p0-no">No thanks</button></div>';
    bar.querySelector('.p0-yes').onclick = function () { choose(true); };
    bar.querySelector('.p0-no').onclick = function () { choose(false); };
    document.body.appendChild(bar); root.classList.add('p0-banner'); root.style.setProperty('--p0-bh', (bar.offsetHeight + 20) + 'px');
  }
  function foot() {
    var f = document.createElement('div'); f.className = 'p0-foot';
    f.innerHTML = '<span>Saved places stay on this device only. They are not synced to an account.</span><br><a href="/feed/" style="display:inline-block;min-height:44px;line-height:44px">Visual feed (preview)</a> · <a href="/studio/" style="display:inline-block;min-height:44px;line-height:44px">Creator studio (preview)</a> · <a href="/bangalore/" style="display:inline-block;min-height:44px;line-height:44px">Your Local Buddy</a><br><span id="p0-state"></span><button type="button">Analytics settings</button>';
    f.querySelector('button').onclick = openBar;
    document.body.appendChild(f);
    var st = f.querySelector('#p0-state'); st.textContent = signal ? 'Analytics is off (your browser sends Do Not Track or Global Privacy Control).' : '';
  }
  // Floating button: show after scroll on small screens.
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () { root.classList.toggle('p0-show', window.scrollY > 240); ticking = false; });
  }, { passive: true });
  function ready() {
    foot();
    if (!signal && stored() === null) openBar();
    loadGA();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();
})();

/* Preview: visual feed strip on the homepage (real Commons media, attributed). */
(function(){
  var done=false;
  function build(items){
    var s=document.createElement('section');s.id='p0-feed';s.setAttribute('aria-labelledby','p0-feed-h');s.setAttribute('data-p0','1');
    var h=document.createElement('h2');h.id='p0-feed-h';h.textContent='Discover Bengaluru';s.appendChild(h);
    var row=document.createElement('div');row.className='p0-strip';row.setAttribute('role','list');
    items.forEach(function(it){
      var a=document.createElement('a');a.className='p0-fc';a.href='/feed/#'+it.id;a.setAttribute('role','listitem');
      var im=document.createElement('img');im.src='/feed/'+it.img;im.width=it.w;im.height=it.h;im.loading='lazy';im.decoding='async';im.alt=it.title+', '+it.locality+' ('+it.taken+')';
      var t=document.createElement('b');t.textContent=it.title;
      var l=document.createElement('span');l.textContent=it.locality+' · '+it.category;
      var n=document.createElement('span');n.className='p0-nt';n.textContent=it.note;
      var c=document.createElement('span');c.className='p0-cr';c.textContent='Photo, '+it.taken+' · '+it.creator+' · '+it.licence;
      a.append(im,t,l,n,c);row.appendChild(a);
    });
    var cats=['Live','Work','Eat','Drink','Play','Shop','Travel','Events','Movies','Community'];
    var nav=document.createElement('nav');nav.className='p0-cats';nav.setAttribute('aria-label','10 discovery categories');
    cats.forEach(function(c){var l=document.createElement('a');l.href='/feed/?c='+encodeURIComponent(c);l.textContent=c;nav.appendChild(l)});
    s.appendChild(nav);s.appendChild(row);
    var m=document.createElement('p');m.className='p0-more';var a2=document.createElement('a');a2.href='/feed/';a2.textContent='See all, by category';m.appendChild(a2);
    m.appendChild(document.createTextNode(' · Openly licensed Wikimedia Commons photos, resized. Not listings.'));s.appendChild(m);return s;
  }
  function tryInsert(items){
    var hero=document.querySelector('section.hero');
    if(!hero||document.querySelector('[data-p0]'))return !!document.querySelector('[data-p0]');
    var old=document.getElementById('feed');if(old){old.id='feed-legacy';old.hidden=true;old.style.display='none';old.setAttribute('aria-hidden','true');}var sec=build(items);sec.id='feed';hero.insertAdjacentElement('afterend',sec);return true;
  }
  function start(){
    fetch('/feed/media.json').then(function(r){return r.json()}).then(function(items){
      var mo=new MutationObserver(function(){tryInsert(items)});
      mo.observe(document.documentElement,{childList:true,subtree:true});tryInsert(items);
      setTimeout(function(){mo.disconnect()},20000);
    }).catch(function(){});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();

/* Preview: stock photos are not shipped (no rights record). Use SRCHN's own category illustration, or hide. */
document.addEventListener('error',function(e){
  var t=e.target;if(!t||t.tagName!=='IMG'||t.dataset.p0fb)return;
  var m=/\/stock\/([a-z-]+?)-\d+\.webp/.exec(t.src||'');if(!m)return;
  t.dataset.p0fb='1';t.src='/ph/'+m[1]+'.svg';t.alt='Illustration, not a photo of a venue';
},true);

/* Preview: venue pages are not copied into this preview; links go to the live srchn.in venue page. */
(function(){function fix(){document.querySelectorAll('a[href^="/place/"]').forEach(function(a){a.setAttribute('href','https://srchn.in'+a.getAttribute('href'))});}
 new MutationObserver(fix).observe(document.documentElement,{childList:true,subtree:true});fix();})();

/* Preview: editorial layer (original SRCHN structure; no third-party text, images or code). */
(function(){
  function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
  function lk(h,x,c){var a=el('a',c,x);a.href=h;return a}
  var COLL=[['Cafes','cafes'],['Restaurants','restaurants'],['Bars, pubs and breweries','bars-pubs'],['Coworking spaces','coworking'],['Hotels, hostels and guest houses','stays'],['Parks','parks'],['Cinemas','cinemas'],['Event spaces','event-spaces'],['Community spaces','community-spaces'],['Malls','malls'],['Attractions','attractions']];
  var NB=[];
  function hero(img){var s=el('section','p0-hero');s.setAttribute('aria-label','SRCHN');s.setAttribute('data-p0e','1');
    var tx=el('div','p0-ht');var lg=lk('/','','p0-logo');lg.setAttribute('aria-label','SRCHN home');var w=el('span','p0-lgw');var im=document.createElement('img');im.src='/srchn-logo.jpg';im.alt='SRCHN';im.width=1254;im.height=1254;w.append(im);lg.append(w);
    tx.append(lg,el('p','p0-eb','BENGALURU'),el('h1',null,'See Bengaluru before you go.'),el('p','p0-lead','SRCHN helps people discover places, spaces and experiences through real visuals and local context.'));
    var r=el('div','p0-cta');r.append(lk('#feed','Explore Bengaluru','p0-b1'),lk('/bangalore/','Open Your Local Buddy','p0-b2'));tx.append(r);
    var q=el('p','p0-quick');[['Neighbourhoods','#p0-nb'],['Events','/feed/?c=Events'],['For Brands','#p0-brands'],['For Creators','/studio/']].forEach(function(x,i){if(i)q.append(document.createTextNode(' · '));q.append(lk(x[1],x[0]))});tx.append(q);s.append(tx);
    if(img){var f=el('figure','p0-fig');var pi=document.createElement('img');pi.src='/feed/'+img.img;pi.width=img.w;pi.height=img.h;pi.alt=img.title+', '+img.locality+' ('+img.taken+')';pi.decoding='async';var c=el('figcaption',null,'Photo, '+img.taken+' · ');var a=lk(img.source,img.creator||'Unknown author');a.target='_blank';a.rel='noopener';c.append(a,document.createTextNode(' · '+img.licence+' via Wikimedia Commons. '+img.note+'.'));f.append(pi,c);s.append(f)}
    return s}
  function topnav(){var n=el('nav','p0-top');n.setAttribute('aria-label','Main');[['Explore','#feed'],['Neighbourhoods','#p0-nb'],['Categories','/open/'],['Events','/feed/?c=Events'],['Your Local Buddy','/bangalore/'],['For Brands','#p0-brands'],['For Creators','/studio/']].forEach(function(x){n.append(lk(x[1],x[0]))});return n}
  function sec(id,h,intro){var s=el('section','p0-sec');s.id=id;s.setAttribute('aria-labelledby',id+'-h');s.setAttribute('data-p0e','1');var t=el('h2',null,h);t.id=id+'-h';s.append(t);if(intro)s.append(el('p','p0-intro',intro));return s}
  function rest(){var f=document.createDocumentFragment();
    var c=sec('p0-coll','Open-data lists','Lists built only from OpenStreetMap features (ODbL, \u00a9 OpenStreetMap contributors), snapshot fetched 27 and 28 October 2026. Names and map points only: hours, fees and current operation are not verified, and the lists are not rankings.');
    var g=el('div','p0-grid');COLL.forEach(function(x){var a=lk('/open/'+x[1]+'/',x[0],'p0-tile');a.append(el('span',null,'OpenStreetMap features, ODbL. Names and map points only.'));g.append(a)});c.append(g);
    c.append(el('p','p0-nt','Homes and rentals, shops, brands, events and weekend escapes are not covered by these lists. Editorial collections will be published only when sourced data supports them.'));f.append(c);
    var n=sec('p0-nb','Neighbourhoods','Your Local Buddy has an area selector for 15 Bengaluru areas (approximate 2.5 km radius around a point, not a boundary). Ambience, transport and safety notes are not published until they can be sourced.');
    var rr=el('div','p0-cta');rr.append(lk('/bangalore/','Pick an area in Your Local Buddy','p0-b1'));n.append(rr);f.append(n);
    var ai=sec('p0-ai','Your Local Buddy','Ask in your own words, pick an area, and get matches with the evidence behind each one. It shows what the data says and what it cannot check, and never invents events, prices, hours or availability.');
    var r=el('div','p0-cta');r.append(lk('/bangalore/','Open Your Local Buddy','p0-b1'),lk('/story/demo-lalbagh/','See a demo story','p0-b2'));ai.append(r);f.append(ai);
    var b=sec('p0-brands','For brands, spaces and creators','Businesses and local creators will be able to contribute authorised photos and short videos. In this preview nothing is submitted, billed or published.');
    var g3=el('div','p0-grid');
    [['For brands','Claim a presence, add approved media, review creator content before anything goes live. Proposed packages are labelled proposals. Proposed rule: onboarding and video editing are done in SRCHN Studio under an active subscription, and listings are reconfirmed every three years.','/studio/','See the brand flow (preview)'],['For creators','Invite-only until the programme runs. Permission from the business comes before any upload is published.','/studio/','See the creator studio (preview)']].forEach(function(x){var d=el('div','p0-tile p0-info');d.append(el('b',null,x[0]),el('span',null,x[1]),lk(x[2],x[3]));g3.append(d)});b.append(g3);f.append(b);
    var t=sec('p0-trust','Trust and corrections','What is shown, where it came from, and how to fix it.');
    var ul=el('ul','p0-list');['Every photo shows its creator and licence.','Content from brands and creators will be labelled by source and needs approval before publishing.','Report or takedown form: shown in the studio as planned, not yet operating.','Missing information stays blank rather than guessed.'].forEach(function(x){ul.append(el('li',null,x))});t.append(ul);t.append(lk('/studio/','See the planned report form'));f.append(t);
    var e=el('p','p0-close','See Bengaluru through the places, people and experiences that make the city what it is.');e.setAttribute('data-p0e','1');f.append(e);return f}
  function go(){var h=document.querySelector('section.hero'),feed=document.getElementById('feed');
    if(!h||!feed||!feed.getAttribute('data-p0'))return false;if(document.querySelector('.p0-hero'))return true;
    h.style.display='none';h.setAttribute('aria-hidden','true');h.insertAdjacentElement('beforebegin',hero(window.__p0_hero));feed.after(rest());return true}
  function start(){fetch('/feed/media.json').then(function(r){return r.json()}).then(function(m){window.__p0_hero=m.filter(function(i){return i.id==='sports'})[0]}).catch(function(){}).then(function(){var mo=new MutationObserver(function(){go()});mo.observe(document.documentElement,{childList:true,subtree:true});setTimeout(function(){mo.disconnect()},40000);go()})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();

/* Release-candidate rule: sections backed by legacy Google-derived data (rights unresolved) are removed from the page. */
(function(){var IDS=['discover','collections','hoods'];function rm(){IDS.forEach(function(i){var e=document.getElementById(i);if(e&&e.tagName==='SECTION'&&e.parentNode)e.parentNode.removeChild(e);});document.querySelectorAll('a[href="#discover"],a[href="#collections"],a[href="#hoods"]').forEach(function(a){var li=a.closest('li');(li||a).remove();});}
rm();new MutationObserver(rm).observe(document.documentElement,{childList:true,subtree:true});})();
