/* ─────────────────────────────────────────────────────────────
   RUEDDA · POPUPS (módulo independiente)
   desktop.html: 1) cookies & privacidad → 2) crear cuenta, esquina inferior derecha.
   index.html (data-mode="mobile"): solo crear cuenta, sube desde abajo.
   Nunca en la app nativa. Crear cuenta sale siempre que no haya sesión.
   Para apagarlos: RD_POPUPS = false.
   ───────────────────────────────────────────────────────────── */
(function(){
  var RD_POPUPS = true;
  if(!RD_POPUPS) return;
  var MOBILE=((document.currentScript&&document.currentScript.getAttribute('data-mode'))==='mobile');
  try{ if(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform()) return; }catch(e){}

  var K_CONSENT='rd_cookie_consent_v1';   // fecha en que se cerró el aviso
  function get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
  function set(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }

  var COPY={
    cookies:{
      title:'Tu privacidad, bajo tu control.',
      body:'Usamos cookies para mantener tu sesión segura, afinar la valoración de mercado y optimizar tu experiencia en Ruedda. Tú decides cuáles activar.',
      accept:'Aceptar todas',
      reject:'Rechazar opcionales',
      policy:'Política de privacidad'
    },
    signup:{
      tag:'gratis',
      title:'Expande tu futuro financiero con activos automotrices.',
      body:'Tu carro es un activo. Conoce su valor real, síguelo en el mercado y conviértelo en liquidez cuando tú decidas.',
      bullets:[
        'Valoración con datos del mercado venezolano, impulsada por FlotaIQ.',
        'Liquidez en días: vende en el market o subasta al mejor postor.',
        'Operaciones con identidad y historial verificados.'
      ],
      cta:'Crear mi cuenta',
      later:'Explorar primero'
    }
  };

  var CSS=
  '.rdp{position:fixed;right:24px;bottom:24px;z-index:260;width:384px;max-width:calc(100vw - 48px);box-sizing:border-box;background:#fff;color:#0b0b0b;border-radius:8px;padding:30px 28px 22px;box-shadow:0 24px 60px rgba(0,0,0,.38),0 2px 8px rgba(0,0,0,.18);font-family:var(--font,-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif);opacity:0;transform:translateY(18px);transition:opacity .5s cubic-bezier(.22,1,.36,1),transform .5s cubic-bezier(.22,1,.36,1);-webkit-font-smoothing:antialiased}'+
  '.rdp.in{opacity:1;transform:none}'+
  '.rdp.out{opacity:0;transform:translateY(12px);transition-duration:.28s}'+
  '.rdp *{box-sizing:border-box}'+
  '.rdp-x{position:absolute;top:16px;right:16px;width:30px;height:30px;border:0;background:none;cursor:pointer;display:flex;align-items:center;justify-content:center;border-radius:6px;color:#111;transition:background .15s}'+
  '.rdp-x:hover{background:#f1f1f1}'+
  '.rdp-x svg{width:16px;height:16px}'+
  '.rdp-tag{display:inline-flex;align-items:center;gap:9px;font-size:9.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#6a6a6a;margin-bottom:14px}'+
  '.rdp-iso{width:19px;height:20px;display:block;flex-shrink:0;color:#0b0b0b}'+
  '.rdp-title{font-size:20px;line-height:1.22;font-weight:800;letter-spacing:-.02em;margin:0 26px 10px 0}'+
  '.rdp-body{font-size:14.5px;line-height:1.55;color:#2b2b2b;margin:0 0 18px}'+
  '.rdp-list{list-style:none;margin:0 0 22px;padding:0;display:flex;flex-direction:column;gap:11px}'+
  '.rdp-list li{display:flex;gap:12px;font-size:14px;line-height:1.45;color:#2b2b2b}'+
  '.rdp-list li:before{content:"";flex:0 0 6px;height:6px;margin-top:7px;background:#0b0b0b}'+
  '.rdp-btn{display:flex;align-items:center;justify-content:center;width:100%;height:50px;border:0;border-radius:6px;background:#0b0b0b;color:#fff;font:inherit;font-size:15px;font-weight:800;letter-spacing:-.01em;cursor:pointer;transition:background .15s,transform .15s}'+
  '.rdp-btn:hover{background:#262626}'+
  '.rdp-btn:active{transform:scale(.985)}'+
  '.rdp-row{display:flex;align-items:center;justify-content:center;gap:22px;margin-top:16px}'+
  '.rdp-link{border:0;background:none;padding:2px 0;font:inherit;font-size:14px;font-weight:800;color:#0b0b0b;text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:1.5px;cursor:pointer}'+
  '.rdp-link.soft{font-weight:600;color:#6a6a6a;text-decoration:none}'+
  '.rdp-link.soft:hover{color:#0b0b0b}'+
  '.rdp-policy{display:block;text-align:center;margin-top:16px;font-size:12px;color:#8a8a8a;text-decoration:none}'+
  '.rdp-policy:hover{color:#0b0b0b;text-decoration:underline}'+
  '.rdp.m{left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));width:auto;max-width:none;padding:26px 22px 18px;border-radius:8px;transform:translateY(calc(100% + 32px));transition:opacity .45s ease,transform .6s cubic-bezier(.22,1,.36,1)}'+
  '.rdp.m.in{transform:none}'+
  '.rdp.m.out{transform:translateY(calc(100% + 32px));opacity:1;transition-duration:.35s}'+
  '.rdp.m .rdp-title{font-size:19px}'+
  '.rdp.m .rdp-list{margin-bottom:20px;gap:9px}'+
  '@media (prefers-reduced-motion:reduce){.rdp{transition-duration:.01s}}';

  function injectCss(){
    if(document.getElementById('rdp-css')) return;
    var st=document.createElement('style'); st.id='rdp-css'; st.textContent=CSS; document.head.appendChild(st);
  }
  var X='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  function esc(s){ return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }

  function mount(html,label){
    injectCss();
    var el=document.createElement('div');
    el.className='rdp'+(MOBILE?' m':''); el.setAttribute('role','dialog'); el.setAttribute('aria-label',label);
    el.innerHTML=html;
    document.body.appendChild(el);
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ el.classList.add('in'); }); });
    return el;
  }
  function unmount(el,cb){
    if(!el||el._gone) return; el._gone=true;
    if(el._stopFlag) try{ el._stopFlag(); }catch(e){}
    el.classList.remove('in'); el.classList.add('out');
    setTimeout(function(){ if(el.parentNode) el.parentNode.removeChild(el); if(cb) cb(); },300);
  }

  // ── 1) cookies (estético: solo informa y recuerda que ya se vio) ──
  function showCookies(next){
    var c=COPY.cookies;
    var el=mount(
      '<button class="rdp-x" aria-label="cerrar">'+X+'</button>'+
      '<div class="rdp-title">'+esc(c.title)+'</div>'+
      '<p class="rdp-body">'+esc(c.body)+'</p>'+
      '<button class="rdp-btn" data-a="accept">'+esc(c.accept)+'</button>'+
      '<div class="rdp-row"><button class="rdp-link" data-a="reject">'+esc(c.reject)+'</button></div>'+
      '<a class="rdp-policy" href="/ruedda_legal.html" target="_blank" rel="noopener">'+esc(c.policy)+'</a>',
      'cookies y privacidad');
    el.addEventListener('click',function(e){
      var b=e.target.closest('[data-a],.rdp-x'); if(!b) return;
      set(K_CONSENT,String(Date.now()));
      unmount(el,next);
    });
  }

  // ── 2) crear cuenta (solo visitantes) ──────────────────────
  function guest(){ try{ return typeof isGuest==='function'&&isGuest(); }catch(e){ return false; } }
  function authOpen(){ var a=document.querySelector('.auth-sheet.open,#auth-sheet.open,#auth-modal.open'); return !!a; }
  function showSignup(){
    // sale en cada carga mientras no haya sesión iniciada
    if(!guest()||authOpen()) return;
    var c=COPY.signup;
    var el=mount(
      '<button class="rdp-x" aria-label="cerrar">'+X+'</button>'+
      '<div class="rdp-tag"><span class="rdp-iso" aria-hidden="true"></span>'+esc(c.tag)+'</div>'+
      '<div class="rdp-title">'+esc(c.title)+'</div>'+
      '<p class="rdp-body">'+esc(c.body)+'</p>'+
      '<ul class="rdp-list">'+c.bullets.map(function(b){ return '<li>'+esc(b)+'</li>'; }).join('')+'</ul>'+
      '<button class="rdp-btn" data-a="cta">'+esc(c.cta)+'</button>'+
      '<div class="rdp-row"><button class="rdp-link soft" data-a="later">'+esc(c.later)+'</button></div>',
      'crear cuenta');
    // isotipo real: la misma bandera ondeando de la intro (_rdWaveFlag, ~30fps, se detiene al cerrar)
    try{ if(typeof _rdWaveFlag==='function') el._stopFlag=_rdWaveFlag(el.querySelector('.rdp-iso')); }catch(e){}
    // si inicia sesión mientras está abierto, se retira solo
    var iv=setInterval(function(){ if(!guest()){ clearInterval(iv); unmount(el); } },1500);
    el.addEventListener('click',function(e){
      var b=e.target.closest('[data-a],.rdp-x'); if(!b) return;
      clearInterval(iv);
      if(b.getAttribute('data-a')==='cta'){
        unmount(el);
        try{ if(typeof showLandingAuth==='function') showLandingAuth('register'); }catch(err){}
      } else unmount(el);
    });
  }

  // ── secuencia: después del splash → cookies → cuenta ───────
  function start(){
    var fired=false;
    function go(){
      if(fired) return; fired=true;
      if(MOBILE) return void setTimeout(showSignup,6000);
      if(!get(K_CONSENT)) setTimeout(function(){ showCookies(function(){ setTimeout(showSignup,2200); }); },1200);
      else setTimeout(showSignup,6000);
    }
    try{ if(window._rdSplashDone&&window._rdSplashDone.then) window._rdSplashDone.then(go,go); else go(); }catch(e){ go(); }
    setTimeout(go,5000);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start); else start();
})();
