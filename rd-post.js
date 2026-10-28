/* [2026-10-22] Posts como capa (estilo Marketplace).
   Antes: abrir un post escondía la pantalla de abajo y al salir se pintaba un splash
   negro de 1,3 s mientras se volvía a armar todo. Ahora la pantalla de origen queda
   congelada en su sitio (position:fixed con su mismo scroll) y el post entra encima:
     · entra subiendo suave (WAAPI, solo transform/opacity → GPU)
     · se cierra deslizando hacia abajo desde arriba del post: sigue el dedo 1:1, se
       encoge un poco, la pantalla de abajo se ve debajo; si lo sueltas rápido se va con
       la velocidad del dedo, si no, vuelve con resorte
     · swipe a la derecha, botón volver y el "atrás" del sistema cierran igual, sin splash
   Al cerrar se destapa la pantalla de abajo tal cual estaba (mismo scroll, sin re-render).
   [2026-10-22 b] la pantalla de abajo ya NO se congela con position:fixed: se queda en su
   sitio, en el flujo, con el mismo scroll de la página. Es el post el que va encima, fijo
   y con su propio scroll. Antes, al cerrar, la de abajo volvía del fixed al flujo y se
   restauraba el scroll en el mismo cuadro: WebKit tenía que repintar todo el home en otra
   capa y ese cuadro salía negro ("como recargando"). Ahora al cerrar no se mueve nada.
   Si el post se abrió sin pantalla de origen (link directo), queda el flujo de siempre. */
