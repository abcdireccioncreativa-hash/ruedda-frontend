/* [2026-10-24] Ruedda Track — cronómetro de vueltas (diseño del widget "track timer").
   Puerta en Comunidad (después de Ruedda Extra) → pantalla completa estilo instrumento.
   - START/STOP, VUELTA/RESET, tocar el tiempo = marcar vuelta.
   - Delta en vivo contra la mejor vuelta (verde = más rápido, rojo = más lento), mejor vuelta en morado.
   - GPS opcional: velocidad en vivo y velocidad máxima de la sesión.
   - Sigue corriendo si cierras la pantalla o la app (se guarda por marcas de tiempo), pantalla encendida mientras corre.
   - Historial de sesiones en el teléfono. */
(function(){
  if(window.__rdTrack) return; window.__rdTrack=1;

  var ACC='#ff5a1f', GOOD='#2fd27a', BAD='#ff4a3a', BEST='#b46cff';
  var KEY='rd_track_state_v1', HKEY='rd_track_hist_v1';
  var EASE='cubic-bezier(.32,.72,0,1)';
  function haptic(s){ try{ if(typeof window._rdHapticNow==='function') window._rdHapticNow(s||'LIGHT'); }catch(e){} }
  function now(){ return Date.now(); }
  function fmt(ms){ ms=Math.max(0,ms); var m=Math.floor(ms/60000), s=Math.floor(ms/1000)%60, c=Math.floor(ms/10)%100; return m+':'+(s<10?'0':'')+s+'.'+(c<10?'0':'')+c; }
  function sgn(v){ return (v<0?'−':'+')+(Math.abs(v)/1000).toFixed(2); }

  /* ---------- estado ---------- */
  var S=load();
  function load(){ try{ var s=JSON.parse(localStorage.getItem(KEY)||'null'); if(s&&Array.isArray(s.laps)) return s; }catch(e){} return {run:false,start:0,acc:0,laps:[],top:0,gps:false,t0:0}; }
  function wpost(m){ try{ if(window.__RD_WIDGETS&&window.webkit&&webkit.messageHandlers&&webkit.messageHandlers.rdWidget) webkit.messageHandlers.rdWidget.postMessage(m); }catch(e){} }
  var lastSig='';
  function save(){
    S.ts=Date.now();
    try{ localStorage.setItem(KEY,JSON.stringify(S)); }catch(e){}
    var sig=[S.run,S.start,S.acc,S.laps.length].join('|');
    if(sig!==lastSig){ lastSig=sig; wpost({k:'set',key:'track',v:S}); }
  }
  function hist(){ try{ return JSON.parse(localStorage.getItem(HKEY)||'[]'); }catch(e){ return []; } }
  function cur(){ return S.run?S.acc+now()-S.start:S.acc; }
  function best(){ return S.laps.length?Math.min.apply(null,S.laps):null; }

  /* ---------- estilos ---------- */
  var css=''+
  '@font-face{font-family:"RD Cond";src:url(/assets/fonts/barlowcond-600.woff2) format("woff2");font-weight:600;font-display:swap}'+
  '@font-face{font-family:"RD Cond";src:url(/assets/fonts/barlowcond-700.woff2) format("woff2");font-weight:700;font-display:swap}'+
  '@font-face{font-family:"RD Cond";src:url(/assets/fonts/barlowcond-800.woff2) format("woff2");font-weight:800;font-display:swap}'+
  /* puerta */
  '#rd-track-door{position:relative;margin:0 16px 26px;border-radius:28px;padding:22px 22px 20px;background:#08080a;box-shadow:inset 0 0 0 1px rgba(255,255,255,.07),0 20px 40px rgba(0,0,0,.35);color:#f8f8f4;cursor:pointer;overflow:hidden;-webkit-tap-highlight-color:transparent;transition:transform .18s '+EASE+'}'+
  '#rd-track-door:active{transform:scale(.985)}'+
  '#rd-track-door::before{content:"";position:absolute;inset:0;background:radial-gradient(90% 70% at 100% 0%,rgba(255,90,31,.16),rgba(255,90,31,0) 60%);pointer-events:none}'+
  '.rdt-h{display:flex;justify-content:space-between;align-items:center;position:relative}'+
  '.rdt-brand{display:flex;align-items:center;gap:9px}'+
  '.rdt-brand img{height:17px;width:auto;display:block;filter:invert(1)}'+
  '.rdt-brand span,.rdt-lbl{font:600 11px/1 "RD Cond",var(--font);letter-spacing:.2em;color:#6a6a66}'+
  '.rdt-rec{display:flex;align-items:center;gap:8px;font:700 12px/1 "RD Cond",var(--font);letter-spacing:.2em;color:#b5b5b0}'+
  '.rdt-dot{width:8px;height:8px;border-radius:50%;background:#2a2a2d}'+
  '.rdt-run .rdt-dot{background:#ff2a2a;animation:rdtBlink 1s steps(1) infinite}'+
  '@keyframes rdtBlink{50%{background:#4a1010}}'+
  '#rd-track-door .rdt-time{position:relative;margin-top:18px;font:800 64px/.9 "RD Cond",var(--font);letter-spacing:-.02em;font-variant-numeric:tabular-nums;color:#fff}'+
  '#rd-track-door .rdt-t2{position:relative;margin-top:8px;font:500 13px/1.35 var(--font);color:#8a8a85;max-width:260px}'+
  '#rd-track-door .rdt-cta{position:relative;margin-top:16px;display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 16px;border-radius:100px;background:'+ACC+';color:#08080a;font:800 13px/1 "RD Cond",var(--font);letter-spacing:.2em}'+
  '#rd-track-door .rdt-cta svg{width:15px;height:15px}'+
  /* pantalla */
  '#rd-track{position:fixed;inset:0;z-index:9997;background:#050506;color:#f8f8f4;display:flex;flex-direction:column;padding:calc(env(safe-area-inset-top,0px) + 6px) 18px calc(env(safe-area-inset-bottom,0px) + 14px);box-sizing:border-box;overscroll-behavior:contain;-webkit-user-select:none;user-select:none;transform:translate3d(0,100%,0);transition:transform .52s '+EASE+';will-change:transform}'+
  '#rd-track.in{transform:none}'+
  '#rd-track::before{content:"";position:absolute;inset:0;background:radial-gradient(120% 60% at 50% -10%,rgba(255,90,31,.10),rgba(0,0,0,0) 60%),repeating-linear-gradient(45deg,rgba(255,255,255,.012) 0 2px,rgba(0,0,0,0) 2px 5px);pointer-events:none}'+
  '#rd-track>*{position:relative}'+
  '#rd-track .rdt-bar{display:flex;align-items:center;justify-content:space-between;min-height:48px}'+
  '#rd-track .rdt-x{width:44px;height:44px;margin-left:-10px;border:0;background:none;color:#f8f8f4;display:flex;align-items:center;justify-content:center;cursor:pointer}'+
  '#rd-track .rdt-x svg{width:24px;height:24px}'+
  '#rd-track .rdt-ic{height:34px;padding:0 13px;border-radius:100px;border:0;background:#141417;color:#b5b5b0;font:700 11px/1 "RD Cond",var(--font);letter-spacing:.2em;display:inline-flex;align-items:center;gap:7px;cursor:pointer}'+
  '#rd-track .rdt-ic.on{background:rgba(47,210,122,.14);color:'+GOOD+'}'+
  '#rd-track .rdt-ic svg{width:14px;height:14px}'+
  '#rd-track .rdt-sub{display:flex;justify-content:space-between;align-items:center;margin-top:10px}'+
  '#rd-track .rdt-main{flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center;gap:14px;cursor:pointer;-webkit-tap-highlight-color:transparent}'+
  '#rd-track .rdt-big{font:800 min(31vw,150px)/.86 "RD Cond",var(--font);letter-spacing:-.025em;font-variant-numeric:tabular-nums;color:#fff;white-space:nowrap}'+
  '#rd-track .rdt-big.flash{animation:rdtFlash .5s ease}'+
  '@keyframes rdtFlash{0%{color:'+ACC+'}100%{color:#fff}}'+
  '#rd-track .rdt-drow{display:flex;align-items:center;gap:14px}'+
  '#rd-track .rdt-delta{min-width:92px;font:700 28px/1 "RD Cond",var(--font);font-variant-numeric:tabular-nums;color:#6a6a66}'+
  '#rd-track .rdt-meter{position:relative;flex:1;height:10px;border-radius:5px;background:#1a1a1d;overflow:hidden}'+
  '#rd-track .rdt-meter i{position:absolute;top:0;bottom:0;left:50%;width:0;background:#6a6a66}'+
  '#rd-track .rdt-meter b{position:absolute;top:0;bottom:0;left:50%;width:2px;margin-left:-1px;background:#f8f8f4}'+
  '#rd-track .rdt-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}'+
  '#rd-track .rdt-st{height:62px;border-radius:16px;background:#101013;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px}'+
  '#rd-track .rdt-st b{font:700 26px/1 "RD Cond",var(--font);font-variant-numeric:tabular-nums;color:#f8f8f4}'+
  '#rd-track .rdt-st span{font:600 9.5px/1 "RD Cond",var(--font);letter-spacing:.24em;color:#6a6a66}'+
  '#rd-track .rdt-laps{border-top:1px solid #1c1c1f;padding-top:8px;max-height:min(30vh,210px);overflow-y:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;margin-bottom:12px}'+
  '#rd-track .rdt-laps::-webkit-scrollbar{display:none}'+
  '#rd-track .rdt-lap{display:grid;grid-template-columns:52px 1fr auto;align-items:baseline;font:600 21px/34px "RD Cond",var(--font);font-variant-numeric:tabular-nums}'+
  '#rd-track .rdt-lap span:first-child{font-size:14px;letter-spacing:.12em;color:#6a6a66}'+
  '#rd-track .rdt-lap.new{animation:rdtIn .45s cubic-bezier(.34,1.4,.64,1)}'+
  '@keyframes rdtIn{from{opacity:0;transform:translateY(-10px)}}'+
  '#rd-track .rdt-empty{font:500 13px/1.5 var(--font);color:#6a6a66;padding:6px 0 4px}'+
  '#rd-track .rdt-btns{display:grid;grid-template-columns:1fr 1fr;gap:10px}'+
  '#rd-track .rdt-b{height:64px;border-radius:32px;border:0;font:800 16px/1 "RD Cond",var(--font);letter-spacing:.2em;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:transform .12s '+EASE+',background-color .2s}'+
  '#rd-track .rdt-b:active{transform:scale(.96)}'+
  '#rd-track .rdt-b1{background:#1a1a1d;color:#f8f8f4}'+
  '#rd-track .rdt-b2{background:'+ACC+';color:#08080a}'+
  '#rd-track.rdt-run .rdt-b2{background:#f8f8f4}'+
  /* historial */
  '#rd-track .rdt-hs{position:absolute;left:0;right:0;bottom:0;max-height:72%;background:#0d0d10;border-radius:28px 28px 0 0;box-shadow:0 -20px 60px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.06);padding:12px 20px calc(env(safe-area-inset-bottom,0px) + 20px);transform:translateY(105%);transition:transform .45s '+EASE+';display:flex;flex-direction:column;z-index:3}'+
  '#rd-track .rdt-hs.on{transform:none}'+
  '#rd-track .rdt-hs .grab{width:38px;height:5px;border-radius:3px;background:rgba(255,255,255,.2);margin:0 auto 14px}'+
  '#rd-track .rdt-hs h3{margin:0 0 10px;font:800 28px/1 "RD Cond",var(--font);letter-spacing:-.01em}'+
  '#rd-track .rdt-hl{overflow-y:auto;-webkit-overflow-scrolling:touch}'+
  '#rd-track .rdt-hi{display:grid;grid-template-columns:1fr auto;gap:2px 12px;padding:12px 0;border-top:1px solid #1c1c1f}'+
  '#rd-track .rdt-hi b{font:700 22px/1.1 "RD Cond",var(--font);color:'+BEST+';font-variant-numeric:tabular-nums}'+
  '#rd-track .rdt-hi span{font:500 12.5px/1.3 var(--font);color:#8a8a85}'+
  '#rd-track .rdt-hi em{font:600 12px/1 "RD Cond",var(--font);letter-spacing:.16em;color:#6a6a66;font-style:normal;text-align:right;align-self:center}'+
  '#rd-track .rdt-scrim{position:absolute;inset:0;background:rgba(0,0,0,.5);opacity:0;pointer-events:none;transition:opacity .3s;z-index:2}'+
  '#rd-track .rdt-scrim.on{opacity:1;pointer-events:auto}'+
  '#rd-track .rdt-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;padding:4px;border-radius:100px;background:#101013;margin-top:8px}'+
  '#rd-track .rdt-tab{height:36px;border:0;border-radius:100px;background:none;color:#6a6a66;font:700 12px/1 "RD Cond",var(--font);letter-spacing:.2em;cursor:pointer;transition:background-color .25s,color .25s}'+
  '#rd-track .rdt-tab.on{background:#f8f8f4;color:#08080a}'+
  '#rd-track .rdt-pane{display:none;flex:1;min-height:0;flex-direction:column}'+
  '#rd-track .rdt-pane.on{display:flex;animation:rdtPane .35s '+EASE+'}'+
  '@keyframes rdtPane{from{opacity:0;transform:translateY(8px)}}'+
  '#rd-track .rdt-gauge{position:relative;width:min(78vw,300px);aspect-ratio:1;margin:0 auto}'+
  '#rd-track .rdt-gauge i{position:absolute;left:50%;top:50%;border-radius:2px;transition:background-color .08s,box-shadow .08s}'+
  '#rd-track .rdt-gc{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px}'+
  '#rd-track .rdt-db{font:800 min(26vw,104px)/1 "RD Cond",var(--font);letter-spacing:-.02em;font-variant-numeric:tabular-nums;color:#fff}'+
  '#rd-track .rdt-lights{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;padding:14px;border-radius:22px;background:#121215;box-shadow:inset 0 2px 6px rgba(0,0,0,.8)}'+
  '#rd-track .rdt-lights i{aspect-ratio:1;border-radius:50%;background:#1f1f23;box-shadow:inset 0 2px 4px rgba(0,0,0,.8);transition:background-color .06s,box-shadow .06s}'+
  '#rd-track .rdt-ln{font:800 min(30vw,128px)/.9 "RD Cond",var(--font);letter-spacing:-.025em;font-variant-numeric:tabular-nums;color:#fff}'+
  '#rd-track .rdt-row{display:flex;justify-content:space-between;align-items:center}'+
  '#rd-track .rdt-note{font:500 12.5px/1.45 var(--font);color:#6a6a66;margin:10px 0 12px}'+
  '#rd-track .rdt-b.wide{grid-column:1/-1}'+
  '@media (min-width:768px){#rd-track{padding-left:max(18px,calc(50vw - 260px));padding-right:max(18px,calc(50vw - 260px))}#rd-track .rdt-big{font-size:150px}#rd-track .rdt-hs{left:max(0px,calc(50vw - 300px));right:max(0px,calc(50vw - 300px))}}';
  function injectCss(){ if(document.getElementById('rd-track-css')) return; var s=document.createElement('style'); s.id='rd-track-css'; s.textContent=css; document.head.appendChild(s); }

  var LOGO='/assets/ruedda-wordmark-negro.png';
  var X='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var ARR='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  var GPS='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/></svg>';
  var HIS='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></svg>';

  /* ---------- puerta en comunidad ---------- */
  var door=null;
  function mountDoor(){
    if(door&&door.isConnected) return;
    var ref=document.getElementById('rd-extra-door'); if(!ref) return;
    injectCss();
    door=document.createElement('div'); door.id='rd-track-door'; door.setAttribute('role','button'); door.tabIndex=0; door.setAttribute('aria-label','abrir ruedda track');
    door.innerHTML='<div class="rdt-h"><span class="rdt-brand"><img src="'+LOGO+'" alt="ruedda"><span>TRACK</span></span><span class="rdt-rec"><span class="rdt-dot"></span><span class="rdt-vn">VUELTA 1</span></span></div>'+
      '<div class="rdt-time">0:00.00</div><div class="rdt-t2">Cronómetro de vueltas, decibelímetro de escape y 0–100 con GPS.</div>'+
      '<span class="rdt-cta">ABRIR TRACK'+ARR+'</span>';
    ref.insertAdjacentElement('afterend',door);
    door.addEventListener('click',function(){ haptic(); open(); });
    paintDoor();
  }
  function paintDoor(){
    if(!door) return;
    door.classList.toggle('rdt-run',S.run);
    door.querySelector('.rdt-time').textContent=fmt(cur());
    door.querySelector('.rdt-vn').textContent='VUELTA '+(S.laps.length+1);
    var b=best();
    door.querySelector('.rdt-t2').textContent=S.run?'Sesión en curso · toca para volver al cronómetro.':b!=null?'Mejor vuelta '+fmt(b)+' · '+S.laps.length+' vueltas':'Cronómetro de vueltas, decibelímetro de escape y 0–100 con GPS.';
    door.querySelector('.rdt-cta').firstChild.nodeValue=S.run?'VOLVER AL TRACK':'ABRIR TRACK';
  }
  setInterval(function(){ if(S.run&&door&&door.offsetParent) paintDoor(); },97);

  /* ---------- pantalla ---------- */
  var el=null, raf=0, wake=null, geo=null, speed=null, lastN=-1;
  function open(mode){
    injectCss();
    if(el){ if(mode) setMode(mode); return; }
    el=document.createElement('div'); el.id='rd-track'; el.setAttribute('role','dialog'); el.setAttribute('aria-label','ruedda track');
    el.innerHTML='<div class="rdt-bar"><button type="button" class="rdt-x" aria-label="cerrar">'+X+'</button>'+
      '<span class="rdt-brand"><img src="'+LOGO+'" alt="ruedda"><span>TRACK</span></span>'+
      '<span style="display:flex;gap:8px"><button type="button" class="rdt-ic rdt-gps">'+GPS+'GPS</button><button type="button" class="rdt-ic rdt-his" aria-label="historial">'+HIS+'</button></span></div>'+
      '<div class="rdt-tabs" role="tablist"><button type="button" class="rdt-tab on" data-m="track">TRACK</button><button type="button" class="rdt-tab" data-m="db">DECIBELES</button><button type="button" class="rdt-tab" data-m="launch">0–100</button></div>'+
      '<div class="rdt-pane on" data-p="track">'+
      '<div class="rdt-sub"><span class="rdt-lbl rdt-hint">TOCA EL TIEMPO PARA MARCAR VUELTA</span><span class="rdt-rec"><span class="rdt-dot"></span><span class="rdt-vn">VUELTA 1</span></span></div>'+
      '<div class="rdt-main"><div class="rdt-big">0:00.00</div>'+
        '<div class="rdt-drow"><span class="rdt-delta">—</span><div class="rdt-meter"><i></i><b></b></div></div>'+
        '<div class="rdt-stats"><div class="rdt-st"><b class="s-best">—</b><span>MEJOR</span></div><div class="rdt-st"><b class="s-spd">—</b><span>KM/H</span></div><div class="rdt-st"><b class="s-top">—</b><span>MÁX KM/H</span></div></div></div>'+
      '<div class="rdt-laps"></div>'+
      '<div class="rdt-btns"><button type="button" class="rdt-b rdt-b1">RESET</button><button type="button" class="rdt-b rdt-b2">START</button></div></div>'+
      '<div class="rdt-pane" data-p="db"><div class="rdt-sub"><span class="rdt-lbl">MIDE EL SONIDO DE TU ESCAPE</span><span class="rdt-lbl db-src"></span></div>'+
        '<div class="rdt-main" style="cursor:default"><div class="rdt-gauge"></div></div>'+
        '<div class="rdt-note">Acerca el teléfono al escape (a medio metro) y acelera. La medición es una referencia del micrófono del teléfono, no un sonómetro certificado.</div>'+
        '<div class="rdt-btns"><button type="button" class="rdt-b rdt-b2 wide db-btn">MEDIR ESCAPE</button></div></div>'+
      '<div class="rdt-pane" data-p="launch"><div class="rdt-sub"><span class="rdt-lbl ln-st">TOCA PARA ARMAR</span><span class="rdt-lbl ln-gps">GPS —</span></div>'+
        '<div class="rdt-main" style="cursor:default;gap:22px"><div class="rdt-lights"><i></i><i></i><i></i><i></i><i></i></div>'+
        '<div><div style="display:flex;align-items:baseline;gap:8px"><span class="rdt-ln">0.00</span><span style="font:700 24px \'RD Cond\';color:#6a6a66">s</span></div>'+
        '<div class="rdt-row" style="margin-top:8px"><span class="rdt-lbl ln-res">0–100 KM/H</span><span class="rdt-lbl ln-best">MEJOR —</span></div></div></div>'+
        '<div class="rdt-note">Solo en pista o lugar cerrado. Arma, espera el verde y acelera: con GPS se detiene solo al llegar a 100 km/h; sin GPS, toca PARAR.</div>'+
        '<div class="rdt-btns"><button type="button" class="rdt-b rdt-b2 wide ln-btn">ARMAR SALIDA</button></div></div>'+
      '<div class="rdt-scrim"></div><div class="rdt-hs" role="dialog" aria-label="historial"><div class="grab"></div><h3>sesiones.</h3><div class="rdt-hl"></div></div>';
    document.body.appendChild(el);
    el._ov=document.body.style.overflow; document.body.style.overflow='hidden';
    el.querySelector('.rdt-x').onclick=close;
    el.querySelector('.rdt-b2').onclick=startStop;
    el.querySelector('.rdt-b1').onclick=lapReset;
    el.querySelector('.rdt-main').addEventListener('pointerdown',function(e){ if(S.run){ e.preventDefault(); lapReset(); } });
    el.querySelector('.rdt-gps').onclick=toggleGps;
    el.querySelector('.rdt-his').onclick=openHist;
    el.querySelector('.rdt-scrim').onclick=closeHist;
    [].forEach.call(el.querySelectorAll('.rdt-tab'),function(t){ t.onclick=function(){ setMode(t.dataset.m); }; });
    el.querySelector('.db-btn').onclick=dbToggle;
    el.querySelector('.ln-btn').onclick=lnPress;
    buildGauge(); lnPaint();
    // deslizar desde arriba para cerrar
    var y0=null; el.querySelector('.rdt-bar').addEventListener('touchstart',function(e){ y0=e.touches[0].clientY; },{passive:true});
    el.querySelector('.rdt-bar').addEventListener('touchmove',function(e){ if(y0!=null&&e.touches[0].clientY-y0>90){ y0=null; close(); } },{passive:true});
    lastN=-1; paintLaps(); paint();
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ el&&el.classList.add('in'); }); });
    loop();
    if(S.gps) startGps();
    if(S.run) keepAwake(true);
    if(mode&&mode!=='track') setMode(mode);
  }
  function close(){
    if(!el) return;
    var e=el; el=null; cancelAnimationFrame(raf); stopGps(); keepAwake(false); dbStop(); lnStop();
    e.classList.remove('in');
    setTimeout(function(){ e.remove(); document.body.style.overflow=e._ov||''; },520);
    paintDoor();
  }
  function loop(){ cancelAnimationFrame(raf); var f=function(){ if(!el) return; if(S.run) paint(); raf=requestAnimationFrame(f); }; raf=requestAnimationFrame(f); }
  function paint(){
    if(!el) return;
    var c=cur(), b=best();
    el.classList.toggle('rdt-run',S.run);
    el.querySelector('.rdt-big').textContent=fmt(c);
    el.querySelector('.rdt-vn').textContent='VUELTA '+(S.laps.length+1);
    var d=b!=null&&(S.run||S.acc)?c-b:null, de=el.querySelector('.rdt-delta'), mi=el.querySelector('.rdt-meter i');
    if(d==null){ de.textContent='—'; de.style.color='#6a6a66'; mi.style.width='0'; }
    else{
      var col=d<0?GOOD:BAD, k=Math.max(-3000,Math.min(3000,d))/3000*50;
      de.textContent=sgn(d); de.style.color=col; mi.style.background=col;
      mi.style.left=(k<0?50+k:50)+'%'; mi.style.width=Math.abs(k)+'%';
    }
    el.querySelector('.s-best').textContent=b!=null?fmt(b):'—';
    el.querySelector('.s-spd').textContent=S.gps&&speed!=null?Math.round(speed):'—';
    el.querySelector('.s-top').textContent=S.top?Math.round(S.top):'—';
    el.querySelector('.rdt-b2').textContent=S.run?'STOP':(S.acc?'SEGUIR':'START');
    el.querySelector('.rdt-b1').textContent=S.run?'VUELTA':'RESET';
    el.querySelector('.rdt-gps').classList.toggle('on',!!S.gps);
    el.querySelector('.rdt-hint').textContent=S.run?'TOCA EL TIEMPO PARA MARCAR VUELTA':S.acc?'EN PAUSA':'LISTO PARA SALIR';
  }
  function paintLaps(){
    if(!el) return;
    var box=el.querySelector('.rdt-laps'), b=best();
    if(!S.laps.length){ box.innerHTML='<div class="rdt-empty">Tus vueltas aparecen aquí. La mejor se marca en morado.</div>'; lastN=0; return; }
    var isNew=S.laps.length>lastN&&lastN>=0;
    box.innerHTML=S.laps.map(function(t,i){
      var n=S.laps.length-i, ib=t===b;
      return '<div class="rdt-lap'+(i===0&&isNew?' new':'')+'"><span>V'+n+'</span><span style="color:#f8f8f4">'+fmt(t)+'</span><span style="color:'+(ib?BEST:BAD)+'">'+(ib?'MEJOR':sgn(t-b))+'</span></div>';
    }).join('');
    lastN=S.laps.length;
  }
  function startStop(){
    var n=now();
    if(S.run){ S.acc+=n-S.start; S.run=false; haptic('MEDIUM'); keepAwake(false); }
    else{ S.run=true; S.start=n; if(!S.t0) S.t0=n; haptic('HEAVY'); keepAwake(true); }
    save(); paint(); paintDoor();
  }
  function lapReset(){
    var n=now();
    if(S.run){
      var lap=S.acc+n-S.start, prevBest=best();
      if(lap<300) return; // evita dobles toques
      S.laps.unshift(lap); S.acc=0; S.start=n; save();
      var big=el&&el.querySelector('.rdt-big'); if(big){ big.classList.remove('flash'); void big.offsetWidth; big.classList.add('flash'); }
      if(prevBest!=null&&lap<prevBest){ try{ if(typeof _rdHapticSuccess==='function') _rdHapticSuccess(); else haptic('HEAVY'); }catch(e){} } else haptic('MEDIUM');
      paintLaps(); paint(); return;
    }
    if(!S.acc&&!S.laps.length) return;
    if(S.laps.length){
      var h=hist(); h.unshift({at:S.t0||n,laps:S.laps.slice(0,99),best:best(),top:Math.round(S.top||0)});
      try{ localStorage.setItem(HKEY,JSON.stringify(h.slice(0,40))); }catch(e){}
    }
    S={run:false,start:0,acc:0,laps:[],top:0,gps:S.gps,t0:0}; save(); haptic();
    lastN=-1; paintLaps(); paint(); paintDoor();
  }
  /* GPS */
  function toggleGps(){
    S.gps=!S.gps; save(); haptic();
    if(S.gps) startGps(); else { stopGps(); speed=null; }
    paint();
  }
  function startGps(){
    if(geo!=null||!navigator.geolocation) return;
    geo=navigator.geolocation.watchPosition(function(p){
      var v=p.coords.speed; speed=(v!=null&&v>=0)?v*3.6:null;
      if(speed!=null&&S.run&&speed>(S.top||0)&&speed<400){ S.top=speed; save(); }
      if(!S.run) paint();
    },function(err){
      if(err&&err.code===1){ try{ showToast('activa la ubicación para medir velocidad'); }catch(e){} S.gps=false; save(); stopGps(); }
    },{enableHighAccuracy:true,maximumAge:0,timeout:15000});
  }
  function stopGps(){ if(geo!=null){ try{ navigator.geolocation.clearWatch(geo); }catch(e){} geo=null; } }
  /* pantalla encendida mientras corre */
  async function keepAwake(on){
    try{
      if(on&&el&&!wake&&navigator.wakeLock){ wake=await navigator.wakeLock.request('screen'); wake.addEventListener('release',function(){ wake=null; }); }
      if(!on&&wake){ await wake.release(); wake=null; }
    }catch(e){}
  }
  document.addEventListener('visibilitychange',function(){ if(!document.hidden&&el&&S.run) keepAwake(true); });
  /* historial */
  function openHist(){
    var h=hist(), list=el.querySelector('.rdt-hl');
    list.innerHTML=h.length?h.map(function(s){
      var d=new Date(s.at), f=d.toLocaleDateString('es-VE',{day:'2-digit',month:'short'})+' · '+d.toLocaleTimeString('es-VE',{hour:'2-digit',minute:'2-digit'});
      return '<div class="rdt-hi"><b>'+fmt(s.best)+'</b><em>'+s.laps.length+' VUELTAS</em><span>'+f+(s.top?' · máx '+s.top+' km/h':'')+'</span></div>';
    }).join(''):'<div class="rdt-empty">Cuando reinicies una sesión con vueltas, queda guardada aquí.</div>';
    el.querySelector('.rdt-scrim').classList.add('on'); el.querySelector('.rdt-hs').classList.add('on'); haptic();
  }
  function closeHist(){ if(!el) return; el.querySelector('.rdt-scrim').classList.remove('on'); el.querySelector('.rdt-hs').classList.remove('on'); }

  /* ---------- pestañas ---------- */
  function setMode(m){
    if(!el) return;
    [].forEach.call(el.querySelectorAll('.rdt-tab'),function(t){ t.classList.toggle('on',t.dataset.m===m); });
    [].forEach.call(el.querySelectorAll('.rdt-pane'),function(p){ p.classList.toggle('on',p.dataset.p===m); });
    el.querySelector('.rdt-gps').style.display=m==='track'?'':'none';
    if(m!=='db') dbStop();
    haptic();
  }

  /* ---------- decibelímetro (micrófono) ---------- */
  var DBK='rd_db_v1', db={on:false,val:0,peak:0,stream:null,ac:null,an:null,buf:null,raf:0,sum:0,n:0};
  function dbLast(){ try{ return JSON.parse(localStorage.getItem(DBK)||'null'); }catch(e){ return null; } }
  function dbDeg(v){ return -120+(v-30)/100*240; }
  function buildGauge(){
    var g=el.querySelector('.rdt-gauge'), r=g.offsetWidth/2||150, h='';
    for(var i=0;i<=40;i++){ var major=i%4===0, w=major?5:3, hh=major?22:14, v=30+i*2.5;
      h+='<i data-v="'+v+'" style="width:'+w+'px;height:'+hh+'px;margin:'+(-hh/2)+'px 0 0 '+(-w/2)+'px;transform:rotate('+dbDeg(v)+'deg) translateY(-'+(r-(major?24:20))+'px)"></i>'; }
    g.innerHTML=h+'<div class="rdt-gc"><span class="rdt-db">—</span><span class="rdt-lbl db-u" style="letter-spacing:.3em">dB</span><span class="rdt-lbl db-pk" style="margin-top:6px">PICO —</span></div>';
    var L=dbLast(); if(L){ el.querySelector('.db-pk').textContent='ÚLTIMO PICO '+Math.round(L.peak)+' dB'; }
    dbPaint();
  }
  function dbCol(v,on){ return v>=105?(on?'#ff2a2a':'#3e1212'):v>=85?(on?'#f5c400':'#3a3110'):(on?'#2fd27a':'#14301f'); }
  function dbPaint(){
    if(!el) return;
    var ticks=el.querySelectorAll('.rdt-gauge i');
    for(var i=0;i<ticks.length;i++){ var v=+ticks[i].dataset.v, on=db.on&&v<=db.val, c=dbCol(v,on); ticks[i].style.background=c; ticks[i].style.boxShadow=on?'0 0 10px '+c:'none'; }
    el.querySelector('.rdt-db').textContent=db.on||db.peak?Math.round(db.val):'—';
    el.querySelector('.db-u').style.color=db.on?dbCol(db.val,true):'#6a6a66';
    if(db.peak) el.querySelector('.db-pk').textContent='PICO '+Math.round(db.peak)+' dB';
    var b=el.querySelector('.db-btn'); b.textContent=db.on?'DETENER':'MEDIR ESCAPE'; b.style.background=db.on?'#f8f8f4':'';
  }
  async function dbToggle(){
    if(db.on){ dbStop(true); return; }
    haptic('MEDIUM');
    try{
      db.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
      db.ac=new (window.AudioContext||window.webkitAudioContext)();
      db.an=db.ac.createAnalyser(); db.an.fftSize=2048; db.buf=new Float32Array(db.an.fftSize);
      db.ac.createMediaStreamSource(db.stream).connect(db.an);
      db.on=true; db.val=30; db.peak=0; db.sum=0; db.n=0;
      el.querySelector('.db-src').textContent='MICRÓFONO';
      var tick=function(){
        if(!db.on) return;
        db.an.getFloatTimeDomainData(db.buf);
        var s=0; for(var i=0;i<db.buf.length;i++) s+=db.buf[i]*db.buf[i];
        var v=Math.max(30,Math.min(130,20*Math.log10(Math.sqrt(s/db.buf.length)+1e-6)+110));
        db.val+=(v-db.val)*.35; if(db.val>db.peak) db.peak=db.val; db.sum+=db.val; db.n++;
        dbPaint(); db.raf=requestAnimationFrame(tick);
      };
      tick();
    }catch(e){
      dbStop();
      try{ showToast('activa el micrófono para medir el escape'); }catch(_){}
    }
  }
  function dbStop(keep){
    if(db.raf) cancelAnimationFrame(db.raf);
    if(db.stream) db.stream.getTracks().forEach(function(t){ t.stop(); });
    if(db.ac) try{ db.ac.close(); }catch(e){}
    var was=db.on; db.on=false; db.stream=db.ac=db.an=null;
    if(was&&keep&&db.peak>30){
      var rec={last:Math.round(db.n?db.sum/db.n:db.val),peak:Math.round(db.peak),at:Date.now()};
      try{ localStorage.setItem(DBK,JSON.stringify(rec)); }catch(e){}
      wpost({k:'set',key:'db',v:rec}); haptic('MEDIUM');
    }
    if(el){ var s=el.querySelector('.db-src'); if(s) s.textContent=''; db.val=db.peak||0; dbPaint(); }
  }

  /* ---------- 0–100 (semáforo + GPS) ---------- */
  var LNK='rd_launch_v1', ln={phase:'idle',t0:0,res:null,fs:false,timer:0,raf:0,geo:null,spd:null};
  function lnRec(){ try{ return JSON.parse(localStorage.getItem(LNK)||'null')||{}; }catch(e){ return {}; } }
  function lnPaint(){
    if(!el) return;
    var n=Date.now(), ph=ln.phase, rec=lnRec();
    if(ph==='lights'&&n>=ln.t0){ ph=ln.phase='run'; haptic('HEAVY'); }
    var le=n-(ln.t0-1800), lights=el.querySelectorAll('.rdt-lights i');
    for(var i=0;i<5;i++){ var bg='#1f1f23', gl='inset 0 2px 4px rgba(0,0,0,.8)';
      if(ph==='lights'&&le>i*300){ bg='#ff2a2a'; gl='0 0 16px #ff2a2a'; }
      if(ph==='run'||(ph==='done'&&!ln.fs)){ bg='#2fd27a'; gl='0 0 16px #2fd27a'; }
      if(ph==='done'&&ln.fs){ bg='#f5c400'; gl='0 0 16px #f5c400'; }
      lights[i].style.background=bg; lights[i].style.boxShadow=gl; }
    var t=el.querySelector('.rdt-ln');
    t.textContent=ph==='run'?((n-ln.t0)/1000).toFixed(2):ln.res!=null?ln.res.toFixed(2):'0.00';
    t.style.color=ph==='done'&&ln.fs?'#f5c400':ph==='done'&&rec.best!=null&&ln.res===rec.best?'#b46cff':'#fff';
    el.querySelector('.ln-st').textContent=ph==='idle'?'TOCA PARA ARMAR':ph==='lights'?'ESPERA EL VERDE…':ph==='run'?'¡ACELERA!':ln.fs?'SALIDA EN FALSO':ln.res===rec.best?'NUEVO RÉCORD':'TIEMPO';
    el.querySelector('.ln-best').textContent='MEJOR '+(rec.best!=null?rec.best.toFixed(2)+' s':'—');
    el.querySelector('.ln-gps').textContent=ln.spd!=null?'GPS '+Math.round(ln.spd)+' KM/H':ln.geo!=null?'GPS BUSCANDO…':'GPS —';
    var b=el.querySelector('.ln-btn');
    b.textContent=ph==='run'?'100 KM/H · PARAR':ph==='lights'?'ESPERA':'ARMAR SALIDA';
    b.style.background=ph==='run'?'#2fd27a':ph==='lights'?'#ff2a2a':'';
    if(ph==='run'&&ln.spd!=null&&ln.spd>=100) lnFinish();
  }
  function lnLoop(){ cancelAnimationFrame(ln.raf); var f=function(){ if(!el||(ln.phase!=='lights'&&ln.phase!=='run')) { lnPaint(); return; } lnPaint(); ln.raf=requestAnimationFrame(f); }; ln.raf=requestAnimationFrame(f); }
  function lnPress(){
    var n=Date.now();
    if(ln.phase==='lights'&&n<ln.t0){ ln.phase='done'; ln.fs=true; ln.res=null; haptic('HEAVY'); lnSave(); lnPaint(); return; }
    if(ln.phase==='run'||(ln.phase==='lights'&&n>=ln.t0)){ lnFinish(); return; }
    ln.phase='lights'; ln.fs=false; ln.res=null; ln.t0=n+1800+Math.random()*900; haptic('MEDIUM');
    if(ln.geo==null&&navigator.geolocation){
      ln.geo=navigator.geolocation.watchPosition(function(p){ var v=p.coords.speed; ln.spd=(v!=null&&v>=0)?v*3.6:null; },function(){},{enableHighAccuracy:true,maximumAge:0,timeout:15000});
    }
    keepAwake(true); lnLoop();
  }
  function lnFinish(){
    if(ln.phase!=='run') return;
    ln.res=Math.round((Date.now()-ln.t0)/10)/100; ln.phase='done'; ln.fs=false;
    try{ if(typeof _rdHapticSuccess==='function') _rdHapticSuccess(); else haptic('HEAVY'); }catch(e){}
    lnSave(); lnPaint();
  }
  function lnSave(){
    var rec=lnRec();
    if(!ln.fs&&ln.res!=null) rec.best=rec.best==null?ln.res:Math.min(rec.best,ln.res);
    rec.last=ln.fs?null:ln.res; rec.fs=ln.fs; rec.at=Date.now();
    try{ localStorage.setItem(LNK,JSON.stringify(rec)); }catch(e){}
    wpost({k:'set',key:'launch',v:{last:rec.last,best:rec.best==null?null:rec.best,fs:!!rec.fs,at:rec.at}});
  }
  function lnStop(){ cancelAnimationFrame(ln.raf); if(ln.geo!=null){ try{ navigator.geolocation.clearWatch(ln.geo); }catch(e){} ln.geo=null; } ln.spd=null; if(ln.phase==='lights'||ln.phase==='run') ln.phase='idle'; }

  /* ---------- widgets de iOS ---------- */
  // el widget también puede iniciar/parar/marcar vueltas: gana el estado más reciente
  window.rdWidgetState=function(key,v){
    if(key!=='track'||!v||!Array.isArray(v.laps)) return;
    if((v.ts||0)>(S.ts||0)){
      S=v; lastSig=[S.run,S.start,S.acc,S.laps.length].join('|');
      try{ localStorage.setItem(KEY,JSON.stringify(S)); }catch(e){}
      lastN=-1; paintLaps(); paint(); paintDoor();
    }
  };
  // un widget pide abrir algo: track | db | launch | subastas | subasta:<id>
  window.rdWidgetOpen=function(r){
    r=String(r||'');
    if(r==='track'||r==='db'||r==='launch'){ open(r); return; }
    if(r==='subastas'||r.indexOf('subasta:')===0){
      try{ if(el) close(); if(typeof showView==='function') showView('home'); if(typeof selectSection==='function') selectSection('subastas'); }catch(e){}
      var id=r.split(':')[1]; if(!id) return;
      var tries=0, go=function(){
        tries++;
        var ok=false; try{ ok=typeof AUCTIONS!=='undefined'&&AUCTIONS.some(function(a){ return String(a.id)===id; }); }catch(e){}
        if(ok){ try{ openDetail(id); }catch(e){} } else if(tries<40) setTimeout(go,300);
      };
      go();
    }
  };
  function syncFromWidget(){ wpost({k:'get',key:'track'}); }
  document.addEventListener('visibilitychange',function(){ if(!document.hidden) syncFromWidget(); });

  window.rdTrackOpen=open;
  function hook(){
    mountDoor();
    syncFromWidget(); wpost({k:'ready'});
    // comunidad se pinta al entrar: si la puerta aún no existe, se monta cuando aparezca
    if(!door){ var mo=new MutationObserver(function(){ if(document.getElementById('rd-extra-door')){ mountDoor(); if(door) mo.disconnect(); } }); mo.observe(document.body,{childList:true,subtree:true}); }
    var bk=window.RDBack;
    window.RDBack=function(){ if(el){ var hs=el.querySelector('.rdt-hs.on'); if(hs) closeHist(); else close(); return true; } return typeof bk==='function'?bk.apply(this,arguments):false; };
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',hook); else hook();
})();
