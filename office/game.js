'use strict';
/* ════════════════════════════════════════════════════════════════
   RUEDDA OFFICE — escena Phaser (movimiento, multijugador, mundo vivo)
   ════════════════════════════════════════════════════════════════ */
(function(){
const RO = window.RO, A = RO.Art, Wd = RO.World, T = A.T;
const G = RO.G = {};

/* ── teclado propio (Phaser no captura teclas: así los inputs del HUD funcionan) ── */
const keys = new Set();
const typing = () => { const a = document.activeElement; return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable); };
RO.typing = typing;
addEventListener('keydown', e => {
  if (typing() || !G.scene) return;
  const k = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  if (!e.repeat) RO.emit('key', k, e);
  keys.add(k);
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());

const ZL = [2, 3, 4, 5];
const DIR_ROW = { down: 0, left: 1, right: 2, up: 3 };
const WALK = [1, 2, 3, 0];
const tf = {};
const timeIn = tz => {
  try {
    const f = tf[tz] || (tf[tz] = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
    const p = {}; f.formatToParts(new Date()).forEach(x => p[x.type] = x.value);
    return { h: +p.hour % 24, m: +p.minute, s: +p.second };
  } catch (e) { const d = new Date(); return { h: d.getHours(), m: d.getMinutes(), s: d.getSeconds() }; }
};
RO.timeIn = timeIn;

// la clase se define al arrancar: Phaser se carga bajo demanda (después del login)
function defineScene() { return class OfficeScene extends Phaser.Scene {
  constructor() { super({ key: 'office' }); }

  create() {
    G.scene = this;
    this.players = new Map();
    this.overlay = document.getElementById('ov-world');
    this.statics = [];
    this.decorSpr = new Map();
    this.fx = [];
    this.secretOpen = false;
    this.vipSeen = false;
    this.lastSend = 0; this.lastSave = 0; this.wasMoving = false;
    this.coffeeUntil = 0;
    this.edit = null;
    this.hi5 = {};

    this.cameras.main.setBackgroundColor('#07080a');
    this.buildWorld();

    // jugador propio
    const me = RO.S.me;
    let pos = (RO.S.positions || []).find(p => p.user_id === me.user_id);
    const ofs = this.officeOf(me.slot);
    if (!pos || !this.free(pos.x, pos.y) || pos.room === 'garage' || pos.room === 'club') pos = ofs != null ? this.w.officeSpawn(ofs) : this.w.spawn;
    this.me = this.addPlayer(me.user_id, pos.x, pos.y, true);
    if (pos.dir) this.me.dir = pos.dir;

    const cam = this.cameras.main;
    cam.setZoom(this.zoomPref());
    this.applyBounds();
    this.scale.on('resize', () => this.applyBounds());
    cam.startFollow(this.me.spr, true, 0.14, 0.14);
    cam.setRoundPixels(true);
    cam.fadeIn(600, 7, 8, 10);

    this.makeNpc();
    this.makeDancers();
    if (RO.S.config.vip_open !== false && RO.S.config.vip_enabled !== false) this.openVip();

    // mouse: clic para caminar / modo edición
    this.input.on('pointerdown', p => this.onPointer(p, true));
    this.input.on('pointermove', p => this.onPointer(p, false));
    this.input.on('wheel', (p, o, dx, dy) => this.zoomStep(dy > 0 ? -1 : 1));

    this.game.events.on('postrender', () => this.layoutOverlay());
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.tickClocks() });
    this.tickClocks();

    RO.emit('game:ready');
    this.announceRoom(true);
  }

  zoomPref() {
    let z = 0; try { z = +localStorage.getItem('ro_zoom') || 0; } catch (e) {}
    if (!ZL.includes(z)) z = innerWidth < 1300 ? 2 : 3;
    return z;
  }
  zoomStep(d) {
    const cam = this.cameras.main, i = ZL.indexOf(cam.zoom), n = ZL[RO.clamp((i < 0 ? 1 : i) + d, 0, ZL.length - 1)];
    if (n === cam.zoom) return;
    cam.setZoom(n); this.applyBounds();
    try { localStorage.setItem('ro_zoom', n); } catch (e) {}
    RO.emit('zoom', n);
  }
  // la cámara puede correrse lo suficiente para que el HUD (barra de arriba y panel derecho) no tape el mapa
  applyBounds() {
    const cam = this.cameras.main, z = cam.zoom;
    const side = document.getElementById('side');
    const sideW = side && !side.classList.contains('collapsed') ? side.offsetWidth + 24 : 12;
    const chat = document.getElementById('chat');
    const bottom = chat ? chat.offsetHeight + 24 : 12;   // el borde de abajo queda visible por encima del chat
    const top = 76, pad = 12;
    cam.setBounds(-pad / z, -top / z, Wd.W * T + (pad + sideW) / z, Wd.H * T + (top + bottom) / z);
    cam.setFollowOffset(-(sideW - pad) / 2 / z, (top - pad) / 2 / z);
  }
  officeOf(slot) { const o = (RO.S.config.offices || []).find(z => z.slot === slot); return o ? o.pos : null; }

  /* ════════════ MUNDO ════════════ */
  tex(key, make) { if (!this.textures.exists(key)) this.textures.addCanvas(key, make()); return key; }
  itemTex(key, opts) { return this.tex('it_' + key + '_' + A.hash(JSON.stringify(opts || {})), () => A.drawItem(key, opts)); }

  buildWorld() {
    const cfg = RO.S.config;
    this.w = Wd.build(cfg);
    if (this.secretOpen) this.applySecret(true);
    this.baseBlocked = this.w.blocked;
    this.drawBase();
    this.statics.forEach(o => o.destroy()); this.statics = [];
    this.fx.forEach(o => o.destroy && o.destroy()); this.fx = [];
    this.w.statics.forEach(s => this.placeStatic(s));
    this.drawOfficeSigns();
    this.drawClocks();
    this.drawBoardMini();
    this.drawGarage();
    this.drawPostits();
    this.syncDecor();
    if (!this.fog && !this.vipSeen) {
      this.fog = this.add.rectangle(0, 39 * T, Wd.W * T, (Wd.H - 39) * T, 0x07080a).setOrigin(0).setDepth(9e5);
    }
    if (!this.fogClub && !this.clubSeen) {
      this.fogClub = this.add.rectangle(0, 54 * T, Wd.W * T, (Wd.H - 54) * T, 0x07080a).setOrigin(0).setDepth(9e5 - 1);
    }
    this.drawClub();
  }
  drawBase() {
    const c = Wd.renderBase(this.w, RO.S.config, RO.logoBits, this.secretOpen);
    if (this.textures.exists('base')) this.textures.remove('base');
    this.textures.addCanvas('base', c);
    if (this.base) this.base.setTexture('base'); else this.base = this.add.image(0, 0, 'base').setOrigin(0).setDepth(-1e6);
  }
  placeStatic(s) {
    const it = A.ITEMS[s.key]; if (!it) return;
    const key = this.itemTex(s.key, s.opts);
    let img;
    if (it.wall) {
      const yo = { pizarra: 1, tv_pared: -5, placa: 4, letrero_vip: -6, cuadro_pared: 0 }[s.key] || 0;
      img = this.add.image(s.x * T, s.y * T + yo, key).setOrigin(0, 0).setDepth(-5e5 + s.y);
    } else {
      img = this.add.image(s.x * T + (it.fw * T - it.w) / 2, (s.y + it.fh) * T, key).setOrigin(0, 1);
      img.setDepth(it.flat ? -6e5 + s.y : (s.y + it.fh) * T - (s.key === 'silla' ? 8 : 0));
      if (s.key === 'bola_disco') img.setDepth(9e4);
    }
    if (s.opts && s.opts.secret) { this.secretShelf = img; if (this.secretOpen) img.x += (Wd.SECRET.slideTo - Wd.SECRET.shelfX) * T; }
    if (it.glow) this.glowFor(img, it.glow);
    this.statics.push(img);
    return img;
  }
  glowFor(img, color) {
    const g = this.add.ellipse(img.x + img.displayWidth / 2, img.y - img.displayHeight / 2, img.displayWidth + 26, img.displayHeight + 14, Phaser.Display.Color.HexStringToColor(color).color, 0.16)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(img.depth + 1);
    this.tweens.add({ targets: g, alpha: { from: 0.10, to: 0.28 }, duration: 1400 + Math.random() * 800, yoyo: true, repeat: -1 });
    this.fx.push(g); return g;
  }
  drawOfficeSigns() {
    this.leds = [];
    const offs = RO.S.config.offices || [];
    Wd.OFF_X.forEach((X, p) => {
      const o = offs.find(z => z.pos === p); if (!o) return;
      const m = RO.memberBySlot(o.slot);
      const name = (o.title || (m ? m.display_name : o.name || 'Libre')).normalize('NFD').replace(/[̀-ͯ]/g, '').slice(0, 12);
      const key = this.tex('sign_' + A.hash(name), () => A.pixelText(name, A.YELLOW, 1));
      const img = this.add.image((X + 10) * T, 10 * T + 8.5, key).setOrigin(0.5).setDepth(-4e5);
      this.statics.push(img);
      // luz de estado en la puerta (verde conectado · rojo enfocado · gris fuera)
      const led = this.add.rectangle((X + 5) * T + 10, 10 * T + 7, 3, 3, 0x3a3f48).setDepth(-4e5);
      led.slot = o.slot; this.statics.push(led);
      this.leds.push(led);
    });
    this.refreshLeds();
  }
  refreshLeds() {
    (this.leds || []).forEach(l => {
      if (!l.scene) return;
      const m = RO.memberBySlot(l.slot), on = m && RO.S.online.get(m.user_id);
      l.fillColor = !on ? 0x3a3f48 : on.status === 'enfocado' ? 0xff3b47 : on.status === 'ocupado' ? 0xf08a24 : 0x3ddc84;
    });
  }

  /* relojes de hotel: Caracas · Bogotá · Ontario (editables en Admin → Mundo) */
  drawClocks() {
    (this.clocks || []).forEach(c => { c.g.destroy(); c.base.destroy(); c.lbl.destroy(); c.dig.destroy(); });
    this.clocks = [];
    const list = (RO.S.config.clocks || []).slice(0, 4), n = list.length || 1;
    list.forEach((c, i) => {
      const cx = Math.round(30 * T + (8 * T) * (i + 0.5) / n), cy = 14 * T + 7;
      const base = this.add.image(cx - 8, 14 * T, this.itemTex('reloj_base')).setOrigin(0).setDepth(-4e5);
      const g = this.add.graphics().setDepth(-4e5 + 1);
      const name = String(c.label || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().slice(0, 8);
      const lbl = this.add.image(cx, 15 * T + 2, this.tex('clk_' + A.hash(name), () => A.pixelText(name, '#c9a96e', 1))).setOrigin(0.5, 0).setDepth(16 * T + 1);
      const dkey = 'clkd_' + i;
      if (this.textures.exists(dkey)) this.textures.remove(dkey);
      const ct = this.textures.createCanvas(dkey, 20, 5);
      const dig = this.add.image(cx, 15 * T + 9, dkey).setOrigin(0.5, 0).setDepth(16 * T + 1);
      this.clocks.push({ c, cx, cy, g, base, lbl, dig, ct, last: '' });
    });
  }
  tickClocks() {
    (this.clocks || []).forEach(k => {
      const t = timeIn(k.c.tz), g = k.g; g.clear();
      const ha = ((t.h % 12) + t.m / 60) / 12 * Math.PI * 2 - Math.PI / 2, ma = (t.m + t.s / 60) / 60 * Math.PI * 2 - Math.PI / 2, sa = t.s / 60 * Math.PI * 2 - Math.PI / 2;
      g.lineStyle(1, 0x16171b, 1).lineBetween(k.cx, k.cy, k.cx + Math.cos(ha) * 2.6, k.cy + Math.sin(ha) * 2.6);
      g.lineStyle(1, 0x16171b, 1).lineBetween(k.cx, k.cy, k.cx + Math.cos(ma) * 4, k.cy + Math.sin(ma) * 4);
      g.lineStyle(1, 0xd7262e, 1).lineBetween(k.cx, k.cy, k.cx + Math.cos(sa) * 4.4, k.cy + Math.sin(sa) * 4.4);
      const s = String(t.h).padStart(2, '0') + ':' + String(t.m).padStart(2, '0');
      if (s !== k.last) {
        k.last = s; const ctx = k.ct.getContext(); ctx.clearRect(0, 0, 20, 5);
        ctx.drawImage(A.pixelText(s, A.YELLOW, 1), 0, 0); k.ct.refresh();
      }
    });
    RO.emit('clock:tick');
  }

  drawBoardMini() {
    if (!this.textures.exists('boardmini')) this.textures.createCanvas('boardmini', 156, 18);
    const img = this.add.image(44 * T + 2, 14 * T + 3, 'boardmini').setOrigin(0).setDepth(-5e5 + 20);
    this.statics.push(img);
    if (RO.boardCanvas) this.updateBoardMini(RO.boardCanvas);
  }
  updateBoardMini(src) {
    const t = this.textures.get('boardmini'); if (!t || !t.getContext) return;
    const ctx = t.getContext(); ctx.clearRect(0, 0, 156, 18); ctx.imageSmoothingEnabled = true;
    ctx.drawImage(src, 0, 0, src.width, src.height, 0, 0, 156, 18); t.refresh();
  }

  drawGarage() {
    const cfg = RO.S.config;
    // logo Ruedda en neón sobre el muro del fondo
    if (RO.logoBits) {
      const lb = RO.logoBits, px = 2, lw = lb.cols * px, lh = lb.rows * px;
      const x = Math.round(36 * T - lw / 2), y = 39 * T + 0;
      const kGlow = this.tex('neonlogo_glow', () => A.logoCanvas(lb, px, 'rgba(230,240,59,.0)', { glow: true, glowColor: 'rgba(230,240,59,.55)' }));
      const kCore = this.tex('neonlogo', () => A.logoCanvas(lb, px, '#f4ff7a'));
      const glow = this.add.image(x - 3, y - 3, kGlow).setOrigin(0).setDepth(-4e5 + 5).setBlendMode(Phaser.BlendModes.ADD);
      const core = this.add.image(x, y, kCore).setOrigin(0).setDepth(-4e5 + 6);
      const halo = this.add.ellipse(36 * T, y + lh / 2, lw + 60, lh + 40, 0xe6f03b, 0.08).setBlendMode(Phaser.BlendModes.ADD).setDepth(-4e5 + 4);
      this.tweens.add({ targets: [glow, halo], alpha: { from: 0.65, to: 1 }, duration: 1700, yoyo: true, repeat: -1 });
      this.time.addEvent({ delay: 4200, loop: true, callback: () => { if (Math.random() < .45) this.tweens.add({ targets: [core, glow], alpha: 0.25, duration: 60, yoyo: true, repeat: 2 }); } });
      this.fx.push(glow, core, halo);
      const sub = this.add.image(36 * T, y + lh + 2, this.tex('vipsub', () => A.pixelText('RUEDDA ECOSYSTEM · PRIVATE GARAGE', '#e85b9c', 1))).setOrigin(0.5, 0).setDepth(-4e5 + 6);
      this.fx.push(sub);
    }
    // tubos de neón verticales en el muro
    const NE = [0xe85b9c, 0x7c3aed, 0x22d3ee, 0xe6f03b];
    for (let i = 0, x = 2; x <= 54; x += 5, i++) {
      if (x >= 17 && x <= 21) continue; if (x >= 26 && x <= 46) continue;
      const c = NE[i % NE.length];
      const tube = this.add.rectangle(x * T + 8, 39 * T + 4, 2, 38, c, 1).setOrigin(0.5, 0).setDepth(-4e5 + 3);
      const glo = this.add.rectangle(x * T + 8, 39 * T + 2, 12, 44, c, 0.18).setOrigin(0.5, 0).setDepth(-4e5 + 2).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: glo, alpha: { from: 0.1, to: 0.3 }, duration: 900 + i * 130, yoyo: true, repeat: -1 });
      this.fx.push(tube, glo);
    }
    // autos de exhibición con luz inferior
    this.carSpr = [];
    this.w.cars.forEach(c => {
      const cx = (c.x + 3) * T, cy = (c.y + 2) * T;
      const col = Phaser.Display.Color.HexStringToColor(c.car.color === '#16171b' ? '#9fd3ff' : c.car.color).color;
      const under = this.add.ellipse(cx, cy + 2, 84, 46, col, 0.22).setBlendMode(Phaser.BlendModes.ADD).setDepth(-5.5e5);
      this.tweens.add({ targets: under, alpha: { from: 0.12, to: 0.32 }, duration: 1600 + c.i * 170, yoyo: true, repeat: -1 });
      const key = this.tex('car_' + A.hash(c.car.color + c.car.type), () => A.car(c.car.color, c.car.type));
      const spr = this.add.image(cx, cy, key).setDepth((c.y + 3) * T);
      const plate = this.add.image(cx, (c.y + 4) * T - 3, this.tex('plate_' + A.hash(c.car.name), () => A.pixelText(String(c.car.name).normalize('NFD').replace(/[̀-ͯ]/g, '').slice(0, 16), '#ffffff', 1, '#000000'))).setDepth(-5.4e5).setAlpha(.85);
      this.carSpr.push({ c, spr, under });
      this.fx.push(under, spr, plate);
    });
    // luces de discoteca que barren el piso
    const DC = [0xe85b9c, 0x22d3ee, 0xe6f03b, 0x7c3aed, 0x3ddc84];
    for (let i = 0; i < 7; i++) {
      const s = this.add.ellipse(Phaser.Math.Between(4, 52) * T, Phaser.Math.Between(43, 52) * T, 46, 30, DC[i % DC.length], 0.12).setBlendMode(Phaser.BlendModes.ADD).setDepth(-5.2e5);
      const hop = () => this.tweens.add({ targets: s, x: Phaser.Math.Between(4, 52) * T, y: Phaser.Math.Between(43, 52) * T, duration: Phaser.Math.Between(2200, 4200), ease: 'Sine.easeInOut', onComplete: hop });
      hop(); this.fx.push(s);
    }
    // escaleras del pasadizo
    if (this.secretOpen) this.fx.push(this.add.image(Wd.SECRET.x * T, 39 * T, this.itemTex('escaleras')).setOrigin(0).setDisplaySize(32, 48).setDepth(-5.9e5));
  }

  /* post-its sobre los escritorios */
  drawPostits() {
    (this.postits || []).forEach(o => o.destroy()); this.postits = [];
    const offs = RO.S.config.offices || [];
    Wd.OFF_X.forEach((X, p) => {
      const o = offs.find(z => z.pos === p); if (!o) return;
      const m = RO.memberBySlot(o.slot); if (!m) return;
      const notes = RO.S.notes.filter(n => n.to_user === m.user_id && !n.read_at);
      notes.slice(0, 6).forEach((n, i) => {
        const r = this.add.rectangle((X + 5) * T + 4 + i * 6, 4 * T + 9 + (i % 2), 5, 5, Phaser.Display.Color.HexStringToColor(n.color || A.YELLOW).color).setDepth(5 * T + 2).setStrokeStyle(1, 0x111215);
        r.angle = (i % 3 - 1) * 8;
        this.postits.push(r);
      });
      if (m.user_id === RO.S.me.user_id && notes.length) {
        const b = this.add.text((X + 6.5) * T, 3 * T - 2, '!', { fontFamily: 'Silkscreen, monospace', fontSize: '12px', color: '#16171b', backgroundColor: '#e6f03b', padding: { x: 3, y: 0 } }).setOrigin(0.5).setDepth(9e4).setResolution(4);
        this.tweens.add({ targets: b, y: b.y - 4, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.postits.push(b);
      }
    });
  }

  /* decoración comprada / colocada (tabla office_decor) */
  syncDecor() {
    const want = new Map((RO.S.decor || []).map(d => [String(d.id), d]));
    this.decorSpr.forEach((spr, id) => { if (!want.has(id)) { spr.destroy(); spr._glow && spr._glow.destroy(); this.decorSpr.delete(id); } });
    want.forEach((d, id) => {
      const it = A.ITEMS[d.item]; if (!it) return;
      const old = this.decorSpr.get(id);
      if (old && old._x === d.x && old._y === d.y) return;
      if (old) { old.destroy(); old._glow && old._glow.destroy(); }
      const img = this.add.image(d.x * T + (it.fw * T - it.w) / 2, (d.y + it.fh) * T, this.itemTex(d.item, {})).setOrigin(0, 1);
      img.setDepth(it.flat ? -6e5 + d.y : (d.y + it.fh) * T);
      img._x = d.x; img._y = d.y; img._d = d;
      if (it.glow) img._glow = this.glowFor(img, it.glow);
      this.decorSpr.set(id, img);
    });
    this.recalcBlocked();
  }
  recalcBlocked() {
    const b = this.baseBlocked.map(r => Uint8Array.from(r));
    (RO.S.decor || []).forEach(d => {
      const it = A.ITEMS[d.item]; if (!it || !it.block) return;
      for (let y = d.y; y < d.y + it.fh; y++) for (let x = d.x; x < d.x + it.fw; x++) if (b[y] && b[y][x] !== undefined) b[y][x] = 1;
    });
    this.blocked = b;
  }
  canPlace(item, x, y) {
    const it = A.ITEMS[item]; if (!it) return false;
    const own = this.edit && this.edit.own ? Wd.officeRect(RO.S.me.slot, RO.S.config) : null;
    if (this.edit && this.edit.own && !own) return false;
    for (let yy = y; yy < y + it.fh; yy++) for (let xx = x; xx < x + it.fw; xx++) {
      if (!this.blocked[yy] || this.blocked[yy][xx] !== 0) return false;
      if (own && (xx < own.x0 || xx > own.x1 || yy < own.y0 || yy > own.y1)) return false;
      if (!RO.isAdmin() && this.inOtherOffice(xx, yy)) return false;
      if (yy >= 10 && yy <= 14 && this.w.room[yy][xx] && (this.w.grid[yy - 1][xx] === 1 && this.w.grid[yy + 1] && this.w.grid[yy + 1][xx] === 1)) return false; // puertas
    }
    // no tapar a nadie
    for (const p of this.players.values()) { const tx = Math.floor(p.x / T), ty = Math.floor(p.y / T); if (tx >= x && tx < x + it.fw && ty >= y && ty < y + it.fh) return false; }
    return true;
  }

  // celdas de oficinas ajenas (las áreas comunes son de todos)
  inOtherOffice(x, y) {
    if (y < 1 || y > 9) return false;
    const p = Wd.OFF_X.findIndex(x0 => x >= x0 && x <= x0 + 12); if (p < 0) return false;
    const mine = Wd.officeRect(RO.S.me.slot, RO.S.config);
    return !(mine && mine.pos === p);
  }

  /* ════════════ PASADIZO SECRETO ════════════ */
  applySecret(open) {
    const S = Wd.SECRET;
    for (let y = 39; y <= 41; y++) for (let x = S.x; x < S.x + S.w; x++) { this.w.grid[y][x] = open ? 0 : 1; this.w.room[y][x] = open ? 'garage' : null; this.w.blocked[y][x] = open ? 0 : 1; }
    for (let x = S.shelfX; x < S.shelfX + 2; x++) this.w.blocked[S.shelfY][x] = open ? 0 : 1;
    for (let x = S.slideTo; x < S.slideTo + 2; x++) this.w.blocked[S.shelfY][x] = open ? 1 : 0;
  }
  openSecret(remote, quiet) {
    if (this.secretOpen || RO.S.config.vip_enabled === false) return;
    this.secretOpen = true;
    if (!quiet) { RO.sfx.door(); this.cameras.main.shake(700, 0.004); }
    const shelf = this.secretShelf;
    if (shelf) this.tweens.add({ targets: shelf, x: Wd.SECRET.slideTo * T + (shelf.x - Wd.SECRET.shelfX * T), duration: 1400, ease: 'Sine.easeInOut' });
    this.applySecret(true);
    this.baseBlocked = this.w.blocked; this.recalcBlocked();
    this.time.delayedCall(700, () => {
      this.drawBase();
      this.fx.push(this.add.image(Wd.SECRET.x * T, 39 * T, this.itemTex('escaleras')).setOrigin(0).setDisplaySize(32, 48).setDepth(-5.9e5));
    });
    if (!remote && !quiet) { RO.Net.send({ t: 'secret', u: RO.S.me.user_id }); RO.emit('toast', 'Algo se movió detrás de la estantería…', 'vip'); }
  }
  revealGarage() {
    if (this.vipSeen) return; this.vipSeen = true;
    if (this.fog) this.tweens.add({ targets: this.fog, alpha: 0, duration: 1200, onComplete: () => { this.fog.destroy(); this.fog = null; } });
    RO.emit('vip:found');
  }

  /* ════════════ JUGADORES ════════════ */
  avTex(av) {
    const key = 'av_' + A.hash(JSON.stringify(av));
    if (!this.textures.exists(key)) {
      const t = this.textures.addCanvas(key, A.avatarSheet(av));
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) t.add(r + '_' + c, 0, c * 16, r * 24, 16, 24);
    }
    return key;
  }
  addPlayer(uid, x, y, isMe) {
    const m = RO.member(uid) || { display_name: 'Invitado', avatar: {} };
    const av = A.normAvatar(m.avatar, uid);
    const spr = this.add.sprite(x, y, this.avTex(av), '0_0').setOrigin(0.5, 22 / 24);
    const tag = document.createElement('div');
    tag.className = 'w-ent' + (isMe ? ' me' : '');
    tag.innerHTML = '<div class="w-bub"></div><div class="w-tag"><i></i><span></span></div>';
    this.overlay.appendChild(tag);
    const p = { uid, spr, x, y, tx: x, ty: y, dir: 'down', moving: false, isMe, tag, anim: 0, room: null };
    this.players.set(uid, p);
    this.refreshTag(p);
    return p;
  }
  removePlayer(uid) {
    const p = this.players.get(uid); if (!p || p.isMe) return;
    p.spr.destroy(); p.tag.remove(); this.players.delete(uid);
  }
  refreshPlayer(uid) {
    const p = this.players.get(uid); if (!p) return;
    const m = RO.member(uid); if (!m) return;
    p.spr.setTexture(this.avTex(A.normAvatar(m.avatar, uid)), DIR_ROW[p.dir] + '_0');
    this.refreshTag(p);
  }
  refreshTag(p) {
    const m = RO.member(p.uid), on = RO.S.online.get(p.uid) || {};
    p.tag.querySelector('span').textContent = (m ? m.display_name : 'Invitado');
    const st = p.isMe ? RO.S.status : on.status;
    p.tag.querySelector('i').className = 'st-' + (st || 'disponible');
    p.tag.classList.toggle('focus', st === 'enfocado');
  }
  bubble(p, text, ms) {
    const el = p.tag ? p.tag.querySelector('.w-bub') : p.bub;
    el.textContent = text; el.classList.add('on');
    clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('on'), ms || Math.min(9000, 2500 + text.length * 60));
  }
  hits(x, y, blocked) {
    const b = blocked || this.blocked;
    const pts = [[x - 5, y - 4], [x + 5, y - 4], [x - 5, y + 1], [x + 5, y + 1]];
    for (const [px, py] of pts) { const tx = Math.floor(px / T), ty = Math.floor(py / T); if (!b[ty] || b[ty][tx] !== 0) return true; }
    return false;
  }
  free(x, y) { return x > 0 && y > 0 && !this.hits(x, y); }
  setFrame(p, moving, time) {
    const row = DIR_ROW[p.dir] ?? 0;
    const col = moving ? WALK[Math.floor(time / 120) % 4] : 0;
    const f = row + '_' + col; if (p._f !== f) { p.spr.setFrame(f); p._f = f; }
  }

  /* ════════════ BUCLE ════════════ */
  update(time, dt) {
    dt = Math.min(dt, 50);
    const me = this.me, busy = RO.uiBusy && RO.uiBusy();
    let vx = 0, vy = 0;
    {
      if (!busy) {
        if (keys.has('arrowleft') || keys.has('a')) vx -= 1;
        if (keys.has('arrowright') || keys.has('d')) vx += 1;
        if (keys.has('arrowup') || keys.has('w')) vy -= 1;
        if (keys.has('arrowdown') || keys.has('s')) vy += 1;
      }
      if (vx || vy) { this.path = null; this.pathDone = null; this.hideMarker(); }
      else if (this.path && this.path.length) {
        const [tx, ty] = this.path[0], gx = (tx + .5) * T, gy = (ty + .75) * T, dx = gx - me.x, dy = gy - me.y, d = Math.hypot(dx, dy);
        if (d < 2.5) { this.path.shift(); if (!this.path.length) { const f = this.pathDone; this.pathDone = null; this.hideMarker(); f && f(); } }
        else { vx = dx / d; vy = dy / d; }
      }
    }
    const moving = !!(vx || vy);
    if (moving) {
      const n = Math.hypot(vx, vy); vx /= n; vy /= n;
      const sp = (keys.has('shift') ? 128 : 80) * (this.coffeeUntil > time ? 1.4 : 1) * dt / 1000;
      const nx = me.x + vx * sp, ny = me.y + vy * sp;
      if (!this.hits(nx, me.y)) me.x = nx; else if (this.path) { /* esquina */ }
      if (!this.hits(me.x, ny)) me.y = ny;
      if (Math.abs(vx) > Math.abs(vy) + .01) me.dir = vx < 0 ? 'left' : 'right'; else me.dir = vy < 0 ? 'up' : 'down';
      me.spr.setPosition(me.x, me.y);
    }
    this.setFrame(me, moving, time);
    me.spr.setDepth(me.y);

    // red: posición
    if (moving && time - this.lastSend > 100) { this.sendPos(1); this.lastSend = time; }
    else if (!moving && this.wasMoving) this.sendPos(0);
    this.wasMoving = moving;
    if (time - this.lastSave > 15000) { this.lastSave = time; this.savePos(); }

    // sala actual
    const tx = Math.floor(me.x / T), ty = Math.floor(me.y / T), room = this.w.room[ty] && this.w.room[ty][tx];
    if (room && room !== me.room) { me.room = room; this.announceRoom(); }

    // otros jugadores (interpolación)
    this.players.forEach(p => {
      if (p.isMe) return;
      const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
      if (d > 220) { p.x = p.tx; p.y = p.ty; }
      else if (d > 0.3) { const step = Math.max(90, d * 6) * dt / 1000; const k = Math.min(1, step / d); p.x += dx * k; p.y += dy * k; }
      p.spr.setPosition(p.x, p.y).setDepth(p.y);
      this.setFrame(p, d > 0.6 || p.moving, time);
    });

    this.updateNpc(time, dt);
    this.updateDancers(time);
    this.updateHint();
  }
  sendPos(m) {
    const me = this.me;
    RO.Net.send({ t: 'pos', u: RO.S.me.user_id, x: Math.round(me.x * 10) / 10, y: Math.round(me.y * 10) / 10, d: me.dir, m, r: me.room });
  }
  savePos() { const me = this.me; RO.Net.savePos({ x: me.x, y: me.y, dir: me.dir, room: me.room }).catch(() => {}); }
  announceRoom(initial) {
    const me = this.me; if (!me) return;
    const tx = Math.floor(me.x / T), ty = Math.floor(me.y / T); me.room = this.w.room[ty] && this.w.room[ty][tx];
    if (me.room === 'garage' || me.room === 'club') this.revealGarage();
    if (me.room === 'club') this.revealClub();
    RO.emit('room', me.room, Wd.roomName(me.room, RO.S.config), initial);
  }

  /* ════════════ INTERACCIÓN ════════════ */
  updateHint() {
    const me = this.me; let best = null, bd = 1e9;
    const consider = (o, d) => { if (d < bd) { bd = d; best = o; } };
    this.w.inter.forEach(o => {
      if (o.kind === 'secret' && this.secretOpen) return;
      const dx = me.x - o.x, dy = me.y - o.y;
      if (o.rx) { const e = (dx * dx) / (o.rx * o.rx) + (dy * dy) / (o.ry * o.ry); if (e <= 1) consider(o, e * 20); return; }
      const d = Math.hypot(dx, dy); if (d <= o.r) consider(o, d);
    });
    if (this.npc) { const d = Math.hypot(me.x - this.npc.x, me.y - this.npc.y); if (d < 26 && !this.fog) consider({ id: 'npc', kind: 'npc' }, d - 6); }
    this.players.forEach(p => { if (p.isMe) return; const d = Math.hypot(me.x - p.x, me.y - p.y); if (d < 26) consider({ id: 'p:' + p.uid, kind: 'player', uid: p.uid }, d - 4); });
    const id = best ? best.id : null;
    if (id !== this.hintId) { this.hintId = id; this.hint = best; RO.emit('hint', best); }
  }
  interact() { if (this.hint) RO.emit('interact', this.hint); }

  /* ════════════ CLUB PRIVADO ════════════ */
  // garage y club abiertos y visibles desde el inicio
  openVip() {
    this.openSecret(true, true);
    this.vipSeen = true; this.clubSeen = true;
    if (this.fog) { this.fog.destroy(); this.fog = null; }
    if (this.fogClub) { this.fogClub.destroy(); this.fogClub = null; }
  }
  revealClub() {
    if (this.clubSeen) return; this.clubSeen = true;
    if (this.fogClub) this.tweens.add({ targets: this.fogClub, alpha: 0, duration: 900, onComplete: () => { this.fogClub.destroy(); this.fogClub = null; } });
    RO.emit('club:found');
  }
  drawClub() {
    const C = Wd.CLUB, add = o => { this.fx.push(o); return o; };
    // piso LED frente al escenario
    this.led = [];
    const LEDC = [0xe85b9c, 0x7c3aed, 0x22d3ee, 0xe6f03b, 0x3ddc84];
    for (let y = 62; y <= 65; y++) for (let x = 18; x <= 38; x++) {
      const r = add(this.add.rectangle(x * T + 1, y * T + 1, T - 2, T - 2, LEDC[(x + y) % 5], 0.16).setOrigin(0).setDepth(-5.8e5).setBlendMode(Phaser.BlendModes.ADD));
      this.led.push(r);
    }
    // focos sobre cada tubo
    this.spots = this.w.dancers.map((d, i) => {
      const c = [0xe85b9c, 0xa855f7, 0x22d3ee][i % 3];
      const cone = add(this.add.triangle(d.x, 56 * T - 8, 0, 0, -22, 70, 22, 70, c, 0.13).setOrigin(0.5, 0).setDepth(9e4).setBlendMode(Phaser.BlendModes.ADD));
      const pool = add(this.add.ellipse(d.x, d.y + 2, 46, 18, c, 0.32).setDepth(-5.7e5).setBlendMode(Phaser.BlendModes.ADD));
      this.tweens.add({ targets: [cone, pool], alpha: { from: 0.55, to: 1 }, duration: 480, yoyo: true, repeat: -1, delay: i * 160 });
      return { cone, pool };
    });
    // láseres desde la cabina del DJ
    const LZ = [0xff2d6f, 0x22d3ee, 0x3ddc84, 0xa855f7];
    for (let i = 0; i < 6; i++) {
      const l = add(this.add.rectangle(42.5 * T, 57.4 * T, 1, 230, LZ[i % 4], 0.5).setOrigin(0.5, 0).setDepth(9.1e4).setBlendMode(Phaser.BlendModes.ADD));
      l.angle = 30 + i * 20;
      this.tweens.add({ targets: l, angle: { from: 25 + i * 18, to: 120 + i * 14 }, duration: 1800 + i * 260, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    // reflejos de la bola disco
    for (let i = 0; i < 14; i++) {
      const d = add(this.add.rectangle(Phaser.Math.Between(C.x0 + 1, C.x1 - 1) * T, Phaser.Math.Between(C.y0 + 2, C.y1) * T, 2, 2, 0xffffff, 0.7).setDepth(9.2e4).setBlendMode(Phaser.BlendModes.ADD));
      const hop = () => this.tweens.add({ targets: d, x: Phaser.Math.Between(C.x0 + 1, C.x1 - 1) * T, y: Phaser.Math.Between(C.y0 + 2, C.y1) * T, duration: Phaser.Math.Between(1600, 3200), onComplete: hop });
      hop();
    }
    // neón en el muro del fondo del club
    const sign = add(this.add.image(28.5 * T, 55 * T + 1, this.tex('clubsign', () => A.pixelText('RUEDDA · CLUB', '#ff7ab8', 1))).setOrigin(0.5, 0).setDepth(-4e5 + 6));
    const sg = add(this.add.ellipse(28.5 * T, 55 * T + 4, 120, 18, 0xe85b9c, 0.25).setDepth(-4e5 + 5).setBlendMode(Phaser.BlendModes.ADD));
    this.tweens.add({ targets: sg, alpha: { from: 0.15, to: 0.4 }, duration: 900, yoyo: true, repeat: -1 });
    void sign;
    // destello (strobe) para el "drop"
    this.strobe = add(this.add.rectangle(C.x0 * T, 54 * T, (C.x1 - C.x0 + 1) * T, (C.y1 - 54 + 1) * T, 0xffffff, 0).setOrigin(0).setDepth(9.3e4).setBlendMode(Phaser.BlendModes.ADD));
    // el piso LED cambia aunque no suene la música
    if (this.ledTimer) this.ledTimer.remove();
    this.ledTimer = this.time.addEvent({ delay: 484, loop: true, callback: () => { if (!RO.music || !RO.music.timer) this.beat(false); } });
    if (!this._beatHook) this._beatHook = RO.on('beat', (st, drop) => this.beat(drop));
  }
  beat(drop) {
    if (!this.led) return;
    const LEDC = [0xe85b9c, 0x7c3aed, 0x22d3ee, 0xe6f03b, 0x3ddc84];
    this.led.forEach(r => { if (!r.scene) return; r.fillColor = LEDC[Math.floor(Math.random() * 5)]; r.fillAlpha = Math.random() < (drop ? 0.8 : 0.55) ? (drop ? 0.4 : 0.22) : 0.05; });
    if (drop && this.strobe && this.strobe.scene) { this.strobe.fillAlpha = 0.22; this.tweens.add({ targets: this.strobe, fillAlpha: 0, duration: 140 }); }
  }
  makeDancers() {
    this.dancers = this.w.dancers.map((d, i) => {
      const key = this.avTex(A.DANCERS[i % A.DANCERS.length]);
      const spr = this.add.sprite(d.x, d.y, key, '0_0').setOrigin(0.5, 22 / 24);
      return { spr, x: d.x, y: d.y, ph: i * 2.1, dir: 'down' };
    });
  }
  updateDancers(time) {
    if (!this.dancers) return;
    const t = time / 1000, fast = RO.music && RO.music.drop > 0 ? 1.8 : 1;
    this.dancers.forEach(d => {
      const a = t * 1.7 * fast + d.ph, orbit = Math.sin(a), front = Math.cos(a) > 0;
      const climb = Math.max(0, Math.sin(t * 0.45 + d.ph)) * 10;
      d.spr.setPosition(d.x + orbit * 6, d.y - climb + (front ? 1 : -1));
      d.dir = Math.abs(orbit) < 0.35 ? (front ? 'down' : 'up') : orbit > 0 ? 'left' : 'right';
      d.spr.setDepth(d.y + (front ? 4 : -4));
      this.setFrame(d, true, time * (0.7 + 0.3 * fast));
    });
  }
  moneyRain() {
    const C = Wd.CLUB;
    for (let k = 0; k < 46; k++) {
      const x = Phaser.Math.Between(20, 36) * T + Math.random() * T, y0 = 54 * T + Math.random() * 20;
      const b = this.add.rectangle(x, y0, 4, 2, 0x3fa45e).setDepth(9.4e4).setStrokeStyle(0.5, 0x7fdb95);
      this.tweens.add({ targets: b, y: Phaser.Math.Between(58, 61) * T + Math.random() * T, angle: Phaser.Math.Between(-360, 360), duration: 1100 + Math.random() * 900, delay: Math.random() * 600, ease: 'Sine.easeIn',
        onComplete: () => this.tweens.add({ targets: b, alpha: 0, duration: 900, delay: 1600, onComplete: () => b.destroy() }) });
    }
    void C;
  }

  /* ════════════ VALENTINA (NPC) ════════════ */
  makeNpc() {
    const key = this.tex('npc_sheet', () => A.npcSheet());
    const t = this.textures.get(key);
    if (!t.has('0_0')) for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) t.add(r + '_' + c, 0, c * 16, r * 24, 16, 24);
    const [sx, sy] = this.w.npcPath[0];
    const spr = this.add.sprite((sx + .5) * T, (sy + .75) * T, key, '0_0').setOrigin(0.5, 22 / 24);
    const el = document.createElement('div'); el.className = 'w-ent npc';
    el.innerHTML = '<div class="w-bub"></div><div class="w-tag"><i class="st-vip"></i><span></span></div>';
    el.querySelector('span').textContent = RO.S.config.npc.name || 'Valentina';
    this.overlay.appendChild(el);
    this.npc = { spr, x: spr.x, y: spr.y, dir: 'down', path: null, idx: 0, wait: 0, talkUntil: 0, tag: el, nextAmbient: 0, last: -1 };
  }
  updateNpc(time, dt) {
    const n = this.npc; if (!n) return;
    let moving = false;
    if (n.talkUntil > time) {
      const dx = this.me.x - n.x, dy = this.me.y - n.y;
      n.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
    } else if (n.wait > time) { /* posa */ }
    else {
      if (!n.path || !n.path.length) {
        n.idx = (n.idx + 1) % this.w.npcPath.length;
        const [gx, gy] = this.w.npcPath[n.idx];
        n.path = Wd.path(this.blocked, Math.floor(n.x / T), Math.floor(n.y / T), gx, gy) || [];
        if (!n.path.length) n.wait = time + 1500;
      } else {
        const [tx, ty] = n.path[0], gx = (tx + .5) * T, gy = (ty + .75) * T, dx = gx - n.x, dy = gy - n.y, d = Math.hypot(dx, dy);
        if (d < 1.5) { n.path.shift(); if (!n.path.length) n.wait = time + 1800 + Math.random() * 3200; }
        else {
          const s = Math.min(d, 46 * dt / 1000); n.x += dx / d * s; n.y += dy / d * s; moving = true;
          n.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
        }
      }
    }
    n.spr.setPosition(n.x, n.y).setDepth(n.y);
    this.setFrame(n, moving, time);
    // frase espontánea si alguien anda cerca
    if (!this.fog && time > n.nextAmbient && Math.hypot(this.me.x - n.x, this.me.y - n.y) < 70) {
      n.nextAmbient = time + 30000 + Math.random() * 25000; this.npcSay(true);
    }
  }
  npcSay(ambient) {
    const n = this.npc; if (!n) return;
    const ph = RO.S.config.npc.phrases || []; if (!ph.length) return;
    let i; do { i = Math.floor(Math.random() * ph.length); } while (ph.length > 1 && i === n.last); n.last = i;
    this.bubble({ bub: n.tag.querySelector('.w-bub') }, ph[i], 6500);
    n.talkUntil = this.time.now + (ambient ? 2500 : 6000);
    RO.sfx.talk();
  }

  /* ════════════ OVERLAY DOM (nombres y globos nítidos) ════════════ */
  layoutOverlay() {
    const cam = this.cameras.main, z = cam.zoom, wv = cam.worldView;
    const place = (el, x, y, hidden) => {
      if (hidden) { if (el.style.display !== 'none') el.style.display = 'none'; return; }
      if (el.style.display === 'none') el.style.display = '';
      el.style.transform = `translate3d(${Math.round((x - wv.x) * z)}px,${Math.round((y - wv.y) * z)}px,0)`;
    };
    this.players.forEach(p => place(p.tag, p.x, p.y - 24, !p.isMe && ((this.fog && p.y > 39 * T) || (this.fogClub && p.y > 54 * T))));
    if (this.npc) place(this.npc.tag, this.npc.x, this.npc.y - 24, !!this.fog);
    if (this.marker) { /* el marcador es de Phaser */ }
  }

  /* ════════════ PUNTERO ════════════ */
  onPointer(p, down) {
    if (RO.uiBusy && RO.uiBusy()) return;
    const tx = Math.floor(p.worldX / T), ty = Math.floor(p.worldY / T);
    if (this.edit) {
      const it = A.ITEMS[this.edit.item];
      if (this.edit.mode === 'place' && it) {
        const ok = this.canPlace(this.edit.item, tx, ty);
        if (!this.ghost) this.ghost = this.add.image(0, 0, this.itemTex(this.edit.item, {})).setOrigin(0, 1).setAlpha(.7).setDepth(9.5e5);
        this.ghost.setPosition(tx * T + (it.fw * T - it.w) / 2, (ty + it.fh) * T).setTint(ok ? 0xffffff : 0xff4a4a);
        if (down && p.leftButtonDown()) { if (ok) RO.emit('edit:place', this.edit.item, tx, ty); else RO.sfx.err(); }
        if (down && p.rightButtonDown()) RO.emit('edit:cancel');
        return;
      }
      if (this.edit.mode === 'move') {
        let hit = null;
        this.decorSpr.forEach(spr => { const d = spr._d, it2 = A.ITEMS[d.item]; if (tx >= d.x && tx < d.x + it2.fw && ty >= d.y - (it2.h > it2.fh * T ? 1 : 0) && ty < d.y + it2.fh) hit = d; });
        this.decorSpr.forEach(spr => spr.clearTint());
        if (hit) this.decorSpr.get(String(hit.id)).setTint(0xe6f03b);
        if (down && hit && p.leftButtonDown()) RO.emit('edit:pick', hit);
        return;
      }
    }
    if (!down || !p.leftButtonDown()) return;
    // clic sobre otro jugador → su tarjeta
    for (const pl of this.players.values()) if (!pl.isMe && Math.abs(p.worldX - pl.x) < 8 && p.worldY < pl.y + 2 && p.worldY > pl.y - 24) { RO.emit('player:click', pl.uid); return; }
    this.walkTo(tx, ty);
  }
  walkTo(tx, ty, done) {
    const me = this.me;
    const path = Wd.path(this.blocked, Math.floor(me.x / T), Math.floor(me.y / T), tx, ty);
    if (!path) { RO.sfx.err(); return false; }
    this.path = path; this.pathDone = done || null;
    this.showMarker(tx, ty);
    return true;
  }
  showMarker(tx, ty) {
    this.hideMarker();
    this.marker = this.add.rectangle((tx + .5) * T, (ty + .5) * T, 10, 10).setStrokeStyle(1, 0xe6f03b, 1).setDepth(-5e5);
    this.tweens.add({ targets: this.marker, scale: 0.5, alpha: .3, duration: 500, yoyo: true, repeat: -1 });
  }
  hideMarker() { if (this.marker) { this.marker.destroy(); this.marker = null; } }
  setEdit(e) {
    this.edit = e;
    if (this.ghost) { this.ghost.destroy(); this.ghost = null; }
    this.decorSpr.forEach(s => s.clearTint());
    this.input.mouse && this.input.mouse.disableContextMenu();
  }
  teleport(x, y, dir) {
    const me = this.me; const cam = this.cameras.main;
    cam.flash(250, 230, 240, 59);
    me.x = x; me.y = y; if (dir) me.dir = dir; me.spr.setPosition(x, y); this.path = null;
    this.sendPos(0); this.announceRoom();
  }
};
}

/* ════════════ API PARA LA UI ════════════ */
G.start = () => new Promise((res, rej) => {
  const fail = e => { cleanup(); rej(e instanceof Error ? e : new Error(String(e && e.message || e))); };
  const onErr = ev => fail(ev.error || ev.message || 'error del motor gráfico');
  const onRej = ev => fail(ev.reason || 'error del motor gráfico');
  const t = setTimeout(() => fail(new Error('el motor gráfico no respondió')), 25000);
  const cleanup = () => { clearTimeout(t); once(); removeEventListener('error', onErr); removeEventListener('unhandledrejection', onRej); };
  const once = RO.on('game:ready', () => { cleanup(); res(); });
  addEventListener('error', onErr); addEventListener('unhandledrejection', onRej);
  G.game = new Phaser.Game({
    type: /[?&]canvas\b/.test(location.search) ? Phaser.CANVAS : Phaser.AUTO, parent: 'phaser', backgroundColor: '#07080a',
    pixelArt: true, roundPixels: true, antialias: false,
    scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
    input: { keyboard: false, gamepad: false },
    banner: false, disableContextMenu: true,
    fps: { target: 60, smoothStep: true },
    scene: [defineScene()]
  });
});
const S = () => G.scene;
G.rebuild = () => { const s = S(); if (s) { s.buildWorld(); s.players.forEach(p => s.refreshTag(p)); } };
G.syncDecor = () => S() && S().syncDecor();
G.drawPostits = () => S() && S().drawPostits();
G.refreshPlayer = uid => S() && S().refreshPlayer(uid);
G.refreshTags = () => { const s = S(); if (s) { s.players.forEach(p => s.refreshTag(p)); s.refreshLeds(); } };
G.drawClocks = () => { const s = S(); if (s) { s.drawClocks(); s.tickClocks(); } };
G.interact = () => S() && S().interact();
G.setEdit = e => S() && S().setEdit(e);
G.bubbleMe = text => { const s = S(); if (s) s.bubble(s.me, text); };
G.bubbleOf = (uid, text) => { const s = S(); const p = s && s.players.get(uid); if (p) s.bubble(p, text); };
G.npcSay = () => S() && S().npcSay(false);
G.openSecret = (remote, quiet) => S() && S().openSecret(remote, quiet);
G.coffee = () => { const s = S(); if (s) s.coffeeUntil = s.time.now + 45000; };
G.updateBoardMini = c => S() && S().updateBoardMini(c);
G.me = () => S() && S().me;
G.mePos = () => { const s = S(); return s ? { x: s.me.x, y: s.me.y, room: s.me.room, dir: s.me.dir } : null; };
G.playerPos = uid => { const s = S(); const p = s && s.players.get(uid); return p ? { x: p.x, y: p.y, room: p.room } : null; };
G.goTo = uid => {
  const s = S(); if (!s) return;
  const p = s.players.get(uid); if (!p) return;
  const ok = s.walkTo(Math.floor(p.x / T), Math.floor(p.y / T) + 1);
  if (!ok) s.teleport(p.x, p.y + 12);
};
G.goToOffice = pos => { const s = S(); if (!s) return; const t = s.w.officeSpawn(pos); s.walkTo(Math.floor(t.x / T), Math.floor(t.y / T)) || s.teleport(t.x, t.y); };
G.goToSpot = (x, y) => { const s = S(); if (!s) return; s.walkTo(x, y) || s.teleport((x + .5) * T, (y + .7) * T); };
G.teleport = (x, y, dir) => S() && S().teleport(x, y, dir);
G.seats = () => S() ? S().w.seats : [];
G.save = () => S() && S().savePos();
G.inOtherOffice = (x, y) => S() ? S().inOtherOffice(x, y) : true;
G.zoom = d => S() && S().zoomStep(d);
G.zoomLevel = () => S() ? S().cameras.main.zoom : 3;
G.layout = () => S() && S().applyBounds();
G.goVip = where => {
  const s = S(); if (!s) return;
  if (RO.S.config.vip_enabled === false) return RO.emit('toast', 'El garage está deshabilitado por un admin');
  s.openVip();
  const [x, y] = where === 'club' ? [28, 64] : [28, 46];
  s.teleport((x + .5) * T, (y + .7) * T, 'down');
};
G.moneyRain = () => S() && S().moneyRain();
G.drop = () => { const s = S(); if (!s) return; if (RO.music) RO.music.boost(); s.beat(true); s.cameras.main.shake(300, 0.002); };

// red → escena
G.onPos = m => {
  const s = S(); if (!s || m.u === RO.S.me.user_id) return;
  let p = s.players.get(m.u);
  if (!p) { if (!RO.member(m.u)) return; p = s.addPlayer(m.u, m.x, m.y, false); }
  p.tx = m.x; p.ty = m.y; p.dir = m.d || p.dir; p.moving = !!m.m; p.room = m.r;
};
G.onPresence = list => {
  const s = S(); if (!s) return;
  const ids = new Set(list.map(x => x.uid));
  s.players.forEach((p, uid) => { if (!p.isMe && !ids.has(uid)) s.removePlayer(uid); });
  list.forEach(st => {
    if (st.uid === RO.S.me.user_id || !RO.member(st.uid)) return;
    if (!s.players.has(st.uid) && st.x != null) { const p = s.addPlayer(st.uid, st.x, st.y, false); p.room = st.room; p.dir = st.dir || 'down'; }
  });
  G.refreshTags();
};
G.carFx = idx => {
  const s = S(); if (!s || !s.carSpr) return;
  const c = s.carSpr.find(z => z.c.i === idx); if (!c) return;
  if (!s.fog) RO.sfx.engine();
  s.tweens.add({ targets: c.spr, x: c.spr.x + 1, duration: 40, yoyo: true, repeat: 14 });
  s.tweens.add({ targets: c.under, alpha: 0.7, duration: 120, yoyo: true, repeat: 5 });
  for (let i = 0; i < 8; i++) {
    const puff = s.add.circle(c.spr.x - 34, c.spr.y + (i % 2 ? 6 : -6), 2 + Math.random() * 2, 0x9aa0a6, 0.6).setDepth(c.spr.depth + 1);
    s.tweens.add({ targets: puff, x: puff.x - 20 - Math.random() * 20, y: puff.y + (Math.random() - .5) * 12, alpha: 0, scale: 3, duration: 900 + i * 90, delay: i * 70, onComplete: () => puff.destroy() });
  }
};
G.fxBoost = () => {
  const s = S(); if (!s) return;
  s.players.forEach(p => {
    const order = ['down', 'left', 'up', 'right']; let i = 0;
    const ev = s.time.addEvent({ delay: 70, repeat: 24, callback: () => { p.dir = order[i++ % 4]; } });
    s.tweens.add({ targets: p.spr, y: p.spr.y - 6, duration: 180, yoyo: true, repeat: 4, ease: 'Sine.easeOut' });
    for (let k = 0; k < 16; k++) {
      const c = s.add.rectangle(p.x, p.y - 10, 2, 2, [0xe6f03b, 0xffffff, 0x3ddc84][k % 3]).setDepth(9e5);
      const a = Math.random() * Math.PI * 2, r = 20 + Math.random() * 30;
      s.tweens.add({ targets: c, x: p.x + Math.cos(a) * r, y: p.y - 10 + Math.sin(a) * r, alpha: 0, duration: 900, delay: k * 30, onComplete: () => c.destroy() });
    }
    void ev;
  });
  s.cameras.main.shake(500, 0.003);
};
G.fxConfetti = () => {
  const s = S(); if (!s) return; const me = s.me;
  for (let k = 0; k < 60; k++) {
    const c = s.add.rectangle(me.x + (Math.random() - .5) * 160, me.y - 90 - Math.random() * 40, 2, 3, [0xe6f03b, 0xe85b9c, 0x22d3ee, 0x3ddc84, 0xffffff][k % 5]).setDepth(9e5);
    s.tweens.add({ targets: c, y: c.y + 140 + Math.random() * 60, x: c.x + (Math.random() - .5) * 40, angle: 360, alpha: 0, duration: 1600 + Math.random() * 900, delay: Math.random() * 400, onComplete: () => c.destroy() });
  }
};
G.fxHi5 = uid => {
  const s = S(); if (!s) return; const p = s.players.get(uid), me = s.me; if (!p) return;
  const x = (p.x + me.x) / 2, y = Math.min(p.y, me.y) - 18;
  const star = s.add.star(x, y, 5, 3, 8, 0xe6f03b).setDepth(9e5).setScale(0.2);
  s.tweens.add({ targets: star, scale: 1.4, alpha: 0, angle: 90, duration: 600, onComplete: () => star.destroy() });
};
})();
