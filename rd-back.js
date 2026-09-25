// Botón "‹ Ruedda" para las páginas de Ruedda Extra (store, scanner, etc.).
// Dentro de la app no hay barra del navegador, así que sin esto no hay forma
// de volver. Uso: <script src="/rd-back.js" data-bottom="16" data-mode="back"></script>
//   data-bottom: separación desde abajo en px (para no tapar barras propias)
//   data-mode:   "back" vuelve atrás si se llegó desde Ruedda; "home" siempre va al inicio
(function(){
  if (document.getElementById('rd-back-btn')) return;
  var me = document.currentScript;
  var bottom = parseInt((me && me.getAttribute('data-bottom')) || '16', 10);
  var mode = (me && me.getAttribute('data-mode')) || 'back';

  var st = document.createElement('style');
  st.textContent =
    '#rd-back-btn{position:fixed;left:14px;bottom:calc(env(safe-area-inset-bottom,0px) + ' + bottom + 'px);z-index:2147483000;' +
    'display:flex;align-items:center;gap:4px;height:40px;padding:0 16px 0 10px;border-radius:999px;cursor:pointer;' +
    'background:rgba(18,18,20,.62);color:#fff;border:1px solid rgba(255,255,255,.18);' +
    '-webkit-backdrop-filter:saturate(180%) blur(18px);backdrop-filter:saturate(180%) blur(18px);' +
    'box-shadow:0 6px 20px rgba(0,0,0,.28);font:600 14px/1 -apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",Arial,sans-serif;' +
    'letter-spacing:-.1px;-webkit-tap-highlight-color:transparent;transition:transform .15s ease,opacity .15s ease}' +
    '#rd-back-btn:active{transform:scale(.95);opacity:.85}' +
    '#rd-back-btn svg{width:18px;height:18px}';
  document.head.appendChild(st);

  var b = document.createElement('button');
  b.id = 'rd-back-btn';
  b.type = 'button';
  b.setAttribute('aria-label', 'Volver a Ruedda');
  b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg><span>Ruedda</span>';
  b.addEventListener('click', function(){
    var fromRuedda = false;
    try { fromRuedda = !!document.referrer && new URL(document.referrer).origin === location.origin; } catch(e) {}
    if (mode === 'back' && fromRuedda && history.length > 1) history.back();
    else location.href = '/';
  });

  function mount(){ document.body.appendChild(b); }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
