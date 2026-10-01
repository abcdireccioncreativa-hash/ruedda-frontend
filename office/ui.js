'use strict';
/* ════════════════════════════════════════════════════════════════
   RUEDDA OFFICE — interfaz: logo pixel, relojes, HUD, chat global,
   notas, pizarra, avatar, tienda, admin e interacciones.
   ════════════════════════════════════════════════════════════════ */
(function(){
const RO = window.RO, A = RO.Art, $ = RO.$, esc = RO.esc;
const UI = RO.UI = {};

/* ════════════ LOGO RUEDDA EN PIXEL (canvas animado) ════════════ */
const LOGOS = [];
RO.PixLogo = {
  async mountAll(root) { for (const c of (root || document).querySelectorAll('canvas.pixlogo')) if (!c._pl) await this.mount(c); },
  async mount(cv) {
    if (cv._pl) return cv._pl; cv._pl = 'pending';
    const img = await A.loadLogo(); if (!img) { cv._pl = null; return; }
    const cols = +cv.dataset.cols || 64, px = +cv.dataset.px || 6, gap = px >= 4 ? 1 : 0;
    const lb = A.logoBits(img, cols), dpr = Math.min(2, devicePixelRatio || 1);
    const W = cols * px, H = lb.rows * px;
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.aspectRatio = W + '/' + H;
    const g = cv.getContext('2d'); g.scale(dpr, dpr);
    const parts = [];
    for (let r = 0; r < lb.rows; r++) for (let q = 0; q < cols; q++) if (lb.bits[r * cols + q]) {
      parts.push({ hx: q * px, hy: r * px, x: q * px, y: r * px - 40 - Math.random() * 60, vx: 0, vy: 0, d: Math.random() * 900 + q * 6, o: 0 });
    }
    // orden de "carga" (progreso) de izquierda a derecha con ruido
    const order = parts.map((p, i) => [p.hx + Math.random() * 60, i]).sort((a, b) => a[0] - b[0]);
    order.forEach(([, i], k) => parts[i].k = k / parts.length);
    const st = { cv, g, parts, W, H, px, gap, t0: performance.now(), mouse: null, progress: cv._prog != null ? cv._prog : cv.dataset.progress ? 0 : 1, interactive: !!cv.dataset.interactive, stat: px <= 2 };
    cv._pl = st;
    if (st.interactive) {
      cv.addEventListener('pointermove', e => { const r = cv.getBoundingClientRect(); st.mouse = { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; });
      cv.addEventListener('pointerleave', () => st.mouse = null);
    }
    LOGOS.push(st); loop();
    return st;
  },
  progress(cv, p) { if (!cv) return; cv._prog = p; if (cv._pl && typeof cv._pl === 'object') { cv._pl.progress = p; loop(); } }
};
let raf = 0;
function loop() { if (!raf) raf = requestAnimationFrame(frame); }
function frame(now) {
  raf = 0; let active = false;
  LOGOS.forEach(st => {
    if (!st.cv.isConnected || st.cv.offsetParent === null) return;
    const { g, parts, W, H, px, gap } = st, t = now - st.t0;
    g.clearRect(0, 0, W, H);
    const sweep = ((t / 3800) % 1.6 - .3) * (W + H);
    let moving = false;
    for (const p of parts) {
      if (t < p.d && !st.stat) { moving = true; continue; }
      if (st.stat) { p.x = p.hx; p.y = p.hy; p.o = 1; }
      else {
        let fx = (p.hx - p.x) * 0.12, fy = (p.hy - p.y) * 0.12;
        if (st.mouse) {
          const dx = p.x - st.mouse.x, dy = p.y - st.mouse.y, d2 = dx * dx + dy * dy, R = 46;
          if (d2 < R * R) { const d = Math.sqrt(d2) || 1, f = (1 - d / R) * 7; fx += dx / d * f; fy += dy / d * f; }
        }
        p.vx = (p.vx + fx) * 0.72; p.vy = (p.vy + fy) * 0.72; p.x += p.vx; p.y += p.vy;
        p.o = Math.min(1, p.o + 0.08);
        if (Math.abs(p.vx) + Math.abs(p.vy) > 0.02 || p.o < 1) moving = true;
      }
      const lit = p.k <= st.progress;
      const diag = p.hx + p.hy, sh = !st.stat && Math.abs(diag - sweep) < 22;
      g.globalAlpha = p.o * (lit ? 1 : 0.16);
      g.fillStyle = !lit ? '#3a3d45' : sh ? '#fbffc4' : '#e6f03b';
      g.fillRect(Math.round(p.x), Math.round(p.y), px - gap, px - gap);
    }
    g.globalAlpha = 1;
    if (!st.stat) active = true; // brillo continuo
    if (moving) active = true;
  });
  if (active) loop();
}

/* ════════════ RELOJES (DOM) ════════════ */
const fmtCache = {};
function hhmm(tz, withSec) {
  try { const k = tz + withSec; const f = fmtCache[k] || (fmtCache[k] = new Intl.DateTimeFormat('es-VE', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: withSec ? '2-digit' : undefined, hour12: false })); return f.format(new Date()); }
  catch (e) { return '--:--'; }
}
UI.hhmm = hhmm;
function clockSvg(tz) {
  const t = RO.timeIn ? RO.timeIn(tz) : (() => { const d = new Date(); return { h: d.getHours(), m: d.getMinutes(), s: d.getSeconds() }; })();
  const ha = ((t.h % 12) + t.m / 60) * 30, ma = t.m * 6;
  return `<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="8.5" fill="#fbf7ea" stroke="#c99a1e" stroke-width="1.5"/><line x1="10" y1="10" x2="10" y2="5.6" stroke="#16171b" stroke-width="1.6" stroke-linecap="round" transform="rotate(${ha} 10 10)"/><line x1="10" y1="10" x2="10" y2="3.6" stroke="#16171b" stroke-width="1.1" stroke-linecap="round" transform="rotate(${ma} 10 10)"/><circle cx="10" cy="10" r="1" fill="#d7262e"/></svg>`;
}
function renderClocks() {
  const list = (RO.S.config.clocks || RO.DEFAULT_CONFIG.clocks);
  RO.$$('[data-clocks]').forEach(el => {
    if (el.offsetParent === null && el.closest('.screen.hidden,#app.hidden')) return;
    if (el.dataset.full) el.innerHTML = list.map(c => `<div class="clk">${clockSvg(c.tz)}<span class="l">${esc(c.label)}</span><b>${hhmm(c.tz)}</b></div>`).join('');
    else el.innerHTML = list.map(c => `<span>${esc(String(c.label).slice(0, 3).toUpperCase())} <b>${hhmm(c.tz)}</b></span>`).join('');
  });
}
UI.renderClocks = renderClocks;
setInterval(renderClocks, 1000 * 15);
RO.timeIn = RO.timeIn || (tz => { try { const p = {}; new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).formatToParts(new Date()).forEach(x => p[x.type] = x.value); return { h: +p.hour % 24, m: +p.minute, s: +p.second }; } catch (e) { const d = new Date(); return { h: d.getHours(), m: d.getMinutes(), s: d.getSeconds() }; } });

/* ════════════ TOASTS / BANNER / MODAL ════════════ */
UI.toast = (msg, kind, btns, ms) => {
  const t = document.createElement('div'); t.className = 'toast ' + (kind || '');
  t.innerHTML = `<span>${msg}</span>`;
  (btns || []).forEach(b => { const x = document.createElement('button'); x.textContent = b.t; if (b.y) x.className = 'y'; x.onclick = () => { b.f && b.f(); t.remove(); }; t.appendChild(x); });
  $('#toasts').appendChild(t);
  setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, ms || (btns && btns.length ? 9000 : 3600));
  return t;
};
RO.on('toast', (m, k) => UI.toast(esc(m), k));
UI.banner = (title, sub, kind, ms) => {
  const b = document.createElement('div'); b.className = 'bn ' + (kind || '');
  b.innerHTML = esc(title) + (sub ? `<small>${esc(sub)}</small>` : '');
  $('#banner').appendChild(b);
  setTimeout(() => { b.classList.add('out'); setTimeout(() => b.remove(), 400); }, ms || 3800);
};
let MODAL = null;
UI.modal = ({ title, sub, body, foot, wide, onClose, cls }) => {
  UI.close();
  const m = document.createElement('div'); m.className = 'mo';
  m.innerHTML = `<div class="mo-card ${wide ? 'wide' : ''} ${cls || ''}" role="dialog"><div class="mo-h"><div><h3>${title}</h3>${sub ? `<div class="sub">${sub}</div>` : ''}</div><button class="x" aria-label="cerrar">✕</button></div><div class="mo-b">${body || ''}</div>${foot ? `<div class="mo-f">${foot}</div>` : ''}</div>`;
  m.querySelector('.x').onclick = () => UI.close();
  m.addEventListener('mousedown', e => { if (e.target === m) UI.close(); });
  $('#modal-root').appendChild(m);
  MODAL = { el: m, onClose };
  RO.sfx.open();
  return m;
};
UI.close = () => { if (!MODAL) return; const { el, onClose } = MODAL; MODAL = null; el.remove(); onClose && onClose(); };
RO.uiBusy = () => !!MODAL || !!WB.open;
UI.confirm = (title, text, okText, danger) => new Promise(res => {
  const m = UI.modal({ title, body: `<p style="line-height:1.55;color:var(--ink2)">${text}</p>`, foot: `<button class="btn" data-n>Cancelar</button><button class="btn ${danger ? 'red' : 'y'}" data-y>${okText || 'Confirmar'}</button>`, onClose: () => res(false) });
  m.querySelector('[data-n]').onclick = () => UI.close();
  m.querySelector('[data-y]').onclick = () => { MODAL.onClose = null; UI.close(); res(true); };
});
const err = e => { console.error(e); UI.toast(esc((e && e.message) || 'Algo falló'), 'err'); RO.sfx.err(); };
UI.err = err;

/* ════════════ HUD ════════════ */
const headCache = new Map();
function headCanvas(m, scale) {
  const av = A.normAvatar(m && m.avatar, m && m.user_id), key = JSON.stringify(av) + scale;
  if (!headCache.has(key)) headCache.set(key, A.avatarHead(av, scale || 2));
  const src = headCache.get(key), c = document.createElement('canvas'); c.width = src.width; c.height = src.height; c.getContext('2d').drawImage(src, 0, 0); return c;
}
UI.headCanvas = headCanvas;
const roomLabel = id => RO.World.roomName(id, RO.S.config) || '—';

