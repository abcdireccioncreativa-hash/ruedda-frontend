'use strict';
/* ════════════════════════════════════════════════════════════════
   RUEDDA OFFICE — núcleo: estado, bus de eventos, red y datos.
   · Misma sesión que la app y /control (storageKey 'ruedda-auth').
   · Todo pasa por RLS (office_is_member / office_is_admin) y RPCs.
   · Movimiento, presencia, chat y pizarra viajan por el canal privado
     'office:main' (Realtime Authorization).
   · Modo demo SOLO en localhost con ?demo: datos en localStorage y
     multijugador entre pestañas con BroadcastChannel (para probar).
   ════════════════════════════════════════════════════════════════ */
(function(){
const RO = window.RO = window.RO || {};
RO.DEMO = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && /[?&]demo\b/.test(location.search);

/* ── utilidades ── */
RO.$ = s => document.querySelector(s);
RO.$$ = s => Array.from(document.querySelectorAll(s));
RO.esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
RO.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
RO.ago = ts => {
  if (!ts) return '—'; const s = (Date.now() - new Date(ts).getTime()) / 1000;
  if (s < 60) return 'ahora'; if (s < 3600) return Math.floor(s / 60) + ' min';
  if (s < 86400) return Math.floor(s / 3600) + ' h'; return Math.floor(s / 86400) + ' d';
};
RO.uid = () => Math.random().toString(36).slice(2, 10);

/* ── bus ── */
const LST = {};
RO.on = (e, f) => { (LST[e] = LST[e] || []).push(f); return () => { LST[e] = (LST[e] || []).filter(x => x !== f); }; };
RO.emit = (e, ...a) => { (LST[e] || []).slice().forEach(f => { try { f(...a); } catch (err) { console.error('[office]', e, err); } }); };

/* ── configuración por defecto (se mezcla con la de la base) ── */
RO.DEFAULT_CONFIG = {
  offices: [
    { slot: 'yo',     username: '',       name: 'Dirección', cargo: 'Dirección', theme: 'nogal',    pos: 0, owner_superadmin: true },
    { slot: 'ruben',  username: 'ruben',  name: 'Rubén',     cargo: 'Socio',     theme: 'madera',   pos: 1 },
    { slot: 'ivan',   username: 'ivan',   name: 'Iván',      cargo: 'Socio',     theme: 'alfombra', pos: 2 },
    { slot: 'felipe', username: 'felipe', name: 'Felipe',    cargo: 'Socio',     theme: 'concreto', pos: 3 }
  ],
  clocks: [
    { label: 'Caracas', tz: 'America/Caracas' },
    { label: 'Bogotá',  tz: 'America/Bogota' },
    { label: 'Ontario', tz: 'America/Toronto' }
  ],
  rooms: {
    pasillo: 'Pasillo', juntas: 'Sala de juntas', lobby: 'Recepción', creativa: 'Sala creativa',
    ocio: 'Zona de ocio', terraza: 'Terraza', garage: 'El Garage'
  },
  npc: {
    name: 'Valentina',
    phrases: [
      'Véndeme este carro. ¿No puedes? Entonces vuelve a tu escritorio.',
      'El café es gratis. Las excusas no.',
      'Aquí no se camina, se acelera.',
      '¿Otra reunión? Que sea para cerrar un trato.',
      'Ese deportivo no se va a pagar solo, cariño.',
      'Primero lo cierras, después lo celebras. En ese orden.',
      'Si tu meta no te da miedo, es una lista de compras.',
      'El cliente dijo que no. Traduzco: todavía no.',
      'Trabaja en silencio y que el ruido lo haga el motor.',
      'Hoy se vende. Mañana se vende más.',
      'Yo no persigo carros. Los carros llegan a Ruedda.',
      '¿Burnout? Aquí los únicos burnouts son en la pista.',
      'Tienes cara de alguien que va a cerrar algo grande hoy.',
      'Las llaves de este garage se ganan, no se piden.',
      'Menos memes en el grupo, más publicaciones en el market.',
      'El dinero nunca duerme. Pero tú sí deberías, se te nota.',
      '¿Viste ese 700? Eso es lo que pasa cuando nadie se rinde.'
    ]
  },
  cars: [
    { name: 'RUEDDA GT 700',    color: '#e6f03b', type: 'super' },
    { name: 'Rosso Corsa V12',  color: '#d7262e', type: 'super' },
    { name: 'Phantom Noir',     color: '#16171b', type: 'luxe' },
    { name: 'Blanco 911',       color: '#eceff3', type: 'gt' },
    { name: 'Verde Monza',      color: '#1f7a4a', type: 'gt' },
    { name: 'Midnight G-Wagon', color: '#2b3442', type: 'suv' },
    { name: 'Viola Hypercar',   color: '#7c3aed', type: 'super' }
  ],
  motd: 'Centro virtual de oficinas de Ruedda Ecosystem.',
  boost_cooldown_min: 10,
  boost_points: 15,
  vip_enabled: true
};

RO.THEMES = {
  nogal:    { name: 'Nogal',      floor: 'wood',   a: '#6b4a32', b: '#5c3f2a', wall: '#2a2522' },
  madera:   { name: 'Roble',      floor: 'wood',   a: '#b48a5a', b: '#a27a4d', wall: '#3a332d' },
  alfombra: { name: 'Alfombra',   floor: 'carpet', a: '#3b4a5e', b: '#34425a', wall: '#262b33' },
  concreto: { name: 'Concreto',   floor: 'tile',   a: '#9aa0a6', b: '#8f959b', wall: '#2c2f33' },
  marmol:   { name: 'Mármol',     floor: 'marble', a: '#e7e4dd', b: '#d9d5cc', wall: '#34312d' },
  neon:     { name: 'Neón',       floor: 'tile',   a: '#1b1630', b: '#211a3c', wall: '#120e20' },
  ruedda:   { name: 'Ruedda',     floor: 'tile',   a: '#1d1e22', b: '#24262b', wall: '#111214' },
  verde:    { name: 'Bosque',     floor: 'carpet', a: '#3a5a45', b: '#33503d', wall: '#232b25' }
};

function mergeConfig(c) {
  const d = RO.DEFAULT_CONFIG, o = Object.assign({}, d, c || {});
  o.npc = Object.assign({}, d.npc, (c && c.npc) || {});
  o.rooms = Object.assign({}, d.rooms, (c && c.rooms) || {});
  if (!Array.isArray(o.offices) || !o.offices.length) o.offices = d.offices;
  if (!Array.isArray(o.clocks) || !o.clocks.length) o.clocks = d.clocks;
  if (!Array.isArray(o.cars) || !o.cars.length) o.cars = d.cars;
  if (!Array.isArray(o.npc.phrases) || !o.npc.phrases.length) o.npc.phrases = d.npc.phrases;
  return o;
}
RO.mergeConfig = mergeConfig;

/* ── estado ── */
RO.S = {
  me: null, members: [], config: mergeConfig({}), catalog: [], decor: [], notes: [], events: [], positions: [], chat: [],
  online: new Map(),           // uid -> presencia
  status: 'disponible'
};
RO.member = uid => RO.S.members.find(m => m.user_id === uid);
RO.memberBySlot = slot => RO.S.members.find(m => m.slot === slot);
RO.isAdmin = () => !!(RO.S.me && (RO.S.me.is_admin || RO.S.me._superadmin));
RO.nameOf = uid => { const m = RO.member(uid); return m ? m.display_name : 'Alguien'; };

/* ════════════ RED REAL (Supabase) ════════════ */
const SB_URL = 'https://ltodsegzbbdcaublkgtp.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0b2RzZWd6YmJkY2F1YmxrZ3RwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MjIwOTgsImV4cCI6MjA5NTI5ODA5OH0.WXbnE5_XfNwwVUtDGSWa6Voetcflcl7m2vDOpEofs_w';
let sb = null;
const client = () => sb || (sb = supabase.createClient(SB_URL, SB_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'ruedda-auth' },
  realtime: { params: { eventsPerSecond: 40 } }
}));
const isMissing = e => !!e && (['42P01', 'PGRST205', '42883', 'PGRST202'].includes(e.code) || /does not exist|schema cache|could not find the function/i.test(e.message || ''));
const chk = r => { if (r.error) throw r.error; return r.data; };