(function () {
  if (typeof window.showView !== 'function') return;
  var DETAIL = { 'market-detail': 1, 'detail': 1 };
  // pantallas que pueden quedar debajo (ninguna trae barras fijas propias visibles)
  var UNDER_OK = { home: 1, favoritos: 1, 'perfil-publico': 1, vitrina: 1, notificaciones: 1, 'hotdeals-all': 1, 'encuentra-all': 1, marcas: 1, 'usuarios-top': 1, alquileres: 1, cuenta: 1 };
  var reduce = false;
  try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var st = null;        // { name, el, y, nav } pantalla congelada
  // [V168] apertura tipo Marketplace: la foto de la tarjeta tocada vuela a su lugar en la
  // galería en el MISMO instante del toque (antes de armar el post) y el resto sube detrás.
  // La foto vuela solo con transform (contenedor que escala + imagen que contra-escala para no
  // deformarse), así la mueve la GPU aunque el hilo principal esté ocupado armando el post.
  var tapAt = null, fly = null, gCache = {};
  function bez(x1, y1, x2, y2) {
    function cx(t) { return 3 * x1 * t * (1 - t) * (1 - t) + 3 * x2 * t * t * (1 - t) + t * t * t; }
    function cy(t) { return 3 * y1 * t * (1 - t) * (1 - t) + 3 * y2 * t * t * (1 - t) + t * t * t; }
    return function (x) { var lo = 0, hi = 1, t = x; for (var i = 0; i < 22; i++) { t = (lo + hi) / 2; if (cx(t) < x) lo = t; else hi = t; } return cy(t); };
  }
  var EASE = 'cubic-bezier(.2,.9,.25,1)', ez = bez(0.2, 0.9, 0.25, 1);
  function cardPhoto(c) {
    var best = null, area = 0;
    [].forEach.call(c.querySelectorAll('img,[style*="background"]'), function (el) {
      var src = el.tagName === 'IMG' ? (el.complete && el.naturalWidth ? (el.currentSrc || el.src) : '') : ((getComputedStyle(el).backgroundImage.match(/url\(["']?(.*?)["']?\)/) || [])[1]);
      if (!src) return;
      var r = el.getBoundingClientRect(), a = r.width * r.height;
      if (a > area && r.width > 40) { area = a; best = { src: src, r: r }; }
    });
    return best;
  }
  function flyEnd() {
    if (!fly) return;
    var f = fly; fly = null;
    clearTimeout(f.tm);
    if (f.g) f.g.style.visibility = '';
    var rm = function () { if (f.el.parentNode) f.el.parentNode.removeChild(f.el); };
    if (!f.landed) { rm(); return; }
    var a = f.el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease-out', fill: 'forwards' });
    a.onfinish = rm;
  }
  // arranca el vuelo desde la foto de la tarjeta hasta el rect de la galería
  function startFly(ph, gr) {
    flyEnd();
    var W = gr.width, H = gr.height, r = ph.r, N = 18, kc = [], ki = [];
    for (var i = 0; i <= N; i++) {
      var p = ez(i / N);
      var x = r.left + (gr.left - r.left) * p, y = r.top + (gr.top - r.top) * p;
      var w = r.width + (W - r.width) * p, h = r.height + (H - r.height) * p;
      var sx = w / W, sy = h / H, k = Math.max(sx, sy);
      kc.push({ transform: 'translate3d(' + (x - gr.left).toFixed(2) + 'px,' + (y - gr.top).toFixed(2) + 'px,0) scale(' + sx.toFixed(4) + ',' + sy.toFixed(4) + ')' });
      ki.push({ transform: 'scale(' + (k / sx).toFixed(4) + ',' + (k / sy).toFixed(4) + ')' });
    }
    var el = document.createElement('div'), im = document.createElement('div');
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = 'position:fixed;z-index:61;pointer-events:none;overflow:hidden;transform-origin:0 0;left:' + gr.left + 'px;top:' + gr.top + 'px;width:' + W + 'px;height:' + H + 'px';
    im.style.cssText = 'position:absolute;inset:0;background:#111 center/cover no-repeat';
    im.style.backgroundImage = 'url("' + ph.src.replace(/"/g, '%22') + '")';
    el.appendChild(im); document.body.appendChild(el);
    var opt = { duration: 420, easing: 'linear', fill: 'forwards' };
    var a = el.animate(kc, opt); im.animate(ki, opt);
    fly = { el: el, g: null, done: false, landed: false };
    var f = fly;
    // si el post no llega a abrirse (sin conexión, otro toque), la foto no se queda pegada
    f.tm = setTimeout(function () { if (fly === f && !f.g) flyEnd(); }, 1600);
    a.onfinish = function () { f.done = true; f.landed = true; if (f.onLand) f.onLand(); };
  }
  document.addEventListener('click', function (e) {
    try {
      if (reduce) return;
      var c = e.target.closest && e.target.closest('[onclick*="openMarketDetail("],[onclick*="openDetail("]');
      if (!c || on()) return;
      var kind = /openMarketDetail\(/.test(c.getAttribute('onclick') || '') ? 'market-detail' : 'detail';
      var ph = cardPhoto(c);
      tapAt = { photo: ph, kind: kind, t: Date.now() };
      // con la galería ya medida en una apertura anterior, vuela en el acto
      if (ph && gCache[kind]) { startFly(ph, gCache[kind]); tapAt.flying = true; }
    } catch (err) {}
  }, true);
  function openFx(v, tap) {
    var g = v.querySelector('.photo-gallery');
    var rest = [].slice.call(v.querySelectorAll('.gallery-dots, .detail-content > *')).slice(0, 5);
    // fondo del post: casi instantáneo
    v.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 140, easing: 'linear' });
    if (shade.animate) shade.animate([{ opacity: 0 }, { opacity: 0.32 }], { duration: 200, easing: 'ease-out' });
    // lo demás sube detrás de la foto, en cascada corta
    rest.forEach(function (el, i) {
      el.animate([{ transform: 'translate3d(0,26px,0)', opacity: 0 }, { transform: 'none', opacity: 1 }],
        { duration: 420, delay: 70 + i * 35, easing: EASE, fill: 'backwards' });
    });
    if (!g) { flyEnd(); return; }
    var gr = g.getBoundingClientRect();
    if (gr.width > 40) gCache[currentView] = { left: gr.left, top: gr.top, width: gr.width, height: gr.height };
    var ph = tap && tap.photo;
    if (tap && tap.flying && fly) {
      // ya venía volando desde el toque
    } else if (ph && gr.width > 40) {
      startFly(ph, gCache[currentView]);
    } else {
      g.animate([{ transform: 'scale(.96)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 320, easing: EASE });
      return;
    }
    var f = fly; if (!f) return;
    f.g = g; g.style.visibility = 'hidden';
    // al aterrizar espera la primera foto grande de la galería (máx. 700 ms) y cruza
    f.onLand = function () {
      var img = g.querySelector('img'), t0 = Date.now();
      (function wait() {
        if (fly !== f) return;
        if (!img || (img.complete && img.naturalWidth) || Date.now() - t0 > 700) flyEnd(); else setTimeout(wait, 40);
      })();
    };
    if (f.done) f.onLand();
  }

  var closing = false;
  var ignorePop = 0;

  var css = document.createElement('style');
  css.textContent =
    '.view.rd-under{display:block!important;pointer-events:none;animation:none!important}' +
    '.view.rd-over{position:fixed!important;top:0;left:0;right:0;bottom:0;z-index:60;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;animation:none!important;box-shadow:0 -10px 40px rgba(0,0,0,.35)}' +
    '.view.rd-calm{animation:none!important}' +
    '#rd-sheet-shade{position:fixed;inset:0;z-index:59;background:#000;opacity:0;pointer-events:none}';
  document.head.appendChild(css);
  var shade = document.createElement('div');
  shade.id = 'rd-sheet-shade';
  function shadeTo(o) { shade.style.opacity = String(o); }

  function viewEl(n) { return document.getElementById('view-' + n); }
  function on() { return !!st && !!DETAIL[currentView]; }
  // scroll del post (en modo capa el post scrollea solo; la página sigue en el de abajo)
  function postTop() { var v = viewEl(currentView); return on() && v ? v.scrollTop : (window.scrollY || 0); }
  window._rdPostScroller = function () { return on() ? viewEl(currentView) : null; };
  window._rdSheetOn = on;
  window._rdSheetShade = function (p) { if (on()) shadeTo(0.32 * (1 - Math.min(1, p))); };

  function freeze(from) {
    var el = viewEl(from);
    if (!el) return false;
    var y = window.scrollY || document.documentElement.scrollTop || 0;
    var nav = document.querySelector('.bnav-item.active');
    el.classList.add('rd-under');
    if (!shade.parentNode) document.body.appendChild(shade);
    shadeTo(0.32);
    st = { name: from, el: el, y: y, nav: nav };
    return true;
  }

  // suelta la pantalla congelada sin animar (cuando se navega a otro lado desde el post)
  function release() {
    flyEnd();
    if (!st) return;
    st.el.classList.remove('rd-under');
    shadeTo(0);
    st = null;
  }
  // showView pone el scroll de la página en 0: la de abajo se queda donde estaba
  function keepY(y) {
    if ((window.scrollY || 0) !== y) { document.documentElement.scrollTop = y; document.body.scrollTop = y; }
  }

  var _show = window.showView;
  window.showView = function (name) {
    var from = currentView;
    document.querySelectorAll('.view.rd-calm').forEach(function (v) { if (v.id !== 'view-' + name) v.classList.remove('rd-calm'); });
    if (DETAIL[name] && !DETAIL[from] && !st && UNDER_OK[from] && freeze(from)) {
      var r = _show.apply(this, arguments);
      var v = viewEl(name);
      keepY(st.y);
      if (v) {
        v.classList.add('rd-over');
        v.scrollTop = 0;
        if (!reduce && v.animate) {
          openFx(v, tapAt && Date.now() - tapAt.t < 1500 ? tapAt : null);
        }
      }
      return r;
    }
    if (st && !DETAIL[name]) {
      var dv = viewEl(from);
      if (dv) { dv.classList.remove('rd-over'); dv.style.transform = ''; dv.style.borderRadius = ''; }
      release();
    }
    // de un post a otro (similares, subasta ↔ market): sigue siendo capa
    if (st && DETAIL[name] && DETAIL[from]) {
      var y0 = st.y, ov = viewEl(from);
      // reemplaza la entrada del post anterior: "atrás" cierra la capa de una vez
      var nf = false;
      try { nf = _navigatingFromPopstate; _navigatingFromPopstate = true; } catch (e) {}
      var r2;
      try { r2 = _show.apply(this, arguments); }
      finally { try { _navigatingFromPopstate = nf; } catch (e) {} }
      try { if (!nf) history.replaceState({ rueddaView: name, param: arguments[1] !== undefined ? arguments[1] : null }, '', location.href); } catch (e) {}
      keepY(y0);
      var nv = viewEl(name);
      if (ov && ov !== nv) { ov.classList.remove('rd-over'); ov.style.transform = ''; ov.style.borderRadius = ''; }
      if (nv) { nv.classList.add('rd-over'); nv.scrollTop = 0; }
      return r2;
    }
    return _show.apply(this, arguments);
  };

  // destapa la pantalla de abajo tal cual estaba
  function restore() {
    var v = viewEl(currentView), s = st;
    if (!s) return;
    if (typeof _stopViewerPresence === 'function') { try { _stopViewerPresence(); } catch (e) {} }
    if (v) {
      v.classList.remove('active', 'rd-over');
      v.style.transform = ''; v.style.borderRadius = ''; v.style.opacity = ''; v.style.transition = ''; v.style.willChange = ''; v.style.visibility = '';
    }
    s.el.classList.add('rd-calm', 'active');
    s.el.classList.remove('rd-under');
    shadeTo(0);
    currentView = s.name;
    document.querySelectorAll('.bnav-item').forEach(function (b) { b.classList.remove('active'); });
    if (s.nav) s.nav.classList.add('active');
    keepY(s.y);
    st = null;
    // rd-calm se queda hasta que la vista se vaya: quitarlo con la vista activa relanzaba
    // su animación de entrada (fundido desde 0) y el home "destellaba" al volver
  }

  // anima la salida desde donde esté el post y destapa
  function close(dir, vel, fromPop, instant) {
    if (!on() || closing) return false;
    closing = true;
    flyEnd();
    var v = viewEl(currentView);
    if (!fromPop) { ignorePop++; try { history.back(); } catch (e) { ignorePop--; } }
    try { navigator.vibrate && navigator.vibrate(0); } catch (e) {}
    var done = function () { closing = false; restore(); };
    if (!v || reduce || instant || !v.animate) { done(); return true; }
    var cur = getComputedStyle(v).transform;
    var H = window.innerHeight, W = window.innerWidth;
    var to = dir === 'right' ? 'translate3d(' + W + 'px,0,0)' : 'translate3d(0,' + H + 'px,0) scale(.92)';
    var dist = dir === 'right' ? W : H;
    var dur = Math.max(170, Math.min(330, dist / Math.max(vel || 0, 2.2)));
    v.style.willChange = 'transform';
    var a = v.animate([{ transform: cur === 'none' ? 'none' : cur }, { transform: to }],
      { duration: dur, easing: 'cubic-bezier(.25,.8,.3,1)', fill: 'forwards' });
    if (shade.animate) shade.animate([{ opacity: shade.style.opacity || 0.32 }, { opacity: 0 }], { duration: dur, fill: 'forwards' });
    a.onfinish = function () { done(); a.cancel(); shade.getAnimations && shade.getAnimations().forEach(function (x) { x.cancel(); }); };
    return true;
  }
  window._rdSheetClose = close;
  // gesto nativo de borde (app iOS): la foto del post la mueve iOS; aquí solo se
  // esconde el post para que se vea la pantalla de abajo, viva, mientras arrastras
  window._rdSheetPeek = function (hide) {
    var v = viewEl(currentView);
    if (!on() || !v) return false;
    v.style.visibility = hide ? 'hidden' : '';
    shadeTo(hide ? 0 : 0.32);
    return true;
  };

  // botón volver / swipe a la derecha / casita → misma salida, sin splash
  function wrapExit(name) {
    var orig = window[name];
    if (typeof orig !== 'function') return;
    window[name] = function (afterNav) {
      if (on()) {
        close(window._rdSheetDir || 'down', window._rdSheetVel || 0, !!window._rdSheetFromPop);
        window._rdSheetDir = null; window._rdSheetVel = 0;
        if (typeof afterNav === 'function') setTimeout(afterNav, 0);
        return;
      }
      return orig.apply(this, arguments);
    };
  }
  wrapExit('_rdExitMarketDetail');
  wrapExit('_rdExitAuctionDetail');

  // "atrás" del sistema: cierra la capa (y se traga el popstate que provoca nuestro history.back)
  // Safari móvil: deslizar desde el borde ya anima su propia vuelta atrás (con la foto de
  // la pantalla anterior); si encima animábamos la salida, el post "se iba dos veces".
  // Si el atrás llega justo después de un toque en el borde, la capa se cierra al instante.
  var edgeAt = -1e9;
  document.addEventListener('touchstart', function (e) {
    var x = e.touches && e.touches[0] ? e.touches[0].clientX : 99;
    if (x < 30 || x > window.innerWidth - 30) edgeAt = performance.now();
  }, { passive: true, capture: true });
  window.addEventListener('popstate', function (e) {
    if (ignorePop > 0) { ignorePop--; e.stopImmediatePropagation(); return; }
    if (on()) {
      e.stopImmediatePropagation();
      close('right', 0, true, performance.now() - edgeAt < 1800);
    }
  }, true);

  // ── gesto: deslizar hacia abajo para cerrar ──
  var g = null;
  document.addEventListener('touchstart', function (e) {
    if (!on() || closing || e.touches.length !== 1) { g = null; return; }
    if (postTop() > 0) { g = null; return; }
    var t = e.touches[0];
    if (e.target.closest && e.target.closest('input,textarea,select,[contenteditable],.rd-no-sheet-drag')) { g = null; return; }
    g = { x: t.clientX, y: t.clientY, dy: 0, decided: false, drag: false, hist: [[performance.now(), t.clientY]] };
  }, { passive: true });

  document.addEventListener('touchmove', function (e) {
    if (!g) return;
    var t = e.touches[0], dx = t.clientX - g.x, dy = t.clientY - g.y;
    if (!g.decided && dy > 0 && dy >= Math.abs(dx) && postTop() <= 0) e.preventDefault();
    if (!g.decided) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      g.decided = true;
      g.drag = dy > 0 && Math.abs(dy) > Math.abs(dx) * 1.2 && postTop() <= 0;
      if (!g.drag) { g = null; return; }
      g.y = t.clientY - 1; dy = 1;
      var v0 = viewEl(currentView); if (v0) { v0.style.willChange = 'transform'; v0.style.transition = 'none'; }
    }
    e.preventDefault();
    var now = performance.now();
    g.hist.push([now, t.clientY]); while (g.hist.length > 2 && now - g.hist[0][0] > 90) g.hist.shift();
    g.dy = Math.max(0, dy);
    var H = window.innerHeight, p = Math.min(1, g.dy / H);
    var v = viewEl(currentView);
    if (v) {
      v.style.transform = 'translate3d(0,' + g.dy + 'px,0) scale(' + (1 - p * 0.1).toFixed(4) + ')';
      v.style.borderRadius = Math.min(28, g.dy / 4) + 'px';
      v.style.overflow = 'hidden';
    }
    shadeTo(0.32 * (1 - p * 1.6 < 0 ? 0 : 1 - p * 1.6));
  }, { passive: false });

  function end() {
    if (!g || !g.drag) { g = null; return; }
    var h = g.hist, a = h[0], b = h[h.length - 1];
    var vel = (b[1] - a[1]) / Math.max(16, b[0] - a[0]); // px/ms hacia abajo
    var dy = g.dy; g = null;
    var v = viewEl(currentView);
    if (dy > window.innerHeight * 0.2 || (vel > 0.55 && dy > 24)) {
      try { window._rdHapticNow && window._rdHapticNow('LIGHT'); } catch (e) {}
      if (v) v.style.overflow = '';
      close('down', vel, false);
      return;
    }
    if (!v) return;
    // vuelve con resorte
    var cur = v.style.transform;
    v.style.transform = ''; v.style.borderRadius = ''; v.style.overflow = '';
    if (v.animate) {
      v.animate([{ transform: cur }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.32,1.25,.5,1)' })
        .onfinish = function () { v.style.willChange = ''; };
    }
    shadeTo(0.32);
  }
  document.addEventListener('touchend', end, { passive: true });
  document.addEventListener('touchcancel', end, { passive: true });
})();
