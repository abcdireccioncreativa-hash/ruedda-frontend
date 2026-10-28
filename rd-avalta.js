/* ─────────────────────────────────────────────────────────────
   RUEDDA · AVALTA LLEGANDO (hoja que abre "solicitar peritaje" en los chats)
   Estética Avalta: fondo claro, tarjetas blancas, Índigo Sello #3B2BC9,
   Noche #140F45, Lila #9D92FF, Niebla #ECEBFF. Sin amarillo.
   Ligero: solo se descarga al tocar la tarjeta (index.html / desktop.html →
   _rdPeritOpen). "Avísame" deja la solicitud en partner_leads (Control ›
   Solicitudes), igual que el peritaje de las publicaciones.
   ───────────────────────────────────────────────────────────── */
(function(){
  var LOGO='<svg viewBox="-14 -10 371 124" fill="none" stroke="currentColor" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" aria-label="avalta"><circle cx="40" cy="70" r="22"/><line x1="62" y1="48" x2="62" y2="92"/><polyline points="84,58 101,91 134,26"/><circle cx="179" cy="70" r="22"/><line x1="201" y1="48" x2="201" y2="92"/><path d="M225 12 V78 C225 88 231 92 241 92"/><path d="M259 28 V78 C259 88 265 92 275 92"/><line x1="247" y1="50" x2="277" y2="50"/><circle cx="311" cy="70" r="22"/><line x1="333" y1="48" x2="333" y2="92"/></svg>';
  var V='<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="12.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="30,49.6 43.6,76 70,24"/></svg>';
  var ROWS=[
    ['<path d="M4 7h16v10H4z"/><path d="M8 11h3M8 14h6M16 11h0"/>','Historial verificado','Placa y serial cruzados, sin maquillaje.'],
    ['<circle cx="12" cy="8" r="3.5"/><path d="M5 20c1.2-3.6 3.8-5.5 7-5.5s5.8 1.9 7 5.5"/>','Avaltadores certificados','Revisión física hecha por especialistas.'],
    ['<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 13l2 2 3.5-4"/>','Informe Avalta','Un token digital que acompaña al carro.']
  ];
  var CSS=
  '#rd-av{position:fixed;inset:0;z-index:10070;display:flex;align-items:flex-end;justify-content:center;background:rgba(20,15,69,0);transition:background .32s cubic-bezier(.32,.72,0,1);font-family:var(--font,-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif);-webkit-font-smoothing:antialiased}'+
  '#rd-av.on{background:rgba(20,15,69,.42)}'+
  '#rd-av .av-s{position:relative;width:100%;max-width:440px;margin:0 8px calc(8px + env(safe-area-inset-bottom)/2);background:#fff;color:#140F45;border-radius:34px;overflow:hidden;box-shadow:0 30px 80px rgba(20,15,69,.35);transform:translateY(105%);transition:transform .5s cubic-bezier(.32,.72,0,1)}'+
  '#rd-av.on .av-s{transform:none}'+
  '@media (min-width:900px){#rd-av{align-items:center}#rd-av .av-s{margin:0;transform:translateY(24px) scale(.97);opacity:0;transition:transform .45s cubic-bezier(.32,.72,0,1),opacity .3s}#rd-av.on .av-s{transform:none;opacity:1}}'+
  '#rd-av .av-h{position:relative;height:178px;background:radial-gradient(120% 110% at 85% 0%,#5a4bf0 0%,#3B2BC9 42%,#140F45 100%);color:#fff;display:flex;flex-direction:column;justify-content:flex-end;padding:0 26px 22px}'+
  '#rd-av .av-h:before{content:"";position:absolute;inset:0;background:radial-gradient(60% 70% at 20% 110%,rgba(157,146,255,.45),transparent 70%);pointer-events:none}'+
  '#rd-av .av-v{position:absolute;right:58px;top:-6px;width:160px;height:160px;color:#fff;opacity:.09}'+
  '#rd-av .av-logo{position:relative;width:118px;height:40px;color:#fff;clip-path:inset(0 100% 0 0);transition:clip-path 1s cubic-bezier(.65,0,.35,1) .25s}'+
  '#rd-av.on .av-logo{clip-path:inset(0 0 0 0)}'+
  '#rd-av .av-logo svg,#rd-av .av-v svg{width:100%;height:100%;display:block}'+
  '#rd-av .av-k{position:relative;margin-top:12px;font-size:12px;font-weight:600;letter-spacing:.3px;color:rgba(255,255,255,.66)}'+
  '#rd-av .av-k b{display:inline-block;width:6px;height:6px;border-radius:50%;background:#9D92FF;margin-right:8px;vertical-align:1px;box-shadow:0 0 0 0 rgba(157,146,255,.7);animation:avp 2s infinite}'+
  '@keyframes avp{0%{box-shadow:0 0 0 0 rgba(157,146,255,.7)}70%{box-shadow:0 0 0 8px rgba(157,146,255,0)}100%{box-shadow:0 0 0 0 rgba(157,146,255,0)}}'+
  '#rd-av .av-x{position:absolute;top:16px;right:16px;z-index:2;width:34px;height:34px;border:0;border-radius:50%;background:rgba(255,255,255,.14);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;-webkit-tap-highlight-color:transparent}'+
  '#rd-av .av-x svg{width:14px;height:14px}'+
  '#rd-av .av-b{padding:24px 26px 22px}'+
  '#rd-av .av-t{font-size:25px;font-weight:700;letter-spacing:-.8px;line-height:1.08;margin:0 0 8px}'+
  '#rd-av .av-p{font-size:14px;line-height:1.45;color:rgba(20,15,69,.6);margin:0 0 20px}'+
  '#rd-av .av-l{list-style:none;margin:0 0 22px;padding:0;display:flex;flex-direction:column;gap:14px}'+
  '#rd-av .av-l li{display:flex;align-items:center;gap:14px;opacity:0;transform:translateY(8px);transition:opacity .45s,transform .45s cubic-bezier(.32,.72,0,1)}'+
  '#rd-av.on .av-l li{opacity:1;transform:none}'+
  '#rd-av.on .av-l li:nth-child(1){transition-delay:.18s}#rd-av.on .av-l li:nth-child(2){transition-delay:.26s}#rd-av.on .av-l li:nth-child(3){transition-delay:.34s}'+
  '#rd-av .av-l i{flex:0 0 40px;height:40px;border-radius:13px;background:#ECEBFF;color:#3B2BC9;display:flex;align-items:center;justify-content:center}'+
  '#rd-av .av-l i svg{width:19px;height:19px}'+
  '#rd-av .av-l b{display:block;font-size:14px;font-weight:700;letter-spacing:-.2px;line-height:18px}'+
  '#rd-av .av-l span{display:block;font-size:12.5px;line-height:17px;color:rgba(20,15,69,.55)}'+
  '#rd-av .av-btn{width:100%;height:52px;border:0;border-radius:26px;background:#3B2BC9;color:#fff;font:700 15px/1 var(--font,inherit);letter-spacing:-.2px;cursor:pointer;box-shadow:0 10px 26px rgba(59,43,201,.32),inset 0 1px 0 rgba(255,255,255,.18);transition:transform .22s cubic-bezier(.32,.72,0,1),opacity .22s;-webkit-tap-highlight-color:transparent}'+
  '#rd-av .av-btn:active{transform:scale(.98);opacity:.85;transition-duration:.08s}'+
  '#rd-av .av-btn[disabled]{opacity:.6}'+
  '#rd-av .av-no{display:block;width:100%;margin-top:6px;padding:12px;border:0;background:none;color:rgba(20,15,69,.5);font:600 13.5px var(--font,inherit);cursor:pointer}'+
  '#rd-av .av-f{margin-top:4px;text-align:center;font-size:11px;letter-spacing:.2px;color:rgba(20,15,69,.38)}'+
  '#rd-av .av-ok{text-align:center;padding:6px 0 4px}'+
  '#rd-av .av-ok .av-c{width:64px;height:64px;margin:0 auto 16px;border-radius:21px;background:#3B2BC9;color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 12px 30px rgba(59,43,201,.35);animation:avin .5s cubic-bezier(.34,1.56,.64,1)}'+
  '#rd-av .av-ok .av-c svg{width:34px;height:34px}'+
  '@keyframes avin{from{transform:scale(.6);opacity:0}to{transform:none;opacity:1}}'+
  '@media (prefers-reduced-motion:reduce){#rd-av *{transition:none!important;animation:none!important}#rd-av .av-logo{clip-path:none}}';
  function esc(s){ return String(s||'').replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function haptic(t){ try{ var H=window._rdCapPlugin&&window._rdCapPlugin('Haptics'); if(!H) return; t?H.notification&&H.notification({type:t}):H.impact&&H.impact({style:'LIGHT'}); }catch(e){} }
  function close(){
    var el=document.getElementById('rd-av'); if(!el||el._gone) return; el._gone=true;
    el.classList.remove('on'); document.removeEventListener('keydown',onKey);
    setTimeout(function(){ if(el.parentNode) el.parentNode.removeChild(el); },420);
  }
  function onKey(e){ if(e.key==='Escape') close(); }
  window.rdAvalta=function(car){
    car=car||{};
    if(!document.getElementById('rd-av-css')){ var st=document.createElement('style'); st.id='rd-av-css'; st.textContent=CSS; document.head.appendChild(st); }
    var old=document.getElementById('rd-av'); if(old) old.remove();
    var el=document.createElement('div'); el.id='rd-av'; el.setAttribute('role','dialog'); el.setAttribute('aria-label','avalta');
    el.innerHTML=
      '<div class="av-s">'+
        '<div class="av-h"><div class="av-v">'+V+'</div>'+
          '<button class="av-x" data-a="x" aria-label="cerrar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>'+
          '<div class="av-logo">'+LOGO+'</div>'+
          '<div class="av-k"><b></b>llegando a ruedda</div>'+
        '</div>'+
        '<div class="av-b">'+
          '<h3 class="av-t">El peritaje de tu próximo carro, avaltado.</h3>'+
          '<p class="av-p">La historia de un carro cambia su precio. Muy pronto vas a poder avaltar '+(car.title?'<b style="color:#140F45">'+esc(car.title)+'</b>':'cualquier carro')+' antes de comprarlo.</p>'+
          '<ul class="av-l">'+ROWS.map(function(r){ return '<li><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+r[0]+'</svg></i><div><b>'+r[1]+'</b><span>'+r[2]+'</span></div></li>'; }).join('')+'</ul>'+
          '<button class="av-btn" data-a="go">Avísame cuando llegue</button>'+
          '<button class="av-no" data-a="x">Ahora no</button>'+
          '<div class="av-f">La historia no se maquilla.</div>'+
        '</div>'+
      '</div>';
    document.body.appendChild(el);
    el.addEventListener('click',async function(e){
      if(e.target===el) return close();
      var b=e.target.closest('[data-a]'); if(!b) return;
      var a=b.getAttribute('data-a');
      if(a==='x') return close();
      if(a==='go'){
        b.disabled=true; b.textContent='enviando…';
        try{
          var uid=null,nm='';
          try{ if(typeof USER_STATE!=='undefined'&&USER_STATE.id&&!(typeof isGuest==='function'&&isGuest())){ uid=USER_STATE.id; nm=USER_STATE.nombre||USER_STATE.username||''; } }catch(_){}
          if(typeof _supa!=='undefined'&&_supa) await _supa.from('partner_leads').insert({user_id:uid,marca_nombre:String(car.title||'vehículo').slice(0,120),representante:nm||'visitante',telefono:'',motivo:'Avalta · peritaje desde el chat · lista de espera · '+(car.type||'')+' '+(car.rid||'')});
        }catch(_){}
        haptic('SUCCESS');
        el.querySelector('.av-b').innerHTML=
          '<div class="av-ok"><div class="av-c">'+V+'</div>'+
          '<h3 class="av-t" style="margin-bottom:8px">Estás en la lista.</h3>'+
          '<p class="av-p" style="margin-bottom:20px">Te avisamos primero cuando Avalta llegue a Ruedda.</p>'+
          '<button class="av-btn" data-a="x">Listo</button></div>';
      }
    });
    document.addEventListener('keydown',onKey);
    haptic();
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ el.classList.add('on'); }); });
  };
})();
