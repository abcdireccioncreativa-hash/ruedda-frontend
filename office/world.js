'use strict';
/* ════════════════════════════════════════════════════════════════
   RUEDDA OFFICE — el mundo: plano, salas, muebles fijos, puntos de
   interacción y el render del piso/muros en un único canvas.
   Coordenadas en tiles de 16 px. Mapa 57 × 70 (el club privado está al fondo, bajo el garage).
   ════════════════════════════════════════════════════════════════ */
(function(){
const RO = window.RO, A = RO.Art, T = A.T;
const W = 57, H = 70;
const CLUB = { x0: 8, y0: 56, x1: 48, y1: 68, door: [27, 29] };
const OFF_X = [1, 15, 29, 43];          // x inicial de cada oficina privada (13 de ancho)
const GARAGE_WALL = [39, 41];           // filas del muro alto del garage
const SECRET = { x: 18, w: 2, shelfX: 18, shelfY: 38, slideTo: 20 };

const Wd = RO.World = { W, H, T, OFF_X, SECRET, CLUB };

const ROOM_STYLE = {
  pasillo:  { floor: 'carpet', a: '#25272d', b: '#2b2e35', wall: '#1d1f24' },
  juntas:   { floor: 'carpet', a: '#2e3442', b: '#29303d', wall: '#1f232b' },
  lobby:    { floor: 'stone',  a: '#121316', b: '#191a1e', wall: '#16171a' },
  creativa: { floor: 'wood',   a: '#c8a57a', b: '#b8956a', wall: '#2f3a3a' },
  ocio:     { floor: 'tile',   a: '#cfd3d8', b: '#c3c8ce', wall: '#3a3546' },
  terraza:  { floor: 'deck',   a: '#9c8466', b: '#86704f', wall: '#3a3f48' },
  garage:   { floor: 'epoxy',  a: '#0d0e11', b: '#0d0e11', wall: '#0a0a0d' },
  club:     { floor: 'tile',   a: '#0e0912', b: '#120b17', wall: '#0b0710' }
};

/* ── construcción del plano ── */
Wd.build = (cfg) => {
  const grid = [], room = [];
  for (let y = 0; y < H; y++) { grid.push(new Uint8Array(W).fill(1)); room.push(new Array(W).fill(null)); }
  const carve = (x0, y0, x1, y1, id) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { grid[y][x] = 0; room[y][x] = id; } };
  // oficinas privadas
  OFF_X.forEach((x0, p) => { carve(x0, 1, x0 + 12, 9, 'off' + p); carve(x0 + 6, 10, x0 + 7, 10, 'off' + p); });
  carve(1, 11, 55, 13, 'pasillo');
  carve(1, 15, 15, 29, 'juntas');   carve(12, 14, 13, 14, 'juntas');
  carve(17, 15, 38, 29, 'lobby');   carve(19, 14, 23, 14, 'lobby');
  carve(16, 21, 16, 23, 'lobby');
  carve(40, 15, 55, 29, 'creativa'); carve(41, 14, 42, 14, 'creativa'); carve(39, 21, 39, 23, 'creativa');
  carve(1, 31, 36, 38, 'ocio');     carve(26, 30, 29, 30, 'ocio'); carve(7, 30, 8, 30, 'ocio');
  carve(38, 31, 55, 38, 'terraza'); carve(37, 33, 37, 35, 'terraza'); carve(47, 30, 48, 30, 'terraza');
  carve(1, 42, 55, 53, 'garage');
  carve(CLUB.x0, CLUB.y0, CLUB.x1, CLUB.y1, 'club'); carve(CLUB.door[0], 54, CLUB.door[1], 55, 'club');

  /* ── muebles fijos ── */
  const S = [];   // {key, x, y, opts, depthBias}
  const add = (key, x, y, opts) => { S.push({ key, x, y, opts: opts || {} }); };
  const offices = (cfg.offices || []).slice().sort((a, b) => a.pos - b.pos);
  OFF_X.forEach((X, p) => {
    const o = offices.find(z => z.pos === p) || {}, th = RO.THEMES[o.theme] || RO.THEMES.madera;
    add('silla', X + 6, 3, { color: '#16171b' });
    add('escritorio_pc', X + 5, 4, { lamp: A.YELLOW });
    add('placa', X + 9, 10);
    if (!o.bare) {   // muebles base (el dueño los puede quitar desde "Mi oficina")
      add('estanteria', X, 1);
      add('planta_grande', X + 12, 1);
      add('alfombra', X + 4, 5, { color: rugFor(o.theme) });
      add('mesa', X + 9, 6);
      add('sofa', X + 9, 8, { color: sofaFor(o.theme) });
      add('planta', X, 8);
      add('lampara', X + 12, 8);
      add('cuadro_pared', X + 8, 0, { color: ['#163a5c', '#5c1630', '#1f4a2e', '#4a3a16'][p] });
    }
  });
  // pasillo
  add('dispensador', 2, 11); add('planta', 13, 11); add('planta', 27, 11); add('planta', 41, 11); add('planta', 55, 11);
  // sala de juntas
  add('tv_pared', 4, 14);
  add('mesa_juntas', 5, 20);
  [[6, 19], [8, 19], [10, 19]].forEach(([x, y]) => add('silla', x, y, { color: '#16171b' }));
  [[6, 23], [8, 23], [10, 23]].forEach(([x, y]) => add('silla', x, y, { color: '#16171b' }));
  add('silla', 4, 21, { color: '#16171b' }); add('silla', 12, 21, { color: '#16171b' });
  add('planta_grande', 1, 15); add('planta', 15, 15); add('planta', 1, 29); add('trofeo', 14, 15); add('estanteria', 1, 26);
  // recepción
  for (let x = 30; x <= 37; x++) add('panel', x, 15);
  add('recepcion', 30, 17);
  add('gong', 37, 17);
  add('planta_grande', 17, 15); add('planta', 38, 15); add('planta', 17, 29); add('planta_grande', 38, 28);
  add('sofa_lobby', 18, 27); add('mesa', 18, 25); add('sofa_lobby', 33, 27); add('mesa', 35, 25);
  add('lampara', 21, 27); add('lampara', 32, 27);
  // sala creativa
  add('pizarra', 44, 14);
  add('puff', 44, 19, { color: '#e6f03b' }); add('puff', 46, 20, { color: '#2c5bd6' }); add('puff', 49, 19, { color: '#d7262e' }); add('puff', 51, 20, { color: '#1f7a4a' });
  add('mesa', 47, 23); add('planta_grande', 55, 15); add('lampara', 40, 15);
  add('estanteria', 40, 27); add('servidor', 54, 27); add('servidor', 55, 27); add('bonsai', 42, 27);
  // zona de ocio
  add('arcade', 1, 31); add('arcade', 2, 31); add('arcade', 3, 31);
  add('pingpong', 6, 33);
  add('tv', 13, 31); add('mesa', 13, 33); add('sofa', 12, 36, { color: '#3b4a5e' });
  add('cafetera', 19, 31); add('dispensador', 20, 31); add('maquina_snacks', 22, 31);
  add('estanteria', SECRET.shelfX, SECRET.shelfY, { secret: true });
  add('pecera', 32, 31); add('planta', 36, 31); add('planta', 1, 38);
  add('puff', 29, 34, { color: '#e85b9c' }); add('puff', 31, 35, { color: '#e6f03b' }); add('sofa', 28, 37, { color: '#5c3f2a' });
  add('cuadro_pared', 15, 30, { color: '#5c1630' });
  // terraza
  add('tumbona', 40, 32); add('tumbona', 42, 32); add('tumbona', 44, 32);
  add('parrilla', 52, 31); add('planta_grande', 38, 31); add('planta', 55, 31);
  add('mesa', 41, 36); add('puff', 40, 37, { color: '#f08a24' }); add('puff', 43, 37, { color: '#f08a24' });
  for (let x = 38; x <= 55; x++) add('baranda', x, 38);
  // garage VIP
  const CAR_SLOTS = [[3, 43], [10, 43], [23, 43], [31, 43], [40, 43], [4, 48], [12, 48], [32, 48]];
  const cars = (cfg.cars || []).slice(0, CAR_SLOTS.length).map((c, i) => ({ car: c, x: CAR_SLOTS[i][0], y: CAR_SLOTS[i][1], i }));
  cars.forEach(c => add('tarima', c.x, c.y, { color: c.car.color === '#16171b' ? '#9aa0a6' : c.car.color }));
  add('barra', 48, 43); add('champan', 52, 42); add('champan', 49, 42);
  add('sofa_vip', 20, 50); add('sofa_vip', 24, 50); add('mesa', 22, 48); add('champan', 23, 47);
  add('dinero', 36, 53); add('dinero', 37, 53); add('dinero', 38, 53); add('dinero', 44, 52);
  add('estatua_oro', 45, 48); add('trofeo', 47, 48);
  add('planta_grande', 1, 52); add('planta_grande', 55, 52); add('planta_grande', 15, 42); add('planta_grande', 22, 42);
  add('bola_disco', 23, 45);
  add('letrero_vip', 4, 40);
  // club privado (al fondo)
  add('escenario', 20, 58);
  const POLES = [[23, 59], [28, 59], [33, 59]];
  POLES.forEach(([x, y]) => add('tubo', x, y));
  add('dj', 41, 57); add('parlante', 39, 57); add('parlante', 46, 57); add('parlante', 18, 57); add('parlante', 38, 57);
  add('barra', 9, 57); add('champan', 10, 56); add('champan', 13, 56);
  add('sofa_vip', 10, 66); add('sofa_vip', 14, 66); add('mesa', 12, 64); add('champan', 12, 63);
  add('sofa_vip', 36, 66); add('sofa_vip', 40, 66); add('mesa', 39, 64); add('champan', 40, 63);
  add('dinero', 19, 62); add('dinero', 37, 62);
  add('planta_grande', 8, 68); add('planta_grande', 48, 68); add('planta_grande', 48, 60);
  add('bola_grande', 28, 64);

  /* ── bloqueo estático ── */
  const blocked = grid.map(r => Uint8Array.from(r));
  S.forEach(s => {
    const it = A.ITEMS[s.key]; if (!it || !it.block || it.wall) return;
    for (let y = s.y; y < s.y + it.fh; y++) for (let x = s.x; x < s.x + it.fw; x++) if (blocked[y]) blocked[y][x] = 1;
  });
  // fila bajo la pizarra (bandeja), el panel tras recepción y la piscina
  for (let x = 44; x <= 53; x++) blocked[15][x] = 1;
  const POOL = { x0: 48, y0: 34, x1: 54, y1: 36 };
  for (let y = POOL.y0; y <= POOL.y1; y++) for (let x = POOL.x0; x <= POOL.x1; x++) blocked[y][x] = 1;
  // autos: cuerpo de 4×2 en el centro de cada tarima
  cars.forEach(c => { for (let y = c.y + 1; y <= c.y + 2; y++) for (let x = c.x + 1; x <= c.x + 4; x++) blocked[y][x] = 1; });

  /* ── puntos de interacción ── */
  const inter = [];
  OFF_X.forEach((X, p) => inter.push({ id: 'desk' + p, kind: 'desk', pos: p, x: (X + 6.5) * T, y: 5.6 * T, r: 30 }));
  inter.push({ id: 'board', kind: 'board', x: 49 * T, y: 16.8 * T, r: 90, rx: 90, ry: 26 });
  inter.push({ id: 'gong', kind: 'gong', x: 38 * T, y: 18.8 * T, r: 24 });
  inter.push({ id: 'clocks', kind: 'clocks', x: 33.5 * T, y: 16.5 * T, r: 40 });
  inter.push({ id: 'tv', kind: 'tv', x: 6 * T, y: 16.2 * T, r: 34 });
  inter.push({ id: 'secret', kind: 'secret', x: (SECRET.shelfX + 1) * T, y: (SECRET.shelfY - 0.2) * T, r: 22 });
  inter.push({ id: 'coffee', kind: 'coffee', x: 19.5 * T, y: 32.6 * T, r: 20 });
  inter.push({ id: 'snacks', kind: 'snacks', x: 23 * T, y: 32.8 * T, r: 22 });
  [1, 2, 3].forEach(x => inter.push({ id: 'arcade' + x, kind: 'arcade', x: (x + .5) * T, y: 32.6 * T, r: 14 }));
  inter.push({ id: 'pingpong', kind: 'pingpong', x: 8 * T, y: 35.6 * T, r: 34 });
  inter.push({ id: 'grill', kind: 'grill', x: 53 * T, y: 32.8 * T, r: 22 });
  inter.push({ id: 'aquarium', kind: 'aquarium', x: 33 * T, y: 32.8 * T, r: 22 });
  cars.forEach(c => inter.push({ id: 'car' + c.i, kind: 'car', car: c.car, idx: c.i, x: (c.x + 3) * T, y: (c.y + 3.6) * T, r: 34 }));
  inter.push({ id: 'bar', kind: 'bar', x: 51 * T, y: 44.8 * T, r: 40 });
  inter.push({ id: 'stage', kind: 'stage', x: 28.5 * T, y: 63.2 * T, r: 120, rx: 140, ry: 22 });
  inter.push({ id: 'dj', kind: 'dj', x: 43 * T, y: 58.8 * T, r: 34 });
  inter.push({ id: 'clubbar', kind: 'bar', x: 12 * T, y: 58.8 * T, r: 40 });

  // asientos para "reunión de emergencia"
  const seats = [[6, 19, 'down'], [8, 19, 'down'], [10, 19, 'down'], [4, 21, 'right'], [12, 21, 'left'], [6, 23, 'up'], [8, 23, 'up'], [10, 23, 'up']]
    .map(([x, y, d]) => ({ x: (x + .5) * T, y: (y + .8) * T, dir: d }));
  // ruta de Valentina
  const npcPath = [[19, 45], [27, 46], [38, 47], [46, 46], [42, 52], [33, 52], [24, 47], [17, 52], [9, 46], [18, 44]];
  const spawn = { x: 25 * T, y: 21 * T };
  const officeSpawn = p => ({ x: (OFF_X[p] + 6.5) * T, y: 7 * T });

  const dancers = POLES.map(([x, y], i) => ({ x: (x + .5) * T, y: (y + 1) * T - 2, i }));
  return { grid, room, blocked, staticBlocked: blocked.map(r => Uint8Array.from(r)), statics: S, inter, seats, npcPath, spawn, officeSpawn, cars, POOL, dancers };
};
const shade = A.shade;
function rugFor(t) { return ({ nogal: '#7a2f3a', madera: '#2c4a6e', alfombra: '#8a6a2c', concreto: '#2f5a44', marmol: '#3a2f5a', neon: '#5a1f6e', ruedda: '#3a3d10', verde: '#6e4a2c' })[t] || '#7a2f3a'; }
function sofaFor(t) { return ({ nogal: '#2a2d33', madera: '#6e4a2c', alfombra: '#5b6573', concreto: '#e6f03b', marmol: '#2c5bd6', neon: '#e85b9c', ruedda: '#e6f03b', verde: '#c9a96e' })[t] || '#4a5568'; }

/* ── sala / tema por celda ── */
// rectángulo (en tiles) de la oficina de un slot
Wd.officeRect = (slot, cfg) => {
  const o = (cfg.offices || []).find(z => z.slot === slot); if (!o || o.pos == null || o.pos < 0 || o.pos > 3) return null;
  const x0 = OFF_X[o.pos]; return { x0, y0: 1, x1: x0 + 12, y1: 9, pos: o.pos };
};
Wd.styleOf = (id, cfg) => {
  if (!id) return null;
  if (id.startsWith('off')) {
    const p = +id.slice(3), o = (cfg.offices || []).find(z => z.pos === p) || {}, th = RO.THEMES[o.theme] || RO.THEMES.madera;
    return { floor: th.floor, a: th.a, b: th.b, wall: th.wall };
  }
  return ROOM_STYLE[id];
};
Wd.roomName = (id, cfg) => {
  if (!id) return '';
  if (id.startsWith('off')) {
    const p = +id.slice(3), o = (cfg.offices || []).find(z => z.pos === p);
    if (!o) return 'Oficina';
    if (o.title) return o.title;
    const m = RO.memberBySlot(o.slot);
    return 'Oficina de ' + (m ? m.display_name : o.name);
  }
  return (cfg.rooms && cfg.rooms[id]) || id;
};

/* ── render del piso + muros a un canvas ── */
Wd.renderBase = (w, cfg, logoBits, secretOpen) => {
  const k = A.mk(W * T, H * T), g = k.g;
  const cache = {};
  const tile = (st, v) => { const key = st.floor + st.a + st.b + v; return cache[key] || (cache[key] = A.floorTile(st.floor, st.a, st.b, v)); };
  const roomAt = (x, y) => (y >= 0 && y < H && x >= 0 && x < W) ? w.room[y][x] : null;
  const isFloor = (x, y) => y >= 0 && y < H && x >= 0 && x < W && w.grid[y][x] === 0;

  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (isFloor(x, y)) {
      const st = Wd.styleOf(w.room[y][x], cfg) || ROOM_STYLE.pasillo;
      g.drawImage(tile(st, (x * 7 + y * 13) % 4), x * T, y * T);
    } else {
      // muro alto del garage
      if (y >= GARAGE_WALL[0] && y <= GARAGE_WALL[1] && x >= 1 && x <= 55 && !(secretOpen && x >= SECRET.x && x < SECRET.x + SECRET.w)) {
        const top = y === GARAGE_WALL[0];
        k.r(x * T, y * T, T, T, '#0e0f13');
        if (top) k.r(x * T, y * T, T, 3, '#060608');
        for (let by = 0; by < T; by += 4) k.r(x * T + ((by / 4) % 2 ? 0 : 8), y * T + by, 1, 4, '#16171c');
        k.r(x * T, y * T + (by4(y)), T, 1, '#16171c');
        if (y === GARAGE_WALL[1]) k.r(x * T, y * T + 13, T, 3, '#050507').r(x * T, y * T + 12, T, 1, '#7c3aed');
        continue;
      }
      const below = roomAt(x, y + 1);
      if (isFloor(x, y + 1)) {
        const st = Wd.styleOf(below, cfg) || ROOM_STYLE.pasillo;
        g.drawImage(cache['wf' + st.wall + (x % 4)] || (cache['wf' + st.wall + (x % 4)] = A.wallFace(st.wall, x)), x * T, y * T);
      } else {
        let near = null;
        for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1], [0, -2]]) { const r = roomAt(x + dx, y + dy); if (r) { near = r; break; } }
        const st = Wd.styleOf(near, cfg) || { wall: '#1a1b1f' };
        g.drawImage(cache['wt' + st.wall] || (cache['wt' + st.wall] = A.wallTop(st.wall)), x * T, y * T);
      }
    }
  }
  // sombra suave bajo los muros
  g.fillStyle = 'rgba(0,0,0,.22)';
  for (let y = 1; y < H; y++) for (let x = 0; x < W; x++) if (isFloor(x, y) && !isFloor(x, y - 1)) g.fillRect(x * T, y * T, T, 3);
  g.fillStyle = 'rgba(0,0,0,.10)';
  for (let y = 0; y < H; y++) for (let x = 1; x < W; x++) if (isFloor(x, y) && !isFloor(x - 1, y)) g.fillRect(x * T, y * T, 2, T);

  // pasillo: alfombra central amarilla fina
  k.r(1 * T, 12 * T + 7, 55 * T, 2, 'rgba(230,240,59,.16)');

  // recepción: logo Ruedda en mosaico de piso + textos
  if (logoBits) {
    const px = 2, lw = logoBits.cols * px, lh = logoBits.rows * px;
    const cx = 28 * T, cy = 22.4 * T, x0 = Math.round(cx - lw / 2), y0 = Math.round(cy - lh / 2);
    const fx0 = x0 - 14, fy0 = y0 - 12, fw = lw + 28, fh = lh + 44;
    k.r(fx0, fy0, fw, fh, '#0b0c0e').r(fx0, fy0, fw, 1, 'rgba(230,240,59,.55)').r(fx0, fy0 + fh - 1, fw, 1, 'rgba(230,240,59,.55)').r(fx0, fy0, 1, fh, 'rgba(230,240,59,.55)').r(fx0 + fw - 1, fy0, 1, fh, 'rgba(230,240,59,.55)');
    [[fx0, fy0], [fx0 + fw - 3, fy0], [fx0, fy0 + fh - 3], [fx0 + fw - 3, fy0 + fh - 3]].forEach(([x, y]) => k.r(x, y, 3, 3, A.YELLOW));
    g.drawImage(A.logoCanvas(logoBits, px, '#d8e236', { bevel: true }), x0, y0);
    const t1 = A.pixelText('RUEDDA ECOSYSTEM', A.YELLOW, 1);
    g.drawImage(t1, Math.round(cx - t1.width / 2), y0 + lh + 9);
    const t2 = A.pixelText('CENTRO VIRTUAL DE OFICINAS', '#7d8088', 1);
    g.drawImage(t2, Math.round(cx - t2.width / 2), y0 + lh + 19);
  }
  // terraza: piscina
  const P = w.POOL;
  k.r(P.x0 * T, P.y0 * T, (P.x1 - P.x0 + 1) * T, (P.y1 - P.y0 + 1) * T, '#e8e4dc');
  k.r(P.x0 * T + 3, P.y0 * T + 3, (P.x1 - P.x0 + 1) * T - 6, (P.y1 - P.y0 + 1) * T - 6, '#1e8fd0');
  k.r(P.x0 * T + 3, P.y0 * T + 3, (P.x1 - P.x0 + 1) * T - 6, 3, '#1670a8');
  for (let i = 0; i < 9; i++) k.r(P.x0 * T + 10 + i * 12, P.y0 * T + 12 + (i % 3) * 10, 6, 1, '#7fd0ff');
  // club: tiras de neón en el muro y letrero en el piso del garage apuntando a la puerta
  for (let x = CLUB.x0; x <= CLUB.x1; x++) if (x < CLUB.door[0] || x > CLUB.door[1]) { k.r(x * T, 55 * T + 10, T, 1, '#e85b9c').r(x * T, 55 * T + 12, T, 1, 'rgba(124,58,237,.8)'); }
  const sg = A.pixelText('CLUB', '#e85b9c', 2);
  g.drawImage(sg, Math.round((CLUB.door[0] + 1.5) * T - sg.width / 2), 52 * T + 4);
  k.r((CLUB.door[0]) * T, 53 * T + 10, 3 * T, 1, 'rgba(232,91,156,.7)');
  // garage: líneas de estacionamiento amarillas y reflejos
  for (let x = 2; x < 55; x += 4) { k.r(x * T, 53 * T + 2, 1, 12, 'rgba(230,240,59,.35)'); }
  k.r(1 * T, 47 * T, 55 * T, 1, 'rgba(124,58,237,.18)');
  return k.c;
};
function by4(y) { return (y * 5) % 16; }

/* ── pathfinding BFS sobre la rejilla ── */
Wd.path = (blocked, sx, sy, tx, ty) => {
  if (!blocked[ty] || blocked[ty][tx] === undefined) return null;
  if (blocked[ty][tx]) {
    // busca la celda libre más cercana al destino
    let best = null, bd = 1e9;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const x = tx + dx, y = ty + dy; if (blocked[y] && blocked[y][x] === 0) { const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = [x, y]; } } }
    if (!best) return null; tx = best[0]; ty = best[1];
  }
  const prev = new Int32Array(W * H).fill(-1), q = [sy * W + sx]; prev[sy * W + sx] = sy * W + sx;
  const goal = ty * W + tx;
  for (let qi = 0; qi < q.length; qi++) {
    const c = q[qi]; if (c === goal) break;
    const cx = c % W, cy = (c / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H || blocked[ny][nx]) continue;
      const n = ny * W + nx; if (prev[n] !== -1) continue; prev[n] = c; q.push(n);
    }
  }
  if (prev[goal] === -1) return null;
  const out = []; let c = goal; while (c !== sy * W + sx) { out.push([c % W, (c / W) | 0]); c = prev[c]; }
  return out.reverse();
};
})();
