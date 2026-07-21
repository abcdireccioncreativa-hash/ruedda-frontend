# Ruedda — Auditoría de código (2026-07-21)

Auditoría de `index.html` (16,032 líneas) + `api/*.js` (6 endpoints) + `lib/supabase.js`. Foto de un momento — no todo esto es urgente, ver prioridad al final. Hallazgos verificados con lectura directa del código (referencias `archivo:línea`), no estimaciones.

## 🔴 Seguridad — prioridad alta

**1. XSS almacenado en el buzón de sugerencias (superadmin).**
Cualquier usuario logueado puede enviar texto libre a `sugerencias` (index.html:6756). Se renderiza sin escapar en el panel de superadmin:
```js
// index.html:10153
<div ...>${s.content}</div>
```
Un usuario que mande `<img src=x onerror=...>` como sugerencia ejecuta JS en la sesión del superadmin la próxima vez que abra esa pestaña — sesión con permisos de moderación, pagos y gestión de usuarios. **Fix:** envolver en `_esc()` (ya existe, index.html:4066) o `_escLine()` si hay saltos de línea.

**2. XSS almacenado en el modal de moderación de publicaciones.**
`item.title` e `item.desc` (datos que el usuario escribe al publicar) se renderizan sin escapar en el modal que ve el superadmin al aprobar/rechazar (index.html:10471, 10476). Mismo vector, mismo impacto que el punto 1.

**3. Escapado inconsistente en general.** `_esc()`/`_escLine()` existen y se usan en varios lugares, pero un barrido encontró más campos de usuario sin escapar: `l.title` (título de listing, varias líneas), `d.nombre`/`f.nombre` (nombre de dealer/vendedor), `u.nombre`/`u.username`/`u.email` (lista de usuarios en superadmin), `currentAuction.title`. Vale una pasada completa aplicando `_esc()` como regla, no caso por caso.

**4. Variable de entorno inconsistente entre endpoints.**
`lib/supabase.js:4` lee `SUPABASE_SERVICE_KEY`. `api/admin-user.js:29` lee `SUPABASE_SERVICE_ROLE_KEY` — nombre distinto. Si en Vercel solo está seteada una de las dos, o `admin-user.js` o el resto de los endpoints van a fallar en silencio con "server misconfigured". Confirmar en Vercel Dashboard cuál está seteada y unificar el nombre en el código.

**5. `vercel.json` no tiene bloque `crons`.**
El README dice *"el cron nativo (definido en vercel.json) ejecuta el cierre de subastas cada 5 minutos"*, pero `vercel.json` actual no tiene `crons`. O el cron está configurado solo desde el dashboard de Vercel (y el README está desactualizado), o **`/api/auction-close` no se está disparando solo** y las subastas vencidas no cierran automáticamente. Confirmar en el dashboard — es rápido de chequear y de alto impacto si está roto.

## 🟡 Seguridad — prioridad media/baja

- `auction-close.js`: si `CRON_SECRET` no está seteado, el endpoint queda completamente abierto (cualquiera puede forzar el cierre de subastas). También acepta el secret por query string (`?secret=`), lo cual puede terminar en logs. Recomendado: exigir siempre el header, fallar cerrado si falta la env var.
- CORS `Access-Control-Allow-Origin: *` en 5 de 6 endpoints (todos menos `admin-user.js`, que no setea CORS en absoluto — inconsistente). No es explotable sin JWT robado, pero es innecesariamente permisivo.
- Sin rate limiting en ningún endpoint — `place-bid.js` en particular no throttlea pujas repetidas de un mismo usuario (no corrompe datos por el locking optimista, pero permite spam).
- ✅ Nada de esto es grave: no se encontró ninguna key `service_role` ni secreto hardcodeado en `index.html` — solo la `anon` key pública, como corresponde al modelo RLS documentado en el README.

## Por endpoint

| archivo | auth | validación de input |
|---|---|---|
| `admin-user.js` | JWT + rol superadmin explícito | falta validar qué valor de `role` se puede setear al crear (podría permitir asignar `superadmin`) |
| `auction-close.js` | opcional (solo si `CRON_SECRET` seteado) | n/a |
| `mod-listing.js` | JWT + `isSuperadmin()` | sólida — valida tipo/acción y re-chequea estado actual antes de mutar |
| `place-bid.js` | JWT | **el más sólido de los 6** — valida monto, estado/tipo/tiempo de la subasta, bloquea auto-puja, locking optimista |
| `subscription-check.js` | JWT | n/a (lee solo su propia fila) |
| `verify-payment.js` | JWT + `isSuperadmin()` | sólida — valida acción y estado previo del pago |

## Performance

