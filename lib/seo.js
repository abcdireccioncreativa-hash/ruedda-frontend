// lib/seo.js · páginas indexables de Ruedda (carros, marcas, ciudades, subastas) + sitemap vivo + llms.txt.
// La app (index.html / desktop.html) es una SPA: Google no tenía una URL por carro, solo "ruedda.app".
// Aquí se sirven páginas HTML reales, livianas y sin JavaScript de la app, en rutas NUEVAS:
//   /vehiculos/venezuela             todos los vehículos en venta (/vehiculos a secas sigue siendo la app)
//   /vehiculos/<marca>                  ej. /vehiculos/toyota
//   /vehiculos/<marca>/<modelo>         ej. /vehiculos/toyota/4runner
//   /vehiculos/ciudad/<ciudad>          ej. /vehiculos/ciudad/caracas
//   /vehiculos/tipo/<carroceria>        ej. /vehiculos/tipo/suv
//   /vehiculos/<año-marca-modelo-ciudad>-<id8>   la publicación (ej. /vehiculos/2007-mitsubishi-lancer-caracas-f10ebf82)
//   /subastas/<año-marca-modelo-ciudad>-<id8>    la subasta
//   /sitemap.xml  /llms.txt          generados con el inventario real
//   ?seo=go&market=ID|auction=ID     301 de las URL viejas (/?market=) a la URL bonita, solo para buscadores
// Nada de esto toca las rutas de la app: las personas siguen abriendo /?market=ID igual que siempre.
// Solo lee datos públicos con la clave anon. Nunca se muestra whatsapp ni access_code.
// Todo sale con caché de CDN (s-maxage + stale-while-revalidate): la función casi nunca corre en frío.
const SUPA = 'https://ltodsegzbbdcaublkgtp.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0b2RzZWd6YmJkY2F1YmxrZ3RwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MjIwOTgsImV4cCI6MjA5NTI5ODA5OH0.WXbnE5_XfNwwVUtDGSWa6Voetcflcl7m2vDOpEofs_w';
const SITE = 'https://www.ruedda.app';
const APPSTORE = 'https://apps.apple.com/app/ruedda-la-app-automotriz/id6812039590';
const ORG = { '@type': 'Organization', '@id': SITE + '/#org', name: 'Ruedda', url: SITE + '/', logo: SITE + '/icon-512.png', sameAs: ['https://www.instagram.com/ruedda.app'] };

// ───────── utilidades ─────────
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const xesc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
const num = (v) => (v == null || v === '' || !isFinite(Number(v)) ? null : Number(v));
const money = (v) => (num(v) == null ? '' : '$' + Math.round(num(v)).toLocaleString('es-VE'));
const kmf = (v) => (num(v) == null ? '' : Math.round(num(v)).toLocaleString('es-VE') + ' km');
const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const UUID = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
// id corto al final de la URL: 8 hex (los primeros del uuid). Acepta también el uuid completo (URL vieja → 301).
const SHORT = /(?:^|-)([0-9a-f]{8})(?:-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?$/i;
const cap = (w) => (/\d/.test(w) || w.length <= 3 && /^[A-Z]+$/.test(w) && !/^(DE|LA|EL)$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
const titleCase = (s) => String(s || '').trim().split(/\s+/).map(cap).join(' ');
const jsonld = (o) => '<script type="application/ld+json">' + JSON.stringify(o).replace(/</g, '\\u003c') + '</script>';
const iso = (d) => { try { return new Date(d).toISOString(); } catch (e) { return null; } };

async function rest(path) {
  const r = await fetch(SUPA + '/rest/v1/' + path, { headers: { apikey: ANON, Authorization: 'Bearer ' + ANON } });
  if (!r.ok) throw new Error('rest ' + r.status);
  return r.json();
}

// foto por render/image de Supabase (redimensiona y entrega webp/avif al navegador que lo acepta)
function img(url, w, h) {
  if (!url) return '';
  if (!url.includes('/storage/v1/object/public/')) return url;
  return url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/') + `?width=${w}${h ? `&height=${h}&resize=cover` : ''}&quality=74`;
}
const photosOf = (x) => (x.listing_photos || x.auction_photos || []).filter((p) => p && p.url).sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99)).map((p) => p.url);

// ───────── nombres y URL ─────────
// "Mitsubishi" + "Lancer" + versión canónica "EVOLUTION 9" → "Mitsubishi Lancer Evolution 9"
function carName(x) {
  const marca = String(x.marca || '').trim();
  let modelo = String(x.modelo || '').trim();
  if (marca && modelo.toLowerCase().startsWith(marca.toLowerCase() + ' ')) modelo = modelo.slice(marca.length + 1);
  let name = [marca && marca !== 'Otro' ? marca : '', modelo].filter(Boolean).join(' ');
  const ver = String(x.version_canonica || '').trim();
  if (ver) {
    const low = name.toLowerCase();
    const extra = ver.split(/\s+/).filter((w) => !low.includes(w.toLowerCase()));
    if (extra.length === ver.split(/\s+/).length) name += ' ' + titleCase(ver);
  }
  return name || String(x.titulo || 'Vehículo').trim();
}
const modelKey = (x) => slug(String(x.modelo_canonico || '').trim() || String(x.modelo || '').trim().replace(new RegExp('^' + String(x.marca || '').replace(/[^\w]/g, '') + '\\s+', 'i'), ''));
// slug de URL = año-marca-modelo-ciudad, sin palabras repetidas ni "otro". desktop.html arma EXACTAMENTE la misma (_rdSlug).
const urlSlug = (x) => slug(`${x.year} ${x.marca} ${x.modelo} ${x.ciudad || ''}`).split('-').filter((t, i, a) => t && t !== 'otro' && t !== 'null' && t !== 'undefined' && t !== a[i - 1]).join('-');
const shortId = (x) => String(x.id).slice(0, 8);
const carUrl = (x) => `${SITE}/vehiculos/${urlSlug(x) ? urlSlug(x) + '-' : ''}${shortId(x)}`;
const subUrl = (x) => `${SITE}/subastas/${urlSlug(x) ? urlSlug(x) + '-' : ''}${shortId(x)}`;
const appCar = (x) => `/?market=${x.id}`;
const appSub = (x) => `/?auction=${x.id}`;

