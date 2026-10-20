/* SRCHN city chat widget v8 - preview only (/preview/, noindex). White-first pastel theme.
   Self-contained: no keys in the browser. Calls the SRCHN Worker API.
   Load with: <script src="widget.js" defer></script> on the preview page. */
(function () {
  'use strict';

  var API_URL = '/api/chat'; // same-origin via Cloudflare route on srchn.in
  var TURNSTILE_SITEKEY = '0x4AAAAAAFb1xd3vvqDeAQMZ';
  var PREVIEW_BASE = 'https://srchn.in/preview/';

  /* studio condenser mic - inline SVG, decorative (buttons carry text labels) */
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
    + '@keyframes srchn-pulse{0%,100%{box-shadow:0 6px 22px rgba(150,130,240,.35),0 0 0 0 rgba(180,150,245,.4)}'
    + '50%{box-shadow:0 6px 22px rgba(150,130,240,.45),0 0 0 12px rgba(180,150,245,0)}}'
    + '#srchn-chat-btn{position:fixed;right:20px;bottom:20px;z-index:99990;border:1px solid rgba(120,100,220,.25);border-radius:999px;display:inline-flex;align-items:center;gap:7px;'
    + 'padding:13px 20px;background:linear-gradient(135deg,#a9c1ff 0%,#cbb6f7 55%,#f6bfd7 100%);color:#23233a;font:600 14px/1 system-ui,sans-serif;cursor:pointer;'
    + 'box-shadow:0 6px 22px rgba(150,130,240,.35);animation:srchn-pulse 3s ease-in-out infinite;transition:filter .15s}'
    + '#srchn-chat-btn:hover{filter:saturate(1.15)}'
    + '@media (prefers-reduced-motion: reduce){#srchn-chat-btn{animation:none}}'
    + '#srchn-chat-panel{position:fixed;right:20px;bottom:76px;z-index:99991;width:min(380px,calc(100vw - 32px));'
    + 'height:min(560px,calc(100vh - 110px));display:none;flex-direction:column;background:#fff;color:#1c1c24;'
    + 'border:1px solid #e7e4ef;border-radius:14px;overflow:hidden;font:14px/1.45 system-ui,sans-serif;'
    + 'box-shadow:0 14px 44px rgba(70,60,110,.16)}'
    + '#srchn-chat-panel.open{display:flex}'
    + '.srchn-head{padding:12px 14px;border-bottom:1px solid #efedf5;display:flex;justify-content:space-between;align-items:center}'
    + '.srchn-head b{font-size:14px}.srchn-head button{background:none;border:0;color:#9a9aa6;font-size:18px;cursor:pointer}'
    + '.srchn-ht{display:flex;align-items:center;gap:6px;color:#8b7ff0}'
    + '.srchn-ht b{color:#1c1c24}'
    + '.srchn-head span{display:block;font-size:11px;color:#8f8f9a;font-weight:400;margin-top:2px}'
    + '#srchn-body{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:10px}'
    + '.msg{max-width:88%;padding:9px 12px;border-radius:12px;white-space:pre-wrap;word-break:break-word}'
    + '.msg.user{align-self:flex-end;background:#e7edff;color:#1c2b52;border:1px solid #d4dffc;border-bottom-right-radius:4px}'
    + '.msg.bot{align-self:flex-start;background:#f6f6f9;border:1px solid #e9e9f0;color:#1c1c24;border-bottom-left-radius:4px}'
    + '.msg.note{align-self:center;background:none;color:#9a9aa3;font-size:12px;text-align:center;padding:2px}'
    + '.place{align-self:stretch;background:#fbfbff;border:1px solid #e9e7f2;border-radius:10px;padding:10px 12px;color:#1c1c24}'
    + '.place .nm{font-weight:600}.place .lc{color:#7d7d88;font-size:12px;font-weight:400}'
    + '.place .acts{margin-top:8px;display:flex;flex-wrap:wrap;gap:6px}'
    + '.place a{color:#4a5fc1;text-decoration:none;font-size:13px;border:1px solid #c9d3f5;border-radius:8px;padding:5px 9px}'
    + '.place a:hover{background:#eef1ff}'
    + '.vids a{display:block;color:#4a5fc1;font-size:13px;margin:4px 0}'
    + 'iframe.sugg{align-self:stretch;width:100%;border:0;height:52px;background:transparent}'
    + '.foot{border-top:1px solid #efedf5;padding:10px}'
    + '.foot .row{display:flex;gap:8px}'
    + '#srchn-in{flex:1;background:#fcfcfe;border:1px solid #ddddea;color:#1c1c24;border-radius:10px;'
    + 'padding:10px;font:14px system-ui,sans-serif;outline:none;resize:none;min-height:20px;max-height:90px}'
    + '#srchn-send{background:#4f63e8;border:0;color:#fff;border-radius:10px;padding:0 16px;cursor:pointer;font-weight:600}'
    + '#srchn-send:disabled{opacity:.5;cursor:default}'
    + '.loc-row{display:flex;align-items:center;gap:8px;margin-top:8px}'
    + '#srchn-loc{background:none;border:1px solid #ddddea;color:#8a8a95;border-radius:8px;font-size:12px;padding:4px 9px;cursor:pointer}'
    + '#srchn-loc.on{color:#3f9d63;border-color:#bfe3cd}'
    + '.loc-note{font-size:11px;color:#a6a6ae}'
    + '#cf-slot{margin-top:8px;min-height:0}';

  /* ---------- dom ---------- */
  var style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
  var btn = document.createElement('button'); btn.id = 'srchn-chat-btn'; btn.setAttribute('aria-label', 'Ask about Bangalore');
  btn.innerHTML = MIC_SVG + '<span>Ask about Bangalore</span>';
  var panel = document.createElement('div'); panel.id = 'srchn-chat-panel';
  panel.innerHTML =
    '<div class="srchn-head"><div><div class="srchn-ht">' + MIC_SVG + '<b>SRCHN city assistant</b></div>' +
    '<span>Bangalore only. Answers from SRCHN listings + AI knowledge. Not live data.</span></div>' +
    '<button aria-label="Close" id="srchn-x">&times;</button></div>' +
    '<div id="srchn-body"></div>' +
    '<div class="foot">' +
    '<div class="row"><textarea id="srchn-in" rows="1" maxlength="500" placeholder="Ask about Bangalore - places, food, areas..."></textarea>' +
    '<button id="srchn-send">Send</button></div>' +
    '<div class="loc-row"><button id="srchn-loc" type="button">Use my location</button>' +
    '<span class="loc-note">Optional. Used only for that answer, never stored.</span></div>' +
    '<div id="cf-slot"></div></div>';
  document.body.appendChild(btn); document.body.appendChild(panel);

  var body = panel.querySelector('#srchn-body');
  var input = panel.querySelector('#srchn-in');
  var sendBtn = panel.querySelector('#srchn-send');
  var locBtn = panel.querySelector('#srchn-loc');

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
      bubble((r && r.reply) || 'Something went wrong - please try again.', 'bot');
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