- **~500-900KB del archivo son binarios inline** que nunca se pueden cachear aparte del HTML: 3 fuentes TTF en base64 (~237KB combinados, index.html:16-27) + un SVG de logo de **150KB** usado una sola vez como ícono de 60×28px (index.html:1384, referenciado en :1536) + 15 PNGs base64 más (hasta 86KB cada uno). Cualquier cambio de texto en el HTML fuerza re-descarga de todo esto. El SVG de 150KB para un logo chico es el caso más flagrante — candidato a simplificar el path o mover a un asset externo cacheable.
- **Sin paginación en las queries principales.** `_loadAuctions()`, `_loadMarket()`, `_loadChocados()` (index.html ~11663-11732) traen la tabla completa sin `.limit()` y renderizan todo en el DOM. Otras queries del mismo archivo sí usan `.limit(12)` — la inconsistencia es la señal: cuando el catálogo crezca a cientos de listings, estas tres pantallas van a cargar/renderizar todo de una.
- 3 inyecciones dinámicas redundantes del mismo keyframe de spinner (`aasSpin`/`aasPop`, guardadas por id así que no rompen nada, pero podrían ser un solo bloque de estilo compartido).

## Mantenibilidad

- **`renderMensajesList` y `renderThreadMessages` están declaradas dos veces** en el mismo scope global (index.html:4649/13215 y 4698/13436). La segunda declaración pisa a la primera en tiempo de parseo — el código de las líneas 4649/4698 **no se ejecuta nunca**. Es una trampa: alguien puede editar esa copia pensando que hace algo. Recomendado borrar el primer par.
- **`initCardSwipe()` (index.html:8500) es código muerto** — no se llama desde ningún lado, y las clases CSS que busca (`.mc-img-wrap`, `.mc-slides`, `.mc-dot`) tampoco existen en ningún otro lado. Una feature de swipe de fotos que se construyó y nunca se conectó.
- Sponsor slider de Market y de Chocados (index.html ~5186-5354) son implementaciones casi idénticas duplicadas (el propio comentario del código dice "clon independiente del de market", :5282) — cualquier fix hay que aplicarlo dos veces.
- 535 funciones top-level (374 `function` + 161 `async function`) y 115 variables top-level, todo en un solo scope global dentro de un único `<script>`. Es la deuda técnica reconocida en el README ("single-file SPA... deuda técnica reconocida").
- Mezcla de estilos async: 273 usos de `await` conviven con 41 cadenas `.then()` en zonas funcionalmente equivalentes — no es un bug, pero es inconsistente.
- 2,170 atributos `style="..."` inline — la mayoría de pantallas (splashes, paneles de superadmin, sheets) son bloques de template literal grandes en vez de componentes reutilizables.

## Bugs

- **`clearTimers()` (index.html:4488) es demasiado amplio.** Limpia TODOS los intervalos trackeados (`Object.values(timers).forEach(clearInterval)`), no solo el de la vista que se está cerrando. `openDetail()` (index.html:6015) lo llama antes de armar su propio countdown — como el autoplay del sponsor banner (`timers.sponsor`) vive en el mismo objeto compartido, **abrir el detalle de cualquier subasta apaga el autoplay del banner de patrocinantes por el resto de la sesión**, y nada lo vuelve a armar salvo que se recargue la data de sponsors. Vale la pena scopear la limpieza de timers por vista en vez de compartir un solo bag global.
- Env var mismatch de `admin-user.js` (ver Seguridad #4) — también es un bug funcional, no solo un riesgo.
- `vercel.json` sin `crons` (ver Seguridad #5) — posible que el cierre automático de subastas no esté corriendo.
- ✅ Chequeo puntual de null-safety salió bien: los 16 usos de `photoUrls[0]` están guardados con `photoUrls&&` antes, `place-bid.js` usa optional chaining consistentemente. No se encontró un patrón de null-deref real en lo muestreado.

## Accesibilidad

- 67 de 88 `<img>` sin `alt`.
- 686 `onclick=` contra solo 280 `<button>` reales — mucha UI clickeable (cards, chevrons, ítems de dropdown) son `<div>`/`<span>` sin rol ARIA ni afordancia de teclado.
- Solo 2 `tabindex` y 6 `aria-*` en las 16,032 líneas — dropdowns, sheets, tabs, carruseles: nada de esto es operable por teclado hoy.
- `prefers-reduced-motion` solo cubre `.rdv`/`.mkt-hub-btn`/`.rdv-skel` — los loops infinitos de `iconShake`/`chevronShake` y las curvas spring de toggles/sheets no están cubiertos.
- `--muted:#666` sobre `--bg:#000` da ~3.4:1 de contraste, por debajo del 4.5:1 de WCAG AA para texto normal. Es una decisión de diseño (estética dark/premium), no necesariamente un defecto, pero vale una pasada de contraste en los tonos más apagados.

---

## Qué atacaría primero, si tuviera que priorizar

1. Los dos XSS almacenados (sugerencias + moderación) — son explotables hoy contra la cuenta de superadmin, y el fix es mecánico (envolver en `_esc()`).
2. Confirmar en Vercel si el cron de `auction-close` realmente corre — si no, hay subastas que nunca cierran solas.
3. Unificar `SUPABASE_SERVICE_KEY` vs `SUPABASE_SERVICE_ROLE_KEY` antes de que cause un 500 silencioso en producción.
4. El bug de `clearTimers()` matando el autoplay del sponsor banner — silencioso, ya está pasando en producción probablemente, nadie lo nota porque no rompe nada visible salvo que el banner deja de rotar.

El resto (duplicados, código muerto, performance de assets, accesibilidad) es deuda real pero no urgente — vale la pena tenerlo mapeado para cuando llegue el momento de invertir en refactor, tal como dice el README.
