/**
 * POST /api/send-push
 * Body: { user_id, titulo, body, tipo, source_id, source_type }
 * Header: x-push-secret debe matchear PUSH_WEBHOOK_SECRET
 *
 * Llamado automáticamente por el trigger de Postgres en la tabla
 * 'notifications' (ver push_notifications_migration.sql) — cada vez que se
 * inserta una notificación in-app, esto manda el push real a todos los
 * dispositivos de ese usuario:
 *   · Web Push (navegador / PWA)  → push_subscriptions  (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)
 *   · App iOS (APNs)              → native_push_tokens  (APNS_KEY / APNS_KEY_ID / APNS_TEAM_ID)
 * Cada canal funciona solo si sus claves están configuradas; si faltan, se omite sin error.
 *
 * Mensajes privados (tipo 'pm'): el push sale como en WhatsApp — título con el
 * nombre de quien escribe, subtítulo con el carro de la conversación y el
 * texto real del mensaje; los de un mismo chat se agrupan en el iPhone.
 *
 * "Token/suscripción muerta" (app desinstalada, permiso revocado): se borra la
 * fila para no seguir intentando para siempre.
 */
const http2 = require('http2');
const crypto = require('crypto');
const webpush = require('web-push');
const { supabaseAdmin } = require('../lib/supabase');

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails('mailto:soporte@ruedda.app', VAPID_PUBLIC, VAPID_PRIVATE);
}

// APNs (clave .p8 de Apple Developer → Keys → Apple Push Notifications service)
const APNS_KEY = (process.env.APNS_KEY || '').replace(/\\n/g, '\n').trim();
const APNS_KEY_ID = (process.env.APNS_KEY_ID || '').trim();
const APNS_TEAM_ID = (process.env.APNS_TEAM_ID || '9VNWQFG295').trim();
const APNS_TOPIC = (process.env.APNS_TOPIC || 'com.cubica.ruedda').trim();
const APNS_HOST = process.env.APNS_ENV === 'sandbox' ? 'https://api.sandbox.push.apple.com' : 'https://api.push.apple.com';
const apnsReady = () => !!(APNS_KEY && APNS_KEY_ID && APNS_TEAM_ID);

