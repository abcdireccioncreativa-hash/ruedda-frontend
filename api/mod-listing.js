/**
 * POST /api/mod-listing
 * Body: { item_id, item_type: 'listing'|'auction', action: 'aprobar'|'rechazar' }
 * Header: Authorization: Bearer <jwt>
 *
 * Solo superadmin. Aprueba o rechaza publicaciones
 * en la tabla correspondiente y notifica al usuario.
 */
const { supabaseAdmin, getUserFromToken, isSuperadmin } = require('../lib/supabase');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  try {
    // 1. Auth + rol
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'no autenticado' });
    const admin = await isSuperadmin(user.id);
    if (!admin) return res.status(403).json({ error: 'acceso denegado' });

    const { item_id, item_type, action } = req.body;
    if (!item_id || !['listing', 'auction'].includes(item_type) || !['aprobar', 'rechazar'].includes(action)) {
      return res.status(400).json({ error: 'parámetros inválidos' });
    }

    const tabla = item_type === 'listing' ? 'listings' : 'auctions';
    const nuevoEstado = action === 'aprobar' ? 'activa' : 'rechazada';

    // 2. Leer item para obtener user_id
    const { data: item, error: fetchErr } = await supabaseAdmin
      .from(tabla)
      .select('id, user_id, titulo, marca, modelo, year, estado')
      .eq('id', item_id)
      .maybeSingle();

    if (fetchErr || !item) return res.status(404).json({ error: 'publicación no encontrada' });

    // Solo moderar items en revisión o pendiente_pago
    if (!['revision', 'pendiente_pago', 'pendiente'].includes(item.estado)) {
      return res.status(409).json({ error: `estado actual: ${item.estado} — no se puede moderar` });
    }

    // 3. Actualizar estado
    const { error: updateErr } = await supabaseAdmin
      .from(tabla)
      .update({ estado: nuevoEstado })
      .eq('id', item_id);

    if (updateErr) {
      console.error('[ruedda mod-listing] update:', updateErr.message);
      return res.status(500).json({ error: 'error al actualizar' });
    }

    // 4. Notificar al usuario (best-effort)
    if (item.user_id) {
      const label = [item.year, item.marca, item.modelo].filter(Boolean).join(' ');
      await supabaseAdmin.from('notifications').insert({
        user_id: item.user_id,
        tipo: action === 'aprobar' ? 'ganador' : 'system',
        titulo: action === 'aprobar' ? '¡Publicación aprobada!' : 'Publicación rechazada',
        body: action === 'aprobar'
          ? `Tu ${label} ya está activa en Ruedda.`
          : 'Tu publicación no cumplió los estándares de Ruedda. Contáctanos por soporte.',
        icon: action === 'aprobar' ? 'lime' : ''
      }).catch(() => {});
    }

    return res.status(200).json({ ok: true, estado: nuevoEstado });

  } catch (e) {
    console.error('[ruedda mod-listing] catch:', e.message);
    return res.status(500).json({ error: 'error interno' });
  }
};
