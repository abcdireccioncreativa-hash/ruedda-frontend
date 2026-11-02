// lib/vitrina-admin.js — Control → "Master de vitrinas".
// Entra por /api/admin-user?vitrina=1 (límite de 12 funciones en Vercel, mismo patrón que office/partner).
//
// Solo superadmin. Maneja las FOTOS de las publicaciones de cualquier concesionario con la service key,
// porque la RLS de listing_photos solo deja escribir al dueño de la publicación.
// Las imágenes ya vienen subidas por Control al bucket público 'assets'; aquí solo se escriben filas.
//
// Acciones (POST JSON, Authorization: Bearer <jwt>):
//   { action:'add',     listing_id, urls:[...] }        agrega fotos al final
//   { action:'replace', photo_id, url }                 cambia la imagen de una foto (mismo lugar)
//   { action:'delete',  photo_id }                      borra la foto
//   { action:'order',   listing_id, ids:[...] }         reordena (ids en el orden nuevo; el primero es la portada)

const { createClient } = require('@supabase/supabase-js');

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
}

const UUID = /^[0-9a-f-]{36}$/i;
// solo URLs públicas de nuestro propio Storage
const urlOk = (u, base) => typeof u === 'string' && u.length < 600 && u.startsWith(base + '/storage/v1/object/public/');

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const URL = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!URL || !KEY) return res.status(500).json({ error: 'server misconfigured' });
  const admin = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'no autorizado' });
  const { data: who, error: werr } = await admin.auth.getUser(token);
  if (werr || !who?.user) return res.status(401).json({ error: 'sesión inválida' });
  const { data: prof } = await admin.from('users').select('role').eq('id', who.user.id).single();
  if (prof?.role !== 'superadmin') return res.status(403).json({ error: 'solo superadmin' });

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (_) { b = {}; } }
  b = b || {};

  try {
    if (b.action === 'add') {
      if (!UUID.test(b.listing_id || '')) return res.status(400).json({ error: 'publicación inválida' });
      const urls = (Array.isArray(b.urls) ? b.urls : []).filter(u => urlOk(u, URL)).slice(0, 40);
      if (!urls.length) return res.status(400).json({ error: 'sin fotos válidas' });
      const { data: last } = await admin.from('listing_photos').select('orden').eq('listing_id', b.listing_id)
        .order('orden', { ascending: false }).limit(1);
      let o = last && last.length ? (Number(last[0].orden) || 0) + 1 : 0;
      const rows = urls.map(url => ({ listing_id: b.listing_id, url, orden: o++ }));
      const { data, error } = await admin.from('listing_photos').insert(rows).select('id,url,orden');
      if (error) throw error;
      return res.status(200).json({ ok: true, photos: data });
    }

    if (b.action === 'replace') {
      if (!UUID.test(b.photo_id || '') || !urlOk(b.url, URL)) return res.status(400).json({ error: 'parámetros inválidos' });
      const { data, error } = await admin.from('listing_photos').update({ url: b.url }).eq('id', b.photo_id).select('id');
      if (error) throw error;
      if (!data || !data.length) return res.status(404).json({ error: 'foto no encontrada' });
      return res.status(200).json({ ok: true });
    }

    if (b.action === 'delete') {
      if (!UUID.test(b.photo_id || '')) return res.status(400).json({ error: 'foto inválida' });
      const { data, error } = await admin.from('listing_photos').delete().eq('id', b.photo_id).select('id');
      if (error) throw error;
      if (!data || !data.length) return res.status(404).json({ error: 'foto no encontrada' });
      return res.status(200).json({ ok: true });
    }

    if (b.action === 'order') {
      if (!UUID.test(b.listing_id || '')) return res.status(400).json({ error: 'publicación inválida' });
      const ids = (Array.isArray(b.ids) ? b.ids : []).filter(x => UUID.test(x));
      const { data: cur, error: e0 } = await admin.from('listing_photos').select('id').eq('listing_id', b.listing_id);
      if (e0) throw e0;
      const mine = new Set((cur || []).map(p => p.id));
      if (ids.length !== mine.size || !ids.every(x => mine.has(x))) return res.status(400).json({ error: 'las fotos cambiaron, recarga' });
      for (let i = 0; i < ids.length; i++) {
        const { error } = await admin.from('listing_photos').update({ orden: i }).eq('id', ids[i]);
        if (error) throw error;
      }
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'acción desconocida' });
  } catch (e) {
    console.error('[vitrina-admin]', e.message);
    return res.status(500).json({ error: 'error: ' + e.message });
  }
};
