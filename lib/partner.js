// lib/partner.js — backend de RueddaCarreras · Partners (la web de los Dealer Partnerships Managers).
// Entra por /api/admin-user?partner=1 (límite de 12 funciones en Vercel, mismo patrón que office).
//
// · Los partners los crea el superadmin desde Ruedda Control (código de máximo 6 dígitos).
//   Cada partner es un JSON en un bucket PRIVADO de Storage (partners-private/p/<código>.json):
//   así no hace falta tabla nueva y los códigos nunca quedan legibles con la anon key.
// · El partner entra solo con su código. Con él puede crear concesionarios (cuenta + vitrina),
//   subir logo y portada, activar la vitrina y generar una clave nueva para compartirla.
//   Solo puede tocar los concesionarios que creó él (lista dealers de su JSON).

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const BUCKET = 'partners-private';
const PLAN_DIAS = 30;          // vitrina activada por un partner: 30 días, igual que el plan base del panel
const sleep = ms => new Promise(r => setTimeout(r, ms));

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
}

const clean = (v, max = 200) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, max);
const codeOk = c => /^\d{4,6}$/.test(String(c || ''));

let bucketOk = false;
async function ensureBucket(admin) {
  if (bucketOk) return;
  const { error } = await admin.storage.createBucket(BUCKET, { public: false });
  if (error && !/exist/i.test(error.message)) throw new Error('storage: ' + error.message);
  bucketOk = true;
}
async function readP(admin, code) {
  const { data, error } = await admin.storage.from(BUCKET).download(`p/${code}.json`);
  if (error || !data) return null;
  try { return JSON.parse(Buffer.from(await data.arrayBuffer()).toString('utf8')); } catch (e) { return null; }
}
async function writeP(admin, p) {
  const body = Buffer.from(JSON.stringify(p));
  const { error } = await admin.storage.from(BUCKET).upload(`p/${p.code}.json`, body, { upsert: true, contentType: 'application/json' });
  if (error) throw new Error('storage: ' + error.message);
}
const pub = p => ({ code: p.code, nombre: p.nombre, telefono: p.telefono || '', email: p.email || '', zona: p.zona || '',
  notas: p.notas || '', activo: p.activo !== false, created_at: p.created_at, total: (p.dealers || []).length });

async function dealersOf(admin, p) {
  const ids = (p.dealers || []).map(d => d.id);
  if (!ids.length) return [];
  const { data } = await admin.from('concesionarios')
    .select('id,nombre,ciudad,activo,logo_url,banner_url,plan_expiry,created_at,telefono,whatsapp').in('id', ids);
  const by = {}; (data || []).forEach(c => { by[c.id] = c; });
  const { data: pubs } = await admin.from('listings').select('concesionario_id').in('concesionario_id', ids).eq('estado', 'activa');
  const n = {}; (pubs || []).forEach(x => { n[x.concesionario_id] = (n[x.concesionario_id] || 0) + 1; });
  return p.dealers.slice().reverse().map(d => {
    const c = by[d.id];
    if (!c) return { id: d.id, nombre: d.nombre, email: d.email, borrado: true, created_at: d.created_at };
    const vence = c.plan_expiry ? new Date(c.plan_expiry) : null;
    return { id: c.id, nombre: c.nombre, ciudad: c.ciudad || '', email: d.email, telefono: c.whatsapp || c.telefono || '',
      activo: c.activo !== false && !(vence && vence < new Date()), plan_expiry: c.plan_expiry, logo: c.logo_url || '',
      banner: c.banner_url || '', created_at: c.created_at || d.created_at, publicaciones: n[c.id] || 0 };
  });
}

function genPass() {
  // fácil de dictar por teléfono: sin 0/O ni 1/l
  const A = 'abcdefghijkmnpqrstuvwxyz', N = '23456789';
  const pick = s => s[crypto.randomInt(s.length)];
  return 'Rd' + Array.from({ length: 4 }, () => pick(A)).join('') + Array.from({ length: 4 }, () => pick(N)).join('');
}

