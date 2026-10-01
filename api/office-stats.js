// /api/office-stats.js — los mismos indicadores del tablero de Ruedda Control, para Valentina en /office.
// Solo responde a miembros de la oficina (se valida el JWT y office_members con la service key).

const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
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
};