const TIPOS = { sedan: 'Sedán', suv: 'SUV', camioneta: 'Camioneta', pickup: 'Pickup', hatchback: 'Hatchback', coupe: 'Coupé', descapotable: 'Descapotable', roadster: 'Roadster', crossover: 'Crossover', van: 'Van', moto: 'Moto', camion: 'Camión' };
const TIPOS_PL = { sedan: 'Sedanes', suv: 'SUV', camioneta: 'Camionetas', pickup: 'Pickups', hatchback: 'Hatchbacks', coupe: 'Coupés', descapotable: 'Descapotables', roadster: 'Roadsters', crossover: 'Crossovers', van: 'Vans', moto: 'Motos', camion: 'Camiones' };
const tipoName = (t) => TIPOS[slug(t)] || titleCase(t);
const BODY = { sedan: 'Sedan', suv: 'SUV', camioneta: 'SUV', pickup: 'Pickup truck', hatchback: 'Hatchback', coupe: 'Coupe', descapotable: 'Convertible', roadster: 'Roadster', crossover: 'Crossover', van: 'Van' };
const TRANS = { 'sincrónica': 'Manual', sincronica: 'Manual', manual: 'Manual', 'automática': 'Automatic', automatica: 'Automatic' };
const FUEL = { gasolina: 'Gasoline', diesel: 'Diesel', 'diésel': 'Diesel', 'eléctrico': 'Electric', electrico: 'Electric', 'híbrido': 'Hybrid', hibrido: 'Hybrid', gas: 'CNG' };

// ───────── datos (memoria corta por instancia; la CDN hace el resto) ─────────
const LSEL = 'id,titulo,marca,modelo,year,km,color,motor,traccion,transmision,combustible,tipo_vehiculo,ciudad,descripcion,precio_usd,condicion,estado,es_chocado,created_at,updated_at,estado_fisico,duenos,precio_anterior,vendido,vendido_at,auditado_ruedda,financiamiento_disponible,version_canonica,modelo_canonico,concesionario_id,concesionarios(nombre),listing_photos(url,orden)';
const ASEL = 'id,titulo,marca,modelo,year,km,color,motor,traccion,transmision,combustible,tipo_vehiculo,ciudad,descripcion,condicion,estado,created_at,updated_at,duenos,precio_reserva,current_bid,sin_reserva,end_time,bid_count,es_programada,fecha_inicio_programada,version_canonica,modelo_canonico,access_code,auction_photos(url,orden)';
let _cache = { t: 0, l: null, a: null };
async function inventory() {
  if (_cache.l && Date.now() - _cache.t < 120000) return _cache;
  const [l, a] = await Promise.all([
    rest(`listings?select=${LSEL}&estado=eq.activa&order=vendido.asc,created_at.desc&limit=1000`),
    rest(`auctions?select=${ASEL}&estado=eq.activa&order=created_at.desc&limit=300`),
  ]);
  // access_code = subasta privada por código: no se indexa ni se expone el código
  const auctions = a.map((x) => { const p = !!x.access_code; delete x.access_code; x._private = p; return x; });
  _cache = { t: Date.now(), l, a: auctions };
  return _cache;
}

// ───────── estilos (una sola hoja en línea, ~4 KB, sin JS) ─────────
const CSS = `@font-face{font-family:OS;font-weight:400;font-display:swap;src:url(/assets/fonts/opensauceone-400.d20e72bf.woff2) format('woff2')}
@font-face{font-family:OS;font-weight:500;font-display:swap;src:url(/assets/fonts/opensauceone-500.0fc79baa.woff2) format('woff2')}
*{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#fafaf7;--fg:#0b0b0c;--mute:rgba(11,11,12,.56);--dim:rgba(11,11,12,.38);--line:rgba(11,11,12,.09);--y:#e6f03b}
html{-webkit-text-size-adjust:100%}
body{background:var(--bg);color:var(--fg);font:400 16px/1.5 OS,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
a{color:inherit;text-decoration:none}
img{display:block;max-width:100%}
.w{max-width:1180px;margin:0 auto;padding:0 20px}
header{position:sticky;top:0;z-index:5;background:rgba(250,250,247,.92);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}
header .w{height:60px;display:flex;align-items:center;justify-content:space-between;gap:16px}
header img{height:22px;width:auto}
header nav{display:flex;gap:22px;font-size:14px;color:var(--mute)}
header nav a:hover{color:var(--fg)}
.bc{font-size:13px;color:var(--dim);padding:22px 0 0;display:flex;flex-wrap:wrap;gap:6px}
.bc a:hover{color:var(--fg)}
.bc span:before{content:'/';margin-right:6px;color:var(--dim)}
.car{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(0,1fr);gap:44px;padding:18px 0 56px;align-items:start}
.gal{display:grid;grid-auto-flow:column;grid-auto-columns:100%;overflow-x:auto;scroll-snap-type:x mandatory;border-radius:20px;background:#ececE8;scrollbar-width:none}
.gal::-webkit-scrollbar{display:none}
.gal img{width:100%;height:auto;aspect-ratio:4/3;object-fit:cover;object-position:50% 62%;scroll-snap-align:start}
.thumbs{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:8px;margin-top:10px}
.thumbs img{width:100%;height:auto;aspect-ratio:4/3;object-fit:cover;border-radius:10px}
.info{position:sticky;top:84px}
.k{font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--mute)}
h1{font-weight:500;font-size:clamp(30px,4vw,44px);line-height:1.04;letter-spacing:-.04em;margin:10px 0 10px}
.meta{color:var(--mute);font-size:15px}
.price{font-weight:500;font-size:40px;letter-spacing:-.04em;margin:22px 0 4px;display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}
.price s{font-size:18px;color:var(--dim);font-weight:400;letter-spacing:-.01em}
.tag{display:inline-block;font-size:12px;font-weight:500;padding:4px 10px;border-radius:999px;background:var(--fg);color:#fff;letter-spacing:.02em}
.tag.y{background:var(--y);color:var(--fg)}
.cta{display:grid;gap:10px;margin:26px 0 30px}
.btn{height:54px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-weight:500;font-size:16px;background:var(--fg);color:#fff}
.btn.o{background:transparent;color:var(--fg);box-shadow:inset 0 0 0 1px rgba(11,11,12,.18)}
dl{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid var(--line)}
dl div{padding:13px 0;border-bottom:1px solid var(--line)}
dl div:nth-child(odd){padding-right:14px}
dt{font-size:12px;color:var(--mute)}
dd{font-weight:500;font-size:15px;margin-top:2px}
.desc{margin-top:28px;white-space:pre-line;color:#2a2a28;font-size:15.5px;line-height:1.65}
h2{font-weight:500;font-size:24px;letter-spacing:-.03em;margin:0 0 18px}
section.more{padding:44px 0 10px;border-top:1px solid var(--line)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:26px 20px}
.card img{height:auto;aspect-ratio:4/3;object-fit:cover;border-radius:16px;background:#ececE8;width:100%}
.card b{display:block;font-weight:500;font-size:16px;letter-spacing:-.01em;margin-top:12px}
.card p{font-size:13.5px;color:var(--mute);margin-top:1px}
.card i{font-style:normal;display:block;font-weight:500;font-size:17px;margin-top:6px}
.card.sold img{filter:grayscale(1);opacity:.7}
.hero{padding:44px 0 30px}
.hero h1{font-size:clamp(36px,6vw,64px);max-width:16ch}
.hero p{color:var(--mute);font-size:17px;max-width:62ch;margin-top:8px}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin:22px 0 0}
.chips a{font-size:14px;padding:8px 14px;border-radius:999px;box-shadow:inset 0 0 0 1px rgba(11,11,12,.14)}
.chips a:hover,.chips a.on{background:var(--fg);color:#fff;box-shadow:none}
.links{padding:36px 0 0;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:26px}
.links h3{font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--mute);font-weight:400;margin-bottom:10px}
.links a{display:block;font-size:14.5px;padding:3px 0;color:#2a2a28}
.links a:hover{color:var(--fg);text-decoration:underline}
footer{margin-top:64px;border-top:1px solid var(--line);padding:30px 0 50px;font-size:13.5px;color:var(--mute)}
footer .w{display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap}
footer a{color:var(--fg)}
.empty{padding:30px 0;color:var(--mute)}
@media(max-width:860px){.car{grid-template-columns:1fr;gap:22px}.info{position:static}.gal{border-radius:0;margin:0 -20px}.thumbs{display:none}header nav{gap:16px}header nav .h{display:none}.price{font-size:34px}}`;