let _apnsJwt = null, _apnsJwtAt = 0;
function apnsToken() {
  // Apple pide renovarlo entre 20 y 60 min; se reusa 40 min
  const now = Math.floor(Date.now() / 1000);
  if (_apnsJwt && now - _apnsJwtAt < 2400) return _apnsJwt;
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = b64({ alg: 'ES256', kid: APNS_KEY_ID }) + '.' + b64({ iss: APNS_TEAM_ID, iat: now });
  const sig = crypto.sign('sha256', Buffer.from(unsigned), { key: APNS_KEY, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  _apnsJwt = unsigned + '.' + sig; _apnsJwtAt = now;
  return _apnsJwt;
}

function apnsSend(session, token, payload, collapseId) {
  return new Promise((resolve) => {
    const headers = {
      ':method': 'POST',
      ':path': '/3/device/' + token,
      'authorization': 'bearer ' + apnsToken(),
      'apns-topic': APNS_TOPIC,
      'apns-push-type': 'alert',
      'apns-priority': '10'
    };
    if (collapseId) headers['apns-collapse-id'] = collapseId.slice(0, 64);
    const req = session.request(headers);
    let status = 0, data = '';
    req.setEncoding('utf8');
    req.on('response', (h) => { status = h[':status']; });
    req.on('data', (c) => { data += c; });
    req.on('end', () => {
      let reason = '';
      try { reason = JSON.parse(data || '{}').reason || ''; } catch (_) {}
      resolve({ status, reason });
    });
    req.on('error', (e) => resolve({ status: 0, reason: e.message }));
    req.end(JSON.stringify(payload));
  });
}

// texto limpio del mensaje: sin marcas internas [[rdpost:ID]]
const plain = (t) => String(t || '').replace(/\n?\[\[rdpost:[\w-]+\]\]/g, ' · publicación').replace(/\s+/g, ' ').trim();
const clip = (t, n) => (t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t);

// arma el contenido del push (igual para web y app)
async function buildMessage({ user_id, titulo, body, tipo, source_id, source_type }) {
  const msg = { title: titulo || 'Ruedda', subtitle: '', body: body || '', thread: tipo || 'ruedda' };
  if ((tipo === 'pm' || source_type === 'pm') && source_id) {
    try {
      const [{ data: pm }, { data: u }] = await Promise.all([
        supabaseAdmin.from('private_messages').select('text,source_title')
          .eq('sender_id', source_id).eq('receiver_id', user_id)
          .order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabaseAdmin.from('users').select('nombre,username,role').eq('id', source_id).maybeSingle()
      ]);
      let name = (u && (u.nombre || u.username)) || '';
      if (u && (u.role === 'concesionario' || u.role === 'consesionario')) {
        const { data: c } = await supabaseAdmin.from('concesionarios').select('nombre').eq('user_id', source_id).limit(1).maybeSingle();
        if (c && c.nombre) name = c.nombre;
      }
      if (name) msg.title = name;
      if (pm && pm.text) msg.body = clip(plain(pm.text), 240);
      if (pm && pm.source_title) msg.subtitle = clip('sobre ' + pm.source_title, 80);
      msg.thread = 'pm-' + source_id;
    } catch (_) { /* si algo falla, sale con el texto de la notificación */ }
  }
  return msg;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const secret = req.headers['x-push-secret'];
  if (!process.env.PUSH_WEBHOOK_SECRET || secret !== process.env.PUSH_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'no autorizado' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
    if (!body) body = {};
    const { user_id, tipo, source_id, source_type } = body;
    if (!user_id) return res.status(200).json({ ok: true, sent: 0 });

    const msg = await buildMessage(body);
    let web = 0, ios = 0;

    // ── Web Push ──
    if (VAPID_PUBLIC && VAPID_PRIVATE) {
      const { data: subs } = await supabaseAdmin.from('push_subscriptions').select('id,endpoint,p256dh,auth').eq('user_id', user_id);
      const payload = JSON.stringify({ titulo: msg.title, body: (msg.subtitle ? msg.subtitle + ' · ' : '') + msg.body, tipo, source_id, source_type, url: 'https://www.ruedda.app/' });
      await Promise.all((subs || []).map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
          web++;
        } catch (err) {
          if (err.statusCode === 404 || err.statusCode === 410) await supabaseAdmin.from('push_subscriptions').delete().eq('id', s.id);
          else console.warn('[send-push] web', s.id, err.message);
        }
      }));
    }

    // ── App iOS (APNs) ──
    if (apnsReady()) {
      const { data: toks } = await supabaseAdmin.from('native_push_tokens').select('id,token,platform').eq('user_id', user_id);
      const ios_toks = (toks || []).filter((t) => (t.platform || 'ios') === 'ios');
      if (ios_toks.length) {
        let badge;
        try {
          const { count } = await supabaseAdmin.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user_id).eq('read', false);
          if (typeof count === 'number') badge = count;
        } catch (_) {}
        const aps = { alert: { title: msg.title, body: msg.body }, sound: 'default', 'thread-id': msg.thread };
        if (msg.subtitle) aps.alert.subtitle = msg.subtitle;
        if (typeof badge === 'number') aps.badge = badge;
        const payload = { aps, tipo: tipo || '', source_id: source_id || '', source_type: source_type || '' };
        const session = http2.connect(APNS_HOST);
        session.on('error', (e) => console.warn('[send-push] apns session', e.message));
        try {
          await Promise.all(ios_toks.map(async (t) => {
            const r = await apnsSend(session, t.token, payload);
            if (r.status === 200) ios++;
            else if (r.status === 410 || r.reason === 'BadDeviceToken' || r.reason === 'Unregistered') {
              await supabaseAdmin.from('native_push_tokens').delete().eq('id', t.id);
            } else console.warn('[send-push] apns', t.id, r.status, r.reason);
          }));
        } finally { session.close(); }
      }
    }

    return res.status(200).json({ ok: true, sent: web + ios, web, ios, apns: apnsReady() });
  } catch (e) {
    console.error('[send-push] catch:', e.message);
    return res.status(200).json({ ok: false, error: e.message });
  }
};