UI.renderTop = () => {
  const me = RO.S.me; if (!me) return;
  $('#tb-coins').textContent = me.coins ?? 0;
  $('#tb-pts').textContent = me.points ?? 0;
  const unread = RO.S.notes.filter(n => n.to_user === me.user_id && !n.read_at).length;
  const b = $('#tb-notes'); b.textContent = unread; b.classList.toggle('hidden', !unread);
  $('#tb-admin').classList.toggle('hidden', !RO.isAdmin());
  $('#tb-sound').classList.toggle('off', RO.muted);
};
UI.renderPeople = () => {
  const box = $('#sd-people'); if (!box) return;
  const S = RO.S, list = S.members.slice().sort((a, b) => {
    const oa = S.online.has(a.user_id) ? 0 : 1, ob = S.online.has(b.user_id) ? 0 : 1;
    return oa - ob || (a.display_name || '').localeCompare(b.display_name || '');
  });
  box.innerHTML = '';
  let on = 0;
  list.forEach(m => {
    const p = S.online.get(m.user_id), isMe = m.user_id === S.me.user_id;
    if (p || isMe) on++;
    const st = isMe ? S.status : p ? (p.status || 'disponible') : 'off';
    const room = isMe ? (RO.G.mePos() || {}).room : p && p.room;
    const el = document.createElement('div'); el.className = 'person' + (p || isMe ? '' : ' off');
    el.appendChild(headCanvas(m, 2));
    el.insertAdjacentHTML('beforeend', `<div class="pi"><div class="pn"><i class="st-${st}"></i>${esc(m.display_name)}${isMe ? ' <span class="muted" style="font-weight:400">(tú)</span>' : ''}</div><div class="pr">${esc(m.cargo || '')} · ${p || isMe ? esc(roomLabel(room)) : 'desconectado'}</div></div>${!isMe && p ? '<span class="go">ir →</span>' : ''}`);
    el.onclick = () => UI.personCard(m.user_id);
    box.appendChild(el);
  });
  $('#sd-count').textContent = on + '/' + list.length + ' en línea';
};
const EVT = {
  emergency: e => `<b>${who(e)}</b> convocó una reunión de emergencia`,
  boost: e => `<b>${who(e)}</b> aceleró el proyecto · +${(e.payload && e.payload.points) || 0} pts al equipo`,
  deal: e => `<b>${who(e)}</b> tocó la campana: ${esc(e.payload && e.payload.text)}`,
  buy: e => `<b>${who(e)}</b> compró ${esc(e.payload && e.payload.name)}`,
  board_clear: e => `<b>${who(e)}</b> borró la pizarra`,
  vip: e => `<b>${who(e)}</b> encontró algo secreto…`,
  'award:checkin': e => `<b>${who(e)}</b> llegó a la oficina`,
  lottery: e => e.payload && e.payload.win ? `<b>${who(e)}</b> ganó ${e.payload.coins} monedas en la lotería${e.payload.jackpot ? ' 🎰 ¡PREMIO MAYOR!' : ''}` : ''
};
function who(e) { return esc(RO.nameOf(e.actor)); }
UI.renderFeed = () => {
  const box = $('#sd-feed'); if (!box) return;
  const ev = RO.S.events.filter(e => EVT[e.kind] && EVT[e.kind](e)).slice(0, 30);
  box.innerHTML = ev.length ? ev.map(e => `<div class="fe">${EVT[e.kind](e)}<time>${RO.ago(e.created_at)}</time></div>`).join('') : '<div class="fe muted">Todavía no pasa nada. Sé el primero.</div>';
};
UI.setRoom = name => { $('#tb-room').textContent = name || '—'; };

/* estado */
UI.initStatus = () => {
  const seg = $('#sd-status');
  const paint = () => seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.s === RO.S.status));
  seg.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    RO.S.status = b.dataset.s; paint(); RO.emit('status', RO.S.status);
    if (RO.S.status === 'enfocado') UI.toast('Modo foco: tu puerta se pone en rojo y el chat no suena.');
  };
  paint();
};

