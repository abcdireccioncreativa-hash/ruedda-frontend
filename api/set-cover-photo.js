/**
 * POST /api/set-cover-photo
 * Body: { item_id, item_type: 'listing'|'auction', photo_id }
 * Header: Authorization: Bearer <jwt>
 *
 * Solo superadmin. Pone la foto indicada como portada, intercambiando su
 * "orden" con el de la foto que hoy está de primera (mismo criterio que
 * usa toda la app para decidir qué foto mostrar en cards).
 */
const { supabaseAdmin, getUserFromToken, isSuperadmin } = require('../lib/supabase');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  try {
    let body = req.body;
    if (typeof body === 'string') { try{ body=JSON.parse(body); }catch(_){ body={}; } }
    if (!body) body = {};

    // 1. Auth + rol
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'no autenticado' });
    const admin = await isSuperadmin(user.id);
    if (!admin) return res.status(403).json({ error: 'acceso denegado' });

    const { item_id, item_type, photo_id } = body;
    if (!item_id || !['listing', 'auction'].includes(item_type) || !photo_id) {
      return res.status(400).json({ error: 'parámetros inválidos' });
    }

    const photoTable = item_type === 'listing' ? 'listing_photos' : 'auction_photos';
    const fkCol = item_type === 'listing' ? 'listing_id' : 'auction_id';

    // 2. Traer fotos actuales ordenadas
    const { data: photos, error: fetchErr } = await supabaseAdmin
      .from(photoTable)
      .select('id, orden')
      .eq(fkCol, item_id)
      .order('orden', { ascending: true });

    if (fetchErr) {
      console.error('[ruedda set-cover-photo] fetch:', fetchErr.message);
      return res.status(500).json({ error: 'error leyendo fotos' });
    }
    if (!photos?.length) return res.status(404).json({ error: 'esta publicación no tiene fotos' });

    const current = photos[0];
    const target = photos.find(p => p.id === photo_id);
    if (!target) return res.status(404).json({ error: 'foto no encontrada' });
    if (target.id === current.id) return res.status(200).json({ ok: true });

    // 3. Swap de orden — bypasea RLS con la service key
    const { error: e1 } = await supabaseAdmin.from(photoTable).update({ orden: current.orden }).eq('id', target.id);
    if (e1) { console.error('[ruedda set-cover-photo] update1:', e1.message); return res.status(500).json({ error: 'error al actualizar' }); }

    const { error: e2 } = await supabaseAdmin.from(photoTable).update({ orden: target.orden }).eq('id', current.id);
    if (e2) { console.error('[ruedda set-cover-photo] update2:', e2.message); return res.status(500).json({ error: 'error al actualizar' }); }

    return res.status(200).json({ ok: true });

  } catch (e) {
    console.error('[ruedda set-cover-photo] catch:', e.message);
    return res.status(500).json({ error: 'error interno' });
  }
};
