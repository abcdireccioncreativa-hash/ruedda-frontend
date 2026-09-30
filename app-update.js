/* ─────────────────────────────────────────────────────────────
   RUEDDA · AVISO DE ACTUALIZACIÓN (app iOS 1.4 o anterior)
   Solo se descarga en la app vieja (index.html lo carga si es iOS nativo y
   no trae __RD_NATIVE_SPLASH, que existe desde la 1.5). Sale una sola vez.
   Mismo lenguaje visual que desktop-popups.js.
   ───────────────────────────────────────────────────────────── */
(function(){
  var KEY='rd_upd_15', APP_ID='6812039590';
  try{ if(localStorage.getItem(KEY)) return; }catch(e){ return; }

  var NEW=[
    ['<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>','Nueva intro nativa, fluida a 120 Hz.'],
    ['<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>','Fotos más rápidas y nítidas en toda la app.'],
    ['<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5l-5.3 2.9 1.2-6-4.5-4.1 6-.7z"/>','Perfiles con reseñas y calificación.'],
    ['<path d="M4 5h16v11H9l-5 4z"/>','Chat global mejorado: fotos, perfiles y búsqueda de usuarios.'],
    ['<path d="M3 9l1.5-5h15L21 9M4 9v11h16V9M3 9h18M9 20v-6h6v6"/>','Programa Fundadores para concesionarios.'],
    ['<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>','Correcciones y mejoras de rendimiento.']
  ];

  var CSS=
  '.rdu-bd{position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,.5);opacity:0;transition:opacity .4s ease}'+
  '.rdu-bd.on{opacity:1}'+
  '.rdu{position:fixed;left:50%;top:50%;z-index:10051;width:min(400px,calc(100vw - 32px));max-height:calc(100dvh - 40px);overflow:auto;box-sizing:border-box;background:#fff;color:#0b0b0b;border-radius:8px;padding:26px 22px 18px;box-shadow:0 24px 60px rgba(0,0,0,.38),0 2px 8px rgba(0,0,0,.18);font-family:var(--font,-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif);opacity:0;transform:translate(-50%,-46%) scale(.97);transition:opacity .45s cubic-bezier(.22,1,.36,1),transform .45s cubic-bezier(.22,1,.36,1)}'+
  '.rdu.in{opacity:1;transform:translate(-50%,-50%)}'+
  '.rdu.out{opacity:0;transform:translate(-50%,-48%) scale(.98);transition-duration:.28s}'+
  '.rdu *{box-sizing:border-box}'+
  '.rdu-x{position:absolute;top:16px;right:16px;width:30px;height:30px;border:0;background:none;display:flex;align-items:center;justify-content:center;border-radius:6px;color:#111}'+
  '.rdu-x svg{width:16px;height:16px}'+
  '.rdu-tag{display:flex;align-items:center;gap:9px;font-size:9.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#6a6a6a;margin-bottom:14px}'+
  '.rdu-tag img{width:20px;height:23px;display:block}'+
  '.rdu-title{font-size:19px;line-height:1.22;font-weight:800;letter-spacing:-.02em;margin:0 26px 10px 0}'+
  '.rdu-body{font-size:14.5px;line-height:1.55;color:#2b2b2b;margin:0 0 18px}'+
  '.rdu-il{list-style:none;margin:0 0 20px;padding:0;display:flex;flex-direction:column;gap:11px}'+
  '.rdu-il li{display:flex;gap:12px;align-items:center;font-size:14px;line-height:1.4;color:#2b2b2b}'+
  '.rdu-il i{flex:0 0 30px;height:30px;border-radius:6px;background:#f4f4f5;display:flex;align-items:center;justify-content:center;color:#0b0b0b}'+
  '.rdu-il svg{width:15px;height:15px;display:block}'+
  '.rdu-btn{display:flex;align-items:center;justify-content:center;width:100%;height:50px;border:0;border-radius:6px;background:#0b0b0b;color:#fff;font:inherit;font-size:15px;font-weight:800;letter-spacing:-.01em;transition:transform .15s}'+
  '.rdu-btn:active{transform:scale(.985)}'+
  '.rdu-row{display:flex;justify-content:center;margin-top:16px}'+
  '.rdu-link{border:0;background:none;padding:2px 0;font:inherit;font-size:14px;font-weight:600;color:#6a6a6a}'+
  '@media (prefers-reduced-motion:reduce){.rdu,.rdu-bd{transition-duration:.01s}}';

  function vis(id){ var e=document.getElementById(id); return !!(e&&e.getClientRects().length&&getComputedStyle(e).display!=='none'); }
  function busy(){
    return vis('rd-intro')||vis('boot-splash')||vis('login-splash')||
      !!document.querySelector('.auth-sheet.open,#auth-sheet.open,#auth-modal.open,.modal-overlay.open,.rdp.in');
  }

  function show(){
    try{ localStorage.setItem(KEY,String(Date.now())); }catch(e){}   // una sola vez
    var st=document.createElement('style'); st.textContent=CSS; document.head.appendChild(st);
    var ic=function(p){ return '<i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+p+'</svg></i>'; };
    var bd=document.createElement('div'); bd.className='rdu-bd';
    var el=document.createElement('div'); el.className='rdu'; el.setAttribute('role','dialog'); el.setAttribute('aria-label','actualiza Ruedda');
    el.innerHTML=
      '<button class="rdu-x" aria-label="cerrar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>'+
      '<div class="rdu-tag"><img src="/assets/ruedda-iso-negro.png" alt="">versión 1.5</div>'+
      '<div class="rdu-title">Ruedda se renovó. Actualiza tu app.</div>'+
      '<p class="rdu-body">Estás usando una versión anterior. Actualiza para tener la experiencia completa, más rápida y más fluida.</p>'+
      '<ul class="rdu-il">'+NEW.map(function(n){ return '<li>'+ic(n[0])+'<span>'+n[1]+'</span></li>'; }).join('')+'</ul>'+
      '<button class="rdu-btn" data-a="update">Actualizar ahora</button>'+
      '<div class="rdu-row"><button class="rdu-link" data-a="later">Más tarde</button></div>';
    document.body.appendChild(bd); document.body.appendChild(el);
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ bd.classList.add('on'); el.classList.add('in'); }); });
    function close(){
      bd.classList.remove('on'); el.classList.remove('in'); el.classList.add('out');
      setTimeout(function(){ bd.remove(); el.remove(); st.remove(); },400);
    }
    bd.addEventListener('click',close);
    el.addEventListener('click',function(e){
      var b=e.target.closest('[data-a],.rdu-x'); if(!b) return;
      if(b.getAttribute('data-a')==='update'){
        try{ var H=window._rdCapPlugin&&window._rdCapPlugin('Haptics'); H&&H.impact({style:'LIGHT'}); }catch(err){}
        // igual que "calificar en App Store": en la app nativa, window.open con itms-apps
        window.open('itms-apps://apps.apple.com/app/id'+APP_ID,'_blank');
      }
      close();
    });
  }

  // espera a que la app esté a la vista (sin splash, intro, login ni modales)
  var tries=0;
  (function wait(){
    if(++tries>120) return;
    if(busy()) return void setTimeout(wait,1000);
    setTimeout(function(){ if(busy()) return void setTimeout(wait,1000); show(); },1400);
  })();
})();