const Real = {
  async session() { const { data: { session } } = await client().auth.getSession(); return session; },
  async signIn(email, password) { const { error } = await client().auth.signInWithPassword({ email, password }); if (error) throw error; },
  async signOut() { await client().auth.signOut().catch(() => {}); },
  async join() {
    const { data, error } = await client().rpc('office_join');
    if (error) { if (isMissing(error)) { const e = new Error('missing'); e.code = 'MISSING'; throw e; } throw error; }
    const { data: u } = await client().from('users').select('role').eq('id', (await this.session()).user.id).maybeSingle();
    if (data && data.member) data.member._superadmin = !!(u && u.role === 'superadmin');
    return data;
  },
  async loadAll() {
    const s = client();
    const r = await Promise.all([
      s.from('office_members').select('*'),
      s.from('office_config').select('data,channel_key').eq('id', 1).maybeSingle(),
      s.from('office_catalog').select('*').order('sort'),
      s.from('office_decor').select('*'),
      s.from('office_notes').select('*').order('created_at', { ascending: false }).limit(200),
      s.from('office_events').select('*').order('created_at', { ascending: false }).limit(40),
      s.from('office_positions').select('*'),
      s.from('office_chat').select('*').order('created_at', { ascending: false }).limit(80)
    ]);
    r.forEach(chk);
    return { members: r[0].data, config: (r[1].data && r[1].data.data) || {}, channelKey: r[1].data && r[1].data.channel_key,
             catalog: r[2].data, decor: r[3].data, notes: r[4].data, events: r[5].data, positions: r[6].data, chat: (r[7].data || []).reverse() };
  },
  async connect(me, channelKey, H) {
    const s = client(); const session = await this.session();
    try { await s.realtime.setAuth(session.access_token); } catch (e) {}
    const open = (name, priv) => new Promise((res, rej) => {
      const ch = s.channel(name, { config: { private: priv, broadcast: { self: false, ack: false }, presence: { key: me.user_id } } });
      ch.on('broadcast', { event: 'm' }, ({ payload }) => H.onMsg(payload));
      ch.on('presence', { event: 'sync' }, () => {
        const st = ch.presenceState(), out = [];
        Object.keys(st).forEach(k => { const a = st[k]; if (a && a.length) out.push(a[a.length - 1]); });
        H.onPresence(out);
      });
      let done = false;
      const t = setTimeout(() => { if (!done) { done = true; s.removeChannel(ch); rej(new Error('timeout')); } }, 10000);
      ch.subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          if (this._track) ch.track(this._track).catch(() => {});
          if (!done) { done = true; clearTimeout(t); res(ch); }
          H.onStatus && H.onStatus('online');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          if (!done) { done = true; clearTimeout(t); s.removeChannel(ch); rej(err || new Error(status)); }
          else H.onStatus && H.onStatus('reconnecting');
        }
      });
    });
    try { this.ch = await open('office:main', true); }
    catch (e) {
      console.warn('[office] canal privado no disponible, usando canal con llave:', e && e.message);
      this.ch = await open('office-' + channelKey, false);
    }
    const db = s.channel('office-db-' + me.user_id);
    ['office_members', 'office_config', 'office_catalog', 'office_decor', 'office_notes', 'office_events', 'office_chat'].forEach(t =>
      db.on('postgres_changes', { event: '*', schema: 'public', table: t }, p => H.onDb(t, p.eventType, p.new, p.old)));
    db.subscribe();
    this.db = db;
  },
  send(msg) { if (this.ch) this.ch.send({ type: 'broadcast', event: 'm', payload: msg }).catch(() => {}); },
  track(state) { this._track = state; if (this.ch) this.ch.track(state).catch(() => {}); },
  async rpc(fn, args) {
    const { data, error } = await client().rpc(fn, args || {});
    if (error) throw error; return data;
  },
  saveAvatar: (target, av) => Real.rpc('office_save_avatar', { target, av }),
  award: kind => Real.rpc('office_award', { kind }),
  boost: participants => Real.rpc('office_boost', { participants }),
  buy: (item, x, y) => Real.rpc('office_buy', { p_item: item, p_x: x, p_y: y }),
  async placeFree(item, x, y) { return chk(await client().from('office_decor').insert({ item, x, y, placed_by: RO.S.me.user_id }).select().single()); },
  async moveDecor(id, x, y) { chk(await client().from('office_decor').update({ x, y }).eq('id', id)); },
  async removeDecor(id) { chk(await client().from('office_decor').delete().eq('id', id)); },
  async sendNote(to, body, color) { return chk(await client().from('office_notes').insert({ to_user: to, from_user: RO.S.me.user_id, body, color }).select().single()); },
  async readNote(id) { chk(await client().from('office_notes').update({ read_at: new Date().toISOString() }).eq('id', id)); },
  async deleteNote(id) { chk(await client().from('office_notes').delete().eq('id', id)); },
  async savePos(p) { await client().from('office_positions').upsert(Object.assign({ user_id: RO.S.me.user_id, updated_at: new Date().toISOString() }, p)); },
  async loadStrokes(board) { return chk(await client().from('office_strokes').select('id,color,size,pts,author').eq('board', board).order('id').limit(5000)); },
  async addStroke(board, st) { await client().from('office_strokes').insert({ board, color: st.color, size: st.size, pts: st.pts, author: RO.S.me.user_id }); },
  clearBoard: board => Real.rpc('office_clear_board', { p_board: board }),
  async sendChat(body) { chk(await client().from('office_chat').insert({ author: RO.S.me.user_id, body })); },
  async deleteChat(id) { chk(await client().from('office_chat').delete().eq('id', id)); },
  async logEvent(kind, payload) { await client().from('office_events').insert({ kind, actor: RO.S.me.user_id, payload: payload || {} }); },
  async saveConfig(data) { chk(await client().from('office_config').update({ data, updated_at: new Date().toISOString(), updated_by: RO.S.me.user_id }).eq('id', 1)); },
  async saveCatalog(row) { chk(await client().from('office_catalog').upsert(row)); },
  upsertMember: (target, slot, name, cargo, admin) => Real.rpc('office_upsert_member', { target, p_slot: slot, p_name: name, p_cargo: cargo, p_admin: admin }),
  async removeMember(uid) { chk(await client().from('office_members').delete().eq('user_id', uid)); },
  findUsers: q => Real.rpc('office_find_users', { q }),
  grant: (target, amount) => Real.rpc('office_grant', { target, amount }),
  async liveStats() {
    const s = client(), out = {};
    try { const r = await s.from('listings').select('id', { count: 'exact', head: true }); if (!r.error) out.listings = r.count; } catch (e) {}
    try { const r = await s.from('auctions').select('id', { count: 'exact', head: true }); if (!r.error) out.auctions = r.count; } catch (e) {}
    try { const r = await s.from('users').select('id', { count: 'exact', head: true }); if (!r.error) out.users = r.count; } catch (e) {}
    return out;
  }
};

