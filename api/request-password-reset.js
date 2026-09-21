/**
 * POST /api/request-password-reset
 * Body: { email }
 *
 * Genera el link de recuperación con Supabase Admin (generateLink) y lo envía
 * por Resend — así Ruedda controla el envío del correo en vez de depender del
 * SMTP propio de Supabase. Mientras RESEND_API_KEY no esté configurada en
 * Vercel, cae de vuelta a Supabase enviando su propio correo (mismo camino
 * que ya funcionaba antes) — nada se rompe en el interín. En cuanto se agregue
 * la env var, este endpoint empieza a mandar por Resend solo, sin más cambios.
 *
 * Respuesta siempre 200 con {ok:true} — anti-enumeración: nunca se confirma
 * si el correo existe o no en la base.
 */
const { supabaseAdmin, supabaseAnon } = require('../lib/supabase');
const { sendEmail } = require('../lib/email');
const { templates } = require('../lib/emailTemplates');

/**
 * POST /api/request-password-reset?action=resolve-login
 * Body: { identifier }
 *
 * Resuelve un @usuario al email real registrado, para permitir loguearse
 * solo con el usuario (Supabase Auth exige email+password, no tiene concepto
 * de username). Si `identifier` ya es un email, se devuelve tal cual sin
 * consultar la tabla — evita una consulta innecesaria en el camino normal.
 * Usa supabaseAdmin (service role) porque el email no es público vía RLS.
 */
async function resolveLogin(req, res) {
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
  if (!body) body = {};
  const identifier = String(body.identifier || '').trim();
  if (!identifier) return res.status(400).json({ error: 'falta usuario o correo' });

  if (identifier.includes('@') && /\S+@\S+\.\S+/.test(identifier)) {
    return res.status(200).json({ email: identifier });
  }

  const username = identifier.replace(/^@/, '');
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('email')
    .ilike('username', username)
    .maybeSingle();
  if (error || !data?.email) return res.status(404).json({ error: 'usuario no encontrado' });
  return res.status(200).json({ email: data.email });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  if (req.query.action === 'resolve-login') return resolveLogin(req, res);

  try {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
    if (!body) body = {};
    const email = String(body.email || '').trim();
    if (!email || !email.includes('@')) return res.status(200).json({ ok: true });

    const redirectTo = (process.env.SITE_URL || 'https://www.ruedda.app') + '/';

    if (process.env.RESEND_API_KEY) {
      // camino Resend: generamos el link seguro con el admin de Supabase
      // (mismo token/expiry que su flujo nativo) y lo mandamos nosotros.
      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo }
      });
      if (!error && data?.properties?.action_link) {
        const { subject, html } = templates.resetPassword({ actionUrl: data.properties.action_link });
        await sendEmail({ to: email, subject, html });
      } else {
        console.warn('[ruedda] generateLink falló, se omite envío:', error?.message);
      }
    } else {
      // camino de respaldo mientras no haya Resend configurado: el correo
      // nativo de Supabase (mismo comportamiento de siempre).
      const { error } = await supabaseAnon.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) console.warn('[ruedda] resetPasswordForEmail fallback falló:', error.message);
    }
  } catch (e) {
    console.error('[ruedda] request-password-reset catch:', e.message);
  }
  return res.status(200).json({ ok: true });
};
