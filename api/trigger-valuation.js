/**
 * POST /api/trigger-valuation
 * Body: { item_id, item_type: 'listing'|'auction', marca, modelo, version, year, kilometraje, precio_solicitado, catalog_miss? }
 * Header: Authorization: Bearer <jwt>
 *
 * Dispara la tasación del motor "Precio Justo" para un vehículo recién
 * publicado o editado, y persiste el resultado en las columnas pme_* de
 * la fila. Nunca bloquea al usuario: si el motor no responde en 5s o
 * falla, la fila simplemente se queda con pme_* en null — la comparativa
 * de precio es un extra, no un requisito para publicar.
 *
 * catalog_miss (opcional): {marca, modelo, version} cuando el usuario usó
 * la puerta de escape "no está en la lista" en algún campo — se registra
 * en catalog_misses (termómetro de cobertura del catálogo). Vive acá y no
 * en el cliente porque esa tabla es interna del motor, sin policies RLS
 * para el cliente — solo esta función (service role) escribe ahí.
 *
 * El secreto compartido con el motor (PRICING_API_SECRET) y su URL
 * (PRICING_API_URL) viven solo acá, del lado del servidor — el cliente
 * nunca les pega directo.
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

    const { item_id, item_type, marca, modelo, version, year, kilometraje, precio_solicitado, catalog_miss } = body;
    if (!item_id || !['listing', 'auction'].includes(item_type) || !marca || !modelo || !year) {
      return res.status(400).json({ error: 'parámetros inválidos' });
    }

    const tabla = item_type === 'listing' ? 'listings' : 'auctions';

    // Solo el dueño del vehículo puede disparar su propia tasación.
    const { data: item, error: fetchErr } = await supabaseAdmin
      .from(tabla)
      .select('id, user_id')
      .eq('id', item_id)
      .maybeSingle();
    if (fetchErr || !item) return res.status(404).json({ error: 'vehículo no encontrado' });
    if (item.user_id !== user.id) return res.status(403).json({ error: 'acceso denegado' });

    // Responder de inmediato — el cliente ya sigue su flujo sin esperar esto.
    res.status(202).json({ ok: true, queued: true });

    // Termómetro de cobertura del catálogo — best-effort, no afecta la tasación.
    if (catalog_miss && catalog_miss.marca) {
      const missMarca = String(catalog_miss.marca).toUpperCase();
      const missModelo = catalog_miss.modelo ? String(catalog_miss.modelo).toUpperCase() : null;
      const missVersion = catalog_miss.version ? String(catalog_miss.version).toUpperCase() : null;
      (async () => {
        try {
          let q = supabaseAdmin.from('catalog_misses').select('id, ocurrencias').eq('marca', missMarca);
          q = missModelo == null ? q.is('modelo', null) : q.eq('modelo', missModelo);
          q = missVersion == null ? q.is('version', null) : q.eq('version', missVersion);
          const { data: existing } = await q.maybeSingle();
          if (existing) {
            await supabaseAdmin.from('catalog_misses')
              .update({ ocurrencias: (existing.ocurrencias || 1) + 1, updated_at: new Date().toISOString() })
              .eq('id', existing.id);
          } else {
            await supabaseAdmin.from('catalog_misses').insert({ marca: missMarca, modelo: missModelo, version: missVersion });
          }
        } catch (e) {
          console.warn('[trigger-valuation] catalog_misses:', e.message);
        }
      })();
    }

    // A partir de acá corre en background: la respuesta ya salió.
    const apiUrl = process.env.PRICING_API_URL;
    const apiSecret = process.env.PRICING_API_SECRET;
    if (!apiUrl || !apiSecret) {
      console.warn('[trigger-valuation] PRICING_API_URL/PRICING_API_SECRET sin configurar — se omite la tasación');
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const r = await fetch(apiUrl.replace(/\/$/, '') + '/api/valuate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': apiSecret },
        body: JSON.stringify({
          marca, modelo, version: version || '', año: year,
          kilometraje: kilometraje || 0, precio_solicitado: precio_solicitado || 0
        }),
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (!r.ok) return;
      const data = await r.json();

      // marca_canonica/modelo_canonico/version_canonica ya los escribió el
      // cliente al crear/editar el registro — acá solo se actualiza el PME.
      await supabaseAdmin.from(tabla).update({
        pme_usd: data.pme ?? null,
        pme_delta: data.delta_percent ?? null,
        pme_classification: data.classification || null,
        pme_confianza: data.confianza || null,
        pme_basado_en: data.mostrar_comparativa === false ? null : (data.basado_en || null),
        pme_updated_at: new Date().toISOString()
      }).eq('id', item_id);
    } catch (e) {
      clearTimeout(timeout);
      console.warn('[trigger-valuation] motor no respondió a tiempo:', e.message);
    }

  } catch (e) {
    console.error('[trigger-valuation] catch:', e.message);
    if (!res.headersSent) res.status(500).json({ error: 'error interno' });
  }
};