/* ════════════ RED DEMO (solo localhost ?demo) ════════════ */
const DKEY = 'ro_demo_db_v1';
const DEMO_PEOPLE = [
  { user_id: 'u-yo',     slot: 'yo',     display_name: 'Jesús',  cargo: 'Dirección', is_admin: true },
  { user_id: 'u-ruben',  slot: 'ruben',  display_name: 'Rubén',  cargo: 'Socio' },
  { user_id: 'u-ivan',   slot: 'ivan',   display_name: 'Iván',   cargo: 'Socio' },
  { user_id: 'u-felipe', slot: 'felipe', display_name: 'Felipe', cargo: 'Socio' }
];
const SEED_CATALOG = [['planta','Planta',20,'plantas'],['planta_grande','Palmera',35,'plantas'],['bonsai','Bonsái',40,'plantas'],['silla','Silla',25,'muebles'],['escritorio','Escritorio',60,'muebles'],['sofa','Sofá',80,'muebles'],['puff','Puff',25,'muebles'],['estanteria','Estantería',55,'muebles'],['mesa','Mesa café',50,'muebles'],['monitor','Monitor',45,'tech'],['tv','Pantalla',90,'tech'],['servidor','Servidor',110,'tech'],['arcade','Arcade',150,'ocio'],['cafetera','Cafetera',70,'ocio'],['dispensador','Dispensador',35,'ocio'],['maquina_snacks','Snacks',85,'ocio'],['pecera','Pecera',130,'ocio'],['lampara','Lámpara',30,'deco'],['alfombra','Alfombra',40,'deco'],['cuadro','Cuadro',50,'deco'],['neon','Neón Ruedda',100,'deco'],['trofeo','Trofeo',120,'deco'],['estatua_oro','Estatua de oro',500,'deco']]
  .map((r, i) => ({ item: r[0], name: r[1], price: r[2], category: r[3], active: true, sort: i }));

