/**
 * POST /api/send-free-code-blast
 * Header: x-blast-secret: <BLAST_SECRET>
 * Body: { dryRun?: boolean }
 *
 * Envía el correo "código de publicación gratis" (RU3DDA) a TODOS los
 * usuarios con email registrado. Protegido por un secreto compartido (no
 * por sesión) porque este endpoint corre server-side, fuera del flujo
 * normal de auth de un usuario — nadie sin el secreto puede dispararlo.
 *
 * dryRun:true (o sin body) NO manda nada — solo cuenta cuántos correos
 * recibirían el envío, para confirmar el alcance real antes de un envío
 * masivo e irreversible. dryRun:false dispara el envío real, en tandas
 * pequeñas para no saturar el rate limit de Resend.
 */
const { supabaseAdmin } = require('../lib/supabase');
const { sendEmail } = require('../lib/email');
const { templates } = require('../lib/emailTemplates');

// [fix] el primer intento mandaba en tandas de 20 con Promise.all — 20
// requests simultáneas contra un límite real de Resend de 10/s tumbó la
// mayoría con 429, y sendEmail() se tragaba el error en silencio (el
// caller solo veía "sent:86" sin saber cuántos de verdad llegaron). Ahora
// va estrictamente SECUENCIAL con una pausa entre cada uno — más lento,
// pero cada envío se confirma antes de disparar el siguiente, y se cuentan
// éxitos/fallas reales en vez de intentos.
const DELAY_MS = 150; // ~6-7 req/s, con margen bajo el límite de 10/s de Resend

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  if (!process.env.BLAST_SECRET || req.headers['x-blast-secret'] !== process.env.BLAST_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
  if (!body) body = {};
  const dryRun = body.dryRun !== false; // por defecto SIEMPRE dry-run — hay que pedirlo explícito
  const onlyEmails = Array.isArray(body.onlyEmails) && body.onlyEmails.length ? new Set(body.onlyEmails.map(e => String(e).toLowerCase())) : null;
  // [fix timeout] 86 correos secuenciales con pausa entre cada uno puede
  // acercarse al límite de duración de una función serverless — en vez de
  // apostar a un solo request larguísimo, este endpoint acepta offset/limit
  // para mandarse en tandas chicas desde afuera (varios POST cortos),
  // cada uno termina rápido y sin riesgo de que Vercel lo corte a mitad de camino.
  const offset = Number(body.offset) || 0;
  const limit = Number(body.limit) || 15;

  try {
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('email, nombre')
      .not('email', 'is', null);

    if (error) return res.status(500).json({ error: error.message });

    let all = (users || []).filter(u => u.email && u.email.includes('@'));
    if (onlyEmails) all = all.filter(u => onlyEmails.has(u.email.toLowerCase()));

    if (dryRun) {
      return res.status(200).json({ ok: true, dryRun: true, wouldSend: all.length });
    }

    const recipients = all.slice(offset, offset + limit);

    let sentOk = 0;
    const failed = [];
    for (const u of recipients) {
      const { subject, html } = templates.codigoPublicacionGratis({ nombre: u.nombre, codigo: 'RU3DDA' });
      const ok = await sendEmail({ to: u.email, subject, html });
      if (ok) sentOk++; else failed.push(u.email);
      await sleep(DELAY_MS);
    }

    return res.status(200).json({ ok: true, dryRun: false, offset, limit, totalRecipients: all.length, attempted: recipients.length, sentOk, failed });
  } catch (e) {
    console.error('[ruedda] send-free-code-blast catch:', e.message);
    return res.status(500).json({ error: 'internal error' });
  }
};
