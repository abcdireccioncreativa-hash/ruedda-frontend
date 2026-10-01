// /api/office-login.js — Ruedda Office (www.ruedda.app/office)
// Login solo con usuario: si el usuario está en public.office_accounts (activo), entra.
// Cada usuario autorizado tiene su propia cuenta interna de la oficina (<usuario>@office.ruedda.app),
// separada de las cuentas reales de Ruedda; su clave se deriva aquí con la service key y nunca sale
// del servidor. Responde los tokens de sesión para que el navegador haga setSession().
//
// Env (ya existen en Vercel): SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_ANON_KEY

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method not allowed' }); return; }
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
};