// ───────── piezas ─────────
function page({ title, desc, canonical, ogImage, robots, ld, body, preload }) {
  return `<!doctype html><html lang="es-VE"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canonical)}">
<meta name="robots" content="${robots || 'index,follow,max-image-preview:large,max-snippet:-1'}">
<meta name="theme-color" content="#fafaf7">
<link rel="icon" href="/favicon.png">
<link rel="apple-touch-icon" href="/icon-180.png">
<link rel="preload" href="/assets/fonts/opensauceone-500.0fc79baa.woff2" as="font" type="font/woff2" crossorigin>
${preload ? `<link rel="preconnect" href="${SUPA}" crossorigin><link rel="preload" as="image" href="${esc(preload)}" fetchpriority="high">` : `<link rel="preconnect" href="${SUPA}" crossorigin>`}
<meta property="og:type" content="website">
<meta property="og:site_name" content="Ruedda">
<meta property="og:locale" content="es_VE">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(ogImage || SITE + '/icon-512.png')}">
<meta name="twitter:card" content="${ogImage ? 'summary_large_image' : 'summary'}">
<meta name="apple-itunes-app" content="app-id=6812039590">
<style>${CSS}</style>
${(ld || []).map(jsonld).join('\n')}
</head><body>
<header><div class="w"><a href="/" aria-label="Ruedda, inicio"><img src="/assets/ruedda-wordmark-negro.png" alt="Ruedda" width="92" height="22"></a>
<nav><a href="/vehiculos/venezuela">Vehículos en venta</a><a class="h" href="/subastas">Subastas</a><a class="h" href="/concesionarios">Concesionarios</a><a href="/publicar">Vender</a></nav></div></header>
<main class="w">${body}</main>
<footer><div class="w"><span>Ruedda · el mercado de vehículos de Venezuela. Compra, vende y subasta carros con gente verificada.</span><span><a href="/vehiculos/venezuela">Vehículos</a> · <a href="/subastas">Subastas</a> · <a href="${APPSTORE}" rel="noopener">App Store</a></span></div></footer>
<script>try{var C=window.Capacitor;if(C&&C.isNativePlatform&&C.isNativePlatform()){var a=document.querySelector('[data-app]');location.replace(a?a.getAttribute('href'):'/')}}catch(e){}</script>
</body></html>`;
}

function crumbs(items) {
  const html = '<nav class="bc" aria-label="Ruta">' + items.map(([n, u], i) => (i === 0 ? `<a href="${esc(u)}">${esc(n)}</a>` : `<span>${u && i < items.length - 1 ? `<a href="${esc(u)}">${esc(n)}</a>` : esc(n)}</span>`)).join('') + '</nav>';
  const ld = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map(([n, u], i) => ({ '@type': 'ListItem', position: i + 1, name: n, item: u ? (u.startsWith('http') ? u : SITE + u) : undefined })) };
  return { html, ld };
}

function card(x, isSub) {
  const ph = photosOf(x)[0];
  const name = carName(x);
  const sub = [x.year, x.ciudad, kmf(x.km)].filter(Boolean).join(' · ');
  const price = isSub ? (num(x.current_bid) ? 'Oferta actual ' + money(x.current_bid) : 'Subasta') : x.vendido ? 'Vendido' : money(x.precio_usd);
  const u = (isSub ? subUrl(x) : carUrl(x)).replace(SITE, '');
  return `<a class="card${x.vendido ? ' sold' : ''}" href="${esc(u)}">${ph ? `<img src="${esc(img(ph, 600, 450))}" srcset="${esc(img(ph, 400, 300))} 400w, ${esc(img(ph, 600, 450))} 600w, ${esc(img(ph, 800, 600))} 800w" sizes="(max-width:600px) 100vw, 300px" width="600" height="450" alt="${esc(name + ' ' + (x.year || ''))}" loading="lazy" decoding="async">` : ''}<b>${esc(name)}</b><p>${esc(sub)}</p><i>${esc(price)}</i></a>`;
}

function explore(l) {
  const by = (f) => { const m = new Map(); for (const x of l) { const k = f(x); if (k && k[0]) { const e = m.get(k[0]) || { n: k[1], c: 0 }; e.c++; m.set(k[0], e); } } return [...m.entries()].sort((a, b) => b[1].c - a[1].c); };
  const marcas = by((x) => (x.marca && x.marca !== 'Otro' ? [slug(x.marca), x.marca] : null));
  const ciudades = by((x) => (x.ciudad ? [slug(x.ciudad), x.ciudad] : null));
  const tipos = by((x) => (x.tipo_vehiculo && TIPOS_PL[slug(x.tipo_vehiculo)] ? [slug(x.tipo_vehiculo), TIPOS_PL[slug(x.tipo_vehiculo)]] : null));
  const col = (h, arr, pre, suf) => arr.length ? `<div><h3>${h}</h3>${arr.slice(0, 14).map(([k, e]) => `<a href="/vehiculos/${pre}${k}">${esc(e.n)}${suf || ''} <span style="color:var(--dim)">${e.c}</span></a>`).join('')}</div>` : '';
  return `<div class="links">${col('Vehículos por marca', marcas, '', '')}${col('Vehículos por ciudad', ciudades, 'ciudad/', '')}${col('Por carrocería', tipos, 'tipo/', '')}<div><h3>Ruedda</h3><a href="/subastas">Subastas de carros</a><a href="/concesionarios">Concesionarios</a><a href="/publicar">Vende tu carro gratis</a><a href="/conoceruedda">Conoce Ruedda</a><a href="/academy">Ruedda Academy</a><a href="${APPSTORE}" rel="noopener">Descarga la app</a></div></div>`;
}

