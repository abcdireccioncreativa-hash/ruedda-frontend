/* ─────────────────────────────────────────────────────────────
   RUEDDA · POPUPS (módulo independiente)
   desktop.html: 1) cookies & privacidad → 2) crear cuenta, esquina inferior derecha.
   index.html (data-mode="mobile", app y web móvil): solo crear cuenta, centrado.
   Crear cuenta sale siempre que no haya sesión.
   Para apagarlos: RD_POPUPS = false.
   ───────────────────────────────────────────────────────────── */
(function(){
  var RD_POPUPS = true;
  if(!RD_POPUPS) return;
  var MOBILE=((document.currentScript&&document.currentScript.getAttribute('data-mode'))==='mobile');

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
      tag:'',
      title:'Expande tu futuro financiero con activos automotrices.',
      body:'Tu carro es un activo. Conoce su valor real, síguelo en el mercado y conviértelo en liquidez cuando tú decidas.',
      bullets:[
        'Valoración con datos del mercado venezolano, impulsada por FlotaIQ.',
        'Liquidez en días: vende en el market o subasta al mejor postor.',
        'Operaciones con identidad y historial verificados.'
      ],
      cta:'Crear mi cuenta',
      later:'Explorar primero',
      tourBtn:'beneficios'
    },
    // mini tour de beneficios (solo lo que YA existe en Ruedda)
    tour:[
      {tag:'subastas', title:'Subastas en tiempo real.',
       body:'Vende al mejor postor o gana el carro que buscas, oferta a oferta.',
       bullets:['Pujas en vivo con cuenta regresiva e historial transparente.',
                'Precio de reserva: tu carro no se va por menos de lo que vale.',
                'Subastas de deportivos, clásicos, comerciales y chocados.']},
      {tag:'market', title:'Compra y vende con datos, no con suposiciones.',
       body:'Cada publicación se compara con el mercado para que sepas si es buen negocio.',
       bullets:['Precio Justo: súper oferta, buen precio o por encima del mercado.',
                'Hot deals con rebajas reales, ordenadas por descuento.',
                'Vendedores y concesionarios con identidad verificada.']},
      {tag:'niveles', title:'Cada operación te sube de nivel.',
       body:'Gana XP comprando, vendiendo, subastando y participando. 16 niveles, de novato a leyenda eterna.',
       bullets:['Hasta 10 publicaciones gratis al mes según tu nivel.',
                'Premios reales: franela oficial, sesión de fotos, detailing y entrada VIP a eventos.',
                'Tu insignia de nivel visible en tu perfil y en la comunidad.']},
      {tag:'comunidad', title:'La comunidad car enthusiast de Venezuela.',
       body:'Más que un marketplace: el lugar de los que viven los carros.',
       bullets:['Carspotting, historias y el chat global del mercado.',
                'Tu garage digital, con el historial de dueños de cada carro.',
                'Sigue, califica y conecta con compradores y vendedores.']},
      {tag:'petrolheads', title:'Herramientas hechas para petrolheads.',
       body:'Todo lo que un fanático necesita, en la misma app.',
       bullets:['Scanner OBD2 para diagnosticar tu carro.',
                'Medidor de decibeles de escape, by STXX.',
                'Verificación de placa y VIN, fotógrafos y store oficial.']}
    ]
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
  '.rdp-iso{position:relative;width:20px;height:23px;display:block;flex-shrink:0}'+
  '.rdp-iso img{position:absolute;inset:0;width:100%;height:100%;animation:rdpIsoWave .7s ease-in-out infinite alternate;will-change:transform}'+
  '@keyframes rdpIsoWave{from{transform:translateY(-5%)}to{transform:translateY(5%)}}'+
  '.rdp.m .rdp-iso img{animation:none}'+  // móvil/app: isotipo quieto; ondea solo en desktop
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
  '.rdp-bd{position:fixed;inset:0;z-index:259;background:rgba(0,0,0,.5);opacity:0;transition:opacity .4s ease}'+
  '.rdp-bd.on{opacity:1}'+
  '.rdp.m{left:50%;top:50%;right:auto;bottom:auto;width:min(400px,calc(100vw - 32px));max-height:calc(100vh - 40px);max-height:calc(100dvh - 40px);overflow:auto;padding:26px 22px 18px;transform:translate(-50%,-46%) scale(.97)}'+
  '.rdp.m.in{transform:translate(-50%,-50%)}'+
  '.rdp.m.out{transform:translate(-50%,-48%) scale(.98)}'+
  '.rdp.m .rdp-title{font-size:19px}'+
  '.rdp.m .rdp-list{margin-bottom:20px;gap:9px}'+
  '.rdp-il{list-style:none;margin:0 0 20px;padding:0;display:flex;flex-direction:column;gap:11px}'+
  '.rdp-il li{display:flex;gap:12px;align-items:center;font-size:14px;line-height:1.4;color:#2b2b2b}'+
  '.rdp-il i{flex:0 0 30px;height:30px;border-radius:6px;background:#f4f4f5;display:flex;align-items:center;justify-content:center;color:#0b0b0b;font-style:normal}'+
  '.rdp-il svg{width:15px;height:15px;display:block}'+
  '.rdp-soon{display:inline-block;margin-left:8px;font-size:9px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;background:#0b0b0b;color:#e6f03b;padding:2px 6px;border-radius:3px;vertical-align:1px}'+
  '.rdp-in{width:100%;height:46px;border:1px solid #e3e3e3;border-radius:6px;background:#fff;color:#0b0b0b;padding:0 14px;font:inherit;font-size:16px;outline:none;margin-bottom:10px;transition:border-color .15s}'+
  '.rdp-in:focus{border-color:#0b0b0b}'+
  '.rdp-lbl{display:block;font-size:11.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#6a6a6a;margin:4px 0 6px}'+
  '.rdp-ok{display:flex;flex-direction:column;align-items:center;text-align:center;padding:10px 4px 6px}'+
  '.rdp-ok .e{font-size:40px;line-height:1;margin-bottom:12px}'+
  '.rdp-slide{transition:opacity .22s ease,transform .22s cubic-bezier(.22,1,.36,1)}'+
  '.rdp-slide.go-l{opacity:0;transform:translateX(-14px)}'+
  '.rdp-slide.go-r{opacity:0;transform:translateX(14px)}'+
  '.rdp-nav{display:none;align-items:center;justify-content:space-between;margin:-4px 0 16px}'+
  '.rdp.tour .rdp-nav{display:flex}'+
  '.rdp-dots{display:flex;gap:6px;align-items:center}'+
  '.rdp-dots i{width:6px;height:6px;background:#d6d6d6;display:block;transition:width .3s cubic-bezier(.22,1,.36,1),background .3s}'+
  '.rdp-dots i.on{width:18px;background:#0b0b0b}'+
  '.rdp-arr{display:flex;gap:8px}'+
  '.rdp-arr button{width:36px;height:36px;border:1px solid #e3e3e3;border-radius:6px;background:#fff;color:#0b0b0b;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .15s,border-color .15s,opacity .15s}'+
  '.rdp-arr button:hover{background:#f4f4f4;border-color:#cfcfcf}'+
  '.rdp-arr button[disabled]{opacity:.3;cursor:default;background:#fff}'+
  '.rdp-arr svg{width:16px;height:16px}'+
  '.rdp-tagt:empty{display:none}'+
  '.rdp-tb{border:0;background:none;padding:0;margin-left:4px;font:inherit;font-size:12.5px;font-weight:400;line-height:1.4;letter-spacing:0;color:#2b2b2b;text-transform:none;text-decoration:none;cursor:pointer;display:inline-flex;align-items:center;gap:2px;transition:color .15s}'+
  '.rdp-tb svg{width:11px;height:11px;display:block;transition:transform .25s cubic-bezier(.22,1,.36,1)}'+
  '.rdp-tb:hover svg{transform:translateX(2px)}'+
  '.rdp-tb:hover{color:#0b0b0b}'+
  '.rdp.tour [data-a="tour"]{display:none}'+
  '.rdp.b{left:12px;right:12px;top:auto;bottom:calc(92px + env(safe-area-inset-bottom));width:auto;max-width:none;padding:24px 22px 16px;transform:translateY(28px)}'+
  '.rdp.b.in{transform:none}'+
  '.rdp.b.out{transform:translateY(20px)}'+
  '.rdp.b .rdp-iso img{animation:none}'+
  '.rdp.b .rdp-title{font-size:19px}'+
  '.rdp-sub{font-size:12.5px;line-height:1.5;color:#6a6a6a;margin:-8px 0 18px;padding-top:12px;border-top:1px solid #efefef}'+
  '@media (prefers-reduced-motion:reduce){.rdp{transition-duration:.01s}.rdp-iso img{animation:none}.rdp-slide{transition:none}}';

  function injectCss(){
    if(document.getElementById('rdp-css')) return;
    var st=document.createElement('style'); st.id='rdp-css'; st.textContent=CSS; document.head.appendChild(st);
  }
  var X='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  function esc(s){ return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }

  // isotipo real del splash de inicio (misma imagen), ondeando en franjas como el splash.
  // Solo CSS (transform en el compositor): cero JavaScript por frame.
  function isoFill(box){
    if(!box) return; var N=12,OV=2,P=1.4,h='';
    for(var i=0;i<N;i++){
      var u=(i+OV/2)/N, l=i/N*100, r=Math.max(0,(1-(i+OV)/N)*100);
      h+='<img src="/assets/ruedda-iso-negro.png" alt="" style="clip-path:inset(-14% '+r+'% -14% '+l+'%);animation-delay:-'+(u*2.6/(2*Math.PI)*P).toFixed(3)+'s">';
    }
    box.innerHTML=h;
  }
  function mount(html,label,opt){
    injectCss();
    var el=document.createElement('div');
    opt=opt||{};
    el.className='rdp'+(opt.bottom?(MOBILE?' b':''):((MOBILE||opt.center)?' m':''))+(opt.cls?' '+opt.cls:''); el.setAttribute('role','dialog'); el.setAttribute('aria-label',label);
    el.innerHTML=html;
    if((MOBILE||opt.center)&&!opt.bottom){
      var bd=document.createElement('div'); bd.className='rdp-bd';
      bd.addEventListener('click',function(){ var x=el.querySelector('.rdp-x'); if(x) x.click(); });
      document.body.appendChild(bd); el._bd=bd;
    }
    document.body.appendChild(el);
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ el.classList.add('in'); if(el._bd) el._bd.classList.add('on'); }); });
    return el;
  }
  function unmount(el,cb){
    if(!el||el._gone) return; el._gone=true;
    if(el._bd){ var bd=el._bd; bd.classList.remove('on'); setTimeout(function(){ if(bd.parentNode) bd.parentNode.removeChild(bd); },400); }
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
  function vis(id){ var e=document.getElementById(id); return !!(e&&e.getClientRects().length&&getComputedStyle(e).display!=='none'); }
  function busy(){ return authOpen()||vis('rd-intro')||vis('boot-splash')||vis('login-splash')||!!document.querySelector('.modal-overlay.open'); }
  var waits=0;
  function showSignup(){
    // sale en cada carga mientras no haya sesión iniciada
    if(!guest()) return;
    if(busy()){ if(++waits<60) setTimeout(showSignup,2000); return; }
    var c=COPY.signup, T=COPY.tour;
    var slides=[{tag:c.tag,title:c.title,body:c.body,bullets:c.bullets}].concat(T);
    var CH_L='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>';
    var CH_R='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';
    function slideHtml(sl){
      return '<div class="rdp-title">'+esc(sl.title)+'</div>'+
        '<p class="rdp-body">'+esc(sl.body)+'</p>'+
        '<ul class="rdp-list">'+sl.bullets.map(function(b){ return '<li>'+esc(b)+'</li>'; }).join('')+'</ul>';
    }
    var el=mount(
      '<button class="rdp-x" aria-label="cerrar">'+X+'</button>'+
      '<div class="rdp-tag"><span class="rdp-iso" aria-hidden="true"></span><span class="rdp-tagt">'+esc(c.tag)+'</span><button class="rdp-tb" data-a="tour">'+esc(c.tourBtn)+'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button></div>'+
      '<div class="rdp-slide" aria-live="polite">'+slideHtml(slides[0])+'</div>'+
      '<div class="rdp-nav"><div class="rdp-dots">'+slides.map(function(_,k){ return '<i'+(k===0?' class="on"':'')+'></i>'; }).join('')+'</div>'+
        '<div class="rdp-arr"><button data-a="prev" aria-label="anterior">'+CH_L+'</button><button data-a="next" aria-label="siguiente">'+CH_R+'</button></div></div>'+
      '<button class="rdp-btn" data-a="cta">'+esc(c.cta)+'</button>'+
      '<div class="rdp-row"><button class="rdp-link soft" data-a="later">'+esc(c.later)+'</button></div>',
      'crear cuenta');
    isoFill(el.querySelector('.rdp-iso'));
    if(!MOBILE) showQR(el);
    // ── mini tour: cambia el contenido dentro del mismo popup ──
    var cur=0, busyAnim=false, box=el.querySelector('.rdp-slide'), tagt=el.querySelector('.rdp-tagt');
    var dots=el.querySelectorAll('.rdp-dots i'), prev=el.querySelector('[data-a="prev"]'), next=el.querySelector('[data-a="next"]');
    function paintNav(){
      for(var k=0;k<dots.length;k++) dots[k].className=k===cur?'on':'';
      prev.disabled=cur===0; next.disabled=cur===slides.length-1;
    }
    function go(n){
      if(busyAnim||n<0||n>=slides.length||n===cur) return;
      var dir=n>cur?'go-l':'go-r', back=n>cur?'go-r':'go-l';
      busyAnim=true;
      box.style.minHeight=Math.max(box.offsetHeight,parseFloat(box.style.minHeight)||0)+'px'; // no brinca de alto
      box.classList.add(dir);
      setTimeout(function(){
        cur=n; box.innerHTML=slideHtml(slides[n]); tagt.textContent=slides[n].tag;
        box.classList.remove(dir); box.classList.add(back);
        void box.offsetWidth;
        box.classList.remove(back);
        paintNav(); busyAnim=false;
      },200);
    }
    function onKey(e){ if(!el.classList.contains('tour')) return; if(e.key==='ArrowRight') go(cur+1); else if(e.key==='ArrowLeft') go(cur-1); }
    document.addEventListener('keydown',onKey);
    // deslizar con el dedo (móvil)
    var sx=null;
    box.addEventListener('touchstart',function(e){ sx=e.touches[0].clientX; },{passive:true});
    box.addEventListener('touchend',function(e){ if(sx==null||!el.classList.contains('tour')) return; var dx=e.changedTouches[0].clientX-sx; sx=null; if(Math.abs(dx)>40) go(cur+(dx<0?1:-1)); },{passive:true});
    function close(){ clearInterval(iv); document.removeEventListener('keydown',onKey); unmount(el); }
    // si inicia sesión mientras está abierto, se retira solo
    var iv=setInterval(function(){ if(!guest()) close(); },1500);
    el.addEventListener('click',function(e){
      var b=e.target.closest('[data-a],.rdp-x'); if(!b) return;
      var a=b.getAttribute('data-a');
      if(a==='tour'){ el.classList.add('tour'); paintNav(); go(1); return; }
      if(a==='next') return go(cur+1);
      if(a==='prev') return go(cur-1);
      close();
      if(a==='cta'){ try{ if(typeof showLandingAuth==='function') showLandingAuth('register'); }catch(err){} }
    });
  }



  // ── 3) vehículo guardado en favoritos (se llama desde el botón de guardar) ──
  var savedEl=null, savedT=null;
  window.rdSavedPopup=function(){
    try{
      if(document.querySelector('.rdp:not(.b):not(.out)')) return false; // no encima de otro popup
      if(savedEl){ clearTimeout(savedT); unmount(savedEl); savedEl=null; }
      var el=mount(
        '<button class="rdp-x" aria-label="cerrar">'+X+'</button>'+
        '<div class="rdp-tag"><span class="rdp-iso" aria-hidden="true"></span><span class="rdp-tagt">guardado</span></div>'+
        '<div class="rdp-title">Tu vehículo está guardado.</div>'+
        '<p class="rdp-body">Encuéntralo cuando quieras en el ícono de corazón'+(MOBILE?' de la barra de abajo.':' del menú.')+'</p>'+
        '<p class="rdp-sub">Esa sección es también la comunidad de Ruedda: clips, historias y lo que comparten los petrolheads de Venezuela.</p>'+
        '<button class="rdp-btn" data-a="fav">Ver mis favoritos</button>'+
        '<div class="rdp-row"><button class="rdp-link soft" data-a="later">Seguir explorando</button></div>',
        'vehículo guardado',{bottom:true});
      isoFill(el.querySelector('.rdp-iso'));
      savedEl=el;
      var close=function(){ clearTimeout(savedT); unmount(el); if(savedEl===el) savedEl=null; };
      var arm=function(){ clearTimeout(savedT); savedT=setTimeout(close,6500); };
      arm();
      el.addEventListener('pointerdown',function(){ clearTimeout(savedT); },{passive:true});
      el.addEventListener('mouseenter',function(){ clearTimeout(savedT); });
      el.addEventListener('mouseleave',arm);
      el.addEventListener('click',function(e){
        var b=e.target.closest('[data-a],.rdp-x'); if(!b) return;
        close();
        if(b.getAttribute('data-a')==='fav'){ try{ if(typeof showView==='function') showView('favoritos'); }catch(err){} }
      });
      return true;
    }catch(e){ return false; }
  };


  // ── 4) Ruedda Partners · vitrina para concesionarios (botón "partners" del market) ──
  // Mismo lenguaje que el tour de beneficios: páginas con puntos y flechas, mismo tamaño
  // que el popup del market, íconos de línea en vez de viñetas.
  var PI={
    flag:'<path d="M4 21V4M4 4h11l-1.5 3.5L15 11H4"/>',
    kit:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 17.5h7M17.5 14v7"/>',
    seal:'<path d="M12 2.5l2.2 1.6 2.7-.2.9 2.6 2.3 1.5-.8 2.6.8 2.6-2.3 1.5-.9 2.6-2.7-.2L12 19l-2.2-1.6-2.7.2-.9-2.6-2.3-1.5.8-2.6-.8-2.6 2.3-1.5.9-2.6 2.7.2z"/><path d="m8.8 10.8 2.2 2.2 4.2-4.4"/>',
    store:'<path d="M3 9.5 4.5 4h15L21 9.5M3 9.5h18M3 9.5V20h18V9.5"/><path d="M9.5 20v-5.5h5V20"/>',
    grid:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10"/>',
    up:'<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    check:'<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="m9 12 2 2 4-4"/>',
    msg:'<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    lock:'<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
    doc:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
    users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 20a6.5 6.5 0 0 0-3-5.5"/>',
    cam:'<path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.8l1.4-2h6.6l1.4 2h2.8A1.5 1.5 0 0 1 21 8.5v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/><circle cx="12" cy="13" r="3.5"/>',
    cal:'<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>'
  };
  var pico=function(k){ return '<i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+PI[k]+'</svg></i>'; };
  var PT=[
    {tag:'ruedda partners', title:'Tu concesionario, en la vitrina de Venezuela.',
     body:'Ventas digitales con compradores activos todos los días y la marca Ruedda detrás.',
     items:[['store','Vitrina propia con tu marca e inventario.'],['up','Prioridad frente a compradores con intención real.'],['check','Sello de concesionario verificado.']]},
    {tag:'programa fundadores', title:'10 cupos para los primeros.',
     body:'Los primeros 10 concesionarios entran con condiciones de lanzamiento.',
     items:[['flag','1 mes de prueba, sin compromiso.'],['kit','Brand kit profesional para tu vitrina.'],['seal','Sello de fundador visible en tu perfil.']]},
    {tag:'promoción de lanzamiento', title:'3 meses por el precio de 2.',
     body:'Suscríbete por un trimestre y el tercer mes corre por cuenta de Ruedda.',
     items:[['cal','Suscripción trimestral: pagas 2, recibes 3.'],['flag','Promoción vigente durante los primeros 12 meses.'],['store','Tu vitrina activa, sin interrupciones.']]},
    {tag:'vitrina', title:'Tu marca, tu inventario.',
     body:'Un perfil propio donde tus vehículos se ven como tu marca merece.',
     items:[['store','Logo, portada y contacto en un solo lugar.'],['grid','Inventario completo y siempre actualizado.'],['eye','Vistas y favoritos de cada publicación.']]},
    {tag:'confianza', title:'Confianza que vende.',
     body:'Cada operación con identidad verificada y la marca Ruedda detrás.',
     items:[['check','Sello verificado en cada publicación.'],['msg','Contacto directo por WhatsApp y mensajes.'],['up','Destacados en los resultados de búsqueda.']]},
    {tag:'exclusivo · pronto', title:'Pagos a tus proveedores en el exterior.',
     body:'Paga facturas internacionales desde la app. Solo para concesionarios suscritos.',
     items:[['globe','Proveedores fuera de Venezuela.'],['doc','Facturas pagadas desde Ruedda.'],['lock','Exclusivo para concesionarios suscritos.']]},
    {tag:'acompañamiento', title:'Un equipo contigo.',
     body:'Te ayudamos a publicar, vender y crecer dentro de Ruedda.',
     items:[['users','Acompañamiento para activar tu vitrina.'],['cam','Fotógrafos de la red Ruedda.'],['cal','Presencia en eventos de la comunidad.']]}
  ];
  function ptSlide(pg){
    return '<div class="rdp-title">'+esc(pg.title)+'</div><p class="rdp-body">'+esc(pg.body)+'</p>'+
      '<ul class="rdp-il">'+pg.items.map(function(it){ return '<li>'+pico(it[0])+'<span>'+esc(it[1])+'</span></li>'; }).join('')+'</ul>';
  }
  var ptEl=null;
  window.rdPartnersPopup=function(){
    try{
      if(ptEl){ unmount(ptEl); ptEl=null; }
      var CH_L='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>';
      var CH_R='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';
      var el=mount(
        '<button class="rdp-x" aria-label="cerrar">'+X+'</button>'+
        '<div class="rdp-tag"><span class="rdp-iso" aria-hidden="true"></span><span class="rdp-tagt">'+esc(PT[0].tag)+'</span></div>'+
        '<div class="rdp-slide" id="rdp-pt" aria-live="polite">'+ptSlide(PT[0])+'</div>'+
        '<div class="rdp-nav" id="rdp-pt-nav"><div class="rdp-dots">'+PT.map(function(_,k){ return '<i'+(k===0?' class="on"':'')+'></i>'; }).join('')+'</div>'+
          '<div class="rdp-arr"><button data-a="prev" aria-label="anterior">'+CH_L+'</button><button data-a="next" aria-label="siguiente">'+CH_R+'</button></div></div>'+
        '<button class="rdp-btn" data-a="form" id="rdp-pt-cta">Solicitar vitrina</button>'+
        '<div class="rdp-row" id="rdp-pt-row"><button class="rdp-link soft" data-a="later">Ahora no</button></div>',
        'ruedda partners',{center:true,cls:'tour pt'});
      ptEl=el; isoFill(el.querySelector('.rdp-iso'));
      var box=el.querySelector('#rdp-pt'), tagt=el.querySelector('.rdp-tagt'), nav=el.querySelector('#rdp-pt-nav'), cta=el.querySelector('#rdp-pt-cta'), row=el.querySelector('#rdp-pt-row');
      var dots=el.querySelectorAll('.rdp-dots i'), prev=el.querySelector('[data-a="prev"]'), next=el.querySelector('[data-a="next"]');
      var cur=0, anim=false, mode='tour';
      // mismo alto en todas las páginas: se mide la más alta una vez
      function measure(){ if(mode!=='tour') return; var keep=box.innerHTML, h=0; box.style.minHeight=''; PT.forEach(function(pg){ box.innerHTML=ptSlide(pg); h=Math.max(h,box.offsetHeight); }); box.innerHTML=keep; box.style.minHeight=h+'px'; }
      measure(); try{ document.fonts&&document.fonts.ready.then(measure); }catch(e){} // se remide con la fuente real ya cargada
      function paintNav(){ for(var k=0;k<dots.length;k++) dots[k].className=k===cur?'on':''; prev.disabled=cur===0; next.disabled=cur===PT.length-1; }
      function swap(html,tag,dir,after){
        if(anim) return; anim=true; var a=dir||'go-l', b=a==='go-l'?'go-r':'go-l';
        box.classList.add(a);
        setTimeout(function(){ box.innerHTML=html; if(tag!=null) tagt.textContent=tag; box.classList.remove(a); box.classList.add(b); void box.offsetWidth; box.classList.remove(b); anim=false; if(after) after(); },200);
      }
      function go(n){ if(mode!=='tour'||n<0||n>=PT.length||n===cur) return; var d=n>cur?'go-l':'go-r'; cur=n; swap(ptSlide(PT[n]),PT[n].tag,d,paintNav); }
      function showForm(){
        mode='form'; nav.style.display='none'; cta.textContent='Enviar solicitud'; cta.setAttribute('data-a','send');
        row.innerHTML='<button class="rdp-link soft" data-a="back">Volver</button>';
        swap('<div class="rdp-title">Cuéntanos de tu concesionario.</div><p class="rdp-body">Nuestro equipo te contacta por WhatsApp para activar tu vitrina.</p>'+
          '<input class="rdp-in" id="rdp-pt-n" autocomplete="organization" placeholder="Concesionario">'+
          '<input class="rdp-in" id="rdp-pt-r" autocomplete="name" placeholder="Representante">'+
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><input class="rdp-in" id="rdp-pt-t" type="tel" inputmode="tel" autocomplete="tel" placeholder="WhatsApp"><input class="rdp-in" id="rdp-pt-c" autocomplete="address-level2" placeholder="Ciudad"></div>','solicitar vitrina','go-l');
      }
      function showTour(){
        mode='tour'; nav.style.display=''; cta.textContent='Solicitar vitrina'; cta.setAttribute('data-a','form'); cta.disabled=false;
        row.innerHTML='<button class="rdp-link soft" data-a="later">Ahora no</button>';
        swap(ptSlide(PT[cur]),PT[cur].tag,'go-r',paintNav);
      }
      function showOk(name){
        mode='ok'; nav.style.display='none'; cta.textContent='Listo'; cta.setAttribute('data-a','later'); cta.disabled=false; row.innerHTML='';
        swap('<div class="rdp-title">Solicitud recibida.</div><p class="rdp-body">Gracias, '+esc(name)+'. Nuestro equipo te contactará por WhatsApp para activar tu vitrina.</p>'+
          '<ul class="rdp-il"><li>'+pico('check')+'<span>Revisamos tus datos.</span></li><li>'+pico('msg')+'<span>Te escribimos por WhatsApp.</span></li><li>'+pico('store')+'<span>Activamos tu vitrina.</span></li></ul>','solicitud enviada','go-l');
      }
      function onKey(e){ if(mode!=='tour') return; if(e.key==='ArrowRight') go(cur+1); else if(e.key==='ArrowLeft') go(cur-1); }
      document.addEventListener('keydown',onKey);
      var sx=null;
      box.addEventListener('touchstart',function(e){ sx=e.touches[0].clientX; },{passive:true});
      box.addEventListener('touchend',function(e){ if(sx==null) return; var dx=e.changedTouches[0].clientX-sx; sx=null; if(Math.abs(dx)>40) go(cur+(dx<0?1:-1)); },{passive:true});
      paintNav();
      el.addEventListener('click',async function(e){
        var b=e.target.closest('[data-a],.rdp-x'); if(!b) return;
        var a=b.getAttribute('data-a');
        if(a==='next') return go(cur+1);
        if(a==='prev') return go(cur-1);
        if(a==='form') return showForm();
        if(a==='back') return showTour();
        if(a==='send'){
          var v=function(id){ var i=el.querySelector('#'+id); return i?i.value.trim():''; };
          var n=v('rdp-pt-n'), r=v('rdp-pt-r'), t=v('rdp-pt-t'), c=v('rdp-pt-c');
          if(!n||!r||!t){ var f=el.querySelector(!n?'#rdp-pt-n':!r?'#rdp-pt-r':'#rdp-pt-t'); if(f){ f.style.borderColor='#d70015'; f.focus(); } return; }
          if(typeof _supa==='undefined'||!_supa) return;
          b.disabled=true; b.textContent='Enviando…';
          var uid=null; try{ if(typeof USER_STATE!=='undefined'&&USER_STATE.id&&!(typeof isGuest==='function'&&isGuest())) uid=USER_STATE.id; }catch(err){}
          var res=await _supa.from('partner_leads').insert({user_id:uid,marca_nombre:n,representante:r,telefono:t,motivo:'Solicitud de vitrina · Programa Fundadores'+(c?' · '+c:'')});
          if(res.error){ b.disabled=false; b.textContent='Enviar solicitud'; try{ showToast('no se pudo enviar, intenta de nuevo'); }catch(err){} return; }
          return showOk(r.split(' ')[0]);
        }
        document.removeEventListener('keydown',onKey); unmount(el); if(ptEl===el) ptEl=null;
      });
      return true;
    }catch(e){ return false; }
  };

  // ── desktop: "prueba Ruedda en tu teléfono" con QR, al lado del de crear cuenta ──
  var QR_CSS='.rdp.rdp-qr{right:calc(24px + 384px + 14px);width:252px;padding:22px 22px 18px;text-align:left}'+
    '.rdp-qr .rdp-title{font-size:17px;margin:0 26px 8px 0}'+
    '.rdp-qr .rdp-body{font-size:13px;line-height:1.5;margin:0 0 14px;color:#4a4a4a}'+
    '.rdp-qr-code{display:block;width:176px;height:176px;margin:0 auto;border-radius:14px;box-shadow:0 0 0 1px #ededed}'+
    '.rdp-qr-foot{display:flex;justify-content:center;gap:12px;margin-top:12px;font-size:10.5px;font-weight:600;color:#8a8a8a;white-space:nowrap}'+
    '.rdp-qr-foot b{color:#0b0b0b;font-weight:700}'+
    '.rdp.rdp-qr.solo{right:24px}'+
    '@media (max-width:1099px),(max-height:620px){.rdp.rdp-qr:not(.solo){display:none}}';
  window.rdShowQR=function(){ if(!document.querySelector('.rdp-qr')) showQR(null); };
  function showQR(signup){
    if(signup&&(window.innerWidth<1100||window.innerHeight<620)) return;
    if(!document.getElementById('rdp-qr-css')){ var st=document.createElement('style'); st.id='rdp-qr-css'; st.textContent=QR_CSS; document.head.appendChild(st); }
    var el=document.createElement('div');
    el.className='rdp rdp-qr'+(signup?'':' solo'); el.setAttribute('role','dialog'); el.setAttribute('aria-label','prueba Ruedda en tu teléfono');
    el.innerHTML='<button class="rdp-x" aria-label="cerrar">'+X+'</button>'+
      '<div class="rdp-tag"><span class="rdp-iso" aria-hidden="true"></span><span class="rdp-tagt">la app</span></div>'+
      '<div class="rdp-title">Prueba Ruedda en tu teléfono.</div>'+
      '<p class="rdp-body">Escanea con la cámara y lleva el market, las subastas y tus chats en el bolsillo.</p>'+
      '<img class="rdp-qr-code" src="/assets/qr-app.svg" alt="QR para descargar Ruedda" width="176" height="176" decoding="async">'+
      '<div class="rdp-qr-foot"><span><b>iPhone</b> · App Store</span><span><b>Android</b> · pronto</span></div>';
    document.body.appendChild(el);
    isoFill(el.querySelector('.rdp-iso'));
    // entra un instante después que el de crear cuenta, como pareja
    setTimeout(function(){ requestAnimationFrame(function(){ el.classList.add('in'); }); },160);
    function out(){ if(el._gone) return; el._gone=true; el.classList.remove('in'); el.classList.add('out'); setTimeout(function(){ if(el.parentNode) el.parentNode.removeChild(el); },300); }
    el.querySelector('.rdp-x').addEventListener('click',out);
    // si se cierra el de crear cuenta, este se va con él
    if(signup) try{ new MutationObserver(function(){ if(!signup.classList.contains('in')||!signup.isConnected) out(); }).observe(signup,{attributes:true,attributeFilter:['class']}); }catch(e){}
  }

  // ── vender: la primera vez que alguien toca "vender" ────────
  var K_SELL='rd_sell_intro_v1';
  var IC={
    price:'<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    shield:'<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
    gavel:'<path d="M14 5l5 5M11 8l5 5M9.5 9.5l5 5M3 21l7.5-7.5"/><path d="M12.5 3.5l8 8-2 2-8-8z"/>',
    reach:'<circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>'
  };
  var SELL={
    tag:'vender en ruedda',
    title:'Publicar es igual de fácil que en la app azul. Vender, aquí es más rápido.',
    body:'Tu carro queda en vitrina en minutos. La diferencia es todo lo que viaja con él: datos, confianza y compradores que sí van en serio.',
    items:[
      [IC.price,'Precio Justo: tu carro frente al mercado venezolano, para que se venda a lo que vale.'],
      [IC.shield,'Compradores verificados y chat privado dentro de Ruedda. Sin números regados.'],
      [IC.gavel,'Precio fijo en el market o subasta en vivo: tú decides cómo vender.'],
      [IC.reach,'Más ojos encima: trending, hot deals y la comunidad car enthusiast.']
    ],
    cta:'Empezar a publicar', later:'Ahora no'
  };
  function showSell(cb){
    var s=SELL, ic=function(p){ return '<i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+p+'</svg></i>'; };
    var el=mount(
      '<button class="rdp-x" aria-label="cerrar">'+X+'</button>'+
      '<div class="rdp-tag"><span class="rdp-iso" aria-hidden="true"></span><span class="rdp-tagt">'+esc(s.tag)+'</span></div>'+
      '<div class="rdp-title">'+esc(s.title)+'</div>'+
      '<p class="rdp-body">'+esc(s.body)+'</p>'+
      '<ul class="rdp-il">'+s.items.map(function(it){ return '<li>'+ic(it[0])+'<span>'+esc(it[1])+'</span></li>'; }).join('')+'</ul>'+
      '<button class="rdp-btn" data-a="go">'+esc(s.cta)+'</button>'+
      '<div class="rdp-row"><button class="rdp-link soft" data-a="later">'+esc(s.later)+'</button></div>',
      'vender en ruedda',{center:true});
    isoFill(el.querySelector('.rdp-iso'));
    function onKey(e){ if(e.key==='Escape'){ var x=el.querySelector('.rdp-x'); if(x) x.click(); } }
    document.addEventListener('keydown',onKey);
    el.addEventListener('click',function(e){
      var b=e.target.closest('[data-a],.rdp-x'); if(!b) return;
      var go=b.getAttribute('data-a')==='go';
      document.removeEventListener('keydown',onKey);
      unmount(el,function(){ cb(go); });
    });
  }
  function hookSell(){
    var orig=window.openVenderModal;
    if(typeof orig!=='function'||orig._rdSell) return;
    var w=function(){
      var self=this,args=arguments;
      if(get(K_SELL)) return orig.apply(self,args);
      set(K_SELL,String(Date.now()));
      showSell(function(go){ if(go) orig.apply(self,args); });
    };
    w._rdSell=1; window.openVenderModal=w;
  }

  // ── correo: sugerencias de dominio al escribir (@gmail.com, …) ──
  var DOMAINS=['gmail.com','hotmail.com','outlook.com','icloud.com','yahoo.com'];
  var AC_CSS='.rdp-ac{position:fixed;z-index:2147483600;box-sizing:border-box;background:#fff;color:#0b0b0b;border-radius:8px;padding:6px;box-shadow:0 18px 44px rgba(0,0,0,.3),0 2px 8px rgba(0,0,0,.14);font-family:var(--font,-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif);opacity:0;transform:translateY(-6px);transition:opacity .16s ease,transform .22s cubic-bezier(.22,1,.36,1);pointer-events:none}'+
    '.rdp-ac.in{opacity:1;transform:none;pointer-events:auto}'+
    '.rdp-ac.up{transform:translateY(6px)}.rdp-ac.up.in{transform:none}'+
    '.rdp-ac button{display:flex;align-items:center;width:100%;border:0;background:none;padding:11px 12px;border-radius:6px;font:inherit;font-size:14.5px;line-height:1.2;color:#6a6a6a;text-align:left;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;-webkit-tap-highlight-color:transparent}'+
    '.rdp-ac button span{color:#0b0b0b}.rdp-ac button b{color:#0b0b0b;font-weight:700}'+
    '.rdp-ac button.on,.rdp-ac button:hover{background:#f4f4f5}';
  var ac=null, acFor=null, acIdx=-1;
  function isMail(t){ return !!(t&&t.tagName==='INPUT'&&t.type==='email'&&!t.readOnly&&!t.disabled); }
  // sigue a la caja en cada cuadro mientras está abierto (el formulario se anima y el teclado lo mueve)
  var acRaf=0, acLast='';
  function acFollow(){
    acRaf=0; if(!ac||!acFor) return;
    var r=acFor.getBoundingClientRect(), k=r.top+'|'+r.left+'|'+r.width+'|'+(window.visualViewport?window.visualViewport.height+'|'+window.visualViewport.offsetTop:'');
    if(k!==acLast){ acLast=k; acPlace(); }
    acRaf=requestAnimationFrame(acFollow);
  }
  function acHide(){
    if(acRaf){ cancelAnimationFrame(acRaf); acRaf=0; } acLast='';
    if(!ac) return; var a=ac; ac=null; acFor=null; acIdx=-1;
    a.classList.remove('in'); setTimeout(function(){ if(a.parentNode) a.parentNode.removeChild(a); },220);
  }
  function acPlace(){
    if(!ac||!acFor) return;
    var r=acFor.getBoundingClientRect(), vv=window.visualViewport, vh=vv?vv.height+vv.offsetTop:window.innerHeight;
    ac.style.left=Math.max(8,r.left)+'px'; ac.style.width=Math.max(220,r.width)+'px';
    var vtop=vv?vv.offsetTop:0, h=ac.scrollHeight, below=vh-r.bottom-8, above=r.top-vtop-8;
    // nunca encima de la caja: abajo si cabe; si no, arriba; si tampoco, abajo con scroll interno
    var up=below<h+6&&above>below;
    var room=Math.max(96,(up?above:below)-6);
    ac.style.maxHeight=room+'px'; ac.style.overflowY=h>room?'auto':'hidden';
    h=Math.min(h,room);
    ac.classList.toggle('up',up);
    ac.style.top=(up?r.top-h-6:r.bottom+6)+'px';
  }
  function acPick(t,val){
    t.value=val;
    try{ t.setSelectionRange(val.length,val.length); }catch(e){}
    acHide();
    try{ t.dispatchEvent(new Event('change',{bubbles:true})); }catch(e){}
  }
  function acUpdate(t){
    var v=(t.value||'').trim();
    if(!v||/\s/.test(v)) return acHide();
    var at=v.indexOf('@'), user=at<0?v:v.slice(0,at), dom=at<0?'':v.slice(at+1).toLowerCase();
    if(!user||v.indexOf('@',at+1)>-1) return acHide();
    var list=DOMAINS.filter(function(d){ return d.indexOf(dom)===0&&d!==dom; });
    if(!list.length) return acHide();
    if(!document.getElementById('rdp-ac-css')){ var st=document.createElement('style'); st.id='rdp-ac-css'; st.textContent=AC_CSS; document.head.appendChild(st); }
    if(!ac){
      ac=document.createElement('div'); ac.className='rdp-ac'; ac.setAttribute('role','listbox');
      // pointerdown sin perder el foco del campo (el teclado no se cierra)
      ac.addEventListener('pointerdown',function(e){ e.preventDefault(); });
      ac.addEventListener('click',function(e){ var b=e.target.closest('button'); if(b&&acFor) acPick(acFor,b.getAttribute('data-v')); });
      document.body.appendChild(ac);
      requestAnimationFrame(function(){ if(ac) ac.classList.add('in'); });
    }
    acFor=t; acIdx=-1; acLast='';
    if(!acRaf) acRaf=requestAnimationFrame(acFollow);
    ac.innerHTML=list.map(function(d){ var val=user+'@'+d; return '<button type="button" role="option" data-v="'+esc(val)+'"><span>'+esc(user)+'</span>@<b>'+esc(d)+'</b></button>'; }).join('');
    acPlace();
  }
  document.addEventListener('input',function(e){ if(isMail(e.target)) acUpdate(e.target); },true);
  document.addEventListener('focusout',function(e){ if(e.target===acFor) setTimeout(function(){ if(document.activeElement!==acFor) acHide(); },150); },true);
  document.addEventListener('keydown',function(e){
    if(!ac||e.target!==acFor) return;
    var bs=ac.querySelectorAll('button'); if(!bs.length) return;
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){
      e.preventDefault(); acIdx=(acIdx+(e.key==='ArrowDown'?1:-1)+bs.length)%bs.length;
      for(var k=0;k<bs.length;k++) bs[k].className=k===acIdx?'on':'';
    } else if((e.key==='Enter'||e.key==='Tab')&&acIdx>-1){ e.preventDefault(); acPick(acFor,bs[acIdx].getAttribute('data-v')); }
    else if(e.key==='Escape') acHide();
  },true);
  window.addEventListener('resize',acPlace);
  if(window.visualViewport) window.visualViewport.addEventListener('resize',acPlace);
  window.addEventListener('scroll',acPlace,true);

  // ── secuencia: después del splash → cookies → cuenta ───────
  function start(){
    var fired=false, tm=[], now=false;
    function later(f,ms){ tm.push(setTimeout(f,ms)); }
    function go(){
      if(fired) return; fired=true;
      if(MOBILE) return void later(showSignup,6000);
      if(!get(K_CONSENT)) later(function(){ showCookies(function(){ later(showSignup,now?500:2200); }); },1200);
      else later(showSignup,6000);
    }
    // desktop: al entrar al market salen YA (sin esperar el temporizador)
    window._rdPopupsNow=function(){
      if(MOBILE||now) return; now=true;
      tm.forEach(clearTimeout); tm=[]; fired=true;
      if(document.querySelector('.rdp.in')) return;
      if(!get(K_CONSENT)) showCookies(function(){ later(showSignup,500); });
      else showSignup();
    };
    try{ if(window._rdSplashDone&&window._rdSplashDone.then) window._rdSplashDone.then(go,go); else go(); }catch(e){ go(); }
    setTimeout(go,5000);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){ hookSell(); start(); }); else { hookSell(); start(); }
})();
