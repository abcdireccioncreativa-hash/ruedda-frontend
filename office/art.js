'use strict';
/* ════════════════════════════════════════════════════════════════
   RUEDDA OFFICE — arte pixel generado por código (sin assets externos).
   Tile = 16 px. Cada sprite se pinta en un <canvas> con contorno
   automático y se registra como textura de Phaser.
   ════════════════════════════════════════════════════════════════ */
(function(){
const RO = window.RO;
const A = RO.Art = {};
const T = A.T = 16;
A.YELLOW = '#e6f03b';

/* ── pincel ── */
function mk(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  const k = {
    c, g, w, h,
    r(x, y, ww, hh, col) { if (!col) return k; g.fillStyle = col; g.fillRect(x, y, ww, hh); return k; },
    p(x, y, col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); return k; },
    ell(cx, cy, rx, ry, col) {
      g.fillStyle = col;
      for (let y = -ry; y <= ry; y++) { const xx = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / ((ry + .5) * (ry + .5))))); g.fillRect(Math.round(cx - xx), Math.round(cy + y), xx * 2 + 1, 1); }
      return k;
    },
    hline(x, y, ww, col) { return k.r(x, y, ww, 1, col); },
    vline(x, y, hh, col) { return k.r(x, y, 1, hh, col); },
    // rectángulo con esquinas recortadas
    rr(x, y, ww, hh, col, cut = 1) {
      g.fillStyle = col;
      for (let i = 0; i < hh; i++) {
        let inset = 0;
        if (i < cut) inset = cut - i; else if (i >= hh - cut) inset = i - (hh - cut) + 1;
        g.fillRect(x + inset, y + i, ww - inset * 2, 1);
      }
      return k;
    }
  };
  return k;
}
A.mk = mk;

function hex2rgb(h) { h = String(h || '#000').replace('#', ''); if (h.length === 3) h = h.split('').map(x => x + x).join(''); const n = parseInt(h, 16) || 0; return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function rgb2hex(r, g, b) { return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); }
const shade = A.shade = (hex, amt) => { const [r, g, b] = hex2rgb(hex); return amt >= 0 ? rgb2hex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt) : rgb2hex(r * (1 + amt), g * (1 + amt), b * (1 + amt)); };
A.hex2rgb = hex2rgb;

