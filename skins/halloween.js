/* Ruedda · skin Halloween.
   Todo vive en este archivo: telaraña en cada post del market y en la intro,
   calabaza junto al logo, botón vender morado con murciélagos al tocar.
   Se prende y apaga desde Control → Modo Halloween (app_settings.skin_halloween);
   apagado, se quita el estilo y la clase y todo queda como estaba. Sin fila en
   app_settings está encendido. ?skin=off lo apaga en una visita. Para sacarlo
   del todo, borra la línea <script src="/skins/halloween.js"> del HTML. */
(function () {
  try { if (/[?&]skin=off\b/.test(location.search)) return; } catch (e) {}
  if (window.__rdSkinHalloween) return;
  window.__rdSkinHalloween = true;
  var KEY = 'skin_halloween', CACHE = 'rd_skin_hw';
  var SB = 'https://ltodsegzbbdcaublkgtp.supabase.co/rest/v1/app_settings?select=value&key=eq.' + KEY;
  var ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0b2RzZWd6YmJkY2F1YmxrZ3RwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MjIwOTgsImV4cCI6MjA5NTI5ODA5OH0.WXbnE5_XfNwwVUtDGSWa6Voetcflcl7m2vDOpEofs_w';
  var reduce = false, on = false, st = null;
  try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var css = '' +
  'html.rd-hw .market-card-img::before,html.rd-hw .hd-img-wrap::before,html.rd-hw .trending-cell::before,html.rd-hw .rd-fp::before{content:"";position:absolute;top:0;right:0;width:34%;max-width:96px;aspect-ratio:1;z-index:4;pointer-events:none;' +
    'background:url("data:image/svg+xml;utf8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Cpath d=%22M100 0L1.4 0.0 M100 0L4.8 25.5 M100 0L14.6 49.3 M100 0L30.3 69.7 M100 0L50.7 85.4 M100 0L74.5 95.2 M100 0L100.0 98.6 M86.3 0.0Q88.9 1.5 86.1 3.7Q89.7 4.3 87.9 7.0Q91.1 6.8 90.4 9.6Q93.2 8.9 92.8 12.5Q95.7 10.3 96.4 13.5Q98.5 11.1 100.0 13.6 M73.0 0.0Q78.6 2.8 74.7 6.8Q80.0 8.3 75.9 13.9Q82.9 13.1 80.9 19.1Q86.9 17.1 86.9 22.7Q91.7 20.0 92.8 26.9Q97.2 21.4 100.0 27.0 M58.0 0.0Q67.5 4.3 60.4 10.6Q69.7 12.6 65.6 19.9Q74.0 20.0 70.1 29.9Q80.0 26.0 79.5 35.5Q87.4 30.3 89.7 38.4Q95.7 32.5 100.0 42.2 M45.4 0.0Q55.6 5.8 44.3 14.9Q58.6 17.1 51.5 28.0Q64.5 27.3 61.6 38.4Q72.7 35.5 71.2 50.0Q82.9 41.4 85.5 54.1Q94.2 44.4 100.0 54.3 M28.0 0.0Q42.9 7.5 32.5 18.1Q46.8 22.0 35.8 37.1Q54.3 35.1 49.1 50.9Q64.9 45.7 65.1 60.5Q78.0 53.2 80.8 71.6Q92.5 57.1 100.0 72.0 M9.8 0.0Q30.2 9.2 15.0 22.8Q35.0 26.9 26.1 42.7Q44.1 42.9 35.9 64.1Q57.1 55.9 56.0 76.2Q73.1 65.0 77.9 82.5Q90.8 69.8 100.0 90.6%22 fill=%22none%22 stroke=%22black%22 stroke-width=%222.2%22 stroke-linecap=%22round%22 opacity=%22.28%22/%3E%3Cpath d=%22M100 0L1.4 0.0 M100 0L4.8 25.5 M100 0L14.6 49.3 M100 0L30.3 69.7 M100 0L50.7 85.4 M100 0L74.5 95.2 M100 0L100.0 98.6 M86.3 0.0Q88.9 1.5 86.1 3.7Q89.7 4.3 87.9 7.0Q91.1 6.8 90.4 9.6Q93.2 8.9 92.8 12.5Q95.7 10.3 96.4 13.5Q98.5 11.1 100.0 13.6 M73.0 0.0Q78.6 2.8 74.7 6.8Q80.0 8.3 75.9 13.9Q82.9 13.1 80.9 19.1Q86.9 17.1 86.9 22.7Q91.7 20.0 92.8 26.9Q97.2 21.4 100.0 27.0 M58.0 0.0Q67.5 4.3 60.4 10.6Q69.7 12.6 65.6 19.9Q74.0 20.0 70.1 29.9Q80.0 26.0 79.5 35.5Q87.4 30.3 89.7 38.4Q95.7 32.5 100.0 42.2 M45.4 0.0Q55.6 5.8 44.3 14.9Q58.6 17.1 51.5 28.0Q64.5 27.3 61.6 38.4Q72.7 35.5 71.2 50.0Q82.9 41.4 85.5 54.1Q94.2 44.4 100.0 54.3 M28.0 0.0Q42.9 7.5 32.5 18.1Q46.8 22.0 35.8 37.1Q54.3 35.1 49.1 50.9Q64.9 45.7 65.1 60.5Q78.0 53.2 80.8 71.6Q92.5 57.1 100.0 72.0 M9.8 0.0Q30.2 9.2 15.0 22.8Q35.0 26.9 26.1 42.7Q44.1 42.9 35.9 64.1Q57.1 55.9 56.0 76.2Q73.1 65.0 77.9 82.5Q90.8 69.8 100.0 90.6%22 fill=%22none%22 stroke=%22white%22 stroke-width=%22.9%22 stroke-linecap=%22round%22 opacity=%22.9%22/%3E%3Cpath d=%22M66 0V34%22 stroke=%22white%22 stroke-width=%22.6%22 opacity=%22.8%22/%3E%3Cg transform=%22translate(66 38)%22%3E%3Cellipse rx=%223.1%22 ry=%223.8%22 fill=%22%23111%22/%3E%3Ccircle cy=%22-4.3%22 r=%222.1%22 fill=%22%23111%22/%3E%3Cpath d=%22M-2.6-1.5l-4-2.6-1.6-3M2.6-1.5l4-2.6 1.6-3M-3 .5l-5 .4-2 2.6M3 .5l5 .4 2 2.6M-2.6 2.2l-3.8 3-1 3M2.6 2.2l3.8 3 1 3%22 stroke=%22%23111%22 stroke-width=%22.9%22 fill=%22none%22 stroke-linecap=%22round%22/%3E%3Ccircle cx=%22-.8%22 cy=%22-4.6%22 r=%22.45%22 fill=%22%23e6f03b%22/%3E%3Ccircle cx=%22.8%22 cy=%22-4.6%22 r=%22.45%22 fill=%22%23e6f03b%22/%3E%3C/g%3E%3C/svg%3E") no-repeat top right/contain;opacity:.92;border-top-right-radius:var(--rdhw-r,0)}' +
  'html.rd-hw .market-card-img{--rdhw-r:8px}html.rd-hw .market-grid.mode-grid .market-card-img{--rdhw-r:20px}html.rd-hw .hd-img-wrap{--rdhw-r:16px}html.rd-hw .rd-fp{--rdhw-r:20px}' +
  'html.rd-hw .trending-cell::before{width:42%}html.rd-hw .rd-fp::before{z-index:1;width:22%;max-width:120px}html.rd-hw .hd-img-wrap::before{width:44%}' +
  'html.rd-hw #rd-intro::before{content:"";position:absolute;top:0;left:0;width:min(46vw,230px);aspect-ratio:1;z-index:3;pointer-events:none;' +
    'background:url("data:image/svg+xml;utf8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Cpath d=%22M100 0L1.4 0.0 M100 0L4.8 25.5 M100 0L14.6 49.3 M100 0L30.3 69.7 M100 0L50.7 85.4 M100 0L74.5 95.2 M100 0L100.0 98.6 M86.3 0.0Q88.9 1.5 86.1 3.7Q89.7 4.3 87.9 7.0Q91.1 6.8 90.4 9.6Q93.2 8.9 92.8 12.5Q95.7 10.3 96.4 13.5Q98.5 11.1 100.0 13.6 M73.0 0.0Q78.6 2.8 74.7 6.8Q80.0 8.3 75.9 13.9Q82.9 13.1 80.9 19.1Q86.9 17.1 86.9 22.7Q91.7 20.0 92.8 26.9Q97.2 21.4 100.0 27.0 M58.0 0.0Q67.5 4.3 60.4 10.6Q69.7 12.6 65.6 19.9Q74.0 20.0 70.1 29.9Q80.0 26.0 79.5 35.5Q87.4 30.3 89.7 38.4Q95.7 32.5 100.0 42.2 M45.4 0.0Q55.6 5.8 44.3 14.9Q58.6 17.1 51.5 28.0Q64.5 27.3 61.6 38.4Q72.7 35.5 71.2 50.0Q82.9 41.4 85.5 54.1Q94.2 44.4 100.0 54.3 M28.0 0.0Q42.9 7.5 32.5 18.1Q46.8 22.0 35.8 37.1Q54.3 35.1 49.1 50.9Q64.9 45.7 65.1 60.5Q78.0 53.2 80.8 71.6Q92.5 57.1 100.0 72.0 M9.8 0.0Q30.2 9.2 15.0 22.8Q35.0 26.9 26.1 42.7Q44.1 42.9 35.9 64.1Q57.1 55.9 56.0 76.2Q73.1 65.0 77.9 82.5Q90.8 69.8 100.0 90.6%22 fill=%22none%22 stroke=%22white%22 stroke-width=%22.7%22 stroke-linecap=%22round%22 opacity=%22.85%22/%3E%3C/svg%3E") no-repeat top left/contain;transform:scaleX(-1);transform-origin:center;opacity:.55;filter:drop-shadow(0 0 6px rgba(168,85,247,.35))}' +
  'html.rd-hw .landing-nav-logo{display:flex;align-items:center}html.rd-hw .logo::after,html.rd-hw .landing-nav-logo::after{content:"";width:22px;height:22px;margin:0 0 0 7px;flex:none;align-self:center;background:url("data:image/svg+xml;utf8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22%3E%3Cdefs%3E%3CradialGradient id=%22p%22 cx=%22.45%22 cy=%22.4%22 r=%22.7%22%3E%3Cstop offset=%220%22 stop-color=%22%23ffa23a%22/%3E%3Cstop offset=%22.65%22 stop-color=%22%23f2701b%22/%3E%3Cstop offset=%221%22 stop-color=%22%23b8430d%22/%3E%3C/radialGradient%3E%3C/defs%3E%3Cpath d=%22M19.4 9.6c-.3-2.6.4-4.9 2.6-6.4l1.3 1.6c-1.6 1-2 2.6-1.8 4.9z%22 fill=%22%234a6b2a%22/%3E%3Cellipse cx=%2212.6%22 cy=%2223.4%22 rx=%229.4%22 ry=%2212%22 fill=%22url(%23p)%22/%3E%3Cellipse cx=%2227.4%22 cy=%2223.4%22 rx=%229.4%22 ry=%2212%22 fill=%22url(%23p)%22/%3E%3Cellipse cx=%2220%22 cy=%2223.4%22 rx=%229%22 ry=%2213%22 fill=%22url(%23p)%22/%3E%3Cpath d=%22M20 10.6c-2.6 3-3.2 21.6 0 25.6M20 10.6c2.6 3 3.2 21.6 0 25.6%22 fill=%22none%22 stroke=%22%23a63c0b%22 stroke-width=%22.7%22 opacity=%22.55%22/%3E%3Cg fill=%22%23e6f03b%22 class=%22f%22%3E%3Cpath d=%22M11.6 20.2l3.2-3.4 2 3.8z%22/%3E%3Cpath d=%22M28.4 20.2l-3.2-3.4-2 3.8z%22/%3E%3Cpath d=%22M18.6 23.2l1.4-2.2 1.4 2.2z%22/%3E%3Cpath d=%22M9.8 26.4c3 4.6 17.4 4.6 20.4 0-1.4.6-2.6.8-3.6.8l-.8 1.8-1.2-1.6c-1.4.2-3 .3-4.6.3l-.8 1.9-1-1.9c-1.6 0-3.1-.1-4.5-.3l-1.1 1.6-.8-1.8c-1.2-.1-2.3-.4-3.4-.8z%22/%3E%3C/g%3E%3C/svg%3E") no-repeat center/contain;' +
    'filter:drop-shadow(0 0 6px rgba(242,112,27,.55));animation:rdhw-bob 3.2s ease-in-out infinite}' +
  '@keyframes rdhw-bob{0%,100%{transform:translateY(0) rotate(-4deg)}50%{transform:translateY(-1.5px) rotate(4deg)}}' +
  'html.rd-hw .btn-vender,html.rd-hw:not([data-theme="light"]) .btn-vender{position:relative;isolation:isolate;overflow:hidden;color:#fff!important;font-weight:800;' +
    'background:linear-gradient(100deg,#1a0633 0%,#4c1d95 34%,#7c3aed 58%,#a855f7 76%,#d9c84f 92%,#e6f03b 100%)!important;' +
    'box-shadow:0 0 0 1px rgba(168,85,247,.6),0 0 14px rgba(124,58,237,.7),0 0 30px rgba(124,58,237,.3)!important;text-shadow:0 0 10px rgba(46,6,84,.9),0 0 2px rgba(46,6,84,.9);' +
    'animation:rdhw-glow 2.6s ease-in-out infinite}' +
  'html.rd-hw .btn-vender::before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;' +
    'background:linear-gradient(100deg,transparent 30%,rgba(233,213,255,.35) 48%,transparent 62%);background-size:260% 100%;animation:rdhw-sheen 3.8s ease-in-out infinite}' +
  'html.rd-hw .btn-vender:active{transform:scale(.96)}' +
  '@keyframes rdhw-sheen{0%{background-position:130% 0}55%,100%{background-position:-60% 0}}' +
  '@keyframes rdhw-glow{0%,100%{box-shadow:0 0 0 1px rgba(168,85,247,.6),0 0 12px rgba(124,58,237,.6),0 0 26px rgba(124,58,237,.25),4px 0 16px rgba(230,240,59,.12)}' +
    '50%{box-shadow:0 0 0 1px rgba(196,140,255,.85),0 0 22px rgba(147,51,234,.9),0 0 44px rgba(124,58,237,.35),8px 0 22px rgba(230,240,59,.3)}}' +
  '.rdhw-bat{position:fixed;left:0;top:0;width:40px;height:19px;margin:-9px 0 0 -20px;z-index:2147483000;pointer-events:none;color:#3a1170;will-change:transform,opacity;' +
    'filter:drop-shadow(0 0 3px rgba(192,132,252,.95)) drop-shadow(0 0 10px rgba(124,58,237,.7))}' +
  '.rdhw-bat i{display:block;width:100%;height:100%;animation:rdhw-flap .16s ease-in-out infinite alternate}' +
  '.rdhw-bat svg{display:block;width:100%;height:100%}' +
  '@keyframes rdhw-flap{from{transform:scaleY(1)}to{transform:scaleY(.35)}}' +
  '@media (prefers-reduced-motion:reduce){html.rd-hw .logo::after,html.rd-hw .landing-nav-logo::after,html.rd-hw .btn-vender,html.rd-hw .btn-vender::before{animation:none}}';

  function apply(v) {
    v = !!v;
    if (v === on) return;
    on = v;
    if (v) {
      st = document.createElement('style');
      st.id = 'rd-skin-halloween';
      st.textContent = css;
      (document.head || document.documentElement).appendChild(st);
      document.documentElement.classList.add('rd-hw');
    } else {
      document.documentElement.classList.remove('rd-hw');
      if (st) st.remove();
      st = null;
      var b = document.querySelectorAll('.rdhw-bat');
      for (var i = 0; i < b.length; i++) b[i].remove();
    }
  }
  // arranca con lo último que se supo (sin parpadeo) y lo confirma con el servidor
  var cached = null;
  try { cached = localStorage.getItem(CACHE); } catch (e) {}
  apply(cached !== '0');
  function check() {
    fetch(SB, { headers: { apikey: ANON, Authorization: 'Bearer ' + ANON }, cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (rows) {
        if (!rows) return;
        var v = true;
        if (rows[0] && rows[0].value != null) {
          var x = rows[0].value;
          try { if (typeof x === 'string') x = JSON.parse(x); } catch (e) {}
          v = !(x === false || (x && x.active === false));
        }
        try { localStorage.setItem(CACHE, v ? '1' : '0'); } catch (e) {}
        apply(v);
      }).catch(function () {});
  }
  check();
  // al volver a la app se revisa otra vez: apagarlo en Control llega sin reiniciar
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') check(); });

  var BAT = '<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 64 30\'><path d=\'M32 9c-1.2 0-2-1.6-2.4-3.4L28 7.4C24 3 15 1 6 3.6c4 1.4 6.6 4 7.4 7.6-3.4-1.4-7.6-1-11 1.2 5 .6 8.8 3.4 10.6 7.4 3.4-2.8 8.6-3.6 12-1.2 2-.8 4 .4 5.2 3.6 0 0 .8-1.4 1.8-1.4s1.8 1.4 1.8 1.4c1.2-3.2 3.2-4.4 5.2-3.6 3.4-2.4 8.6-1.6 12 1.2 1.8-4 5.6-6.8 10.6-7.4-3.4-2.2-7.6-2.6-11-1.2.8-3.6 3.4-6.2 7.4-7.6C49 1 40 3 36 7.4l-1.6-1.8C34 7.4 33.2 9 32 9z\' fill=\'currentColor\'/></svg>';
  var live = 0;
  function bats(x, y, n, spread) {
    if (!on || reduce || live > 24) return;
    for (var i = 0; i < n; i++) {
      var b = document.createElement('div');
      b.className = 'rdhw-bat';
      b.innerHTML = '<i>' + BAT + '</i>';
      var s = .55 + Math.random() * .65;
      var ang = ((y < innerHeight * .35 ? 70 : -90) + (Math.random() * 2 - 1) * spread) * Math.PI / 180; // cerca del borde de arriba salen hacia abajo
      var dist = 140 + Math.random() * 220;
      var dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist;
      var wob = (Math.random() * 2 - 1) * 60;
      var dur = 950 + Math.random() * 650;
      b.firstChild.style.animationDuration = (.12 + Math.random() * .08) + 's';
      document.body.appendChild(b);
      live++;
      var a = b.animate([
        { transform: 'translate(' + x + 'px,' + y + 'px) scale(' + s * .3 + ')', opacity: 0 },
        { transform: 'translate(' + (x + dx * .35 + wob) + 'px,' + (y + dy * .35) + 'px) scale(' + s + ')', opacity: 1, offset: .25 },
        { transform: 'translate(' + (x + dx * .7 - wob * .6) + 'px,' + (y + dy * .7) + 'px) scale(' + s * .9 + ')', opacity: .9, offset: .65 },
        { transform: 'translate(' + (x + dx) + 'px,' + (y + dy) + 'px) scale(' + s * .7 + ')', opacity: 0 }
      ], { duration: dur, delay: i * 35, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'both' });
      a.onfinish = (function (el) { return function () { el.remove(); live--; }; })(b);
    }
  }
  document.addEventListener('pointerdown', function (e) {
    if (!on) return;
    var t = e.target;
    if (!t || !t.closest) return;
    var v = t.closest('.btn-vender');
    if (v) { var r = v.getBoundingClientRect(); return bats(r.left + r.width / 2, r.top + r.height / 2, 9, 70); }
    if (t.closest('.market-card,.hd-card,.trending-cell,.rd-fp')) bats(e.clientX, e.clientY, 6, 60);
  }, { passive: true, capture: true });
})();
