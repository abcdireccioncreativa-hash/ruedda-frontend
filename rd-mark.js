/* rd-mark.js · resaltador amarillo animado (mismo efecto que "precios inflados" en ruedda.app/hub).
   MÓDULO OPCIONAL: para quitarlo basta borrar la línea <script src="/rd-mark.js…"> en index.html.
   Para resaltar otro título, agrega su selector a SELECTORS. Se dibuja una sola vez, al entrar en pantalla. */
(function () {
  var SELECTORS = ['#pd-head .hd-title'];
  if (!('IntersectionObserver' in window)) return;
  var st = document.createElement('style');
  st.textContent =
    '.rd-mark{background-image:linear-gradient(rgba(230,240,59,.88),rgba(230,240,59,.88));background-repeat:no-repeat;background-position:0 50%;background-size:0% 100%;padding:0 .14em;margin:0 -.04em;border-radius:3px;-webkit-box-decoration-break:clone;box-decoration-break:clone;transition:background-size 1s cubic-bezier(.65,0,.35,1) .25s,color .35s ease .7s}' +
    '.rd-mark.on{background-size:100% 100%;color:#000!important}' +
    '@media (prefers-reduced-motion:reduce){.rd-mark{transition:none}}';
  document.head.appendChild(st);
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting && e.intersectionRatio >= 0.9) { e.target.classList.add('on'); io.unobserve(e.target); }
    });
  }, { threshold: [0, 0.9] });
  function scan() {
    SELECTORS.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        if (el.classList.contains('rd-mark')) return;
        el.classList.add('rd-mark');
        io.observe(el);
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan); else scan();
})();