// contorno de 1 px alrededor de lo opaco
function outline(k, col = '#121317') {
  const { g, w, h } = k, id = g.getImageData(0, 0, w, h), d = id.data, [R, G, B] = hex2rgb(col), src = new Uint8ClampedArray(d);
  const op = (x, y) => x >= 0 && y >= 0 && x < w && y < h && src[(y * w + x) * 4 + 3] > 160;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4; if (src[i + 3] > 10) continue;
    if (op(x - 1, y) || op(x + 1, y) || op(x, y - 1) || op(x, y + 1)) { d[i] = R; d[i + 1] = G; d[i + 2] = B; d[i + 3] = 255; }
  }
  g.putImageData(id, 0, 0); return k;
}
A.outline = outline;
function hash(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
A.hash = hash;
function rnd(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
A.rnd = rnd;

/* ════════════ AVATARES ════════════ */
A.AV = {
  skin:   ['#f6d3b3', '#eab68f', '#c98d63', '#9a6440', '#6b4329'],
  hair:   ['corto', 'largo', 'rapado', 'rizado', 'moño', 'cresta', 'coleta', 'calvo'],
  hairColor: ['#1b1410', '#3d2516', '#6e4122', '#b77b3d', '#d9b25a', '#a9adb3', '#c2412d', '#2a3d8f'],
  outfit: ['casual', 'traje', 'hoodie', 'vestido'],
  colors: ['#e6f03b', '#16171b', '#f4f4f2', '#2c5bd6', '#d7262e', '#1f7a4a', '#7c3aed', '#f08a24', '#5b6573', '#c9a96e', '#e85b9c', '#0f8b8d'],
  acc:    ['ninguno', 'lentes', 'lentes_sol', 'gorra', 'audifonos', 'corona', 'cadena'],
  beard:  ['no', 'si']
};
A.AV_LABEL = {
  hair: { corto: 'Corto', largo: 'Largo', rapado: 'Rapado', rizado: 'Rizado', 'moño': 'Moño', cresta: 'Copete', coleta: 'Coleta', calvo: 'Calvo' },
  outfit: { casual: 'Casual', traje: 'Traje', hoodie: 'Hoodie', vestido: 'Vestido' },
  acc: { ninguno: 'Nada', lentes: 'Lentes', lentes_sol: 'Lentes de sol', gorra: 'Gorra Ruedda', audifonos: 'Audífonos', corona: 'Corona', cadena: 'Cadena de oro' },
  beard: { no: 'Sin barba', si: 'Barba' }
};
A.defaultAvatar = seed => {
  const r = rnd(hash(seed || 'x')), pick = a => a[Math.floor(r() * a.length)];
  return { skin: pick(A.AV.skin), hair: pick(['corto', 'rapado', 'rizado', 'cresta', 'largo']), hairColor: pick(A.AV.hairColor.slice(0, 5)),
           outfit: pick(['casual', 'traje', 'hoodie']), top: pick(A.AV.colors), bottom: pick(['#16171b', '#2b3442', '#5b6573', '#3d2b1f', '#1e2a44']),
           shoes: pick(['#16171b', '#f4f4f2', '#6e4122']), acc: pick(['ninguno', 'ninguno', 'lentes', 'audifonos', 'gorra']), beard: r() < .35 ? 'si' : 'no' };
};
A.normAvatar = (av, seed) => Object.assign(A.defaultAvatar(seed), av || {});
A.NPC_AV = { skin: '#eab68f', hair: 'moño', hairColor: '#1b1410', outfit: 'vestido', top: '#b3122e', bottom: '#b3122e', shoes: '#111111', acc: 'cadena', beard: 'no' };

const DIRS = ['down', 'left', 'right', 'up'];
A.DIRS = DIRS;
const FW = 16, FH = 24;

// dibuja un cuadro (16×24) del personaje: dir ∈ down|left|up, step ∈ 0|1|2 (0 parado, 1/2 pasos)
function drawChar(av, dir, step, sit) {
  const k = mk(FW, FH);
  const skin = av.skin, skinD = shade(skin, -.18), hairC = av.hairColor, hairD = shade(hairC, -.25), hairL = shade(hairC, .18);
  const top = av.top, topD = shade(top, -.22), topL = shade(top, .15), bot = av.bottom, botD = shade(bot, -.25), shoe = av.shoes;
  const dress = av.outfit === 'vestido';
  const bikini = av.outfit === 'bikini';
  const bob = step ? 1 : 0;       // el cuerpo baja 1 px al dar el paso
  const oy = bob;

  /* piernas */
  if (sit) {
    const leg = (dress || bikini) ? skin : bot, legD = (dress || bikini) ? skinD : botD;
    if (dir === 'down') { k.r(5, 18, 3, 3, leg).r(8, 18, 3, 3, legD).r(5, 21, 3, 1, shoe).r(8, 21, 3, 1, shoe); }
    else if (dir === 'up') { k.r(5, 18, 6, 1, leg); }
    else { k.r(3, 18, 7, 2, leg).r(3, 20, 2, 2, legD).r(2, 21, 3, 1, shoe); }
  } else if (bikini) {
    const L = step === 1 ? -1 : 0, R = step === 2 ? -1 : 0;
    if (dir === 'down' || dir === 'up') { k.r(5, 18, 3, 4 + L, skin).r(8, 18, 3, 4 + R, skinD).r(5, 22 + L, 3, 1, shoe).r(8, 22 + R, 3, 1, shoe); }
    else if (step === 0) { k.r(6, 18, 4, 4, skin).r(5, 22, 5, 1, shoe); }
    else { const f = step === 1; k.r(f ? 4 : 5, 18, 3, 4, skin).r(f ? 9 : 8, 18, 3, 4, skinD).r(f ? 3 : 4, 22, 4, 1, shoe).r(f ? 9 : 8, 22, 3, 1, shoe); }
  } else if (dir === 'down' || dir === 'up') {
    const L = step === 1 ? -1 : 0, R = step === 2 ? -1 : 0;
    if (dress) {
      k.r(6, 19 + L, 2, 3, skin).r(8, 19 + R, 2, 3, skinD);
      k.r(6, 21 + L, 2, 1, shoe).r(8, 21 + R, 2, 1, shoe);
    } else {
      k.r(5, 18 + oy, 6, 1, bot);
      k.r(5, 19, 3, 3 + L, bot).r(8, 19, 3, 3 + R, botD);
      k.r(5, 22 + L, 3, 1, shoe).r(8, 22 + R, 3, 1, shoe);
    }
  } else { // perfil (izquierda); la derecha es espejo
    if (dress) {
      if (step === 0) k.r(7, 19, 2, 3, skin).r(7, 21, 2, 1, shoe);
      else { const f = step === 1; k.r(f ? 5 : 6, 19, 2, 2, skin).r(f ? 9 : 8, 19, 2, 2, skinD).r(f ? 4 : 5, 21, 3, 1, shoe).r(f ? 9 : 8, 21, 2, 1, shoe); }
    } else {
      if (step === 0) { k.r(6, 18, 4, 4, bot).r(5, 22, 5, 1, shoe); }
      else { const f = step === 1;
        k.r(6, 18 + oy, 4, 1, bot);
        k.r(f ? 4 : 5, 19, 3, 3, bot).r(f ? 9 : 8, 19, 3, 3, botD);
        k.r(f ? 3 : 4, 22, 4, 1, shoe).r(f ? 9 : 8, 22, 3, 1, shoe); }
    }
  }

  /* torso */
  if (bikini) {
    const side = !(dir === 'down' || dir === 'up');
    const x0 = side ? 5 : 4, w = side ? 6 : 8;
    k.r(x0, 11 + oy, w, 7, skin).r(x0 + w - 1, 11 + oy, 1, 7, skinD);
    if (dir === 'down') k.r(5, 12 + oy, 2, 2, top).r(9, 12 + oy, 2, 2, top).r(7, 12 + oy, 2, 1, top);
    else k.r(x0, 12 + oy, w, 1, top).r(side ? 5 : 6, 13 + oy, side ? 3 : 4, 1, top);
    k.r(x0, 17 + oy, w, 2, av.bottom || top).p(x0 + 1, 17 + oy, shade(av.bottom || top, .3));
    if (side) { k.r(7, 12 + oy, 2, 4, skinD).r(7, 16 + oy, 2, 1, skin); }
    else { const aL = step === 1 ? 1 : step === 2 ? -1 : 0; k.r(3, 12 + oy, 1, 5, skin).r(12, 12 + oy, 1, 5, skinD).r(3, 17 + oy + aL, 1, 1, skin).r(12, 17 + oy - aL, 1, 1, skinD); }
  } else if (dir === 'down' || dir === 'up') {
    if (dress) {
      k.r(4, 11 + oy, 8, 6, top).r(4, 17 + oy, 8, 1, topD).r(3, 18 + oy, 10, 2, top).r(3, 19 + oy, 10, 1, topD);
      k.r(11, 11 + oy, 1, 6, topD);
    } else {
      k.r(4, 11 + oy, 8, 7, top).r(11, 11 + oy, 1, 7, topD).r(4, 11 + oy, 1, 7, topL);
      if (av.outfit === 'traje' && dir === 'down') { k.r(7, 11 + oy, 2, 4, '#f4f4f2').r(7, 12 + oy, 2, 4, '#b8232a').p(6, 11 + oy, topL).p(9, 11 + oy, topL); }
      if (av.outfit === 'hoodie') { k.r(4, 10 + oy, 8, 1, topD); if (dir === 'down') { k.r(5, 15 + oy, 6, 2, topD).p(6, 12 + oy, '#f4f4f2').p(9, 12 + oy, '#f4f4f2'); } }
      if (av.outfit === 'casual' && dir === 'down') k.r(6, 11 + oy, 4, 1, topD);
    }
    // brazos (balanceo)
    const aL = step === 1 ? 1 : step === 2 ? -1 : 0, aR = -aL;
    const sleeveLong = av.outfit !== 'casual' && !dress;
    k.r(3, 12 + oy, 1, sleeveLong ? 5 : 3, top).r(12, 12 + oy, 1, sleeveLong ? 5 : 3, topD);
    if (!sleeveLong) k.r(3, 15 + oy, 1, 2, skin).r(12, 15 + oy, 1, 2, skinD);
    k.r(3, 17 + oy + aL, 1, 1, skin).r(12, 17 + oy + aR, 1, 1, skinD);
  } else {
    if (dress) { k.r(5, 11 + oy, 6, 6, top).r(4, 17 + oy, 8, 3, top).r(4, 19 + oy, 8, 1, topD); }
    else { k.r(5, 11 + oy, 6, 7, top).r(5, 11 + oy, 1, 7, topL); if (av.outfit === 'hoodie') k.r(8, 10 + oy, 3, 2, topD); }
    const sw = step === 1 ? -2 : step === 2 ? 2 : 0;
    const sleeveLong = av.outfit !== 'casual' && !dress;
    k.r(7, 12 + oy, 2, sleeveLong ? 4 : 2, topD);
    if (!sleeveLong) k.r(7, 14 + oy, 2, 2, skin);
    k.r(7 + Math.sign(sw), 16 + oy, 2, 1, skin);
  }
  // cuello
  k.r(7, 10 + oy, 2, 1, dir === 'up' ? skinD : skin);
  if (av.acc === 'cadena' && dir === 'down') { k.r(6, 11 + oy, 4, 1, '#e8c547').p(7, 12 + oy, '#e8c547').p(8, 12 + oy, '#fff3a6'); }
  if (av.acc === 'cadena' && (dir === 'left')) { k.r(5, 11 + oy, 3, 1, '#e8c547'); }

  /* cabeza */
  const hy = 2 + oy;
  k.rr(4, hy + 1, 8, 8, skin, 1);
  if (dir === 'down') {
    k.p(3, hy + 5, skinD).p(12, hy + 5, skinD);
    k.r(6, hy + 5, 1, 2, '#1d1a1a').r(9, hy + 5, 1, 2, '#1d1a1a');
    k.p(7, hy + 7, skinD).p(8, hy + 7, skinD);
    if (av.beard === 'si') { k.r(5, hy + 7, 6, 2, hairC).p(4, hy + 6, hairC).p(11, hy + 6, hairC).r(7, hy + 7, 2, 1, skinD); }
  } else if (dir === 'left') {
    k.p(3, hy + 5, skin); // nariz
    k.r(5, hy + 4, 1, 2, '#1d1a1a');
    k.p(9, hy + 5, skinD).p(9, hy + 4, skinD);
    if (av.beard === 'si') k.r(4, hy + 6, 6, 3, hairC).r(4, hy + 6, 2, 1, skin);
  }
  /* pelo */
  const H = av.hair;
  if (H !== 'calvo') {
    if (dir === 'down') {
      if (H === 'rapado') { k.r(4, hy + 1, 8, 2, hairL).r(5, hy, 6, 1, hairL); }
      else if (H === 'rizado') { k.r(3, hy, 10, 3, hairC).r(4, hy - 1, 8, 1, hairC).r(3, hy + 3, 2, 3, hairC).r(11, hy + 3, 2, 3, hairC); [[4, hy], [7, hy - 1], [10, hy], [5, hy + 2], [9, hy + 2]].forEach(([x, y]) => k.p(x, y, hairL)); }
      else if (H === 'cresta') { k.r(4, hy + 1, 8, 2, hairC).r(5, hy - 2, 6, 3, hairC).r(6, hy - 2, 3, 1, hairL).p(4, hy + 3, hairC).p(11, hy + 3, hairC); }
      else {
        k.r(4, hy, 8, 3, hairC).r(5, hy - 1, 6, 1, hairC).p(4, hy + 3, hairC).p(11, hy + 3, hairC).r(5, hy, 3, 1, hairL);
        if (H === 'corto' || H === 'coleta') k.r(4, hy + 3, 1, 2, hairC).r(11, hy + 3, 1, 2, hairC);
        if (H === 'largo') k.r(3, hy + 2, 2, 10, hairC).r(11, hy + 2, 2, 10, hairC).r(3, hy + 2, 1, 10, hairD);
        if (H === 'moño') k.r(6, hy - 3, 4, 3, hairC).p(7, hy - 3, hairL);
        if (H === 'coleta') k.r(12, hy + 4, 1, 4, hairC);
      }
    } else if (dir === 'up') {
      if (H === 'rapado') k.rr(4, hy + 1, 8, 7, hairL, 1);
      else {
        k.rr(4, hy, 8, 9, hairC, 1).r(5, hy, 4, 1, hairL);
        if (H === 'rizado') k.r(3, hy, 10, 6, hairC).r(4, hy - 1, 8, 1, hairC);
        if (H === 'largo') k.r(4, hy + 7, 8, 6, hairC).r(4, hy + 12, 8, 1, hairD);
        if (H === 'moño') k.r(6, hy - 3, 4, 3, hairC);
        if (H === 'cresta') k.r(5, hy - 2, 6, 3, hairC);
        if (H === 'coleta') k.r(7, hy + 8, 2, 6, hairC).r(7, hy + 13, 2, 1, hairD);
      }
    } else { // left
      if (H === 'rapado') k.r(4, hy + 1, 8, 2, hairL).r(9, hy + 2, 3, 3, hairL);
      else {
        k.r(4, hy, 8, 3, hairC).r(5, hy - 1, 6, 1, hairC).r(9, hy + 2, 3, 4, hairC).r(5, hy, 3, 1, hairL);
        if (H === 'rizado') k.r(3, hy - 1, 10, 4, hairC).r(9, hy + 2, 4, 5, hairC);
        if (H === 'largo') k.r(9, hy + 2, 4, 11, hairC).r(12, hy + 2, 1, 11, hairD);
        if (H === 'moño') k.r(10, hy - 2, 3, 3, hairC);
        if (H === 'cresta') k.r(4, hy - 2, 6, 3, hairC).r(3, hy - 1, 2, 2, hairC);
        if (H === 'coleta') k.r(12, hy + 3, 2, 6, hairC);
      }
    }
  } else if (dir !== 'left') k.p(9, hy + 2, shade(skin, .3));

  /* accesorios de cabeza */
  const ac = av.acc;
  if (ac === 'lentes') {
    if (dir === 'down') k.r(5, hy + 5, 6, 1, '#1d1a1a').r(5, hy + 5, 2, 2, '#1d1a1a').r(9, hy + 5, 2, 2, '#1d1a1a').p(5, hy + 5, '#9fd3ff').p(9, hy + 5, '#9fd3ff');
    if (dir === 'left') k.r(4, hy + 4, 3, 2, '#1d1a1a').p(4, hy + 4, '#9fd3ff').r(7, hy + 4, 2, 1, '#1d1a1a');
  }
  if (ac === 'lentes_sol') {
    if (dir === 'down') k.r(4, hy + 4, 8, 1, '#0b0b0d').r(5, hy + 5, 2, 2, '#0b0b0d').r(9, hy + 5, 2, 2, '#0b0b0d').p(5, hy + 5, '#5a6170').p(9, hy + 5, '#5a6170');
    if (dir === 'left') k.r(3, hy + 4, 4, 2, '#0b0b0d').r(7, hy + 4, 2, 1, '#0b0b0d');
  }
  if (ac === 'gorra') {
    const c = '#e6f03b', cd = '#b8c22a';
    if (dir === 'down') k.r(4, hy - 1, 8, 3, c).r(5, hy - 2, 6, 1, c).r(3, hy + 2, 10, 1, cd).p(7, hy, '#16171b').p(8, hy, '#16171b');
    if (dir === 'up') k.rr(4, hy - 1, 8, 5, c, 1).r(6, hy + 3, 4, 1, '#16171b');
    if (dir === 'left') k.r(4, hy - 1, 8, 3, c).r(5, hy - 2, 6, 1, c).r(1, hy + 2, 5, 1, cd);
  }
  if (ac === 'audifonos') {
    if (dir === 'down' || dir === 'up') k.r(4, hy - 1, 8, 1, '#2a2d33').r(3, hy + 3, 2, 3, '#2a2d33').r(11, hy + 3, 2, 3, '#2a2d33').p(3, hy + 4, A.YELLOW).p(12, hy + 4, A.YELLOW);
    if (dir === 'down') k.r(4, hy + 6, 1, 2, '#2a2d33').p(5, hy + 8, '#2a2d33');
    if (dir === 'left') k.r(6, hy - 1, 5, 1, '#2a2d33').r(8, hy + 3, 3, 3, '#2a2d33').p(9, hy + 4, A.YELLOW);
  }
  if (ac === 'corona') {
    const g1 = '#f2c230', g2 = '#fff1a0';
    k.r(5, hy - 2, 6, 2, g1).p(5, hy - 3, g1).p(7, hy - 3, g1).p(8, hy - 3, g1).p(10, hy - 3, g1).p(7, hy - 2, '#d7262e').p(6, hy - 2, g2);
  }
  outline(k, '#111215');
  return k;
}

// hoja 80×96: filas down, left, right, up · columnas: parado, paso A, parado, paso B, sentado
A.avatarSheet = av => {
  const k = mk(FW * 5, FH * 4);
  const frames = [0, 1, 0, 2];
  DIRS.forEach((dir, row) => {
    frames.forEach((st, col) => {
      const src = drawChar(av, dir === 'right' ? 'left' : dir, st).c;
      // sombra
      k.g.fillStyle = 'rgba(0,0,0,.28)';
      k.g.fillRect(col * FW + 4, row * FH + 22, 8, 2); k.g.fillRect(col * FW + 3, row * FH + 23, 10, 1);
      if (dir === 'right') { k.g.save(); k.g.translate(col * FW + FW, row * FH); k.g.scale(-1, 1); k.g.drawImage(src, 0, 0); k.g.restore(); }
      else k.g.drawImage(src, col * FW, row * FH);
    });
    const sit = drawChar(av, dir === 'right' ? 'left' : dir, 0, true).c;
    if (dir === 'right') { k.g.save(); k.g.translate(4 * FW + FW, row * FH); k.g.scale(-1, 1); k.g.drawImage(sit, 0, 0); k.g.restore(); }
    else k.g.drawImage(sit, 4 * FW, row * FH);
  });
  return k.c;
};
A.FW = FW; A.FH = FH;

// cabecita para el HUD (escala entera, nítida)
A.avatarHead = (av, scale = 3) => {
  const src = drawChar(av, 'down', 0).c;
  const c = document.createElement('canvas'); c.width = 16 * scale; c.height = 14 * scale;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  g.drawImage(src, 0, -1, 16, 14, 0, 0, c.width, c.height);
  return c;
};
A.avatarFull = (av, scale = 6, dir = 'down', step = 0) => {
  const src = drawChar(av, dir === 'right' ? 'left' : dir, step).c;
  const c = document.createElement('canvas'); c.width = 16 * scale; c.height = 24 * scale;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  if (dir === 'right') { g.translate(c.width, 0); g.scale(-1, 1); }
  g.drawImage(src, 0, 0, c.width, c.height);
  return c;
};

/* ════════════ LOGO RUEDDA EN PIXEL ════════════ */
// Muestrea el wordmark real (/assets/ruedda-wordmark-negro.png) a una rejilla.
A.logoBits = (img, cols) => {
  const rows = Math.max(1, Math.round(cols * img.height / img.width));
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, img.width, img.height).data;
  const bits = new Uint8Array(cols * rows), cw = img.width / cols, ch = img.height / rows;
  for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
    let on = 0, tot = 0;
    const x0 = Math.floor(q * cw), x1 = Math.floor((q + 1) * cw), y0 = Math.floor(r * ch), y1 = Math.floor((r + 1) * ch);
    for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) {
      const i = (y * img.width + x) * 4; const a = d[i + 3] / 255, lum = (d[i] + d[i + 1] + d[i + 2]) / 765;
      on += a * (1 - lum); tot++;
    }
    bits[r * cols + q] = tot && on / tot > 0.42 ? 1 : 0;
  }
  return { cols, rows, bits };
};
A.loadLogo = () => new Promise(res => {
  if (A._logoImg) return res(A._logoImg);
  const im = new Image(); im.onload = () => { A._logoImg = im; res(im); }; im.onerror = () => res(null);
  im.src = '/assets/ruedda-wordmark-negro.png';
});
// pinta el logo en bloques (para el piso/neón). px = tamaño de cada bloque
A.logoCanvas = (lb, px, color, opts = {}) => {
  const pad = opts.glow ? 3 : 0;
  const k = mk(lb.cols * px + pad * 2, lb.rows * px + pad * 2);
  if (opts.glow) {
    k.g.fillStyle = opts.glowColor || 'rgba(230,240,59,.18)';
    for (let r = 0; r < lb.rows; r++) for (let q = 0; q < lb.cols; q++) if (lb.bits[r * lb.cols + q]) k.g.fillRect(q * px, r * px, px + pad * 2, px + pad * 2);
  }
  for (let r = 0; r < lb.rows; r++) for (let q = 0; q < lb.cols; q++) if (lb.bits[r * lb.cols + q]) {
    k.r(pad + q * px, pad + r * px, px, px, color);
    if (opts.bevel && px >= 2) { k.r(pad + q * px, pad + r * px, px, 1, shade(color, .35)); k.r(pad + q * px + px - 1, pad + r * px, 1, px, shade(color, -.25)); }
  }
  return k.c;
};

