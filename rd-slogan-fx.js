/* rd-slogan-fx.js · animación del slogan del market (#mkt-slogan).
   Las palabras entran escalonadas (suben y se enfocan), luego el resaltador amarillo de "price drops"
   barre la frase clave (la segunda oración, o las 2 últimas palabras), se sostiene y se retira hacia la derecha.
   Se repite cada vez que el slogan vuelve a entrar en pantalla.
   MÓDULO OPCIONAL: para quitarlo basta borrar la línea <script src="/rd-slogan-fx.js…"> en index.html y desktop.html. */
(function () {
  if (!('IntersectionObserver' in window)) return;
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var st = document.createElement('style');
  st.textContent =
    '#mkt-slogan .sfx-w{display:inline-block;opacity:0;transform:translateY(7px);filter:blur(5px);transition:opacity .55s ease,transform .7s cubic-bezier(.2,.8,.2,1),filter .6s ease;white-space:pre}' +
    '#mkt-slogan.sfx-in .sfx-w{opacity:1;transform:none;filter:none}' +
    '#mkt-slogan .sfx-k{background-image:linear-gradient(rgba(230,240,59,.9),rgba(230,240,59,.9));background-repeat:no-repeat;background-position:0 50%;background-size:0% 100%;padding:0 .18em;margin:0 -.06em;border-radius:3px;-webkit-box-decoration-break:clone;box-decoration-break:clone;transition:background-size .9s cubic-bezier(.65,0,.35,1),color .35s ease .35s}' +
    '#mkt-slogan .sfx-k.on{background-size:100% 100%;color:#000}' +
    '#mkt-slogan .sfx-k.on.off{color:inherit}' +
    '#mkt-slogan .sfx-k.off{background-position:100% 50%;background-size:0% 100%;transition:background-size .7s cubic-bezier(.65,0,.35,1),color .3s ease}';
  document.head.appendChild(st);

  var el, timers = [], building = false, plain = '';
  function clear() { timers.forEach(clearTimeout); timers = []; }
  function esc(s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function build() {
    plain = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!plain) return;
    var words = plain.split(' ');
    // frase clave: desde la segunda oración; si hay una sola, las 2 últimas palabras
    var cut = -1;
    for (var i = 0; i < words.length - 1; i++) if (/[.!?]$/.test(words[i])) { cut = i + 1; break; }
    if (cut < 0) cut = Math.max(0, words.length - 2);
    var html = '', n = 0;
    function w(t, last) { return '<span class="sfx-w" style="transition-delay:' + (n++ * 85) + 'ms">' + esc(t) + (last ? '' : ' ') + '</span>'; }
    for (var a = 0; a < cut; a++) html += w(words[a], false);
    var k = '';
    for (var b = cut; b < words.length; b++) k += w(words[b], b === words.length - 1);
    html += '<span class="sfx-k">' + k + '</span>';
    building = true;
    el.innerHTML = html;
    el.setAttribute('aria-label', plain);
    building = false;
  }

  function play() {
    clear();
    var k = el.querySelector('.sfx-k');
    if (!k) return;
    var n = el.querySelectorAll('.sfx-w').length;
    el.classList.remove('sfx-in'); k.classList.remove('on', 'off'); void el.offsetWidth;
    el.classList.add('sfx-in');
    var t = n * 85 + 450;
    timers.push(setTimeout(function () { k.classList.add('on'); }, t));
    timers.push(setTimeout(function () { k.classList.add('off'); }, t + 900 + 2600));
    timers.push(setTimeout(function () { k.classList.remove('on', 'off'); }, t + 900 + 2600 + 900));
  }

  function reset() {
    clear();
    el.classList.remove('sfx-in');
    var k = el.querySelector('.sfx-k'); if (k) k.classList.remove('on', 'off');
  }

  function init() {
    el = document.getElementById('mkt-slogan');
    if (!el) return;
    build();
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting && e.intersectionRatio >= 0.9) play();
        else if (!e.isIntersecting) reset();
      });
    }, { threshold: [0, 0.9] });
    io.observe(el);
    // si Ruedda Control cambia el texto (rd_market_slogan), se reconstruye y vuelve a animar
    new MutationObserver(function () {
      if (building) return;
      var now = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (el.querySelector('.sfx-w') && now === plain) return;
      build(); reset(); play();
    }).observe(el, { childList: true, characterData: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
