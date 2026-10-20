/* SRCHN city chat widget v10 - preview only (/preview/, noindex). White-first pastel theme.
   Self-contained: no keys in the browser. Calls the SRCHN Worker API.
   Load with: <script src="widget.js" defer></script> on the preview page. */
(function () {
  'use strict';

  var API_URL = '/api/chat'; // same-origin via Cloudflare route on srchn.in
  var TURNSTILE_SITEKEY = '0x4AAAAAAFb1xd3vvqDeAQMZ';
  var PREVIEW_BASE = 'https://srchn.in/preview/';

  /* studio condenser mic - inline SVG, decorative (buttons carry text labels) */
  var ICON_IMG = '<img src="' + PREVIEW_BASE + 'voice/srchn-voice.svg?v=2" alt="" width="22" height="22" style="display:block">';
  var MIC_SVG = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" '
    + 'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" style="flex:0 0 auto">'
    + '<rect x="8.5" y="2.5" width="7" height="11" rx="3.5"/>'
    + '<line x1="8.5" y1="6" x2="15.5" y2="6"/>'
    + '<line x1="8.5" y1="9" x2="15.5" y2="9"/>'
    + '<path d="M5.5 10.5v1a6.5 6.5 0 0 0 13 0v-1"/>'
    + '<line x1="12" y1="18" x2="12" y2="21.5"/>'
    + '<line x1="8" y1="21.5" x2="16" y2="21.5"/>'
    + '</svg>';

  var sessionId = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
  var coords = null;            // {lat, lng} only after explicit opt-in; never stored or sent elsewhere
  var tsWidgetId = null;
  var tsToken = null;
  var sending = false;

  /* ---------- styles ---------- */
  var css = ''
    + '@keyframes srchn-pulse{0%,100%{box-shadow:0 6px 22px rgba(248,0,80,.28),0 0 0 0 rgba(248,0,80,.3)}'
    + '50%{box-shadow:0 6px 22px rgba(248,0,80,.34),0 0 0 12px rgba(248,0,80,0)}}'
    + '#srchn-chat-btn{position:fixed;right:20px;bottom:20px;z-index:99990;border:1px solid #E6004A;border-radius:999px;display:inline-flex;align-items:center;gap:7px;'
    + 'padding:11px 20px 11px 14px;background:#E6004A;color:#fff;font:600 14px/1 system-ui,sans-serif;cursor:pointer;'
    + 'box-shadow:0 6px 22px rgba(248,0,80,.28);animation:srchn-pulse 3s ease-in-out infinite;transition:filter .15s}'
    + '#srchn-chat-btn:hover{filter:saturate(1.15)}'
    + '@media (prefers-reduced-motion: reduce){#srchn-chat-btn{animation:none}}'
    + '#srchn-chat-panel{position:fixed;right:20px;bottom:76px;z-index:99991;width:min(380px,calc(100vw - 32px));'
    + 'height:min(560px,calc(100vh - 110px));display:none;flex-direction:column;background:#fff;color:#1c1c24;'
    + 'border:1px solid #e7e4ef;border-radius:14px;overflow:hidden;font:14px/1.45 system-ui,sans-serif;'
    + 'box-shadow:0 14px 44px rgba(70,60,110,.16)}'
    + '#srchn-chat-panel.open{display:flex}'
    + '.srchn-head{padding:12px 14px;border-bottom:1px solid #efedf5;display:flex;justify-content:space-between;align-items:center}'
    + '.srchn-head b{font-size:14px}.srchn-head button{background:none;border:0;color:#9a9aa6;font-size:18px;cursor:pointer}'
    + '.srchn-ht{display:flex;align-items:center;gap:6px;color:#E6004A}'
    + '.srchn-ht b{color:#1c1c24}'
    + '.srchn-head span{display:block;font-size:11px;color:#8f8f9a;font-weight:400;margin-top:2px}'
    + '#srchn-body{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:10px}'
    + '.msg{max-width:88%;padding:9px 12px;border-radius:12px;white-space:pre-wrap;word-break:break-word}'
    + '.msg.user{align-self:flex-end;background:#fff1f6;color:#17151a;border:1px solid #ffd9e6;border-bottom-right-radius:4px}'
    + '.msg.bot{align-self:flex-start;background:#f6f6f9;border:1px solid #e9e9f0;color:#1c1c24;border-bottom-left-radius:4px}'
    + '.msg.note{align-self:center;background:none;color:#9a9aa3;font-size:12px;text-align:center;padding:2px}'
    + '.place{align-self:stretch;background:#fbfbff;border:1px solid #e9e7f2;border-radius:10px;padding:10px 12px;color:#1c1c24}'
    + '.place .nm{font-weight:600}.place .lc{color:#7d7d88;font-size:12px;font-weight:400}'
    + '.place .acts{margin-top:8px;display:flex;flex-wrap:wrap;gap:6px}'
    + '.place a{color:#C4003F;text-decoration:none;font-size:13px;border:1px solid #ffd0e0;border-radius:8px;padding:5px 9px}'
    + '.place a:hover{background:#fff1f6}'
    + '.vids a{display:block;color:#C4003F;font-size:13px;margin:4px 0}'
    + 'iframe.sugg{align-self:stretch;width:100%;border:0;height:52px;background:transparent}'
    + '.foot{border-top:1px solid #efedf5;padding:10px}'
    + '.foot .row{display:flex;gap:8px}'
    + '#srchn-in{flex:1;background:#fcfcfe;border:1px solid #ddddea;color:#1c1c24;border-radius:10px;'
    + 'padding:10px;font:14px system-ui,sans-serif;outline:none;resize:none;min-height:20px;max-height:90px}'
    + '#srchn-send{background:#E6004A;border:0;color:#fff;border-radius:10px;padding:0 16px;cursor:pointer;font-weight:600}'
    + '#srchn-send:disabled{opacity:.5;cursor:default}'
    + '.loc-row{display:flex;align-items:center;gap:8px;margin-top:8px}'
    + '#srchn-loc{background:none;border:1px solid #ddddea;color:#8a8a95;border-radius:8px;font-size:12px;padding:4px 9px;cursor:pointer}'
    + '#srchn-loc.on{color:#3f9d63;border-color:#bfe3cd}'
    + '.loc-note{font-size:11px;color:#a6a6ae}'
    + '#srchn-mic{background:#fff;border:1px solid #e8e6ec;color:#17151a;border-radius:10px;padding:0 10px;cursor:pointer}#srchn-mic.on{background:#E6004A;color:#fff;border-color:#E6004A}'
    + '#srchn-mic[hidden],#srchn-tts-l[hidden]{display:none}#srchn-tts-l{display:block;margin-top:6px}'
    + '#cf-slot{margin-top:8px;min-height:0}';

  /* ---------- dom ---------- */
  var style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
  var btn = document.createElement('button'); btn.id = 'srchn-chat-btn'; btn.setAttribute('aria-label', 'Ask SRCHN: open SRCHN Voice');
  btn.innerHTML = '<span style="background:#fff;border-radius:50%;width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center">' + ICON_IMG + '</span><span>Ask SRCHN</span>';
  var panel = document.createElement('div'); panel.id = 'srchn-chat-panel';
  panel.innerHTML =
    '<div class="srchn-head"><div><div class="srchn-ht">' + ICON_IMG + '<b>SRCHN Voice</b></div>' +
    '<span>Ask anything about Bangalore. Answers from SRCHN listings + AI knowledge. Not live data.</span></div>' +
    '<button aria-label="Close" id="srchn-x">&times;</button></div>' +
    '<div id="srchn-body"></div>' +
    '<div class="foot">' +
    '<div class="row"><textarea id="srchn-in" rows="1" maxlength="500" placeholder="Ask anything about Bangalore"></textarea>' +
    '<button id="srchn-mic" type="button" aria-label="Speak your question" title="Speak your question" hidden>' + MIC_SVG + '</button>' +
    '<button id="srchn-send">Send</button></div>' +
    '<label class="loc-note" id="srchn-tts-l" hidden><input type="checkbox" id="srchn-tts"> Read answers aloud</label>' +
    '<div class="loc-row"><button id="srchn-loc" type="button">Use my location</button>' +
    '<span class="loc-note">Optional. Used only for that answer, never stored.</span></div>' +
    '<div id="cf-slot"></div></div>';
  document.body.appendChild(btn); document.body.appendChild(panel);

  var body = panel.querySelector('#srchn-body');
  var input = panel.querySelector('#srchn-in');
  var sendBtn = panel.querySelector('#srchn-send');
  var locBtn = panel.querySelector('#srchn-loc');
  var micBtn = panel.querySelector('#srchn-mic');
  var ttsBox = panel.querySelector('#srchn-tts');

  /* ---------- voice input/output: free browser APIs only (Web Speech), nothing leaves the browser except the final text ---------- */
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var rec = null, listening = false;
  if (SR) {
    micBtn.hidden = false;
    micBtn.onclick = function () {
      if (listening && rec) { rec.stop(); return; }
      try {
        rec = new SR(); rec.lang = 'en-IN'; rec.interimResults = true; rec.maxAlternatives = 1;
        rec.onstart = function () { listening = true; micBtn.classList.add('on'); micBtn.setAttribute('aria-pressed', 'true'); };
        rec.onresult = function (ev) { var t = ''; for (var i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript; input.value = t; };
        rec.onerror = function () { listening = false; micBtn.classList.remove('on'); micBtn.setAttribute('aria-pressed', 'false'); };
        rec.onend = function () { listening = false; micBtn.classList.remove('on'); micBtn.setAttribute('aria-pressed', 'false'); input.focus(); };
        rec.start();
      } catch (e) { listening = false; }
    };
  }
  if (window.speechSynthesis && window.SpeechSynthesisUtterance) panel.querySelector('#srchn-tts-l').hidden = false;
  function speak(t) {
    if (!ttsBox || !ttsBox.checked || !window.speechSynthesis) return;
    try { speechSynthesis.cancel(); var u = new SpeechSynthesisUtterance(String(t).slice(0, 600)); u.lang = 'en-IN'; speechSynthesis.speak(u); } catch (e) {}
  }
  window.SRCHNVoice = { open: function () { panel.classList.add('open'); ensureTurnstile(); setTimeout(function () { input.focus(); }, 50); } };

  btn.onclick = function () { panel.classList.toggle('open'); if (panel.classList.contains('open')) ensureTurnstile(); };
  panel.querySelector('#srchn-x').onclick = function () { panel.classList.remove('open'); };

  /* ---------- turnstile (managed, mostly invisible; token is single-use, 5-min TTL).
     Auto-run + pre-issue: the challenge starts when the widget renders (panel open),
     and a fresh widget is rendered right after every send so the next message usually
     has a token ready by the time it is sent. ---------- */
  var tsLoading = false;
  var tsError = false;
  var tsGen = 0; // ignores late callbacks from widgets that were removed
  function renderWidget() {
    if (typeof turnstile === 'undefined' || tsWidgetId !== null) return;
    try {
      var gen = ++tsGen;
      tsWidgetId = turnstile.render('#cf-slot', {
        sitekey: TURNSTILE_SITEKEY,
        retry: 'auto', 'refresh-expired': 'auto', 'refresh-timeout': 'auto',
        size: 'compact',
        appearance: 'interaction-only', // hidden unless a human check is actually needed
        callback: function (t) { if (gen !== tsGen) return; tsToken = t; tsError = false; },
        'expired-callback': function () { if (gen === tsGen) tsToken = null; },
        'error-callback': function () { if (gen === tsGen) { tsToken = null; tsError = true; } }
      });
    } catch (e) { tsWidgetId = null; }
  }
  function ensureTurnstile() {
    if (tsWidgetId !== null || tsLoading) return;
    if (typeof turnstile !== 'undefined') { renderWidget(); return; }
    tsLoading = true;
    var s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.onload = function () { tsLoading = false; renderWidget(); };
    s.onerror = function () { tsLoading = false; };
    document.head.appendChild(s);
  }
  function reRender() { // full remove + render fresh: the challenge restarts immediately
    try { if (tsWidgetId !== null) turnstile.remove(tsWidgetId); } catch (e) {}
    tsWidgetId = null; tsToken = null; tsError = false;
    renderWidget();
  }
  function getToken() {
    return new Promise(function (resolve) {
      ensureTurnstile();
      var tries = 0, rebuilt = false;
      (function poll() {
        if (tsToken) return resolve(tsToken);
        ++tries;
        // Patience beats churn: rebuilding cancels an in-flight challenge, and
        // slow environments issue late. Only rebuild on an explicit error, and
        // allow ~50s total before giving up.
        if (tsError && !rebuilt) {
          rebuilt = true; tsError = false; reRender();
        } else if (tries > 250) {
          return resolve(null);
        }
        setTimeout(poll, 200);
      })();
    });
  }

  /* ---------- location ---------- */
  locBtn.onclick = function () {
    if (coords) { coords = null; locBtn.classList.remove('on'); locBtn.textContent = 'Use my location'; return; }
    if (!navigator.geolocation) return;
    locBtn.textContent = 'Locating...';
    navigator.geolocation.getCurrentPosition(function (p) {
      coords = { lat: p.coords.latitude, lng: p.coords.longitude };
      locBtn.classList.add('on'); locBtn.textContent = 'Location on';
    }, function () {
      coords = null; locBtn.classList.remove('on'); locBtn.textContent = 'Use my location';
    }, { timeout: 8000 });
  };

  /* ---------- rendering (all user/model text via textContent; server HTML only in a sandboxed iframe) ---------- */
  function bubble(text, who) {
    var d = document.createElement('div'); d.className = 'msg ' + who; d.textContent = text;
    body.appendChild(d); body.scrollTop = body.scrollHeight; return d;
  }
  function placeCard(p) {
    var el = document.createElement('div'); el.className = 'place';
    var nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = p.name || 'Place';
    var lc = document.createElement('span'); lc.className = 'lc'; lc.textContent = p.loc ? ' - ' + p.loc : '';
    nm.appendChild(lc); el.appendChild(nm);
    var acts = document.createElement('div'); acts.className = 'acts';
    if (p.catalogue && p.pid) {
      var sheet = PREVIEW_BASE + '?pay=' + encodeURIComponent(p.pid);
      acts.appendChild(link('Read / Visit', sheet));
      acts.appendChild(link('Book this slot', sheet + '&step=book'));
      acts.appendChild(link('Pay UPI (demo)', sheet));
    } else if (p.mapsUrl && httpsOnly(p.mapsUrl)) {
      var a = link('View on Google Maps', p.mapsUrl); a.target = '_blank'; a.rel = 'noopener'; acts.appendChild(a);
    }
    el.appendChild(acts); body.appendChild(el); body.scrollTop = body.scrollHeight;
  }
  function link(label, href) { var a = document.createElement('a'); a.href = href; a.textContent = label; return a; }
  function httpsOnly(u) { return typeof u === 'string' && /^https:\/\//i.test(u); }
  function suggestions(html) {
    /* Google requires showing Search Suggestions with grounded answers. Render the
       Google-provided HTML inside a sandboxed iframe: no scripts, no same-origin
       access; taps open the Search results page in a new tab. */
    var f = document.createElement('iframe');
    f.className = 'sugg';
    f.setAttribute('sandbox', 'allow-popups allow-popups-to-escape-sandbox');
    f.setAttribute('referrerpolicy', 'no-referrer');
    f.srcdoc = html + '<base target="_blank">';
    body.appendChild(f); body.scrollTop = body.scrollHeight;
  }
  function sourceLine(w) {
    if (!w || !httpsOnly(w.link)) return;
    var d = document.createElement('div'); d.className = 'msg note';
    var a = link(w.title || w.link, w.link); a.target = '_blank'; a.rel = 'noopener';
    d.appendChild(document.createTextNode('Source: ')); d.appendChild(a);
    body.appendChild(d); body.scrollTop = body.scrollHeight;
  }
  function mapsCard(url) {
    if (!httpsOnly(url)) return;
    var el = document.createElement('div'); el.className = 'place';
    var nm = document.createElement('div'); nm.className = 'nm';
    nm.textContent = 'Not in SRCHN yet'; el.appendChild(nm);
    var acts = document.createElement('div'); acts.className = 'acts';
    var a = link('Search on Google Maps', url); a.target = '_blank'; a.rel = 'noopener';
    acts.appendChild(a); el.appendChild(acts);
    body.appendChild(el); body.scrollTop = body.scrollHeight;
  }
  function videos(list) {
    var d = document.createElement('div'); d.className = 'place vids';
    var t = document.createElement('div'); t.className = 'nm'; t.textContent = 'Videos'; d.appendChild(t);
    list.forEach(function (v) {
      if (!httpsOnly(v.url)) return;
      var a = link(v.title || 'Watch on YouTube', v.url); a.target = '_blank'; a.rel = 'noopener'; d.appendChild(a);
    });
    body.appendChild(d); body.scrollTop = body.scrollHeight;
  }


  /* ---------- local listing lookup (no network call to the AI worker) ---------- */
  var LITE = null;
  function loadLite() {
    if (LITE) return Promise.resolve(LITE);
    return fetch(PREVIEW_BASE + 'places-lite.json').then(function (r) { return r.ok ? r.json() : []; }).then(function (j) { LITE = j; return j; }).catch(function () { LITE = []; return LITE; });
  }
  var STOP = { where: 1, is: 1, the: 1, a: 1, an: 1, in: 1, at: 1, find: 1, show: 1, me: 1, location: 1, address: 1, of: 1, located: 1, whats: 1, what: 1, to: 1, tell: 1, about: 1, directions: 1, map: 1, bangalore: 1, bengaluru: 1 };
  function norm(t) { return t.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
  var GEN = { cafe: 1, cafes: 1, coffee: 1, restaurant: 1, bar: 1, pub: 1, hotel: 1, shop: 1, store: 1, bengaluru: 1, bangalore: 1, the: 1, and: 1 };
  function lev(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    var prev = [], cur = [], i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur = [i];
      for (j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[b.length];
  }
  function isAsk(text) { return /^(where( is| are|s)?|find|show( me)?|location of|address of|directions to|locate)\b/.test(norm(text)); }
  function coreOf(text) {
    var t = norm(text).split(' ').filter(function (w) { return w && !STOP[w] && !GEN[w]; });
    if (!t.length) t = norm(text).split(' ').filter(function (w) { return w && !STOP[w]; });
    return t;
  }
  /* score 0..3 (higher better); 0 = no match. rows: [name, ...] */
  function score(core, name) {
    var nm = norm(name), flat = nm.replace(/ /g, ''), q = core.join('');
    if (!q) return 0;
    if (nm === core.join(' ')) return 3;
    if (flat.indexOf(q) >= 0) return 2.5;
    var nt = nm.split(' '), ok = 0;
    core.forEach(function (w) {
      var d = w.length >= 8 ? 2 : (w.length >= 4 ? 1 : 0), hit = false;
      for (var i = 0; i < nt.length && !hit; i++) { if (nt[i] === w || lev(nt[i], w, d) <= d) hit = true; }
      if (!hit && flat.indexOf(w) >= 0) hit = true;
      if (hit) ok++;
    });
    if (ok === core.length) return 2;
    if (core.length > 1 && ok >= 1 && ok >= core.length - 1) return 1;
    return 0;
  }
  function localMatch(text, list) {
    var q = norm(text), ask = isAsk(text);
    var core = coreOf(text);
    if (!core.length) return [];
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var sc = score(core, list[i][0]);
      if (sc >= 2 || (ask && sc >= 1)) out.push([sc, list[i]]);
      else if (!ask && sc === 0) continue;
    }
    if (!ask) out = out.filter(function (x) { return x[0] >= 2.5; });
    out.sort(function (a, b) { return b[0] - a[0]; });
    return out.slice(0, 5).map(function (x) { return x[1]; });
  }
  /* open-data: lazy-load every category chunk, only for where-is questions with no listing match */
  var ODALL = null;
  function loadOd() {
    if (ODALL) return Promise.resolve(ODALL);
    return fetch(PREVIEW_BASE + 'od/index.json').then(function (r) { return r.json(); }).then(function (idx) {
      return Promise.all(Object.keys(idx).map(function (c) {
        return fetch(PREVIEW_BASE + 'od/' + c + '.json').then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; });
      }));
    }).then(function (arr) { ODALL = [].concat.apply([], arr); return ODALL; }).catch(function () { ODALL = []; return ODALL; });
  }
  function odMatch(text, rows) {
    var core = coreOf(text), out = [];
    if (!core.length) return out;
    for (var i = 0; i < rows.length; i++) {
      var sc = score(core, rows[i][1] || '');
      if (sc >= 1) out.push([sc, rows[i]]);
    }
    out.sort(function (a, b) { return b[0] - a[0]; });
    return out.slice(0, 5).map(function (x) { return x[1]; });
  }
  function showOd(hits, exact) {
    bubble(exact ? 'Found it in the open-data places (not a full SRCHN page):' : 'I did not find that exact name, but these look similar:', 'bot');
    hits.forEach(function (r) {
      var el = document.createElement('div'); el.className = 'place';
      var nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = r[1];
      var lc = document.createElement('span'); lc.className = 'lc'; lc.textContent = r[4] ? ' - ' + r[4] : ' - Bengaluru'; nm.appendChild(lc); el.appendChild(nm);
      var acts = document.createElement('div'); acts.className = 'acts';
      var a = link('View on OpenStreetMap', 'https://www.openstreetmap.org/?mlat=' + r[2] + '&mlon=' + r[3] + '#map=18/' + r[2] + '/' + r[3]); a.target = '_blank'; a.rel = 'noopener'; acts.appendChild(a);
      el.appendChild(acts); body.appendChild(el);
    });
    body.scrollTop = body.scrollHeight;
  }
  function showLocal(hits) {
    bubble(hits.length === 1 ? 'Found it in the SRCHN listings:' : 'Found these in the SRCHN listings:', 'bot');
    hits.forEach(function (h) {
      var el = document.createElement('div'); el.className = 'place';
      var nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = h[0];
      var lc = document.createElement('span'); lc.className = 'lc'; lc.textContent = h[1] ? ' - ' + h[1] + ', Bengaluru' : ''; nm.appendChild(lc); el.appendChild(nm);
      var acts = document.createElement('div'); acts.className = 'acts';
      if (h[3]) acts.appendChild(link('Open SRCHN page', PREVIEW_BASE + 'place/' + h[3] + '/'));
      if (h[4] && httpsOnly(h[4])) { var a = link('View on Google Maps', h[4]); a.target = '_blank'; a.rel = 'noopener'; acts.appendChild(a); }
      el.appendChild(acts); body.appendChild(el);
    });
    body.scrollTop = body.scrollHeight;
  }

  /* ---------- send ---------- */
  function post(text, token) {
    var payload = { message: text, sessionId: sessionId, turnstileToken: token };
    if (coords) { payload.lat = coords.lat; payload.lng = coords.lng; }
    return fetch(API_URL, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload)
    }).then(function (r) {
      if (!r.ok) { var err = new Error('http-' + r.status); err.status = r.status; throw err; }
      return r.json();
    });
  }
  function send() {
    var text = input.value.trim();
    if (!text || sending) return;
    sending = true; sendBtn.disabled = true;
    input.value = '';
    bubble(text, 'user');
    var localHit = null;
    return loadLite().then(function (list) {
      var hits = localMatch(text, list);
      if (hits.length) { showLocal(hits); sending = false; sendBtn.disabled = false; return; }
      if (!isAsk(text)) return sendRemote(text);
      return loadOd().then(function (rows) {
        var oh = odMatch(text, rows);
        var core = coreOf(text).join('');
        var exact = oh.length && score(coreOf(text), oh[0][1]) >= 2;
        if (oh.length) showOd(oh, exact);
        else bubble('I could not find that in the SRCHN listings. Check the spelling, or try the area or category, for example "cafes in HSR Layout".', 'bot');
        sending = false; sendBtn.disabled = false;
      });
    });
  }
  function _unused() {
    return Promise.resolve().then(function () {
      return sendRemote(text);
    });
  }
  function sendRemote(text) {
    var thinking = bubble('Checking you are human, then asking...', 'bot');
    var failed = false;
    getToken().then(function (token) {
      if (!token) { failed = true; return Promise.reject('no-token'); }
      tsToken = null; // single-use: spent on this request whatever the outcome
      return post(text, token).catch(function (e) {
        // The worker refused the token (used, expired or invalid): get a fresh one and try once more.
        if (e && (e.status === 403 || e.status === 401 || e.status === 400)) {
          reRender();
          return getToken().then(function (t2) {
            if (!t2) { failed = true; return Promise.reject('no-token'); }
            tsToken = null;
            return post(text, t2);
          });
        }
        throw e;
      });
    }).then(function (r) {
      thinking.remove();
      if (r && r.reply && /busy right now|try again a little later/i.test(r.reply)) {
        input.value = text;
        bubble('The AI service behind this assistant did not answer (its free usage limit may be used up, or it had an error). This is not a problem with your question or phone. Your question is back in the box. Meanwhile, type a place name such as "Toit" and I will look it up in the SRCHN listings.', 'bot');
        return;
      }
      bubble((r && r.reply) || 'Something went wrong - please try again.', 'bot');
      if (r && r.reply) speak(r.reply);
      if (r && r.searchSuggestionsHtml) suggestions(r.searchSuggestionsHtml);
      if (r && r.places) r.places.forEach(placeCard);
      if (r && r.sources) r.sources.forEach(sourceLine);
      if (r && r.mapsSearchUrl) mapsCard(r.mapsSearchUrl);
      if (r && r.videos) videos(r.videos);
    }).catch(function (e) {
      thinking.remove();
      if (failed || e === 'no-token') {
        input.value = text; // keep what they typed
        bubble('The human check did not finish. Your question is back in the box: press Send again. If a checkbox appears above the Send button, tick it first.', 'note');
      } else {
        input.value = text;
        bubble('Something went wrong. Your question is back in the box: press Send to try again.', 'bot');
      }
    }).finally(function () {
      tsToken = null;
      reRender(); // fresh challenge for the next message
      sending = false; sendBtn.disabled = false; input.focus();
    });
  }
  sendBtn.onclick = send;
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });

  bubble('Hi! Ask me anything about Bangalore - places, cafes, areas, events.', 'bot');
})();
