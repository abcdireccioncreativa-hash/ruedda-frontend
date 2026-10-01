// lib/office-api.js — backend de Ruedda Office (www.ruedda.app/office).
// Se ejecuta dentro de /api/admin-user (vercel.json enruta /api/office-login y /api/office-stats
// hacia /api/admin-user?office=...) porque el plan de Vercel permite máximo 12 funciones.
//
// · login: solo con usuario. Si está en public.office_accounts (activo), entra con su cuenta interna de la
//   oficina (<usuario>@office.ruedda.app), separada de las cuentas reales de Ruedda; la clave se deriva aquí
//   con la service key y nunca sale del servidor. Devuelve los tokens para setSession() en el navegador.
// · stats: los mismos indicadores del tablero de Ruedda Control, solo para miembros de la oficina.

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

async function login(req, res) {
  const URL = process.env.SUPABASE_URL, SK = process.env.SUPABASE_SERVICE_KEY, AK = process.env.SUPABASE_ANON_KEY;
  if (!URL || !SK || !AK) { res.status(500).json({ error: 'server misconfigured' }); return; }

  const username = String((req.body || {}).username || '').trim().replace(/^@+/, '').toLowerCase();
  if (!/^[a-z0-9._-]{2,40}$/.test(username)) { res.status(400).json({ error: 'Usuario inválido' }); return; }

  const admin = createClient(URL, SK, { auth: { autoRefreshToken: false, persistSession: false } });
  const anon = createClient(URL, AK, { auth: { autoRefreshToken: false, persistSession: false } });

  try {
    const { data: acc, error } = await admin.from('office_accounts').select('*').eq('username', username).maybeSingle();
    if (error) { res.status(500).json({ error: /office_accounts/.test(error.message) ? 'Falta correr el SQL de la oficina en Supabase' : error.message }); return; }
    if (!acc || acc.active === false) { res.status(403).json({ error: 'Usuario no autorizado' }); return; }

    const email = `${username}@office.ruedda.app`;
    const password = crypto.createHmac('sha256', SK).update('ruedda-office:' + username).digest('base64url');

    let uid = acc.user_id || null;
    if (!uid) {
      const { data: created, error: ce } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { office: true, nombre: acc.display_name }
      });
      if (ce && !/already|registered|exists/i.test(ce.message)) throw new Error('Auth: ' + ce.message);
      if (created && created.user) uid = created.user.id;
    }

    let { data: si, error: se } = await anon.auth.signInWithPassword({ email, password });
    if (se && uid) {   // la cuenta existía con otra clave: se re-sincroniza
      await admin.auth.admin.updateUserById(uid, { password });
      ({ data: si, error: se } = await anon.auth.signInWithPassword({ email, password }));
    }
    if (se || !si || !si.session) throw new Error('No se pudo iniciar sesión' + (se ? ': ' + se.message : ''));
    uid = si.user.id;
    if (acc.user_id !== uid) await admin.from('office_accounts').update({ user_id: uid }).eq('username', username);

    // primera vez: se crea su ficha en la oficina (después la edita el admin desde Equipo)
    const { data: m } = await admin.from('office_members').select('user_id').eq('user_id', uid).maybeSingle();
    if (!m) {
      if (acc.slot) await admin.from('office_members').delete().eq('slot', acc.slot);
      const { error: me } = await admin.from('office_members').insert({
        user_id: uid, slot: acc.slot || null, display_name: acc.display_name || username,
        cargo: acc.cargo || 'Equipo Ruedda', is_admin: !!acc.is_admin
      });
      if (me) throw new Error('office_members: ' + me.message);
    }

    res.status(200).json({ access_token: si.session.access_token, refresh_token: si.session.refresh_token });
  } catch (e) {
    console.error('[office-login]', e.message);
    res.status(500).json({ error: e.message });
  }
}

async function stats(req, res) {
  const URL = process.env.SUPABASE_URL, SK = process.env.SUPABASE_SERVICE_KEY;
  if (!URL || !SK) { res.status(500).json({ error: 'server misconfigured' }); return; }
  const admin = createClient(URL, SK, { auth: { autoRefreshToken: false, persistSession: false } });
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  if (!token) { res.status(401).json({ error: 'no autorizado' }); return; }
  const { data: u, error: ue } = await admin.auth.getUser(token);
  if (ue || !u || !u.user) { res.status(401).json({ error: 'sesión inválida' }); return; }
  const { data: m } = await admin.from('office_members').select('user_id').eq('user_id', u.user.id).maybeSingle();
  if (!m) { res.status(403).json({ error: 'no autorizado' }); return; }

  const DAY = 864e5, now = Date.now(), sod = new Date(); sod.setUTCHours(4, 0, 0, 0); // medianoche de Caracas (UTC-4)
  if (sod.getTime() > now) sod.setTime(sod.getTime() - DAY);
  const cnt = async (t, f) => { let q = admin.from(t).select('*', { count: 'exact', head: true }); if (f) q = f(q); const r = await q; return r.error ? null : (r.count || 0); };
  const rows = async q => { const r = await q; return r.error ? null : (r.data || []); };
  try {
    const [uTot, uKyc, uDealer, uNew, lAct, lSold, aLive, bids, mod, kyc, pay] = await Promise.all([
      cnt('users'), cnt('users', q => q.eq('kyc_verified', true)), cnt('users', q => q.in('role', ['consesionario', 'concesionario'])),
      rows(admin.from('users').select('created_at').gte('created_at', new Date(now - 7 * DAY).toISOString()).limit(5000)),
      cnt('listings', q => q.eq('estado', 'activa').not('vendido', 'is', true)), cnt('listings', q => q.eq('vendido', true)),
      cnt('auctions', q => q.eq('estado', 'activa').gt('end_time', new Date().toISOString())),
      rows(admin.from('bids').select('amount,created_at').gte('created_at', sod.toISOString()).limit(10000)),
      cnt('listings', q => q.in('estado', ['revision', 'pendiente_pago'])), cnt('kyc_submissions', q => q.eq('estado', 'pendiente')), cnt('payment_refs', q => q.eq('status', 'pendiente'))
    ]);
    res.status(200).json({
      users: uTot, kyc: uKyc, dealers: uDealer, new7: uNew ? uNew.length : null, newToday: uNew ? uNew.filter(r => new Date(r.created_at) >= sod).length : null,
      listings: lAct, sold: lSold, auctions: aLive, bidsToday: bids ? bids.length : null, volToday: bids ? bids.reduce((a, b) => a + (+b.amount || 0), 0) : null,
      pendMod: mod, pendKyc: kyc, pendPay: pay
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

module.exports = async (req, res) => {
  const op = (req.query && req.query.office) || '';
  if (op === 'login') { if (req.method !== 'POST') { res.status(405).json({ error: 'method not allowed' }); return; } return login(req, res); }
  if (op === 'stats') return stats(req, res);
  res.status(404).json({ error: 'not found' });
};