// ───────── la publicación ─────────
function carPage(x, all, isSub) {
  const name = carName(x);
  const full = `${name} ${x.year || ''}`.trim();
  const ph = photosOf(x);
  const canonical = isSub ? subUrl(x) : carUrl(x);
  const cond = String(x.condicion || '').toLowerCase() === 'nuevo' ? 'nuevo' : 'usado';
  const ended = isSub && x.end_time && new Date(x.end_time) < new Date();
  const ciudad = x.ciudad ? ` en ${x.ciudad}` : ' en Venezuela';
  const title = isSub
    ? `Subasta: ${full}${ciudad}${num(x.current_bid) ? ' · oferta ' + money(x.current_bid) : ''} | Ruedda`
    : `${full} ${x.vendido ? 'vendido' : cond + ' en venta'}${ciudad}${!x.vendido && num(x.precio_usd) ? ' · ' + money(x.precio_usd) : ''} | Ruedda`;
  const specsTxt = [kmf(x.km), x.transmision, x.combustible, x.traccion, x.motor].filter(Boolean).join(', ');
  const desc = isSub
    ? `Subasta de ${full}${ciudad}${specsTxt ? ', ' + specsTxt : ''}. ${ended ? 'Subasta finalizada.' : 'Haz tu oferta en Ruedda, el mercado de vehículos de Venezuela.'}`
    : `${full} ${cond}${ciudad}${specsTxt ? ', ' + specsTxt : ''}. ${x.vendido ? 'Vendido en Ruedda.' : `Precio ${money(x.precio_usd)}. Mira las fotos y escríbele al vendedor en Ruedda, el mercado de vehículos de Venezuela.`}`;

  const tipo = x.tipo_vehiculo ? tipoName(x.tipo_vehiculo) : '';
  const rows = [
    ['Año', x.year], ['Kilometraje', kmf(x.km)], ['Transmisión', x.transmision && titleCase(x.transmision)], ['Combustible', x.combustible && titleCase(x.combustible)],
    ['Motor', x.motor], ['Tracción', x.traccion], ['Color', x.color && titleCase(x.color)], ['Carrocería', tipo],
    ['Condición', titleCase(cond)], ['Estado', x.estado_fisico && titleCase(x.estado_fisico)], ['Dueños', x.duenos], ['Ciudad', x.ciudad],
  ].filter(([, v]) => v != null && v !== '');
  const specs = `<dl>${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;

  const gal = ph.length
    ? `<div class="gal">${ph.slice(0, 24).map((u, i) => `<img src="${esc(img(u, 1200))}" srcset="${esc(img(u, 640))} 640w, ${esc(img(u, 960))} 960w, ${esc(img(u, 1400))} 1400w" sizes="(max-width:860px) 100vw, 680px" width="1200" height="900" alt="${esc(full)}${i ? ' foto ' + (i + 1) : ''}"${i ? ' loading="lazy"' : ' fetchpriority="high"'} decoding="async">`).join('')}</div>`
      + (ph.length > 1 ? `<div class="thumbs">${ph.slice(1, 9).map((u, i) => `<img src="${esc(img(u, 240, 180))}" width="240" height="180" alt="${esc(full)} foto ${i + 2}" loading="lazy" decoding="async">`).join('')}</div>` : '')
    : '';

  let priceHtml;
  if (isSub) {
    priceHtml = `<div class="price">${num(x.current_bid) ? money(x.current_bid) : 'Sin ofertas'} <span class="tag${ended ? '' : ' y'}">${ended ? 'Subasta finalizada' : x.sin_reserva ? 'Sin reserva' : 'En subasta'}</span></div><p class="meta">${num(x.current_bid) ? 'Oferta actual' : ''}${x.end_time ? (num(x.current_bid) ? ' · ' : '') + (ended ? 'Cerró el ' : 'Cierra el ') + new Date(x.end_time).toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Caracas' }) : ''}</p>`;
  } else {
    const drop = !x.vendido && num(x.precio_anterior) > num(x.precio_usd);
    priceHtml = `<div class="price">${x.vendido ? 'Vendido' : money(x.precio_usd)}${drop ? ` <s>${money(x.precio_anterior)}</s> <span class="tag y">Bajó ${money(num(x.precio_anterior) - num(x.precio_usd))}</span>` : ''}${x.auditado_ruedda ? ' <span class="tag">Auditado por Ruedda</span>' : ''}</div>${x.financiamiento_disponible ? '<p class="meta">Financiamiento disponible</p>' : ''}`;
  }
  const dealer = x.concesionarios && x.concesionarios.nombre ? `<p class="meta" style="margin-top:6px">Publicado por <b style="color:var(--fg);font-weight:500">${esc(x.concesionarios.nombre)}</b></p>` : '';
  const cta = isSub
    ? `<div class="cta"><a class="btn" data-app href="${esc(appSub(x))}">${ended ? 'Ver la subasta en Ruedda' : 'Ofertar en Ruedda'}</a><a class="btn o" href="${APPSTORE}" rel="noopener">Descargar la app</a></div>`
    : `<div class="cta"><a class="btn" data-app href="${esc(appCar(x))}">${x.vendido ? 'Ver en Ruedda' : 'Escribir al vendedor'}</a><a class="btn o" href="${APPSTORE}" rel="noopener">Descargar la app</a></div>`;

  const msl = slug(x.marca);
  const related = (isSub ? all.l : all.l.filter((y) => y.id !== x.id))
    .map((y) => ({ y, s: (slug(y.marca) === msl ? 4 : 0) + (modelKey(y) === modelKey(x) ? 4 : 0) + (y.ciudad && y.ciudad === x.ciudad ? 1 : 0) + (y.tipo_vehiculo === x.tipo_vehiculo ? 1 : 0) - (y.vendido ? 3 : 0) }))
    .sort((a, b) => b.s - a.s).slice(0, 8).map((o) => o.y);

  const marcaOk = x.marca && x.marca !== 'Otro';
  const bc = crumbs([['Ruedda', '/'], isSub ? ['Subastas', '/subastas'] : ['Vehículos en venta', '/vehiculos/venezuela'], ...(marcaOk && !isSub ? [[x.marca, '/vehiculos/' + msl]] : []), [full, null]]);

  const vehicle = {
    '@context': 'https://schema.org', '@type': ['Product', 'Car'], '@id': canonical + '#vehiculo', name: full, url: canonical,
    description: String(x.descripcion || desc).slice(0, 4000),
    image: ph.slice(0, 10).map((u) => img(u, 1200)),
    brand: marcaOk ? { '@type': 'Brand', name: x.marca } : undefined,
    manufacturer: marcaOk ? { '@type': 'Organization', name: x.marca } : undefined,
    model: (String(x.modelo || '').trim() || undefined),
    vehicleModelDate: x.year ? String(x.year) : undefined,
    productionDate: x.year ? String(x.year) : undefined,
    mileageFromOdometer: num(x.km) != null ? { '@type': 'QuantitativeValue', value: num(x.km), unitCode: 'KMT' } : undefined,
    color: x.color || undefined,
    bodyType: BODY[slug(x.tipo_vehiculo)] || x.tipo_vehiculo || undefined,
    vehicleTransmission: TRANS[String(x.transmision || '').toLowerCase()] || x.transmision || undefined,
    fuelType: FUEL[String(x.combustible || '').toLowerCase()] || x.combustible || undefined,
    driveWheelConfiguration: /awd|4x4|4wd/i.test(x.traccion || '') ? 'https://schema.org/AllWheelDriveConfiguration' : undefined,
    vehicleEngine: x.motor ? { '@type': 'EngineSpecification', name: x.motor } : undefined,
    numberOfPreviousOwners: num(x.duenos) != null ? num(x.duenos) : undefined,
    itemCondition: cond === 'nuevo' ? 'https://schema.org/NewCondition' : 'https://schema.org/UsedCondition',
    offers: !isSub && num(x.precio_usd) ? {
      '@type': 'Offer', url: canonical, price: num(x.precio_usd), priceCurrency: 'USD',
      availability: x.vendido ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
      itemCondition: cond === 'nuevo' ? 'https://schema.org/NewCondition' : 'https://schema.org/UsedCondition',
      areaServed: { '@type': 'Country', name: 'Venezuela' },
      availableAtOrFrom: x.ciudad ? { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: x.ciudad, addressCountry: 'VE' } } : undefined,
      seller: x.concesionarios && x.concesionarios.nombre ? { '@type': 'AutoDealer', name: x.concesionarios.nombre } : undefined,
    } : undefined,
  };

  const body = `${bc.html}
<article class="car">
<div>${gal}</div>
<div class="info">
<div class="k">${esc(isSub ? 'Subasta' : (marcaOk ? x.marca : 'Vehículo'))}${x.ciudad ? ' · ' + esc(x.ciudad) : ''}</div>
<h1>${esc(full)}</h1>
<p class="meta">${esc([titleCase(cond), kmf(x.km), x.transmision && titleCase(x.transmision), tipo].filter(Boolean).join(' · '))}</p>
${priceHtml}${dealer}${cta}${specs}
${x.descripcion ? `<p class="desc">${esc(String(x.descripcion).slice(0, 5000))}</p>` : ''}
</div></article>
${related.length ? `<section class="more"><h2>${marcaOk ? 'Más carros como este' : 'Más carros en venta'}</h2><div class="grid">${related.map((y) => card(y)).join('')}</div></section>` : ''}
${explore(all.l)}`;

  return page({
    title, desc, canonical, ogImage: ph[0] ? img(ph[0], 1200, 630) : null, preload: ph[0] ? img(ph[0], 1200) : null,
    robots: x._private ? 'noindex,follow' : null,
    ld: [vehicle, bc.ld, { '@context': 'https://schema.org', ...ORG }], body,
  });
}

