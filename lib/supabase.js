const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const ANON_KEY     = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
  console.error('[ruedda] faltan variables de entorno Supabase');
}

// Admin: bypasa RLS — solo usar server-side
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Anon: respeta RLS — para validar JWTs de usuarios
const supabaseAnon = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

/**
 * Valida el JWT del usuario desde el header Authorization.
 * Retorna { user } si es válido, o null.
 */
async function getUserFromToken(req) {
  const auth = req.headers['authorization'] || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token) return null;
  const { data: { user }, error } = await supabaseAnon.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

/**
 * Verifica que el user_id corresponde a un superadmin en tabla users.
 */
async function isSuperadmin(userId) {
  if (!userId) return false;
  const { data } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', userId)
    .maybeSingle();
  return data?.role === 'superadmin';
}

module.exports = { supabaseAdmin, supabaseAnon, getUserFromToken, isSuperadmin };
