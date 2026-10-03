// lib/postulacion.js · recibe las postulaciones de RueddaCarreras desde ruedda.app/hub.
// Se ejecuta dentro de /api/admin-user (vercel.json enruta /api/postulacion → /api/admin-user?postulacion=1)
// porque el plan de Vercel permite máximo 12 funciones. Inserta con la service key en public.postulaciones;
// solo los superadmins las leen (RLS) desde Ruedda Control → Postulaciones.
const { createClient } = require('@supabase/supabase-js');

const HITS = new Map(); // anti-spam liviano por IP e instancia: 5 por hora
const clip = (v, n) => String(v == null ? '' : v).trim().slice(0, n);

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method not allowed' }); return; }
  const URL = process.env.SUPABASE_URL, SK = process.env.SUPABASE_SERVICE_KEY;
  if (!URL || !SK) { res.status(500).json({ error: 'server misconfigured' }); return; }

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'x';
  const now = Date.now();
  const hits = (HITS.get(ip) || []).filter((t) => now - t < 3600e3);
  if (hits.length >= 5) { res.status(429).json({ error: 'Demasiados envíos. Intenta más tarde.' }); return; }

  const b = req.body || {};
  if (b.website) { res.status(200).json({ ok: true }); return; } // trampa para bots
  const row = {
    tipo: b.tipo === 'certificacion' ? 'certificacion' : 'equipo',
    nombre: clip(b.nombre, 120),
    correo: clip(b.correo, 160).toLowerCase(),
    whatsapp: clip(b.whatsapp, 40) || null,
    area: clip(b.area, 120) || null,
    enlace: clip(b.enlace, 300) || null,
    mensaje: clip(b.mensaje, 1500) || null,
    idioma: b.idioma === 'en' ? 'en' : 'es',
  };
  if (row.nombre.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(row.correo)) {
    res.status(400).json({ error: 'Revisa tu nombre y correo.' }); return;
  }
  if (row.enlace && !/^https?:\/\//i.test(row.enlace)) row.enlace = 'https://' + row.enlace;

  const admin = createClient(URL, SK, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await admin.from('postulaciones').insert(row);
  if (error) {
    console.error('[postulacion]', error.message);
    res.status(500).json({ error: /postulaciones/.test(error.message) ? 'Falta crear la tabla de postulaciones.' : 'No se pudo enviar.' });
    return;
  }
  hits.push(now); HITS.set(ip, hits);
  res.status(200).json({ ok: true });
};