/* ════════════ TEXTO PIXEL 3×5 (para letreros pintados en el mapa) ════════════ */
const FONT = {
  A:'010101111101101',B:'110101110101110',C:'011100100100011',D:'110101101101110',E:'111100110100111',F:'111100110100100',G:'011100101101011',H:'101101111101101',I:'111010010010111',J:'001001001101010',K:'101101110101101',L:'100100100100111',M:'101111111101101',N:'110101101101101',O:'010101101101010',P:'110101110100100',Q:'010101101110011',R:'110101110101101',S:'011100010001110',T:'111010010010010',U:'101101101101111',V:'101101101101010',W:'101101111111101',X:'101101010101101',Y:'101101010010010',Z:'111001010100111',
  '0':'111101101101111','1':'010110010010111','2':'110001010100111','3':'110001010001110','4':'101101111001001','5':'111100110001110','6':'011100111101111','7':'111001010010010','8':'111101111101111','9':'111101111001110',
  ' ':'000000000000000','·':'000000010000000','.':'000000000000010','-':'000000111000000','/':'001001010100100',':':'000010000010000','!':'010010010000010','&':'010101010101011','Á':'010101111101101','É':'111100110100111','Í':'111010010010111','Ó':'010101101101010','Ú':'101101101101111','Ñ':'110101101101101'
};
A.pixelText = (text, color, scale = 1, shadow) => {
  text = String(text).toUpperCase();
  const w = Math.max(1, text.length * 4 - 1), k = mk(w * scale + (shadow ? scale : 0), 5 * scale + (shadow ? scale : 0));
  const draw = (ox, oy, col) => { for (let i = 0; i < text.length; i++) { const f = FONT[text[i]] || FONT[' ']; for (let j = 0; j < 15; j++) if (f[j] === '1') k.r(ox + (i * 4 + j % 3) * scale, oy + Math.floor(j / 3) * scale, scale, scale, col); } };
  if (shadow) draw(scale, scale, shadow);
  draw(0, 0, color);
  return k.c;
};

/* ════════════ PISOS (16×16) ════════════ */
A.floorTile = (kind, a, b, variant = 0) => {
  const k = mk(T, T), r = rnd(hash(kind + a + variant));
  if (kind === 'wood') {
    k.r(0, 0, T, T, a);
    for (let row = 0; row < 4; row++) {
      const y = row * 4, off = ((row + variant) % 2) * 8;
      k.r(0, y + 3, T, 1, shade(a, -.22));
      k.r((off + 5) % T, y, 1, 3, shade(a, -.15));
      k.r(0, y, T, 1, shade(a, .06));
      if (r() < .6) k.r(Math.floor(r() * 12) + 1, y + 1, 3, 1, b);
    }
  } else if (kind === 'carpet') {
    k.r(0, 0, T, T, a);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) if ((x + y * 3 + variant) % 5 === 0) k.p(x, y, b);
    if (variant % 3 === 0) k.p(Math.floor(r() * 16), Math.floor(r() * 16), shade(a, .12));
  } else if (kind === 'tile') {
    k.r(0, 0, T, T, a).r(0, 0, 8, 8, b).r(8, 8, 8, 8, b);
    k.r(0, 0, T, 1, shade(a, .1)).r(0, 0, 1, T, shade(a, .1)).r(0, 15, T, 1, shade(a, -.12)).r(15, 0, 1, T, shade(a, -.12));
  } else if (kind === 'marble') {
    k.r(0, 0, T, T, a);
    let x = Math.floor(r() * 16), y = 0; while (y < 16) { k.p(x, y, b); x += r() < .5 ? -1 : 1; x = (x + 16) % 16; y++; }
    k.r(0, 15, T, 1, shade(a, -.06)).r(15, 0, 1, T, shade(a, -.06));
  } else if (kind === 'stone') { // recepción: piedra oscura pulida
    k.r(0, 0, T, T, a).r(1, 1, 14, 14, b).r(1, 1, 14, 1, shade(b, .08)).r(1, 1, 1, 14, shade(b, .05));
    if (r() < .5) k.p(3 + Math.floor(r() * 10), 3 + Math.floor(r() * 10), shade(b, .12));
  } else if (kind === 'epoxy') { // garage: negro brillante
    k.r(0, 0, T, T, a);
    for (let i = 0; i < 5; i++) k.p(Math.floor(r() * 16), Math.floor(r() * 16), shade(a, .1 + r() * .1));
    if (variant % 4 === 0) for (let i = 0; i < 6; i++) k.p(i + 4, 10 - i, shade(a, .06));
  } else if (kind === 'deck') {
    k.r(0, 0, T, T, a);
    for (let col = 0; col < 4; col++) { k.r(col * 4 + 3, 0, 1, T, shade(a, -.25)); if (r() < .7) k.r(col * 4 + 1, Math.floor(r() * 12), 1, 3, b); }
    k.r(0, ((variant % 2) * 8 + 5) % 16, T, 1, shade(a, -.12));
  } else {
    k.r(0, 0, T, T, a);
  }
  return k.c;
};

/* muros: cara frontal (cuando hay piso debajo) y tope */
A.wallFace = (col, variant) => {
  const k = mk(T, T);
  k.r(0, 0, T, 3, shade(col, -.35)).r(0, 3, T, 11, col).r(0, 3, T, 1, shade(col, .22)).r(0, 13, T, 3, shade(col, -.45)).r(0, 13, T, 1, shade(col, -.15));
  if (variant % 4 === 0) k.r(4, 6, 1, 4, shade(col, .06));
  return k.c;
};
A.wallTop = col => { const k = mk(T, T); k.r(0, 0, T, T, shade(col, -.45)).r(0, 0, T, 1, shade(col, -.2)); return k.c; };

/* ════════════ MUEBLES ════════════ */
// cada artículo: footprint fw×fh (tiles), sprite w×h (px), block (bloquea paso), draw(k, opts)
const I = A.ITEMS = {};
const def = (key, o) => { I[key] = Object.assign({ fw: 1, fh: 1, w: 16, h: 16, block: true, shop: false }, o, { key }); };
const WOOD = '#8a5a3c', WOODL = '#a8734e', WOODD = '#5e3c27';