async function uploadImg(admin, id, kind, dataUrl) {
  const m = /^data:(image\/(jpeg|png|webp));base64,(.+)$/.exec(String(dataUrl || ''));
  if (!m) throw new Error('imagen inválida');
  const buf = Buffer.from(m[3], 'base64');
  if (buf.length > 3.5e6) throw new Error('la imagen pesa demasiado');
  const ext = m[2] === 'jpeg' ? 'jpg' : m[2];
  const path = `dealer_${kind}_${id}_${Date.now()}.${ext}`;
  const { error } = await admin.storage.from('assets').upload(path, buf, { contentType: m[1], upsert: false });
  if (error) throw new Error('storage: ' + error.message);
  return admin.storage.from('assets').getPublicUrl(path).data.publicUrl;
}

// ── superadmin (Ruedda Control) ──
async function adminAction(admin, req, res, action) {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  if (!token) return res.status(401).json({ error: 'no autorizado' });
  const { data: u } = await admin.auth.getUser(token);
  if (!u || !u.user) return res.status(401).json({ error: 'sesión inválida' });
  const { data: prof } = await admin.from('users').select('role').eq('id', u.user.id).single();
  if (!prof || prof.role !== 'superadmin') return res.status(403).json({ error: 'solo superadmin' });
  const b = req.body || {};

  if (action === 'p_list') {
    const { data: files } = await admin.storage.from(BUCKET).list('p', { limit: 1000 });
    const list = (await Promise.all((files || []).filter(f => /^\d+\.json$/.test(f.name))
      .map(f => readP(admin, f.name.replace('.json', ''))))).filter(Boolean);
    list.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return res.status(200).json({ partners: list.map(pub) });
  }
  if (action === 'p_create') {
    const nombre = clean(b.nombre, 80);
    if (!nombre) return res.status(400).json({ error: 'escribe el nombre del partner' });
    let code = String(b.code || '').trim();
    if (code && !codeOk(code)) return res.status(400).json({ error: 'el código es de 4 a 6 dígitos' });
    if (!code) { for (let i = 0; i < 20; i++) { const c = String(crypto.randomInt(100000, 1000000)); if (!(await readP(admin, c))) { code = c; break; } } }
    else if (await readP(admin, code)) return res.status(409).json({ error: 'ese código ya existe' });
    const p = { code, nombre, telefono: clean(b.telefono, 30), email: clean(b.email, 120), zona: clean(b.zona, 80),
      notas: clean(b.notas, 500), activo: true, created_at: new Date().toISOString(), created_by: u.user.id, dealers: [] };
    await writeP(admin, p);
    return res.status(200).json({ partner: pub(p) });
  }
  if (action === 'p_update') {
    const p = await readP(admin, b.code);
    if (!p) return res.status(404).json({ error: 'partner no encontrado' });
    ['nombre', 'telefono', 'email', 'zona', 'notas'].forEach(k => { if (b[k] != null) p[k] = clean(b[k], k === 'notas' ? 500 : 120); });
    if (b.activo != null) p.activo = !!b.activo;
    await writeP(admin, p);
    return res.status(200).json({ partner: pub(p) });
  }
  if (action === 'p_dealers') {
    const p = await readP(admin, b.code);
    if (!p) return res.status(404).json({ error: 'partner no encontrado' });
    return res.status(200).json({ partner: pub(p), dealers: await dealersOf(admin, p) });
  }
  return res.status(400).json({ error: 'acción inválida' });
}

