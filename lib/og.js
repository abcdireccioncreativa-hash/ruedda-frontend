// lib/og.js · vista previa al compartir una publicación (WhatsApp, iMessage, Facebook, X, Telegram…).
// Los bots que arman la vista previa no corren JavaScript: leen las etiquetas og:* del HTML.
// vercel.json manda a los bots que piden /?market=ID o /?auction=ID a /api/admin-user?og=1
// (las funciones de Vercel están topadas en 12) y aquí se responde un HTML corto con la foto del carro,
// el título y el precio. Una persona que llegara aquí se redirige a la publicación de siempre.
// Solo lee datos públicos con la clave pública (anon): no usa la service key.
const SUPA = 'https://ltodsegzbbdcaublkgtp.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0b2RzZWd6YmJkY2F1YmxrZ3RwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MjIwOTgsImV4cCI6MjA5NTI5ODA5OH0.WXbnE5_XfNwwVUtDGSWa6Voetcflcl7m2vDOpEofs_w';
const SITE = 'https://www.ruedda.app';
const FALLBACK_IMG = SITE + '/icon-192.png';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (v) => (v == null || v === '' || !isFinite(Number(v)) ? '' : '$' + Math.round(Number(v)).toLocaleString('es-VE'));
const km = (v) => (v == null || v === '' || !isFinite(Number(v)) ? '' : Math.round(Number(v)).toLocaleString('es-VE') + ' km');

// foto de portada a 1200x630 en JPEG (el redimensionador de Supabase entrega JPEG a los bots)
function ogImage(photos) {
  const p = (photos || []).filter((x) => x && x.url).sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99))[0];
  if (!p) return null;
  if (p.url.includes('/storage/v1/object/public/')) {
    return p.url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/') + '?width=1200&height=630&resize=cover&quality=72';
  }
  return p.url;
}

async function get(path) {
  const r = await fetch(SUPA + '/rest/v1/' + path, { headers: { apikey: ANON, Authorization: 'Bearer ' + ANON } });
  if (!r.ok) return null;
  const d = await r.json();
  return Array.isArray(d) ? d[0] || null : null;
}

module.exports = async (req, res) => {
  const q = req.query || {};
  const isAuction = !!q.auction && !q.market;
  const id = String(q.market || q.auction || q.id || '').trim();
  const valid = /^[0-9a-fA-F-]{36}$/.test(id);
  const url = valid ? `${SITE}/?${isAuction ? 'auction' : 'market'}=${id}` : SITE + '/';

  let x = null;
  if (valid) {
    try {
      x = isAuction
        ? await get(`auctions?select=id,titulo,marca,modelo,year,km,ciudad,current_bid,precio_reserva,sin_reserva,estado,auction_photos(url,orden)&id=eq.${id}`)
        : await get(`listings?select=id,titulo,marca,modelo,year,km,ciudad,precio_usd,estado,vendido,listing_photos(url,orden)&id=eq.${id}`);
    } catch (e) { x = null; }
  }

  let title = 'Ruedda | Vende o subasta tu carro';
  let desc = 'La app automotriz de Venezuela. Precio justo. Gente verificada.';
  let img = FALLBACK_IMG, big = false;
  if (x) {
    const car = [x.year, x.marca, x.modelo].filter(Boolean).join(' ') || x.titulo || 'Vehículo';
    if (isAuction) {
      const puja = money(x.current_bid);
      title = `${car} · subasta${puja ? ' · puja actual ' + puja : ''}`;
      desc = [x.ciudad, km(x.km), x.sin_reserva ? 'sin reserva' : ''].filter(Boolean).join(' · ') + ' — Puja en Ruedda.';
    } else {
      title = `${car}${x.precio_usd ? ' · ' + money(x.precio_usd) : ''}${x.vendido ? ' · vendido' : ''}`;
      desc = [x.ciudad, km(x.km)].filter(Boolean).join(' · ') + ' — Mira las fotos y escríbele al vendedor en Ruedda.';
    }
    const im = ogImage(isAuction ? x.auction_photos : x.listing_photos);
    if (im) { img = im; big = true; }
  }

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Ruedda">
<meta property="og:locale" content="es_VE">
<meta property="og:url" content="${esc(url)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:image:secure_url" content="${esc(img)}">
${big ? '<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">' : ''}
<meta property="og:image:alt" content="${esc(title)}">
<meta name="twitter:card" content="${big ? 'summary_large_image' : 'summary'}">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(img)}">
<meta http-equiv="refresh" content="0;url=${esc(url)}">
</head><body><a href="${esc(url)}">${esc(title)}</a></body></html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', x ? 'public, s-maxage=900, stale-while-revalidate=86400' : 'public, s-maxage=60');
  res.status(200).send(html);
};
