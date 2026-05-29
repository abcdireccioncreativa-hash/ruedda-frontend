/**
 * POST /api/place-bid
 * Body: { auction_id, monto }
 * Header: Authorization: Bearer <jwt>
 *
 * Valida sesión, estado de la subasta, monto mínimo y
 * protege contra race conditions con optimistic locking.
 */
const { supabaseAdmin, getUserFromToken } = require('../lib/supabase');

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  try {
    // 1. Autenticación
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'no autenticado' });

    const { auction_id, monto } = req.body;
    if (!auction_id || !monto) return res.status(400).json({ error: 'faltan parámetros' });

    const montoNum = parseFloat(monto);
    if (isNaN(montoNum) || montoNum <= 0) return res.status(400).json({ error: 'monto inválido' });

    // 2. Leer subasta actual
    const { data: auction, error: fetchErr } = await supabaseAdmin
      .from('auctions')
      .select('id, estado, tipo, end_time, current_bid, user_id, precio_reserva, sin_reserva')
      .eq('id', auction_id)
      .maybeSingle();

    if (fetchErr || !auction) return res.status(404).json({ error: 'subasta no encontrada' });
    if (auction.estado !== 'activa') return res.status(409).json({ error: 'subasta no activa' });
    if (auction.tipo !== 'subasta') return res.status(409).json({ error: 'no es una subasta' });
    if (new Date(auction.end_time) < new Date()) return res.status(409).json({ error: 'subasta terminada' });
    if (auction.user_id === user.id) return res.status(409).json({ error: 'no puedes pujar en tu propia subasta' });

    // 3. Validar monto mínimo (1% sobre current_bid o mínimo $500)
    const minBid = (auction.current_bid || 0) + Math.max(500, (auction.current_bid || 0) * 0.01);
    if (montoNum < minBid) {
      return res.status(409).json({ error: `monto mínimo: ${minBid}`, min_bid: minBid });
    }

    // 4. Optimistic locking — solo actualiza si current_bid no cambió
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('auctions')
      .update({
        current_bid: montoNum,
        bid_count: (auction.bid_count || 0) + 1,
        winner_id: user.id
      })
      .eq('id', auction_id)
      .eq('current_bid', auction.current_bid) // optimistic lock
      .eq('estado', 'activa')
      .select('current_bid, bid_count')
      .maybeSingle();

    if (updateErr || !updated) {
      return res.status(409).json({ error: 'puja superada — intenta de nuevo', retry: true });
    }

    // 5. Registrar en tabla bids
    const { error: bidErr } = await supabaseAdmin
      .from('bids')
      .insert({ auction_id, user_id: user.id, amount: montoNum });

    if (bidErr) console.error('[ruedda place-bid] bids insert:', bidErr.message);

    // 6. Notificación al vendedor (best-effort)
    supabaseAdmin
      .from('notifications')
      .insert({
        user_id: auction.user_id,
        tipo: 'offer',
        titulo: 'Nueva oferta en tu subasta',
        body: `Alguien ofertó $${montoNum.toLocaleString()} en tu subasta`,
        icon: 'lime'
      })
      .then(() => {})
      .catch(() => {});

    return res.status(200).json({
      ok: true,
      current_bid: updated.current_bid,
      bid_count: updated.bid_count
    });

  } catch (e) {
    console.error('[ruedda place-bid] catch:', e.message);
    return res.status(500).json({ error: 'error interno' });
  }
};
