// lib/news.js · "Noticias by Motorpasión" en Comunidad.
// Motorpasión México publica un RSS público en español (sin clave ni registro). El navegador no puede
// leerlo directo (sin CORS), así que /api/noticias llega aquí (vercel.json; las funciones están topadas
// en 12), se lee el feed, se arma un JSON corto (título, link, foto, fecha, autor) y la CDN de Vercel lo
// guarda 30 min. Cada nota abre en la web de Motorpasión: aquí solo va el titular y la foto de portada.
const FEED = 'https://www.motorpasion.com.mx/index.xml';
const SOURCE = 'Motorpasión';

const strip = (s) => String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '').trim();
const ent = (s) => s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
const tag = (it, t) => { const m = it.match(new RegExp('<' + t + '[^>]*>([\\s\\S]*?)</' + t + '>')); return m ? ent(strip(m[1])) : ''; };

// las fotos de i.blogs.es vienen a 1024px; para la tarjeta basta 450px (mismo archivo, otra medida)
const small = (u) => u.replace(/\/(\d+)_(\d+)\.(jpe?g|png|webp)$/i, '/450_1000.$3');

module.exports = async (req, res) => {
  try {
    const r = await fetch(FEED, { headers: { 'User-Agent': 'Mozilla/5.0 (Ruedda news)' } });
    if (!r.ok) throw new Error('feed ' + r.status);
    const xml = await r.text();
    const items = xml.split('<item>').slice(1).map((it) => {
      const img = (it.match(/<img[^>]+src="([^"]+)"/) || [])[1] || '';
      const link = tag(it, 'link');
      return { t: tag(it, 'title'), u: link, img: img ? small(img) : '', at: new Date(tag(it, 'pubDate')).toISOString(), by: tag(it, 'dc:creator') };
    }).filter((n) => n.t && /^https:\/\//.test(n.u)).slice(0, 12);
    res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=86400');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).send(JSON.stringify({ source: SOURCE, site: 'https://www.motorpasion.com.mx', items }));
  } catch (e) {
    res.setHeader('Cache-Control', 'public, s-maxage=120');
    res.status(200).json({ source: SOURCE, items: [], error: String(e.message || e) });
  }
};
