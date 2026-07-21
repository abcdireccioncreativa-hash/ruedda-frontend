# Ruedda — Design System & Transiciones

Auditoría de las bases de diseño visual y el sistema de animación, tal como existen en `index.html` a 2026-07-21 (post `rueddareleasecandidatev.0`). Documento de referencia — no es un roadmap de cambios.

## Tokens (`:root`, index.html:32-38)

Solo 13 variables — set mínimo, y usado de forma inconsistente (ver abajo):

```css
--bg:#000000; --card:#161616; --card2:#1e1e1e;
--lime:#e6f03b; --lime-dark:#b8c22e;
--white:#ffffff; --muted:#666; --muted2:#333;
--border:rgba(255,255,255,0.07); --badge:rgba(0,0,0,0.72);
--radius:22px; --radius-sm:15px;
--font:'OpenSauceOne',-apple-system,BlinkMacSystemFont,sans-serif;
```

**Estado real:** el lime `#e6f03b` aparece hardcodeado 267 veces vs. muy pocas referencias a `var(--lime)`. `var(--radius)`/`var(--radius-sm)` se usan solo 9 veces combinadas en todo el archivo. Hay 40+ hex literales sueltos que no están en `:root` (`#1d9bf0` azul de verificado, `#1fbf5c` verde de éxito, `#d4af37`, gradientes `#1a1a2e`/`#16213e`, colores de marca de redes sociales, etc.). **El palette no está tokenizado de verdad — los tokens existen pero cada componente elige su propio valor.**

## Tipografía

Fuente variable `OpenSauceOne` (400/500/700) embebida como 3 TTF en base64 dentro de `@font-face` (index.html:16-27) — ~237KB de base64 en el `<head>`, ver nota de performance abajo. 24 tamaños de `font-size` distintos en uso (5px–44px), con 11/12/13/14/15px dominando — una escala empírica razonable pero nunca declarada como tokens.

## Border-radius

22 valores distintos de `border-radius` en uso. Los más comunes: 100px (pills, 115×), 12px (78×), 14px (68×), 10px (57×), 13px (53×), 16px (42×), 18px (24×), 20px (20×). No hay una escala real de 3-4 pasos — es arbitrario por componente, aunque converge naturalmente alrededor de 12/14/16/18/20/100.

## Sombras

Sin sistema de elevación. ~30 valores de `box-shadow` distintos, cada modal/card/botón con su propio shadow ajustado a mano (ej. `0 30px 90px rgba(0,0,0,.65)` para sheets, `0 4px 20px rgba(230,240,59,.4)` para glow de lime, `0 2px 10px rgba(31,191,92,.3)` para éxito).

## Componentes

2,170 atributos `style="..."` inline en todo el archivo, contra un puñado de clases reales reutilizadas (`.market-card`, `.dropdown-menu`, `.modal-sheet`, `.toast`, `.rdv-skel`). La mayoría de modales, splash screens y paneles de superadmin son strings de template literal con estilos inline completos, construidos a mano por pantalla — muy poca componentización real.

---

## Sistema de animación — filosofía RDV

> Comentario original en el código (index.html:278-280): *"coreografía de entrada — elegante y sobria: un solo gesto (rise 9px + fade) con una sola curva, delays cortos en cascada. Nada de rebotes ni springs; esto es un marketplace premium, no un feed de doomscrolling."*

### Núcleo (única fuente de verdad del gesto RDV)

```css
@keyframes rdvIn{from{opacity:0;transform:translateY(9px)}to{opacity:1;transform:none}}
.rdv{animation:rdvIn .6s cubic-bezier(.22,.61,.36,1) both}

@keyframes rdvShimmer{from{transform:translateX(-100%)}to{transform:translateX(100%)}}
.rdv-skel{position:relative;overflow:hidden;background:var(--card)}
.rdv-skel::after{...animation:rdvShimmer 1.7s ease-in-out infinite}

@media (prefers-reduced-motion:reduce){.rdv{animation:none}...}
```

### Cascada de Market (10 bloques, delays en `index.html` ~1759-1869)

| bloque | delay |
|---|---|
| subtítulo bienvenida | 0s (default) |
| hd-head | .05s |
| sponsor-wrap | .05s |
| trending-head | .1s |
| hd-shell | .1s |
| trending-shell | .15s |
| encuentra-head | .25s |
| encuentra-grid | .3s |
| mkt-secondary-row | .35s |
| market-grid | .4s |

### Cascada de Concesionarios (6 bloques, ~index.html 1885-1961)