/* ════════════ CHAT GLOBAL ════════════ */
const CHAT_COLORS = ['#e6f03b', '#7fd0ff', '#ff9ec7', '#9ef0b8', '#ffb86b', '#c7a6ff', '#7ff0e6'];
const colorOf = uid => CHAT_COLORS[A.hash(uid || '') % CHAT_COLORS.length];
let chatUnread = 0;
UI.initChat = () => {
  const log = $('#ch-log'), form = $('#ch-form'), input = $('#ch-input'), box = $('#chat');
  try { if (localStorage.getItem('ro_chat_min') === '1') box.classList.add('min'); } catch (e) {}
  $('.ch-h').onclick = e => { box.classList.toggle('min'); setTimeout(() => RO.G.layout(), 30); chatUnread = 0; UI.renderChatBadge(); try { localStorage.setItem('ro_chat_min', box.classList.contains('min') ? '1' : '0'); } catch (x) {} if (!box.classList.contains('min')) log.scrollTop = log.scrollHeight; };
  // selector de emojis
  const EMO = '😀 😂 🤣 😍 😎 🤩 😏 😉 😅 🙃 😴 🤔 🤯 😳 🥳 😤 🙌 👏 👍 👎 🙏 💪 👀 🔥 💯 ✅ ❌ ⚡ 🚀 🚗 🏎️ 🚙 🔑 🏁 💸 💰 📈 📉 🤝 ☕ 🍕 🍻 🥂 🎉 ❤️ 💛 🖤 ✨'.split(' ');
  const eb = document.createElement('button'); eb.type = 'button'; eb.className = 'ch-emo'; eb.textContent = '😀'; eb.title = 'Emojis';
  form.insertBefore(eb, form.firstChild);
  const pop = document.createElement('div'); pop.className = 'emo-pop hidden'; pop.innerHTML = EMO.map(e => `<button type="button">${e}</button>`).join('');
  box.appendChild(pop);
  eb.onclick = () => pop.classList.toggle('hidden');
  pop.onclick = e => { const b = e.target.closest('button'); if (!b) return; const i = input.selectionStart ?? input.value.length; input.value = input.value.slice(0, i) + b.textContent + input.value.slice(i); input.focus(); input.selectionStart = input.selectionEnd = i + b.textContent.length; };
  document.addEventListener('mousedown', e => { if (!pop.contains(e.target) && e.target !== eb) pop.classList.add('hidden'); });
  form.onsubmit = async e => {
    pop.classList.add('hidden');
    e.preventDefault(); const t = input.value.trim(); if (!t) { input.blur(); return; }
    input.value = '';
    try { await RO.Net.sendChat(t); } catch (x) { err(x); input.value = t; }
  };
  input.addEventListener('keydown', e => { if (e.key === 'Escape') input.blur(); });
  log.innerHTML = '';
  RO.S.chat.forEach(c => UI.chatAdd(c, true));
  log.scrollTop = log.scrollHeight;
};
UI.chatAdd = (c, initial) => {
  const log = $('#ch-log'); if (!log || log.querySelector(`[data-id="${c.id}"]`)) return;
  const near = log.scrollHeight - log.scrollTop - log.clientHeight < 60;
  const el = document.createElement('div'); el.className = 'cm'; el.dataset.id = c.id;
  const mine = c.author === RO.S.me.user_id, canDel = mine || RO.isAdmin();
  const t = new Date(c.created_at).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
  el.innerHTML = `<span class="who" style="color:${colorOf(c.author)}">${esc(RO.nameOf(c.author))}</span>${linkify(esc(c.body))}<span class="t">${t}</span>${canDel ? `<button class="del" title="Borrar">✕</button>` : ''}`;
  const d = el.querySelector('.del'); if (d) d.onclick = () => RO.Net.deleteChat(c.id).catch(err);
  log.appendChild(el);
  while (log.children.length > 200) log.firstChild.remove();
  if (near || mine) log.scrollTop = log.scrollHeight;
  if (!initial) {
    if (mine) RO.G.bubbleMe(c.body); else RO.G.bubbleOf(c.author, c.body);
    if (!mine) {
      if ($('#chat').classList.contains('min')) { chatUnread++; UI.renderChatBadge(); }
      if (RO.S.status !== 'enfocado') RO.sfx.blip();
      if (document.hidden) UI.notify('Chat · ' + RO.nameOf(c.author), c.body);
    }
  }
};
UI.chatRemove = id => { const el = $(`#ch-log [data-id="${id}"]`); if (el) el.remove(); };
UI.renderChatBadge = () => { const b = $('#ch-unread'); b.textContent = chatUnread; b.classList.toggle('hidden', !chatUnread); };
function linkify(s) { return s.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color:var(--y)">$1</a>'); }

/* notificaciones del navegador (si el usuario las permite) */
UI.notify = (title, body) => {
  try {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') new Notification(title, { body, icon: '/icon-192.png', tag: 'ruedda-office' });
  } catch (e) {}
};
UI.askNotify = () => { try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch (e) {} };

/* ════════════ HINT DE INTERACCIÓN ════════════ */
const HINTS = {
  desk: h => { const o = officeAt(h.pos), m = o && RO.memberBySlot(o.slot); if (!m) return 'Oficina libre'; return m.user_id === RO.S.me.user_id ? 'Mi escritorio' : 'Dejar un post-it a ' + esc(m.display_name); },
  seat: h => esc(h.label || 'Sentarte'), stand: () => 'Levantarte (o camina)',
  cat: h => 'Acariciar a ' + esc(h.name) + ' 🐈', lottery: () => 'Jugar a la lotería 🎰', jukebox: () => (UI.jukebox ? 'Apagar la rocola' : 'Poner la rocola 🎵'),
  board: () => 'Abrir la pizarra general', gong: () => 'Tocar la campana de ventas', clocks: () => 'Ver los relojes',
  tv: () => 'Ver Ruedda en vivo', secret: () => 'Examinar la estantería', coffee: () => 'Servirte un café', snacks: () => 'Comprar un snack',
  arcade: () => 'Jugar arcade', pingpong: () => 'Jugar ping-pong', grill: () => 'Prender la parrilla', aquarium: () => 'Mirar la pecera',
  car: h => 'Encender ' + esc(h.car.name), bar: () => 'Pedir en la barra',
  stage: () => 'Tirar billetes 💸', dj: () => (RO.music && RO.music.timer ? 'Soltar el drop 🔊' : 'Poner la música 🎧'), npc: () => 'Hablar con ' + esc(RO.S.config.npc.name || 'Valentina'),
  player: h => `Hablar con ${esc(RO.nameOf(h.uid))}</span><span class="sep"></span><kbd class="k2">H</kbd><span>Chocar los cinco`
};
function officeAt(pos) { return (RO.S.config.offices || []).find(o => o.pos === pos); }
RO.on('hint', h => {
  const el = $('#hint');
  if (!h || !HINTS[h.kind]) { el.classList.add('hidden'); return; }
  el.innerHTML = `<kbd>E</kbd><span>${HINTS[h.kind](h)}</span>`;
  el.classList.remove('hidden');
});

/* ════════════ INTERACCIONES ════════════ */
RO.on('interact', h => {
  const S = RO.S;
  switch (h.kind) {
    case 'desk': {
      const o = officeAt(h.pos), m = o && RO.memberBySlot(o.slot);
      if (!m) return UI.toast('Esta oficina está libre. Un admin la puede asignar.');
      if (m.user_id === S.me.user_id) return UI.deskMenu();
      return UI.composeNote(m.user_id);
    }
    case 'board': return WB.show();
    case 'gong': return UI.dealModal();
    case 'clocks': return UI.clocksModal();
    case 'tv': return UI.tvModal();
    case 'secret': RO.G.openSecret(false); RO.Net.logEvent('vip', {}).catch(() => {}); return;
    case 'coffee': RO.G.coffee(); RO.G.bubbleMe('☕'); RO.sfx.coin(); UI.toast('Café servido: +40% de velocidad por 45 s'); RO.Net.award('coffee').catch(() => {}); RO.Net.send({ t: 'emote', u: S.me.user_id, e: '☕' }); return;
    case 'snacks': { const s = ['🍫', '🥤', '🍪', '🥨', '🍬'][Math.floor(Math.random() * 5)]; RO.G.bubbleMe(s); RO.Net.send({ t: 'emote', u: S.me.user_id, e: s }); RO.sfx.coin(); return; }
    case 'arcade': return UI.arcade();
    case 'pingpong': { const n = S.online.size; RO.G.bubbleMe('🏓'); RO.Net.send({ t: 'emote', u: S.me.user_id, e: '🏓' }); if (n < 2) UI.toast('Necesitas un rival… invita a alguien desde el panel.'); return; }
    case 'grill': RO.G.bubbleMe('🔥🥩'); RO.Net.send({ t: 'emote', u: S.me.user_id, e: '🔥🥩' }); UI.toast('Parrilla encendida. Viernes de asado en la terraza.'); return;
    case 'aquarium': UI.toast('Los peces se llaman Subasta, Market y Concesionario.'); return;
    case 'bar': RO.G.bubbleMe('🥂'); RO.Net.send({ t: 'emote', u: S.me.user_id, e: '🥂' }); UI.toast(esc(S.config.npc.name || 'Valentina') + ': aquí el champán se sirve cuando se cierra un trato.', 'vip'); return;
    case 'car': RO.G.carFx(h.idx); RO.Net.send({ t: 'car', u: S.me.user_id, i: h.idx }); UI.toast('<b>' + esc(h.car.name) + '</b> · exhibición privada', 'vip'); return;
    case 'stage': RO.G.moneyRain(); RO.sfx.cash(); RO.G.bubbleMe('💸'); RO.Net.send({ t: 'money', u: S.me.user_id }); return;
    case 'dj':
      if (RO.muted) return UI.toast('Activa el sonido (🔊 arriba) para escuchar al DJ');
      if (!RO.music.timer) { RO.music.start(); UI.toast('🎧 DJ Ruedda en vivo'); }
      else { RO.G.drop(); RO.sfx.drop(); RO.Net.send({ t: 'drop', u: S.me.user_id }); }
      RO.G.bubbleMe('🔊'); return;
    case 'cat': RO.G.petCat(h.idx); RO.G.bubbleMe('🐈'); return;
    case 'lottery': return UI.lottery();
    case 'jukebox':
      if (RO.muted) return UI.toast('Activa el sonido (🔊 arriba) para escuchar la rocola');
      UI.jukebox = !UI.jukebox;
      if (UI.jukebox) { RO.music.start(); UI.toast('🎵 Rocola encendida en la zona de ocio'); } else RO.music.stop();
      RO.Net.send({ t: 'jbox', u: S.me.user_id, on: UI.jukebox ? 1 : 0 }); return;
    case 'seat': RO.G.sit(h.seat); return;
    case 'stand': RO.G.stand(); return;
    case 'npc': return UI.valentina();
    case 'player': return UI.personCard(h.uid);
  }
});

/* ════════════ TECLADO ════════════ */
const EMOTES = { '1': '👍', '2': '😂', '3': '🔥', '4': '☕', '5': '🚗', '6': '💸', '7': '🙌', '8': '👀' };
RO.on('key', (k, e) => {
  if (k === 'escape') { if (WB.open) return WB.hide(); if (RO.G.scene && RO.G.scene.edit) return RO.emit('edit:cancel'); return UI.close(); }
  if (RO.uiBusy()) return;
  if (k === 'e' || k === ' ') { e.preventDefault(); RO.G.interact(); }
  else if (k === 'enter') { e.preventDefault(); const box = $('#chat'); box.classList.remove('min'); chatUnread = 0; UI.renderChatBadge(); $('#ch-input').focus(); }
  else if (k === 'h') { const h = RO.G.scene && RO.G.scene.hint; if (h && h.kind === 'player') UI.hi5(h.uid); }
  else if (EMOTES[k]) { RO.G.bubbleMe(EMOTES[k]); RO.Net.send({ t: 'emote', u: RO.S.me.user_id, e: EMOTES[k] }); }
  else if (k === 'n') UI.notesInbox();

});

/* chocar los cinco: los dos tienen que presionar H en 4 s */
const HI5 = {};
UI.hi5 = uid => {
  const now = Date.now();
  if (HI5['from:' + uid] && now - HI5['from:' + uid] < 4000) { delete HI5['from:' + uid]; UI.hi5Done(uid); RO.Net.send({ t: 'hi5ok', u: RO.S.me.user_id, to: uid }); return; }
  HI5['to:' + uid] = now; RO.G.bubbleMe('✋'); RO.Net.send({ t: 'hi5', u: RO.S.me.user_id, to: uid });
  UI.toast('Esperando a que ' + esc(RO.nameOf(uid)) + ' presione H…');
};
UI.onHi5 = m => {
  if (m.to !== RO.S.me.user_id) return;
  if (HI5['to:' + m.u] && Date.now() - HI5['to:' + m.u] < 4000) { delete HI5['to:' + m.u]; UI.hi5Done(m.u); RO.Net.send({ t: 'hi5ok', u: RO.S.me.user_id, to: m.u }); return; }
  HI5['from:' + m.u] = Date.now(); RO.G.bubbleOf(m.u, '✋ ¡choca esos cinco! (H)');
};
UI.onHi5ok = m => { if (m.to === RO.S.me.user_id) UI.hi5Done(m.u); };
UI.hi5Done = uid => {
  RO.sfx.hi5(); RO.G.fxHi5(uid); RO.G.bubbleMe('🙌');
  RO.Net.award('highfive').then(r => { if (r && r.ok) UI.toast('🙌 +' + r.amount + ' pts con ' + esc(RO.nameOf(uid))); }).catch(() => {});
};

/* ════════════ TARJETA DE PERSONA ════════════ */
UI.personCard = uid => {
  const m = RO.member(uid); if (!m) return;
  const p = RO.S.online.get(uid), isMe = uid === RO.S.me.user_id;
  const o = (RO.S.config.offices || []).find(z => z.slot === m.slot);
  const mo = UI.modal({
    title: esc(m.display_name), sub: esc(m.cargo || ''),
    body: `<div class="pc"><span data-av></span><div><div class="meta">${p || isMe ? '<span style="color:var(--green)">● en línea</span> · ' + esc(roomLabel(isMe ? (RO.G.mePos() || {}).room : p.room)) : 'Desconectado'}<br>${o ? 'Oficina: ' + esc(roomLabel('off' + o.pos)) : 'Sin oficina'}</div>
      <dl class="kv"><dt>Productividad</dt><dd>${m.points || 0} pts</dd><dt>Monedas</dt><dd>${m.coins || 0}</dd>${p && p.status ? `<dt>Estado</dt><dd>${esc(p.status)}</dd>` : ''}</dl></div></div>`,
    foot: isMe ? `<button class="btn" data-a="avatar">Editar avatar</button>` :
      `${o ? `<button class="btn" data-a="office">Ir a su oficina</button>` : ''}<button class="btn" data-a="note">Dejar nota</button>${p ? `<button class="btn" data-a="invite">Invitar a mi oficina</button><button class="btn y" data-a="go">Ir hacia ${esc(m.display_name)}</button>` : ''}`
  });
  mo.querySelector('[data-av]').appendChild(A.avatarFull(A.normAvatar(m.avatar, uid), 5));
  mo.querySelectorAll('[data-a]').forEach(b => b.onclick = () => {
    const a = b.dataset.a; UI.close();
    if (a === 'go') RO.G.goTo(uid);
    if (a === 'office') RO.G.goToOffice(o.pos);
    if (a === 'note') UI.composeNote(uid);
    if (a === 'avatar') UI.avatarEditor(uid);
    if (a === 'invite') UI.summon(uid);
  });
};

/* ════════════ LOTERÍA ════════════ */
UI.lottery = () => {
  const SYM = ['🚗', '💸', '🏁', '⭐', '🍒', '7️⃣', '🔑'];
  const mo = UI.modal({
    title: '🎰 Lotería Ruedda', sub: 'Gratis · 25 tiradas al día · 1 de cada 4 gana monedas y puntos · premio mayor 1.000',
    body: `<div class="slot"><div class="reels"><span>🚗</span><span>💸</span><span>🏁</span></div><div class="slot-msg mono" id="sl-m">tira la palanca</div></div>`,
    foot: `<span class="muted" id="sl-left" style="font-size:12px"></span><span class="sp"></span><button class="btn y" id="sl-go">Tirar 🎰</button>`
  });
  const reels = mo.querySelectorAll('.reels span'), btn = mo.querySelector('#sl-go'), msg = mo.querySelector('#sl-m');
  btn.onclick = async () => {
    btn.disabled = true; msg.textContent = 'girando…'; RO.sfx.blip();
    const spin = setInterval(() => reels.forEach(r => r.textContent = SYM[Math.floor(Math.random() * SYM.length)]), 70);
    let r; try { r = await RO.Net.lottery(); } catch (e) { r = { ok: false, reason: e.message }; }
    await new Promise(z => setTimeout(z, 1200));
    clearInterval(spin);
    if (!r.ok) { msg.textContent = r.reason === 'limite' ? 'ya usaste tus 25 tiradas de hoy. vuelve mañana' : 'no se pudo: ' + (r.reason || ''); btn.disabled = r.reason === 'limite'; return; }
    let show;
    if (r.jackpot) show = ['7️⃣', '7️⃣', '7️⃣'];
    else if (r.win) { const s = SYM[Math.floor(Math.random() * 5)]; show = [s, s, s]; }
    else { do { show = [0, 1, 2].map(() => SYM[Math.floor(Math.random() * SYM.length)]); } while (show[0] === show[1] && show[1] === show[2]); }
    for (let i = 0; i < 3; i++) { await new Promise(z => setTimeout(z, 260)); reels[i].textContent = show[i]; RO.sfx.blip(); }
    if (r.win) {
      msg.innerHTML = r.jackpot ? '<b style="color:var(--y)">¡¡PREMIO MAYOR!! +1.000 monedas · +100 pts</b>' : `<b style="color:var(--green)">¡Ganaste! +${r.coins} monedas · +${r.points} pts</b>`;
      RO.sfx.coin(); setTimeout(RO.sfx.cash, 200); RO.G.fxConfetti(); RO.G.bubbleMe(r.jackpot ? '🎰💰💰💰' : '💰');
      RO.S.me.coins = (RO.S.me.coins || 0) + r.coins; RO.S.me.points = (RO.S.me.points || 0) + r.points; UI.renderTop();
      if (r.jackpot) RO.Net.send({ t: 'deal', u: RO.S.me.user_id, text: '¡Premio mayor en la lotería! 🎰' });
    } else msg.textContent = ['casi…', 'nada esta vez', 'otra vez será', 'la próxima es la buena'][Math.floor(Math.random() * 4)];
    if (r.left != null) mo.querySelector('#sl-left').textContent = 'quedan ' + r.left + ' tiradas hoy';
    btn.disabled = false;
  };
};

/* ════════════ POMODORO ════════════ */
UI.pomodoro = mins => {
  clearInterval(UI._pomo); const end = Date.now() + mins * 60000;
  RO.S.status = 'enfocado'; RO.emit('status', 'enfocado'); RO.$$('#sd-status button').forEach(x => x.classList.toggle('on', x.dataset.s === 'enfocado'));
  let chip = $('#pomo'); if (!chip) { chip = document.createElement('button'); chip.id = 'pomo'; chip.className = 'pill mono'; chip.title = 'Clic para cancelar'; $('.tb-right').prepend(chip); }
  chip.onclick = () => { clearInterval(UI._pomo); chip.remove(); UI.toast('Pomodoro cancelado'); };
  const tick = () => {
    const ms = end - Date.now();
    if (ms <= 0) { clearInterval(UI._pomo); chip.remove(); RO.sfx.note(); UI.notify('Ruedda Office', '¡Pomodoro listo! Toca descanso de 5 minutos.'); UI.toast('⏱️ ¡Listo! 5 minutos de descanso. Hay café en la zona de ocio.', 'note', [{ t: 'Otro pomodoro', y: 1, f: () => UI.pomodoro(25) }]); RO.S.status = 'disponible'; RO.emit('status', 'disponible'); RO.$$('#sd-status button').forEach(x => x.classList.toggle('on', x.dataset.s === 'disponible')); return; }
    chip.innerHTML = '⏱️ <b>' + Math.floor(ms / 60000) + ':' + String(Math.floor(ms / 1000) % 60).padStart(2, '0') + '</b>';
  };
  tick(); UI._pomo = setInterval(tick, 1000);
  UI.toast('⏱️ Pomodoro de ' + mins + ' minutos: modo foco activado');
};

/* ════════════ VALENTINA ════════════ */
const V_SEDUCE = [
  'Cariño, yo no salgo con nadie que tenga publicaciones en revisión.',
  'Qué lindo intento. Ahora cierra tres tratos y hablamos.',
  'Me encantas… cuando el KPI está en verde.',
  'Tienes la confianza de un Lambo y el presupuesto de un Corolla 2004.',
  'Mmm… ¿eso fue un piropo o un pitch de ventas? Porque los dos estuvieron flojos.',
  'Te doy una cita: lunes, 8 a.m., sala de juntas. Trae números.',
  'Guárdate el encanto para los clientes, que esos sí pagan.',
  'Ay no, me sonrojé. Mentira. Vuelve a trabajar.'
];
const V_AFTER = [
  'Esto no sale en el reporte trimestral.',
  'Ni una palabra en el chat global, ¿entendido?',
  'Bien. Ahora a vender, campeón.',
  'Eso fue… productivo. +0 pts.',
  'Y aquí no pasó nada. Ve por tu café.'
];
const pick = a => a[Math.floor(Math.random() * a.length)];
UI.valentina = () => {
  const name = esc(RO.S.config.npc.name || 'Valentina');
  RO.G.npcSay(); RO.G.npcHold && RO.G.npcHold(15000);
  const opt = (a, t, d) => `<button class="act" data-a="${a}" style="width:100%;margin-bottom:8px"><b>${t}</b><span>${d}</span></button>`;
  const mo = UI.modal({
    title: name, sub: 'Asistente ejecutiva de Ruedda Ecosystem',
    body: opt('cafe', '☕ Pedir café', 'Te lo trae ya: +40% de velocidad por 45 s') +
      opt('stats', '📊 Stats de Ruedda', 'Los números de hoy, igual que en Ruedda Control') +
      opt('seducir', '😏 Seducir', 'Bajo tu propio riesgo') +
      opt('amor', '❤️ Hacer el amor', 'Discreción absoluta')
  });
  mo.querySelectorAll('[data-a]').forEach(b => b.onclick = () => {
    const a = b.dataset.a; UI.close();
    if (a === 'cafe') { RO.G.coffee(); RO.G.npcLine('Aquí tienes, negro y fuerte. Como los números que quiero ver hoy.'); RO.G.bubbleMe('☕'); RO.sfx.coin(); RO.Net.award('coffee').catch(() => {}); }
    if (a === 'stats') UI.rueddaStats();
    if (a === 'seducir') { RO.G.npcLine(pick(V_SEDUCE)); RO.G.bubbleMe('😏'); }
    if (a === 'amor') UI.cabina();
  });
};
// cabina privada: cortina cerrada, la cabina se mueve y salen corazones (~30 s). Nada explícito.
UI.cabina = () => {
  const DUR = 30000;
  if (!RO.G.wooStart(DUR)) return;
  if (!RO.muted) RO.music.start();
  RO.G.npcLine('Sígueme, cariño. Treinta segundos y vuelves a vender.');
  const bar = document.createElement('div'); bar.id = 'woo-bar'; bar.className = 'glass';
  bar.style.cssText = 'position:absolute;left:50%;bottom:28px;transform:translateX(-50%);z-index:8;display:flex;gap:12px;align-items:center;padding:10px 12px 10px 16px;font-size:13px';
  bar.innerHTML = '<span>🔒 En la cabina privada · <b id="woo-t" style="color:#ff7ab8">0:30</b></span><button class="btn sm" id="woo-x">Salir (Esc)</button>';
  $('#app').appendChild(bar);
  const t0 = Date.now(), iv = setInterval(() => { const s = Math.max(0, Math.ceil((DUR + 1100 - (Date.now() - t0)) / 1000)); const el = $('#woo-t'); if (el) el.textContent = '0:' + String(Math.min(30, s)).padStart(2, '0'); }, 250);
  const done = () => { clearInterval(iv); bar.remove(); off(); offK(); };
  const off = RO.on('woo:end', () => { done(); RO.G.npcLine(pick(V_AFTER)); RO.G.bubbleMe('😳'); RO.sfx.note(); });
  const offK = RO.on('key', k => { if (k === 'escape') RO.G.wooEnd(); });
  bar.querySelector('#woo-x').onclick = () => RO.G.wooEnd();
};
UI.fadeLove = () => {
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;z-index:45;background:#000;opacity:0;transition:opacity .8s;display:grid;place-items:center;pointer-events:all';
  ov.innerHTML = '<div style="font-family:var(--pix);color:#ff3d8b;font-size:28px;letter-spacing:.1em;text-align:center">❤ ❤ ❤<div style="font-size:12px;color:#7d8088;margin-top:14px;letter-spacing:.3em">· · · unos minutos después · · ·</div></div>';
  document.body.appendChild(ov);
  if (!RO.muted) { RO.music.start(); }
  requestAnimationFrame(() => ov.style.opacity = '1');
  setTimeout(() => {
    ov.style.opacity = '0';
    const me = RO.G.mePos(); if (!me || me.room !== 'club') RO.music.stop();
    setTimeout(() => { ov.remove(); RO.G.npcLine(pick(V_AFTER)); RO.G.bubbleMe('😳'); }, 800);
  }, 3600);
};
UI.rueddaStats = async () => {
  const f = v => v == null ? '—' : new Intl.NumberFormat('es-VE').format(Math.round(v));
  const mo = UI.modal({ title: '📊 Ruedda hoy', sub: 'Mismos indicadores que Ruedda Control', wide: true, body: '<div class="muted">Valentina está sacando los números…</div>' });
  const s = await RO.Net.rueddaStats().catch(() => ({}));
  const box = mo.querySelector('.mo-b'); if (!box) return;
  const K = (l, v, d) => `<div><b>${v}</b><span>${l}${d ? ' · ' + d : ''}</span></div>`;
  box.innerHTML = `<div class="stat" style="grid-template-columns:repeat(4,1fr)">
      ${K('usuarios', f(s.users), f(s.newToday) + ' nuevos hoy')}${K('nuevos · 7 días', f(s.new7))}${K('identidad verificada', f(s.kyc))}${K('concesionarios', f(s.dealers))}
      ${K('market · activas', f(s.listings), f(s.sold) + ' vendidos')}${K('subastas en vivo', f(s.auctions))}${K('pujas hoy', f(s.bidsToday))}${K('volumen ofertado hoy', s.volToday == null ? '—' : '$' + f(s.volToday))}
    </div>
    <label class="lbl" style="margin-top:18px">pendientes</label>
    <div class="stat">${K('moderación', f(s.pendMod))}${K('KYC', f(s.pendKyc))}${K('pagos', f(s.pendPay))}</div>
    <p class="muted" style="margin-top:12px;font-size:12px">"—" = esa cifra solo la ve una cuenta superadmin.</p>`;
  const top = s.listings != null ? `Hoy hay ${f(s.listings)} carros activos y ${f(s.bidsToday)} pujas. ${s.bidsToday > 50 ? 'Nada mal.' : 'Hay que mover eso.'}` : 'Los números están, pero tu cuenta no los ve todos.';
  RO.G.npcLine(top);
};

/* ════════════ MI ESCRITORIO ════════════ */
UI.deskMenu = () => {
  const un = RO.S.notes.filter(n => n.to_user === RO.S.me.user_id && !n.read_at).length;
  const sup = RO.isAdmin();
  const opt = (a, t, d, y) => `<button class="act ${y ? 'y' : ''}" data-a="${a}" style="width:100%;margin-bottom:8px"><b>${t}</b><span>${d}</span></button>`;
  const mo = UI.modal({
    title: 'Mi escritorio', sub: 'Siéntate y trabaja: tu avatar se queda en la silla mientras tanto.',
    body: opt('sit', '🪑 Sentarme a trabajar', 'Tu estado pasa a "Ocupado" y te quedas en tu silla', true) +
      opt('ruedda', '🚗 Abrir Ruedda', 'www.ruedda.app en otra pestaña · te quedas sentado') +
      (sup ? opt('control', '🛠️ Abrir Ruedda Control', 'www.ruedda.app/control en otra pestaña · te quedas sentado') : '') +
      opt('pomo', '⏱️ Pomodoro 25 min', 'Te sientas, modo foco y te aviso cuando toca descanso') +
      opt('notes', '📌 Mis notas', un ? un + ' sin leer' : 'Post-its que te dejaron')
  });
  mo.querySelectorAll('[data-a]').forEach(b => b.onclick = () => {
    const a = b.dataset.a; UI.close();
    if (a === 'notes') return UI.notesInbox();
    const sat = RO.G.sitDesk();
    if (sat) { UI._deskBusy = true; RO.S.status = 'ocupado'; RO.emit('status', 'ocupado'); RO.$$('#sd-status button').forEach(x => x.classList.toggle('on', x.dataset.s === 'ocupado')); }
    if (a === 'pomo') UI.pomodoro(25);
    if (a === 'ruedda') window.open('https://www.ruedda.app/', '_blank', 'noopener');
    if (a === 'control') window.open('https://www.ruedda.app/control', '_blank', 'noopener');
  });
};
RO.on('stand', () => { if (UI._deskBusy && RO.S.status === 'ocupado') { UI._deskBusy = false; RO.S.status = 'disponible'; RO.emit('status', 'disponible'); RO.$$('#sd-status button').forEach(x => x.classList.toggle('on', x.dataset.s === 'disponible')); } });

/* ════════════ NOTAS (post-its) ════════════ */
const NOTE_COLORS = ['#e6f03b', '#ffb3d4', '#9fd3ff', '#a8f0c0', '#ffd08a'];
UI.composeNote = toUid => {
  const m = RO.member(toUid); let color = NOTE_COLORS[0];
  const on = RO.S.online.has(toUid);
  const mo = UI.modal({
    title: 'Post-it para ' + esc(m.display_name),
    sub: on ? 'Está en línea: le llega al instante.' : 'No está: lo verá en su escritorio y le avisaremos al entrar.',
    body: `<textarea class="ta" id="nt-body" maxlength="500" placeholder="Escribe tu nota…" style="min-height:130px"></textarea>
      <label class="lbl">color</label><div class="sw" id="nt-col">${NOTE_COLORS.map((c, i) => `<button data-c="${c}" class="${i ? '' : 'on'}" style="background:${c}"></button>`).join('')}</div>`,
    foot: `<button class="btn" onclick="RO.UI.close()">Cancelar</button><button class="btn y" id="nt-send">Pegar en su escritorio</button>`
  });
  const ta = mo.querySelector('#nt-body'); setTimeout(() => ta.focus(), 30);
  const paint = () => { ta.style.background = color; ta.style.color = '#1b1b14'; };
  paint();
  mo.querySelector('#nt-col').onclick = e => { const b = e.target.closest('button'); if (!b) return; color = b.dataset.c; mo.querySelectorAll('#nt-col button').forEach(x => x.classList.toggle('on', x === b)); paint(); };
  mo.querySelector('#nt-send').onclick = async () => {
    const body = ta.value.trim(); if (!body) return ta.focus();
    const btn = mo.querySelector('#nt-send'); btn.disabled = true;
    try {
      const n = await RO.Net.sendNote(toUid, body, color);
      if (n && !RO.S.notes.find(x => x.id === n.id)) RO.S.notes.unshift(n);
      RO.G.drawPostits(); UI.close(); RO.sfx.note();
      UI.toast('Post-it pegado en el escritorio de ' + esc(m.display_name));
      RO.Net.send({ t: 'note', u: RO.S.me.user_id, to: toUid });
      RO.Net.award('note').catch(() => {});
    } catch (e) { btn.disabled = false; err(e); }
  };
};
UI.notesInbox = (tab) => {
  tab = tab || 'in';
  const me = RO.S.me.user_id;
  const inbox = RO.S.notes.filter(n => n.to_user === me), sent = RO.S.notes.filter(n => n.from_user === me && n.to_user !== me);
  const list = tab === 'in' ? inbox : sent, unread = inbox.filter(n => !n.read_at).length;
  const mo = UI.modal({
    title: 'Mis notas', sub: unread ? `${unread} sin leer` : 'Todo al día',
    body: `<div class="tabs" style="margin:-18px -20px 16px;padding:0 20px"><button data-t="in" class="${tab === 'in' ? 'on' : ''}">Recibidas (${inbox.length})</button><button data-t="out" class="${tab === 'out' ? 'on' : ''}">Enviadas (${sent.length})</button></div>
      ${list.length ? list.map(n => `<div class="postit ${n.read_at && tab === 'in' ? 'read' : ''}" style="background:${esc(n.color || '#e6f03b')}"><div class="by">${tab === 'in' ? 'de ' + esc(RO.nameOf(n.from_user)) : 'para ' + esc(RO.nameOf(n.to_user))} · ${RO.ago(n.created_at)}${tab === 'out' ? (n.read_at ? ' · leída ✓' : ' · sin leer') : ''}</div><div class="body">${esc(n.body)}</div>
        <div class="ops">${tab === 'in' ? `${n.read_at ? '' : `<button data-r="${n.id}">Leída ✓</button>`}<button data-re="${n.from_user}">Responder</button>` : ''}<button data-d="${n.id}">Eliminar</button></div></div>`).join('') : '<div class="empty">No hay notas aquí.</div>'}`,
    foot: tab === 'in' && unread ? `<button class="btn" id="nt-all">Marcar todas como leídas</button>` : ''
  });
  mo.querySelectorAll('[data-t]').forEach(b => b.onclick = () => UI.notesInbox(b.dataset.t));
  mo.querySelectorAll('[data-r]').forEach(b => b.onclick = async () => { await markRead([+b.dataset.r || b.dataset.r]); UI.notesInbox('in'); });
  mo.querySelectorAll('[data-re]').forEach(b => b.onclick = () => UI.composeNote(b.dataset.re));
  mo.querySelectorAll('[data-d]').forEach(b => b.onclick = async () => {
    const id = isNaN(+b.dataset.d) ? b.dataset.d : +b.dataset.d;
    try { await RO.Net.deleteNote(id); RO.S.notes = RO.S.notes.filter(n => n.id !== id); RO.G.drawPostits(); UI.renderTop(); UI.notesInbox(tab); } catch (e) { err(e); }
  });
  const all = mo.querySelector('#nt-all'); if (all) all.onclick = async () => { await markRead(inbox.filter(n => !n.read_at).map(n => n.id)); UI.notesInbox('in'); };
};
async function markRead(ids) {
  try {
    for (const id of ids) { await RO.Net.readNote(id); const n = RO.S.notes.find(x => x.id === id); if (n) n.read_at = new Date().toISOString(); }
    RO.G.drawPostits(); UI.renderTop();
  } catch (e) { err(e); }
}
// aviso al entrar: "Tienes notas pendientes de Enrique"
UI.pendingNotesNotice = () => {
  const me = RO.S.me.user_id, un = RO.S.notes.filter(n => n.to_user === me && !n.read_at);
  if (!un.length) return;
  const names = Array.from(new Set(un.map(n => RO.nameOf(n.from_user))));
  const txt = names.length === 1 ? names[0] : names.slice(0, -1).join(', ') + ' y ' + names[names.length - 1];
  RO.sfx.note();
  UI.toast(`📌 Tienes ${un.length > 1 ? un.length + ' notas pendientes' : 'notas pendientes'} de <b>${esc(txt)}</b>`, 'note', [{ t: 'Ver', y: 1, f: () => UI.notesInbox('in') }, { t: 'Ir a mi escritorio', f: () => { const o = (RO.S.config.offices || []).find(z => z.slot === RO.S.me.slot); if (o) RO.G.goToOffice(o.pos); } }], 12000);
  UI.notify('Ruedda Office', `Tienes notas pendientes de ${txt}`);
};
UI.onNoteIn = n => {
  if (n.to_user !== RO.S.me.user_id) return;
  RO.sfx.note();
  UI.toast(`📌 <b>${esc(RO.nameOf(n.from_user))}</b> te dejó un post-it`, 'note', [{ t: 'Leer', y: 1, f: () => UI.notesInbox('in') }]);
  UI.notify('Post-it de ' + RO.nameOf(n.from_user), n.body);
};

/* ════════════ PIZARRA GENERAL (colaborativa en tiempo real) ════════════ */
const WB = UI.WB = { open: false, strokes: [], live: {}, color: '#111215', size: 4, erase: false };
const BW = 1600, BH = 900, BOARD_BG = '#fbfbf8';
WB.canvas = document.createElement('canvas'); WB.canvas.width = BW; WB.canvas.height = BH;
RO.boardCanvas = WB.canvas;
const wctx = WB.canvas.getContext('2d');
wctx.fillStyle = BOARD_BG; wctx.fillRect(0, 0, BW, BH);
function drawSeg(ctx, color, size, pts, from) {
  if (!pts.length) return;
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = size; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  const s = from || pts[0]; ctx.moveTo(s[0], s[1]);
  if (!from && pts.length === 1) { ctx.arc(s[0], s[1], size / 2, 0, Math.PI * 2); ctx.fill(); return; }
  for (const p of (from ? pts : pts.slice(1))) ctx.lineTo(p[0], p[1]);
  ctx.stroke();
}
let miniT = 0;
function miniSoon() { clearTimeout(miniT); miniT = setTimeout(() => {
  const c = document.createElement('canvas'); c.width = BW; c.height = BH; const g = c.getContext('2d'); g.drawImage(WB.canvas, 0, 0);
  (WB.notes || []).forEach(n => { g.fillStyle = n.color || '#fff27a'; g.fillRect(n.x, n.y, 160, 100); g.fillStyle = '#1b1b14'; g.font = '22px sans-serif'; g.fillText(String(n.body).slice(0, 14), n.x + 10, n.y + 40); });
  RO.G.updateBoardMini(c);
}, 300); }
WB.redraw = () => {
  wctx.fillStyle = BOARD_BG; wctx.fillRect(0, 0, BW, BH);
  WB.strokes.forEach(s => drawSeg(wctx, s.color, s.size, s.pts));
  WB.blit(); miniSoon();
};
WB.blit = () => { if (WB.view) { const v = WB.view.getContext('2d'); v.drawImage(WB.canvas, 0, 0, WB.view.width, WB.view.height); } };
WB.load = async () => {
  try { WB.strokes = (await RO.Net.loadStrokes('main')) || []; } catch (e) { WB.strokes = []; }
  WB.redraw(); WB.loaded = true;
};
WB.show = () => {
  if (WB.open) return; WB.open = true; RO.sfx.open();
  const cols = ['#111215', '#d4b800', '#d7262e', '#2c5bd6', '#1f7a4a', '#7c3aed', '#f08a24'];
  const el = document.createElement('div'); el.id = 'wb';
  el.innerHTML = `<div class="wb-bar">
      <div class="sw">${cols.map((c, i) => `<button data-c="${c}" class="${i ? '' : 'on'}" style="background:${c}"></button>`).join('')}</div>
      <span class="vsep"></span>
      <div class="sz sw">${[3, 7, 14].map((s, i) => `<button data-s="${s}" class="${i ? '' : 'on'}"><i style="width:${s + 2}px;height:${s + 2}px"></i></button>`).join('')}</div>
      <span class="vsep"></span>
      <button class="btn sm y" data-a="note">+ Nota</button>
      <button class="btn sm" data-a="erase">Borrador</button>
      <button class="btn sm" data-a="png">Descargar</button>
      <button class="btn sm red" data-a="clear">Limpiar</button>
      <span class="vsep"></span>
      <span class="wb-who" id="wb-who">pizarra general · en vivo</span>
      <button class="btn sm y" data-a="close">Cerrar (Esc)</button>
    </div>
    <div class="wb-stage"><canvas id="wb-view"></canvas></div>`;
  document.body.appendChild(el);
  WB.el = el;
  const view = el.querySelector('#wb-view'), stage = el.querySelector('.wb-stage');
  const fit = () => { const s = Math.min((innerWidth - 32) / BW, (innerHeight - 150) / BH); view.width = Math.round(BW * s); view.height = Math.round(BH * s); WB.blit(); WB.renderNotes(); };
  WB.view = view; fit(); WB._fit = fit; addEventListener('resize', fit);
  el.querySelector('.wb-bar').onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.c) { WB.color = b.dataset.c; WB.erase = false; el.querySelectorAll('[data-c]').forEach(x => x.classList.toggle('on', x === b)); el.querySelector('[data-a="erase"]').classList.remove('y'); }
    else if (b.dataset.s) { WB.size = +b.dataset.s; el.querySelectorAll('[data-s]').forEach(x => x.classList.toggle('on', x === b)); }
    else if (b.dataset.a === 'note') { WB.noteMode = true; UI.toast('Haz clic en la pizarra donde quieres la nota'); }
    else if (b.dataset.a === 'erase') { WB.erase = !WB.erase; b.classList.toggle('y', WB.erase); }
    else if (b.dataset.a === 'png') { const a = document.createElement('a'); a.download = 'pizarra-ruedda-' + new Date().toISOString().slice(0, 10) + '.png'; a.href = WB.canvas.toDataURL('image/png'); a.click(); }
    else if (b.dataset.a === 'clear') {
      WB.open = false; const ok = await UI.confirm('Limpiar la pizarra', 'Se borra para todo el equipo. ¿Seguro?', 'Limpiar', true); WB.open = true;
      if (!ok) return;
      try { await RO.Net.clearBoard('main'); WB.strokes = []; WB.notes = []; WB.renderNotes(); WB.redraw(); RO.Net.send({ t: 'bc', u: RO.S.me.user_id }); } catch (x) { err(x); }
    }
    else if (b.dataset.a === 'close') WB.hide();
  };
  // dibujo
  let cur = null, pending = [], sendT = 0, lastCur = 0;
  const pt = e => { const r = view.getBoundingClientRect(); return [Math.round((e.clientX - r.left) / r.width * BW), Math.round((e.clientY - r.top) / r.height * BH)]; };
  const flush = () => {
    if (!cur || !pending.length) return;
    RO.Net.send({ t: 'bs', u: RO.S.me.user_id, sid: cur.sid, c: cur.color, s: cur.size, p: pending, f: cur.sent ? 0 : 1 });
    cur.sent = true; pending = [];
  };
  view.addEventListener('pointerdown', e => {
    if (WB.noteMode) { WB.noteMode = false; const q = pt(e); WB.addNote(q[0], q[1]); return; }
    view.setPointerCapture(e.pointerId);
    const p = pt(e);
    cur = { sid: RO.uid(), color: WB.erase ? BOARD_BG : WB.color, size: WB.erase ? 36 : WB.size, pts: [p], sent: false };
    pending = [p]; drawSeg(wctx, cur.color, cur.size, [p]); WB.blit();
  });
  view.addEventListener('pointermove', e => {
    const p = pt(e), now = performance.now();
    if (now - lastCur > 90) { lastCur = now; RO.Net.send({ t: 'bk', u: RO.S.me.user_id, x: p[0], y: p[1] }); }
    if (!cur) return;
    const last = cur.pts[cur.pts.length - 1]; if (Math.abs(last[0] - p[0]) + Math.abs(last[1] - p[1]) < 2) return;
    drawSeg(wctx, cur.color, cur.size, [p], last); WB.blit();
    cur.pts.push(p); pending.push(p);
    if (now - sendT > 60) { sendT = now; flush(); }
  });
  const end = () => {
    if (!cur) return; flush();
    const st = { color: cur.color, size: cur.size, pts: cur.pts.length > 1500 ? cur.pts.filter((_, i) => i % 2 === 0) : cur.pts };
    WB.strokes.push(st); RO.Net.addStroke('main', st).catch(() => {});
    RO.Net.send({ t: 'be', u: RO.S.me.user_id, sid: cur.sid });
    cur = null; miniSoon();
    if (!WB.awarded) { WB.awarded = true; RO.Net.award('whiteboard').catch(() => {}); }
  };
  view.addEventListener('pointerup', end); view.addEventListener('pointercancel', end);
  WB.cursors = {}; WB.stage = stage;
  if (!WB.loaded) WB.load();
  WB.loadNotes();
};
/* notas escritas de la pizarra (se arrastran; se guardan en office_board_notes) */
WB.notes = [];
WB.loadNotes = async () => { try { WB.notes = (await RO.Net.loadBoardNotes('main')) || []; } catch (e) { WB.notes = []; } WB.renderNotes(); miniSoon(); };
WB.renderNotes = () => {
  if (!WB.stage || !WB.view) return;
  WB.stage.querySelectorAll('.wb-note').forEach(n => n.remove());
  const r = WB.view.getBoundingClientRect(), sx = r.width / BW, sy = r.height / BH;
  WB.notes.forEach(n => {
    const el = document.createElement('div'); el.className = 'wb-note'; el.dataset.id = n.id;
    el.style.cssText = `left:${n.x * sx}px;top:${n.y * sy}px;background:${esc(n.color || '#fff27a')}`;
    el.innerHTML = `<div class="wb-nb">${esc(n.body)}</div><div class="wb-nf"><span>${esc(RO.nameOf(n.author))}</span><button data-e title="Editar">✎</button><button data-d title="Borrar">✕</button></div>`;
    let drag = null;
    el.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; drag = { px: e.clientX, py: e.clientY, x: n.x, y: n.y }; el.setPointerCapture(e.pointerId); el.classList.add('drag'); e.stopPropagation(); });
    el.addEventListener('pointermove', e => { if (!drag) return; n.x = Math.round(RO.clamp(drag.x + (e.clientX - drag.px) / sx, 0, BW - 160)); n.y = Math.round(RO.clamp(drag.y + (e.clientY - drag.py) / sy, 0, BH - 100)); el.style.left = n.x * sx + 'px'; el.style.top = n.y * sy + 'px'; RO.Net.send({ t: 'bnote', u: RO.S.me.user_id, op: 'move', id: n.id, x: n.x, y: n.y }); });
    el.addEventListener('pointerup', () => { if (!drag) return; drag = null; el.classList.remove('drag'); RO.Net.updateBoardNote(n.id, { x: n.x, y: n.y }).catch(() => {}); miniSoon(); });
    el.querySelector('[data-d]').onclick = async () => { WB.notes = WB.notes.filter(z => z.id !== n.id); WB.renderNotes(); RO.Net.send({ t: 'bnote', u: RO.S.me.user_id, op: 'del', id: n.id }); RO.Net.deleteBoardNote(n.id).catch(() => {}); miniSoon(); };
    el.querySelector('[data-e]').onclick = () => { const t = prompt('Editar nota', n.body); if (t == null || !t.trim()) return; n.body = t.trim().slice(0, 300); WB.renderNotes(); RO.Net.send({ t: 'bnote', u: RO.S.me.user_id, op: 'upd', note: n }); RO.Net.updateBoardNote(n.id, { body: n.body }).catch(() => {}); miniSoon(); };
    WB.stage.appendChild(el);
  });
};
WB.addNote = async (x, y) => {
  const t = prompt('Escribe la nota para la pizarra'); if (!t || !t.trim()) return;
  const COLS = ['#fff27a', '#ffb3d4', '#9fd3ff', '#a8f0c0', '#ffd08a'];
  const n = { body: t.trim().slice(0, 300), x: Math.round(x), y: Math.round(y), color: COLS[WB.notes.length % COLS.length] };
  try { const saved = await RO.Net.addBoardNote('main', n); WB.notes.push(saved); WB.renderNotes(); RO.Net.send({ t: 'bnote', u: RO.S.me.user_id, op: 'add', note: saved }); miniSoon(); RO.Net.award('whiteboard').catch(() => {}); } catch (e) { err(e); }
};
WB.onNote = m => {
  if (m.op === 'add' && m.note && !WB.notes.find(z => z.id === m.note.id)) WB.notes.push(m.note);
  if (m.op === 'upd' && m.note) { const o = WB.notes.find(z => z.id === m.note.id); if (o) Object.assign(o, m.note); }
  if (m.op === 'move') { const o = WB.notes.find(z => z.id === m.id); if (o) { o.x = m.x; o.y = m.y; } }
  if (m.op === 'del') WB.notes = WB.notes.filter(z => z.id !== m.id);
  WB.renderNotes(); miniSoon();
};
WB.hide = () => {
  if (!WB.open) return; WB.open = false;
  removeEventListener('resize', WB._fit);
  if (WB.el) WB.el.remove(); WB.el = null; WB.view = null; WB.awarded = false;
  miniSoon();
};
// red → pizarra
WB.onSeg = m => {
  const L = WB.live[m.sid] || (WB.live[m.sid] = { color: m.c, size: m.s, pts: [], last: null });
  if (!m.p || !m.p.length) return;
  drawSeg(wctx, L.color, L.size, m.p, L.last);
  L.pts.push(...m.p); L.last = m.p[m.p.length - 1];
  WB.blit(); miniSoon();
};
WB.onEnd = m => { const L = WB.live[m.sid]; if (L) { WB.strokes.push({ color: L.color, size: L.size, pts: L.pts }); delete WB.live[m.sid]; } };
WB.onClear = () => { WB.strokes = []; WB.live = {}; WB.notes = []; WB.renderNotes(); WB.redraw(); };
WB.onCursor = m => {
  if (!WB.open || !WB.stage) return;
  let c = WB.cursors[m.u];
  if (!c) { c = document.createElement('div'); c.className = 'wb-cur'; c.style.background = colorOf(m.u); c.style.color = '#111'; c.textContent = RO.nameOf(m.u); WB.stage.appendChild(c); WB.cursors[m.u] = c; }
  const r = WB.view.getBoundingClientRect();
  c.style.left = (m.x / BW * r.width) + 'px'; c.style.top = (m.y / BH * r.height) + 'px';
  clearTimeout(c._t); c._t = setTimeout(() => { c.remove(); delete WB.cursors[m.u]; }, 3000);
};

