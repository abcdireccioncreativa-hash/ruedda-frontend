/**
 * POST /api/auction-close
 * Puede llamarse como cron job desde Vercel Cron
 * o manualmente. No requiere auth (se protege por secret).
 *
 * Cierra subastas expiradas y notifica al ganador y vendedor.
 */
const { supabaseAdmin } = require('../lib/supabase');

const CRON_SECRET = process.env.CRON_SECRET || '';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, x-cron-secret');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Proteger con secret si está configurado
  if (CRON_SECRET) {
    const authHeader = req.headers['authorization'] || '';
    const secret = (authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '')
      || req.headers['x-cron-secret']
      || req.query.secret
      || '';
    if (secret !== CRON_SECRET) return res.status(401).json({ error: 'no autorizado' });
  }

  try {
    // 1. Buscar subastas activas expiradas
    const { data: expired, error } = await supabaseAdmin
      .from('auctions')
      .select('id, user_id, titulo, marca, modelo, year, current_bid, bid_count, winner_id, sin_reserva, precio_reserva, end_time')
      .eq('estado', 'activa')
      .eq('tipo', 'subasta')
      .lt('end_time', new Date().toISOString());

    if (error) {
      console.error('[ruedda auction-close] fetch:', error.message);
      return res.status(500).json({ error: 'error al leer subastas' });
    }

    if (!expired?.length) {
      return res.status(200).json({ ok: true, closed: 0, message: 'sin subastas expiradas' });
    }

    const results = [];

    for (const auction of expired) {
      const tieneGanador = !!auction.winner_id;
      const cumpleReserva = auction.sin_reserva ||
        !auction.precio_reserva ||
        (auction.current_bid >= auction.precio_reserva);

      const nuevoEstado = (tieneGanador && cumpleReserva) ? 'cerrada' : 'sin_ganador';
      const label = [auction.year, auction.marca, auction.modelo].filter(Boolean).join(' ');

      // Cerrar la subasta
      const { error: closeErr } = await supabaseAdmin
        .from('auctions')
        .update({ estado: nuevoEstado })
        .eq('id', auction.id);

      if (closeErr) {
        console.error('[ruedda auction-close] close:', closeErr.message);
        results.push({ id: auction.id, error: closeErr.message });
        continue;
      }

      // Notificar al vendedor
      await supabaseAdmin.from('notifications').insert({
        user_id: auction.user_id,
        tipo: 'sold',
        titulo: nuevoEstado === 'cerrada' ? '¡Subasta cerrada con ganador!' : 'Subasta finalizada sin ganador',
        body: nuevoEstado === 'cerrada'
          ? `Tu ${label} fue vendida por $${(auction.current_bid || 0).toLocaleString()}.`
          : `Tu ${label} terminó sin cumplir el precio de reserva.`,
        icon: nuevoEstado === 'cerrada' ? 'lime' : ''
      }).catch(() => {});

      // Notificar al ganador si existe
      if (tieneGanador && nuevoEstado === 'cerrada') {
        await supabaseAdmin.from('notifications').insert({
          user_id: auction.winner_id,
          tipo: 'ganador',
          titulo: '¡Ganaste la subasta!',
          body: `Ganaste el ${label} por $${(auction.current_bid || 0).toLocaleString()}. El vendedor se pondrá en contacto pronto.`,
          icon: 'lime'
        }).catch(() => {});
      }

      results.push({ id: auction.id, estado: nuevoEstado });
    }

    return res.status(200).json({ ok: true, closed: results.length, results });

  } catch (e) {
    console.error('[ruedda auction-close] catch:', e.message);
    return res.status(500).json({ error: 'error interno' });
  }
};
