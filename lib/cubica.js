// lib/cubica.js · recibe las solicitudes de proyecto de la web de Cúbica (cubica-group.vercel.app).
// Corre dentro de /api/admin-user (vercel.json enruta /api/cubica → /api/admin-user?cubica=1) por el límite
// de 12 funciones. Inserta con la service key en public.cubica_solicitudes (cubica_migration.sql);
// solo los superadmins las leen desde Control → Cúbica.
const { createClient } = require('@supabase/supabase-js');

const HITS = new Map(); // anti-spam liviano por IP e instancia: 5 por hora
const clip = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const ORIGENES = /^https:\/\/([a-z0-9-]+\.)*(cubica-group\.vercel\.app|cubica\.group)$|^http:\/\/localhost(:\d+)?$/;

module.exports = async (req, res) => {
  const o = String(req.headers.origin || '');
  if (ORIGENES.test(o)) {
    res.setHeader('Access-Control-Allow-Origin', o);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'method not allowed' }); return; }
  const URL = process.env.SUPABASE_URL, SK = process.env.SUPABASE_SERVICE_KEY;
  if (!URL || !SK) { res.status(500).json({ error: 'server misconfigured' }); return; }

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'x';
  const now = Date.now();
  const hits = (HITS.get(ip) || []).filter((t) => now - t < 3600e3);
  if (hits.length >= 5) { res.status(429).json({ error: 'Demasiados envíos. Intenta más tarde.' }); return; }

  let b = req.body || {};
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  if (b.website) { res.status(200).json({ ok: true }); return; } // trampa para bots
  const row = {
    plan: clip(b.plan, 60) || null,
    nombre: clip(b.nombre, 120),
    empresa: clip(b.empresa, 160),
    contacto: clip(b.contacto, 160),
    mensaje: clip(b.mensaje, 1500) || null,
    origen: o || null,
  };
  if (row.nombre.length < 2 || row.empresa.length < 2 || row.contacto.length < 6) {
    res.status(400).json({ error: 'Revisa tu nombre, tu empresa y tu correo o WhatsApp.' }); return;
  }

  const admin = createClient(URL, SK, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await admin.from('cubica_solicitudes').insert(row);
  if (error) {
    console.error('[cubica]', error.message);
    res.status(500).json({ error: 'No se pudo enviar. Intenta de nuevo.' });
    return;
  }
  hits.push(now); HITS.set(ip, hits);
  res.status(200).json({ ok: true });
};
