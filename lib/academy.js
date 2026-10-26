// lib/academy.js · recibe las solicitudes de cupo de Ruedda Academy desde ruedda.app/academy.
// Se ejecuta dentro de /api/admin-user (vercel.json enruta /api/academy → /api/admin-user?academy=1)
// por el límite de 12 funciones. Inserta con la service key en public.academy_solicitudes
// (ver academy_migration.sql); solo los superadmins las leen (RLS).
const { createClient } = require('@supabase/supabase-js');

const HITS = new Map(); // anti-spam liviano por IP e instancia: 5 por hora
const clip = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const PROGRAMAS = ['mecanica', 'mujeres', 'jovenes', 'compra', 'diagnostico', 'venta'];
const PARA = ['yo', 'hijo', 'empresa'];

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method not allowed' }); return; }
  const URL = process.env.SUPABASE_URL, SK = process.env.SUPABASE_SERVICE_KEY;
  if (!URL || !SK) { res.status(500).json({ error: 'server misconfigured' }); return; }

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'x';
  const now = Date.now();
  const hits = (HITS.get(ip) || []).filter((t) => now - t < 3600e3);
  if (hits.length >= 5) { res.status(429).json({ error: 'Demasiados envíos. Intente más tarde.' }); return; }

  const b = req.body || {};
  if (b.website) { res.status(200).json({ ok: true }); return; } // trampa para bots
  const row = {
    programa: PROGRAMAS.includes(b.programa) ? b.programa : null,
    para: PARA.includes(b.para) ? b.para : 'yo',
    nombre: clip(b.nombre, 120),
    whatsapp: clip(b.whatsapp, 40),
    correo: clip(b.correo, 160).toLowerCase() || null,
    ciudad: clip(b.ciudad, 80) || null,
    mensaje: clip(b.mensaje, 1500) || null,
  };
  if (!row.programa || row.nombre.length < 2 || row.whatsapp.replace(/\D/g, '').length < 7 ||
      (row.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(row.correo))) {
    res.status(400).json({ error: 'Revise el programa, su nombre y su teléfono.' }); return;
  }

  const admin = createClient(URL, SK, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await admin.from('academy_solicitudes').insert(row);
  if (error) {
    console.error('[academy]', error.message);
    res.status(500).json({ error: 'No se pudo enviar. Intente de nuevo.' });
    return;
  }
  hits.push(now); HITS.set(ip, hits);
  res.status(200).json({ ok: true });
};
