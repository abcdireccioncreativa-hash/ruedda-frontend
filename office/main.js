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
  try { await RO.Net.signIn($('#lg-email').value.trim(), $('#lg-pass').value); enter(); }
  catch (x) { $('#lg-err').textContent = /invalid/i.test(x.message || '') ? 'Correo o contraseña incorrectos.' : (x.message || 'No se pudo entrar.'); }
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
        A.loadLogo().then(img => { if (img) RO.logoBits = A.logoBits(img, 88); })
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
    await step(0.72, 'conectando a servidores realtime', 'abriendo canal privado office:main', () => RO.Net.connect(S.me, RO.channelKey, NET));
    await step(0.9, 'generando mundo', 'generando mundo pixel · ' + S.members.length + ' miembros', async () => {
      UI.WB.load();
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
    else if (e.code === 'NO_ROLE') loaderError('<b>Esta cuenta no tiene rol en la empresa.</b><br>Pídele a un admin de Ruedda Office que te asigne un cargo y una oficina.', false);
    else loaderError('<b>No se pudo conectar.</b><br>' + esc(e.message || e), true);
  }
}

function afterEnter() {
  UI.initHud();
  setTimeout(() => UI.pendingNotesNotice(), 900);
  RO.Net.award('checkin').then(r => { if (r && r.ok) setTimeout(() => UI.toast('☀️ Check-in del día: +' + r.amount + ' pts'), 2200); }).catch(() => {});
  RO.Net.send({ t: 'hello', u: S.me.user_id });
  track();
  setInterval(track, 20000);
  if (S.config.motd) setTimeout(() => UI.toast(esc(S.config.motd)), 400);
  addEventListener('beforeunload', () => RO.G.save());
  document.addEventListener('visibilitychange', () => { if (document.hidden) RO.G.save(); });
}

/* ── presencia ── */
function track() {
  const p = RO.G.mePos() || {};
  RO.Net.track({ uid: S.me.user_id, status: S.status, room: p.room || null, x: p.x, y: p.y, dir: p.dir, at: Date.now() });
}
RO.on('room', (id, name) => { UI.setRoom(name); track(); UI.renderPeople(); });
RO.on('status', () => { track(); RO.G.refreshTags(); UI.renderPeople(); });
RO.on('vip:found', () => {
  UI.banner('El Garage', 'Bienvenido al lado exagerado de Ruedda', 'pink', 4200);
  RO.sfx.engine();
});
RO.on('logout', async () => {
  const ok = await UI.confirm('Salir de la oficina', 'Se cierra tu sesión de Ruedda en este navegador.', 'Salir');
  if (!ok) return;
  RO.G.save(); await RO.Net.signOut(); location.reload();
});

/* ════════════ RED → ESTADO ════════════ */
let prevOnline = null;
const NET = {
  onStatus(s) { if (s === 'reconnecting') UI.toast('Reconectando con el servidor…', 'err'); },
  onPresence(list) {
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
    if (!m || !m.u || m.u === S.me.user_id || !RO.member(m.u)) return;
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
      case 'bs': return UI.WB.onSeg(m);
      case 'be': return UI.WB.onEnd(m);
      case 'bc': return UI.WB.onClear(m);
      case 'bk': return UI.WB.onCursor(m);
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
  if (!isDesktop()) { show('gate'); return; }
  RO.PixLogo.mountAll(document);
  let session = null;
  try { session = await RO.Net.session(); } catch (e) {}
  if (!session) return showLogin();
  enter();
})();
setInterval(UI.renderClocks, 1000);
})();
