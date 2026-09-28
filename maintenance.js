/* ─────────────────────────────────────────────────────────────
   RUEDDA · PANTALLA DE MANTENIMIENTO (módulo independiente)
   Para QUITARLA: cambiar RD_MAINTENANCE a false y hacer push.
   No toca nada de la app: solo pinta una capa encima de todo,
   después de la animación de inicio.
   ───────────────────────────────────────────────────────────── */
(function(){
  var RD_MAINTENANCE = true;
  if(!RD_MAINTENANCE) return;

  function show(){
    if(document.getElementById('rd-maint')) return;
    var st=document.createElement('style');
    st.textContent=
      '#rd-maint{position:fixed;inset:0;z-index:2147483647;background:#000;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:24px;text-align:center;opacity:0;transition:opacity .7s ease;font-family:var(--font,-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif);-webkit-user-select:none;user-select:none;touch-action:none}'+
      '#rd-maint.on{opacity:1}'+
      '#rd-maint svg{width:40px;height:40px}'+
      '#rd-maint .h{transform-origin:12px 12px;animation:rdMaintSpin 36s linear infinite}'+
      '#rd-maint .m{transform-origin:12px 12px;animation:rdMaintSpin 3s linear infinite}'+
      '#rd-maint .t{font-size:17px;font-weight:700;letter-spacing:-.2px}'+
      '#rd-maint .s{font-size:13.5px;font-weight:400;color:rgba(255,255,255,.6);margin-top:-10px;line-height:1.5}'+
      '@keyframes rdMaintSpin{to{transform:rotate(360deg)}}'+
      '@media (prefers-reduced-motion:reduce){#rd-maint .h,#rd-maint .m{animation-duration:120s}}';
    document.head.appendChild(st);
    var el=document.createElement('div');
    el.id='rd-maint';
    el.setAttribute('role','alert');
    el.innerHTML=
      '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" aria-hidden="true">'+
        '<circle cx="12" cy="12" r="10"/>'+
        '<line class="h" x1="12" y1="12" x2="12" y2="7.5"/>'+
        '<line class="m" x1="12" y1="12" x2="12" y2="5"/>'+
        '<circle cx="12" cy="12" r=".9" fill="#fff" stroke="none"/>'+
      '</svg>'+
      '<div class="t">estamos en mantenimiento</div>'+
      '<div class="s">mejorando los espacios, ya volvemos.</div>';
    // bloquea toques y scroll hacia la app de abajo
    ['touchstart','touchmove','wheel','click'].forEach(function(ev){
      el.addEventListener(ev,function(e){ e.stopPropagation(); if(ev!=='touchstart') e.preventDefault(); },{passive:false});
    });
    document.body.appendChild(el);
    document.documentElement.style.overflow='hidden';
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ el.classList.add('on'); }); });
  }

  function start(){
    var done=false;
    function go(){ if(done) return; done=true; setTimeout(show,120); }
    // después de la animación de inicio; si el splash no avisa, igual sale a los 4 s
    try{ if(window._rdSplashDone&&window._rdSplashDone.then) window._rdSplashDone.then(go,go); else go(); }catch(e){ go(); }
    setTimeout(go,4000);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start); else start();
})();