def('escritorio', { name: 'Escritorio', fw: 3, w: 48, h: 26, shop: true, draw(k) {
  k.r(1, 6, 46, 10, WOODL).r(1, 6, 46, 1, shade(WOODL, .2)).r(1, 15, 46, 1, WOODD).r(1, 16, 46, 8, WOOD).r(3, 17, 18, 5, WOODD).r(4, 18, 16, 1, shade(WOOD, .1)).r(9, 19, 4, 1, '#c9a96e');
  k.r(1, 24, 2, 2, WOODD).r(45, 16, 2, 10, WOODD);
}});
def('escritorio_pc', { name: 'Escritorio', fw: 3, w: 48, h: 32, draw(k, o) {
  I.escritorio.draw(k); // offset: escritorio ocupa 26 px; subimos todo 6 px
  const g = k.g, tmp = mk(48, 32); I.escritorio.draw(tmp); g.clearRect(0, 0, 48, 32); g.drawImage(tmp.c, 0, 6);
  // monitor doble
  k.r(14, 2, 20, 12, '#1a1c21').r(15, 3, 18, 9, '#2b4c7e').r(15, 3, 18, 2, '#4f7fc2').r(17, 6, 9, 1, '#9fd3ff').r(17, 8, 12, 1, '#e6f03b').r(17, 10, 6, 1, '#9fd3ff').r(22, 14, 4, 2, '#2a2d33').r(19, 15, 10, 1, '#2a2d33');
  k.r(16, 18, 14, 3, '#2a2d33').r(17, 19, 12, 1, '#555b66'); // teclado
  k.r(34, 18, 3, 3, '#f4f4f2').p(37, 19, '#f4f4f2').p(35, 18, '#6e4122'); // taza
  k.r(5, 15, 6, 5, '#f4f4f2').r(6, 16, 4, 1, '#c9ccd2').r(6, 18, 3, 1, '#c9ccd2'); // papeles
  if (o && o.lamp) k.r(41, 9, 2, 10, '#2a2d33').r(38, 7, 7, 3, o.lamp);
}});
def('silla', { name: 'Silla', w: 16, h: 20, block: false, shop: true, draw(k, o) {
  const c = (o && o.color) || '#2a2d33';
  k.r(3, 1, 10, 9, c).r(4, 2, 8, 1, shade(c, .25)).r(2, 10, 12, 4, shade(c, .1)).r(7, 14, 2, 3, '#555b66').r(3, 17, 10, 1, '#555b66').p(3, 18, '#111').p(12, 18, '#111').p(7, 18, '#111');
}});
def('planta', { name: 'Planta', w: 16, h: 22, shop: true, draw(k) {
  k.r(4, 14, 8, 7, '#c86b3c').r(4, 14, 8, 2, '#e08552').r(5, 20, 6, 1, '#8e4a28');
  k.ell(8, 9, 6, 5, '#2f8a4e').ell(5, 6, 3, 3, '#3fa45e').ell(11, 7, 3, 3, '#3fa45e').ell(8, 3, 3, 3, '#52bd70').p(6, 5, '#7fdb95').p(10, 4, '#7fdb95');
}});
def('planta_grande', { name: 'Palmera', w: 24, h: 36, shop: true, draw(k) {
  k.r(7, 26, 10, 9, '#e8e4dc').r(7, 26, 10, 2, '#fff').r(8, 34, 8, 1, '#b8b2a6');
  k.r(11, 12, 2, 15, '#7a5a3a');
  [[-8, -2], [8, -2], [-6, -6], [6, -6], [0, -9], [-9, 3], [9, 3]].forEach(([dx, dy], i) => { const c = i % 2 ? '#2f8a4e' : '#3fa45e'; for (let s = 0; s < 6; s++) k.r(12 + Math.round(dx * s / 6) - 1, 12 + Math.round(dy * s / 6), 3, 2, c); });
  k.ell(12, 11, 3, 2, '#52bd70');
}});
def('bonsai', { name: 'Bonsái', w: 16, h: 16, shop: true, draw(k) {
  k.r(3, 11, 10, 4, '#3a3f48').r(3, 11, 10, 1, '#5b6573'); k.r(7, 6, 2, 5, '#6e4122'); k.ell(5, 6, 3, 2, '#3fa45e').ell(11, 5, 3, 2, '#2f8a4e').ell(8, 3, 3, 2, '#52bd70');
}});
def('sofa', { name: 'Sofá', fw: 3, w: 48, h: 26, shop: true, draw(k, o) {
  const c = (o && o.color) || '#4a5568', d = shade(c, -.25), l = shade(c, .18);
  k.rr(1, 2, 46, 12, d, 2).r(3, 3, 42, 2, c).r(1, 10, 46, 12, c).r(4, 12, 19, 7, l).r(25, 12, 19, 7, l).r(4, 12, 19, 1, shade(l, .15)).r(25, 12, 19, 1, shade(l, .15)).r(1, 8, 5, 14, d).r(42, 8, 5, 14, d).r(3, 22, 2, 3, '#1d1a1a').r(43, 22, 2, 3, '#1d1a1a');
}});
def('puff', { name: 'Puff', w: 16, h: 16, shop: true, draw(k, o) { const c = (o && o.color) || '#e6f03b'; k.ell(8, 9, 6, 5, shade(c, -.2)).ell(8, 8, 6, 4, c).ell(7, 6, 3, 1, shade(c, .3)); }});
def('estanteria', { name: 'Estantería', fw: 2, w: 32, h: 36, shop: true, draw(k) {
  k.r(1, 1, 30, 34, WOODD).r(3, 3, 26, 30, '#2b1d14');
  const r = rnd(7), cols = ['#d7262e', '#2c5bd6', '#e6f03b', '#1f7a4a', '#f4f4f2', '#7c3aed', '#f08a24'];
  [3, 13, 23].forEach(y => { k.r(3, y + 8, 26, 2, WOOD); let x = 4; while (x < 27) { const w = 2 + Math.floor(r() * 2), h = 5 + Math.floor(r() * 3); k.r(x, y + 8 - h, w, h, cols[Math.floor(r() * cols.length)]); x += w + (r() < .2 ? 2 : 0); } });
  k.r(1, 1, 30, 1, WOODL);
}});
def('mesa', { name: 'Mesa café', fw: 2, w: 32, h: 18, shop: true, draw(k) {
  k.rr(1, 3, 30, 9, '#c9a96e', 2).r(3, 4, 26, 1, '#e6cf98').r(2, 12, 28, 2, '#8e7344').r(3, 14, 2, 3, '#2a2d33').r(27, 14, 2, 3, '#2a2d33');
  k.r(8, 5, 4, 3, '#f4f4f2').r(18, 6, 7, 2, '#2c5bd6');
}});
def('monitor', { name: 'Monitor', w: 16, h: 26, shop: true, draw(k) {
  k.r(1, 2, 14, 11, '#1a1c21').r(2, 3, 12, 8, '#163a5c').r(3, 4, 6, 1, '#9fd3ff').r(3, 6, 9, 1, '#e6f03b').r(3, 8, 5, 1, '#9fd3ff').r(7, 13, 2, 9, '#2a2d33').r(3, 22, 10, 2, '#2a2d33');
}});
def('tv', { name: 'Pantalla', fw: 2, w: 32, h: 28, shop: true, draw(k) {
  k.r(0, 1, 32, 18, '#111215').r(2, 3, 28, 14, '#0e1726');
  for (let i = 0; i < 6; i++) k.r(4 + i * 4, 15 - (i * 7 % 9) - 2, 3, (i * 7 % 9) + 2, i % 2 ? '#e6f03b' : '#9fd3ff');
  k.r(14, 19, 4, 4, '#2a2d33').r(6, 23, 20, 4, WOODD).r(6, 23, 20, 1, WOOD);
}});
def('servidor', { name: 'Servidor', w: 16, h: 32, shop: true, draw(k) {
  k.r(1, 1, 14, 30, '#1a1c21').r(2, 2, 12, 28, '#24272e');
  for (let y = 4; y < 28; y += 4) { k.r(3, y, 10, 3, '#111215'); k.p(4, y + 1, y % 8 ? '#3ddc84' : '#e6f03b').p(6, y + 1, '#3ddc84').r(9, y + 1, 3, 1, '#3a3f48'); }
}});
def('arcade', { name: 'Arcade', w: 16, h: 34, shop: true, draw(k) {
  k.r(1, 6, 14, 27, '#2c2f8a').r(1, 6, 2, 27, '#3c40b5').r(2, 2, 12, 5, '#16171b').r(3, 3, 10, 3, '#e6f03b');
  k.r(3, 9, 10, 9, '#0b0b0d').r(4, 10, 8, 7, '#163a5c').r(5, 12, 2, 2, '#e6f03b').r(9, 13, 2, 2, '#d7262e').r(5, 15, 6, 1, '#3ddc84');
  k.r(1, 19, 14, 4, '#1d1f60').p(4, 20, '#d7262e').p(5, 21, '#111').p(9, 20, '#3ddc84').p(11, 20, '#e6f03b');
}});
def('cafetera', { name: 'Cafetera', w: 16, h: 28, shop: true, draw(k) {
  k.r(0, 14, 16, 13, WOODD).r(0, 14, 16, 2, WOOD).r(2, 2, 12, 12, '#2a2d33').r(3, 3, 10, 3, '#c9ccd2').r(4, 7, 8, 1, '#111').r(6, 8, 4, 2, '#5b6573').r(6, 11, 4, 3, '#f4f4f2').p(10, 4, '#d7262e').p(12, 4, '#3ddc84');
}});
def('dispensador', { name: 'Dispensador', w: 16, h: 28, shop: true, draw(k) {
  k.rr(4, 1, 8, 9, '#7fc4f5', 2).r(5, 2, 2, 6, '#c8e8ff').r(3, 10, 10, 17, '#e8e4dc').r(3, 10, 2, 17, '#fff').r(6, 13, 2, 2, '#2c5bd6').r(9, 13, 2, 2, '#d7262e').r(5, 17, 6, 1, '#b8b2a6');
}});
def('maquina_snacks', { name: 'Snacks', fw: 2, w: 32, h: 36, shop: true, draw(k) {
  k.r(1, 1, 30, 34, '#b8232a').r(1, 1, 30, 2, '#d7262e').r(3, 4, 19, 26, '#0e1726');
  const cols = ['#e6f03b', '#f08a24', '#3ddc84', '#9fd3ff', '#e85b9c'];
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) k.r(4 + x * 5, 6 + y * 6, 3, 4, cols[(x + y) % 5]);
  k.r(24, 6, 5, 8, '#111215').r(25, 7, 3, 2, '#3ddc84').r(3, 31, 19, 3, '#111215').r(24, 18, 5, 2, '#f4f4f2');
}});
def('pecera', { name: 'Pecera', fw: 2, w: 32, h: 28, shop: true, draw(k) {
  k.r(1, 16, 30, 11, WOODD).r(1, 16, 30, 2, WOOD).r(2, 1, 28, 15, '#1e6fa8').r(2, 1, 28, 2, '#9fd3ff').r(3, 12, 26, 3, '#c9a96e');
  k.r(6, 6, 4, 2, '#f08a24').p(5, 6, '#f08a24').r(18, 9, 4, 2, '#e6f03b').p(22, 9, '#e6f03b').r(24, 4, 3, 2, '#e85b9c').r(12, 7, 1, 6, '#3fa45e').r(14, 9, 1, 4, '#2f8a4e').p(26, 7, '#c8e8ff').p(9, 4, '#c8e8ff');
}});
def('lampara', { name: 'Lámpara', w: 16, h: 34, shop: true, draw(k) {
  k.r(7, 9, 2, 22, '#2a2d33').r(4, 31, 8, 2, '#2a2d33').rr(3, 1, 10, 9, '#f4e2b8', 2).r(4, 2, 8, 2, '#fff6dc');
}});
def('alfombra', { name: 'Alfombra', fw: 3, fh: 2, w: 48, h: 32, block: false, flat: true, shop: true, draw(k, o) {
  const c = (o && o.color) || '#7a2f3a';
  k.r(1, 1, 46, 30, c).r(3, 3, 42, 26, shade(c, -.2)).r(5, 5, 38, 22, c).r(1, 1, 46, 1, shade(c, .2));
  for (let x = 8; x < 40; x += 6) k.r(x, 14, 3, 3, shade(c, .3));
}});
def('cuadro', { name: 'Cuadro', w: 16, h: 26, shop: true, draw(k) {
  k.r(7, 15, 2, 10, WOODD).r(3, 23, 10, 2, WOODD).r(1, 1, 14, 15, '#c9a96e').r(2, 2, 12, 13, '#163a5c').r(3, 9, 10, 5, '#3fa45e').ell(10, 5, 2, 2, '#e6f03b').r(4, 7, 3, 2, '#f4f4f2');
}});
def('neon', { name: 'Neón Ruedda', fw: 2, w: 32, h: 30, shop: true, glow: '#e6f03b', draw(k) {
  k.r(14, 20, 4, 8, '#2a2d33').r(8, 27, 16, 2, '#2a2d33').r(1, 1, 30, 19, '#111215');
  // bandera de cuadros (isotipo) en neón
  for (let y = 0; y < 4; y++) for (let x = 0; x < 6; x++) if ((x + y) % 2 === 0) k.r(4 + x * 4, 3 + y * 4, 4, 4, '#e6f03b');
}});
def('trofeo', { name: 'Trofeo', w: 16, h: 28, shop: true, draw(k) {
  k.r(3, 20, 10, 7, '#2a2d33').r(3, 20, 10, 1, '#5b6573').r(6, 16, 4, 4, '#c99a1e').rr(3, 3, 10, 10, '#f2c230', 2).r(4, 4, 3, 6, '#fff1a0').r(1, 5, 2, 5, '#f2c230').r(13, 5, 2, 5, '#f2c230').r(5, 13, 6, 3, '#e0ab22').r(6, 23, 4, 1, '#e6f03b');
}});
def('estatua_oro', { name: 'Estatua de oro', fw: 2, w: 32, h: 34, shop: true, draw(k) {
  k.r(3, 22, 26, 11, '#1a1c21').r(3, 22, 26, 2, '#3a3f48').r(10, 27, 12, 2, '#c99a1e');
  // auto dorado de perfil
  k.rr(2, 11, 28, 8, '#f2c230', 2).rr(9, 6, 13, 6, '#e0ab22', 2).r(11, 7, 4, 4, '#fff1a0').r(16, 7, 4, 4, '#fff1a0').ell(8, 19, 3, 3, '#8e6a12').ell(24, 19, 3, 3, '#8e6a12').r(3, 12, 26, 1, '#fff1a0');
}});