// ───────── listados (hubs) ─────────
function hubPage(all, kind, key) {
  let l = all.l, h1, intro, canonical = SITE + '/vehiculos', crumbsArr = [['Ruedda', '/'], ['Vehículos en venta', '/vehiculos/venezuela']], titleBase;
  if (kind === 'marca') {
    l = l.filter((x) => slug(x.marca) === key);
    if (!l.length) return null;
    const n = l[0].marca; canonical += '/' + key; crumbsArr.push([n, null]);
    h1 = `${n} en venta en Venezuela`; titleBase = `${n} en venta en Venezuela: carros usados y nuevos`;
  } else if (kind === 'modelo') {
    l = l.filter((x) => slug(x.marca) === key[0] && modelKey(x) === key[1]);
    if (!l.length) return null;
    const n = `${l[0].marca} ${titleCase(String(l[0].modelo_canonico || l[0].modelo))}`; canonical += `/${key[0]}/${key[1]}`;
    crumbsArr.push([l[0].marca, '/vehiculos/' + key[0]], [n, null]);
    h1 = `${n} en venta en Venezuela`; titleBase = `${n} en venta en Venezuela`;
  } else if (kind === 'ciudad') {
    l = l.filter((x) => slug(x.ciudad) === key);
    if (!l.length) return null;
    const n = l[0].ciudad; canonical += '/ciudad/' + key; crumbsArr.push([n, null]);
    h1 = `Vehículos en venta en ${n}`; titleBase = `Carros y vehículos en venta en ${n}, Venezuela`;
  } else if (kind === 'tipo') {
    l = l.filter((x) => slug(x.tipo_vehiculo) === key);
    if (!l.length || !TIPOS_PL[key]) return null;
    const n = TIPOS_PL[key]; canonical += '/tipo/' + key; crumbsArr.push([n, null]);
    h1 = `${n} en venta en Venezuela`; titleBase = `${n} en venta en Venezuela`;
  } else {
    h1 = 'Vehículos en venta en Venezuela'; titleBase = 'Vehículos en venta en Venezuela: carros usados y nuevos'; canonical = SITE + '/vehiculos/venezuela'; crumbsArr = [['Ruedda', '/'], ['Vehículos en venta', null]];
  }
  const live = l.filter((x) => !x.vendido);
  const prices = live.map((x) => num(x.precio_usd)).filter((v) => v != null && v > 0);
  const range = prices.length ? ` desde ${money(Math.min(...prices))}${prices.length > 1 ? ' hasta ' + money(Math.max(...prices)) : ''}` : '';
  intro = `${live.length} ${live.length === 1 ? 'vehículo disponible' : 'vehículos disponibles'}${range}. Fotos reales, precio en dólares y trato directo con el vendedor en Ruedda, el mercado de vehículos de Venezuela.`;
  const title = `${titleBase} | Ruedda`;
  const bc = crumbs(crumbsArr);
  const chipsMarcas = [...new Map(all.l.filter((x) => x.marca && x.marca !== 'Otro').map((x) => [slug(x.marca), x.marca])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'es'));
  const marcaKey = kind === 'marca' ? key : kind === 'modelo' ? key[0] : null;
  let modelChips = '';
  if (marcaKey) {
    const ms = [...new Map(all.l.filter((x) => slug(x.marca) === marcaKey).map((x) => [modelKey(x), titleCase(String(x.modelo_canonico || x.modelo))])).entries()];
    if (ms.length > 1) modelChips = `<div class="chips">${ms.map(([k, n]) => `<a${kind === 'modelo' && key[1] === k ? ' class="on"' : ''} href="/vehiculos/${marcaKey}/${k}">${esc(n)}</a>`).join('')}</div>`;
  }
  const items = l.map((x) => ({ u: carUrl(x), n: `${carName(x)} ${x.year || ''}`.trim() }));
  const ld = [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: h1, url: canonical, description: intro, isPartOf: { '@type': 'WebSite', '@id': SITE + '/#web', name: 'Ruedda', url: SITE + '/' },
    mainEntity: { '@type': 'ItemList', numberOfItems: items.length, itemListElement: items.slice(0, 100).map((it, i) => ({ '@type': 'ListItem', position: i + 1, url: it.u, name: it.n })) } }, bc.ld];
  const subs = kind === 'all' ? all.a.filter((x) => !x._private) : [];
  const body = `${bc.html}<section class="hero"><h1>${esc(h1)}</h1><p>${esc(intro)}</p>
<div class="chips">${chipsMarcas.map(([k, n]) => `<a${marcaKey === k ? ' class="on"' : ''} href="/vehiculos/${k}">${esc(n)}</a>`).join('')}</div>${modelChips}</section>
${l.length ? `<div class="grid">${l.map((x) => card(x)).join('')}</div>` : '<p class="empty">No hay vehículos publicados aquí ahora mismo.</p>'}
${subs.length ? `<section class="more" style="margin-top:44px"><h2>Subastas</h2><div class="grid">${subs.map((x) => card(x, true)).join('')}</div></section>` : ''}
${explore(all.l)}`;
  const ph = l.map(photosOf).find((p) => p.length);
  return page({ title, desc: intro, canonical, ogImage: ph ? img(ph[0], 1200, 630) : null, robots: live.length ? null : 'noindex,follow', ld, body });
}

