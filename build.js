/* ─────────────────────────────────────────────────────────────
   RUEDDA · paso de publicación (Vercel: buildCommand)
   Los scripts grandes que viven dentro de index.html / desktop.html se sacan a
   archivos /_rd/<nombre>.<hash>.js en el MISMO lugar y orden (scripts clásicos,
   se ejecutan igual). Así:
     · el navegador los guarda para siempre (immutable) y guarda su compilación:
       las visitas siguientes no vuelven a bajar ni a interpretar ~1 MB de JS;
     · el HTML pesa mucho menos y el primer pintado llega antes;
     · el script principal se precarga desde el <head> (baja en paralelo).
   El código fuente no cambia: esto corre solo al publicar, sobre la copia de
   Vercel. Si algo falla, no toca nada y el sitio sale exactamente como hoy.
   Uso local: node build.js <carpeta-destino>  (copia y transforma ahí)
   ───────────────────────────────────────────────────────────── */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SRC = __dirname;
const OUT = process.argv[2] ? path.resolve(process.argv[2]) : SRC;
const PAGES = ['desktop.html'];   // solo desktop: index.html es también la app (no se toca)
const MIN_BYTES = 20000;   // solo los scripts grandes; los chicos se quedan en línea

function copyDir(a, b) {
  fs.mkdirSync(b, { recursive: true });
  for (const f of fs.readdirSync(a)) {
    if (f === 'node_modules' || f === '.git' || f === '.vercel') continue;
    const s = path.join(a, f), d = path.join(b, f);
    if (fs.statSync(s).isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}

function transform(html, name) {
  const bodyAt = html.search(/<body[\s>]/i);
  if (bodyAt < 0) return { html, files: [] };
  const files = [];
  let out = '', last = 0, n = 0;
  const re = /<script>([\s\S]*?)<\/script>/g;   // solo <script> sin atributos
  let m;
  while ((m = re.exec(html))) {
    const code = m[1];
    if (m.index < bodyAt || Buffer.byteLength(code) < MIN_BYTES) continue;
    const hash = crypto.createHash('sha256').update(code).digest('hex').slice(0, 10);
    const file = `${name.replace('.html', '')}-${++n}.${hash}.js`;
    files.push({ file, code, size: Buffer.byteLength(code) });
    out += html.slice(last, m.index) + `<script src="/_rd/${file}"></script>`;
    last = m.index + m[0].length;
  }
  out += html.slice(last);
  if (!files.length) return { html, files };
  // el más grande se empieza a bajar desde el <head>, en paralelo con el resto del HTML
  const big = files.slice().sort((a, b) => b.size - a.size)[0];
  out = out.replace(/<head>\n/, (h) => h + `<link rel="preload" as="script" href="/_rd/${big.file}">\n`);
  return { html: out, files };
}

try {
  if (OUT !== SRC) copyDir(SRC, OUT);
  const plan = [];
  for (const page of PAGES) {
    const p = path.join(OUT, page);
    if (!fs.existsSync(p)) continue;
    const r = transform(fs.readFileSync(p, 'utf8'), page);
    // verificación: el HTML resultante + los archivos deben contener exactamente el mismo código
    const back = r.files.reduce((s, f) => s.replace(`<script src="/_rd/${f.file}"></script>`, () => `<script>${f.code}</script>`), r.html)
      .replace(/<link rel="preload" as="script" href="\/_rd\/[^"]+">\n/, '');
    if (back !== fs.readFileSync(p, 'utf8')) throw new Error('verificación falló en ' + page);
    plan.push({ p, r, page });
  }
  fs.mkdirSync(path.join(OUT, '_rd'), { recursive: true });
  for (const { p, r, page } of plan) {
    for (const f of r.files) fs.writeFileSync(path.join(OUT, '_rd', f.file), f.code);
    fs.writeFileSync(p, r.html);
    console.log(`[build] ${page}: ${r.files.length} scripts → /_rd (${Math.round(r.files.reduce((s, f) => s + f.size, 0) / 1024)} KB fuera del HTML)`);
  }
} catch (e) {
  // nunca romper la publicación: sin transformar, el sitio queda como siempre
  console.warn('[build] se omite la optimización:', e.message);
}