// ── partner (web RueddaCarreras · Partners) ──
async function partnerAction(admin, req, res, action) {
  const b = req.body || {};
  const code = String(b.code || '').trim();
  const p = codeOk(code) ? await readP(admin, code) : null;
  if (!p || p.activo === false) { await sleep(700); return res.status(403).json({ error: 'Código no válido o desactivado' }); }
  const mine = id => (p.dealers || []).find(d => d.id === id);

  if (action === 'login') return res.status(200).json({ partner: pub(p), dealers: await dealersOf(admin, p), plan_dias: PLAN_DIAS });

  if (action === 'create') {
    const nombre = clean(b.nombre, 80), email = clean(b.email, 120).toLowerCase(), ciudad = clean(b.ciudad, 60);
    const telefono = clean(b.telefono, 30).replace(/[^\d+]/g, '');
    const password = String(b.password || '');
    if (!nombre) return res.status(400).json({ error: 'Falta el nombre del concesionario' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return res.status(400).json({ error: 'El correo no es válido' });
    if (password.length < 8) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });

    const { data: cu, error: ce } = await admin.auth.admin.createUser({ email, password, email_confirm: true,
      user_metadata: { role: 'concesionario', partner: p.code, nombre } });
    if (ce) return res.status(400).json({ error: /already|registered|exists/i.test(ce.message) ? 'Ese correo ya tiene una cuenta en Ruedda' : ce.message });
    const uid = cu.user.id;
    try {
      const { error: ue } = await admin.from('users').upsert({ id: uid, nombre, email, username: email.split('@')[0], role: 'concesionario' }, { onConflict: 'id' });
      if (ue) throw new Error('users: ' + ue.message);
      const on = b.activar !== false;
      const row = { user_id: uid, nombre, tipo: 'agencia', ciudad, tag: '', activo: on,
        plan_expiry: on ? new Date(Date.now() + PLAN_DIAS * 864e5).toISOString() : null,
        telefono, whatsapp: telefono, instagram: clean(b.instagram, 60).replace(/^@/, ''),
        direccion: clean(b.direccion, 200), descripcion: clean(b.descripcion, 400), initial: nombre.charAt(0).toUpperCase() };
      const { data: c, error: ie } = await admin.from('concesionarios').insert(row).select('id').single();
      if (ie) throw new Error('concesionarios: ' + ie.message);
      const fresh = await readP(admin, p.code) || p;   // releer: evita pisar otro alta simultánea
      fresh.dealers = (fresh.dealers || []).concat({ id: c.id, user_id: uid, nombre, email, created_at: new Date().toISOString() });
      await writeP(admin, fresh);
      return res.status(200).json({ ok: true, id: c.id, total: fresh.dealers.length });
    } catch (e) {
      await admin.from('users').delete().eq('id', uid);
      await admin.auth.admin.deleteUser(uid).catch(() => {});
      console.error('[partner create]', e.message);
      return res.status(500).json({ error: 'No se pudo crear: ' + e.message });
    }
  }

  const d = mine(b.id);
  if (!d) return res.status(404).json({ error: 'Ese concesionario no es de tu cartera' });

  if (action === 'photo') {
    const kind = b.kind === 'logo' ? 'logo' : 'banner';
    const url = await uploadImg(admin, d.id, kind, b.data);
    const { error } = await admin.from('concesionarios').update({ [kind + '_url']: url }).eq('id', d.id);
    if (error) throw new Error(error.message);
    return res.status(200).json({ ok: true, url });
  }
  if (action === 'activate') {
    const on = !!b.on;
    const { data: c } = await admin.from('concesionarios').select('plan_expiry').eq('id', d.id).maybeSingle();
    const patch = { activo: on };
    if (on && (!c || !c.plan_expiry || new Date(c.plan_expiry) < new Date())) patch.plan_expiry = new Date(Date.now() + PLAN_DIAS * 864e5).toISOString();
    const { error } = await admin.from('concesionarios').update(patch).eq('id', d.id);
    if (error) throw new Error(error.message);
    return res.status(200).json({ ok: true });
  }
  if (action === 'reset') {
    const password = genPass();
    const { error } = await admin.auth.admin.updateUserById(d.user_id, { password });
    if (error) throw new Error(error.message);
    return res.status(200).json({ ok: true, password, email: d.email });
  }
  return res.status(400).json({ error: 'acción inválida' });
}

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'method not allowed' }); return; }
  const URL = process.env.SUPABASE_URL, SK = process.env.SUPABASE_SERVICE_KEY;
  if (!URL || !SK) { res.status(500).json({ error: 'server misconfigured' }); return; }
  const admin = createClient(URL, SK, { auth: { autoRefreshToken: false, persistSession: false } });
  const action = String((req.body || {}).action || '');
  try {
    await ensureBucket(admin);
    if (action.startsWith('p_')) return await adminAction(admin, req, res, action);
    return await partnerAction(admin, req, res, action);
  } catch (e) {
    console.error('[partner]', action, e.message);
    res.status(500).json({ error: e.message });
  }
};
