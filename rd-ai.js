/* rd-ai.js · botón "Mejorar con IA" debajo de las descripciones de vehículos (app, web móvil y escritorio).
   Toma el borrador y los datos del mismo formulario (marca, modelo, año, km…), los manda a /api/ai-describe
   con la sesión del usuario y reemplaza el texto por un párrafo limpio. "Deshacer" devuelve el borrador.
   El subtítulo "powered by …" se edita en Ruedda Control → Configuración (app_settings.ai_powered_by). */
(function () {
  var IDS = ['desc-textarea', 'edit-desc', 'af-descripcion', 'garage-form-descripcion'];
  var SKIP = /whats|tel[eé]f|c[eé]dula|correo|email|contrase|precio|usd|vin|placa/i;
  var powered = 'Google Gemini';
  var poweredLoaded = false;

  function css() {
    if (document.getElementById('rd-ai-css')) return;
    var s = document.createElement('style');
    s.id = 'rd-ai-css';
    s.textContent =
      '.rd-ai{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:10px}' +
      '.rd-ai-by{font-size:11px;color:var(--muted);letter-spacing:.2px;line-height:1.3;min-width:0}' +
      '.rd-ai-by b{font-weight:600;color:var(--w60,var(--muted))}' +
      '.rd-ai-acts{display:flex;align-items:center;gap:12px;flex-shrink:0}' +
      '.rd-ai-undo{background:none;border:none;padding:0;font-family:var(--font);font-size:12px;color:var(--muted);cursor:pointer;text-decoration:underline;text-underline-offset:3px}' +
      '.rd-ai-btn{position:relative;display:inline-flex;align-items:center;gap:8px;height:36px;padding:0 15px;border-radius:100px;border:1px solid var(--w14,var(--border));background:var(--w4,transparent);color:var(--white);font-family:var(--font);font-size:13px;font-weight:600;letter-spacing:-.1px;cursor:pointer;overflow:hidden;-webkit-tap-highlight-color:transparent;transition:border-color .2s,background .2s,transform .12s}' +
      '.rd-ai-btn:hover{border-color:var(--w30,var(--border));background:var(--w8,transparent)}' +
      '.rd-ai-btn:active{transform:scale(.97)}' +
      '.rd-ai-btn svg{width:14px;height:14px;flex-shrink:0}' +
      '.rd-ai-btn[disabled]{cursor:default}' +
      '.rd-ai-btn.busy::after{content:"";position:absolute;inset:0;background:linear-gradient(100deg,transparent 20%,rgba(255,255,255,.14) 50%,transparent 80%);background-size:220% 100%;animation:rdAiSh 1.1s linear infinite}' +
      '@keyframes rdAiSh{from{background-position:120% 0}to{background-position:-100% 0}}' +
      '.rd-ai-err{font-size:12px;color:#ff5050;margin-top:6px}' +
      '.rd-ai-on{animation:rdAiIn .5s cubic-bezier(.22,.61,.36,1)}' +
      '@keyframes rdAiIn{from{opacity:.35}to{opacity:1}}' +
      '@media (prefers-reduced-motion:reduce){.rd-ai-btn.busy::after,.rd-ai-on{animation:none}}';
    document.head.appendChild(s);
  }

  var SPARK = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2c.6 4.4 2 6.8 6 8-4 1.2-5.4 3.6-6 8-.6-4.4-2-6.8-6-8 4-1.2 5.4-3.6 6-8z"/><path d="M19 14c.3 2 .9 3 2.6 3.5-1.7.5-2.3 1.5-2.6 3.5-.3-2-.9-3-2.6-3.5 1.7-.5 2.3-1.5 2.6-3.5z" opacity=".55"/></svg>';

  function loadPowered() {
    if (poweredLoaded) return;
    poweredLoaded = true;
    try {
      if (typeof _supa === 'undefined' || !_supa) { poweredLoaded = false; return; }
      _supa.from('app_settings').select('value').eq('key', 'ai_powered_by').maybeSingle().then(function (r) {
        var v = r && r.data && r.data.value;
        if (v && String(v).trim()) {
          powered = String(v).trim();
          document.querySelectorAll('.rd-ai-by b').forEach(function (b) { b.textContent = powered; });
        }
      });
    } catch (e) { poweredLoaded = false; }
  }

  async function token() {
    try {
      if (typeof _supa !== 'undefined' && _supa && _supa.auth) {
        var s = await _supa.auth.getSession();
        var t = s && s.data && s.data.session && s.data.session.access_token;
        if (t) return t;
      }
    } catch (e) {}
    try {
      var j = JSON.parse(localStorage.getItem('ruedda-auth') || 'null');
      return (j && j.access_token) || null;
    } catch (e) { return null; }
  }

  function labelFor(el) {
    var g = el.closest('.form-group');
    var l = g && g.querySelector('.form-label,label');
    var t = (l && l.textContent) || el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.name || el.id || '';
    return t.replace(/\s+/g, ' ').replace(/[.:]+$/, '').trim();
  }

  // datos del mismo formulario: inputs y selects con valor, sin contacto ni precio
  function collect(ta) {
    var root = ta.closest('form,.modal-sheet,.vender-sheet,[id$="-sheet"],[id$="-modal"],.view,section') || ta.parentElement.parentElement || document.body;
    var out = [], seen = {};
    root.querySelectorAll('input,select').forEach(function (el) {
      if (out.length >= 30 || el.disabled) return;
      var type = (el.type || '').toLowerCase();
      if (/hidden|file|password|tel|email|checkbox|radio|submit|button|search/.test(type)) return;
      var v = el.tagName === 'SELECT' ? (el.options[el.selectedIndex] || {}).text : el.value;
      v = String(v || '').trim();
      if (!v || /^selecciona|^elige/i.test(v)) return;
      var k = labelFor(el);
      if (!k || SKIP.test(k) || seen[k + v]) return;
      seen[k + v] = 1;
      out.push([k, v]);
    });
    root.querySelectorAll('.rd-cond-on,.chip.active,.mkt-pill.active').forEach(function (el) {
      var v = (el.textContent || '').trim(); if (v && out.length < 36) out.push(['detalle', v]);
    });
    return out;
  }

  function mount(ta) {
    if (!ta || ta.dataset.rdAi) return;
    ta.dataset.rdAi = '1';
    css();
    loadPowered();
    var box = document.createElement('div');
    box.className = 'rd-ai';
    box.innerHTML =
      '<span class="rd-ai-by">powered by <b></b></span>' +
      '<span class="rd-ai-acts"><button type="button" class="rd-ai-undo" hidden>deshacer</button>' +
      '<button type="button" class="rd-ai-btn">' + SPARK + '<span>Mejorar con IA</span></button></span>';
    box.querySelector('.rd-ai-by b').textContent = powered;
    var err = document.createElement('div');
    err.className = 'rd-ai-err';
    err.hidden = true;
    ta.insertAdjacentElement('afterend', box);
    box.insertAdjacentElement('afterend', err);
    var btn = box.querySelector('.rd-ai-btn'), lbl = btn.querySelector('span'), undo = box.querySelector('.rd-ai-undo');
    var before = null;

    undo.addEventListener('click', function () {
      if (before == null) return;
      ta.value = before; before = null; undo.hidden = true;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    });

    btn.addEventListener('click', async function () {
      if (btn.disabled) return;
      err.hidden = true;
      var t = await token();
      if (!t) { err.textContent = 'Inicia sesión para usar la IA.'; err.hidden = false; return; }
      btn.disabled = true; btn.classList.add('busy'); lbl.textContent = 'Mejorando…';
      try { window._rdHapticNow && window._rdHapticNow('LIGHT'); } catch (e) {}
      try {
        var r = await fetch('/api/ai-describe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
          body: JSON.stringify({ draft: ta.value, fields: collect(ta) }),
        });
        var j = await r.json().catch(function () { return {}; });
        if (!r.ok || !j.text) throw new Error(j.error || 'No se pudo mejorar el texto.');
        before = ta.value;
        var max = +ta.getAttribute('maxlength') || 0;
        ta.value = max ? j.text.slice(0, max) : j.text;
        ta.classList.remove('rd-ai-on'); void ta.offsetWidth; ta.classList.add('rd-ai-on');
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        undo.hidden = false;
        try { window._rdHapticSuccess && window._rdHapticSuccess(); } catch (e) {}
      } catch (e) {
        err.textContent = e.message || 'No se pudo mejorar el texto.'; err.hidden = false;
      } finally {
        btn.disabled = false; btn.classList.remove('busy'); lbl.textContent = 'Mejorar con IA';
      }
    });
  }

  var enabled = null;
  function scan() { if (enabled !== true) return; IDS.forEach(function (id) { var el = document.getElementById(id); if (el && el.tagName === 'TEXTAREA') mount(el); }); }
  function start() {
    fetch('/api/ai-describe').then(function (r) { return r.json(); }).then(function (j) { enabled = !!(j && j.enabled); scan(); }).catch(function () { enabled = false; });
    // formularios que se crean después (editar publicación, etc.)
    var pending = false;
    new MutationObserver(function () {
      if (pending) return; pending = true;
      requestAnimationFrame(function () { pending = false; scan(); });
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
