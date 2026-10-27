/* ─────────────────────────────────────────────────────────────
   RUEDDA · CREAR CUENTA PASO A PASO
   Vive dentro del mismo sheet de acceso (#auth-sheet). Solo cambia el modo
   registro: intro con Google/Apple → una pregunta a la vez → términos.
   No reemplaza la lógica: escribe los valores en los campos de siempre (ocultos)
   y llama a completeAuth(), así que validaciones, duplicados de cédula/usuario,
   perfil y bienvenida son exactamente los mismos. Iniciar sesión queda igual.
   ───────────────────────────────────────────────────────────── */
(function () {
  if (window.RDCC) return;
  var $ = function (id) { return document.getElementById(id); };
  var inner = $('auth-sheet-inner');
  if (!inner || typeof window.showLandingAuth !== 'function') return;

  var css = document.createElement('style');
  css.textContent = `
#rdcc{display:none;--ez:cubic-bezier(.32,.72,0,1);font-family:var(--font);color:var(--white)}
#auth-sheet-inner.rdcc-on #rdcc{display:block}
#auth-sheet-inner.rdcc-on>.rdcc-hide{display:none!important}
#rdcc *{box-sizing:border-box}
#rdcc button,#rdcc input{font:inherit;color:inherit;background:none;border:0;outline:0;-webkit-appearance:none;appearance:none;margin:0}
#rdcc button{cursor:pointer}
#rdcc svg{display:block}
#rdcc .hd{display:flex;align-items:center;gap:14px;padding:16px 22px 0}
#rdcc .ib{width:38px;height:38px;border-radius:50%;background:var(--w8);display:grid;place-items:center;flex:none;transition:opacity .3s,transform .3s var(--ez)}
#rdcc .ib:active{transform:scale(.92)}
#rdcc .ib svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
#rdcc .ib.hid{opacity:0;pointer-events:none}
#rdcc .bar{flex:1;height:3px;border-radius:3px;background:var(--w14);overflow:hidden;transition:opacity .3s}
#rdcc .bar.hid{opacity:0}
#rdcc .bar i{display:block;height:100%;width:0;background:var(--white);border-radius:3px;transition:width .55s var(--ez)}
#rdcc .s{padding:26px 22px 0;animation:rdccIn .5s var(--ez) both}
#rdcc .s.bk{animation-name:rdccBk}
@keyframes rdccIn{from{opacity:0;transform:translate3d(28px,0,0)}to{opacity:1;transform:none}}
@keyframes rdccBk{from{opacity:0;transform:translate3d(-28px,0,0)}to{opacity:1;transform:none}}
#rdcc .k{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--w30);margin-bottom:12px;font-weight:500}
#rdcc .k.lc{font-size:13px;letter-spacing:0;text-transform:none;color:var(--w50);font-weight:400}
#rdcc h2{font-size:30px;line-height:1.08;letter-spacing:-.03em;font-weight:400;margin:0}
#rdcc .sub{margin-top:10px;font-size:14px;line-height:1.5;color:var(--w50);font-weight:300}
#rdcc .blk{margin-top:30px;display:flex;flex-direction:column;gap:22px}
#rdcc .big{display:flex;align-items:baseline;gap:8px;border-bottom:1px solid var(--w22);padding-bottom:10px;transition:border-color .3s}
#rdcc .big:focus-within{border-color:var(--white)}
#rdcc .big input{flex:1;min-width:0;font-size:30px;font-weight:300;letter-spacing:-.03em;padding:0}
#rdcc .big input::placeholder{color:var(--w18)}
#rdcc .big .pre{font-size:30px;font-weight:300;color:var(--w50);letter-spacing:-.03em}
#rdcc .big .un{display:flex;gap:2px;align-self:center}
#rdcc .big .un button{font-size:15px;color:var(--w30);padding:6px 7px;transition:color .25s}
#rdcc .big .un button.on{color:var(--white)}
#rdcc .big.err{border-color:#ff5a4e}
#rdcc .shk{animation:rdccShk .38s}
@keyframes rdccShk{20%{transform:translateX(-7px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(2px)}}
#rdcc .hint{font-size:13px;color:var(--w50);line-height:1.5;font-weight:300;margin-top:-10px;min-height:20px}
#rdcc .hint.bad{color:#ff5a4e}
#rdcc .ch{display:flex;flex-wrap:wrap;gap:8px;margin-top:26px}
#rdcc .c{height:44px;padding:0 18px;border-radius:22px;background:var(--w8);font-size:15px;display:inline-flex;align-items:center;transition:background .25s,color .25s,transform .25s var(--ez)}
#rdcc .c:active{transform:scale(.96)}
#rdcc .c.sel{background:var(--white);color:var(--bg)}
#rdcc .cta{width:100%;height:56px;border-radius:28px;background:var(--white);color:var(--bg);font-size:16px;font-weight:500;letter-spacing:-.01em;display:flex;align-items:center;justify-content:center;margin-top:34px;transition:opacity .3s,transform .2s var(--ez)}
#rdcc .cta:active{transform:scale(.98)}
#rdcc .cta[disabled]{opacity:.5;pointer-events:none}
#rdcc .alt{margin-top:18px;font-size:13px;color:var(--w50);text-align:center}
#rdcc .alt u{color:var(--white);text-underline-offset:3px;cursor:pointer}
#rdcc .soc{margin-top:22px}
#rdcc .dv{display:flex;align-items:center;gap:12px;margin:0 0 16px}
#rdcc .dv i{flex:1;height:1px;background:var(--w8)}
#rdcc .dv span{font-size:12px;color:var(--w30);font-weight:400}
#rdcc .terms{margin-top:26px}
`;
  document.head.appendChild(css);

  var root = document.createElement('div');
  root.id = 'rdcc';
  root.innerHTML =
    '<div class="hd">' +
      '<button class="ib hid" data-a="back" aria-label="atrás"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button>' +
      '<div class="bar hid"><i></i></div>' +
      '<button class="ib" data-a="close" aria-label="cerrar"><svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></button>' +
    '</div><div class="st"></div>';
  // va después del agarrador, antes del título de siempre
  inner.insertBefore(root, inner.children[1] || null);
  var stage = root.querySelector('.st'), bar = root.querySelector('.bar'), back = root.querySelector('[data-a=back]');

  // lo de siempre que se oculta en modo registro (sigue en el DOM: completeAuth lo lee)
  var hide = [];
  [].forEach.call(inner.children, function (el) { if (el !== root && el !== inner.children[0]) hide.push(el); });

  var Q = 7, i = 0, busy = false;
  var v = { nom: '', ape: '', ct: 'V', ced: '', mail: '', tel: '', pass: '', pass2: '', user: '', fuente: '', userTouched: false };
  var FUENTES = ['Instagram', 'TikTok', 'un amigo', 'WhatsApp', 'Google', 'YouTube', 'en la calle', 'otro'];
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var tap = function () { try { window._rdHapticNow ? window._rdHapticNow() : navigator.vibrate && navigator.vibrate(8); } catch (e) {} };
  var big = function (id, ph, extra, pre, post) {
    return '<label class="big">' + (pre || '') + '<input id="rdcc-' + id + '" placeholder="' + ph + '" ' + (extra || '') + '>' + (post || '') + '</label>';
  };
  var btn = function (t) { return '<button class="cta" data-a="next">' + (t || 'siguiente') + '</button>'; };

  var STEPS = [
    function () {
      return '<div class="k lc">menos de 1 minuto</div>' +
        '<h2>crea tu cuenta y comienza a comerciar vehículos.</h2>' +
        '<p class="sub">publica gratis, habla directo con compradores y vendedores, y cierra el trato más rápido.</p>' +
        btn('crear cuenta') +
        (socialOk() ? '<div class="soc"><div class="dv"><i></i><span>o continúa con</span><i></i></div><div class="socb"></div></div>' : '') +
        '<div class="alt">¿ya tienes cuenta? <u data-a="login">iniciar sesión</u></div>';
    },
    function () {
      return '<div class="k">1 de 7</div><h2>¿cómo te llamas?</h2><p class="sub">así te verán compradores y vendedores.</p>' +
        '<div class="blk">' + big('nom', 'nombre', 'autocomplete="given-name" autocapitalize="words"') +
        big('ape', 'apellido', 'autocomplete="family-name" autocapitalize="words"') + '</div>' + btn();
    },
    function () {
      var un = '<span class="un">' + ['V', 'E', 'J'].map(function (t) { return '<button type="button" data-ct="' + t + '"' + (v.ct === t ? ' class="on"' : '') + '>' + t + '</button>'; }).join('') + '</span>';
      return '<div class="k">2 de 7</div><h2>tu cédula</h2><p class="sub">solo para verificar que eres tú.</p>' +
        '<div class="blk">' + big('ced', '12.345.678', 'type="tel" inputmode="numeric" maxlength="11"', un) + '</div>' + btn();
    },
    function () {
      return '<div class="k">3 de 7</div><h2>tu correo</h2><p class="sub">te avisamos ahí cuando te escriban.</p>' +
        '<div class="blk">' + big('mail', 'tu@correo.com', 'type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false"') +
        '<div class="hint" id="rdcc-h"></div></div>' + btn();
    },
    function () {
      return '<div class="k">4 de 7</div><h2>tu teléfono</h2><p class="sub">para que te contacten por el carro.</p>' +
        '<div class="blk">' + big('tel', '412 123 4567', 'type="tel" inputmode="numeric" autocomplete="tel-national"', '<span class="pre">+58</span>') + '</div>' + btn();
    },
    function () {
      return '<div class="k">5 de 7</div><h2>una contraseña</h2><p class="sub">mínimo 8 caracteres.</p>' +
        '<div class="blk">' + big('pass', 'contraseña', 'type="password" autocomplete="new-password"', '', '<span class="un"><button type="button" data-a="eye">ver</button></span>') +
        big('pass2', 'repítela', 'type="password" autocomplete="new-password"') + '<div class="hint" id="rdcc-h"></div></div>' + btn();
    },
    function () {
      return '<div class="k">6 de 7</div><h2>tu @usuario</h2>' +
        '<p class="sub">somos permisivos con la creatividad, destácate. un usuario ofensivo o +18 podría banear tu cuenta de Ruedda.</p>' +
        '<div class="blk">' + big('user', 'usuario', 'autocapitalize="off" autocorrect="off" spellcheck="false"', '<span class="pre">@</span>') + '</div>' + btn();
    },
    function () {
      return '<div class="k">7 de 7</div><h2>¿cómo te enteraste de Ruedda?</h2>' +
        '<div class="ch">' + FUENTES.map(function (f) { return '<button class="c' + (v.fuente === f ? ' sel' : '') + '" data-f="' + esc(f) + '">' + esc(f) + '</button>'; }).join('') + '</div>' +
        '<div class="terms"></div>' + btn('crear cuenta y entrar');
    }
  ];

  function socialOk() {
    var w = $('auth-social-wrap');
    return w && getComputedStyle(w).display !== 'none';
  }

  function render(dir) {
    stage.innerHTML = '<div class="s' + (dir < 0 ? ' bk' : '') + '">' + STEPS[i]() + '</div>';
    back.classList.toggle('hid', i === 0);
    bar.classList.toggle('hid', i === 0);
    bar.firstChild.style.width = (i / Q * 100) + '%';
    if (i === 0 && socialOk()) {
      // los mismos botones de Google/Apple de siempre (mismos onclick)
      var dst = stage.querySelector('.socb');
      [].forEach.call($('auth-social-wrap').querySelectorAll('button'), function (b) { dst.appendChild(b.cloneNode(true)); });
    }
    if (i === Q) {
      var tw = $('auth-terms-wrap');
      if (tw) { tw.style.display = 'block'; stage.querySelector('.terms').appendChild(tw); }
    }
    fill();
    var f = stage.querySelector('input');
    if (f && matchMedia('(pointer:fine)').matches) setTimeout(function () { f.focus({ preventScroll: true }); }, 60);
    inner.scrollTop = 0;
  }

  function fill() {
    var set = function (id, val) { var el = $('rdcc-' + id); if (el) el.value = val; };
    set('nom', v.nom); set('ape', v.ape); set('mail', v.mail); set('pass', v.pass); set('pass2', v.pass2);
    set('ced', v.ced.replace(/\B(?=(\d{3})+(?!\d))/g, '.'));
    set('tel', fmtTel(v.tel));
    if (i === 6 && !v.userTouched && !v.user) v.user = (v.nom + v.ape.slice(0, 1)).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
    set('user', v.user);
  }
  function fmtTel(d) { return [d.slice(0, 3), d.slice(3, 6), d.slice(6)].filter(Boolean).join(' '); }

  function bad(id, msg) {
    var el = $('rdcc-' + id), b = el && el.closest('.big');
    if (b) { b.classList.remove('shk'); void b.offsetWidth; b.classList.add('shk', 'err'); setTimeout(function () { b.classList.remove('err'); }, 1400); }
    var h = $('rdcc-h');
    if (h && msg) { h.textContent = msg; h.classList.add('bad'); }
    try { navigator.vibrate && navigator.vibrate([10, 40, 10]); } catch (e) {}
    if (el) el.focus();
    return false;
  }
  var OK = [null,
    function () { return v.nom.trim().length < 2 ? bad('nom') : v.ape.trim().length < 2 ? bad('ape') : true; },
    function () { return v.ced.length >= 6 || bad('ced'); },
    function () { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.mail.trim()) || bad('mail', 'parece incompleto.'); },
    function () { return v.tel.length === 10 || bad('tel'); },
    function () { return v.pass.length < 8 ? bad('pass', 'mínimo 8 caracteres.') : v.pass !== v.pass2 ? bad('pass2', 'no coinciden.') : true; },
    function () { return v.user.length >= 3 || bad('user'); }
  ];

  function go(d) {
    var n = Math.max(0, Math.min(Q, i + d));
    if (n === i) return;
    if (d > 0 && OK[i] && !OK[i]()) return;
    if (d > 0) tap();
    i = n; render(d);
  }

  // pasa todo a los campos de siempre y usa el registro de siempre
  async function submit() {
    if (busy) return;
    var tc = $('auth-terms-check');
    if (tc && !tc.checked) {
      var l = $('auth-terms-wrap'); if (l) { l.classList.remove('shk'); void l.offsetWidth; l.classList.add('shk'); }
      try { navigator.vibrate && navigator.vibrate([10, 40, 10]); } catch (e) {}
      return;
    }
    toForm(v);
    busy = true;
    var b = stage.querySelector('[data-a=next]');
    if (b) { b.disabled = true; b.textContent = 'creando tu cuenta…'; }
    try { await window.completeAuth(); } finally {
      busy = false;
      if (b) { b.disabled = false; b.textContent = 'crear cuenta y entrar'; }
    }
  }

  // los valores van a los campos de siempre: completeAuth() / _rueddaRegister() los leen de ahí
  function toForm(d) {
    var q = function (s) { return inner.querySelector(s); };
    var put = function (el, val) { if (el) el.value = val; };
    put(q('#auth-name-wrap input[placeholder="nombre"]'), String(d.nom || '').trim());
    put(q('#auth-name-wrap input[placeholder="apellido"]'), String(d.ape || '').trim());
    put(q('#auth-cedula-wrap input[type="tel"]'), String(d.ced || '').replace(/\D/g, ''));
    if (typeof window.setCedulaType === 'function') window.setCedulaType(d.ct || 'V');
    put($('auth-email'), String(d.mail || '').trim());
    put(q('#auth-phone-wrap input'), d.tel ? '0' + String(d.tel).replace(/\D/g, '').replace(/^0/, '') : '');
    put($('auth-pass'), d.pass || '');
    put($('auth-pass-confirm'), d.pass2 || d.pass || '');
    put(q('#auth-user-wrap input'), d.user || '');
    try { localStorage.setItem('rd_signup_fuente', d.fuente || ''); } catch (e) {}
  }

  root.addEventListener('click', function (e) {
    var t = e.target.closest('[data-a],[data-ct],[data-f]');
    if (!t) return;
    if (t.dataset.ct) { e.preventDefault(); v.ct = t.dataset.ct; [].forEach.call(t.parentNode.children, function (x) { x.classList.toggle('on', x === t); }); tap(); $('rdcc-ced').focus(); return; }
    if (t.dataset.f) { v.fuente = t.dataset.f; [].forEach.call(t.parentNode.children, function (x) { x.classList.toggle('sel', x === t); }); tap(); return; }
    var a = t.dataset.a;
    if (a === 'next') i === Q ? submit() : go(1);
    else if (a === 'back') go(-1);
    else if (a === 'close') window.closeAuthSheet();
    else if (a === 'login') window.showLandingAuth('login');
    else if (a === 'eye') {
      e.preventDefault();
      var p = $('rdcc-pass'), p2 = $('rdcc-pass2'), show = p.type === 'password';
      p.type = p2.type = show ? 'text' : 'password'; t.textContent = show ? 'ocultar' : 'ver'; t.classList.toggle('on', show);
    }
  });

  root.addEventListener('input', function (e) {
    var el = e.target, k = (el.id || '').replace('rdcc-', '');
    if (k === 'ced') { v.ced = el.value.replace(/\D/g, '').slice(0, 9); el.value = v.ced.replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
    else if (k === 'tel') { v.tel = el.value.replace(/\D/g, '').replace(/^0/, '').slice(0, 10); el.value = fmtTel(v.tel); }
    else if (k === 'user') { v.userTouched = true; v.user = el.value.toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 24); el.value = v.user; }
    else if (k in v) v[k] = el.value;
    var h = $('rdcc-h');
    if (h) {
      h.classList.remove('bad');
      if (k === 'pass' || k === 'pass2') h.textContent = v.pass && v.pass.length < 8 ? 'faltan ' + (8 - v.pass.length) : v.pass2 && v.pass2 === v.pass ? 'coinciden.' : '';
      else h.textContent = '';
    }
  });

  root.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || !e.target.matches('input')) return;
    e.preventDefault();
    var ins = [].slice.call(stage.querySelectorAll('input')), j = ins.indexOf(e.target);
    if (j < ins.length - 1) ins[j + 1].focus(); else i === Q ? submit() : go(1);
  });

  function on() {
    hide.forEach(function (el) { el.classList.add('rdcc-hide'); });
    inner.classList.add('rdcc-on');
    // cada vez que se abre arranca en el intro; lo ya escrito se conserva
    i = 0; render(1);
  }
  function off() {
    if (!inner.classList.contains('rdcc-on')) return;
    inner.classList.remove('rdcc-on');
    hide.forEach(function (el) { el.classList.remove('rdcc-hide'); });
    // términos de vuelta a su sitio
    var tw = $('auth-terms-wrap'), host = $('auth-cedula-wrap');
    if (tw && host && host.parentNode) host.parentNode.appendChild(tw);
  }

  // app nativa (Android 48+, iOS con __RD_NATIVE_SIGNUP): la hoja la dibuja la app,
  // con los mismos pasos; al final manda los datos a RDNT.signup → nativeSubmit
  var H = window.__RD_NATIVE_SIGNUP && window.webkit && webkit.messageHandlers && webkit.messageHandlers.rdTabs;
  function theme() { return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'; }

  var _show = window.showLandingAuth;
  window.showLandingAuth = function (mode) {
    if (mode === 'register' && H) {
      try { window.closeAuthSheet(); } catch (e) {}
      try { H.postMessage({ ev: 'signup', theme: theme() }); return; } catch (e) {}
    }
    var r = _show.apply(this, arguments);
    mode === 'register' ? on() : off();
    return r;
  };

  async function nativeSubmit(d) {
    d = d || {};
    toForm(d);
    var tc = $('auth-terms-check');
    if (tc) { tc.checked = true; try { window.updateAuthTerms(tc); } catch (e) {} }
    try { authMode = 'register'; authUserType = 'particular'; } catch (e) {}
    var overIntro = !!$('rd-intro');
    try {
      await window._rueddaRegister(String(d.mail || '').trim(), d.pass || '');
      if (overIntro && $('rd-intro') && typeof window._rdIntroDismiss === 'function') window._rdIntroDismiss();
      return { ok: true };
    } catch (e) {
      return { ok: false, err: (e && e.message) || 'no se pudo crear la cuenta' };
    }
  }

  window.RDCC = { on: on, off: off, nativeSubmit: nativeSubmit };
})();
