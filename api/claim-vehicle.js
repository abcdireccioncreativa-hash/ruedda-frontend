/**
 * POST /api/claim-vehicle
 * Body: { vehicle_id, vin }
 * Header: Authorization: Bearer <jwt>
 *
 * Reclama un vehículo de "Mi Garage" mostrando su VIN. El VIN vive en la
 * tabla garage_vehicle_secrets, protegida por RLS de forma que nadie salvo
 * el dueño actual puede leerlo — ni siquiera por consola con la anon key.
 * La comparación y la transferencia de dueño se hacen acá, server-side, con
 * el service role, para que un cliente nunca pueda leer el VIN ajeno ni
 * forzar la transferencia sin que coincida.
 */
const { supabaseAdmin, getUserFromToken } = require('../lib/supabase');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  try {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
    if (!body) body = {};

    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'no autenticado' });

    const { vehicle_id, vin } = body;
    const vinInput = (vin || '').trim().toUpperCase();
    if (!vehicle_id || !vinInput) return res.status(400).json({ error: 'faltan datos' });

    const { data: vehicle, error: fetchErr } = await supabaseAdmin
      .from('garage_vehicles')
      .select('id, owner_id, marca, modelo, year, titulo')
      .eq('id', vehicle_id)
      .maybeSingle();
    if (fetchErr || !vehicle) return res.status(404).json({ error: 'vehículo no encontrado' });
    if (vehicle.owner_id === user.id) return res.status(400).json({ error: 'ya eres el dueño de este vehículo' });

    const { data: secret } = await supabaseAdmin
      .from('garage_vehicle_secrets')
      .select('vin')
      .eq('vehicle_id', vehicle_id)
      .maybeSingle();

    if (!secret?.vin || secret.vin.trim().toUpperCase() !== vinInput) {
      return res.status(409).json({ error: 'el VIN no coincide' });
    }

    const fromUserId = vehicle.owner_id;

    const { error: updateErr } = await supabaseAdmin
      .from('garage_vehicles')
      .update({ owner_id: user.id, updated_at: new Date().toISOString() })
      .eq('id', vehicle_id);
    if (updateErr) return res.status(500).json({ error: updateErr.message });

    await supabaseAdmin.from('garage_vehicle_transfers').insert({
      vehicle_id, from_user_id: fromUserId, to_user_id: user.id, method: 'vin_claim'
    });

    const label = vehicle.titulo || `${vehicle.year || ''} ${vehicle.marca || ''} ${vehicle.modelo || ''}`.trim();

    if (fromUserId) {
      supabaseAdmin.from('notifications').insert({
        user_id: fromUserId,
        tipo: 'system',
        titulo: 'reclamaron uno de tus vehículos',
        body: `alguien verificó el VIN de tu ${label} en Mi Garage y ahora es el nuevo dueño`,
        icon: 'lime',
        source_id: vehicle_id,
        source_type: 'garage_vehicle'
      }).then(null, () => {});
    }

    return res.status(200).json({ ok: true, label });
  } catch (e) {
    console.error('[claim-vehicle]', e);
    return res.status(500).json({ error: 'error interno' });
  }
};
