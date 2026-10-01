'use strict';
/* ════════════════════════════════════════════════════════════════
   RUEDDA OFFICE — arranque: puerta de escritorio, login, intro de
   carga ligada a pasos reales y cableado red → estado → UI/juego.
   ════════════════════════════════════════════════════════════════ */
(function(){
const RO = window.RO, UI = RO.UI, A = RO.Art, $ = RO.$, esc = RO.esc;
const S = RO.S;

const show = id => { ['gate', 'login', 'loader', 'app'].forEach(x => $('#' + x).classList.toggle('hidden', x !== id)); RO.PixLogo.mountAll($('#' + id)); UI.renderClocks(); };

/* ── solo escritorio ── */
function isDesktop() {
  const ua = navigator.userAgent;
  if (/Mobile|iPhone|iPad|iPod|Android|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return false;
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return false;              // iPad con UA de Mac
  if (matchMedia('(pointer:coarse)').matches && !matchMedia('(any-pointer:fine)').matches) return false;
  if (Math.max(screen.width, screen.height) < 1000) return false;
  return true;
}

/* ── login ── */
function showLogin(msg) {
  show('login');
  $('#lg-err').textContent = msg || '';
  if (RO.DEMO) $('#lg-demo').classList.remove('hidden');
  setTimeout(() => $('#lg-email').focus(), 60);
}
$('#login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const b = $('#lg-btn'); b.disabled = true; b.querySelector('span').textContent = 'Verificando…'; $('#lg-err').textContent = '';
  try { await RO.Net.signIn($('#lg-email').value.trim()); enter(); }
  catch (x) { $('#lg-err').textContent = x.message || 'No se pudo entrar.'; }
  b.disabled = false; b.querySelector('span').textContent = 'Entrar';
});

/* ── intro de carga ── */
const t0 = performance.now();
function log(line, cls) {
  const ts = ((performance.now() - t0) / 1000).toFixed(2).padStart(6, '0');
  const el = $('#ld-log'), row = document.createElement('div');
  row.innerHTML = `<span class="dim">[${ts}]</span> ${line}${cls ? ` <span class="${cls}">${cls === 'ok' ? 'OK' : 'ERROR'}</span>` : ''}`;
  el.appendChild(row); while (el.children.length > 8) el.firstChild.remove();
  return row;
}
function progress(p, title) {
  $('#ld-fill').style.width = Math.round(p * 100) + '%'; $('#ld-pct').textContent = Math.round(p * 100) + '%';
  if (title) $('#ld-title').textContent = title;
  RO.PixLogo.progress($('#ld-logo'), p);
}
async function step(p, title, line, fn) {
  progress(p, title);
  const row = log(line + ' …');
  try { const r = await fn(); row.insertAdjacentHTML('beforeend', ' <span class="ok">OK</span>'); return r; }
  catch (e) { row.insertAdjacentHTML('beforeend', ' <span class="bad">ERROR</span>'); throw e; }
}
function loaderError(html, canRetry) {
  const box = $('#ld-err'); box.classList.remove('hidden');
  box.innerHTML = html + `<div class="btns">${canRetry ? '<button data-r>Reintentar</button>' : ''}<button data-o>Usar otra cuenta</button></div>`;
  const r = box.querySelector('[data-r]'); if (r) r.onclick = () => location.reload();
  box.querySelector('[data-o]').onclick = async () => { await RO.Net.signOut(); location.reload(); };
}
const loadScript = src => new Promise((res, rej) => { if (window.Phaser) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('no cargó ' + src)); document.head.appendChild(s); });

async function enter() {
  show('loader');
  $('#ld-logo').dataset.progress = '1';
  await RO.PixLogo.mountAll($('#loader'));
  progress(0.02, 'conectando a servidores');
  log('ruedda office v1 · ' + (RO.DEMO ? 'modo demo local' : 'ltodsegzbbdcaublkgtp.supabase.co'));
  try {
    const joined = await step(0.14, 'verificando credencial', 'verificando credencial y rol en la empresa', async () => {
      const r = await RO.Net.join();
      if (!r || !r.ok) { const e = new Error('no_role'); e.code = 'NO_ROLE'; throw e; }
      return r;
    });
    S.me = joined.member;
    await step(0.32, 'cargando motor gráfico', 'cargando motor gráfico (phaser 3.90)', async () => {
      await Promise.all([
        loadScript('/vendor/phaser-3.90.0.min.js'),
        document.fonts ? Promise.race([document.fonts.load('10px Silkscreen'), new Promise(r => setTimeout(r, 2500))]) : null,
        A.loadLogo().then(img => { if (img) RO.logoBits = A.logoBits(img, 88); }),
        A.loadKenney()
      ]);
    });
    await step(0.52, 'sincronizando oficinas', 'sincronizando oficinas, notas y decoración', async () => {
      const d = await RO.Net.loadAll();
      S.members = d.members || []; S.config = RO.mergeConfig(d.config); S.catalog = d.catalog || []; S.decor = d.decor || [];
      S.notes = d.notes || []; S.events = d.events || []; S.positions = d.positions || []; S.chat = d.chat || [];
      RO.channelKey = d.channelKey;
      const mine = S.members.find(m => m.user_id === S.me.user_id);
      if (mine) S.me = Object.assign(mine, { _superadmin: S.me._superadmin });
      else S.members.push(S.me);
    });
    await step(0.72, 'conectando a servidores realtime', 'abriendo tiempo real', () => RO.Net.connect(S.me, RO.channelKey, NET).catch(e => { console.warn('[office] tiempo real no disponible, respaldo HTTP', e); }));
    await step(0.9, 'generando mundo', 'generando mundo pixel · ' + S.members.length + ' miembros', async () => {
      UI.WB.load(); UI.WB.loadNotes();
      // el contenedor debe tener tamaño real antes de crear el canvas (WebGL falla con 0×0); la intro lo tapa
      $('#app').classList.remove('hidden');
      await RO.G.start();
    });
    progress(1, 'bienvenido, ' + (S.me.display_name || '').toLowerCase());
    log('presencia: ' + Math.max(1, S.online.size) + ' en línea', 'ok');
    await new Promise(r => setTimeout(r, 650));
    $('#loader').style.transition = 'opacity .5s'; $('#loader').style.opacity = '0';
    $('#app').classList.remove('hidden');
    setTimeout(() => { $('#loader').classList.add('hidden'); $('#loader').style.opacity = ''; }, 520);
    RO.PixLogo.mountAll($('#app'));
    afterEnter();
  } catch (e) {
    console.error('[office]', e);
    if (e.code === 'MISSING') loaderError('<b>La oficina todavía no está instalada.</b><br>Falta correr <code>office_migration.sql</code> en el SQL Editor de Supabase (una sola vez).', true);
    else if (e.code === 'NO_ROLE') loaderError('<b>Este usuario ya no está autorizado.</b><br>Pídele a un admin que lo active en Equipo.', false);
    else loaderError('<b>No se pudo conectar.</b><br>' + esc(e.message || e), true);
  }
}

function afterEnter() {
  UI.initHud();
  if (document.body.classList.contains('touch')) UI.initTouch();
  setTimeout(() => UI.pendingNotesNotice(), 900);
  RO.Net.award('checkin').then(r => { if (r && r.ok) setTimeout(() => UI.toast('☀️ Check-in del día: +' + r.amount + ' pts'), 2200); }).catch(() => {});
  RO.Net.send({ t: 'hello', u: S.me.user_id });
  watchdog();
  RO.Net.logEvent('visit', {}).catch(() => {});   // visible en Ruedda Control → Ruedda Office
  track();
  setInterval(track, 20000);
  // red de seguridad: refresca la lista de miembros cada 30 s
  setInterval(() => RO.Net.loadMembers().then(ms => {
    if (!ms) return; let changed = false;
    ms.forEach(m => { const cur = RO.member(m.user_id); if (!cur) { S.members.push(m); changed = true; } else if (cur.slot !== m.slot || cur.display_name !== m.display_name || JSON.stringify(cur.avatar) !== JSON.stringify(m.avatar)) { Object.assign(cur, m); changed = true; RO.G.refreshPlayer(m.user_id); } else Object.assign(cur, m); });
    if (changed) { RO.G.rebuild(); UI.renderPeople(); NET.onPresence(lastPresence); }
    UI.renderTop();
  }).catch(() => {}), 30000);
  if (S.config.motd) setTimeout(() => UI.toast(esc(S.config.motd)), 400);
  // aviso de versión nueva (sin recargar a mano)
  const myV = (document.querySelector('script[src*="/office/main.js"]') || {}).src || '';
  const cur = (myV.match(/v=(\d+)/) || [])[1];
  let warned = false;
  setInterval(async () => {
    if (warned || !cur) return;
    try {
      const html = await (await fetch('/office?chk=' + Date.now(), { cache: 'no-store' })).text();
      const v = (html.match(/office\/main\.js\?v=(\d+)/) || [])[1];
      if (v && v !== cur) { warned = true; UI.toast('✨ Hay una versión nueva de la oficina', 'note', [{ t: 'Actualizar', y: 1, f: () => { RO.G.save(); location.reload(); } }], 600000); }
    } catch (e) {}
  }, 120000);
  addEventListener('beforeunload', () => RO.G.save());
  document.addEventListener('visibilitychange', () => { if (document.hidden) RO.G.save(); });
}

/* ════════════ VIGILANTE DE CONEXIÓN ════════════
   · WebSocket caído > 8 s → rehace canales (con espera creciente) y activa el respaldo HTTP.
   · Respaldo HTTP: cada 3 s guarda mi posición y lee posiciones, chat y notas de la base.
   · Al volver: resincroniza todo lo que pudo perderse y apaga el respaldo. */
const CONN = { live: false, lastOk: Date.now(), tries: 0, nextTry: 0, polling: null, lastChat: 0, busy: false };
function setLive(label, cls) { const el = $('#tb-live'); if (!el) return; el.className = 'live ' + cls; el.querySelector('span').textContent = label; }
async function resync() {
  try {
    const d = await RO.Net.loadAll();
    S.members = d.members || S.members; S.decor = d.decor || S.decor; S.events = d.events || S.events;
    const before = new Set(S.notes.map(n => n.id)); S.notes = d.notes || S.notes;
    S.notes.forEach(n => { if (!before.has(n.id) && n.to_user === S.me.user_id && !n.read_at) UI.onNoteIn(n); });
    (d.chat || []).forEach(c => { if (!S.chat.find(x => x.id === c.id)) { S.chat.push(c); UI.chatAdd(c, true); } });
    const mine = S.members.find(m => m.user_id === S.me.user_id); if (mine) Object.assign(S.me, mine);
    if (d.config) S.config = RO.mergeConfig(d.config);
    RO.G.rebuild(); RO.G.syncDecor(); UI.renderTop(); UI.renderPeople(); UI.renderFeed();
  } catch (e) {}
}
function startPolling() {
  if (CONN.polling) return;
  CONN.lastChat = S.chat.reduce((m, c) => Math.max(m, +c.id || 0), 0);
  CONN.polling = setInterval(async () => {
    RO.G.save();
    try {
      const r = await RO.Net.poll(CONN.lastChat);
      const list = r.positions.filter(p => p.user_id !== S.me.user_id).map(p => ({ uid: p.user_id, x: p.x, y: p.y, dir: p.dir, room: p.room, status: 'disponible', at: Date.parse(p.updated_at) }));
      if (!RO.Net.isLive()) {
        NET.onPresence(list.concat([{ uid: S.me.user_id }]));
        list.forEach(p => RO.G.onPos({ u: p.uid, x: p.x, y: p.y, d: p.dir, m: 0, r: p.room }));
      }
      r.chat.forEach(c => { CONN.lastChat = Math.max(CONN.lastChat, +c.id || 0); if (!S.chat.find(x => x.id === c.id)) { S.chat.push(c); UI.chatAdd(c); } });
      const known = new Set(S.notes.map(n => n.id));
      r.notes.forEach(n => { if (!known.has(n.id)) { S.notes.unshift(n); if (n.to_user === S.me.user_id && !n.read_at) UI.onNoteIn(n); } });
      RO.G.drawPostits(); UI.renderTop();
    } catch (e) {}
  }, 3000);
}
function stopPolling() { if (CONN.polling) { clearInterval(CONN.polling); CONN.polling = null; } }
function watchdog() {
  if (RO.DEMO) return;
  if (!RO.Net.isLive()) { CONN.lastOk = 0; startPolling(); setLive('respaldo', 'off'); }
  setInterval(async () => {
    const live = RO.Net.isLive();
    if (live) {
      if (CONN.polling || CONN.tries) { CONN.tries = 0; stopPolling(); setLive('en vivo', 'on'); await resync(); RO.Net.send({ t: 'hello', u: S.me.user_id }); track(); }
      CONN.lastOk = Date.now(); return;
    }
    if (!navigator.onLine) { setLive('sin internet', 'off'); startPolling(); return; }
    if (Date.now() - CONN.lastOk < 8000) return;
    startPolling(); setLive('respaldo', 'off');
    if (CONN.busy || Date.now() < CONN.nextTry) return;
    CONN.busy = true; CONN.tries++;
    try { await RO.Net.reconnect(); } catch (e) {}
    CONN.busy = false;
    CONN.nextTry = Date.now() + Math.min(30000, 2000 * Math.pow(2, CONN.tries));
  }, 2000);
  addEventListener('online', () => { CONN.nextTry = 0; CONN.lastOk = 0; });
  addEventListener('offline', () => setLive('sin internet', 'off'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !RO.Net.isLive()) { CONN.nextTry = 0; CONN.lastOk = 0; } });
}

