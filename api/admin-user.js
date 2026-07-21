// /api/admin-user.js
// [RC] Reemplaza las llamadas directas a _supa.auth.admin.createUser/deleteUser
// que corrían en el navegador con la anon key — esas SIEMPRE fallan con
// "User not allowed" porque los endpoints auth.admin.* exigen la service_role
// key, que nunca debe vivir en un HTML público. Esta función corre en el
// servidor de Vercel, usa la service_role key desde una env var, y antes de
// hacer nada verifica que quien llama sea un superadmin real (no solo "está
// logueado" — cualquier token válido pasaría esa barra).
//
// Mismo patrón de tus otras funciones: POST, header Authorization: Bearer <jwt>,
// body JSON, responde {error} con status != 200 si algo falla.
//
// Variables de entorno requeridas en el proyecto Vercel (Settings → Environment
// Variables), NUNCA como NEXT_PUBLIC_ / VITE_ / con prefijo que las exponga al
// cliente:
//   SUPABASE_URL              (misma URL que usas en el frontend)
//   SUPABASE_SERVICE_KEY      (Supabase Dashboard → Project Settings → API →
//                               "service_role" — NO la "anon public")

const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('[admin-user] faltan env vars SUPABASE_URL / SUPABASE_SERVICE_KEY');
    res.status(500).json({ error: 'server misconfigured' });
    return;
  }

  // Cliente admin — SOLO existe en este proceso de servidor, jamás llega al navegador
  const supaAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Validar el JWT del que llama (el access_token de su sesión normal)
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    res.status(401).json({ error: 'no autorizado' });
    return;
  }
  const { data: callerData, error: callerErr } = await supaAdmin.auth.getUser(token);
  if (callerErr || !callerData?.user) {
    res.status(401).json({ error: 'sesión inválida' });
    return;
  }

  // 2. Confirmar que quien llama es superadmin de verdad, consultando la tabla
  //    users con el cliente admin (bypasa RLS a propósito, es el único punto
  //    del sistema con permiso para hacerlo, y solo para esta verificación).
  const { data: callerProfile, error: profileErr } = await supaAdmin
    .from('users')
    .select('role')
    .eq('id', callerData.user.id)
    .single();
  if (profileErr || callerProfile?.role !== 'superadmin') {
    res.status(403).json({ error: 'solo superadmin puede administrar cuentas' });
    return;
  }

  const { action } = req.body || {};

  try {
    if (action === 'create') {
      const { email, password, nombre, username, role } = req.body || {};
      if (!email || !password) {
        res.status(400).json({ error: 'email y contraseña son requeridos' });
        return;
      }
      const { data: created, error: createErr } = await supaAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { role: role || 'concesionario' },
      });
      if (createErr) throw new Error('Auth: ' + createErr.message);

      const uid = created.user.id;
      const { error: upsertErr } = await supaAdmin.from('users').upsert(
        {
          id: uid,
          nombre: nombre || email,
          email,
          username: username || email.split('@')[0],
          role: role || 'concesionario',
        },
        { onConflict: 'id' }
      );
      if (upsertErr) throw new Error('users upsert: ' + upsertErr.message);

      res.status(200).json({ ok: true, user_id: uid });
      return;
    }

    if (action === 'delete') {
      const { id } = req.body || {};
      if (!id) {
        res.status(400).json({ error: 'id es requerido' });
        return;
      }
      await supaAdmin.from('users').delete().eq('id', id);
      const { error: delErr } = await supaAdmin.auth.admin.deleteUser(id);
      if (delErr) console.warn('[admin-user] auth delete:', delErr.message);
      res.status(200).json({ ok: true });
      return;
    }

    res.status(400).json({ error: 'action inválida (usa create o delete)' });
  } catch (e) {
    console.error('[admin-user]', e.message);
    res.status(500).json({ error: e.message });
  }
};
