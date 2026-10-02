// lib/ai-describe.js · "Mejorar con IA" para descripciones de vehículos.
// Se ejecuta dentro de /api/admin-user (vercel.json enruta /api/ai-describe hacia /api/admin-user?ai=describe)
// porque el plan de Vercel permite máximo 12 funciones.
//
// · Solo usuarios con sesión real de Ruedda (se valida el JWT con la service key).
// · Proveedor: Google Gemini (capa gratuita de Google AI Studio). La llave vive SOLO en el servidor:
//     GEMINI_API_KEY   (obligatoria, Vercel → Settings → Environment Variables)
//     GEMINI_MODEL     (opcional, por defecto gemini-flash-latest)
// · Devuelve un solo párrafo limpio, sin inventar datos que el usuario no dio.

const { createClient } = require('@supabase/supabase-js');

const HITS = new Map(); // límite liviano por usuario e instancia: 12 por hora
const LIMIT = 12, WINDOW = 3600e3;

const SYSTEM = [
  'Eres el redactor de Ruedda, el marketplace automotriz de Venezuela.',
  'Escribe la descripción de un vehículo en venta: un solo párrafo, en español neutro, elegante, cálido y humano, como lo escribiría un vendedor serio que conoce su carro.',
  'Entre 70 y 130 palabras. Frases claras, ritmo natural, sin listas, sin títulos, sin emojis, sin signos de exclamación, sin mayúsculas sostenidas.',
  'Usa SOLO los datos que te dan (borrador del usuario y campos del formulario). Nunca inventes equipamiento, historial, estado, cifras ni garantías.',
  'Si un dato no está, no lo menciones. No incluyas precio, teléfonos, correos, enlaces ni datos de contacto.',
  'No uses guiones largos ni guiones medios; usa comas o puntos.',
  'Entrega únicamente el párrafo final, sin comillas ni comentarios.',
].join(' ');

function clean(t) {
  return String(t || '')
    .replace(/^["'“”«»\s]+|["'“”«»\s]+$/g, '')
    .replace(/\*\*|__|#+\s*/g, '')
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/\s*\n+\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

module.exports = async (req, res) => {
  // GET: el botón solo aparece si la IA está activada en el servidor
  if (req.method === 'GET') { res.setHeader('Cache-Control', 'public, max-age=300'); res.status(200).json({ enabled: !!process.env.GEMINI_API_KEY }); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'method not allowed' }); return; }
  const URL = process.env.SUPABASE_URL, SK = process.env.SUPABASE_SERVICE_KEY, KEY = process.env.GEMINI_API_KEY;
  if (!URL || !SK) { res.status(500).json({ error: 'server misconfigured' }); return; }
  if (!KEY) { res.status(503).json({ error: 'La IA aún no está activada.' }); return; }

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) { res.status(401).json({ error: 'Inicia sesión para usar la IA.' }); return; }
  const admin = createClient(URL, SK, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: u, error: ue } = await admin.auth.getUser(token);
  if (ue || !u || !u.user) { res.status(401).json({ error: 'Inicia sesión para usar la IA.' }); return; }

  const now = Date.now(), uid = u.user.id;
  const hits = (HITS.get(uid) || []).filter((t) => now - t < WINDOW);
  if (hits.length >= LIMIT) { res.status(429).json({ error: 'Llegaste al límite por hora. Intenta más tarde.' }); return; }
  hits.push(now); HITS.set(uid, hits);

  const body = req.body || {};
  const draft = String(body.draft || '').slice(0, 2500);
  const fields = Array.isArray(body.fields) ? body.fields.slice(0, 40) : [];
  const facts = fields
    .map((f) => [String((f && f[0]) || '').slice(0, 60), String((f && f[1]) || '').slice(0, 120)])
    .filter(([k, v]) => k && v && !/whats|tel[eé]f|c[eé]dula|correo|email|precio|usd|\$/i.test(k + ' ' + v))
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');
  if (!draft.trim() && !facts) { res.status(400).json({ error: 'Escribe algo del carro o completa los datos primero.' }); return; }

  const prompt = `Datos del formulario:\n${facts || '(sin datos)'}\n\nBorrador del usuario:\n${draft.trim() || '(vacío)'}\n\nRedacta la descripción final.`;
  const model = process.env.GEMINI_MODEL || 'gemini-flash-latest';

  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error('[ai-describe]', r.status, JSON.stringify(j).slice(0, 400));
      res.status(502).json({ error: r.status === 429 ? 'La IA está ocupada. Intenta en un minuto.' : 'No se pudo mejorar el texto.' });
      return;
    }
    const parts = (((j.candidates || [])[0] || {}).content || {}).parts || [];
    const text = clean(parts.map((p) => p.text || '').join(' '));
    if (!text) { res.status(502).json({ error: 'No se pudo mejorar el texto.' }); return; }
    res.status(200).json({ text });
  } catch (e) {
    console.error('[ai-describe]', e && e.message);
    res.status(502).json({ error: 'No se pudo mejorar el texto.' });
  }
};
