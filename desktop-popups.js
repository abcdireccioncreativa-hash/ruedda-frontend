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
  '.rdp-tb{border:0;background:none;padding:0;margin-left:4px;font:inherit;font-size:inherit;font-weight:inherit;letter-spacing:inherit;color:inherit;text-transform:none;text-decoration:none;cursor:pointer;display:inline-flex;align-items:center;gap:4px;transition:color .15s}'+
  '.rdp-tb svg{width:10px;height:10px;display:block;transition:transform .25s cubic-bezier(.22,1,.36,1)}'+
  '.rdp-tb:hover svg{transform:translateX(2px)}'+
  '.rdp-tb:hover{color:#0b0b0b}'+
  '.rdp.tour [data-a="tour"]{display:none}'+
  '@media (prefers-reduced-motion:reduce){.rdp{transition-duration:.01s}.rdp-iso img{animation:none}.rdp-slide{transition:none}}';

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
    if(MOBILE){
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
      '<div class="rdp-tag"><span class="rdp-iso" aria-hidden="true"></span><span class="rdp-tagt">'+esc(c.tag)+'</span><button class="rdp-tb" data-a="tour">'+esc(c.tourBtn)+'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></div>'+
      '<div class="rdp-slide" aria-live="polite">'+slideHtml(slides[0])+'</div>'+
      '<div class="rdp-nav"><div class="rdp-dots">'+slides.map(function(_,k){ return '<i'+(k===0?' class="on"':'')+'></i>'; }).join('')+'</div>'+
        '<div class="rdp-arr"><button data-a="prev" aria-label="anterior">'+CH_L+'</button><button data-a="next" aria-label="siguiente">'+CH_R+'</button></div></div>'+
      '<button class="rdp-btn" data-a="cta">'+esc(c.cta)+'</button>'+
      '<div class="rdp-row"><button class="rdp-link soft" data-a="later">'+esc(c.later)+'</button></div>',
      'crear cuenta');
    // isotipo real del splash de inicio (misma imagen), ondeando en franjas como el splash.
    // Solo CSS (transform en el compositor): cero JavaScript por frame.
    (function(box){
      if(!box) return; var N=12,OV=2,P=1.4,h='';
      for(var i=0;i<N;i++){
        var u=(i+OV/2)/N, l=i/N*100, r=Math.max(0,(1-(i+OV)/N)*100);
        h+='<img src="/assets/ruedda-iso-negro.png" alt="" style="clip-path:inset(-14% '+r+'% -14% '+l+'%);animation-delay:-'+(u*2.6/(2*Math.PI)*P).toFixed(3)+'s">';
      }
      box.innerHTML=h;
    })(el.querySelector('.rdp-iso'));
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
