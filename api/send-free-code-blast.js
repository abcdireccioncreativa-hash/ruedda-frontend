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

const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 1200; // Resend free/starter tier: ~2 req/s de margen

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

  try {
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('email, nombre')
      .not('email', 'is', null);

    if (error) return res.status(500).json({ error: error.message });

    const recipients = (users || []).filter(u => u.email && u.email.includes('@'));

    if (dryRun) {
      return res.status(200).json({ ok: true, dryRun: true, wouldSend: recipients.length });
    }

    let sent = 0;
    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(u => {
        const { subject, html } = templates.codigoPublicacionGratis({ nombre: u.nombre, codigo: 'RU3DDA' });
        return sendEmail({ to: u.email, subject, html });
      }));
      sent += batch.length;
      if (i + BATCH_SIZE < recipients.length) await sleep(BATCH_DELAY_MS);
    }

    return res.status(200).json({ ok: true, dryRun: false, sent });
  } catch (e) {
    console.error('[ruedda] send-free-code-blast catch:', e.message);
    return res.status(500).json({ error: 'internal error' });
  }
};
