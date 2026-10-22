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
   Si el post se abrió sin pantalla de origen (link directo), queda el flujo de siempre. */
(function () {
  if (typeof window.showView !== 'function') return;
  var DETAIL = { 'market-detail': 1, 'detail': 1 };
  // pantallas que pueden quedar debajo (ninguna trae barras fijas propias visibles)
  var UNDER_OK = { home: 1, favoritos: 1, 'perfil-publico': 1, vitrina: 1, notificaciones: 1, 'hotdeals-all': 1, 'encuentra-all': 1, marcas: 1, 'usuarios-top': 1, alquileres: 1, cuenta: 1 };
  var reduce = false;
  try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var st = null;        // { name, el, y, nav } pantalla congelada
  var closing = false;
  var ignorePop = 0;

  var css = document.createElement('style');
  css.textContent =
    '.view.rd-under{display:block!important;position:fixed!important;left:0;right:0;z-index:0;pointer-events:none;animation:none!important;contain:layout paint}' +
    '.view.rd-over{position:relative;z-index:2;animation:none!important;box-shadow:0 -10px 40px rgba(0,0,0,.35)}' +
    '.view.rd-calm{animation:none!important}' +
    '#rd-sheet-shade{position:fixed;inset:0;z-index:1;background:#000;opacity:0;pointer-events:none}';
  document.head.appendChild(css);
  var shade = document.createElement('div');
  shade.id = 'rd-sheet-shade';
  function shadeTo(o) { shade.style.opacity = String(o); }

  function viewEl(n) { return document.getElementById('view-' + n); }
  function on() { return !!st && !!DETAIL[currentView]; }
  window._rdSheetOn = on;
  window._rdSheetShade = function (p) { if (on()) shadeTo(0.32 * (1 - Math.min(1, p))); };

  function freeze(from) {
    var el = viewEl(from);
    if (!el) return false;
    var y = window.scrollY || document.documentElement.scrollTop || 0;
    var nav = document.querySelector('.bnav-item.active');
    el.style.top = (-y) + 'px';
    el.classList.add('rd-under');
    if (!shade.parentNode) document.body.appendChild(shade);
    shadeTo(0.32);
    st = { name: from, el: el, y: y, nav: nav };
    return true;
  }

  // suelta la pantalla congelada sin animar (cuando se navega a otro lado desde el post)
  function release() {
    if (!st) return;
    st.el.classList.remove('rd-under');
    st.el.style.top = '';
    shadeTo(0);
    st = null;
  }

  var _show = window.showView;
  window.showView = function (name) {
    var from = currentView;
    if (DETAIL[name] && !DETAIL[from] && !st && UNDER_OK[from] && freeze(from)) {
      var r = _show.apply(this, arguments);
      var v = viewEl(name);
      if (v) {
        v.classList.add('rd-over');
        if (!reduce && v.animate) {
          v.animate([{ transform: 'translate3d(0,44px,0)', opacity: 0 }, { transform: 'none', opacity: 1 }],
            { duration: 380, easing: 'cubic-bezier(.32,.72,0,1)' });
        }
      }
      return r;
    }
    if (st && !DETAIL[name]) {
      var dv = viewEl(from);
      if (dv) { dv.classList.remove('rd-over'); dv.style.transform = ''; dv.style.borderRadius = ''; }
      release();
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
    s.el.style.top = '';
    shadeTo(0);
    currentView = s.name;
    document.querySelectorAll('.bnav-item').forEach(function (b) { b.classList.remove('active'); });
    if (s.nav) s.nav.classList.add('active');
    document.documentElement.scrollTop = s.y; document.body.scrollTop = s.y;
    st = null;
    setTimeout(function () { s.el.classList.remove('rd-calm'); }, 60);
  }

  // anima la salida desde donde esté el post y destapa
  function close(dir, vel, fromPop, instant) {
    if (!on() || closing) return false;
    closing = true;
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
  window.addEventListener('popstate', function (e) {
    if (ignorePop > 0) { ignorePop--; e.stopImmediatePropagation(); return; }
    if (on()) {
      e.stopImmediatePropagation();
      close('right', 0, true);
    }
  }, true);

  // ── gesto: deslizar hacia abajo para cerrar ──
  var g = null;
  document.addEventListener('touchstart', function (e) {
    if (!on() || closing || e.touches.length !== 1) { g = null; return; }
    if ((window.scrollY || 0) > 0) { g = null; return; }
    var t = e.touches[0];
    if (e.target.closest && e.target.closest('input,textarea,select,[contenteditable],.rd-no-sheet-drag')) { g = null; return; }
    g = { x: t.clientX, y: t.clientY, dy: 0, decided: false, drag: false, hist: [[performance.now(), t.clientY]] };
  }, { passive: true });

  document.addEventListener('touchmove', function (e) {
    if (!g) return;
    var t = e.touches[0], dx = t.clientX - g.x, dy = t.clientY - g.y;
    if (!g.decided) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      g.decided = true;
      g.drag = dy > 0 && Math.abs(dy) > Math.abs(dx) * 1.2 && (window.scrollY || 0) <= 0;
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
