/**
 * GET /api/subscription-check
 * Header: Authorization: Bearer <jwt>
 *
 * Verifica el estado de suscripción del concesionario:
 * - vitrina activa o no
 * - plan_expiry
 * - cantidad de listings activos
 */
const { supabaseAdmin, getUserFromToken } = require('../lib/supabase');

const MAX_LISTINGS_PER_DEALER = 50; // límite por plan

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });

  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'no autenticado' });

    // 1. Leer perfil de concesionario
    const { data: dealer, error: dealerErr } = await supabaseAdmin
      .from('concesionarios')
      .select('id, activo, plan_expiry, nombre')
      .eq('user_id', user.id)
      .maybeSingle();

    if (dealerErr || !dealer) {
      return res.status(404).json({ error: 'concesionario no encontrado' });
    }

    // 2. Verificar expiración del plan
    const now = new Date();
    const expiry = dealer.plan_expiry ? new Date(dealer.plan_expiry) : null;
    const planVigente = dealer.activo && expiry && expiry > now;

    // Si expiró, marcar como inactivo
    if (dealer.activo && expiry && expiry <= now) {
      await supabaseAdmin
        .from('concesionarios')
        .update({ activo: false })
        .eq('id', dealer.id)
        .catch(() => {});
    }

    // 3. Contar listings activos
    const { count: listingsCount } = await supabaseAdmin
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .eq('concesionario_id', dealer.id)
      .eq('estado', 'activa');

    const puedePublicar = planVigente && (listingsCount || 0) < MAX_LISTINGS_PER_DEALER;

    return res.status(200).json({
      ok: true,
      dealer_id: dealer.id,
      nombre: dealer.nombre,
      activo: planVigente,
      plan_expiry: dealer.plan_expiry,
      dias_restantes: expiry ? Math.max(0, Math.ceil((expiry - now) / 86400000)) : 0,
      listings_activos: listingsCount || 0,
      listings_limite: MAX_LISTINGS_PER_DEALER,
      puede_publicar: puedePublicar
    });

  } catch (e) {
    console.error('[ruedda subscription-check] catch:', e.message);
    return res.status(500).json({ error: 'error interno' });
  }
};