const Demo = {
  _db() {
    let d = null; try { d = JSON.parse(localStorage.getItem(DKEY) || 'null'); } catch (e) {}
    if (!d) {
      d = { members: DEMO_PEOPLE.map(p => Object.assign({ avatar: {}, points: 0, coins: 300, is_admin: false }, p)),
            config: {}, catalog: SEED_CATALOG, decor: [], notes: [], events: [], positions: [], strokes: [], seq: 1 };
      localStorage.setItem(DKEY, JSON.stringify(d));
    }
    return d;
  },
  _save(d) { localStorage.setItem(DKEY, JSON.stringify(d)); },
  _mut(fn) { const d = this._db(); const r = fn(d); this._save(d); return r; },
  _db_ev(t, type, nw, old) { this.bc && this.bc.postMessage({ k: 'db', t, type, nw, old }); this.H && this.H.onDb(t, type, nw, old); },
  async session() { const u = sessionStorage.getItem('ro_demo_uid'); return u ? { user: { id: u, email: u + '@demo' } } : null; },
  async signIn(email) {
    const n = String(email || '').toLowerCase().split('@')[0].replace(/[^a-z]/g, '');
    const p = DEMO_PEOPLE.find(x => x.user_id === 'u-' + n) || DEMO_PEOPLE.find(x => x.display_name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') === n);
    if (!p) throw new Error('En demo usa: yo, ruben, ivan o felipe');
    sessionStorage.setItem('ro_demo_uid', p.user_id);
  },
  async signOut() { sessionStorage.removeItem('ro_demo_uid'); },
  async join() { const s = await this.session(); const m = this._db().members.find(x => x.user_id === s.user.id); return m ? { ok: true, member: Object.assign({}, m) } : { ok: false, reason: 'no_role' }; },
  async loadAll() { const d = this._db(); return { members: d.members, config: d.config, channelKey: 'demo', catalog: d.catalog, decor: d.decor, notes: d.notes.filter(n => n.to_user === RO.S.me.user_id || n.from_user === RO.S.me.user_id), events: d.events.slice(-40).reverse(), positions: d.positions, chat: (d.chat || []).slice(-80) }; },
  async connect(me, key, H) {
    this.H = H; this.peers = new Map();
    this.bc = new BroadcastChannel('ro-demo');
    this.bc.onmessage = ({ data }) => {
      if (data.k === 'm') H.onMsg(data.msg);
      else if (data.k === 'p') { this.peers.set(data.st.uid, { st: data.st, t: Date.now() }); this._sync(); }
      else if (data.k === 'bye') { this.peers.delete(data.uid); this._sync(); }
      else if (data.k === 'db') {
        if (data.t === 'office_notes' && data.nw && data.nw.to_user !== me.user_id && data.nw.from_user !== me.user_id) return;
        H.onDb(data.t, data.type, data.nw, data.old);
      }
    };
    setInterval(() => { if (this._track) this.bc.postMessage({ k: 'p', st: this._track }); this._sync(); }, 1500);
    addEventListener('beforeunload', () => this.bc.postMessage({ k: 'bye', uid: me.user_id }));
    await new Promise(r => setTimeout(r, 250));
    H.onStatus && H.onStatus('online');
  },
  _sync() {
    const now = Date.now(), out = [];
    this.peers.forEach((v, k) => { if (now - v.t < 5000) out.push(v.st); else this.peers.delete(k); });
    if (this._track) out.push(this._track);
    this.H && this.H.onPresence(out);
  },
  send(msg) { this.bc && this.bc.postMessage({ k: 'm', msg }); },
  track(st) { this._track = st; this.bc && this.bc.postMessage({ k: 'p', st }); this._sync(); },
  async saveAvatar(target, av) { const m = this._mut(d => { const m = d.members.find(x => x.user_id === target); m.avatar = av; return Object.assign({}, m); }); this._db_ev('office_members', 'UPDATE', m); },
  async award(kind) {
    const amt = { checkin: 10, highfive: 2, deal: 5, note: 1, whiteboard: 1, coffee: 1, arcade: 1 }[kind] || 1;
    const m = this._mut(d => { const m = d.members.find(x => x.user_id === RO.S.me.user_id); m.points += amt; m.coins += amt; return Object.assign({}, m); });
    this._db_ev('office_members', 'UPDATE', m); return { ok: true, amount: amt };
  },
  async boost(parts) {
    const ids = Array.from(new Set(parts.concat([RO.S.me.user_id]))); const pts = (RO.S.config.boost_points || 15) * ids.length;
    const ch = this._mut(d => d.members.filter(m => ids.includes(m.user_id)).map(m => { m.points += pts; m.coins += pts; return Object.assign({}, m); }));
    ch.forEach(m => this._db_ev('office_members', 'UPDATE', m)); return { ok: true, points: pts, count: ids.length };
  },
  async buy(item, x, y) {
    const c = this._db().catalog.find(k => k.item === item);
    const me = this._db().members.find(m => m.user_id === RO.S.me.user_id);
    if (me.coins < c.price) return { ok: false, reason: 'saldo' };
    const r = this._mut(d => { const m = d.members.find(z => z.user_id === me.user_id); m.coins -= c.price; const dec = { id: d.seq++, item, x, y, placed_by: me.user_id }; d.decor.push(dec); return { m: Object.assign({}, m), dec }; });
    this._db_ev('office_members', 'UPDATE', r.m); this._db_ev('office_decor', 'INSERT', r.dec); return { ok: true, decor: r.dec, coins: r.m.coins };
  },
  async placeFree(item, x, y) { const dec = this._mut(d => { const o = { id: d.seq++, item, x, y, placed_by: RO.S.me.user_id }; d.decor.push(o); return o; }); this._db_ev('office_decor', 'INSERT', dec); return dec; },
  async moveDecor(id, x, y) { const o = this._mut(d => { const o = d.decor.find(z => z.id === id); o.x = x; o.y = y; return Object.assign({}, o); }); this._db_ev('office_decor', 'UPDATE', o); },
  async removeDecor(id) { this._mut(d => { d.decor = d.decor.filter(z => z.id !== id); }); this._db_ev('office_decor', 'DELETE', null, { id }); },
  async sendNote(to, body, color) { const n = this._mut(d => { const n = { id: d.seq++, to_user: to, from_user: RO.S.me.user_id, body, color, read_at: null, created_at: new Date().toISOString() }; d.notes.push(n); return n; }); this._db_ev('office_notes', 'INSERT', n); return n; },
  async readNote(id) { const n = this._mut(d => { const n = d.notes.find(z => z.id === id); n.read_at = new Date().toISOString(); return Object.assign({}, n); }); this._db_ev('office_notes', 'UPDATE', n); },
  async deleteNote(id) { const n = this._mut(d => { const n = d.notes.find(z => z.id === id); d.notes = d.notes.filter(z => z.id !== id); return n; }); this._db_ev('office_notes', 'DELETE', null, n); },
  async savePos(p) { this._mut(d => { d.positions = d.positions.filter(z => z.user_id !== RO.S.me.user_id); d.positions.push(Object.assign({ user_id: RO.S.me.user_id }, p)); }); },
  async loadStrokes() { return this._db().strokes; },
  async addStroke(board, st) { this._mut(d => { d.strokes.push(st); if (d.strokes.length > 800) d.strokes.shift(); }); },
  async clearBoard() { this._mut(d => { d.strokes = []; }); },
  async sendChat(body) { const c = this._mut(d => { d.chat = d.chat || []; const c = { id: d.seq++, author: RO.S.me.user_id, body, created_at: new Date().toISOString() }; d.chat.push(c); d.chat = d.chat.slice(-200); return c; }); this._db_ev('office_chat', 'INSERT', c); },
  async deleteChat(id) { this._mut(d => { d.chat = (d.chat || []).filter(c => c.id !== id); }); this._db_ev('office_chat', 'DELETE', null, { id }); },
  async logEvent(kind, payload) { const e = this._mut(d => { const e = { id: d.seq++, kind, actor: RO.S.me.user_id, payload: payload || {}, created_at: new Date().toISOString() }; d.events.push(e); d.events = d.events.slice(-80); return e; }); this._db_ev('office_events', 'INSERT', e); },
  async saveConfig(data) { this._mut(d => { d.config = data; }); this._db_ev('office_config', 'UPDATE', { id: 1, data }); },
  async saveCatalog(row) { const r = this._mut(d => { const i = d.catalog.findIndex(c => c.item === row.item); if (i >= 0) d.catalog[i] = Object.assign(d.catalog[i], row); else d.catalog.push(row); return Object.assign({}, i >= 0 ? d.catalog[i] : row); }); this._db_ev('office_catalog', 'UPDATE', r); },
  async upsertMember(target, slot, name, cargo, admin) {
    const ch = this._mut(d => {
      const out = [];
      d.members.forEach(m => { if (slot && m.slot === slot && m.user_id !== target) { m.slot = null; out.push(Object.assign({}, m)); } });
      let m = d.members.find(x => x.user_id === target);
      if (!m) { m = { user_id: target, avatar: {}, points: 0, coins: 100 }; d.members.push(m); }
      Object.assign(m, { slot: slot || null, display_name: name, cargo, is_admin: !!admin }); out.push(Object.assign({}, m)); return out;
    });
    ch.forEach(m => this._db_ev('office_members', 'UPDATE', m));
  },
  async removeMember(uid) { this._mut(d => { d.members = d.members.filter(m => m.user_id !== uid); }); this._db_ev('office_members', 'DELETE', null, { user_id: uid }); },
  async findUsers(q) { q = String(q || '').replace(/^@/, '').toLowerCase(); return [{ id: 'u-enrique', nombre: 'Enrique', username: 'enrique', email: 'enrique@demo', role: 'particular' }, { id: 'u-maria', nombre: 'María', username: 'maria', email: 'maria@demo', role: 'particular' }].concat(DEMO_PEOPLE.map(p => ({ id: p.user_id, nombre: p.display_name, username: p.slot, email: p.slot + '@demo' }))).filter(u => (u.username + u.nombre).toLowerCase().includes(q)); },
  async grant(target, amount) { const m = this._mut(d => { const m = d.members.find(x => x.user_id === target); m.coins = Math.max(0, m.coins + amount); return Object.assign({}, m); }); this._db_ev('office_members', 'UPDATE', m); },
  async liveStats() { return { listings: 1284, auctions: 37, users: 9120 }; }
};

RO.Net = RO.DEMO ? Demo : Real;
RO.isMissing = isMissing;

/* ════════════ SONIDO (sintetizado, sin archivos) ════════════ */
let AC = null;
RO.muted = (() => { try { return localStorage.getItem('ro_mute') === '1'; } catch (e) { return false; } })();
RO.setMuted = v => { RO.muted = v; try { localStorage.setItem('ro_mute', v ? '1' : '0'); } catch (e) {} };
function tone(freq, dur, type, vol, when, slideTo) {
  if (RO.muted) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === 'suspended') AC.resume();
    const t = AC.currentTime + (when || 0), o = AC.createOscillator(), g = AC.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.05, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(AC.destination); o.start(t); o.stop(t + dur + 0.02);
  } catch (e) {}
}
RO.sfx = {
  blip:   () => tone(880, 0.06, 'square', 0.03),
  open:   () => { tone(520, 0.07, 'square', 0.03); tone(780, 0.08, 'square', 0.03, 0.06); },
  note:   () => { tone(1046, 0.1, 'triangle', 0.06); tone(1318, 0.14, 'triangle', 0.06, 0.1); tone(1568, 0.2, 'triangle', 0.05, 0.22); },
  coin:   () => { tone(988, 0.07, 'square', 0.04); tone(1319, 0.18, 'square', 0.04, 0.07); },
  siren:  () => { for (let i = 0; i < 4; i++) { tone(660, 0.35, 'sawtooth', 0.04, i * 0.7, 990); tone(990, 0.35, 'sawtooth', 0.04, i * 0.7 + 0.35, 660); } },
  boost:  () => { tone(110, 1.2, 'sawtooth', 0.05, 0, 880); tone(220, 1.2, 'square', 0.02, 0.1, 1760); },
  gong:   () => { tone(196, 2.2, 'sine', 0.12); tone(392, 1.6, 'sine', 0.05); tone(587, 1.2, 'sine', 0.03); },
  door:   () => { tone(70, 0.9, 'sawtooth', 0.05, 0, 40); tone(140, 0.5, 'square', 0.02, 0.4, 90); },
  talk:   () => { for (let i = 0; i < 5; i++) tone(500 + Math.random() * 300, 0.05, 'square', 0.025, i * 0.07); },
  engine: () => { tone(55, 1.4, 'sawtooth', 0.08, 0, 140); tone(80, 1.2, 'square', 0.03, 0.2, 220); },
  hi5:    () => { tone(1200, 0.05, 'square', 0.05); tone(300, 0.12, 'triangle', 0.05, 0.02); },
  err:    () => tone(160, 0.18, 'square', 0.04)
};
})();