/* ════════════ AVATAR ════════════ */
UI.avatarEditor = targetUid => {
  targetUid = targetUid || RO.S.me.user_id;
  const m = RO.member(targetUid); if (!m) return;
  const canEdit = targetUid === RO.S.me.user_id || RO.isAdmin(); if (!canEdit) return;
  let av = A.normAvatar(m.avatar, targetUid), dir = 'down', step = 0;
  const AV = A.AV, L = A.AV_LABEL;
  const bottoms = ['#16171b', '#2b3442', '#5b6573', '#3d2b1f', '#1e2a44', '#f4f4f2', '#c9a96e', '#7a2f3a', '#1f7a4a'];
  const shoes = ['#16171b', '#f4f4f2', '#6e4122', '#d7262e', '#e6f03b', '#2c5bd6'];
  const sw = (k, arr) => `<div class="sw" data-k="${k}">${arr.map(c => `<button data-v="${c}" style="background:${c}" class="${av[k] === c ? 'on' : ''}"></button>`).join('')}</div>`;
  const ch = (k, arr) => `<div class="chips" data-k="${k}">${arr.map(v => `<button data-v="${v}" class="${av[k] === v ? 'on' : ''}">${esc((L[k] && L[k][v]) || v)}</button>`).join('')}</div>`;
  const mo = UI.modal({
    title: targetUid === RO.S.me.user_id ? 'Mi avatar' : 'Avatar de ' + esc(m.display_name), wide: true,
    body: `<div class="av-wrap"><div class="av-prev"><span id="av-c"></span><div class="rot"><button data-d="left">◀</button><button data-d="down">frente</button><button data-d="up">espalda</button><button data-d="right">▶</button></div></div>
      <div>
        <label class="lbl">piel</label>${sw('skin', AV.skin)}
        <label class="lbl">peinado</label>${ch('hair', AV.hair)}
        <label class="lbl">color de pelo</label>${sw('hairColor', AV.hairColor)}
        <label class="lbl">ropa</label>${ch('outfit', AV.outfit)}
        <div class="row" style="align-items:flex-start"><div><label class="lbl">parte de arriba</label>${sw('top', AV.colors)}</div></div>
        <div class="row" style="align-items:flex-start"><div><label class="lbl">parte de abajo</label>${sw('bottom', bottoms)}</div><div><label class="lbl">zapatos</label>${sw('shoes', shoes)}</div></div>
        <label class="lbl">accesorio</label>${ch('acc', AV.acc)}
        <label class="lbl">barba</label>${ch('beard', AV.beard)}
      </div></div>`,
    foot: `<button class="btn" id="av-rnd">Aleatorio</button><span class="sp"></span><button class="btn" onclick="RO.UI.close()">Cancelar</button><button class="btn y" id="av-save">Guardar avatar</button>`
  });
  const holder = mo.querySelector('#av-c');
  let tick = 0;
  const draw = () => { holder.innerHTML = ''; holder.appendChild(A.avatarFull(av, 9, dir, step)); };
  const iv = setInterval(() => { tick++; step = [0, 1, 0, 2][tick % 4]; draw(); if (!mo.isConnected) clearInterval(iv); }, 220);
  draw();
  mo.querySelector('.rot').onclick = e => { const b = e.target.closest('button'); if (b) { dir = b.dataset.d; draw(); } };
  mo.querySelectorAll('[data-k]').forEach(g => g.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    av[g.dataset.k] = b.dataset.v; g.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); draw();
  });
  mo.querySelector('#av-rnd').onclick = () => { av = A.defaultAvatar(Math.random() + ''); mo.querySelectorAll('[data-k]').forEach(g => g.querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.v === av[g.dataset.k]))); draw(); };
  mo.querySelector('#av-save').onclick = async () => {
    try {
      await RO.Net.saveAvatar(targetUid, av);
      m.avatar = av; if (targetUid === RO.S.me.user_id) RO.S.me.avatar = av;
      RO.G.refreshPlayer(targetUid); UI.renderPeople(); UI.close(); UI.toast('Avatar guardado'); RO.sfx.coin();
    } catch (e) { err(e); }
  };
};

