/**
 * POST /api/verify-payment
 * Body: { ref_id, action: 'confirmar'|'rechazar' }
 * Header: Authorization: Bearer <jwt>
 *
 * Solo superadmin. Confirma o rechaza payment_refs
 * y actualiza el estado del listing/auction vinculado.
 */
const { supabaseAdmin, getUserFromToken, isSuperadmin } = require('../lib/supabase');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  try {
    // Parse body
    let body = req.body;
    if (typeof body === 'string') { try{ body=JSON.parse(body); }catch(_){ body={}; } }
    if (!body) body = {};

    // 1. Auth + rol
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'no autenticado' });
    const admin = await isSuperadmin(user.id);
    if (!admin) return res.status(403).json({ error: 'acceso denegado' });

    const { ref_id, action } = body;
    if (!ref_id || !['confirmar', 'rechazar'].includes(action)) {
      return res.status(400).json({ error: 'parámetros inválidos' });
    }

    // 2. Leer payment_ref
    const { data: ref, error: refErr } = await supabaseAdmin
      .from('payment_refs')
      .select('id, user_id, auction_id, listing_id, tipo, status')
      .eq('id', ref_id)
      .maybeSingle();

    if (refErr || !ref) return res.status(404).json({ error: 'referencia no encontrada' });
    if (ref.status !== 'pendiente') return res.status(409).json({ error: 'referencia ya procesada' });

    // 3. Actualizar status
    const newStatus = action === 'confirmar' ? 'confirmado' : 'rechazado';
    await supabaseAdmin.from('payment_refs').update({ status: newStatus }).eq('id', ref_id);

    let notifTitulo, notifBody;

    if (action === 'confirmar') {
      if (ref.tipo === 'vitrina') {
        // Activar vitrina del concesionario
        const planExp = new Date(Date.now() + 30 * 86400000).toISOString();
        const { error: ve } = await supabaseAdmin
          .from('concesionarios')
          .update({ activo: true, plan_expiry: planExp })
          .eq('user_id', ref.user_id);
        if (ve) console.error('[ruedda verify-payment] vitrina:', ve.message);
        notifTitulo = '¡Vitrina activada!';
        notifBody = 'Tu vitrina en Ruedda está activa. Ya puedes publicar tu inventario.';
      } else {
        // Mover publicación a revisión
        if (ref.listing_id) {
          await supabaseAdmin.from('listings').update({ estado: 'revision' }).eq('id', ref.listing_id);
        }
        if (ref.auction_id) {
          await supabaseAdmin.from('auctions').update({ estado: 'revision' }).eq('id', ref.auction_id);
        }
        notifTitulo = '¡Pago confirmado!';
        notifBody = 'Tu pago fue verificado. Tu publicación está en revisión y será aprobada pronto.';
      }
    } else {
      if (ref.listing_id) {
        await supabaseAdmin.from('listings').update({ estado: 'rechazada' }).eq('id', ref.listing_id);
      }
      if (ref.auction_id) {
        await supabaseAdmin.from('auctions').update({ estado: 'rechazada' }).eq('id', ref.auction_id);
      }
      notifTitulo = 'Pago rechazado';
      notifBody = 'Tu referencia de pago no pudo ser verificada. Contáctanos por soporte.';
    }

    // 4. Notificar al usuario
    if (ref.user_id) {
      await supabaseAdmin.from('notifications').insert({
        user_id: ref.user_id,
        tipo: action === 'confirmar' ? 'ganador' : 'system',
        titulo: notifTitulo,
        body: notifBody,
        icon: action === 'confirmar' ? 'lime' : ''
      }).catch(() => {});
    }

    return res.status(200).json({ ok: true, status: newStatus });

  } catch (e) {
    console.error('[ruedda verify-payment] catch:', e.message);
    return res.status(500).json({ error: 'error interno' });
  }
};