| bloque | delay |
|---|---|
| banner patrocinante | 0s (default) |
| hero cards | .06s |
| sq cards (postventa/manual) | .12s |
| "solicita tu carro" | .18s |
| "mejores agencias" | .24s |
| "ser partner" | .3s |

Más `_consReenterFade()` (index.html ~4238): re-crossfade con `scale(1.035)→scale(1)` si el banner ya tenía foto cargada de una visita previa, para que no "aparezca plantado" al re-entrar a la sección. Respeta `prefers-reduced-motion`.

### Sponsor slider / banners con data (index.html ~5190-5250)

Tres estados sin saltos de layout: (1) cargando → skeleton (`rdv-skel`) ocupa el espacio; (2) confirmado vacío → colapso ANIMADO de `max-height`+`opacity` (nunca `display:none` seco); (3) con data → cada `<img>` entra con `opacity:0` → `onload` fade a 1, y el skeleton se re-monta ENCIMA y se desvanece con `requestAnimationFrame` + `remove()` a los 500ms.

### Trending (index.html ~5372-5410)

Skeleton de 4 celdas (`trending-cell rdv-skel`, sin animación de entrada, solo shimmer) mientras `_feedLoaded` no resuelve ambas fuentes. Con data: cada celda usa `animation:rdvIn .6s cubic-bezier(.22,.61,.36,1) ${i*70}ms both` — cascada de 70ms entre celdas.

---

## Otras animaciones del archivo (fuera de RDV)

Un catálogo completo de curvas de easing en uso, para referencia:

| curva | usos | dónde |
|---|---|---|
| `cubic-bezier(.32,.72,0,1)` | 24 | sheets/drawers/dropdowns (`.vender-sheet`, `#auth-sheet`, `.dropdown-glass`) |
| `cubic-bezier(.22,1,.36,1)` | 22 | pop-ins, acordeones, splash inners (`hubPopIn`, `.fdd-menu`, barra de login) |
| `cubic-bezier(.25,.46,.45,.94)` | 16 | tabs (`.cnt-slider-tab`) |
| `cubic-bezier(.4,0,.2,1)` | 14 | curva estándar tipo Material (`.mkt-cond-thumb`, `splashRing`/`splashCheck`) |
| `cubic-bezier(.34,1.56,.64,1)` | 4 | **spring/overshoot real** (toggle de settings, entrada de sheets "plan info"/"mis publicaciones") |
| `cubic-bezier(.22,.61,.36,1)` (RDV) | 4 fuera de `.rdv` | ej. colapso del sponsor-wrap |

**9 familias de curvas activas en el archivo — solo la curva RDV cumple la filosofía "un solo gesto".** Dos choques concretos con el propio comentario del código, documentados para si algún día se quiere unificar (no se tocaron en esta auditoría, es fuera de scope de la reparación del punto 4/5):

- `cubic-bezier(.34,1.56,.64,1)` es un spring literal (overshoot >1) en el toggle de settings (`index.html:659`) y en la entrada de los sheets "plan info"/"mis publicaciones" (`:8461`, `:8529`) — contradice directamente el comentario "nada de rebotes ni springs".
- `aasPop` (`index.html:14008`, reusado en `:14022`/`:14052`) — `scale(.6)→scale(1.15)→scale(1)` — mismo bounce, usado en el ícono de confirmación de pago.

**Splash/login:** `splashFade`/`splashRing`/`splashCheck` (index.html:780-782) — consistentes entre sí, un solo fade+rise, reusados en login, confirmación de pago y comprobante.

**Toasts:** dos sistemas independientes — `showToast()` genérico y `showSoonPill()` para stubs "próximamente" — ambos consistentes entre sí (slide-up + opacity).

**Sheets/modales:** 4 mecanismos distintos (`.vender-sheet`, `#auth-sheet`/`.modal-sheet`, `.dropdown-menu`, `.fdd-menu`) con 2 curvas diferentes entre ellos — no hay un primitivo compartido de "sheet que entra".

**Micro-animaciones de ícono en loop infinito:** `iconShake` (ícono de martillo, ciclo 4.2s) y `chevronShake` (flecha del dropdown de sección, ciclo 5s) — sutiles, consistentes entre sí, pero **no respetan `prefers-reduced-motion`** (solo `.rdv`/`.mkt-hub-btn`/`.rdv-skel` están cubiertos por esa media query).

**Carruseles:** sponsor slider de Market (autoplay 6000ms) y de Chocados (autoplay 2500ms) son implementaciones casi idénticas duplicadas — ver auditoría de código para el detalle de mantenibilidad.
