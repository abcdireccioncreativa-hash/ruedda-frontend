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
  // [V187] dónde queda la galería, guardado entre sesiones (si la pantalla es la misma)
  var GK = 'rd_gcache_v1', gDim = innerWidth + 'x' + innerHeight;
  try { var gs = JSON.parse(localStorage.getItem(GK) || 'null'); if (gs && gs.d === gDim) gCache = gs.c || {}; } catch (e) {}
  function gSave() { try { localStorage.setItem(GK, JSON.stringify({ d: gDim, c: gCache })); } catch (e) {} }
  // app iOS: el post se queda invisible hasta que iOS tomó la foto limpia de la tarjeta
  var pendingReveal = null;
  function reveal() { var f = pendingReveal; pendingReveal = null; if (f) f(); }
  var revealHook = null, replaying = false;
  window._rdPostReveal = function () { var f = revealHook; revealHook = null; if (f) f(); return true; };
  // [V173] app iOS 1.7 (47)+: la foto la vuela iOS (Core Animation, resorte nativo) y los
  // gestos de salida también son nativos. La web solo avisa dónde está la foto y a dónde va.
  var NH = window.__RD_NATIVE_POST && window.webkit && webkit.messageHandlers && webkit.messageHandlers.rdTabs;
  window._rdNativePost = !!NH;
  // los gestos de cerrar (bajar / borde) solo los hace nativos iOS; Android usa su atrás predictivo
  // para el borde y la web sigue haciendo el arrastre hacia abajo
  window._rdNativeDrag = !!NH && !window.__RD_AND;
  function nPost(m) { try { NH.postMessage(m); } catch (e) {} }
  // [V184] app 1.7 build 48+: la app tiene en memoria las fotos de las tarjetas que se ven y vuela
  // la foto REAL (no una foto de la pantalla): sin pedazos, zoom ni etiquetas, y sin esperar cuadros
  var NI = NH && window.__RD_NATIVE_IMG, imgReady = {}, imgSent = {};
  window._rdImgReady = function (src) { imgReady[src] = 1; return true; };
  function scanImgs() {
    if (!NI || document.hidden || on()) return;
    var out = [], H = innerHeight;
    document.querySelectorAll('[onclick*="openMarketDetail("] img,[onclick*="openDetail("] img,.market-card img,.auction-card img').forEach(function (im) {
      if (out.length >= 16 || !im.complete || !im.naturalWidth) return;
      var src = im.currentSrc || im.src;
      if (!src || imgSent[src] || /^data:/.test(src)) return;
      var r = im.getBoundingClientRect();
      // a la vista (o a media pantalla de llegar) y del tamaño de una foto, no un logo
      if (r.width < 60 || r.height < 40 || r.bottom < -H * 0.5 || r.top > H * 1.5 || r.right < -40 || r.left > innerWidth * 1.6) return;
      imgSent[src] = 1; out.push(src);
    });
    if (out.length) nPost({ ev: 'pimg', srcs: out });
  }
  if (NI) {
    setTimeout(function () { try { var c0 = document.querySelector('.market-card,[onclick*="openMarketDetail("]'); if (c0) cardPhoto(c0); } catch (e) {} }, 4000);
    var scanT = 0;
    var scanSoon = function () { clearTimeout(scanT); scanT = setTimeout(scanImgs, 160); };
    document.addEventListener('scroll', scanSoon, { capture: true, passive: true });
    document.addEventListener('load', function (e) { if (e.target && e.target.tagName === 'IMG') scanSoon(); }, true);
    setInterval(scanImgs, 1500);
  }
  function rectA(r) { return [r.left, r.top, r.width, r.height]; }
  // la foto "sale" de la tarjeta: mientras el post aparece, la tarjeta de origen (con su #1,
  // precio, vistas…) no se ve debajo; vuelve sola cuando el post ya la tapa del todo
  function emptyCard(c) {
    if (!c || c._rdEmpty) return;
    c._rdEmpty = 1; c.style.visibility = 'hidden'; emptied = c;
    setTimeout(refill, 560);
  }
  var emptied = null;
  function refill() { var c = emptied; emptied = null; if (c) { c.style.visibility = ''; c._rdEmpty = 0; } }
  // lo que va ENCIMA de la foto en la tarjeta (featured, #1, precio, vistas…): iOS fotografía
  // la tarjeta, así que se esconde un par de cuadros para que la foto vuele limpia
  function hideOver(c, ph) {
    var hid = [], r = ph.r;
    var over = function (s) {
      if (s === ph.el || s.contains(ph.el)) return;
      var q = s.getBoundingClientRect();
      if (q.right <= r.left || q.left >= r.right || q.bottom <= r.top || q.top >= r.bottom || !q.width) return;
      if (getComputedStyle(s).visibility === 'hidden') return;
      s.style.visibility = 'hidden'; hid.push(function () { s.style.visibility = ''; });
    };
    [].forEach.call(ph.el.children, over);
    for (var n = ph.el; n && n !== c; n = n.parentNode) [].forEach.call(n.parentNode.children, function (s) { if (s !== n) over(s); });
    // [V182] la foto se toma con las esquinas rectas: el redondeo lo pone la copia nativa y lo
    // endereza en el vuelo (si no, las esquinas de la tarjeta quedaban pintadas en la foto).
    // Solo las esquinas que recortan la foto: el resto de la tarjeta no cambia.
    var P = ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius'];
    (ph.cut || []).forEach(function (x) {
      var st = x.el.style, keep = P.map(function (p) { return st[p]; });
      P.forEach(function (p, i) { if (x.k[i]) st[p] = '0px'; });
      hid.push(function () { P.forEach(function (p, i) { st[p] = keep[i]; }); });
    });
    return hid;
  }
  // [V182] dónde caen en la galería los MISMOS píxeles que se ven en la tarjeta (las dos usan
  // object-fit: cover). La copia aterriza ahí y el resto de la foto aparece alrededor: sin zoom.
  function fullAt(ph, G) {
    if (!G || !ph || !ph.nw || !ph.nh) return null;
    var C = ph.r, nw = ph.nw, nh = ph.nh;
    var sc = Math.max(C.width / nw, C.height / nh);
    var sx = -(C.width - nw * sc) * ph.px / sc, sy = -(C.height - nh * sc) * ph.py / sc;
    var sg = Math.max(G.width / nw, G.height / nh);
    var gx = G.left + (G.width - nw * sg) / 2, gy = G.top + (G.height - nh * sg) / 2;
    return { left: gx + sx * sg, top: gy + sy * sg, width: C.width / sc * sg, height: C.height / sc * sg };
  }
  // [V185] ya no se fotografía la pantalla para volar (la foto de la tarjeta armaba el post tarde y
  // aparecía de golpe): en la app 47 todo usa la animación web; la 48+ vuela la foto real (NI)
  function landAt(ph, G) {
    var T = fullAt(ph, G);
    if (!T) return G;
    // lo que cae fuera de la galería no se ve: se recorta a ella. Como las dos fotos van centradas,
    // la copia (aspect fill) queda con los mismos píxeles que la galería en ese recuadro
    var l = Math.max(T.left, G.left), t = Math.max(T.top, G.top), rr = Math.min(T.left + T.width, G.left + G.width), bb = Math.min(T.top + T.height, G.top + G.height);
    if (!(rr - l > 40 && bb - t > 40)) return G;
    return { left: l, top: t, width: rr - l, height: bb - t };
  }
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
      if (a > area && r.width > 40) { area = a; best = { src: src, r: r, el: el }; }
    });
    if (best) {
      // tamaño real y encuadre de la foto (para que la copia aterrice sobre los mismos píxeles)
      var bel = best.el;
      if (bel.tagName === 'IMG' && bel.naturalWidth && /cover/.test(getComputedStyle(bel).objectFit)) {
        var op = getComputedStyle(bel).objectPosition.split(' ');
        var pc = function (v) { return /%$/.test(v || '') ? parseFloat(v) / 100 : 0.5; };
        best.nw = bel.naturalWidth; best.nh = bel.naturalHeight; best.px = pc(op[0]); best.py = pc(op[1]);
      }
      // [V182] esquinas que de verdad recortan la foto: las de un contenedor (la foto misma, su
      // marco o la tarjeta) que coinciden con la esquina de la foto
      var R = best.r, cut = [];
      for (var n = best.el; n && n !== c.parentNode; n = n.parentNode) {
        var cs = getComputedStyle(n), q = n.getBoundingClientRect();
        var L = Math.abs(q.left - R.left) < 2, Rt = Math.abs(q.right - R.right) < 2, T = Math.abs(q.top - R.top) < 2, B = Math.abs(q.bottom - R.bottom) < 2;
        var k = [T && L && parseFloat(cs.borderTopLeftRadius), T && Rt && parseFloat(cs.borderTopRightRadius), B && L && parseFloat(cs.borderBottomLeftRadius), B && Rt && parseFloat(cs.borderBottomRightRadius)];
        if (k.some(function (x) { return x > 0; })) cut.push({ el: n, k: k.map(function (x) { return x > 0; }) });
        best.rad = Math.max(best.rad || 0, k[0] || 0, k[1] || 0, k[2] || 0, k[3] || 0);
      }
      best.cut = cut;
      var top = cut.some(function (x) { return x.k[0] || x.k[1]; }), bot = cut.some(function (x) { return x.k[2] || x.k[3]; });
      // la foto va arriba en la tarjeta y el texto debajo: solo redondea las esquinas de arriba
      best.topOnly = top && !bot;
      if (!top && !bot) best.rad = 0;
    }
    return best;
  }
  function kindOf(ph) { return ph && ph.kind || 'market-detail'; }
  function flyEnd() {
    if (!fly) return;
    var f = fly; fly = null;
    clearTimeout(f.tm);
    if (f.g) f.g.style.visibility = '';
    if (f.native) {
      // aterrizó: la galería ya está visible debajo; se espera a que pinte (2 cuadros) y
      // iOS desvanece su copia. Si no llegó a aterrizar, iOS la quita ya.
      if (f.res) requestAnimationFrame(function () { requestAnimationFrame(function () { f.res(true); }); });
      else nPost({ ev: 'postEnd' });
      return;
    }
    var rm = function () { if (f.el.parentNode) f.el.parentNode.removeChild(f.el); };
    if (!f.landed) { rm(); return; }
    // la galería ya está visible DEBAJO de la copia: se espera a que pinte (2 cuadros)
    // antes de desvanecer la copia, así nunca queda un cuadro vacío (titileo)
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      var a = f.el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'ease-out', fill: 'forwards' });
      a.onfinish = rm;
    }); });
  }
  // arranca el vuelo desde la foto de la tarjeta hasta el rect de la galería
  function startFly(ph, gr) {
    flyEnd();
    if (NH && ph.nat) {
      fly = { el: null, g: null, done: false, landed: false, native: true };
      var nf = fly;
      // g: donde aterriza la copia (los mismos píxeles de la tarjeta, ya en la galería)
      var m = { ev: 'postOpen', r: rectA(ph.r), g: gr ? rectA(ph.real ? gr : landAt(ph, gr)) : null, rad: ph.rad || 0, topOnly: !!ph.topOnly };
      // foto real: la app la encuadra igual que la tarjeta (cover + object-position) y la lleva
      // al encuadre de la galería (cover centrado), con g = la galería entera
      if (ph.real) {
        m.src = ph.src; m.nw = ph.nw; m.nh = ph.nh; m.px = ph.px; m.py = ph.py;
        // [V187] la app sube una lámina del color del post junto con la foto: el post nunca cae de
        // golpe aunque tarde en pintarse; se disuelve cuando la web avisa que ya pintó (postShown)
        var pv = viewEl(DETAIL[currentView] ? currentView : kindOf(ph)), nb = document.querySelector('.navbar');
        m.bg = pv ? getComputedStyle(pv).backgroundColor : '';
        m.top = nb ? Math.max(0, nb.getBoundingClientRect().bottom) : 0;
      }
      nPost(m);
      // iOS ya tomó la foto (limpia: las etiquetas se escondieron un cuadro antes). Confirma con
      // RDNT.postReveal y entonces se muestra el post y la tarjeta se vacía; tope 300 ms
      var hid = ph.hid || []; ph.hid = null;
      var done = function () {
        ph.snapped = true;
        hid.forEach(function (f) { f(); }); emptyCard(ph.card);
        // [V182] el post se arma recién ahora: mientras iOS fotografía la tarjeta la web no
        // trabaja, así la pantalla que fotografía es seguro la limpia
        if (ph.replay) { var rp = ph.replay; ph.replay = null; rp(); }
        reveal();
      };
      revealHook = done;
      setTimeout(function () { if (revealHook === done) { revealHook = null; done(); } }, 300);
      nf.tm = setTimeout(function () { if (fly === nf && !nf.g) flyEnd(); }, 900);
      return;
    }
    var W = gr.width, H = gr.height, r = ph.r, N = 18, kc = [], ki = [], kr = [];
    for (var i = 0; i <= N; i++) {
      var p = ez(i / N);
      var x = r.left + (gr.left - r.left) * p, y = r.top + (gr.top - r.top) * p;
      var w = r.width + (W - r.width) * p, h = r.height + (H - r.height) * p;
      var sx = w / W, sy = h / H, k = Math.max(sx, sy);
      // esquinas: nace con el redondeo de la tarjeta y llega recta a la galería. El contenedor
      // está escalado distinto en x/y, así que el radio va en sus coordenadas (elíptico).
      var R = (ph.rad || 0) * (1 - p), rh = (R / sx).toFixed(2) + 'px', rv = (R / sy).toFixed(2) + 'px', bh = ph.topOnly ? '0px' : rh, bv = ph.topOnly ? '0px' : rv;
      kr.push({ borderRadius: rh + ' ' + rh + ' ' + bh + ' ' + bh + ' / ' + rv + ' ' + rv + ' ' + bv + ' ' + bv });
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
    emptyCard(ph.card);
    var a = el.animate(kc, opt); im.animate(ki, opt);
    // aparte: el radio no se acelera en GPU y no debe frenar el vuelo (transform sí va en GPU)
    if (ph.rad) el.animate(kr, opt);
    fly = { el: el, g: null, done: false, landed: false };
    var f = fly;
    // si el post no llega a abrirse (sin conexión, otro toque), la foto no se queda pegada
    f.tm = setTimeout(function () { if (fly === f && !f.g) flyEnd(); }, 1600);
    a.onfinish = function () { f.done = true; f.landed = true; if (f.onLand) f.onLand(); };
  }
  // iOS: la foto llegó a la galería. Resuelve cuando la galería real ya pintó debajo.
  window._rdPostLand = function () {
    var f = fly;
    if (!f || !f.native) return true;
    return new Promise(function (res) {
      f.res = res; f.done = true; f.landed = true;
      if (f.onLand) f.onLand();
      setTimeout(function () { res(true); }, 1400);
    });
  };
  document.addEventListener('click', function (e) {
    try {
      if (reduce) return;
      // tarjetas con onclick en el HTML y las del feed general (.market-card / .auction-card,
      // que traen el click asignado por JS)
      var c = e.target.closest && e.target.closest('[onclick*="openMarketDetail("],[onclick*="openDetail("],.market-card,.auction-card');
      if (!c || on() || replaying) return;
      // un botón dentro de la tarjeta (favorito, compartir…) no abre el post
      var inner = e.target.closest('button,a,[onclick]');
      if (inner && inner !== c && c.contains(inner)) return;
      var oc = c.getAttribute('onclick') || '';
      var kind = /openMarketDetail\(/.test(oc) || (!oc && c.classList.contains('market-card')) ? 'market-detail' : 'detail';
      var ph = cardPhoto(c);
      if (ph) { ph.card = c; ph.kind = kind; }
      tapAt = { photo: ph, kind: kind, t: Date.now() };
      if (ph && NI && ph.nw && imgReady[ph.src] && ph.el.tagName === 'IMG') {
        // [V184] foto real ya en la app: vuela en el acto y el post se arma con este mismo toque
        // (no hace falta esconder etiquetas ni esperar cuadros: la app no fotografía la pantalla)
        ph.nat = true; ph.real = true; ph.hid = [];
        tapAt.flying = true;
        startFly(ph, gCache[kind] || null);
        return;
      }
      // con la galería ya medida en una apertura anterior, vuela en el acto
      if (ph && gCache[kind]) { startFly(ph, gCache[kind]); tapAt.flying = true; }
    } catch (err) {}
  }, true);
  function openFx(v, tap) {
    var g = v.querySelector('.photo-gallery');
    var rest = [].slice.call(v.querySelectorAll('.gallery-dots, .detail-content > *')).slice(0, 5);
    // fondo del post: casi instantáneo
    var show = function () {
      if (!on()) return;
      v.style.opacity = ''; shadeTo(0.32);
      var va = v.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 140, easing: 'linear' });
      if (NH && tap && tap.photo && tap.photo.real) va.onfinish = function () { requestAnimationFrame(function () { nPost({ ev: 'postShown' }); }); };
      if (shade.animate) shade.animate([{ opacity: 0 }, { opacity: 0.32 }], { duration: 200, easing: 'ease-out' });
    };
    if (NH && tap && tap.flying && tap.photo && tap.photo.nat && !tap.photo.real && !tap.photo.snapped) {
      // (app iOS: invisible hasta el cuadro siguiente a la foto limpia; tope por si acaso)
      v.style.opacity = '0'; shadeTo(0);
      pendingReveal = show; setTimeout(reveal, 500);
    } else show();
    // lo demás sube detrás de la foto, en cascada corta
    rest.forEach(function (el, i) {
      el.animate([{ transform: 'translate3d(0,26px,0)', opacity: 0 }, { transform: 'none', opacity: 1 }],
        { duration: 420, delay: 70 + i * 35, easing: EASE, fill: 'backwards' });
    });
    if (!g) { flyEnd(); return; }
    var gr = g.getBoundingClientRect();
    if (gr.width > 40) {
      var gn = { left: gr.left, top: gr.top, width: gr.width, height: gr.height }, go = gCache[currentView];
      gCache[currentView] = gn;
      if (!go || go.top !== gn.top || go.height !== gn.height || go.width !== gn.width) { gDim = innerWidth + 'x' + innerHeight; gSave(); }
    }
    var ph = tap && tap.photo;
    if (tap && tap.flying && fly) {
      // ya venía volando desde el toque (iOS: primera apertura, ahora sabe a dónde va)
      if (fly.native && gCache[currentView]) nPost({ ev: 'postTarget', g: rectA(ph && ph.real ? gCache[currentView] : landAt(ph, gCache[currentView])) });
    } else if (ph && gr.width > 40) {
      startFly(ph, gCache[currentView]);
    } else {
      g.animate([{ transform: 'scale(.96)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 320, easing: EASE });
      return;
    }
    var f = fly; if (!f) return;
    f.ph = ph;
    hookLand(f, g, ph);
  }
  function hookLand(f, g, ph) {
    f.g = g; g.style.visibility = 'hidden';
    // al aterrizar espera la primera foto grande de la galería (máx. 700 ms) y cruza
    f.onLand = function () {
      // la foto real de la galería (no el borroso de 40 px que la acompaña mientras carga)
      var hd = g.querySelector('img:not(.rd-lq)'), lq = g.querySelector('img.rd-lq');
      var go = function () { if (fly === f) flyEnd(); };
      var show = function () {
        // ya lista: se pone visible YA (sin su fundido propio) para que al irse la copia no
        // quede un instante del borroso debajo, que se veía como si recargara
        hd.style.transition = 'none'; hd.style.opacity = '1';
        go();
      };
      if (hd && hd.complete && hd.naturalWidth) { (hd.decode ? hd.decode() : Promise.resolve()).then(show, show); return; }
      // aún no llega la grande: debajo se pone la misma foto de la tarjeta (ya descargada),
      // nítida, y la grande entra encima con su fundido cuando llegue. Nada parpadea.
      if (lq && ph) {
        lq.style.filter = 'none'; lq.style.transform = 'none'; lq.style.opacity = '1';
        lq.src = ph.src;
        (lq.decode ? lq.decode() : Promise.resolve()).then(go, go);
      } else if (hd) {
        var cap = setTimeout(go, 1200);
        hd.addEventListener('load', function () { clearTimeout(cap); show(); }, { once: true });
      } else go();
    };
    if (f.done) f.onLand();
  }
  // [V186] la app no pudo volar la foto (no la tenía en memoria, o el post tardó en armarse): la
  // misma foto vuela con la animación web. Antes la galería se quedaba escondida esperando un
  // aterrizaje que nunca llegaba (post con la galería negra)
  window._rdPostDrop = function (src) {
    if (src) { delete imgReady[src]; delete imgSent[src]; }
    var f = fly, ph = tapAt && tapAt.photo;
    if (ph) { ph.nat = false; ph.real = false; }
    var h = revealHook; revealHook = null; if (h) h();
    if (!f || !f.native || f.landed) return true;
    fly = null; clearTimeout(f.tm);
    var g = f.g;
    if (!g) return true;
    g.style.visibility = '';
    ph = f.ph;
    var gr = g.getBoundingClientRect();
    if (!ph || !on() || gr.width <= 40) return true;
    startFly(ph, { left: gr.left, top: gr.top, width: gr.width, height: gr.height });
    if (fly) hookLand(fly, g, ph);
    return true;
  };

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
  // para el gesto nativo: ¿el post está arriba del todo? y franja de la galería (no se roba su swipe)
  window._rdPostGeo = function () {
    if (!on()) return null;
    var v = viewEl(currentView), gl = v && v.querySelector('.photo-gallery'), gr = gl ? gl.getBoundingClientRect() : null;
    return { top: postTop() <= 0, g: gr && gr.height ? [Math.round(gr.top), Math.round(gr.bottom)] : null };
  };
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
    flyEnd(); refill();
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
    // el post se abrió fuera del modo capa (o se fue a otra parte): la foto no se queda volando
    if (fly) flyEnd();
    return _show.apply(this, arguments);
  };

  // destapa la pantalla de abajo tal cual estaba
  function restore() {
    var v = viewEl(currentView), s = st;
    refill();
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
    if (window._rdNativeDrag || !on() || closing || e.touches.length !== 1) { g = null; return; }
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