/* ════════════ TIENDA ════════════ */
UI.shop = () => {
  const me = RO.S.me, items = RO.S.catalog.filter(c => c.active && A.ITEMS[c.item]);
  const cats = Array.from(new Set(items.map(i => i.category)));
  const mo = UI.modal({
    title: 'Tienda de decoración', sub: `Tienes <b style="color:var(--y)">${me.coins}</b> monedas · <b>gratis dentro de tu oficina</b>, con monedas en las áreas comunes · las oficinas de otros no se tocan`, wide: true,
    body: cats.map(c => `<label class="lbl">${esc(c)}</label><div class="shop">${items.filter(i => i.category === c).map(i => `<button class="si ${me.coins < i.price ? 'na' : ''}" data-i="${esc(i.item)}"><span data-cv="${esc(i.item)}"></span><b>${esc(i.name)}</b><span class="pr"><i class="coin"></i>${i.price}</span></button>`).join('')}</div>`).join('') || '<div class="empty">La tienda está vacía.</div>',
    foot: `<button class="btn" id="sh-move">Mover / quitar mi decoración</button>`
  });
  mo.querySelectorAll('[data-cv]').forEach(s => s.appendChild(A.drawItem(s.dataset.cv)));
  mo.querySelectorAll('[data-i]').forEach(b => b.onclick = () => {
    const c = items.find(i => i.item === b.dataset.i);
    if (me.coins < c.price && !Wd().officeRect(me.slot, RO.S.config)) { RO.sfx.err(); return UI.toast('Te faltan ' + (c.price - me.coins) + ' monedas', 'err'); }
    UI.close(); UI.startEdit({ mode: 'place', item: c.item, buy: true, price: c.price, name: c.name });
  });
  mo.querySelector('#sh-move').onclick = () => { UI.close(); UI.startEdit({ mode: 'move' }); };
};