/* ── presencia ── */
function track() {
  const p = RO.G.mePos() || {};
  RO.Net.track({ uid: S.me.user_id, status: S.status, room: p.room || null, x: p.x, y: p.y, dir: p.dir, at: Date.now() });
}
RO.on('room', (id, name) => { UI.setRoom(name); track(); UI.renderPeople(); if (id === 'club' || (id === 'ocio' && UI.jukebox)) RO.music.start(); else if (!RO.G.wooActive()) RO.music.stop(); });
RO.on('club:found', () => UI.banner('Club privado', 'Ruedda Ecosystem · solo para el equipo', 'pink', 4200));
RO.on('status', () => { track(); RO.G.refreshTags(); UI.renderPeople(); });
RO.on('vip:found', () => {
  UI.banner('El Garage', 'Bienvenido al lado exagerado de Ruedda', 'pink', 4200);
  RO.sfx.engine();
});
RO.on('logout', async () => {
  const ok = await UI.confirm('Salir de la oficina', 'Para volver solo escribes tu usuario.', 'Salir');
  if (!ok) return;
  RO.G.save(); await RO.Net.signOut(); location.reload();
});

/* ════════════ RED → ESTADO ════════════ */
let prevOnline = null, lastPresence = [];
const fetching = new Set();
// alguien que entró por primera vez después de mí: lo traigo de la base y lo agrego al vuelo
function ensureMember(uid) {
  if (!uid || RO.member(uid) || fetching.has(uid)) return;
  fetching.add(uid);
  RO.Net.loadMember(uid).then(m => {
    fetching.delete(uid);
    if (m && !RO.member(uid)) { S.members.push(m); if (RO.G.scene) { RO.G.rebuild(); UI.renderPeople(); } NET.onPresence(lastPresence); }
  }).catch(() => fetching.delete(uid));
}
const NET = {
  onStatus(s, chans) {
    CONN.live = s === 'online'; if (CONN.live) CONN.lastOk = Date.now();
    const el = $('#tb-live'); if (el) { el.className = 'live ' + (s === 'online' ? 'on' : 'off'); el.title = s === 'online' ? 'Tiempo real conectado · ' + (chans || []).join(' + ') : 'Reconectando…'; el.querySelector('span').textContent = s === 'online' ? 'en vivo' : 'reconectando'; }
  },
  onPresence(list) {
    lastPresence = list;
    list.forEach(st => { if (st && st.uid && st.uid !== S.me.user_id) ensureMember(st.uid); });
    const me = S.me.user_id, map = new Map();
    list.forEach(st => { if (st && st.uid && st.uid !== me && RO.member(st.uid)) map.set(st.uid, st); });
    if (prevOnline) {
      map.forEach((v, k) => { if (!prevOnline.has(k)) { UI.toast('🟢 <b>' + esc(RO.nameOf(k)) + '</b> entró a la oficina'); if (S.status !== 'enfocado') RO.sfx.open(); } });
      prevOnline.forEach((v, k) => { if (!map.has(k)) UI.toast('<span class="dim">' + esc(RO.nameOf(k)) + ' salió</span>'); });
    }
    prevOnline = map; S.online = map;
    RO.G.onPresence(list);
    if (RO.G.scene) UI.renderPeople();
  },
  onMsg(m) {
    if (!m || !m.u || m.u === S.me.user_id) return;
    if (!RO.member(m.u)) { ensureMember(m.u); return; }
    switch (m.t) {
      case 'pos': return RO.G.onPos(m);
      case 'hello': { const s = RO.G.scene; if (s) s.sendPos(0); return; }
      case 'emote': return RO.G.bubbleOf(m.u, String(m.e || '').slice(0, 24));
      case 'emergency': return UI.onEmergency(m);
      case 'boost': return UI.onBoost(m);
      case 'deal': return UI.onDeal(m);
      case 'hi5': return UI.onHi5(m);
      case 'hi5ok': return UI.onHi5ok(m);
      case 'secret': return RO.G.openSecret(true);
      case 'car': return RO.G.carFx(m.i);
      case 'invite': return UI.onInvite(m);
      case 'woo': return RO.G.wooRemote(m.u, m.on);
      case 'jbox': { const p = RO.G.mePos(); if (p && p.room === 'ocio' && !RO.muted) { UI.jukebox = !!m.on; if (m.on) RO.music.start(); else RO.music.stop(); } return; }
      case 'money': return RO.G.moneyRain();
      case 'drop': return RO.G.drop();
      case 'bs': return UI.WB.onSeg(m);
      case 'be': return UI.WB.onEnd(m);
      case 'bc': return UI.WB.onClear(m);
      case 'bk': return UI.WB.onCursor(m);
      case 'bnote': return UI.WB.onNote(m);
      case 'rtc': return RO.Voice && RO.Voice.onSignal(m);
    }
  },
  onDb(table, type, nw, old) {
    const ready = !!RO.G.scene;
    if (table === 'office_members') {
      if (type === 'DELETE') {
        if (old && old.user_id === S.me.user_id) { UI.toast('Tu acceso a la oficina fue retirado', 'err'); setTimeout(() => location.reload(), 2500); return; }
        S.members = S.members.filter(m => m.user_id !== (old && old.user_id));
      } else if (nw) {
        const cur = RO.member(nw.user_id), avChanged = !cur || JSON.stringify(cur.avatar) !== JSON.stringify(nw.avatar);
        const layoutChanged = !cur || cur.slot !== nw.slot || cur.display_name !== nw.display_name;
        if (cur) Object.assign(cur, nw); else S.members.push(nw);
        if (nw.user_id === S.me.user_id) { if (S.me !== cur) Object.assign(S.me, nw); if (!nw.cargo && !S.me._superadmin) location.reload(); }
        if (ready) { if (avChanged) RO.G.refreshPlayer(nw.user_id); if (layoutChanged) RO.G.rebuild(); }
      }
      if (ready) { UI.renderTop(); UI.renderPeople(); RO.G.refreshTags(); }
    } else if (table === 'office_config') {
      if (nw && nw.data) { S.config = RO.mergeConfig(nw.data); if (ready) { RO.G.rebuild(); UI.renderClocks(); UI.renderPeople(); } }
    } else if (table === 'office_catalog') {
      if (type === 'DELETE') S.catalog = S.catalog.filter(c => c.item !== (old && old.item));
      else if (nw) { const c = S.catalog.find(x => x.item === nw.item); if (c) Object.assign(c, nw); else S.catalog.push(nw); }
    } else if (table === 'office_decor') {
      if (type === 'DELETE') S.decor = S.decor.filter(d => d.id !== (old && old.id));
      else if (nw) { const i = S.decor.findIndex(d => d.id === nw.id); if (i >= 0) S.decor[i] = nw; else S.decor.push(nw); }
      if (ready) RO.G.syncDecor();
    } else if (table === 'office_notes') {
      if (type === 'DELETE') S.notes = S.notes.filter(n => n.id !== (old && old.id));
      else if (nw) {
        const i = S.notes.findIndex(n => n.id === nw.id);
        if (i >= 0) S.notes[i] = nw; else { S.notes.unshift(nw); if (type === 'INSERT' && ready) UI.onNoteIn(nw); }
      }
      if (ready) { RO.G.drawPostits(); UI.renderTop(); }
    } else if (table === 'office_events') {
      if (type === 'INSERT' && nw && !S.events.find(e => e.id === nw.id)) { S.events.unshift(nw); S.events = S.events.slice(0, 60); if (ready) UI.renderFeed(); }
    } else if (table === 'office_chat') {
      if (type === 'INSERT' && nw) { if (!S.chat.find(c => c.id === nw.id)) { S.chat.push(nw); if (ready) UI.chatAdd(nw); } }
      else if (type === 'DELETE' && old) { S.chat = S.chat.filter(c => c.id !== old.id); UI.chatRemove(old.id); }
    }
  }
};

/* ── arranque ── */
(async function boot() {
  // también en celular/tablet: controles táctiles y diseño compacto
  if (!isDesktop()) document.body.classList.add('touch');
  if (innerWidth < 760) document.body.classList.add('small');
  RO.PixLogo.mountAll(document);
  let session = null;
  try { session = await RO.Net.session(); } catch (e) {}
  if (!session) return showLogin();
  enter();
})();
setInterval(UI.renderClocks, 1000);
})();
