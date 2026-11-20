// lib/team.js · recibe las aplicaciones al equipo fundador desde ruedda.app/team.
// Se ejecuta dentro de /api/admin-user (vercel.json enruta /api/team → /api/admin-user?team=1)
// porque el plan de Vercel permite máximo 12 funciones. Inserta con la service key en
// public.team_solicitudes (ver team_migration.sql); solo los superadmins las leen (RLS).
const { createClient } = require('@supabase/supabase-js');

const HITS = new Map(); // anti-spam liviano por IP e instancia: 5 por hora
const clip = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const AREAS = ['operaciones', 'marketing', 'comunidad', 'tecnologia', 'otra'];
const DISP = ['completo', 'medio', 'proyecto'];

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

  // respuestas opcionales: solo claves r_* conocidas en forma, textos recortados, máximo 40 claves
  const resp = {};
  const rin = (b.respuestas && typeof b.respuestas === 'object') ? b.respuestas : {};
  Object.keys(rin).filter((k) => /^r_[a-z0-9_]{1,30}$/.test(k)).slice(0, 40).forEach((k) => {
    const v = rin[k];
    resp[k] = Array.isArray(v) ? v.slice(0, 10).map((x) => clip(x, 60)) : clip(v, 800);
  });

  const areas = (Array.isArray(b.areas) ? b.areas : []).filter((a) => AREAS.includes(a));
  const row = {
    nombre: clip(b.nombre, 120),
    contacto: clip(b.contacto, 80),
    ciudad: clip(b.ciudad, 80),
    areas: [...new Set(areas)],
    area_otra: clip(b.area_otra, 200) || null,
    logros: clip(b.logros, 800),
    motivo: clip(b.motivo, 800),
    disponibilidad: DISP.includes(b.disponibilidad) ? b.disponibilidad : null,
    linkedin: clip(b.linkedin, 200) || null,
    portafolio: clip(b.portafolio, 200) || null,
    respuestas: resp,
  };
  if (row.nombre.length < 2 || row.contacto.length < 3 || row.ciudad.length < 2 || !row.areas.length ||
      row.logros.length < 2 || row.motivo.length < 2 || !row.disponibilidad) {
    res.status(400).json({ error: 'Revisa los campos obligatorios.' }); return;
  }

  const admin = createClient(URL, SK, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await admin.from('team_solicitudes').insert(row);
  if (error) {
    console.error('[team]', error.message);
    res.status(500).json({ error: 'No se pudo enviar. Intenta de nuevo.' });
    return;
  }
  hits.push(now); HITS.set(ip, hits);
  res.status(200).json({ ok: true });
};