/* ── modo edición del mapa ── */
UI.startEdit = e => {
  RO.G.setEdit(e);
  const bar = $('#edit-bar');
  bar.innerHTML = e.mode === 'desk' ? `<span>Moviendo tu <b>escritorio</b> — clic dentro de tu oficina</span><button data-x>Cancelar (Esc)</button>` : e.mode === 'place'
    ? `<span>${e.moveId ? 'Moviendo' : e.buy ? 'Comprando' : 'Colocando'}: <b>${esc(e.name || A.ITEMS[e.item].name || e.item)}</b>${e.buy ? ` · ${e.price} monedas` : ''} — clic en el piso para ponerlo</span><button data-x>Cancelar (Esc)</button>`
    : `<span>Clic sobre una decoración para moverla o quitarla</span><button data-x>Listo</button>`;
  bar.classList.remove('hidden');
  bar.querySelector('[data-x]').onclick = () => RO.emit('edit:cancel');
};
UI.endEdit = () => { const s = RO.G.scene; if (s && s.edit && s.edit.moveId && s.edit.restore) { RO.S.decor.push(s.edit.restore); RO.G.syncDecor(); } RO.G.setEdit(null); $('#edit-bar').classList.add('hidden'); };
RO.on('edit:cancel', () => UI.endEdit());
RO.on('edit:place', async (item, x, y) => {
  const e = RO.G.scene.edit; if (!e) return;
  try {
    if (e.moveId) {
      await RO.Net.moveDecor(e.moveId, x, y);
      const d = Object.assign({}, e.restore, { x, y }); e.restore = null; RO.S.decor = RO.S.decor.filter(z => z.id !== d.id).concat([d]);
    } else if (e.buy) {
      const mine = Wd().officeRect(RO.S.me.slot, RO.S.config), inMine = mine && x >= mine.x0 && x <= mine.x1 && y >= mine.y0 && y <= mine.y1;
      const r = inMine ? await RO.Net.placeOwn(item, x, y) : await RO.Net.buy(item, x, y);
      if (!r || !r.ok) { UI.toast(r && r.reason === 'saldo' ? 'No te alcanzan las monedas (en tu oficina es gratis)' : 'No se pudo colocar', 'err'); return UI.endEdit(); }
      if (!RO.S.decor.find(z => z.id === r.decor.id)) RO.S.decor.push(r.decor);
      if (r.coins != null) RO.S.me.coins = r.coins; UI.renderTop(); RO.sfx.coin();
      if (inMine) UI.toast('Puesto en tu oficina · gratis');
      RO.Net.send({ t: 'emote', u: RO.S.me.user_id, e: '🛍️' });
    } else {
      const d = await RO.Net.placeFree(item, x, y); if (d && !RO.S.decor.find(z => z.id === d.id)) RO.S.decor.push(d);
    }
    RO.G.syncDecor(); RO.sfx.blip();
  } catch (x) { err(x); }
  UI.endEdit();
});
RO.on('edit:pick', d => {
  const r = Wd().officeRect(RO.S.me.slot, RO.S.config), inMine = r && d.x >= r.x0 && d.x <= r.x1 && d.y >= r.y0 && d.y <= r.y1;
  const mine = d.placed_by === RO.S.me.user_id || inMine;
  if (!mine && !RO.isAdmin()) return UI.toast('Solo quien lo puso, el dueño de la oficina o un admin lo pueden mover', 'err');
  const it = A.ITEMS[d.item];
  const mo = UI.modal({ title: esc(it.name || d.item), sub: 'Puesto por ' + esc(RO.nameOf(d.placed_by)), body: '<p class="muted">¿Qué quieres hacer?</p>', foot: `<button class="btn red" data-a="del">Quitar</button><button class="btn y" data-a="mv">Mover</button>` });
  mo.querySelector('[data-a="mv"]').onclick = () => {
    UI.close();
    RO.S.decor = RO.S.decor.filter(z => z.id !== d.id); RO.G.syncDecor();
    UI.startEdit({ mode: 'place', item: d.item, moveId: d.id, restore: d, name: it.name });
    RO.G.scene.edit.restore = d;
  };
  mo.querySelector('[data-a="del"]').onclick = async () => {
    try { await RO.Net.removeDecor(d.id); RO.S.decor = RO.S.decor.filter(z => z.id !== d.id); RO.G.syncDecor(); UI.close(); UI.toast('Quitado (sin reembolso)'); } catch (e) { err(e); }
  };
});

