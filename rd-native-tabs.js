/* ─────────────────────────────────────────────────────────────
   RUEDDA · BARRA NATIVA (app iOS 1.6 build 16+)
   La barra de abajo la dibuja iOS (UITabBar con Liquid Glass); mensajes y
   notificaciones son listas nativas (UIKit). Este módulo es su capa de datos y
   de navegación: los mismos datos (THREADS, NOTIFICATIONS) y las mismas funciones
   de siempre. Solo se descarga si la app trae window.__RD_NATIVE_TABS.
   web → iOS:  webkit.messageHandlers.rdTabs  ({ev:'state'|'dirty'|'vender'})
   iOS → web:  RDNT.*  (callAsyncJavaScript)
   ───────────────────────────────────────────────────────────── */
(function () {
  if (!window.__RD_NATIVE_TABS) return;
  var H = window.webkit && webkit.messageHandlers && webkit.messageHandlers.rdTabs;
  if (!H) return;
  function post(m) { try { H.postMessage(m); } catch (e) {} }
  var root = document.documentElement;
  root.classList.add('rd-ntabs');
  // la barra web sigue en su sitio (invisible) para saber cuándo algo la tapa
  var css = document.createElement('style');
  css.textContent = 'html.rd-ntabs .bottom-nav{opacity:0!important;transition:none!important}';
  document.head.appendChild(css);

  function guest() { try { return typeof isGuest === 'function' ? isGuest() : true; } catch (e) { return true; } }
  function theme() { return root.getAttribute('data-theme') === 'light' ? 'light' : 'dark'; }
  function vis(id) { var d = document.getElementById(id); return !!d && d.style.display === 'block'; }
  function img(u, w) { try { return u ? _tImg(u, { width: w, quality: 78 }) : ''; } catch (e) { return u || ''; } }
  var SEL = { 'bnav-home': 'home', 'bnav-notificaciones': 'notifs', 'bnav-favoritos': 'comunidad', 'bnav-mensajes': 'msgs', 'bnav-cuenta': 'cuenta' };

  // ¿algo (buscador, menú, hojas, splash, intro) tapa la barra? entonces la nativa se esconde
  function covered() {
    var n = document.querySelector('.bottom-nav');
    if (!n) return true;
    var cs = getComputedStyle(n);
    if (cs.display === 'none' || cs.visibility === 'hidden') return true;
    var r = n.getBoundingClientRect();
    if (!r.width || !r.height || r.top > innerHeight) return true;
    var el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !(el && n.contains(el));
  }
  // ¿hay a dónde volver con el gesto de borde? (no en las pantallas raíz de la barra,
  // ni si un menú u hoja web tapa el borde izquierdo)
  var ROOTS = { home: 1, favoritos: 1, notificaciones: 1, cuenta: 1 };
  function sheet() { return !!(window._rdSheetOn && window._rdSheetOn()); }
  function canBack() {
    try {
      if (edge) return false;
      if (ROOTS[currentView] && !sheet()) return false;
      if (!sheet() && !(history.state && history.state.rueddaView)) return false;
      var v = document.getElementById('view-' + currentView);
      var el = document.elementFromPoint(6, innerHeight / 2);
      return !!(v && el && v.contains(el));
    } catch (e) { return false; }
  }
  var edge = '';
  var last = '';
  function state() {
    var a = document.querySelector('.bottom-nav .bnav-item.active');
    var s = { ev: 'state', sel: a ? (SEL[a.id] || '') : '', hidden: covered(), back: canBack(), nd: vis('notif-dot'), md: vis('rd-msg-dot'), theme: theme(), logged: !guest() };
    var k = JSON.stringify(s);
    if (k !== last) { last = k; post(s); }
  }
  var queued = false;
  function soon() { if (queued) return; queued = true; requestAnimationFrame(function () { queued = false; state(); }); }
  new MutationObserver(soon).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style'] });
  window.addEventListener('resize', soon);
  setInterval(state, 600);

  // listas nativas al día
  var dirtyT = 0;
  function dirty() { clearTimeout(dirtyT); dirtyT = setTimeout(function () { post({ ev: 'dirty' }); }, 120); }
  ['renderNotifications', 'renderMensajesList', '_syncNotifBadge'].forEach(function (fn) {
    var o = window[fn];
    if (typeof o !== 'function') return;
    window[fn] = function () { var r = o.apply(this, arguments); dirty(); return r; };
  });

  // menú de vender: hoja nativa
  var webVender = window.openVenderModal;
  if (typeof webVender === 'function') {
    window.openVenderModal = function () {
      try { if (typeof updateVenderModal === 'function') updateVenderModal(); } catch (e) {}
      var opts = ['particular', 'subasta', 'consesionario', 'alquiler'].map(function (k) {
        var b = document.getElementById('vender-btn-' + k);
        if (!b || b.style.display === 'none') return null;
        var h = b.querySelector('h3'), p = b.querySelector('.vt-sub');
        return { k: k, t: h ? h.textContent.trim() : k, s: p ? p.textContent.trim() : '' };
      }).filter(Boolean);
      post({ ev: 'vender', theme: theme(), opts: opts });
    };
  }

  function lastMsg(t) { var m = t.messages && t.messages[t.messages.length - 1]; return m || null; }
  var RDNT = window.RDNT = {
    go: function (tab) {
      // el mismo "click" que sonaba al tocar la barra web
      try { window.RD_SND && RD_SND.play('click'); } catch (e) {}
      try {
        if (tab === 'home') goHome();
        else if (tab === 'notifs') _rdOpenNotifs();
        else if (tab === 'msgs') _rdOpenMensajes();
        else if (tab === 'comunidad') showView('favoritos');
        else if (tab === 'cuenta') showView('cuenta');
      } catch (e) {}
      last = ''; state();
      return { logged: !guest() };
    },
    inbox: function () {
      if (guest()) return { logged: false, rows: [] };
      var rows = (typeof THREADS !== 'undefined' ? THREADS : []).map(function (t) {
        var m = lastMsg(t);
        var dealer = !!(t.otherIsDealer || t.otherRole === 'concesionario' || t.otherRole === 'consesionario');
        var nm = t.isPM ? (t.otherName || 'usuario') : (((t.participants || []).find(function (p) { return !p.isSeller; }) || {}).user || 'usuario');
        var txt = m ? String(m.text || '').replace(/\n?\[\[rdpost:[\w-]+\]\]/g, ' · publicación').replace(/\s+/g, ' ').trim() : '';
        return { id: String(t.id), uid: t.isPM && t.otherId ? String(t.otherId) : '', name: nm, av: img(t.otherAvatar, 240), dealer: dealer, kyc: !!t.otherKyc,
          title: t.sourceTitle || t.carTitle || '', text: txt, mine: !!(m && (m.mine || m.sender_id === (USER_STATE && USER_STATE.id))),
          at: (m && (m.created_at || '')) || '', time: (m && m.time) || '', unread: !!t.unread };
      });
      return { logged: true, rows: rows };
    },
    notifs: function () {
      if (guest()) return { logged: false, rows: [] };
      var fb = false;
      try { fb = typeof _feedbackCardDismissed === 'function' && !_feedbackCardDismissed(); } catch (e) {}
      return { logged: true, fb: fb, rows: (typeof NOTIFICATIONS !== 'undefined' ? NOTIFICATIONS : []).map(function (n) {
        return { id: String(n.id), title: String(n.title || ''), body: String(n.body || ''), time: String(n.time || ''), read: !!n.read, type: n.type || '', icon: n.icon || '' };
      }) };
    },
    openThread: function (id) { try { openThread(id); } catch (e) {} return true; },
    // foto de una conversación → perfil (o vitrina del concesionario)
    profile: async function (id, dealer) {
      try { (dealer && typeof _openVitrinaByUserId === 'function' ? _openVitrinaByUserId : openUserProfile)(id); } catch (e) {}
      await new Promise(function (r) { setTimeout(r, 60); });
      last = ''; state();
      return true;
    },
    openGlobal: function () { try { openGlobalChat(); } catch (e) {} return true; },
    notifTap: function (id) {
      var before = currentView;
      try { _notifClick(id); } catch (e) {}
      // si abrió algo (otra vista o una hoja/popup web encima), la lista nativa se quita
      return new Promise(function (res) { setTimeout(function () { res({ view: currentView, moved: currentView !== before || covered() }); }, 90); });
    },
    notifDel: function (id) {
      try { _deleteNotif(id); } catch (e) {}
      try { renderNotifications(); } catch (e) {}
      try { _syncNotifBadge(); } catch (e) {}
      return true;
    },
    // tarjeta fija de feedback (reportar un bug / calificar en la App Store)
    feedback: function () { try { openFeedbackSheet(); } catch (e) {} return true; },
    feedbackDismiss: function () { try { _dismissFeedbackCard(); } catch (e) {} return true; },
    readAll: function () { try { markAllRead(); } catch (e) {} try { _syncNotifBadge(); } catch (e) {} return true; },
    refresh: async function (kind) {
      try {
        if (kind === 'notifs' && typeof _refreshNotifs === 'function') { window._notifRefreshAt = 0; await _refreshNotifs(); }
        if (kind === 'msgs' && typeof _loadPrivateMessages === 'function') await _loadPrivateMessages(true);
      } catch (e) {}
      return true;
    },
    edgeBegin: function () {
      if (!canBack()) return 'none';
      if (sheet()) { window._rdSheetPeek(true); edge = 'sheet'; }
      else { edge = 'nav'; try { history.back(); } catch (e) { edge = ''; return 'none'; } }
      return edge;
    },
    edgeEnd: async function (ok) {
      var m = edge;
      if (m === 'sheet') {
        if (ok) window._rdSheetClose('right', 0, false, true); else window._rdSheetPeek(false);
      } else if (m === 'nav' && !ok) {
        try { history.forward(); } catch (e) {}
        // que la pantalla vuelva a estar armada antes de quitar la foto
        await new Promise(function (r) { setTimeout(r, 420); });
      }
      edge = ''; last = ''; state();
      return true;
    },
    login: function () { try { showMobileAuth('login'); } catch (e) {} return true; },
    vender: function (k) { try { handleVenderClick(k); } catch (e) {} return true; },
    venderWeb: function () { try { webVender(); } catch (e) {} return true; }
  };
  if (document.readyState === 'complete') state(); else window.addEventListener('load', state);
})();