/* ── más muebles ── */
def('flores', { name: 'Flores', w: 16, h: 18, shop: true, draw(k) {
  k.r(4, 11, 8, 6, '#e8e4dc').r(4, 11, 8, 1, '#fff'); k.r(7, 5, 1, 6, '#2f8a4e').r(9, 6, 1, 5, '#2f8a4e').r(5, 7, 1, 4, '#2f8a4e');
  [[7, 3, '#ff3d8b'], [10, 4, '#e6f03b'], [4, 5, '#a855f7'], [8, 6, '#f08a24']].forEach(([x, y, c]) => k.r(x - 1, y - 1, 3, 3, c).p(x, y, '#fff6c8'));
}});
def('cactus', { name: 'Cactus', w: 16, h: 20, shop: true, draw(k) {
  k.r(4, 14, 8, 5, '#c86b3c').r(4, 14, 8, 1, '#e08552'); k.rr(6, 3, 4, 11, '#3fa45e', 1).r(3, 7, 3, 2, '#3fa45e').r(3, 5, 2, 3, '#3fa45e').r(10, 8, 3, 2, '#3fa45e').r(11, 5, 2, 4, '#3fa45e');
  [[7, 5], [8, 9], [7, 12], [4, 6], [12, 6]].forEach(([x, y]) => k.p(x, y, '#c8f0c8')); k.r(7, 2, 2, 1, '#ff3d8b');
}});
def('palmera_neon', { name: 'Palmera neón', w: 24, h: 36, shop: true, glow: '#22d3ee', draw(k) {
  k.r(8, 30, 8, 5, '#111215'); k.r(11, 12, 2, 18, '#e85b9c');
  [[-8, -2], [8, -2], [-6, -6], [6, -6], [0, -9]].forEach(([dx, dy]) => { for (let s = 0; s < 6; s++) k.r(12 + Math.round(dx * s / 6) - 1, 12 + Math.round(dy * s / 6), 2, 1, '#22d3ee'); });
}});
def('sillon_gamer', { name: 'Silla gamer', w: 16, h: 24, block: false, shop: true, draw(k) {
  k.rr(3, 0, 10, 14, '#16171b', 2).r(5, 2, 6, 10, '#d7262e').r(7, 2, 2, 10, '#16171b').r(2, 13, 12, 5, '#16171b').r(3, 14, 10, 2, '#d7262e').r(7, 18, 2, 3, '#5b6573').r(3, 21, 10, 1, '#5b6573');
}});
def('banca', { name: 'Banca', fw: 2, w: 32, h: 18, block: false, shop: true, draw(k) {
  k.r(1, 4, 30, 3, WOODL).r(1, 8, 30, 3, WOODL).r(1, 7, 30, 1, WOODD).r(3, 11, 2, 6, '#2a2d33').r(27, 11, 2, 6, '#2a2d33');
}});
def('standing', { name: 'Escritorio de pie', fw: 2, w: 32, h: 30, shop: true, draw(k) {
  k.r(1, 10, 30, 5, '#e8e4dc').r(1, 10, 30, 1, '#fff').r(4, 15, 2, 14, '#5b6573').r(26, 15, 2, 14, '#5b6573').r(2, 28, 28, 2, '#2a2d33');
  k.r(10, 1, 12, 9, '#1a1c21').r(11, 2, 10, 6, '#2b4c7e').r(12, 4, 6, 1, '#e6f03b');
}});
def('archivador', { name: 'Archivador', w: 16, h: 26, shop: true, draw(k) {
  k.r(1, 1, 14, 24, '#9aa0a6').r(1, 1, 14, 1, '#c9ccd2'); [3, 11, 19].forEach(y => k.r(2, y, 12, 6, '#8f959b').r(6, y + 2, 4, 1, '#2a2d33'));
}});
def('impresora', { name: 'Impresora', w: 16, h: 16, shop: true, draw(k) {
  k.r(1, 6, 14, 8, '#e8e4dc').r(1, 6, 14, 1, '#fff').r(3, 2, 10, 5, '#f4f4f2').r(3, 11, 10, 2, '#2a2d33').p(12, 8, '#3ddc84');
}});
def('globo', { name: 'Globo terráqueo', w: 16, h: 22, shop: true, draw(k) {
  k.ell(8, 8, 6, 6, '#2c5bd6').r(5, 5, 3, 3, '#3fa45e').r(9, 9, 3, 2, '#3fa45e').r(10, 4, 2, 2, '#3fa45e').r(7, 15, 2, 4, '#c99a1e').r(4, 19, 8, 2, '#5e3c27');
}});
def('billar', { name: 'Mesa de billar', fw: 4, fh: 2, w: 64, h: 36, shop: true, draw(k) {
  k.rr(1, 2, 62, 28, '#5e3c27', 3).r(5, 6, 54, 20, '#1f7a4a').r(5, 6, 54, 1, '#2f9a5e');
  [[5, 6], [31, 5], [57, 6], [5, 24], [31, 25], [57, 24]].forEach(([x, y]) => k.r(x, y, 3, 2, '#0b0b0d'));
  [[20, 14, '#f4f4f2'], [40, 12, '#e6f03b'], [43, 15, '#d7262e'], [42, 18, '#2c5bd6'], [46, 14, '#111215']].forEach(([x, y, c]) => k.r(x, y, 2, 2, c));
  k.r(8, 20, 24, 1, '#c9a96e').r(4, 30, 3, 5, '#3a2a1f').r(57, 30, 3, 5, '#3a2a1f');
}});
def('futbolito', { name: 'Futbolito', fw: 3, w: 48, h: 28, shop: true, draw(k) {
  k.r(2, 4, 44, 18, '#5e3c27').r(5, 6, 38, 14, '#2f8a4e').r(24, 6, 1, 14, '#f4f4f2');
  for (let i = 0; i < 6; i++) { const x = 9 + i * 6; k.r(x, 2, 1, 22, '#c9ccd2'); k.r(x - 1, 9 + (i % 2) * 4, 3, 3, i < 3 ? '#d7262e' : '#2c5bd6'); }
  k.r(4, 22, 3, 5, '#3a2a1f').r(41, 22, 3, 5, '#3a2a1f');
}});
def('piano', { name: 'Piano', fw: 3, fh: 2, w: 48, h: 34, shop: true, draw(k) {
  k.rr(2, 2, 44, 22, '#111215', 6).r(4, 4, 30, 2, '#2a2d33').r(6, 20, 36, 6, '#f4f4f2');
  for (let x = 7; x < 42; x += 3) k.r(x, 20, 1, 6, '#9aa0a6'); for (let x = 8; x < 41; x += 6) k.r(x, 20, 2, 3, '#111215');
  k.r(16, 28, 16, 4, '#2a2d33');
}});
def('bici', { name: 'Bici estática', w: 16, h: 24, shop: true, draw(k) {
  k.r(3, 20, 11, 2, '#2a2d33').r(6, 8, 2, 12, '#d7262e').r(4, 6, 6, 2, '#16171b').r(10, 4, 2, 10, '#d7262e').r(9, 3, 5, 2, '#16171b').ell(9, 17, 3, 3, '#5b6573');
}});
def('nevera', { name: 'Nevera', w: 16, h: 32, shop: true, draw(k) {
  k.rr(1, 1, 14, 30, '#e8e4dc', 2).r(1, 12, 14, 1, '#b8b2a6').r(12, 4, 1, 6, '#9aa0a6').r(12, 15, 1, 10, '#9aa0a6').r(3, 4, 3, 3, '#e6f03b').r(4, 17, 2, 2, '#ff3d8b');
}});
def('microondas', { name: 'Microondas', w: 16, h: 14, shop: true, draw(k) {
  k.r(1, 3, 14, 10, '#2a2d33').r(2, 4, 9, 8, '#111215').r(3, 5, 6, 5, '#3a3f48').r(12, 5, 2, 1, '#3ddc84').r(12, 8, 2, 3, '#9aa0a6');
}});
def('flotador', { name: 'Flotador', w: 16, h: 12, block: false, flat: true, shop: true, draw(k) {
  k.ell(8, 6, 7, 5, '#ff3d8b').ell(8, 6, 3, 2, 'rgba(0,0,0,0)'); k.g.clearRect(6, 5, 5, 3); [[2, 4], [12, 7], [7, 1], [8, 10]].forEach(([x, y]) => k.r(x, y, 2, 2, '#ffffff'));
}});
def('reloj_pie', { name: 'Reloj de pie', w: 16, h: 36, shop: true, draw(k) {
  k.rr(2, 1, 12, 34, '#5e3c27', 2).ell(8, 8, 4, 4, '#fbf7ea').p(8, 6, '#16171b').p(9, 8, '#16171b').r(5, 15, 6, 15, '#3a2a1f').r(7, 17, 2, 9, '#c99a1e').ell(8, 26, 2, 2, '#f2c230');
}});
def('poster', { name: 'Póster Ruedda', w: 16, h: 24, shop: true, draw(k) {
  k.r(1, 1, 14, 20, '#16171b').r(2, 2, 12, 18, '#e6f03b'); for (let y = 0; y < 4; y++) for (let x = 0; x < 3; x++) if ((x + y) % 2 === 0) k.r(4 + x * 3, 5 + y * 3, 3, 3, '#16171b');
  k.r(7, 21, 2, 3, '#5b6573');
}});
def('extintor', { name: 'Extintor', w: 16, h: 18, shop: true, draw(k) { k.rr(5, 4, 6, 13, '#d7262e', 2).r(6, 2, 4, 2, '#16171b').r(10, 2, 3, 1, '#16171b').r(6, 9, 4, 3, '#f4f4f2'); }});
def('telescopio', { name: 'Telescopio', w: 16, h: 26, shop: true, draw(k) {
  k.r(7, 13, 2, 11, '#5b6573').r(3, 23, 10, 1, '#5b6573').r(4, 20, 1, 3, '#5b6573').r(11, 20, 1, 3, '#5b6573');
  for (let i = 0; i < 9; i++) k.r(3 + i, 13 - i, 3, 3, i < 2 ? '#c99a1e' : '#e8e4dc'); k.r(12, 2, 3, 3, '#9fd3ff');
}});