/* ════════════ RANKING ════════════ */
UI.ranking = () => {
  const ms = RO.S.members.slice().sort((a, b) => (b.points || 0) - (a.points || 0));
  const total = ms.reduce((s, m) => s + (m.points || 0), 0);
  const mo = UI.modal({
    title: 'Ranking de productividad', sub: `Equipo: ${total} pts acumulados`,
    body: ms.map((m, i) => `<div class="rank"><span class="n">${i + 1}</span><span data-h="${esc(m.user_id)}"></span><b>${esc(m.display_name)} <span class="muted" style="font-weight:400">· ${esc(m.cargo || '')}</span></b><span class="p">${m.points || 0} pts</span></div>`).join('') +
      `<p class="muted" style="margin-top:14px;font-size:12.5px;line-height:1.5">Cómo se ganan: check-in diario +10 · acelerar proyecto +${RO.S.config.boost_points || 15} por persona · campana de ventas +5 · chocar los cinco +2 · post-it +1 · pizarra +1 · café +1.</p>`
  });
  mo.querySelectorAll('[data-h]').forEach(s => s.appendChild(headCanvas(RO.member(s.dataset.h), 2)));
};

/* ════════════ ACCIONES DE GRUPO ════════════ */
UI.emergency = async () => {
  const ok = await UI.confirm('Reunión de emergencia', 'Todos los conectados serán teletransportados a la sala de juntas, con alarma incluida.', 'Convocar', true);
  if (!ok) return;
  const m = { t: 'emergency', u: RO.S.me.user_id }; RO.Net.send(m); UI.onEmergency(m);
  RO.Net.logEvent('emergency', {}).catch(() => {});
};
UI.onEmergency = m => {
  RO.sfx.siren();
  const f = $('#flash'); f.className = ''; void f.offsetWidth; f.className = 'red';
  UI.banner('Reunión de emergencia', 'convocada por ' + RO.nameOf(m.u), 'red', 4200);
  setTimeout(() => {
    WB.hide(); UI.close();
    const ids = Array.from(new Set([RO.S.me.user_id, ...RO.S.online.keys()])).sort();
    const seats = RO.G.seats(), i = Math.max(0, ids.indexOf(RO.S.me.user_id)) % seats.length, s = seats[i];
    RO.G.teleport(s.x, s.y, s.dir);
  }, 1600);
};
UI.boost = async () => {
  const parts = Array.from(new Set([RO.S.me.user_id, ...RO.S.online.keys()])).filter(u => RO.member(u));
  try {
    const r = await RO.Net.boost(parts);
    if (!r || !r.ok) {
      if (r && r.reason === 'cooldown') { const mins = Math.max(1, Math.ceil((new Date(r.retry_at) - Date.now()) / 60000)); return UI.toast(`El motor se está enfriando. Disponible en ${mins} min.`, 'err'); }
      return UI.toast('No se pudo acelerar', 'err');
    }
    const m = { t: 'boost', u: RO.S.me.user_id, pts: r.points, n: r.count }; RO.Net.send(m); UI.onBoost(m);
  } catch (e) { err(e); }
};
UI.onBoost = m => {
  RO.sfx.boost(); RO.G.fxBoost(); RO.G.fxConfetti();
  UI.banner('¡Proyecto acelerado!', `${RO.nameOf(m.u)} metió quinta · +${m.pts} pts para ${m.n} ${m.n === 1 ? 'persona' : 'personas'}`, '', 4200);
};
UI.summon = (onlyUid) => {
  const o = (RO.S.config.offices || []).find(z => z.slot === RO.S.me.slot);
  if (!o) return UI.toast('No tienes oficina asignada', 'err');
  RO.Net.send({ t: 'invite', u: RO.S.me.user_id, pos: o.pos, to: onlyUid || null });
  UI.toast(onlyUid ? 'Invitación enviada a ' + esc(RO.nameOf(onlyUid)) : 'Invitaste al equipo a tu oficina');
};
UI.onInvite = m => {
  if (m.to && m.to !== RO.S.me.user_id) return;
  RO.sfx.open();
  UI.toast(`<b>${esc(RO.nameOf(m.u))}</b> te invita a su oficina`, '', [{ t: 'Ir', y: 1, f: () => RO.G.goToOffice(m.pos) }]);
};
UI.dealModal = () => {
  const mo = UI.modal({
    title: '🔔 Campana de ventas', sub: 'Tócala cuando se cierre algo: todo el equipo lo celebra.',
    body: `<input class="in" id="dl-t" maxlength="120" placeholder="¿Qué se cerró? Ej: Venta Corolla 2020 · Nuevo concesionario aliado">`,
    foot: `<button class="btn" onclick="RO.UI.close()">Cancelar</button><button class="btn y" id="dl-go">Tocar la campana</button>`
  });
  const i = mo.querySelector('#dl-t'); setTimeout(() => i.focus(), 30);
  const go = () => {
    const text = i.value.trim() || 'un trato'; UI.close();
    const m = { t: 'deal', u: RO.S.me.user_id, text }; RO.Net.send(m); UI.onDeal(m);
    RO.Net.logEvent('deal', { text }).catch(() => {}); RO.Net.award('deal').catch(() => {});
  };
  mo.querySelector('#dl-go').onclick = go; i.onkeydown = e => { if (e.key === 'Enter') go(); };
};
UI.onDeal = m => { RO.sfx.gong(); RO.G.fxConfetti(); UI.banner('¡Trato cerrado!', RO.nameOf(m.u) + ': ' + m.text, '', 5000); };

/* relojes grandes, TV en vivo, arcade */
UI.clocksModal = () => {
  const list = RO.S.config.clocks || [];
  const mo = UI.modal({ title: 'Relojes', sub: 'Hora local de cada sede', body: `<div class="bigclk" id="bc"></div>` });
  const paint = () => { const el = mo.querySelector('#bc'); if (!el) return clearInterval(iv); el.innerHTML = list.map(c => `<div>${clockSvg(c.tz).replace('<svg', '<svg width="54" height="54"')}<b>${hhmm(c.tz, true)}</b><span>${esc(c.label)} · ${new Date().toLocaleDateString('es-VE', { timeZone: c.tz, weekday: 'long', day: 'numeric', month: 'short' })}</span></div>`).join(''); };
  const iv = setInterval(paint, 1000); paint();
};
UI.tvModal = async () => {
  const mo = UI.modal({ title: 'Ruedda en vivo', sub: 'Datos reales de ruedda.app', body: `<div class="stat"><div><b>…</b><span>publicaciones</span></div><div><b>…</b><span>subastas</span></div><div><b>…</b><span>usuarios</span></div></div>` });
  const s = await RO.Net.liveStats().catch(() => ({}));
  const b = mo.querySelectorAll('.stat b'); if (!b.length) return;
  const f = v => v == null ? '—' : new Intl.NumberFormat('es-VE').format(v);
  b[0].textContent = f(s.listings); b[1].textContent = f(s.auctions); b[2].textContent = f(s.users);
};
UI.arcade = () => {
  let best = 0; try { best = +localStorage.getItem('ro_arcade') || 0; } catch (e) {}
  const mo = UI.modal({ title: 'RUEDDA RACER', sub: 'Semáforo de arrancada: presiona ESPACIO (o clic) cuando se ponga verde.', body: `<div id="ar" style="height:220px;border-radius:12px;display:grid;place-items:center;background:#0b0c0e;border:1px solid var(--line);cursor:pointer;user-select:none"><div style="text-align:center"><div id="ar-l" style="display:flex;gap:14px;justify-content:center;margin-bottom:18px">${'<i style="width:34px;height:34px;border-radius:50%;background:#2a0e11;display:block"></i>'.repeat(3)}</div><div id="ar-t" style="font-family:var(--pix);font-size:22px;color:var(--y)">CLIC PARA EMPEZAR</div><div class="muted mono" style="margin-top:8px">récord: ${best ? best + ' ms' : '—'}</div></div></div>` });
  const ar = mo.querySelector('#ar'), lights = mo.querySelectorAll('#ar-l i'), t = mo.querySelector('#ar-t');
  let state = 'idle', goAt = 0, tm = [];
  const reset = () => { tm.forEach(clearTimeout); tm = []; lights.forEach(l => l.style.background = '#2a0e11'); };
  const hit = () => {
    if (state === 'idle' || state === 'done') { reset(); state = 'wait'; t.textContent = 'ATENTO…'; [0, 1, 2].forEach(i => tm.push(setTimeout(() => { lights[i].style.background = '#ff3b47'; RO.sfx.blip(); }, 600 * (i + 1))));
      tm.push(setTimeout(() => { lights.forEach(l => l.style.background = '#3ddc84'); goAt = performance.now(); state = 'go'; t.textContent = '¡YA!'; }, 1800 + 600 + Math.random() * 1800)); }
    else if (state === 'wait') { reset(); state = 'done'; t.textContent = 'SALIDA EN FALSO 🚩'; RO.sfx.err(); }
    else if (state === 'go') {
      const ms = Math.round(performance.now() - goAt); state = 'done';
      const rec = !best || ms < best; if (rec) { best = ms; try { localStorage.setItem('ro_arcade', ms); } catch (e) {} }
      t.innerHTML = ms + ' MS' + (rec ? '<br><span style="font-size:13px;color:#3ddc84">¡NUEVO RÉCORD!</span>' : ''); RO.sfx.coin();
      RO.Net.award('arcade').catch(() => {});
      RO.Net.send({ t: 'emote', u: RO.S.me.user_id, e: '🏁 ' + ms + 'ms' });
    }
  };
  ar.onclick = hit;
  const kd = e => { if (e.key === ' ' && ar.isConnected) { e.preventDefault(); hit(); } else if (!ar.isConnected) removeEventListener('keydown', kd); };
  addEventListener('keydown', kd);
};
UI.help = () => UI.modal({
  title: 'Controles', sub: 'Ruedda Office',
  body: `<div class="keys">
    <div><kbd class="k2">W</kbd><kbd class="k2">A</kbd><kbd class="k2">S</kbd><kbd class="k2">D</kbd></div><div>Caminar (o flechas · clic en el piso para ir)</div>
    <div><kbd class="k2">Shift</kbd></div><div>Correr</div>
    <div><kbd>E</kbd></div><div>Interactuar (escritorios, pizarra, campana, autos, Valentina…)</div>
    <div><kbd class="k2">H</kbd></div><div>Chocar los cinco (los dos al mismo tiempo)</div>
    <div><kbd class="k2">Enter</kbd></div><div>Escribir en el chat global</div>
    <div><kbd class="k2">1</kbd>–<kbd class="k2">8</kbd></div><div>Emotes 👍 😂 🔥 ☕ 🚗 💸 🙌 👀</div>
    <div><kbd class="k2">N</kbd></div><div>Mis notas</div>
    <div><kbd class="k2">Rueda</kbd></div><div>Zoom</div>
    <div><kbd class="k2">Esc</kbd></div><div>Cerrar</div>
  </div><p class="muted" style="margin-top:16px;line-height:1.5;font-size:12.5px">Dicen que detrás de alguna estantería de la zona de ocio hay algo… exagerado.</p>`,
  foot: `<button class="btn" id="hp-n">Activar notificaciones</button>`
}).querySelector('#hp-n').onclick = () => { UI.askNotify(); UI.close(); };

