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
const { sendEmail, layout } = require('../lib/email');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

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
        await sendEmail({
          to: email,
          subject: 'Restablece tu contraseña de Ruedda',
          html: layout(
            'Restablece tu contraseña',
            `Pediste restablecer la contraseña de tu cuenta Ruedda. Si fuiste tú, entra al siguiente enlace (vence en un rato, por tu seguridad):<br><br>` +
            `<a href="${data.properties.action_link}" style="color:#111">${data.properties.action_link}</a><br><br>` +
            `Si no fuiste tú, ignora este correo — tu contraseña sigue igual.`
          )
        });
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