/* ── carros y carreras ── */
const CHK = (k, x, y, w, h, s, a, b) => { for (let yy = 0; yy < h; yy += s) for (let xx = 0; xx < w; xx += s) k.r(x + xx, y + yy, Math.min(s, w - xx), Math.min(s, h - yy), ((xx + yy) / s) % 2 ? a : b); };
def('llantas', { name: 'Pila de llantas', w: 16, h: 24, shop: true, draw(k) {
  [16, 10, 4].forEach((y, i) => { k.rr(1, y, 14, 7, '#16171b', 2).r(3, y + 2, 10, 3, '#2a2d33').r(5, y + 3, 6, 1, i === 1 ? '#e6f03b' : '#3a3f48'); });
}});
def('cono', { name: 'Cono', w: 16, h: 16, block: true, shop: true, draw(k) {
  k.r(2, 13, 12, 2, '#d75a1e'); for (let i = 0; i < 10; i++) k.r(8 - Math.ceil(i / 2.2), 3 + i, Math.ceil(i / 2.2) * 2 + 1, 1, i === 4 || i === 5 ? '#f4f4f2' : '#f08a24');
}});
def('bandera', { name: 'Bandera a cuadros', w: 16, h: 32, shop: true, draw(k) {
  k.r(2, 2, 1, 29, '#9aa0a6').r(1, 30, 4, 2, '#2a2d33'); CHK(k, 3, 3, 12, 9, 3, '#16171b', '#f4f4f2'); k.r(3, 3, 12, 1, '#f4f4f2');
}});
def('semaforo', { name: 'Semáforo de largada', w: 16, h: 36, shop: true, draw(k) {
  k.r(7, 14, 2, 20, '#5b6573').r(4, 33, 8, 2, '#2a2d33').rr(2, 1, 12, 14, '#16171b', 2);
  for (let i = 0; i < 3; i++) k.ell(8, 4 + i * 4, 1, 1, i === 2 ? '#3ddc84' : '#ff2d3d');
}});
def('surtidor', { name: 'Surtidor de gasolina', w: 16, h: 30, shop: true, draw(k) {
  k.rr(2, 3, 11, 25, '#d7262e', 2).r(2, 3, 11, 2, '#ff5a5f').r(4, 6, 7, 5, '#0e1726').r(5, 7, 5, 1, '#3ddc84').r(5, 9, 3, 1, '#3ddc84').r(4, 13, 7, 3, '#f4f4f2').r(13, 10, 2, 10, '#16171b').r(13, 19, 3, 2, '#2a2d33').r(1, 28, 13, 2, '#3a3f48');
}});
def('kart', { name: 'Kart', fw: 2, w: 32, h: 20, shop: true, draw(k) {
  k.ell(6, 15, 4, 4, '#111215').ell(26, 15, 4, 4, '#111215').ell(6, 15, 1, 1, '#9aa0a6').ell(26, 15, 1, 1, '#9aa0a6');
  k.rr(3, 9, 26, 6, '#e6f03b', 2).r(10, 6, 9, 4, '#16171b').r(12, 2, 5, 5, '#d7262e').r(13, 3, 3, 2, '#9fd3ff').r(22, 7, 2, 3, '#2a2d33').r(1, 11, 3, 2, '#16171b').r(29, 10, 2, 3, '#d7262e');
}});
def('moto', { name: 'Moto deportiva', fw: 2, w: 32, h: 22, shop: true, draw(k) {
  k.ell(6, 16, 5, 5, '#111215').ell(26, 16, 5, 5, '#111215').ell(6, 16, 2, 2, '#5b6573').ell(26, 16, 2, 2, '#5b6573');
  k.r(8, 11, 16, 4, '#2c5bd6').rr(10, 6, 14, 6, '#2c5bd6', 2).r(12, 5, 7, 3, '#16171b').r(22, 4, 4, 4, '#9fd3ff').r(24, 8, 3, 5, '#16171b').r(4, 12, 6, 2, '#5b6573').r(13, 9, 9, 1, '#f4f4f2');
}});
def('casco', { name: 'Casco en vitrina', w: 16, h: 28, shop: true, draw(k) {
  k.r(2, 18, 12, 9, '#16171b').r(2, 18, 12, 1, '#3a3f48').r(2, 2, 12, 16, 'rgba(159,211,255,.25)').r(2, 2, 12, 1, '#c8e8ff').r(2, 2, 1, 16, '#c8e8ff');
  k.rr(4, 7, 9, 9, '#d7262e', 3).r(6, 10, 7, 3, '#16171b').r(7, 10, 4, 1, '#5b6573').r(4, 8, 6, 1, '#f4f4f2');
}});
def('motor_v8', { name: 'Motor V8', fw: 2, w: 32, h: 22, shop: true, draw(k) {
  k.r(2, 16, 28, 5, '#2a2d33').rr(4, 6, 24, 11, '#5b6573', 2).r(6, 3, 8, 5, '#d7262e').r(18, 3, 8, 5, '#d7262e');
  for (let i = 0; i < 4; i++) k.r(7 + i * 2, 4, 1, 3, '#16171b').r(19 + i * 2, 4, 1, 3, '#16171b');
  k.r(13, 1, 6, 4, '#c9ccd2').r(5, 10, 22, 1, '#9aa0a6').r(9, 13, 14, 2, '#c99a1e');
}});
def('simulador', { name: 'Simulador de carreras', fw: 2, fh: 2, w: 32, h: 34, shop: true, draw(k) {
  k.r(2, 30, 28, 3, '#2a2d33').r(3, 1, 26, 12, '#111215').r(4, 2, 24, 10, '#163a5c').r(4, 9, 24, 3, '#3a3f48').r(14, 6, 4, 3, '#e6f03b').r(9, 7, 3, 1, '#f4f4f2').r(20, 7, 3, 1, '#f4f4f2');
  k.r(14, 13, 4, 6, '#2a2d33').ell(16, 17, 4, 3, '#16171b').ell(16, 17, 2, 1, '#d7262e');
  k.rr(9, 20, 14, 11, '#d7262e', 2).r(11, 22, 10, 7, '#16171b').r(15, 22, 2, 7, '#d7262e');
}});
def('herramientas', { name: 'Caja de herramientas', w: 16, h: 14, shop: true, draw(k) {
  k.r(1, 5, 14, 8, '#d7262e').r(1, 5, 14, 1, '#ff5a5f').r(1, 9, 14, 1, '#8e1230').r(5, 2, 6, 3, '#2a2d33').r(6, 3, 4, 1, '#d7262e').r(7, 7, 2, 1, '#c9ccd2');
}});
def('gato', { name: 'Gato hidráulico', w: 16, h: 12, block: false, shop: true, draw(k) {
  k.r(1, 7, 12, 3, '#d7262e').r(1, 7, 12, 1, '#ff5a5f').ell(2, 10, 1, 1, '#111215').ell(11, 10, 1, 1, '#111215').r(9, 2, 2, 6, '#9aa0a6').r(8, 2, 5, 1, '#5b6573').r(12, 4, 3, 1, '#16171b');
}});
def('barril_aceite', { name: 'Barril de aceite', w: 16, h: 22, shop: true, draw(k) {
  k.rr(2, 2, 12, 19, '#1f4a8a', 2).r(2, 6, 12, 1, '#16336a').r(2, 15, 12, 1, '#16336a').r(5, 9, 6, 4, '#e6f03b').r(6, 10, 4, 2, '#16171b').ell(8, 2, 5, 1, '#2c5bd6');
}});
def('trofeo_copa', { name: 'Copa de campeón', w: 16, h: 32, shop: true, draw(k) {
  k.r(3, 26, 10, 5, '#16171b').r(3, 26, 10, 1, '#3a3f48').r(6, 22, 4, 4, '#c99a1e').r(7, 17, 2, 5, '#e0ab22').rr(2, 3, 12, 14, '#f2c230', 3).r(3, 4, 4, 10, '#fff1a0').r(0, 5, 2, 7, '#f2c230').r(14, 5, 2, 7, '#f2c230').r(5, 28, 6, 1, '#e6f03b');
}});
def('letrero_racing', { name: 'Letrero Ruedda Motorsport', fw: 3, w: 48, h: 28, shop: true, glow: '#e6f03b', draw(k) {
  k.r(6, 20, 2, 7, '#2a2d33').r(40, 20, 2, 7, '#2a2d33').r(0, 1, 48, 20, '#111215').r(1, 2, 46, 18, '#16171b'); CHK(k, 1, 2, 46, 3, 3, '#16171b', '#f4f4f2');
  const t1 = A.pixelText('RUEDDA', '#e6f03b', 1), t2 = A.pixelText('MOTORSPORT', '#f4f4f2', 1); k.g.drawImage(t1, 24 - Math.floor(t1.width / 2), 7); k.g.drawImage(t2, 24 - Math.floor(t2.width / 2), 14);
}});
def('auto_mini', { name: 'Auto de colección', fw: 4, fh: 2, w: 68, h: 36, shop: true, noOutline: true, draw(k) { k.g.drawImage(A.car('#e6f03b', 'super'), 0, 0); }});
/* ── pisos (planos, se pueden rotar) ── */
def('piso_meta', { name: 'Línea de meta (piso)', fw: 4, w: 64, h: 16, block: false, flat: true, shop: true, draw(k) { CHK(k, 0, 0, 64, 16, 4, '#16171b', '#f4f4f2'); }});
def('piso_cuadros', { name: 'Piso a cuadros', fw: 3, fh: 3, w: 48, h: 48, block: false, flat: true, shop: true, draw(k) { CHK(k, 0, 0, 48, 48, 8, '#16171b', '#e8e4dc'); k.r(0, 0, 48, 1, 'rgba(255,255,255,.15)'); }});
def('piso_ruedda', { name: 'Tapete Ruedda', fw: 3, fh: 2, w: 48, h: 32, block: false, flat: true, shop: true, draw(k) {
  k.r(0, 0, 48, 32, '#16171b').r(2, 2, 44, 28, '#e6f03b').r(4, 4, 40, 24, '#16171b'); CHK(k, 16, 8, 16, 16, 4, '#e6f03b', '#16171b');
}});
def('piso_persa', { name: 'Alfombra persa', fw: 3, fh: 2, w: 48, h: 32, block: false, flat: true, shop: true, draw(k) {
  k.r(0, 0, 48, 32, '#5c1630').r(2, 2, 44, 28, '#8e1230').r(5, 5, 38, 22, '#2a3d8f').r(8, 8, 32, 16, '#8e1230').ell(24, 16, 8, 5, '#c99a1e').ell(24, 16, 4, 2, '#2a3d8f');
  for (let x = 4; x < 46; x += 4) k.p(x, 3, '#f2c230').p(x, 28, '#f2c230');
}});
def('piso_redondo', { name: 'Tapete redondo', fw: 2, fh: 2, w: 32, h: 32, block: false, flat: true, shop: true, draw(k) { k.ell(16, 16, 15, 15, '#3fa45e').ell(16, 16, 12, 12, '#f4f4f2').ell(16, 16, 9, 9, '#3fa45e').ell(16, 16, 5, 5, '#e6f03b'); }});
def('piso_pista', { name: 'Tramo de pista', fw: 4, fh: 2, w: 64, h: 32, block: false, flat: true, shop: true, draw(k) {
  k.r(0, 0, 64, 32, '#2a2d33'); for (let x = 0; x < 64; x += 8) { k.r(x, 0, 4, 3, '#d7262e').r(x + 4, 0, 4, 3, '#f4f4f2').r(x, 29, 4, 3, '#f4f4f2').r(x + 4, 29, 4, 3, '#d7262e'); }
  for (let x = 2; x < 64; x += 12) k.r(x, 15, 7, 2, '#e6f03b');
}});
def('piso_flechas', { name: 'Flechas de pista', fw: 2, w: 32, h: 16, block: false, flat: true, shop: true, draw(k) {
  k.r(0, 0, 32, 16, '#2a2d33'); [3, 13, 23].forEach(x => { for (let i = 0; i < 5; i++) k.r(x + i, 3 + i, 2, 1, '#e6f03b').r(x + i, 12 - i, 2, 1, '#e6f03b'); });
}});
def('piso_madera', { name: 'Parqué', fw: 3, fh: 3, w: 48, h: 48, block: false, flat: true, shop: true, draw(k) {
  for (let y = 0; y < 48; y += 8) for (let x = 0; x < 48; x += 8) { const v = ((x + y) / 8) % 2; if (v) for (let i = 0; i < 8; i += 2) k.r(x, y + i, 8, 2, i % 4 ? '#a8734e' : '#8a5a3c'); else for (let i = 0; i < 8; i += 2) k.r(x + i, y, 2, 8, i % 4 ? '#a8734e' : '#8a5a3c'); }
}});

/* ── Kenney (CC0, kenney.nl: Roguelike Indoors + Tiny Town) → /office/kenney.png ── */
A.KENNEY = {"k_maceta": [0, 0, 1, 1, "Maceta tropical", 1, 0], "k_maceta2": [17, 0, 1, 1, "Maceta azul", 1, 0], "k_arbusto": [34, 0, 1, 1, "Arbusto", 1, 0], "k_brote": [51, 0, 1, 1, "Brote", 0, 0], "k_hongos": [68, 0, 1, 1, "Hongos", 0, 0], "k_arbol": [85, 0, 1, 1, "Arbolito", 1, 0], "k_arbol_otono": [102, 0, 1, 1, "Arbolito de otoño", 1, 0], "k_arbol_alto": [119, 0, 1, 2, "Árbol alto", 1, 0], "k_arbol_alto_otono": [136, 0, 1, 2, "Árbol de otoño", 1, 0], "k_tapete": [153, 0, 2, 1, "Tapete naranja", 0, 1], "k_tapete_verde": [186, 0, 3, 1, "Tapete verde", 0, 1], "k_cuadro_oro": [235, 0, 1, 1, "Cuadro dorado", 1, 0], "k_retrato": [252, 0, 1, 1, "Retrato", 1, 0], "k_espejo": [269, 0, 1, 1, "Espejo", 1, 0], "k_jarron": [286, 0, 1, 1, "Jarrón dorado", 1, 0], "k_jarron_plata": [303, 0, 1, 1, "Jarrón plateado", 1, 0], "k_candelabro": [320, 0, 1, 1, "Candelabro", 1, 0], "k_escudo": [337, 0, 1, 1, "Escudo", 1, 0], "k_barra_bebidas": [354, 0, 2, 1, "Barra de bebidas", 1, 0], "k_estufa": [387, 0, 1, 1, "Cocina", 1, 0], "k_fregadero": [404, 0, 1, 1, "Fregadero", 1, 0], "k_vitrina": [421, 0, 1, 1, "Vitrina", 1, 0], "k_mesa_larga": [438, 0, 3, 1, "Mesa larga", 1, 0], "k_mesa_oval": [0, 33, 2, 1, "Mesa ovalada", 1, 0], "k_mesa_redonda": [33, 33, 1, 1, "Mesa redonda", 1, 0], "k_mesita": [50, 33, 1, 1, "Mesita de noche", 1, 0], "k_taburete": [67, 33, 1, 1, "Taburete", 0, 0], "k_silla_madera": [84, 33, 1, 1, "Silla de madera", 0, 0], "k_parlante": [101, 33, 1, 1, "Bocina", 1, 0], "k_barril": [118, 33, 1, 1, "Barril de agua", 1, 0], "k_letrero": [135, 33, 1, 1, "Letrero", 1, 0], "k_colmena": [152, 33, 1, 1, "Colmena", 1, 0]};
A.loadKenney = () => new Promise(res => {
  if (A._kimg) return res(A._kimg);
  const im = new Image(); im.onload = () => { A._kimg = im; res(im); }; im.onerror = () => res(null); im.src = '/office/kenney.png?v=1';
});
Object.entries(A.KENNEY).forEach(([key, [x, y, fw, fh, name, block, flat]]) => {
  def(key, { name, fw, fh, w: fw * 16, h: fh * 16, block: !!block, flat: !!flat, shop: true, kenney: true,
    draw(k) { if (A._kimg) k.g.drawImage(A._kimg, x, y, fw * 16, fh * 16, 0, 0, fw * 16, fh * 16); } });
});

