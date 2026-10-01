'use strict';
/* ════════════════════════════════════════════════════════════════
   RUEDDA OFFICE — kartódromo multijugador.
   · Pits (E) → unirse. Con 2+ pilotos: "¿Listo para correr?".
     Cuando todos están listos, el host (uid menor) da la largada:
     5 luces rojas → verde → ¡YA!  ·  5 vueltas.
   · Física arcade local (acelerar, frenar, girar, pasto frena,
     barreras rebotan); cada piloto transmite su kart ~12 veces/s.
   · Vueltas por distancia recorrida sobre la línea central, con
     control de media vuelta (no se puede cortar ni ir al revés).
   ════════════════════════════════════════════════════════════════ */
(function(){
const RO = window.RO, A = RO.Art;
const Kt = RO.Kart = { state: 'idle', joined: new Map(), racers: new Map(), results: [], grid: [] };
const me = () => RO.S.me.user_id;
const K = () => RO.World.KART;
const COLORS = ['#e6f03b', '#d7262e', '#2c5bd6', '#3ddc84', '#f08a24', '#a855f7', '#22d3ee', '#ff3d8b'];
const colorOf = uid => COLORS[A.hash(uid) % COLORS.length];
const fmt = ms => { if (ms == null) return '—'; const m = Math.floor(ms / 60000), s = (ms % 60000) / 1000; return m + ':' + s.toFixed(1).padStart(4, '0'); };
const send = (t, extra) => RO.Net.send(Object.assign({ t, u: me() }, extra || {}));
const UI = () => RO.UI;

/* ── textura del kart visto desde arriba (mira a la derecha) ── */
function kartTex(scene, color) {
  const key = 'kart_top_' + color.replace('#', '');
  if (!scene.textures.exists(key)) {
    const k = A.mk(22, 14);
    k.r(2, 0, 5, 3, '#111215').r(14, 0, 5, 3, '#111215').r(2, 11, 5, 3, '#111215').r(14, 11, 5, 3, '#111215');
    k.rr(1, 3, 20, 8, color, 2).r(3, 4, 16, 1, A.shade(color, .3)).r(19, 4, 2, 6, '#16171b').r(0, 5, 2, 4, '#2a2d33');
    k.ell(9, 7, 3, 3, '#f4f4f2').ell(9, 7, 2, 2, A.shade(color, -.3)).r(11, 6, 1, 2, '#9fd3ff');
    A.outline(k, '#0b0b0d');
    scene.textures.addCanvas(key, k.c);
  }
  return key;
}

/* ════════════ LOBBY ════════════ */
Kt.host = () => Array.from(Kt.joined.keys()).sort()[0];
Kt.join = () => {
  if (Kt.state === 'race' || Kt.state === 'countdown') return UI().toast('Hay una carrera en curso. Espera a que termine.', 'err');
  Kt.state = 'lobby'; Kt.joined.set(me(), { ready: false, t: Date.now() });
  send('kjoin'); Kt.renderLobby(); RO.sfx.engine();
};
Kt.leave = () => {
  if (Kt.state === 'idle') return;
  const racing = Kt.state === 'race' || Kt.state === 'countdown';
  Kt.joined.delete(me()); send('kleave');
  if (racing) Kt.endDriving();
  Kt.state = 'idle'; Kt.renderLobby(); Kt.hud(false);
};
Kt.ready = () => { const j = Kt.joined.get(me()); if (!j) return; j.ready = true; send('kstate', { ready: true }); Kt.renderLobby(); Kt.tryStart(); };
Kt.tryStart = () => {
  if (Kt.state !== 'lobby' || Kt.host() !== me()) return;
  const all = Array.from(Kt.joined.entries());
  if (all.length >= 2 && all.every(([, j]) => j.ready)) {
    const grid = all.sort((a, b) => a[1].t - b[1].t).map(([u]) => u);
    const msg = { grid, laps: K().laps, delay: 600 + Math.floor(Math.random() * 900) };
    send('kgo', msg); Kt.start(msg);
  }
};
Kt.renderLobby = () => {
  let el = document.getElementById('kart-lobby');
  if (Kt.state !== 'lobby') { if (el) el.remove(); return; }
  if (!el) { el = document.createElement('div'); el.id = 'kart-lobby'; el.className = 'glass'; document.getElementById('app').appendChild(el); }
  const list = Array.from(Kt.joined.entries()), n = list.length, mine = Kt.joined.get(me());
  el.innerHTML = `<div class="kl-h">🏁 KARTÓDROMO · ${K().laps} VUELTAS</div>
    <div class="kl-l">${list.map(([u, j]) => `<div><i style="background:${colorOf(u)}"></i>${RO.esc(RO.nameOf(u))}<span>${j.ready ? '✅ listo' : '…'}</span></div>`).join('')}</div>
    ${n >= 2 ? `<div class="kl-big">${list.every(([, j]) => j.ready) ? 'ARRANCANDO…' : '¿LISTO PARA CORRER?'}</div>` : '<div class="kl-sub">Esperando otro piloto (mínimo 2)…</div>'}
    <div class="kl-b">${n >= 2 && mine && !mine.ready ? '<button class="btn y" data-k="ready">¡Listo para correr!</button>' : ''}<button class="btn" data-k="leave">Salir</button></div>`;
  el.querySelector('[data-k="leave"]').onclick = Kt.leave;
  const r = el.querySelector('[data-k="ready"]'); if (r) r.onclick = Kt.ready;
};

/* ════════════ LARGADA ════════════ */
Kt.start = msg => {
  const mine = msg.grid.includes(me());
  Kt.grid = msg.grid; Kt.results = []; Kt.racers.clear(); Kt.laps = msg.laps || K().laps;
  Kt.state = mine ? 'countdown' : 'spectate';
  Kt.renderLobby();
  if (!mine) { UI().banner('Carrera en curso', msg.grid.map(RO.nameOf).join(' vs '), '', 3000); return; }
  // al box: cada uno a su casilla de la grilla
  const s = RO.G.scene, kk = K(), sx = kk.start[0] * 16, sy = kk.start[1] * 16, i = msg.grid.indexOf(me());
  const car = { x: sx - 26 - Math.floor(i / 2) * 26, y: sy + (i % 2 ? 9 : -9), a: 0, v: 0, lap: 0, half: false, prev: null, t0: 0, lapT0: 0, best: null, done: false };
  Kt.car = car;
  if (s.me.sit) s.stand();
  s.me.spr.setVisible(false);
  Kt.spr = s.add.image(car.x, car.y, kartTex(s, colorOf(me()))).setDepth(car.y).setRotation(car.a);
  s.cameras.main.startFollow(Kt.spr, true, 0.18, 0.18);
  Kt.lights(msg.delay);
};
Kt.lights = delay => {
  let el = document.getElementById('kart-lights'); if (el) el.remove();
  el = document.createElement('div'); el.id = 'kart-lights';
  el.innerHTML = '<div class="kli">' + '<i></i>'.repeat(5) + '</div><div class="klt">LISTOS…</div>';
  document.getElementById('app').appendChild(el);
  const L = el.querySelectorAll('i'), txt = el.querySelector('.klt');
  for (let i = 0; i < 5; i++) setTimeout(() => { L[i].className = 'r'; RO.sfx.blip(); }, 700 * (i + 1));
  setTimeout(() => {
    L.forEach(x => x.className = 'g'); txt.textContent = '¡YA!'; RO.sfx.boost();
    Kt.state = 'race'; Kt.car.t0 = Kt.car.lapT0 = performance.now(); Kt.hud(true);
    setTimeout(() => el.remove(), 1400);
  }, 700 * 5 + 400 + delay);
};

/* ════════════ FÍSICA (cada cuadro) ════════════ */
let lastSend = 0;
Kt.tick = (scene, time, dt) => {
  // karts de los demás (interpolados)
  Kt.racers.forEach(r => {
    if (!r.spr) return;
    r.x += (r.tx - r.x) * Math.min(1, dt * 0.012); r.y += (r.ty - r.y) * Math.min(1, dt * 0.012);
    let da = r.ta - r.a; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; r.a += da * Math.min(1, dt * 0.012);
    r.spr.setPosition(r.x, r.y).setRotation(r.a).setDepth(r.y);
    const p = scene.players.get(r.uid); if (p) { p.x = p.tx = r.x; p.y = p.ty = r.y; p.spr.setVisible(false); }
  });
  if (Kt.state !== 'race' && Kt.state !== 'countdown') return false;
  const c = Kt.car; if (!c) return false;
  const s = dt / 1000, kk = K();
  let thr = 0, steer = 0;
  if (Kt.state === 'race' && !c.done && !RO.uiBusy()) {
    const k = RO.G.key;
    if (k('arrowup') || k('w')) thr += 1;
    if (k('arrowdown') || k('s')) thr -= 1;
    if (k('arrowleft') || k('a')) steer -= 1;
    if (k('arrowright') || k('d')) steer += 1;
    const st = scene.stick;
    if (st && (st.x || st.y)) {   // celular: el kart apunta hacia donde va el joystick
      let da = Math.atan2(st.y, st.x) - c.a; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
      steer = Math.max(-1, Math.min(1, da * 2.2)); thr = 1;
    }
  }
  const n = kk.near(c.x, c.y), grass = n.d > kk.HW;
  const maxV = grass ? 95 : 235, acc = thr > 0 ? 260 : thr < 0 ? (c.v > 0 ? 420 : 160) : 0;
  c.v += thr * acc * s;
  c.v *= 1 - (thr ? (grass ? 2.4 : 0.35) : (grass ? 3 : 1.2)) * s;
  c.v = Math.max(-80, Math.min(maxV, c.v));
  const grip = Math.min(1, Math.abs(c.v) / 70);
  c.a += steer * 3.1 * s * grip * Math.sign(c.v || 1);
  c.x += Math.cos(c.a) * c.v * s; c.y += Math.sin(c.a) * c.v * s;
  // barrera: no se sale más allá del pasto
  const n2 = kk.near(c.x, c.y), lim = kk.HW + 34;
  if (n2.d > lim) { const f = lim / n2.d; c.x = n2.px + (c.x - n2.px) * f; c.y = n2.py + (c.y - n2.py) * f; if (Math.abs(c.v) > 60) { scene.cameras.main.shake(120, 0.004); RO.sfx.hi5(); } c.v *= -0.25; }
  // choques con otros karts
  Kt.racers.forEach(r => { const dx = c.x - r.x, dy = c.y - r.y, d = Math.hypot(dx, dy); if (d > 0 && d < 15) { c.x += dx / d * (15 - d); c.y += dy / d * (15 - d); c.v *= 0.8; } });
  // vueltas
  const L = kk.L, rel = (n2.s - kk.s0 + L) % L;
  if (c.prev != null) {
    if (rel > L * 0.4 && rel < L * 0.6) c.half = true;
    if (c.prev > L * 0.75 && rel < L * 0.25) {
      if (c.half && Kt.state === 'race') {
        c.lap++; c.half = false; const now = performance.now(), lt = now - c.lapT0; c.lapT0 = now;
        if (!c.best || lt < c.best) c.best = lt;
        RO.Net.recordLap(Math.round(lt)).then(r => {
          if (!r) return; Kt.setTop(r.top);
          if (r.record) { UI().banner('¡NUEVO RÉCORD!', fmt(lt) + ' · ' + RO.nameOf(me()), '', 3200); RO.sfx.gong(); send('krec', { top: r.top }); }
        }).catch(() => {});
        if (c.lap >= Kt.laps) Kt.finish(); else { RO.sfx.coin(); UI().banner(c.lap === Kt.laps - 1 ? '¡ÚLTIMA VUELTA!' : 'VUELTA ' + (c.lap + 1) + '/' + Kt.laps, 'vuelta ' + fmt(lt), '', 1400); }
      }
    } else if (c.prev < L * 0.25 && rel > L * 0.75) c.half = false;   // en reversa por la meta
  }
  c.prev = rel;
  c.prog = c.lap * L + (rel > L * 0.75 && !c.half ? rel - L : rel);
  // dibujo, cámara, red
  Kt.spr.setPosition(c.x, c.y).setRotation(c.a).setDepth(c.y);
  scene.me.x = c.x; scene.me.y = c.y;
  if (time - lastSend > 80) { lastSend = time; send('kp', { x: Math.round(c.x), y: Math.round(c.y), a: Math.round(c.a * 100) / 100, p: Math.round(c.prog), lap: c.lap }); }
  Kt.hudTick();
  return true;
};

Kt.finish = () => {
  const c = Kt.car; if (c.done) return; c.done = true;
  const ms = Math.round(performance.now() - c.t0);
  send('kfin', { ms, best: c.best ? Math.round(c.best) : null });
  Kt.onFinish({ u: me(), ms, best: c.best });
  RO.sfx.gong(); RO.G.fxConfetti();
};
Kt.onFinish = m => {
  if (Kt.results.find(r => r.u === m.u)) return;
  Kt.results.push({ u: m.u, ms: m.ms, best: m.best });
  const pos = Kt.results.length;
  if (m.u === me()) {
    UI().banner(pos === 1 ? '¡GANASTE! 🏆' : 'TERMINASTE ' + pos + '°', 'tiempo ' + fmt(m.ms), pos === 1 ? '' : 'pink', 3500);
    RO.Net.award(pos === 1 ? 'race_win' : 'race').then(r => { if (r && r.ok) UI().toast('🏁 +' + r.amount + ' monedas y puntos por la carrera'); }).catch(() => {});
  } else UI().toast('🏁 ' + RO.esc(RO.nameOf(m.u)) + ' terminó ' + pos + '° · ' + fmt(m.ms));
  if (pos === 1) setTimeout(() => Kt.closeRace(), 45000);   // 45 s para que lleguen los demás
  if (Kt.grid.length && Kt.grid.every(u => Kt.results.find(r => r.u === u) || !RO.S.online.has(u) && u !== me())) setTimeout(() => Kt.closeRace(), 1500);
};
Kt.closeRace = () => {
  if (Kt.state === 'idle') return;
  const wasRacer = Kt.grid.includes(me());
  if (wasRacer) { Kt.podium(); Kt.endDriving(); }
  Kt.state = 'idle'; Kt.joined.clear(); Kt.grid = []; Kt.hud(false);
  Kt.racers.forEach(r => { if (r.spr) r.spr.destroy(); const p = RO.G.scene.players.get(r.uid); if (p) p.spr.setVisible(true); });
  Kt.racers.clear(); Kt.renderLobby();
};
Kt.endDriving = () => {
  const s = RO.G.scene; if (!s) return;
  if (Kt.spr) { Kt.spr.destroy(); Kt.spr = null; }
  s.me.x = 11.5 * 16; s.me.y = 74.2 * 16; s.me.spr.setPosition(s.me.x, s.me.y).setVisible(true);
  s.cameras.main.startFollow(s.me.spr, true, 0.14, 0.14); s.sendPos(0);
  Kt.car = null;
};
Kt.podium = () => {
  const rows = Kt.grid.map(u => Kt.results.find(r => r.u === u) || { u, ms: null }).sort((a, b) => (a.ms == null) - (b.ms == null) || a.ms - b.ms);
  UI().modal({ title: '🏆 Resultados', sub: Kt.laps + ' vueltas · Kartódromo Ruedda',
    body: rows.map((r, i) => `<div class="rank"><span class="n">${r.ms == null ? '—' : i + 1}</span><b><i style="display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:8px;background:${colorOf(r.u)}"></i>${RO.esc(RO.nameOf(r.u))}</b><span class="p">${r.ms == null ? 'no terminó' : fmt(r.ms)}${r.best ? ' · mejor vuelta ' + fmt(r.best) : ''}</span></div>`).join(''),
    foot: '<button class="btn y" onclick="RO.UI.close(); RO.Kart.join()">Otra carrera</button>' });
};

/* ════════════ RÉCORD GLOBAL (tablero en la pista) ════════════ */
Kt.top = [];
Kt.setTop = top => { Kt.top = Array.isArray(top) ? top : []; Kt.drawBoard(); };
Kt.loadTop = () => RO.Net.topLaps().then(Kt.setTop).catch(() => {});
Kt.drawBoard = () => {
  const s = RO.G.scene; if (!s) return;
  if (Kt.boardObjs) Kt.boardObjs.forEach(o => o.destroy());
  const x = 13 * 16, y = 80.6 * 16, w = 150, h = 74, o = [];
  o.push(s.add.rectangle(x, y, w, h, 0x0b0b0d, 0.92).setOrigin(0).setStrokeStyle(2, 0xe6f03b).setDepth(-4e5));
  const tx = (t, yy, size, color) => s.add.text(x + w / 2, y + yy, t, { fontFamily: 'Silkscreen, monospace', fontSize: size + 'px', color }).setOrigin(0.5, 0).setResolution(4).setDepth(-4e5 + 1);
  o.push(tx('RÉCORD DE VUELTA', 5, 8, '#e6f03b'));
  const t0 = Kt.top[0];
  o.push(tx(t0 ? fmt(t0.ms) : '—:—.—', 17, 16, '#ffffff'));
  o.push(tx(t0 ? String(t0.name).toUpperCase() : 'SIN TIEMPOS AÚN', 37, 8, '#ff9ec7'));
  Kt.top.slice(1, 3).forEach((r, i) => o.push(tx((i + 2) + '. ' + String(r.name).toUpperCase().slice(0, 10) + '  ' + fmt(r.ms), 50 + i * 10, 7, '#9aa0a6')));
  Kt.boardObjs = o;
};
RO.on('game:ready', () => setTimeout(Kt.loadTop, 500));

/* ════════════ HUD ════════════ */
Kt.hud = on => {
  let el = document.getElementById('kart-hud');
  if (!on) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement('div'); el.id = 'kart-hud'; el.className = 'glass'; document.getElementById('app').appendChild(el); }
};
Kt.hudTick = () => {
  const el = document.getElementById('kart-hud'); if (!el || !Kt.car) return;
  const c = Kt.car, all = [{ u: me(), p: c.prog, done: c.done }].concat(Array.from(Kt.racers.values()).map(r => ({ u: r.uid, p: r.p || 0, done: !!Kt.results.find(x => x.u === r.uid) })));
  const fin = Kt.results.map(r => r.u), live = all.filter(x => !fin.includes(x.u)).sort((a, b) => b.p - a.p).map(x => x.u);
  const order = fin.concat(live), pos = order.indexOf(me()) + 1;
  const t = c.t0 ? performance.now() - c.t0 : 0;
  el.innerHTML = `<div><span>VUELTA</span><b>${Math.min(c.lap + 1, Kt.laps)}/${Kt.laps}</b></div><div><span>POS</span><b>${pos}/${order.length}</b></div><div><span>TIEMPO</span><b>${fmt(t)}</b></div><div><span>MEJOR</span><b>${fmt(c.best)}</b></div><div><span>RÉCORD</span><b>${Kt.top[0] ? fmt(Kt.top[0].ms) : '—'}</b></div><div class="kh-s">${Math.round(Math.abs(c.v) * 0.42)} km/h</div>`;
};

/* ════════════ RED ════════════ */
Kt.onMsg = m => {
  const s = RO.G.scene; if (!s) return;
  if (m.t === 'kjoin') { if (Kt.state === 'lobby' || Kt.state === 'idle' && false) {} if (Kt.state === 'lobby') { Kt.joined.set(m.u, { ready: false, t: Date.now() }); send('kstate', { ready: !!(Kt.joined.get(me()) || {}).ready, t: (Kt.joined.get(me()) || {}).t }); Kt.renderLobby(); } else if (Kt.state === 'idle') UI().toast('🏁 ' + RO.esc(RO.nameOf(m.u)) + ' quiere correr en el kartódromo', '', [{ t: 'Unirme', y: 1, f: () => { RO.G.goToSpot(11, 74); Kt.join(); } }]); return; }
  if (m.t === 'kstate') { if (Kt.state === 'lobby') { const j = Kt.joined.get(m.u) || { t: m.t0 || Date.now() }; j.ready = !!m.ready; Kt.joined.set(m.u, j); Kt.renderLobby(); Kt.tryStart(); } return; }
  if (m.t === 'kleave') { Kt.joined.delete(m.u); const r = Kt.racers.get(m.u); if (r) { if (r.spr) r.spr.destroy(); Kt.racers.delete(m.u); const p = s.players.get(m.u); if (p) p.spr.setVisible(true); } Kt.renderLobby(); return; }
  if (m.t === 'kgo') { Kt.start(m); return; }
  if (m.t === 'kp') {
    let r = Kt.racers.get(m.u);
    if (!r) { r = { uid: m.u, x: m.x, y: m.y, a: m.a, tx: m.x, ty: m.y, ta: m.a }; r.spr = s.add.image(m.x, m.y, kartTex(s, colorOf(m.u))).setRotation(m.a); Kt.racers.set(m.u, r); }
    r.tx = m.x; r.ty = m.y; r.ta = m.a; r.p = m.p; r.lap = m.lap; return;
  }
  if (m.t === 'kfin') { Kt.onFinish(m); return; }
  if (m.t === 'krec') { Kt.setTop(m.top); UI().toast('🏁 Nuevo récord de vuelta: <b>' + RO.esc(RO.nameOf(m.u)) + '</b> · ' + fmt(m.top && m.top[0] && m.top[0].ms)); return; }
};
})();
