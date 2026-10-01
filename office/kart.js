'use strict';
/* ════════════════════════════════════════════════════════════════
   RUEDDA OFFICE — kartódromo multijugador.
   · 5 karts estacionados en pits: E para subirte y practicar (las
     vueltas cuentan para el récord global).
   · Pits (E) → carrera. Con 2+ pilotos: "¿Listo para correr?". Cuando
     todos están listos, el host (uid menor) da la largada:
     5 luces rojas → verde → ¡YA!  ·  5 vueltas.
   · Física arcade local con mejoras de la tienda (velocidad, agarre,
     frenos, nitro). Cada piloto transmite su kart ~12 veces/s.
   · Sonido de motor sintetizado que sigue la velocidad.
   ════════════════════════════════════════════════════════════════ */
(function(){
const RO = window.RO, A = RO.Art;
const Kt = RO.Kart = { state: 'idle', joined: new Map(), racers: new Map(), results: [], grid: [], top: [], garage: [], items: [] };
const me = () => RO.S.me.user_id;
const K = () => RO.World.KART;
const COLORS = ['#e6f03b', '#d7262e', '#2c5bd6', '#3ddc84', '#f08a24', '#a855f7', '#22d3ee', '#ff3d8b'];
const colorOf = uid => COLORS[A.hash(uid) % COLORS.length];
const fmt = ms => { if (ms == null) return '—'; const m = Math.floor(ms / 60000), s = (ms % 60000) / 1000; return m + ':' + s.toFixed(1).padStart(4, '0'); };
const send = (t, extra) => RO.Net.send(Object.assign({ t, u: me() }, extra || {}));
const UI = () => RO.UI;
const T = 16;

/* ════════════ MODELOS (vista superior, miran a la derecha) ════════════ */
const MODELS = {
  basico:  { body: null,      accent: '#16171b', helmet: '#f4f4f2', wing: false, name: 'Básico' },
  rayo:    { body: '#e6f03b', accent: '#16171b', helmet: '#16171b', wing: false, stripe: '#16171b', name: 'Rayo GT' },
  diablo:  { body: '#d7262e', accent: '#16171b', helmet: '#f2c230', wing: true, stripe: '#f4f4f2', name: 'Diablo R' },
  phantom: { body: '#16171b', accent: '#a855f7', helmet: '#a855f7', wing: true, stripe: '#a855f7', name: 'Phantom X' },
  gold:    { body: '#f2c230', accent: '#fff1a0', helmet: '#f4f4f2', wing: true, stripe: '#16171b', name: 'Ruedda Gold' }
};
function kartTex(scene, model, color) {
  const M = MODELS[model] || MODELS.basico, body = M.body || color || '#2c5bd6';
  const key = 'kart2_' + (MODELS[model] ? model : 'basico') + '_' + body.replace('#', '');
  if (scene.textures.exists(key)) return key;
  const k = A.mk(26, 18), d = A.shade(body, -.28), l = A.shade(body, .3);
  [[3, 0], [16, 0], [3, 13], [16, 13]].forEach(([x, y]) => k.rr(x, y, 7, 5, '#111215', 1).r(x + 1, y + (y ? 3 : 1), 5, 1, '#3a3f48'));
  if (M.wing) k.r(0, 2, 3, 14, M.accent).r(1, 3, 1, 12, A.shade(M.accent, .3));
  k.r(2, 6, 2, 6, '#5b6573');                                                 // paragolpes trasero
  k.rr(3, 5, 19, 8, body, 2).r(4, 5, 17, 1, l).r(4, 12, 17, 1, d);             // chasis
  k.r(6, 3, 12, 2, body).r(6, 13, 12, 2, body).r(6, 3, 12, 1, l);             // pontones
  k.r(21, 6, 3, 6, body).r(24, 7, 2, 4, d).r(22, 6, 2, 1, l);                 // trompa
  if (M.stripe) k.r(4, 8, 20, 2, M.stripe);
  k.rr(8, 6, 7, 6, '#16171b', 1);                                             // asiento
  k.ell(11, 9, 3, 3, M.helmet).r(13, 8, 2, 2, '#22d3ee').p(10, 7, A.shade(M.helmet, .4));   // casco y visera
  k.r(16, 8, 1, 2, '#2a2d33');                                                // volante
  k.r(19, 8, 2, 2, '#f4f4f2');                                                // número
  A.outline(k, '#0b0b0d');
  scene.textures.addCanvas(key, k.c);
  return key;
}
Kt.MODELS = MODELS;

/* ════════════ TIENDA: estadísticas de mi kart ════════════ */
Kt.loadShop = async () => { try { const r = await RO.Net.kartShop(); Kt.items = r.items || []; Kt.garage = r.garage || []; } catch (e) {} };
Kt.stats = () => {
  const own = Kt.items.filter(i => Kt.garage.includes(i.item));
  const karts = own.filter(i => i.kind === 'kart').sort((a, b) => (b.stats.speed || 0) - (a.stats.speed || 0));
  const best = karts[0], parts = own.filter(i => i.kind === 'part');
  const st = { speed: best ? best.stats.speed || 0 : 0, grip: best ? best.stats.grip || 0 : 0, brake: 0, nitro: false, model: best ? best.stats.model : 'basico' };
  parts.forEach(p => { st.speed += p.stats.speed || 0; st.grip += p.stats.grip || 0; st.brake += p.stats.brake || 0; if (p.stats.nitro) st.nitro = true; });
  return st;
};
RO.on('game:ready', () => Kt.loadShop());

/* ════════════ MOTOR (sonido) ════════════ */
const ENG = { ac: null };
Kt.engine = on => {
  try {
    if (on && !RO.muted) {
      if (ENG.osc) return;
      ENG.ac = ENG.ac || new (window.AudioContext || window.webkitAudioContext)(); if (ENG.ac.state === 'suspended') ENG.ac.resume();
      const ac = ENG.ac, o1 = ac.createOscillator(), o2 = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
      o1.type = 'sawtooth'; o2.type = 'square'; o2.detune.value = 18; f.type = 'lowpass'; f.frequency.value = 520; g.gain.value = 0.0001;
      o1.connect(f); o2.connect(f); f.connect(g).connect(ac.destination); o1.start(); o2.start();
      Object.assign(ENG, { osc: o1, osc2: o2, f, g });
      g.gain.exponentialRampToValueAtTime(0.05, ac.currentTime + 0.3);
    } else if (!on && ENG.osc) {
      const { osc, osc2, g, ac } = ENG; g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.25);
      setTimeout(() => { try { osc.stop(); osc2.stop(); } catch (e) {} }, 300); ENG.osc = null;
    }
  } catch (e) {}
};
Kt.engineRev = (v, boost) => {
  if (!ENG.osc) return; const t = ENG.ac.currentTime, hz = 42 + Math.abs(v) * 0.55 + (boost ? 40 : 0);
  ENG.osc.frequency.setTargetAtTime(hz, t, 0.05); ENG.osc2.frequency.setTargetAtTime(hz * 0.5, t, 0.05); ENG.f.frequency.setTargetAtTime(380 + Math.abs(v) * 4, t, 0.08);
};

/* ════════════ KARTS ESTACIONADOS (para subirse) ════════════ */
const PARKED = ['rayo', 'diablo', 'basico', 'phantom', 'gold'];
Kt.parked = [];
Kt.drawParked = () => {
  const s = RO.G.scene; if (!s) return;
  Kt.parked.forEach(p => p.spr && p.spr.destroy());
  Kt.parked = K().parked.map(([x, y], i) => {
    const spr = s.add.image(x * T, y * T, kartTex(s, PARKED[i], '#2c5bd6')).setRotation(Math.PI / 2).setDepth(y * T + 8);
    return { i, x: x * T, y: y * T, model: PARKED[i], spr, by: null };
  });
};
RO.on('game:ready', () => setTimeout(Kt.drawParked, 300));
Kt.nearParked = (x, y) => { let best = null, bd = 22; Kt.parked.forEach(p => { const d = Math.hypot(x - p.x, y - (p.y + 6)); if (!p.by && d < bd) { bd = d; best = p; } }); return best; };

/* ════════════ PRÁCTICA LIBRE ════════════ */
Kt.ride = i => {
  if (Kt.state !== 'idle') return;
  const p = Kt.parked[i]; if (!p || p.by) return;
  p.by = me(); p.spr.setVisible(false); send('kride', { i, on: 1 });
  Kt.state = 'free'; Kt.freeIdx = i;
  Kt.beginDriving({ x: p.x, y: p.y, a: Math.PI / 2 }, p.model);
  Kt.car.t0 = Kt.car.lapT0 = performance.now(); Kt.hud(true);
  UI().toast('🏎️ ' + MODELS[p.model].name + ' · práctica libre (E o Esc para bajarte)');
};
Kt.unride = () => {
  if (Kt.state !== 'free') return;
  const p = Kt.parked[Kt.freeIdx]; if (p) { p.by = null; p.spr.setVisible(true); }
  send('kride', { i: Kt.freeIdx, on: 0 });
  Kt.state = 'idle'; Kt.endDriving(p ? { x: p.x + 12, y: p.y - 4 } : null); Kt.hud(false);
};

/* ════════════ LOBBY DE CARRERA ════════════ */
Kt.host = () => Array.from(Kt.joined.keys()).sort()[0];
Kt.join = () => {
  if (Kt.state === 'free') Kt.unride();
  if (Kt.state === 'race' || Kt.state === 'countdown') return UI().toast('Hay una carrera en curso. Espera a que termine.', 'err');
  Kt.state = 'lobby'; Kt.joined.set(me(), { ready: false, t: Date.now() });
  send('kjoin'); Kt.renderLobby(); RO.sfx.engine();
};
Kt.leave = () => {
  if (Kt.state === 'idle') return;
  if (Kt.state === 'free') return Kt.unride();
  const racing = Kt.state === 'race' || Kt.state === 'countdown';
  Kt.joined.delete(me()); send('kleave');
  if (racing) Kt.endDriving();
  Kt.state = 'idle'; Kt.renderLobby(); Kt.hud(false);
};
Kt.ready = () => { const j = Kt.joined.get(me()); if (!j) return; j.ready = true; send('kstate', { ready: true, t0: j.t }); Kt.renderLobby(); Kt.tryStart(); };
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
  if (mine && Kt.state === 'free') Kt.unride();
  Kt.grid = msg.grid; Kt.results = []; Kt.laps = msg.laps || K().laps;
  Kt.state = mine ? 'countdown' : 'spectate';
  Kt.renderLobby();
  if (!mine) { UI().banner('Carrera en curso', msg.grid.map(RO.nameOf).join(' vs '), '', 3000); return; }
  const kk = K(), sx = kk.start[0] * T, sy = kk.start[1] * T, i = msg.grid.indexOf(me());
  Kt.beginDriving({ x: sx - 26 - Math.floor(i / 2) * 26, y: sy + (i % 2 ? 9 : -9), a: 0 }, Kt.stats().model);
  Kt.lights(msg.delay);
};
Kt.beginDriving = (pos, model) => {
  const s = RO.G.scene;
  Kt.car = { x: pos.x, y: pos.y, a: pos.a || 0, v: 0, lap: 0, half: false, prev: null, t0: 0, lapT0: 0, best: null, done: false, nitroT: 0, nitroCd: 0 };
  Kt.st = Kt.stats(); Kt.model = model || Kt.st.model;
  if (s.me.sit) s.stand();
  if (s.me.scoot != null) s.scootOff();
  s.me.spr.setVisible(false);
  if (Kt.spr) Kt.spr.destroy();
  Kt.spr = s.add.image(Kt.car.x, Kt.car.y, kartTex(s, Kt.model, colorOf(me()))).setDepth(Kt.car.y).setRotation(Kt.car.a);
  s.cameras.main.startFollow(Kt.spr, true, 0.18, 0.18);
  Kt.engine(true);
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
  Kt.racers.forEach(r => {
    if (!r.spr) return;
    r.x += (r.tx - r.x) * Math.min(1, dt * 0.012); r.y += (r.ty - r.y) * Math.min(1, dt * 0.012);
    let da = r.ta - r.a; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; r.a += da * Math.min(1, dt * 0.012);
    r.spr.setPosition(r.x, r.y).setRotation(r.a).setDepth(r.y);
    const p = scene.players.get(r.uid); if (p) { p.x = p.tx = r.x; p.y = p.ty = r.y; p.spr.setVisible(false); }
  });
  if (!['race', 'countdown', 'free'].includes(Kt.state)) return false;
  const c = Kt.car; if (!c) return false;
  const s = dt / 1000, kk = K(), st = Kt.st || { speed: 0, grip: 0, brake: 0 };
  let thr = 0, steer = 0, nitroKey = false;
  const canDrive = (Kt.state === 'race' || Kt.state === 'free') && !c.done && !RO.uiBusy();
  if (canDrive) {
    const k = RO.G.key;
    if (k('arrowup') || k('w')) thr += 1;
    if (k('arrowdown') || k('s')) thr -= 1;
    if (k('arrowleft') || k('a')) steer -= 1;
    if (k('arrowright') || k('d')) steer += 1;
    nitroKey = k('shift') || k('n');
    const sk = scene.stick;
    if (sk && (sk.x || sk.y)) { let da = Math.atan2(sk.y, sk.x) - c.a; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; steer = Math.max(-1, Math.min(1, da * 2.2)); thr = 1; nitroKey = sk.run; }
  }
  // nitro (si lo compraste): 2 s de +35 %, recarga 12 s
  const now = performance.now();
  if (st.nitro && nitroKey && c.nitroCd < now) { c.nitroT = now + 2000; c.nitroCd = now + 12000; RO.sfx.boost(); }
  const boost = c.nitroT > now;
  const n = kk.near(c.x, c.y), grass = n.d > kk.HW;
  // el pasto frena MUCHO: tope 45 y arrastre fuerte (sale caro salirse de la pista)
  const maxV = (grass ? 45 : 235) * (1 + st.speed) * (boost ? 1.35 : 1), acc = (thr > 0 ? 260 * (1 + st.speed) * (boost ? 1.6 : 1) : thr < 0 ? (c.v > 0 ? 420 * (1 + st.brake) : 160) : 0) * (grass ? 0.35 : 1);
  c.v += thr * acc * s;
  c.v *= Math.max(0, 1 - (thr ? (grass ? 5.5 : 0.35) : (grass ? 7 : 1.2)) * s);
  if (grass && c.v > maxV) c.v += (maxV - c.v) * Math.min(1, 6 * s);
  c.v = Math.max(-80, grass ? c.v : Math.min(maxV, c.v));
  const grip = Math.min(1, Math.abs(c.v) / 70);
  c.a += steer * 3.1 * (1 + st.grip) * s * grip * Math.sign(c.v || 1);
  c.x += Math.cos(c.a) * c.v * s; c.y += Math.sin(c.a) * c.v * s;
  const n2 = kk.near(c.x, c.y), lim = kk.HW + 34;
  if (n2.d > lim) { const f = lim / n2.d; c.x = n2.px + (c.x - n2.px) * f; c.y = n2.py + (c.y - n2.py) * f; if (Math.abs(c.v) > 60) { scene.cameras.main.shake(120, 0.004); RO.sfx.hi5(); } c.v *= -0.25; }
  Kt.racers.forEach(r => { const dx = c.x - r.x, dy = c.y - r.y, d = Math.hypot(dx, dy); if (d > 0 && d < 16) { c.x += dx / d * (16 - d); c.y += dy / d * (16 - d); c.v *= 0.8; } });
  // vueltas (práctica y carrera)
  const L = kk.L, rel = (n2.s - kk.s0 + L) % L;
  if (c.prev != null) {
    if (rel > L * 0.4 && rel < L * 0.6) c.half = true;
    if (c.prev > L * 0.75 && rel < L * 0.25) {
      if (c.half && (Kt.state === 'race' || Kt.state === 'free')) {
        c.lap++; c.half = false; const lt = now - c.lapT0; c.lapT0 = now;
        if (!c.best || lt < c.best) c.best = lt;
        RO.Net.recordLap(Math.round(lt)).then(r => {
          if (!r) return; Kt.setTop(r.top);
          if (r.record) { UI().banner('¡NUEVO RÉCORD!', fmt(lt) + ' · ' + RO.nameOf(me()), '', 3200); RO.sfx.gong(); send('krec', { top: r.top }); }
        }).catch(() => {});
        if (Kt.state === 'free') UI().banner('VUELTA ' + fmt(lt), c.best === lt ? 'tu mejor vuelta' : 'mejor ' + fmt(c.best), '', 1400);
        else if (c.lap >= Kt.laps) Kt.finish();
        else { RO.sfx.coin(); UI().banner(c.lap === Kt.laps - 1 ? '¡ÚLTIMA VUELTA!' : 'VUELTA ' + (c.lap + 1) + '/' + Kt.laps, 'vuelta ' + fmt(lt), '', 1400); }
      }
    } else if (c.prev < L * 0.25 && rel > L * 0.75) c.half = false;
  }
  c.prev = rel;
  c.prog = c.lap * L + (rel > L * 0.75 && !c.half ? rel - L : rel);
  Kt.spr.setPosition(c.x, c.y).setRotation(c.a).setDepth(c.y);
  if (boost && Math.random() < 0.5) { const fx = scene.add.rectangle(c.x - Math.cos(c.a) * 12, c.y - Math.sin(c.a) * 12, 3, 3, Math.random() < .5 ? 0x22d3ee : 0xffffff).setDepth(c.y - 1); scene.tweens.add({ targets: fx, alpha: 0, scale: 2, duration: 300, onComplete: () => fx.destroy() }); }
  scene.me.x = c.x; scene.me.y = c.y;
  Kt.engineRev(c.v, boost);
  if (time - lastSend > 80) { lastSend = time; send('kp', { x: Math.round(c.x), y: Math.round(c.y), a: Math.round(c.a * 100) / 100, p: Math.round(c.prog), lap: c.lap, m: Kt.model }); }
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
  if (pos === 1) setTimeout(() => Kt.closeRace(), 45000);
  if (Kt.grid.length && Kt.grid.every(u => Kt.results.find(r => r.u === u) || (!RO.S.online.has(u) && u !== me()))) setTimeout(() => Kt.closeRace(), 1500);
};
Kt.closeRace = () => {
  if (Kt.state === 'idle' || Kt.state === 'free') return;
  const wasRacer = Kt.grid.includes(me());
  if (wasRacer) { Kt.podium(); Kt.endDriving(); }
  Kt.state = 'idle'; Kt.joined.clear(); Kt.grid = []; Kt.hud(false);
  Kt.racers.forEach(r => { if (r.spr) r.spr.destroy(); const p = RO.G.scene.players.get(r.uid); if (p) p.spr.setVisible(true); });
  Kt.racers.clear(); Kt.renderLobby();
};
Kt.endDriving = at => {
  const s = RO.G.scene; if (!s) return;
  Kt.engine(false);
  if (Kt.spr) { Kt.spr.destroy(); Kt.spr = null; }
  s.me.x = at ? at.x : 11.5 * T; s.me.y = at ? at.y : 74.2 * T; s.me.spr.setPosition(s.me.x, s.me.y).setVisible(true);
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
Kt.setTop = top => { Kt.top = Array.isArray(top) ? top : []; Kt.drawBoard(); };
Kt.loadTop = () => RO.Net.topLaps().then(Kt.setTop).catch(() => {});
Kt.drawBoard = () => {
  const s = RO.G.scene; if (!s) return;
  if (Kt.boardObjs) Kt.boardObjs.forEach(o => o.destroy());
  const x = 18 * T, y = 128.5 * T, w = 130, h = 74, o = [];
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
  const c = Kt.car, now = performance.now(), t = c.t0 ? now - c.t0 : 0, st = Kt.st || {};
  const nitro = st.nitro ? `<div><span>NITRO</span><b style="color:${c.nitroCd < now ? '#22d3ee' : '#5b6573'}">${c.nitroCd < now ? 'SHIFT' : Math.ceil((c.nitroCd - now) / 1000) + 's'}</b></div>` : '';
  if (Kt.state === 'free') {
    el.innerHTML = `<div><span>PRÁCTICA</span><b>${MODELS[Kt.model] ? MODELS[Kt.model].name.toUpperCase() : 'KART'}</b></div><div><span>VUELTA</span><b>${fmt(now - c.lapT0)}</b></div><div><span>MEJOR</span><b>${fmt(c.best)}</b></div><div><span>RÉCORD</span><b>${Kt.top[0] ? fmt(Kt.top[0].ms) : '—'}</b></div>${nitro}<div class="kh-s">${Math.round(Math.abs(c.v) * 0.42)} km/h</div>`;
    return;
  }
  const all = [{ u: me(), p: c.prog, done: c.done }].concat(Array.from(Kt.racers.values()).filter(r => Kt.grid.includes(r.uid)).map(r => ({ u: r.uid, p: r.p || 0 })));
  const fin = Kt.results.map(r => r.u), live = all.filter(x => !fin.includes(x.u)).sort((a, b) => b.p - a.p).map(x => x.u);
  const order = fin.concat(live), pos = order.indexOf(me()) + 1;
  el.innerHTML = `<div><span>VUELTA</span><b>${Math.min(c.lap + 1, Kt.laps)}/${Kt.laps}</b></div><div><span>POS</span><b>${pos}/${order.length}</b></div><div><span>TIEMPO</span><b>${fmt(t)}</b></div><div><span>MEJOR</span><b>${fmt(c.best)}</b></div><div><span>RÉCORD</span><b>${Kt.top[0] ? fmt(Kt.top[0].ms) : '—'}</b></div>${nitro}<div class="kh-s">${Math.round(Math.abs(c.v) * 0.42)} km/h</div>`;
};

/* ════════════ TIENDA DE KARTS ════════════ */
Kt.shop = async () => {
  await Kt.loadShop();
  const coins = RO.S.me.coins || 0, st = Kt.stats();
  const card = i => { const own = Kt.garage.includes(i.item), can = coins >= i.price;
    const fx = [i.stats.speed ? '+' + Math.round(i.stats.speed * 100) + '% velocidad' : '', i.stats.grip ? '+' + Math.round(i.stats.grip * 100) + '% agarre' : '', i.stats.brake ? '+' + Math.round(i.stats.brake * 100) + '% frenado' : '', i.stats.nitro ? 'nitro (Shift)' : ''].filter(Boolean).join(' · ');
    return `<div class="si ${own || can ? '' : 'na'}"><span data-k="${RO.esc(i.item)}"></span><b>${RO.esc(i.name)}</b><span class="muted" style="font-size:11.5px">${fx}</span><span class="pr"><i class="coin"></i>${new Intl.NumberFormat('es-VE').format(i.price)}</span>${own ? '<span class="pill" style="font-size:11px;color:var(--green)">tuyo ✓</span>' : `<button class="btn sm ${can ? 'y' : ''}" data-buy="${RO.esc(i.item)}" ${can ? '' : 'disabled'}>Comprar</button>`}</div>`; };
  const mo = UI().modal({ title: '🏎️ Kart Shop', sub: `Tienes <b style="color:var(--y)">${coins}</b> monedas · tu kart: <b>${MODELS[st.model] ? MODELS[st.model].name : 'Básico'}</b> · +${Math.round(st.speed * 100)}% vel · +${Math.round(st.grip * 100)}% agarre${st.nitro ? ' · nitro' : ''}`, wide: true,
    body: Kt.items.length ? `<label class="lbl">karts</label><div class="shop">${Kt.items.filter(i => i.kind === 'kart').map(card).join('')}</div><label class="lbl">piezas</label><div class="shop">${Kt.items.filter(i => i.kind === 'part').map(card).join('')}</div>
      <p class="muted" style="margin-top:12px;font-size:12px">Las mejoras se suman y se usan en carreras y prácticas. Tu kart es el mejor que tengas.</p>` : '<div class="empty">La tienda abre cuando se corra el SQL de la oficina.</div>' });
  const s = RO.G.scene;
  mo.querySelectorAll('[data-k]').forEach(el => {
    const it = Kt.items.find(i => i.item === el.dataset.k); if (!it) return;
    const c = document.createElement('canvas'); c.width = 52; c.height = 36; c.style.cssText = 'image-rendering:pixelated;height:48px';
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    if (it.kind === 'kart') g.drawImage(s.textures.get(kartTex(s, it.stats.model, '#2c5bd6')).getSourceImage(), 0, 0, 26, 18, 0, 0, 52, 36);
    else { g.font = '28px serif'; g.textAlign = 'center'; g.fillText({ motor_s1: '⚙️', motor_s2: '🔩', llantas_slick: '🛞', aleron: '🪽', frenos: '🛑', nitro: '🧪' }[it.item] || '🔧', 26, 30); }
    el.appendChild(c);
  });
  mo.querySelectorAll('[data-buy]').forEach(b => b.onclick = async () => {
    b.disabled = true;
    try {
      const r = await RO.Net.buyKartItem(b.dataset.buy);
      if (!r || !r.ok) { UI().toast(r && r.reason === 'saldo' ? 'No te alcanzan las monedas' : r && r.reason === 'ya' ? 'Ya lo tienes' : 'No se pudo comprar', 'err'); b.disabled = false; return; }
      RO.S.me.coins = r.coins; UI().renderTop(); RO.sfx.cash(); RO.G.fxConfetti();
      UI().close(); Kt.shop();
    } catch (e) { UI().err(e); b.disabled = false; }
  });
};

/* ════════════ RED ════════════ */
Kt.onMsg = m => {
  const s = RO.G.scene; if (!s) return;
  if (m.t === 'kjoin') {
    if (Kt.state === 'lobby') { Kt.joined.set(m.u, { ready: false, t: Date.now() }); const mine = Kt.joined.get(me()); send('kstate', { ready: !!(mine && mine.ready), t0: mine && mine.t }); Kt.renderLobby(); }
    else if (Kt.state === 'idle' || Kt.state === 'free') UI().toast('🏁 ' + RO.esc(RO.nameOf(m.u)) + ' quiere correr en el kartódromo', '', [{ t: 'Unirme', y: 1, f: () => { if (Kt.state === 'free') Kt.unride(); RO.G.goToSpot(11, 74); Kt.join(); } }]);
    return;
  }
  if (m.t === 'kstate') { if (Kt.state === 'lobby') { const j = Kt.joined.get(m.u) || { t: m.t0 || Date.now() }; j.ready = !!m.ready; Kt.joined.set(m.u, j); Kt.renderLobby(); Kt.tryStart(); } return; }
  if (m.t === 'kleave') { Kt.joined.delete(m.u); Kt.dropRacer(m.u); Kt.renderLobby(); return; }
  if (m.t === 'kgo') { Kt.start(m); return; }
  if (m.t === 'kride') { const p = Kt.parked[m.i]; if (p) { p.by = m.on ? m.u : null; p.spr.setVisible(!m.on); } if (!m.on) Kt.dropRacer(m.u); return; }
  if (m.t === 'kp') {
    let r = Kt.racers.get(m.u);
    if (!r) { r = { uid: m.u, x: m.x, y: m.y, a: m.a, tx: m.x, ty: m.y, ta: m.a }; Kt.racers.set(m.u, r); }
    if (!r.spr || r.m !== m.m) { if (r.spr) r.spr.destroy(); r.m = m.m; r.spr = s.add.image(r.x, r.y, kartTex(s, m.m || 'basico', colorOf(m.u))).setRotation(r.a); }
    r.tx = m.x; r.ty = m.y; r.ta = m.a; r.p = m.p; r.lap = m.lap; return;
  }
  if (m.t === 'kfin') { Kt.onFinish(m); return; }
  if (m.t === 'krec') { Kt.setTop(m.top); UI().toast('🏁 Nuevo récord de vuelta: <b>' + RO.esc(RO.nameOf(m.u)) + '</b> · ' + fmt(m.top && m.top[0] && m.top[0].ms)); return; }
};
Kt.dropRacer = uid => { const r = Kt.racers.get(uid); if (!r) return; if (r.spr) r.spr.destroy(); Kt.racers.delete(uid); const p = RO.G.scene && RO.G.scene.players.get(uid); if (p) p.spr.setVisible(true); };
})();