/* ── fijos (no están en la tienda) ── */
def('mesa_juntas', { fw: 7, fh: 3, w: 112, h: 52, draw(k) {
  k.rr(2, 6, 108, 38, '#3a2a1f', 4).rr(4, 7, 104, 34, '#5c3f2a', 4).r(8, 9, 96, 1, '#7a5638');
  k.r(4, 41, 104, 6, '#2a1d14').r(10, 47, 4, 4, '#1d1a1a').r(98, 47, 4, 4, '#1d1a1a');
  k.r(48, 18, 16, 10, '#16171b').r(50, 20, 12, 6, '#e6f03b'); // centro con logo
  for (let i = 0; i < 5; i++) k.r(14 + i * 20, 12, 8, 5, '#f4f4f2');
}});
def('recepcion', { fw: 7, w: 112, h: 30, draw(k) {
  k.r(0, 6, 112, 8, '#e8e4dc').r(0, 6, 112, 1, '#fff').r(0, 13, 112, 1, '#b8b2a6').r(0, 14, 112, 14, '#16171b').r(0, 14, 112, 1, '#e6f03b');
  k.r(40, 18, 32, 6, '#e6f03b'); for (let i = 0; i < 8; i++) if (i % 2 === 0) k.r(41 + i * 4, 19, 3, 2, '#16171b'); else k.r(41 + i * 4, 21, 3, 2, '#16171b');
  k.r(14, 1, 12, 6, '#1a1c21').r(15, 2, 10, 4, '#2b4c7e').r(86, 2, 8, 5, '#3fa45e').r(88, 0, 4, 2, '#52bd70').r(60, 3, 6, 3, '#f4f4f2');
}});
def('panel', { fw: 1, w: 16, h: 16, draw(k) { k.r(0, 0, 16, 16, '#3a2a1f').r(0, 0, 16, 1, '#5c3f2a').r(7, 0, 1, 16, '#2a1d14').r(0, 15, 16, 1, '#1d140e'); }});
def('gong', { fw: 2, w: 32, h: 34, draw(k) {
  k.r(2, 4, 3, 28, '#5e3c27').r(27, 4, 3, 28, '#5e3c27').r(1, 2, 30, 4, '#b8232a').r(1, 2, 30, 1, '#d7262e').r(0, 31, 32, 2, '#3a2a1f');
  k.ell(16, 18, 9, 9, '#c99a1e').ell(16, 18, 7, 7, '#f2c230').ell(16, 18, 3, 3, '#e0ab22').r(12, 13, 3, 2, '#fff1a0').r(15, 6, 2, 4, '#2a2d33');
}});
def('pingpong', { fw: 4, fh: 2, w: 64, h: 36, draw(k) {
  k.r(2, 4, 60, 24, '#1f6b4a').r(2, 4, 60, 1, '#2f8a5e').r(2, 15, 60, 1, '#f4f4f2').r(31, 4, 2, 24, '#f4f4f2').r(2, 4, 1, 24, '#f4f4f2').r(61, 4, 1, 24, '#f4f4f2').r(2, 27, 60, 1, '#f4f4f2');
  k.r(31, 2, 2, 28, '#c9ccd2').r(2, 28, 60, 3, '#15503a').r(6, 31, 2, 4, '#2a2d33').r(56, 31, 2, 4, '#2a2d33').ell(18, 11, 1, 1, '#f08a24');
}});
def('barra', { fw: 6, w: 96, h: 30, draw(k) {
  k.r(0, 8, 96, 6, '#111215').r(0, 8, 96, 1, '#e85b9c').r(0, 14, 96, 15, '#1a1022').r(0, 14, 96, 1, '#7c3aed');
  for (let i = 0; i < 12; i++) k.r(4 + i * 8, 18, 4, 8, i % 3 ? '#2b1838' : '#3b2250');
  [[10, '#f2c230'], [22, '#3ddc84'], [34, '#e85b9c'], [62, '#f2c230'], [80, '#9fd3ff']].forEach(([x, c]) => k.r(x, 1, 3, 7, c).r(x + 1, 0, 1, 1, c));
  k.r(46, 2, 8, 6, '#f4f4f2').r(47, 3, 6, 1, '#f2c230');
}});
def('champan', { w: 16, h: 24, draw(k) {
  k.r(2, 18, 12, 5, '#c9ccd2').r(2, 18, 12, 1, '#fff');
  [[4, 14], [8, 14], [12, 14], [6, 9], [10, 9], [8, 4]].forEach(([x, y]) => k.r(x - 2, y, 4, 4, '#fff1a0').r(x - 1, y + 1, 2, 2, '#f2c230').p(x - 1, y + 4, '#c9ccd2'));
}});
def('dinero', { w: 16, h: 14, block: true, draw(k) {
  for (let i = 0; i < 4; i++) k.r(1 + (i % 2) * 2, 9 - i * 2, 12, 3, '#3fa45e').r(1 + (i % 2) * 2, 9 - i * 2, 12, 1, '#7fdb95').r(5 + (i % 2) * 2, 10 - i * 2, 3, 1, '#f2c230');
}});
def('sofa_vip', { fw: 3, w: 48, h: 26, draw(k) { I.sofa.draw(k, { color: '#8e1230' }); k.r(4, 12, 1, 1, '#f2c230').r(43, 12, 1, 1, '#f2c230'); }});
def('sofa_lobby', { fw: 3, w: 48, h: 26, draw(k) { I.sofa.draw(k, { color: '#2a2d33' }); }});
def('tumbona', { fw: 1, fh: 2, w: 16, h: 32, block: true, draw(k) { k.r(3, 2, 10, 10, '#f4f4f2').r(3, 2, 10, 1, '#fff').r(3, 12, 10, 18, '#e6f03b').r(3, 12, 10, 1, '#fff9a0'); for (let y = 14; y < 30; y += 4) k.r(3, y, 10, 1, '#c9d12c'); }});
def('parrilla', { fw: 2, w: 32, h: 28, draw(k) {
  k.r(2, 8, 28, 10, '#2a2d33').r(2, 8, 28, 1, '#5b6573').r(4, 10, 24, 6, '#111215');
  for (let x = 5; x < 27; x += 3) k.r(x, 10, 1, 6, '#5b6573');
  k.r(7, 11, 5, 3, '#8e3b1e').r(15, 12, 6, 2, '#a64a24').r(4, 18, 2, 9, '#2a2d33').r(26, 18, 2, 9, '#2a2d33');
}});
def('baranda', { fw: 1, w: 16, h: 16, draw(k) { k.r(0, 3, 16, 2, '#c9ccd2').r(0, 3, 16, 1, '#fff').r(1, 5, 1, 9, '#9aa0a6').r(8, 5, 1, 9, '#9aa0a6').r(0, 13, 16, 2, '#5b6573'); }});
def('escaleras', { fw: 2, fh: 1, w: 32, h: 16, block: false, flat: true, draw(k) { for (let i = 0; i < 4; i++) k.r(0, i * 4, 32, 4, shade('#3a3f48', i * .08)).r(0, i * 4, 32, 1, '#e6f03b'); }});
def('tarima', { fw: 6, fh: 4, w: 96, h: 64, block: false, flat: true, draw(k, o) {
  const c = (o && o.color) || '#e6f03b';
  k.ell(48, 32, 46, 30, '#0b0b0d').ell(48, 32, 44, 28, '#1a1c21').ell(48, 32, 42, 26, '#141519');
  for (let a = 0; a < 64; a++) { const t = a / 64 * Math.PI * 2; k.p(Math.round(48 + Math.cos(t) * 44), Math.round(32 + Math.sin(t) * 28), c); }
}});
def('letrero_vip', { fw: 4, w: 64, h: 24, wall: true, draw(k) {
  k.r(0, 0, 64, 24, '#120b18').r(1, 1, 62, 22, '#1a1022');
  const t = A.pixelText('VIP', '#e85b9c', 3); k.g.drawImage(t, 32 - t.width / 2, 5);
}});
def('pizarra', { fw: 10, w: 160, h: 26, wall: true, draw(k) {
  k.r(0, 0, 160, 22, '#c9ccd2').r(2, 2, 156, 18, '#fbfbf8').r(0, 22, 160, 3, '#9aa0a6').r(20, 21, 10, 2, '#2c5bd6').r(34, 21, 10, 2, '#d7262e').r(48, 21, 10, 2, '#111215');
}});
def('tv_pared', { fw: 4, w: 64, h: 30, wall: true, draw(k) {
  k.r(0, 0, 64, 28, '#0b0b0d').r(2, 2, 60, 24, '#0e1726').r(2, 2, 60, 1, '#1e3550');
  // tablero en vivo: gráfico de ventas + KPIs
  for (let i = 0; i < 9; i++) { const h = [5, 8, 7, 11, 10, 14, 13, 17, 19][i]; k.r(5 + i * 4, 23 - h, 3, h, i === 8 ? '#e6f03b' : '#4f7fc2'); }
  k.r(44, 5, 15, 2, '#e6f03b').r(44, 9, 11, 1, '#9fd3ff').r(44, 12, 13, 1, '#9fd3ff').r(44, 15, 9, 1, '#3ddc84').r(44, 18, 12, 1, '#9fd3ff');
}});
def('cuadro_pared', { fw: 2, w: 28, h: 16, wall: true, draw(k, o) {
  const c = (o && o.color) || '#163a5c';
  k.r(0, 0, 28, 16, '#c9a96e').r(2, 2, 24, 12, c).r(4, 9, 20, 4, shade(c, .3)).ell(19, 6, 2, 2, '#e6f03b');
}});
def('placa', { fw: 2, w: 32, h: 9, wall: true, draw(k) { k.r(0, 0, 32, 9, '#16171b').r(0, 0, 32, 1, '#3a3f48'); }});
def('reloj_base', { fw: 1, w: 16, h: 16, wall: true, draw(k) {
  k.ell(8, 7, 6, 6, '#c99a1e').ell(8, 7, 5, 5, '#fbf7ea').p(8, 2, '#16171b').p(8, 12, '#16171b').p(3, 7, '#16171b').p(13, 7, '#16171b');
}});
def('bola_disco', { fw: 1, w: 16, h: 16, block: false, draw(k) {
  k.vline(8, 0, 4, '#9aa0a6').ell(8, 9, 5, 5, '#c9ccd2');
  for (let y = 4; y < 15; y += 2) for (let x = 3; x < 14; x += 2) if (((x + y) / 2) % 2) k.p(x, y, '#ffffff');
}});

