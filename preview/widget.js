/* SRCHN city chat widget - preview only (/preview/, noindex).
   Self-contained: no keys in the browser. Calls the SRCHN Worker API.
   Load with: <script src="widget.js" defer></script> on the preview page. */
(function () {
  'use strict';

  var API_URL = 'https://srchn-city-chat.gireeshchalla.workers.dev/api/chat';
  var TURNSTILE_SITEKEY = '0x4AAAAAAFb1xd3vvqDeAQMZ';
  var PREVIEW_BASE = 'https://srchn.in/preview/';

  var sessionId = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
  var coords = null;            // {lat, lng} only after explicit opt-in; never stored or sent elsewhere
  var tsWidgetId = null;
  var tsToken = null;
  var sending = false;

  /* ---------- styles ---------- */
  var css = ''
    + '#srchn-chat-btn{position:fixed;right:20px;bottom:20px;z-index:99990;border:0;border-radius:999px;'
    + 'padding:13px 20px;background:#111;color:#fff;font:600 14px/1 system-ui,sans-serif;cursor:pointer;'
    + 'box-shadow:0 6px 24px rgba(0,0,0,.35)}'
    + '#srchn-chat-panel{position:fixed;right:20px;bottom:76px;z-index:99991;width:min(380px,calc(100vw - 32px));'
    + 'height:min(560px,calc(100vh - 110px));display:none;flex-direction:column;background:#141414;color:#eee;'
    + 'border:1px solid #2a2a2a;border-radius:14px;overflow:hidden;font:14px/1.45 system-ui,sans-serif;'
    + 'box-shadow:0 12px 40px rgba(0,0,0,.5)}'
    + '#srchn-chat-panel.open{display:flex}'
    + '.srchn-head{padding:12px 14px;border-bottom:1px solid #262626;display:flex;justify-content:space-between;align-items:center}'
    + '.srchn-head b{font-size:14px}.srchn-head button{background:none;border:0;color:#999;font-size:18px;cursor:pointer}'
    + '.srchn-head span{display:block;font-size:11px;color:#888;font-weight:400;margin-top:2px}'
    + '#srchn-body{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:10px}'
    + '.msg{max-width:88%;padding:9px 12px;border-radius:12px;white-space:pre-wrap;word-break:break-word}'
    + '.msg.user{align-self:flex-end;background:#2b5cff;color:#fff;border-bottom-right-radius:4px}'
    + '.msg.bot{align-self:flex-start;background:#222;border:1px solid #2e2e2e;border-bottom-left-radius:4px}'
    + '.msg.note{align-self:center;background:none;color:#777;font-size:12px;text-align:center;padding:2px}'
    + '.place{align-self:stretch;background:#1c1c1c;border:1px solid #2c2c2c;border-radius:10px;padding:10px 12px}'
    + '.place .nm{font-weight:600}.place .lc{color:#999;font-size:12px;font-weight:400}'
    + '.place .acts{margin-top:8px;display:flex;flex-wrap:wrap;gap:6px}'
    + '.place a{color:#7ea2ff;text-decoration:none;font-size:13px;border:1px solid #35406b;border-radius:8px;padding:5px 9px}'
    + '.place a:hover{background:#1d2647}'
    + '.vids a{display:block;color:#7ea2ff;font-size:13px;margin:4px 0}'
    + 'iframe.sugg{align-self:stretch;width:100%;border:0;height:52px;background:transparent}'
    + '.foot{border-top:1px solid #262626;padding:10px}'
    + '.foot .row{display:flex;gap:8px}'
    + '#srchn-in{flex:1;background:#0f0f0f;border:1px solid #333;color:#eee;border-radius:10px;'
    + 'padding:10px;font:14px system-ui,sans-serif;outline:none;resize:none;min-height:20px;max-height:90px}'
    + '#srchn-send{background:#2b5cff;border:0;color:#fff;border-radius:10px;padding:0 16px;cursor:pointer;font-weight:600}'
    + '#srchn-send:disabled{opacity:.5;cursor:default}'
    + '.loc-row{display:flex;align-items:center;gap:8px;margin-top:8px}'
    + '#srchn-loc{background:none;border:1px solid #333;color:#aaa;border-radius:8px;font-size:12px;padding:4px 9px;cursor:pointer}'
    + '#srchn-loc.on{color:#8fd18f;border-color:#3c5a3c}'
    + '.loc-note{font-size:11px;color:#666}'
    + '#cf-slot{margin-top:8px;min-height:0}';

  /* ---------- dom ---------- */
  var style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
  var btn = document.createElement('button'); btn.id = 'srchn-chat-btn'; btn.textContent = 'Ask about Bangalore';
  var panel = document.createElement('div'); panel.id = 'srchn-chat-panel';
  panel.innerHTML =
    '<div class="srchn-head"><div><b>SRCHN city assistant</b>' +
    '<span>Bangalore only. Answers grounded in Google Search &amp; Maps.</span></div>' +
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

  /* ---------- turnstile (managed, mostly invisible; token is single-use, 5-min TTL) ---------- */
  function ensureTurnstile() {
    if (tsWidgetId !== null) return;
    var s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.onload = function () {
      tsWidgetId = turnstile.render('#cf-slot', {
        sitekey: TURNSTILE_SITEKEY,
        size: 'compact',
        callback: function (t) { tsToken = t; },
        'expired-callback': function () { tsToken = null; }
      });
    };
    document.head.appendChild(s);
  }
  function getToken() {
    return new Promise(function (resolve) {
      ensureTurnstile();
      var tries = 0;
      (function poll() {
        if (tsToken) return resolve(tsToken);
        if (++tries > 100) return resolve(null); // ~20s, treat as unavailable
        if (tsWidgetId !== null && tries === 20) { try { turnstile.reset(tsWidgetId); } catch (e) {} }
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
    } else if (p.mapsUrl) {
      var a = link('View on Google Maps', p.mapsUrl); a.target = '_blank'; a.rel = 'noopener'; acts.appendChild(a);
    }
    el.appendChild(acts); body.appendChild(el); body.scrollTop = body.scrollHeight;
  }
  function link(label, href) { var a = document.createElement('a'); a.href = href; a.textContent = label; return a; }
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
  function videos(list) {
    var d = document.createElement('div'); d.className = 'place vids';
    var t = document.createElement('div'); t.className = 'nm'; t.textContent = 'Videos'; d.appendChild(t);
    list.forEach(function (v) {
      var a = link(v.title || 'Watch on YouTube', v.url); a.target = '_blank'; a.rel = 'noopener'; d.appendChild(a);
    });
    body.appendChild(d); body.scrollTop = body.scrollHeight;
  }

  /* ---------- send ---------- */
  function send() {
    var text = input.value.trim();
    if (!text || sending) return;
    sending = true; sendBtn.disabled = true;
    input.value = '';
    bubble(text, 'user');
    var thinking = bubble('...', 'bot');
    getToken().then(function (token) {
      var payload = { message: text, sessionId: sessionId, turnstileToken: token };
      if (coords) { payload.lat = coords.lat; payload.lng = coords.lng; }
      return fetch(API_URL, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload)
      }).then(function (r) { return r.json(); });
    }).then(function (r) {
      thinking.remove();
      bubble((r && r.reply) || 'Something went wrong - please try again.', 'bot');
      if (r && r.searchSuggestionsHtml) suggestions(r.searchSuggestionsHtml);
      if (r && r.places) r.places.forEach(placeCard);
      if (r && r.videos) videos(r.videos);
    }).catch(function () {
      thinking.remove();
      bubble('Something went wrong - please try again.', 'bot');
    }).finally(function () {
      tsToken = null;
      if (tsWidgetId !== null) { try { turnstile.reset(tsWidgetId); } catch (e) {} }
      sending = false; sendBtn.disabled = false; input.focus();
    });
  }
  sendBtn.onclick = send;
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });

  bubble('Hi! Ask me anything about Bangalore - places, cafes, areas, events.', 'bot');
})();
