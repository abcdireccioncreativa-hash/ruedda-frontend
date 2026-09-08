/**
 * POST /api/send-push
 * Body: { user_id, titulo, body, tipo, source_id, source_type }
 * Header: x-push-secret debe matchear PUSH_WEBHOOK_SECRET
 *
 * Llamado automáticamente por el trigger de Postgres en la tabla
 * 'notifications' (ver push_notifications_migration.sql) — cada vez que se
 * inserta una notificación in-app, esto manda el push real a todos los
 * dispositivos suscritos de ese usuario.
 *
 * "Suscripción muerta" = el navegador/OS ya no reconoce ese endpoint (el
 * usuario desinstaló, revocó el permiso, etc). web-push devuelve 404/410 en
 * esos casos — cuando pasa, se borra esa fila de push_subscriptions para no
 * seguir intentando mandarle para siempre.
 */
const webpush = require('web-push');
const { supabaseAdmin } = require('../lib/supabase');

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails('mailto:soporte@ruedda.app', VAPID_PUBLIC, VAPID_PRIVATE);
}

function urlFor(source_type, source_id) {
  // [ajustar cuando exista deep-linking real] por ahora manda siempre a home;
  // el click en la notificación ya deja el contexto (source_type/source_id)
  // disponible del lado del cliente vía notification.data si más adelante se
  // arma routing directo (ej. abrir el detalle de la subasta X).
  return 'https://www.ruedda.app/';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const secret = req.headers['x-push-secret'];
  if (!process.env.PUSH_WEBHOOK_SECRET || secret !== process.env.PUSH_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'no autorizado' });
  }
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    console.warn('[send-push] VAPID keys no configuradas todavia, se omite envio');
    return res.status(200).json({ ok: true, sent: 0, note: 'VAPID no configurado' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
    if (!body) body = {};
    const { user_id, titulo, body: msgBody, tipo, source_id, source_type } = body;
    if (!user_id) return res.status(200).json({ ok: true, sent: 0 });

    const { data: subs } = await supabaseAdmin
      .from('push_subscriptions')
      .select('id,endpoint,p256dh,auth')
      .eq('user_id', user_id);

    if (!subs || !subs.length) return res.status(200).json({ ok: true, sent: 0 });

    const payload = JSON.stringify({
      titulo, body: msgBody, tipo, source_id, source_type,
      url: urlFor(source_type, source_id)
    });

    let sent = 0;
    await Promise.all(subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        );
        sent++;
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await supabaseAdmin.from('push_subscriptions').delete().eq('id', s.id);
        } else {
          console.warn('[send-push] fallo enviando a', s.id, err.message);
        }
      }
    }));

    return res.status(200).json({ ok: true, sent });
  } catch (e) {
    console.error('[send-push] catch:', e.message);
    return res.status(200).json({ ok: false, error: e.message });
  }
};