def('rocola', { w: 16, h: 30, draw(k) {
  k.rr(1, 2, 14, 27, '#7a2f3a', 4).rr(3, 4, 10, 8, '#f2c230', 3).r(4, 6, 8, 4, '#2a0d24').r(5, 7, 6, 1, '#e85b9c').r(5, 9, 6, 1, '#22d3ee');
  k.r(3, 14, 10, 6, '#16171b'); for (let i = 0; i < 4; i++) k.r(4 + i * 2, 15, 1, 4, ['#e6f03b', '#e85b9c', '#22d3ee', '#3ddc84'][i]);
  k.r(3, 22, 10, 5, '#5c1630').r(5, 23, 6, 1, '#f2c230');
}});
def('cabina', { fw: 3, fh: 2, w: 48, h: 56, draw(k, o) {
  const open = o && o.open;
  k.r(0, 4, 48, 52, '#2a0d1c').r(0, 0, 48, 6, '#c99a1e').r(0, 0, 48, 1, '#fff1a0').r(0, 5, 48, 1, '#8e6a12');
  k.r(0, 6, 3, 50, '#c99a1e').r(45, 6, 3, 50, '#c99a1e');
  if (open) {
    k.r(3, 6, 42, 50, '#120610');
    k.ell(24, 30, 9, 6, '#3a0d24').r(18, 36, 12, 6, '#5c1630');                      // cama redonda
    for (let y = 0; y < 3; y++) k.p(23 + y, 14 + y, '#ff3d8b');                       // lamparita corazón
    k.r(3, 6, 8, 50, '#8e1230').r(37, 6, 8, 50, '#8e1230');                         // cortinas recogidas
    for (let x = 4; x < 11; x += 3) k.r(x, 6, 1, 50, '#b3123e');
    for (let x = 38; x < 45; x += 3) k.r(x, 6, 1, 50, '#b3123e');
  } else {
    k.r(3, 6, 42, 50, '#8e1230');
    for (let x = 4; x < 45; x += 4) k.r(x, 6, 2, 50, '#b3123e');
    k.r(23, 6, 2, 50, '#5c0a1e');
  }
  k.r(18, 8, 12, 5, '#16171b'); const t = A.pixelText(open ? 'VIP' : 'OCUP', open ? '#e6f03b' : '#ff3d8b', 1); k.g.drawImage(t, 24 - Math.floor(t.width / 2), 8);
}});
def('loteria', { w: 16, h: 32, glow: '#e6f03b', draw(k) {
  k.rr(1, 4, 14, 27, '#b8232a', 2).r(1, 4, 14, 1, '#ff5a5f').rr(2, 0, 12, 6, '#f2c230', 2).r(4, 1, 8, 3, '#16171b');
  const t = A.pixelText('777', '#e6f03b', 1); k.g.drawImage(t, 8 - Math.floor(t.width / 2), 1);
  k.r(3, 9, 10, 8, '#fbf7ea'); k.r(3, 9, 10, 1, '#c9ccd2'); k.r(4, 11, 2, 4, '#d7262e').r(7, 11, 2, 4, '#2c5bd6').r(10, 11, 2, 4, '#3ddc84');
  k.r(13, 8, 1, 7, '#c9ccd2').ell(14, 7, 1, 1, '#d7262e');
  k.r(3, 20, 10, 3, '#16171b').r(5, 21, 6, 1, '#f2c230').r(3, 25, 10, 4, '#8e1230');
}});
/* ── club privado ── */
def('escenario', { fw: 17, fh: 4, w: 272, h: 68, flat: true, draw(k) {
  k.rr(0, 4, 272, 60, '#07060a', 6).rr(2, 4, 268, 56, '#140b1c', 6);
  for (let x = 6; x < 266; x += 12) for (let y = 8; y < 56; y += 12) k.r(x, y, 10, 10, (x / 12 + y / 12) % 2 ? '#1c1027' : '#170c20');
  k.r(4, 58, 264, 2, '#e85b9c').r(4, 60, 264, 4, '#2a0d24');
  for (let x = 8; x < 266; x += 8) k.r(x, 61, 3, 2, x % 16 ? '#ffd6e8' : '#7c3aed');
  k.r(0, 64, 272, 3, '#050407');
}});
def('tubo', { w: 16, h: 60, block: false, draw(k) {
  k.ell(8, 55, 6, 3, '#9aa0a6').ell(8, 54, 5, 2, '#e8ecf2');
  k.r(7, 2, 3, 52, '#c9ccd2').r(7, 2, 1, 52, '#ffffff').r(9, 2, 1, 52, '#7d828a');
  k.r(5, 0, 7, 3, '#5b6573').r(5, 0, 7, 1, '#c9ccd2');
}});
def('dj', { fw: 4, w: 64, h: 34, draw(k) {
  k.r(0, 12, 64, 21, '#0c0c10').r(0, 12, 64, 2, '#22d3ee').r(2, 16, 60, 1, '#1c2b33');
  for (let x = 4; x < 60; x += 6) k.r(x, 22, 4, 6, ['#e85b9c', '#7c3aed', '#22d3ee', '#e6f03b'][(x / 6) % 4 | 0]);
  k.r(2, 6, 60, 7, '#1d1f24').r(2, 6, 60, 1, '#3a3f48');
  k.ell(14, 9, 7, 3, '#0b0b0d').ell(14, 9, 2, 1, '#e85b9c').ell(50, 9, 7, 3, '#0b0b0d').ell(50, 9, 2, 1, '#22d3ee');
  k.r(26, 7, 12, 5, '#2a2d33'); for (let i = 0; i < 4; i++) k.r(27 + i * 3, 8, 1, 3, '#e6f03b');
  k.r(28, 0, 10, 7, '#16171b').r(29, 1, 8, 5, '#7c3aed').r(30, 2, 5, 1, '#c7a6ff');
}});
def('parlante', { w: 16, h: 40, draw(k) {
  k.r(1, 2, 14, 37, '#111215').r(1, 2, 14, 1, '#2a2d33');
  k.ell(8, 12, 5, 5, '#2a2d33').ell(8, 12, 3, 3, '#0b0b0d').ell(8, 12, 1, 1, '#5b6573');
  k.ell(8, 28, 6, 6, '#2a2d33').ell(8, 28, 4, 4, '#0b0b0d').ell(8, 28, 1, 1, '#5b6573');
  k.r(3, 36, 10, 1, '#e85b9c');
}});
def('cuerda', { fw: 3, w: 48, h: 22, block: true, draw(k) {
  [4, 42].forEach(x => k.r(x, 6, 3, 14, '#c99a1e').r(x - 1, 19, 5, 2, '#8e6a12').ell(x + 1, 5, 2, 2, '#f2c230'));
  for (let i = 0; i <= 36; i++) { const x = 6 + i, y = 7 + Math.round(Math.sin(i / 36 * Math.PI) * 5); k.r(x, y, 1, 2, '#8e1230'); }
}});
def('bola_grande', { fw: 1, w: 24, h: 24, block: false, draw(k) {
  k.vline(12, 0, 4, '#9aa0a6').ell(12, 13, 9, 9, '#c9ccd2');
  for (let y = 5; y < 22; y += 2) for (let x = 4; x < 21; x += 2) if (((x + y) / 2) % 2) k.p(x, y, '#ffffff'); else if (((x * y) % 7) === 0) k.p(x, y, '#e85b9c');
}});
// bailarinas del club (pixel art de juego, vestidas)
A.DANCERS = [
  { skin: '#eab68f', hair: 'largo', hairColor: '#1b1410', outfit: 'bikini', top: '#ff3d8b', bottom: '#ff3d8b', shoes: '#ff3d8b', acc: 'cadena', beard: 'no' },
  { skin: '#c98d63', hair: 'coleta', hairColor: '#d9b25a', outfit: 'bikini', top: '#f2c230', bottom: '#f2c230', shoes: '#f2c230', acc: 'ninguno', beard: 'no' },
  { skin: '#f6d3b3', hair: 'largo', hairColor: '#c2412d', outfit: 'bikini', top: '#a855f7', bottom: '#a855f7', shoes: '#111111', acc: 'lentes_sol', beard: 'no' }
];

/* ════════════ GATOS (16×12, 4 cuadros: parado, paso A, paso B, echado) ════════════ */
A.CATS = [
  { name: 'Turbo', fur: '#f08a24', dark: '#b8611a', light: '#ffc27a', eye: '#3ddc84' },
  { name: 'Diésel', fur: '#2a2d33', dark: '#16171b', light: '#5b6573', eye: '#e6f03b' },
  { name: 'Nitro', fur: '#e8e4dc', dark: '#a9adb3', light: '#ffffff', eye: '#4f8cff' }
];
A.catSheet = c => {
  const k = mk(16 * 4, 12);
  const body = (ox, legA, legB, sleep) => {
    if (sleep) {
      k.ell(ox + 8, 8, 6, 3, c.fur).r(ox + 3, 7, 10, 1, c.light).ell(ox + 4, 7, 3, 3, c.fur).r(ox + 2, 4, 2, 2, c.fur).r(ox + 5, 4, 2, 2, c.fur)
       .r(ox + 3, 7, 1, 1, c.dark).r(ox + 5, 7, 1, 1, c.dark).r(ox + 11, 9, 4, 1, c.dark);
      return;
    }
    k.r(ox + 5, 5, 8, 4, c.fur).r(ox + 5, 5, 8, 1, c.light).r(ox + 6, 8, 6, 1, c.dark);           // cuerpo
    k.r(ox + 1, 3, 5, 4, c.fur).r(ox + 1, 2, 1, 1, c.fur).r(ox + 4, 2, 1, 1, c.fur);              // cabeza y orejas
    k.p(ox + 2, 4, c.eye).p(ox + 4, 4, c.eye).p(ox + 3, 5, '#ff9ec7');
    k.r(ox + 13, 3, 1, 3, c.fur).p(ox + 14, 2, c.fur);                                           // cola
    k.r(ox + 5, 9, 1, 2 + legA, c.dark).r(ox + 7, 9, 1, 2 - legA, c.dark).r(ox + 10, 9, 1, 2 + legB, c.dark).r(ox + 12, 9, 1, 2 - legB, c.dark);
  };
  body(0, 0, 0); body(16, 1, -1); body(32, -1, 1); body(48, 0, 0, true);
  outline(k, '#111215');
  return k.c;
};

A.drawItem = (key, opts) => {
  const it = I[key]; if (!it) return null;
  const k = mk(it.w, it.h); it.draw(k, opts || {});
  if (!it.flat && !it.noOutline) outline(k, '#111215');
  const rot = ((opts && opts.rot) || 0) % 4;
  if (!rot) return k.c;
  if (it.flat) {   // lo plano gira de verdad (90°)
    const odd = rot % 2 === 1, c = document.createElement('canvas'); c.width = odd ? it.h : it.w; c.height = odd ? it.w : it.h;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.translate(c.width / 2, c.height / 2); g.rotate(rot * Math.PI / 2); g.drawImage(k.c, -it.w / 2, -it.h / 2); return c;
  }
  if (rot % 2 === 0) return k.c;   // lo de pie se voltea (en vista 3/4 no hay espalda que mostrar)
  const c = document.createElement('canvas'); c.width = it.w; c.height = it.h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.translate(it.w, 0); g.scale(-1, 1); g.drawImage(k.c, 0, 0); return c;
};
// medidas efectivas según la rotación
A.dims = (key, rot) => { const it = I[key]; if (!it) return null; const sw = it.flat && ((rot || 0) % 2 === 1); return sw ? { fw: it.fh, fh: it.fw, w: it.h, h: it.w } : { fw: it.fw, fh: it.fh, w: it.w, h: it.h }; };

/* ════════════ AUTOS (vista superior, 64×32 mirando a la derecha) ════════════ */
A.car = (color, type) => {
  const k = mk(68, 36), ox = 2, oy = 2;
  const c = color, l = shade(c, .25), d = shade(c, -.28), glass = '#141c28', gl = '#3b5578';
  const wheel = '#0b0b0d';
  const long = type === 'luxe' ? 64 : 62, top = type === 'suv' ? 1 : 3, bot = type === 'suv' ? 30 : 28;
  // ruedas
  [[10, 0], [44, 0]].forEach(([x]) => { k.r(ox + x, oy + top - 2, 10, 3, wheel).r(ox + x, oy + bot - 1, 10, 3, wheel); });
  // carrocería
  k.rr(ox, oy + top, long, bot - top, d, 4);
  k.rr(ox + 1, oy + top, long - 2, bot - top - 2, c, 4);
  k.r(ox + 6, oy + top + 2, long - 12, 2, l);
  let cab0, cab1;
  if (type === 'super') { cab0 = 26; cab1 = 42; k.r(ox + 46, oy + 9, 12, 1, d).r(ox + 46, oy + 22, 12, 1, d); k.r(ox + 8, oy + 10, 6, 12, d); }
  else if (type === 'gt') { cab0 = 22; cab1 = 42; k.r(ox + 6, oy + 9, 10, 14, l); }
  else if (type === 'luxe') { cab0 = 18; cab1 = 40; k.r(ox + long - 3, oy + 10, 2, 12, '#c9ccd2'); k.r(ox + long - 5, oy + 15, 2, 2, '#e8e4dc'); }
  else { cab0 = 12; cab1 = 46; for (let x = 16; x < 42; x += 5) k.r(ox + x, oy + 4, 1, 24, '#2a2d33'); }
  // cabina: vidrio trasero, techo sólido con ventanas laterales finas, parabrisas
  const cy0 = oy + top + 4, ch = bot - top - 8;
  k.rr(ox + cab0, cy0, cab1 - cab0, ch, shade(c, -.12), 2);
  k.r(ox + cab0, cy0 + 1, 4, ch - 2, glass).p(ox + cab0 + 1, cy0 + 2, gl);
  k.r(ox + cab1 - 7, cy0, 6, ch, glass).r(ox + cab1 - 6, cy0 + 1, 1, ch - 3, gl).r(ox + cab1 - 4, cy0 + 2, 1, 2, '#6f8fb8');
  k.r(ox + cab0 + 5, cy0, cab1 - cab0 - 12, 1, glass).r(ox + cab0 + 5, cy0 + ch - 1, cab1 - cab0 - 12, 1, glass);
  k.r(ox + cab0 + 5, cy0 + 2, cab1 - cab0 - 13, ch - 4, type === 'suv' ? shade(c, -.05) : c);
  k.r(ox + cab0 + 6, cy0 + 3, cab1 - cab0 - 16, 1, l);
  // espejos y luces
  k.r(ox + cab1 - 6, oy + top - 1, 3, 2, d).r(ox + cab1 - 6, oy + bot - 1, 3, 2, d);
  k.r(ox + long - 3, oy + top + 2, 2, 4, '#fff6c8').r(ox + long - 3, oy + bot - 6, 2, 4, '#fff6c8');
  k.r(ox, oy + top + 2, 2, 4, '#ff2d3d').r(ox, oy + bot - 6, 2, 4, '#ff2d3d');
  outline(k, '#0b0b0d');
  return k.c;
};

/* ════════════ PERSONAJE NPC: Valentina ════════════ */
A.npcSheet = () => A.avatarSheet(A.NPC_AV);
})();
