// lib/email.js
// Envío de correos transaccionales vía Resend (REST API, sin SDK extra —
// Node 18+ en Vercel trae fetch nativo). Uso best-effort: si falla, se loguea
// y no debe tumbar el flujo principal que lo llama.

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = 'Ruedda <notificaciones@ruedda.app>';

async function sendEmail({ to, subject, html }) {
  if (!RESEND_API_KEY || !to) return;
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ from: FROM, to, subject, html })
    });
    if (!resp.ok) {
      console.error('[ruedda email]', resp.status, await resp.text());
    }
  } catch (e) {
    console.error('[ruedda email] catch:', e.message);
  }
}

function layout(title, body) {
  return `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#fff">
    <h2 style="color:#111;margin:0 0 16px">${title}</h2>
    <p style="color:#333;font-size:15px;line-height:1.5;margin:0 0 24px">${body}</p>
    <a href="https://www.ruedda.app" style="display:inline-block;background:#c8ff4d;color:#111;font-weight:bold;text-decoration:none;padding:12px 20px;border-radius:8px">Ir a Ruedda</a>
    <p style="margin-top:32px;font-size:12px;color:#999">Ruedda — el marketplace automotriz venezolano</p>
  </div>`;
}

module.exports = { sendEmail, layout };