/* ════════════ MINIMAPA ════════════ */
UI.minimap = () => {
  const cv = $('#minimap'), g = cv.getContext('2d'), Wd = RO.World, s = 3;
  let base = null, baseKey = '';
  const COL = { pasillo: '#2b2e35', juntas: '#323a4a', lobby: '#1e1f24', creativa: '#7a6448', ocio: '#8f949b', terraza: '#6f5d46', garage: '#1a1022' };
  const paint = () => {
    const sc = RO.G.scene; if (!sc || !sc.w) return;
    const key = (sc.vipSeen ? 1 : 0) + ':' + (sc.clubSeen ? 1 : 0) + ':' + (sc.secretOpen ? 1 : 0) + ':' + JSON.stringify(RO.S.config.offices);
    if (key !== baseKey) {
      baseKey = key; base = document.createElement('canvas'); base.width = cv.width; base.height = cv.height;
      const b = base.getContext('2d'); b.fillStyle = '#0a0b0d'; b.fillRect(0, 0, cv.width, cv.height);
      for (let y = 0; y < Wd.H; y++) for (let x = 0; x < Wd.W; x++) {
        const r = sc.w.room[y][x];
        if ((y >= 39 && !sc.vipSeen) || (y >= 54 && !sc.clubSeen)) continue;
        if (sc.w.grid[y][x] === 0) { const st = r && r.startsWith('off') ? RO.World.styleOf(r, RO.S.config) : null; b.fillStyle = st ? st.a : (COL[r] || '#2b2e35'); }
        else b.fillStyle = '#16171a';
        b.fillRect(x * s, y * s, s, s);
      }
      if (!sc.vipSeen) { b.fillStyle = '#5b5e66'; b.font = '9px JetBrains Mono, monospace'; b.fillText('???', 74, 165); }
      else if (!sc.clubSeen) { b.fillStyle = '#5b5e66'; b.font = '9px JetBrains Mono, monospace'; b.fillText('???', 74, 190); }
    }
    g.drawImage(base, 0, 0);
    sc.players.forEach(p => {
      if (!p.isMe && ((p.y > 39 * 16 && !sc.vipSeen) || (p.y > 54 * 16 && !sc.clubSeen))) return;
      g.fillStyle = p.isMe ? '#e6f03b' : '#ffffff'; g.fillRect(Math.round(p.x / 16 * s) - 2, Math.round(p.y / 16 * s) - 2, 4, 4);
    });
    if (sc.npc && sc.vipSeen) { g.fillStyle = '#e85b9c'; g.fillRect(Math.round(sc.npc.x / 16 * s) - 1, Math.round(sc.npc.y / 16 * s) - 1, 3, 3); }
  };
  setInterval(paint, 250);
  cv.onclick = e => { const r = cv.getBoundingClientRect(); const x = Math.floor((e.clientX - r.left) / r.width * cv.width / s), y = Math.floor((e.clientY - r.top) / r.height * cv.height / s); const sc = RO.G.scene; if (!sc || (y >= 39 && !sc.vipSeen) || (y >= 54 && !sc.clubSeen)) return; RO.G.goToSpot(x, y); };
};

/* ════════════ MI OFICINA (cada quien edita la suya) ════════════ */
const Wd = () => RO.World;
UI.myOffice = () => {
  const me = RO.S.me, o = (RO.S.config.offices || []).find(z => z.slot === me.slot);
  if (!o) return UI.toast('Todavía no tienes oficina asignada. Pídesela a un admin.', 'err');
  let theme = o.theme || 'madera', bare = !!o.bare;
  const mo = UI.modal({
    title: 'Mi oficina', sub: 'Solo tú (y los admins) pueden cambiarla. Decorarla es gratis.',
    body: `<label class="lbl">nombre en la puerta</label><input class="in" id="mo-t" maxlength="24" value="${esc(o.title || '')}" placeholder="Oficina de ${esc(me.display_name)}">
      <label class="lbl">piso y paredes</label><div class="chips" id="mo-th">${Object.entries(RO.THEMES).map(([k, t]) => `<button data-v="${k}" class="${theme === k ? 'on' : ''}"><i style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${t.a};margin-right:6px;vertical-align:-1px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.2)"></i>${esc(t.name)}</button>`).join('')}</div>
      <label class="lbl">muebles base</label><div class="chips" id="mo-b"><button data-v="0" class="${bare ? '' : 'on'}">Completa (sofá, estantería, plantas…)</button><button data-v="1" class="${bare ? 'on' : ''}">Mínima (solo escritorio)</button></div>
      <p class="muted" style="margin-top:14px;font-size:12.5px;line-height:1.5">Con "Decorar" eliges cualquier artículo de la tienda y lo pones gratis dentro de tu oficina. También puedes decorar las áreas comunes (con monedas), pero no las oficinas de otros.</p>`,
    foot: `<button class="btn" id="mo-desk">Mover escritorio</button>${o.bare ? '' : '<button class="btn" id="mo-unpack">Soltar muebles base</button>'}<button class="btn" id="mo-mv">Mover / quitar</button><button class="btn" id="mo-dec">Decorar</button><span class="sp"></span><button class="btn y" id="mo-save">Guardar</button>`
  });
  mo.querySelector('#mo-th').onclick = e => { const b = e.target.closest('button'); if (!b) return; theme = b.dataset.v; mo.querySelectorAll('#mo-th button').forEach(x => x.classList.toggle('on', x === b)); };
  mo.querySelector('#mo-b').onclick = e => { const b = e.target.closest('button'); if (!b) return; bare = b.dataset.v === '1'; mo.querySelectorAll('#mo-b button').forEach(x => x.classList.toggle('on', x === b)); };
  mo.querySelector('#mo-save').onclick = async () => {
    const title = mo.querySelector('#mo-t').value.trim();
    try {
      await RO.Net.updateMyOffice(title, theme, bare);
      Object.assign(o, { title, theme, bare }); RO.G.rebuild(); UI.close(); UI.toast('Oficina actualizada'); RO.sfx.coin();
      const p = RO.G.mePos(); if (p) UI.setRoom(RO.World.roomName(p.room, RO.S.config));
    } catch (e) { err(e); }
  };
  mo.querySelector('#mo-dec').onclick = () => { UI.close(); UI.shop(); };
  mo.querySelector('#mo-mv').onclick = () => { UI.close(); UI.startEdit({ mode: 'move' }); };
  mo.querySelector('#mo-desk').onclick = () => { UI.close(); RO.G.goToOffice(o.pos); UI.startEdit({ mode: 'desk' }); };
  const un = mo.querySelector('#mo-unpack');
  if (un) un.onclick = async () => { try { await RO.Net.unpackBase(); o.bare = true; RO.G.rebuild(); UI.close(); UI.toast('Listo: los muebles base ahora se mueven y se quitan con "Mover / quitar"'); UI.startEdit({ mode: 'move' }); } catch (e) { err(e); } };
};
RO.on('edit:desk', async (x, y) => {
  try { await RO.Net.setMyDesk(x, y); const r = RO.World.officeRect(RO.S.me.slot, RO.S.config); const o = (RO.S.config.offices || []).find(z => z.slot === RO.S.me.slot); if (o && r) o.desk = [x - r.x0, y]; RO.G.rebuild(); RO.sfx.coin(); UI.toast('Escritorio movido'); } catch (e) { err(e); }
  UI.endEdit();
});

/* ════════════ CELULAR / TABLET ════════════ */
UI.initTouch = () => {
  const joy = document.createElement('div'); joy.id = 'joy'; joy.innerHTML = '<i></i>'; $('#app').appendChild(joy);
  const knob = joy.querySelector('i'); let id = null, cx = 0, cy = 0;
  const R = 46;
  const move = e => { const dx = e.clientX - cx, dy = e.clientY - cy, d = Math.min(R, Math.hypot(dx, dy)), a = Math.atan2(dy, dx);
    const x = Math.cos(a) * d, y = Math.sin(a) * d; knob.style.transform = `translate(${x}px,${y}px)`;
    const m = d / R; RO.G.setStick(m > 0.2 ? Math.cos(a) : 0, m > 0.2 ? Math.sin(a) : 0, m > 0.85); };
  joy.addEventListener('pointerdown', e => { id = e.pointerId; joy.setPointerCapture(id); const r = joy.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; move(e); e.preventDefault(); });
  joy.addEventListener('pointermove', e => { if (e.pointerId === id) move(e); });
  const end = () => { id = null; knob.style.transform = ''; RO.G.setStick(0, 0, false); };
  joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end);
  // panel y chat empiezan cerrados en pantallas chicas
  if (innerWidth < 1100) { UI.togglePanel(true); $('#chat').classList.add('min'); }
};
// el aviso de interacción se puede tocar (celular) o clicar
document.addEventListener('click', e => { if (e.target.closest('#hint')) RO.G.interact(); });

/* panel lateral: se puede esconder para ver más mapa */
UI.togglePanel = force => {
  const side = $('#side'), hide = force != null ? force : !side.classList.contains('collapsed');
  side.classList.toggle('collapsed', hide);
  document.body.classList.toggle('panel-off', hide);
  try { localStorage.setItem('ro_panel', hide ? '0' : '1'); } catch (e) {}
  setTimeout(() => RO.G.layout(), 260);
};

/* ════════════ BOTONES DEL HUD ════════════ */
UI.initHud = () => {
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act;
    if (a === 'notes') UI.notesInbox();
    else if (a === 'avatar') UI.avatarEditor();
    else if (a === 'shop') UI.shop();
    else if (a === 'ranking') UI.ranking();
    else if (a === 'admin') RO.Admin.open();
    else if (a === 'sound') { RO.setMuted(!RO.muted); UI.renderTop(); if (!RO.muted) RO.sfx.blip(); }
    else if (a === 'help') UI.help();
    else if (a === 'zin') RO.G.zoom(1);
    else if (a === 'zout') RO.G.zoom(-1);
    else if (a === 'panel') UI.togglePanel();
    else if (a === 'myoffice') UI.myOffice();
    else if (a === 'voice') { Promise.resolve(RO.Voice.toggle()).then(on => { $('#tb-voice').classList.toggle('on', !!on); if (on) UI.toast('🎙️ Voz activada: te escuchan los que estén cerca de ti (y tú a ellos)'); }); }
    else if (a === 'garage') RO.G.goVip('garage');
    else if (a === 'club') RO.G.goVip('club');
    else if (a === 'logout') RO.emit('logout');
    else if (a === 'emergency') UI.emergency();
    else if (a === 'boost') UI.boost();
    else if (a === 'summon') UI.summon();
    b.blur();
  });
  UI.initStatus(); UI.initChat(); UI.minimap();
  try { if (localStorage.getItem('ro_panel') === '0') UI.togglePanel(true); } catch (e) {}

  UI.renderTop(); UI.renderPeople(); UI.renderFeed(); renderClocks();
  setInterval(() => { UI.renderPeople(); UI.renderFeed(); }, 20000);
};
})();
