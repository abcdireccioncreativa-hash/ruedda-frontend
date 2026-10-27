/* [V160] sello "vendido" sobre la foto de la ficha del market (móvil y desktop).
   Un rectángulo amarillo Ruedda, inclinado (izquierda más baja), que cae sobre la galería
   como si alguien lo pegara: entra grande, golpea, rebota un poco y queda quieto con un brillo.
   Vive en #mkt-gallery (fuera del carrusel), así queda centrado en cualquier foto y no tapa el swipe. */
(function () {
  var css = document.createElement('style');
  css.textContent = `
.rd-sello{position:absolute;left:50%;top:50%;z-index:6;pointer-events:none;transform:translate(-50%,-50%) rotate(-7deg);
  --ez:cubic-bezier(.2,1.4,.4,1)}
.rd-sello b{position:relative;display:block;overflow:hidden;background:#e6f03b;color:#0b0b0b;font-family:var(--font);
  font-size:clamp(30px,8.5vw,46px);font-weight:800;letter-spacing:-.045em;line-height:1;padding:.32em .62em .36em;border-radius:7px;
  box-shadow:0 14px 34px -8px rgba(0,0,0,.55),0 2px 6px rgba(0,0,0,.25),inset 0 1px 0 rgba(255,255,255,.55),inset 0 -2px 0 rgba(0,0,0,.08)}
/* cintas en las esquinas, como pegado a mano */
.rd-sello i{position:absolute;top:-9px;width:46px;height:18px;background:rgba(255,255,255,.42);
  backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);box-shadow:0 1px 2px rgba(0,0,0,.12);border-radius:2px;z-index:1}
.rd-sello i:first-child{left:-14px;transform:rotate(-34deg)}
.rd-sello i:last-child{right:-14px;transform:rotate(30deg)}
/* brillo que cruza una vez */
.rd-sello b::after{content:'';position:absolute;inset:-20% auto -20% -60%;width:40%;
  background:linear-gradient(100deg,transparent,rgba(255,255,255,.75),transparent);transform:skewX(-18deg);opacity:0}
.rd-sello.in{animation:rdSelloIn .62s var(--ez) both}
.rd-sello.in b::after{animation:rdSelloBrillo .9s .55s ease both}
.rd-sello.in i{animation:rdSelloCinta .3s .42s ease-out both}
@keyframes rdSelloIn{
  0%{opacity:0;transform:translate(-50%,-50%) rotate(-16deg) scale(1.9)}
  55%{opacity:1;transform:translate(-50%,-50%) rotate(-5deg) scale(.94)}
  78%{transform:translate(-50%,-50%) rotate(-7.6deg) scale(1.03)}
  100%{opacity:1;transform:translate(-50%,-50%) rotate(-7deg) scale(1)}}
@keyframes rdSelloBrillo{0%{opacity:1;left:-60%}100%{opacity:1;left:130%}}
@keyframes rdSelloCinta{from{opacity:0;transform:translateY(-6px) rotate(0)}}
@media (prefers-reduced-motion:reduce){.rd-sello.in,.rd-sello.in b::after,.rd-sello.in i{animation:none}}
`;
  document.head.appendChild(css);

  // móvil: carrusel #mkt-gallery · desktop: foto grande del collage #mkt-cb-main (si está visible)
  function host() {
    var cb = document.getElementById('mkt-cb-main');
    if (cb && cb.getBoundingClientRect().width > 0) return cb;
    return document.getElementById('mkt-gallery');
  }
  var timer = 0;
  window._rdSello = function (l) {
    clearTimeout(timer);
    [].forEach.call(document.querySelectorAll('.rd-sello'), function (x) { x.remove(); });
    if (!l || !l.vendido) return;
    // espera a que la ficha (y el collage de desktop) terminen de armarse, así el golpe se ve
    timer = setTimeout(function () {
      var g = host();
      if (!g) return;
      if (getComputedStyle(g).position === 'static') g.style.position = 'relative';
      var s = document.createElement('div');
      s.className = 'rd-sello';
      s.setAttribute('aria-label', 'vendido');
      s.innerHTML = '<i></i><b>vendido</b><i></i>';
      g.appendChild(s);
      s.offsetWidth;
      s.classList.add('in');
    }, 320);
  };
})();