function notFound(all) {
  return page({ title: 'Esta publicación ya no está disponible | Ruedda', desc: 'La publicación fue retirada. Mira los carros en venta en Ruedda.', canonical: SITE + '/vehiculos/venezuela', robots: 'noindex,follow',
    body: `<section class="hero"><h1>Esta publicación ya no está disponible</h1><p>El vendedor la retiró o ya no existe. Mira otros carros en venta en Ruedda.</p><div class="chips"><a class="on" href="/vehiculos/venezuela">Ver carros en venta</a></div></section>${all ? `<div class="grid">${all.l.filter((x) => !x.vendido).slice(0, 8).map((x) => card(x)).join('')}</div>` : ''}` });
}

// ───────── sitemap y llms.txt ─────────
function sitemap(all) {
  const today = new Date().toISOString().slice(0, 10);
  const u = [];
  const add = (loc, lastmod, pr, cf, imgs) => u.push(`<url><loc>${xesc(loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}<changefreq>${cf}</changefreq><priority>${pr}</priority>${(imgs || []).slice(0, 10).map((i) => `<image:image><image:loc>${xesc(i[0])}</image:loc><image:title>${xesc(i[1])}</image:title></image:image>`).join('')}</url>`);
  const newest = (arr) => arr.map((x) => iso(x.updated_at || x.created_at)).filter(Boolean).sort().pop() || today;
  add(SITE + '/', newest(all.l).slice(0, 10), '1.0', 'daily');
  add(SITE + '/vehiculos/venezuela', newest(all.l).slice(0, 10), '0.9', 'daily');
  for (const p of ['/market', '/subastas', '/concesionarios', '/publicar']) add(SITE + p, today, '0.7', 'daily');
  add(SITE + '/conoceruedda', today, '0.8', 'monthly');
  add(SITE + '/academy', null, '0.5', 'monthly');
  const groups = (f) => { const m = new Map(); for (const x of all.l) { const k = f(x); if (!k) continue; const a = m.get(k) || []; a.push(x); m.set(k, a); } return m; };
  for (const [k, arr] of groups((x) => (x.marca && x.marca !== 'Otro' ? slug(x.marca) : null))) if (arr.some((x) => !x.vendido)) add(`${SITE}/vehiculos/${k}`, newest(arr).slice(0, 10), '0.8', 'daily');
  for (const [k, arr] of groups((x) => (x.marca && x.marca !== 'Otro' && modelKey(x) ? slug(x.marca) + '/' + modelKey(x) : null))) if (arr.filter((x) => !x.vendido).length >= 2) add(`${SITE}/vehiculos/${k}`, newest(arr).slice(0, 10), '0.7', 'daily');
  for (const [k, arr] of groups((x) => (x.ciudad ? slug(x.ciudad) : null))) if (arr.some((x) => !x.vendido)) add(`${SITE}/vehiculos/ciudad/${k}`, newest(arr).slice(0, 10), '0.7', 'daily');
  for (const [k, arr] of groups((x) => (TIPOS_PL[slug(x.tipo_vehiculo)] ? slug(x.tipo_vehiculo) : null))) if (arr.some((x) => !x.vendido)) add(`${SITE}/vehiculos/tipo/${k}`, newest(arr).slice(0, 10), '0.6', 'daily');
  for (const x of all.l) { const n = `${carName(x)} ${x.year || ''}`.trim(); add(carUrl(x), (iso(x.updated_at || x.created_at) || today).slice(0, 10), x.vendido ? '0.4' : '0.8', x.vendido ? 'monthly' : 'weekly', photosOf(x).map((p, i) => [img(p, 1200), n + (i ? ' foto ' + (i + 1) : '')])); }
  for (const x of all.a) if (!x._private) { const n = `${carName(x)} ${x.year || ''}`.trim(); add(subUrl(x), (iso(x.updated_at || x.created_at) || today).slice(0, 10), '0.6', 'daily', photosOf(x).map((p) => [img(p, 1200), n])); }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${u.join('\n')}\n</urlset>\n`;
}

function llms(all) {
  const live = all.l.filter((x) => !x.vendido);
  const line = (x) => `- [${carName(x)} ${x.year || ''}](${carUrl(x)}): ${[money(x.precio_usd), x.ciudad, kmf(x.km), x.transmision, x.combustible, x.condicion].filter(Boolean).join(', ')}`;
  return `# Ruedda

> Ruedda es el mercado de vehículos de Venezuela: compra y venta de carros usados y nuevos (Market), subastas de carros en tiempo real, concesionarios verificados y publicación gratis. Web: ${SITE} · App iOS: ${APPSTORE}

Cada vehículo publicado tiene su propia página con fotos, ficha técnica, precio en dólares y ciudad. El inventario de abajo se genera en vivo desde la base de datos de Ruedda.

## Secciones
- [Vehículos en venta en Venezuela](${SITE}/vehiculos/venezuela): todo el inventario activo
- [Subastas](${SITE}/subastas)
- [Concesionarios](${SITE}/concesionarios)
- [Vender un carro](${SITE}/publicar)
- [Conoce Ruedda](${SITE}/conoceruedda): qué es Ruedda

## Vehículos en venta ahora (${live.length})
${live.map(line).join('\n')}

## Vendidos recientemente
${all.l.filter((x) => x.vendido).map(line).join('\n') || '- (ninguno)'}
`;
}

// ───────── /conoceruedda · qué es Ruedda (minimal, sin JS) ─────────
function somosPage(all) {
  const live = all.l.filter((x) => !x.vendido);
  const marcas = new Set(all.l.filter((x) => x.marca && x.marca !== 'Otro').map((x) => slug(x.marca))).size;
  const ciudades = new Set(all.l.filter((x) => x.ciudad).map((x) => slug(x.ciudad))).size;
  const canonical = SITE + '/conoceruedda';
  const title = 'Bienvenido | Conoce Ruedda, el mercado de vehículos de Venezuela';
  const desc = 'Ruedda es el mercado de vehículos de Venezuela: compra, vende y subasta carros con fotos reales, precio en dólares y gente verificada. Sin intermediarios.';
  const img1 = '/assets/somos/caracas-1200.jpg';
  const ld = [
    { '@context': 'https://schema.org', '@type': 'AboutPage', name: title, url: canonical, description: desc, inLanguage: 'es-VE', mainEntity: { '@id': SITE + '/#org' } },
    { '@context': 'https://schema.org', ...ORG, legalName: 'Ruedda', taxID: 'J-50460850-9', description: desc, areaServed: { '@type': 'Country', name: 'Venezuela' }, slogan: 'El mercado de vehículos de Venezuela' },
  ];
  const parts = [
    ['market', 'Compra y vende directo con el dueño.', '/market'],
    ['subastas', 'Oferta. Gana. Llévatelo.', '/subastas'],
    ['concesionarios', 'Agencias verificadas por Ruedda.', '/concesionarios'],
    ['vender', 'Publica tu carro gratis.', '/publicar'],
  ];
  const css = `@font-face{font-family:OS;font-weight:400;font-display:swap;src:url(/assets/fonts/opensauceone-400.d20e72bf.woff2) format('woff2')}
@font-face{font-family:OS;font-weight:500;font-display:swap;src:url(/assets/fonts/opensauceone-500.0fc79baa.woff2) format('woff2')}
*{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#fafaf7;--fg:#0b0b0c;--mute:rgba(11,11,12,.52);--line:rgba(11,11,12,.1);--y:#e6f03b}
html{-webkit-text-size-adjust:100%}
body{background:var(--bg);color:var(--fg);font:400 17px/1.5 OS,-apple-system,BlinkMacSystemFont,sans-serif;-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
a{color:inherit;text-decoration:none}
.w{max-width:1120px;margin:0 auto;padding:0 24px}
nav{display:flex;align-items:center;justify-content:space-between;height:76px}
nav img{height:22px;width:auto;display:block}
nav .r{display:flex;align-items:center;gap:22px}
nav a.d{font-size:14px;font-weight:500}
nav a.e{height:40px;padding:0 18px;border-radius:999px;background:var(--fg);color:#fff;display:inline-flex;align-items:center;font-size:14px;font-weight:500}
.hero .cta{margin-top:36px}
.hero{text-align:center;padding:12vh 0 9vh}
.k{font-size:13px;letter-spacing:.24em;text-transform:uppercase;color:var(--mute)}
h1{font-weight:500;font-size:clamp(46px,9.2vw,124px);line-height:.98;letter-spacing:-.055em;margin:26px auto 0;max-width:11ch}
mark{background:linear-gradient(transparent 14%,var(--y) 14%,var(--y) 90%,transparent 90%);color:inherit;padding:0 .04em}
.sub{font-size:clamp(18px,2vw,21px);color:var(--mute);max-width:34ch;margin:28px auto 0}
figure{margin:0}
figure img{display:block;width:100%;height:auto;aspect-ratio:3/2;object-fit:cover}
.big{font-weight:400;font-size:clamp(28px,4.2vw,52px);line-height:1.12;letter-spacing:-.035em;padding:16vh 0 12vh;max-width:22ch}
.big span{color:var(--mute)}
.n{display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.n div{padding:34px 0}
.n div+div{padding-left:28px;border-left:1px solid var(--line)}
.n b{display:block;font-weight:500;font-size:clamp(40px,6vw,76px);letter-spacing:-.05em;line-height:1}
.n small{display:block;font-size:14px;color:var(--mute);margin-top:10px}
.ix{padding:14vh 0 0}
.ix a{display:grid;grid-template-columns:1fr auto;align-items:baseline;gap:20px;padding:26px 0;border-bottom:1px solid var(--line)}
.ix a:first-child{border-top:1px solid var(--line)}
.ix b{font-weight:500;font-size:clamp(30px,4.4vw,54px);letter-spacing:-.045em;line-height:1}
.ix span{font-size:16px;color:var(--mute);transition:color .2s}
.ix a:hover span{color:var(--fg)}
.p{display:grid;grid-template-columns:repeat(3,1fr);gap:28px;padding:16vh 0}
.p b{display:block;font-weight:500;font-size:24px;letter-spacing:-.03em}
.p p{color:var(--mute);font-size:15.5px;margin-top:8px;max-width:30ch}
.end{text-align:center;padding:4vh 0 16vh}
.end h2{font-weight:500;font-size:clamp(34px,5.6vw,72px);letter-spacing:-.05em;line-height:1.02;max-width:14ch;margin:0 auto}
.cta{display:flex;gap:10px;justify-content:center;margin-top:40px;flex-wrap:wrap}
.cta a{height:54px;padding:0 28px;border-radius:999px;display:inline-flex;align-items:center;font-weight:500;font-size:16px}
.cta .a{background:var(--fg);color:#fff}
.cta .b{box-shadow:inset 0 0 0 1px rgba(11,11,12,.2)}
footer{border-top:1px solid var(--line);padding:30px 0 44px;font-size:13.5px;color:var(--mute)}
footer .w{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}
footer a{color:var(--fg)}
@supports (animation-timeline:view()){@media (prefers-reduced-motion:no-preference){.rv{animation:rv linear both;animation-timeline:view();animation-range:entry 0% entry 55%}@keyframes rv{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:none}}}}
@media(max-width:720px){nav a.d{display:none}figure img{aspect-ratio:4/5;object-position:56% 72%}.n{grid-template-columns:1fr}.n div+div{padding-left:0;border-left:0;border-top:1px solid var(--line)}.p{grid-template-columns:1fr;gap:34px}.ix a{grid-template-columns:1fr}.ix span{margin-top:-8px}}`;
  return `<!doctype html><html lang="es-VE"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta name="theme-color" content="#fafaf7">
<link rel="icon" href="/favicon.png"><link rel="apple-touch-icon" href="/icon-180.png">
<link rel="preload" href="/assets/fonts/opensauceone-500.0fc79baa.woff2" as="font" type="font/woff2" crossorigin>
<meta property="og:type" content="website"><meta property="og:site_name" content="Ruedda"><meta property="og:locale" content="es_VE">
<meta property="og:url" content="${canonical}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${SITE}${img1}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="800">
<meta name="twitter:card" content="summary_large_image">
<meta name="apple-itunes-app" content="app-id=6812039590">
<style>${css}</style>
${ld.map(jsonld).join('\n')}
</head><body>
<div class="w"><nav><a href="/" aria-label="Ruedda, inicio"><img src="/assets/ruedda-wordmark-negro.png" alt="Ruedda" width="92" height="22"></a><span class="r"><a class="d" href="${APPSTORE}" rel="noopener">Descargar la app</a><a class="e" href="/">Entrar a Ruedda</a></span></nav></div>
<main>
<section class="w hero"><p class="k">Bienvenido</p><h1>Conoce <mark>Ruedda</mark>.</h1><p class="sub">El mercado de vehículos de Venezuela. Compra, vende y subasta tu carro con gente verificada y precio justo.</p><div class="cta"><a class="a" href="/">Entrar a Ruedda</a><a class="b" href="/vehiculos/venezuela">Ver vehículos</a></div></section>
<figure><picture><source type="image/webp" srcset="/assets/somos/caracas-1200.webp 1200w, /assets/somos/caracas-2000.webp 2000w, /assets/somos/caracas-2800.webp 2800w" sizes="100vw"><img src="${img1}" width="1200" height="800" alt="Tres carros frente al Ávila al atardecer, Caracas" fetchpriority="high" decoding="async"></picture></figure>
<section class="w"><p class="big rv">Ruedda es donde Venezuela compra y vende sus carros. <span>Fotos reales, precio en dólares y trato directo con el dueño. Sin intermediarios.</span></p>
<div class="n rv"><div><b>${live.length}</b><small>vehículos en venta hoy</small></div><div><b>${marcas}</b><small>marcas</small></div><div><b>${ciudades}</b><small>ciudades</small></div></div>
<div class="ix">${parts.map(([a, b, u]) => `<a class="rv" href="${u}"><b>${a}</b><span>${b}</span></a>`).join('')}</div>
<div class="p">
<div class="rv"><b>Precio justo.</b><p>El criterio Ruedda compara cada precio con el mercado real.</p></div>
<div class="rv"><b>Gente verificada.</b><p>Sabes con quién hablas antes de cerrar el trato.</p></div>
<div class="rv"><b>Trato directo.</b><p>Cero intermediarios entre el carro y tú.</p></div>
</div>
<div class="end rv"><h2>El futuro del carro venezolano ya arrancó.</h2><div class="cta"><a class="a" href="/">Entrar a Ruedda</a><a class="b" href="${APPSTORE}" rel="noopener">Descargar la app</a></div></div>
</section></main>
<footer><div class="w"><span>Ruedda · RIF J-50460850-9 · Venezuela</span><span><a href="/">ruedda.app</a> · <a href="https://www.instagram.com/ruedda.app" rel="noopener">Instagram</a> · <a href="/academy">Academy</a> · <a href="/vehiculos/venezuela">Vehículos</a></span></div></footer>
</body></html>`;
}

// ───────── despacho ─────────
module.exports = async (req, res) => {
  const q = req.query || {};
  const mode = String(q.seo || '');
  const send = (code, type, body, maxAge) => {
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', `public, max-age=0, s-maxage=${maxAge}, stale-while-revalidate=86400`);
    res.status(code).send(body);
  };
  let all;
  try { all = await inventory(); } catch (e) {
    if (mode === 'go') { res.setHeader('Location', SITE + '/' + (q.market ? '?market=' + encodeURIComponent(q.market) : q.auction ? '?auction=' + encodeURIComponent(q.auction) : '')); res.setHeader('Cache-Control', 'no-store'); return res.status(302).end(); }
    res.setHeader('Retry-After', '60');
    return send(503, 'text/html; charset=utf-8', '<!doctype html><meta charset="utf-8"><title>Ruedda</title><p>Volvemos en un momento.</p>', 5);
  }
  const findL = (id) => all.l.find((x) => x.id === id);
  const findA = (id) => all.a.find((x) => x.id === id);
  // por prefijo de 8 hex: rango de uuid (id >= xxxxxxxx-0000… y <= xxxxxxxx-ffff…)
  const one = async (table, id) => {
    const f = id.length === 8 ? `id=gte.${id}-0000-0000-0000-000000000000&id=lte.${id}-ffff-ffff-ffff-ffffffffffff` : `id=eq.${id}`;
    try { const r = await rest(`${table}?select=${table === 'listings' ? LSEL : ASEL}&${f}&estado=eq.activa&limit=1`); const x = r[0]; if (x && table === 'auctions') { x._private = !!x.access_code; delete x.access_code; } return x || null; } catch (e) { return null; }
  };

  if (mode === 'somos') return send(200, 'text/html; charset=utf-8', somosPage(all), 900);
  if (mode === 'sitemap') return send(200, 'application/xml; charset=utf-8', sitemap(all), 900);
  if (mode === 'llms') return send(200, 'text/plain; charset=utf-8', llms(all), 900);

  // 301 de /?market=ID y /?auction=ID → URL indexable (solo llega aquí un buscador, ver vercel.json)
  if (mode === 'go') {
    const mid = String(q.market || '').toLowerCase(), aid = String(q.auction || '').toLowerCase();
    const x = UUID.test(mid) ? (findL(mid) || await one('listings', mid)) : null;
    const a = !x && UUID.test(aid) ? (findA(aid) || await one('auctions', aid)) : null;
    const to = x ? carUrl(x) : a ? subUrl(a) : SITE + '/vehiculos/venezuela';
    res.setHeader('Location', to);
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600');
    return res.status(x || a ? 301 : 302).end();
  }

  const p = String(q.p || '').toLowerCase().replace(/\/+$/, '');
  if (mode === 'car' || mode === 'sub') {
    const m = p.match(SHORT);
    if (m) {
      const id = m[1];
      const pool = (mode === 'car' ? all.l : all.a).filter((y) => y.id.startsWith(id));
      const x = pool.find((y) => (mode === 'car' ? carUrl(y) : subUrl(y)).endsWith('/' + p)) || pool[0] || await one(mode === 'car' ? 'listings' : 'auctions', id);
      if (!x) return send(404, 'text/html; charset=utf-8', notFound(all), 300);
      const want = (mode === 'car' ? carUrl(x) : subUrl(x)).replace(SITE, '');
      if ('/' + (mode === 'car' ? 'vehiculos' : 'subastas') + '/' + p !== want) { // slug viejo o mal escrito → URL canónica
        res.setHeader('Location', want); res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600'); return res.status(301).end();
      }
      return send(200, 'text/html; charset=utf-8', carPage(x, all, mode === 'sub'), 300);
    }
    if (mode === 'car' && p === 'venezuela') return send(200, 'text/html; charset=utf-8', hubPage(all, 'all'), 600);
    if (mode === 'car' && p) { const h = hubPage(all, 'marca', slug(p)); if (h) return send(200, 'text/html; charset=utf-8', h, 600); }
    return send(404, 'text/html; charset=utf-8', notFound(all), 300);
  }
  if (mode === 'hub') {
    const a = slug(q.a || ''), b = slug(q.b || '');
    let h = null;
    if (!a) h = hubPage(all, 'all');
    else if (a === 'ciudad') h = hubPage(all, 'ciudad', b);
    else if (a === 'tipo') h = hubPage(all, 'tipo', b);
    else h = hubPage(all, 'modelo', [a, b]);
    if (h) return send(200, 'text/html; charset=utf-8', h, 600);
    return send(404, 'text/html; charset=utf-8', notFound(all), 300);
  }
  return send(404, 'text/html; charset=utf-8', notFound(all), 300);
};
