/* [2026-10-24] Historias v2
   - App iOS/Android: "historias" despliega la bandeja de círculos bajo el hub y empuja todo el market
     hacia abajo (FLIP: el contenido se mueve con transform, el navegador no recalcula layout por cuadro).
   - Web móvil/desktop: "historias" abre el visor directo (como antes), con el visor nuevo.
   - Visor: respeta el notch/isla (safe-area), la X queda a mano, foto o video, progreso real del video,
     mantener presionado pausa, deslizar abajo cierra siguiendo el dedo, izquierda/derecha cambia de persona.
   - Publicar: foto o video (hasta 60 s / 50 MB) con barra de progreso real.
   Reutiliza openStories/_storyPublishFlow del index (los reemplaza); _storySendReply y el KYC gate se reusan. */
(function(){
  if(window.__rdStoriesV2) return; window.__rdStoriesV2=1;

  var NATIVE=false;
  try{ var C=window.Capacitor; NATIVE=!!(C&&C.isNativePlatform&&C.isNativePlatform()); }catch(e){}
  var EASE='cubic-bezier(.32,.72,0,1)';
  var MAX_VIDEO_S=60, MAX_BYTES=50*1024*1024, IMG_DUR=5000;
  var VIDEO_RE=/\.(mp4|mov|m4v|webm|3gp|qt)(\?|#|$)/i;

  function haptic(s){ try{ if(typeof window._rdHapticNow==='function') window._rdHapticNow(s||'LIGHT'); }catch(e){} }
  function toast(m,ok){ try{ showToast(m,ok); }catch(e){} }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  /* llenar (cover) solo si la proporción se parece a la del visor; si no, se ve completa (contain) */
  function tooWide(w,h,stage){ if(!w||!h) return false; var sw=stage&&stage.clientWidth||9, sh=stage&&stage.clientHeight||16; return (w/h)>(sw/sh)*1.3; }
  function isVideo(url){ return VIDEO_RE.test(String(url||'')); }
  function thumb(url,w){ try{ if(!isVideo(url)&&typeof _tImg==='function') return _tImg(url,{width:w||200,quality:70})||url; }catch(e){} return url; }
  function US(){ try{ return USER_STATE||{}; }catch(e){ return {}; } }
  function me(){ return US().id||null; }
  function supa(){ try{ return _supa; }catch(e){ return null; } }

  /* ---------- visto ---------- */
  var SEEN_KEY='rd_st_seen';
  function seenSet(){ try{ return new Set(JSON.parse(localStorage.getItem(SEEN_KEY)||'[]')); }catch(e){ return new Set(); } }
  function markSeen(id){
    try{ var a=JSON.parse(localStorage.getItem(SEEN_KEY)||'[]'); if(a.indexOf(id)<0){ a.push(id); if(a.length>600) a=a.slice(-600); localStorage.setItem(SEEN_KEY,JSON.stringify(a)); } }catch(e){}
  }

  /* ---------- datos ---------- */
  var cache={groups:null,ts:0,loading:null};
  function load(force){
    if(!force&&cache.groups&&Date.now()-cache.ts<60000) return Promise.resolve(cache.groups);
    if(cache.loading) return cache.loading;
    var S=supa(); if(!S) return Promise.resolve([]);
    cache.loading=(async function(){
      var res=await S.from('stories').select('id,user_id,media_url,created_at,users(nombre,username,avatar_url,role,kyc_verified)')
        .gte('created_at',new Date(Date.now()-(window._rdStoryWindowMs||86400000)).toISOString()).order('created_at',{ascending:true});
      if(res.error) throw res.error;
      var rows=res.data||[];
      var dealerIds=[...new Set(rows.filter(function(r){var u=r.users;return u&&(u.role==='consesionario'||u.role==='concesionario');}).map(function(r){return r.user_id;}))];
      var dealerMap={};
      if(dealerIds.length){
        try{ var dd=(await S.from('concesionarios').select('user_id,nombre,logo_url').in('user_id',dealerIds)).data||[]; dd.forEach(function(d){dealerMap[d.user_id]=d;}); }catch(e){}
      }
      var by=new Map();
      rows.forEach(function(r){
        var u=r.users||{}, d=dealerMap[r.user_id];
        r._name=(d&&d.nombre)||u.nombre||u.username||'usuario';
        r._avatar=(d&&d.logo_url&&thumb(d.logo_url,120))||u.avatar_url||'';
        if(!by.has(r.user_id)) by.set(r.user_id,{user_id:r.user_id,items:[]});
        by.get(r.user_id).items.push(r);
      });
      var seen=seenSet(), mine=me();
      var groups=[...by.values()].map(function(g){
        g.last=g.items[g.items.length-1];
        g.seen=g.items.every(function(s){return seen.has(s.id);});
        g.mine=g.user_id===mine;
        return g;
      });
      groups.sort(function(a,b){
        if(a.mine!==b.mine) return a.mine?-1:1;
        if(a.seen!==b.seen) return a.seen?1:-1;
        return new Date(b.last.created_at)-new Date(a.last.created_at);
      });
      cache.groups=groups; cache.ts=Date.now();
      try{ localStorage.setItem('rd_story_badge_cache',JSON.stringify({ts:Date.now(),count:rows.length})); if(typeof _storyPaintBadge==='function') _storyPaintBadge(rows.length); }catch(e){}
      return groups;
    })().finally(function(){ cache.loading=null; });
    return cache.loading;
  }
  function prefetchFirst(g){
    (g||[]).slice(0,3).forEach(function(x){ var s=x.last; if(s&&!isVideo(s.media_url)){ var i=new Image(); i.src=thumb(s.media_url,216); } });
  }
  function refreshSeenFlags(){
    if(!cache.groups) return;
    var seen=seenSet();
    cache.groups.forEach(function(g){ g.seen=g.items.every(function(s){return seen.has(s.id);}); });
  }

  /* ---------- estilos ---------- */
  var css=''+
  '#rd-st-tray{display:none;position:relative;background:var(--rdst-band,#0b0b0b);contain:layout paint}'+
  'html[data-theme="light"] #rd-st-tray{--rdst-band:#f1f1ee}'+
  '#rd-st-tray .rdst-row{display:flex;gap:12px;overflow-x:auto;overflow-y:hidden;padding:14px 16px;scrollbar-width:none;-webkit-overflow-scrolling:touch;scroll-snap-type:x proximity;scroll-padding-left:16px}'+
  '#rd-st-tray .rdst-row::-webkit-scrollbar{display:none}'+
  '.rdst-it{flex:0 0 auto;width:72px;height:72px;border-radius:50%;position:relative;padding:0;border:0;background:none;cursor:pointer;scroll-snap-align:start;-webkit-tap-highlight-color:transparent;transition:transform .18s '+EASE+'}'+
  '.rdst-it:active{transform:scale(.92)}'+
  '.rdst-ring{position:absolute;inset:0;border-radius:50%;background:linear-gradient(100deg,#f7517a 0%,#e04aa8 48%,#9d5cf6 100%)}'+
  '.rdst-it.seen .rdst-ring{background:rgba(255,255,255,.18)}'+
  'html[data-theme="light"] .rdst-it.seen .rdst-ring{background:rgba(0,0,0,.14)}'+
  '.rdst-in{position:absolute;inset:3px;border-radius:50%;background:var(--rdst-band,#0b0b0b);padding:2.5px}'+
  '.rdst-it.seen .rdst-in{inset:2px}'+
  '.rdst-ph{display:block;width:100%;height:100%;border-radius:50%;overflow:hidden;background:#3b3b39;position:relative}'+
  'html[data-theme="light"] .rdst-ph{background:#d9d9d4}'+
  '.rdst-ph img,.rdst-ph video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;opacity:0;transition:opacity .35s ease}'+
  '.rdst-ph .on{opacity:1}'+
  '.rdst-it.skel .rdst-ph{animation:rdstPulse 1.2s ease-in-out infinite}'+
  '@keyframes rdstPulse{50%{opacity:.55}}'+
  '.rdst-add .rdst-ph{background:#3b3b37;display:flex;align-items:center;justify-content:center}'+
  'html[data-theme="light"] .rdst-add .rdst-ph{background:#e2e2dc}'+
  '.rdst-add{width:68px;height:68px;margin:2px 0}'+
  '.rdst-add svg{width:30px;height:30px;color:#e6f03b;position:relative;z-index:1}'+
  'html[data-theme="light"] .rdst-add svg{color:#111}'+
  '.rdst-add .rdst-prog{position:absolute;inset:-3px;border-radius:50%;background:conic-gradient(#e6f03b var(--p,0%),rgba(255,255,255,.08) 0);-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 3px),#000 calc(100% - 3px));mask:radial-gradient(farthest-side,transparent calc(100% - 3px),#000 calc(100% - 3px));opacity:0;transition:opacity .2s}'+
  '.rdst-add.up .rdst-prog{opacity:1}'+
  '.rdst-add.up svg{animation:rdstSpin 1s linear infinite}'+
  '@keyframes rdstSpin{to{transform:rotate(360deg)}}'+
  '.rdst-it.vid::after{content:"";position:absolute;right:2px;bottom:2px;width:18px;height:18px;border-radius:50%;background:#0b0b0b url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27%3E%3Cpath fill=%27%23fff%27 d=%27M9 7.5v9l7.5-4.5z%27/%3E%3C/svg%3E") center/12px no-repeat;box-shadow:0 0 0 2px var(--rdst-band,#0b0b0b)}'+
  '.rdst-empty{align-self:center;flex:0 0 auto;font-size:12.5px;line-height:1.35;color:var(--w45,rgba(255,255,255,.45));max-width:190px;padding-left:4px}'+
  /* visor */
  '#story-viewer{position:fixed;inset:0;z-index:9996;background:#000;display:flex;flex-direction:column;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);overscroll-behavior:contain;touch-action:none;-webkit-user-select:none;user-select:none;opacity:0;transition:opacity .22s ease,background-color .2s linear}'+
  '#story-viewer.in{opacity:1}'+
  '#story-viewer .stv-stage{position:relative;flex:1;min-height:0;margin:6px 8px 0;border-radius:18px;overflow:hidden;background:#0e0e0e;transform-origin:50% 40%;will-change:transform}'+
  '@media (min-width:768px){#story-viewer .stv-stage{flex:1;align-self:center;width:min(100% - 32px,calc((100dvh - 150px) * 9 / 16));margin-top:20px;border-radius:20px}#story-viewer .stv-foot{align-self:center;width:min(100% - 32px,calc((100dvh - 150px) * 9 / 16))}}'+
  '#story-viewer .stv-media{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;background:#0e0e0e}'+
  '#story-viewer .stv-media.fit{object-fit:contain}'+
  '#story-viewer .stv-top{position:absolute;left:0;right:0;top:0;padding:10px 10px 30px;background:linear-gradient(rgba(0,0,0,.5),rgba(0,0,0,0));z-index:3;transition:opacity .2s}'+
  '#story-viewer.hold .stv-top,#story-viewer.hold .stv-foot{opacity:0}'+
  '#story-viewer .stv-bars{display:flex;gap:3px}'+
  '#story-viewer .stv-bar{flex:1;height:2.5px;border-radius:3px;background:rgba(255,255,255,.3);overflow:hidden}'+
  '#story-viewer .stv-bar i{display:block;height:100%;background:#fff;transform-origin:0 50%;transform:scaleX(0);will-change:transform}'+
  '#story-viewer .stv-head{display:flex;align-items:center;gap:9px;margin-top:10px;min-height:44px}'+
  '#story-viewer .stv-av{width:34px;height:34px;border-radius:50%;background:#2a2a2a;overflow:hidden;flex-shrink:0}'+
  '#story-viewer .stv-av img{width:100%;height:100%;object-fit:cover;display:block}'+
  '#story-viewer .stv-un{display:flex;align-items:center;gap:5px;min-width:0;font-family:var(--font);font-size:14px;font-weight:700;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.3)}'+
  '#story-viewer .stv-un span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'+
  '#story-viewer .stv-t{font-family:var(--font);font-size:12.5px;color:rgba(255,255,255,.7);flex-shrink:0}'+
  '#story-viewer .stv-sp{flex:1}'+
  '#story-viewer .stv-btn{width:44px;height:44px;margin:-4px -6px -4px 0;display:flex;align-items:center;justify-content:center;background:none;border:0;padding:0;color:#fff;cursor:pointer;-webkit-tap-highlight-color:transparent;flex-shrink:0}'+
  '#story-viewer .stv-btn svg{width:24px;height:24px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))}'+
  '#story-viewer .stv-btn:active{opacity:.6}'+
  '#story-viewer .stv-mute{display:none}'+
  '#story-viewer.has-vid .stv-mute{display:flex}'+
  '#story-viewer .stv-load{position:absolute;left:50%;top:50%;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:2.5px solid rgba(255,255,255,.2);border-top-color:#fff;animation:rdstSpin .8s linear infinite;z-index:2;opacity:0;transition:opacity .2s}'+
  '#story-viewer.loading .stv-load{opacity:1;transition-delay:.25s}'+
  '#story-viewer .stv-foot{display:flex;align-items:center;gap:10px;padding:10px 12px 12px;min-height:64px;box-sizing:border-box;transition:opacity .2s}'+
  '#story-viewer .stv-in{flex:1;min-width:0;height:44px;background:transparent;border:1px solid rgba(255,255,255,.35);border-radius:100px;padding:0 18px;color:#fff;font-family:var(--font);font-size:16px;outline:none;-webkit-appearance:none}'+
  '#story-viewer .stv-in::placeholder{color:rgba(255,255,255,.65)}'+
  '#story-viewer .stv-send{width:44px;height:44px;border-radius:50%;border:0;background:#e6f03b;color:#0b0b0b;display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer}'+
  '#story-viewer .stv-send svg{width:18px;height:18px}'+
  '#story-viewer .stv-who{display:flex;align-items:center;gap:9px;min-width:0;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:opacity .15s}'+
  '#story-viewer .stv-who:active{opacity:.6}'+
  '#story-viewer .stv-like{width:44px;height:44px;border:0;background:none;padding:0;color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer;-webkit-tap-highlight-color:transparent}'+
  '#story-viewer .stv-like svg{width:28px;height:28px}'+
  '#story-viewer .stv-like.on{color:#ff3b5c}'+
  '#story-viewer .stv-burst{position:absolute;left:50%;top:45%;width:110px;height:110px;margin:-55px 0 0 -55px;color:#ff3b5c;z-index:4;pointer-events:none;filter:drop-shadow(0 6px 20px rgba(0,0,0,.35))}'+
  '#story-viewer .stv-burst svg{width:100%;height:100%}'+
  '#rd-st-tray .rdst-wait{flex-shrink:0;align-self:center;width:22px;height:22px;margin:0 0 18px 26px;border-radius:50%;border:2px solid rgba(255,255,255,.18);border-top-color:#fff;animation:rdstSpin .8s linear infinite}'+
  '#story-viewer .stv-del{height:40px;padding:0 16px;border-radius:100px;border:0;background:rgba(255,255,255,.12);color:#fff;font-family:var(--font);font-size:13.5px;font-weight:600;display:inline-flex;align-items:center;gap:7px;cursor:pointer}'+
  '#story-viewer .stv-del svg{width:16px;height:16px}'+
  '#story-viewer .stv-x-d{display:none;position:absolute;right:18px;top:calc(env(safe-area-inset-top,0px) + 16px);width:44px;height:44px;border-radius:50%;border:0;background:rgba(255,255,255,.1);color:#fff;align-items:center;justify-content:center;cursor:pointer;z-index:5}'+
  '#story-viewer .stv-x-d svg{width:20px;height:20px}'+
  /* compositor (vista previa antes de compartir) */
  '#rdst-comp{position:fixed;inset:0;z-index:9997;background:#000;display:flex;flex-direction:column;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);opacity:0;transition:opacity .22s ease;touch-action:none}'+
  '#rdst-comp.in{opacity:1}'+
  '#rdst-comp .stc-stage{position:relative;flex:1;min-height:0;margin:6px 8px 0;border-radius:18px;overflow:hidden;background:#0e0e0e;will-change:transform}'+
  '@media (min-width:768px){#rdst-comp .stc-stage,#rdst-comp .stc-foot{align-self:center;width:min(100% - 32px,calc((100dvh - 150px) * 9 / 16))}#rdst-comp .stc-stage{margin-top:20px;border-radius:20px}}'+
  '#rdst-comp .stc-media{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}'+
  '#rdst-comp .stc-media.fit{object-fit:contain}'+
  '#rdst-comp .stc-top{position:absolute;left:0;right:0;top:0;display:flex;align-items:center;justify-content:space-between;padding:10px 8px 30px;background:linear-gradient(rgba(0,0,0,.45),rgba(0,0,0,0));z-index:2}'+
  '#rdst-comp .stc-chip{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 12px;border-radius:100px;background:rgba(0,0,0,.4);color:#fff;font-family:var(--font);font-size:12.5px;font-weight:600;letter-spacing:-.1px}'+
  '#rdst-comp .stc-chip svg{width:14px;height:14px}'+
  '#rdst-comp .stc-x{width:44px;height:44px;border:0;background:none;color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer}'+
  '#rdst-comp .stc-x svg{width:24px;height:24px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))}'+
  '#rdst-comp .stc-prep{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:rgba(255,255,255,.75);font-family:var(--font);font-size:13px;z-index:1;transition:opacity .25s}'+
  '#rdst-comp .stc-prep i{width:30px;height:30px;border-radius:50%;border:2.5px solid rgba(255,255,255,.18);border-top-color:#fff;animation:rdstSpin .8s linear infinite}'+
  '#rdst-comp.ready .stc-prep{opacity:0;pointer-events:none}'+
  '#rdst-comp .stc-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 12px 12px 16px;min-height:68px;box-sizing:border-box}'+
  '#rdst-comp .stc-who{display:flex;align-items:center;gap:10px;min-width:0;color:#fff;font-family:var(--font);font-size:13.5px;font-weight:600}'+
  '#rdst-comp .stc-who b{width:30px;height:30px;border-radius:50%;background:#2a2a2a center/cover no-repeat;flex-shrink:0;box-shadow:0 0 0 2px #000,0 0 0 3.5px #e04aa8}'+
  '#rdst-comp .stc-who span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'+
  '#rdst-comp .stc-go{height:46px;padding:0 20px 0 22px;border-radius:100px;border:0;background:#e6f03b;color:#0b0b0b;font-family:var(--font);font-size:15px;font-weight:700;letter-spacing:-.2px;display:inline-flex;align-items:center;gap:8px;cursor:pointer;flex-shrink:0;box-shadow:0 8px 24px rgba(230,240,59,.18);transition:transform .15s '+EASE+',opacity .2s}'+
  '#rdst-comp .stc-go:active{transform:scale(.95)}'+
  '#rdst-comp .stc-go[disabled]{opacity:.45}'+
  '#rdst-comp .stc-go svg{width:17px;height:17px}'+
  /* píldora de subida */
  '#rdst-pill{position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 104px);z-index:9995;display:flex;align-items:center;gap:11px;height:56px;padding:0 18px 0 8px;border-radius:100px;background:rgba(22,22,22,.92);-webkit-backdrop-filter:blur(24px) saturate(160%);backdrop-filter:blur(24px) saturate(160%);box-shadow:0 14px 40px rgba(0,0,0,.45),inset 0 0 0 1px rgba(255,255,255,.08);color:#fff;font-family:var(--font);transform:translate(-50%,0);max-width:calc(100vw - 32px);box-sizing:border-box;cursor:default}'+
  'html[data-theme="light"] #rdst-pill{background:rgba(255,255,255,.94);color:#111;box-shadow:0 14px 40px rgba(0,0,0,.16),inset 0 0 0 1px rgba(0,0,0,.06)}'+
  '#rdst-pill .stp-th{position:relative;width:40px;height:40px;flex-shrink:0}'+
  '#rdst-pill .stp-th b{position:absolute;inset:4px;border-radius:50%;background:#333 center/cover no-repeat}'+
  '#rdst-pill .stp-th svg.r{position:absolute;inset:0;width:40px;height:40px;transform:rotate(-90deg)}'+
  '#rdst-pill .stp-th svg.r circle{fill:none;stroke-width:3;stroke-linecap:round}'+
  '#rdst-pill .stp-th .bg{stroke:rgba(255,255,255,.14)}'+
  'html[data-theme="light"] #rdst-pill .stp-th .bg{stroke:rgba(0,0,0,.1)}'+
  '#rdst-pill .stp-th .fg{stroke:#e6f03b;stroke-dasharray:113.1;stroke-dashoffset:113.1;transition:stroke-dashoffset .25s linear}'+
  'html[data-theme="light"] #rdst-pill .stp-th .fg{stroke:#111}'+
  '#rdst-pill .stp-ok{position:absolute;inset:4px;border-radius:50%;background:#e6f03b;display:flex;align-items:center;justify-content:center;transform:scale(0);transition:transform .45s cubic-bezier(.34,1.56,.64,1)}'+
  '#rdst-pill .stp-ok svg{width:18px;height:18px;color:#0b0b0b}'+
  '#rdst-pill .stp-ok path{stroke-dasharray:24;stroke-dashoffset:24;transition:stroke-dashoffset .35s ease .2s}'+
  '#rdst-pill.done .stp-ok{transform:scale(1)}'+
  '#rdst-pill.done .stp-ok path{stroke-dashoffset:0}'+
  '#rdst-pill.done .fg{stroke-dashoffset:0!important}'+
  '#rdst-pill .stp-tx{display:flex;flex-direction:column;min-width:0;line-height:1.2}'+
  '#rdst-pill .stp-t{font-size:14px;font-weight:700;letter-spacing:-.2px;white-space:nowrap}'+
  '#rdst-pill .stp-s{font-size:12px;opacity:.6;font-variant-numeric:tabular-nums;white-space:nowrap}'+
  '#rdst-pill .stp-retry{margin-left:6px;height:34px;padding:0 14px;border-radius:100px;border:0;background:#e6f03b;color:#0b0b0b;font-family:var(--font);font-size:13px;font-weight:700;cursor:pointer;display:none}'+
  '#rdst-pill.err .stp-retry{display:inline-flex;align-items:center}'+
  '#rdst-pill.err .fg{stroke:#ff5a4a}'+
  '@media (prefers-reduced-motion:reduce){.rdst-it,#story-viewer,#rdst-comp{transition:none}}';
  function injectCss(){
    if(document.getElementById('rd-stories-css')) return;
    var s=document.createElement('style'); s.id='rd-stories-css'; s.textContent=css; document.head.appendChild(s);
  }

  var ICON_PLUS='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="square"><path d="M12 4v16M4 12h16"/></svg>';
  var ICON_X='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var ICON_SND='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
  var ICON_MUTE='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="m16 9 6 6M22 9l-6 6"/></svg>';
  var ICON_SEND='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/></svg>';
  var ICON_TRASH='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3"/></svg>';
  var ICON_KYC='<svg viewBox="0 0 24 24" style="width:13px;height:13px;flex-shrink:0"><circle cx="12" cy="12" r="11" fill="#1d9bf0"/><path fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="M7.5 12.3l3 3 6-6.5"/></svg>';

  /* =================== BANDEJA (solo app) =================== */
  var tray=null, trayOpen=false, trayBusy=false;
  function hubHeader(){ var h=document.getElementById('mkt-hub-actions'); return h&&h.closest('.section-header'); }
  function hubVisible(){ var h=document.getElementById('mkt-hub-actions'); return !!(h&&h.offsetParent&&getComputedStyle(h).display!=='none'); }
  function ensureTray(){
    if(tray&&tray.isConnected) return tray;
    var hdr=hubHeader(); if(!hdr) return null;
    tray=document.createElement('div'); tray.id='rd-st-tray'; tray.setAttribute('aria-label','historias');
    tray.innerHTML='<div class="rdst-row"></div>';
    hdr.insertAdjacentElement('afterend',tray);
    return tray;
  }
  function addBtnHtml(){ return '<button type="button" class="rdst-it rdst-add" aria-label="publicar historia" data-add="1"><span class="rdst-prog"></span><span class="rdst-ph">'+ICON_PLUS+'</span></button>'; }
  function itemHtml(g,i){
    var s=g.last, v=isVideo(s.media_url);
    return '<button type="button" class="rdst-it'+(g.seen?' seen':'')+(v?' vid':'')+'" data-g="'+i+'" aria-label="historia de '+esc(s._name)+'"><span class="rdst-ring"></span><span class="rdst-in"><span class="rdst-ph">'+
      (v?'<video muted playsinline preload="metadata" src="'+esc(s.media_url)+'#t=0.1"></video>':'<img alt="" decoding="async" src="'+esc(thumb(s.media_url,216))+'">')+
      '</span></span></button>';
  }
  function paintRow(groups,animate){
    var row=tray&&tray.querySelector('.rdst-row'); if(!row) return;
    var html=addBtnHtml();
    if(groups===null){ html+='<span class="rdst-wait" aria-label="cargando"></span>'; }
    else if(!groups.length){ html+='<span class="rdst-empty">Todavía no hay historias hoy. Sé el primero en publicar.</span>'; }
    else groups.forEach(function(g,i){ html+=itemHtml(g,i); });
    var sig=groups===null?'wait':groups.map(function(g){ return g.user_id+':'+g.items.length+':'+(g.seen?1:0); }).join('|');
    if(row.dataset.sig===sig&&!animate){ syncUploadUi(); return; }
    row.dataset.sig=sig;
    row.innerHTML=html;
    row.querySelectorAll('img,video').forEach(function(m){
      var on=function(){ m.classList.add('on'); };
      if(m.tagName==='IMG'){ if(m.complete&&m.naturalWidth) on(); else m.addEventListener('load',on,{once:true}); }
      else m.addEventListener('loadeddata',on,{once:true});
    });
    if(animate&&row.animate){
      [].forEach.call(row.children,function(el,i){
        el.animate([{opacity:0,transform:'translateY(-10px) scale(.72)'},{opacity:1,transform:'none'}],{duration:460,delay:70+i*45,easing:'cubic-bezier(.34,1.45,.64,1)',fill:'backwards'});
      });
    }
    syncUploadUi();
  }
  function onTrayClick(e){
    var b=e.target.closest('.rdst-it'); if(!b||!tray.contains(b)) return;
    haptic();
    if(b.dataset.add){ window._storyPublishFlow(); return; }
    var gi=+b.dataset.g; if(cache.groups&&cache.groups[gi]) openViewer(cache.groups,gi,b);
  }
  /* empuje del contenido: FLIP con transform sobre los hermanos visibles bajo el encabezado */
  function followers(){
    var hdr=hubHeader(), out=[], vh=window.innerHeight; if(!hdr) return out;
    for(var el=tray.nextElementSibling; el; el=el.nextElementSibling){
      if(el.offsetParent===null&&getComputedStyle(el).position!=='fixed') continue;
      var cs=getComputedStyle(el); if(cs.position==='fixed'||cs.position==='absolute') continue;
      var r=el.getBoundingClientRect(); if(r.top>vh+200) break;
      out.push(el);
    }
    return out;
  }
  function animateTray(open){
    var H=tray.offsetHeight, fl=followers(), dur=open?560:440;
    var from=open?-H:0, to=open?0:-H;
    var anims=fl.map(function(el){ return el.animate([{transform:'translate3d(0,'+from+'px,0)'},{transform:'translate3d(0,'+to+'px,0)'}],{duration:dur,easing:EASE,fill:'both'}); });
    var clipFrom=open?'inset(0 0 100% 0)':'inset(0 0 0 0)', clipTo=open?'inset(0 0 0 0)':'inset(0 0 100% 0)';
    anims.push(tray.animate([{clipPath:clipFrom,webkitClipPath:clipFrom},{clipPath:clipTo,webkitClipPath:clipTo}],{duration:dur,easing:EASE,fill:'both'}));
    if(!open){ var row=tray.querySelector('.rdst-row'); anims.push(row.animate([{opacity:1,transform:'none'},{opacity:0,transform:'translateY(-14px) scale(.96)'}],{duration:dur*.7,easing:EASE,fill:'both'})); }
    return Promise.all(anims.map(function(a){ return a.finished.catch(function(){}); })).then(function(){ return anims; });
  }
  function openTray(){
    if(trayOpen||trayBusy||!ensureTray()) return;
    trayBusy=true; trayOpen=true; haptic();
    var btn=document.querySelector('#mkt-hub-actions .mkt-hub-btn'); if(btn) btn.setAttribute('aria-expanded','true');
    var hadData=!!cache.groups;
    paintRow(hadData?cache.groups:null,true);
    tray.style.display='block';
    animateTray(true).then(function(anims){ anims.forEach(function(a){ try{a.cancel();}catch(e){} }); trayBusy=false; });
    load(!hadData?false:Date.now()-cache.ts>60000).then(function(g){
      if(!trayOpen) return;
      if(!hadData) paintRow(g,true); else { refreshSeenFlags(); paintRow(g,false); }
      prefetchFirst(g);
    }).catch(function(e){ console.warn('[ruedda stories]',e&&e.message||e); if(trayOpen&&!hadData) paintRow([],false); });
  }
  function closeTray(instant){
    if(!trayOpen||!tray) return;
    trayOpen=false;
    var btn=document.querySelector('#mkt-hub-actions .mkt-hub-btn'); if(btn) btn.setAttribute('aria-expanded','false');
    if(instant){ tray.style.display='none'; return; }
    trayBusy=true;
    animateTray(false).then(function(anims){
      tray.style.display='none';
      anims.forEach(function(a){ try{a.cancel();}catch(e){} });
      trayBusy=false;
    });
  }
  function toggleTray(){ if(trayBusy) return; trayOpen?closeTray():openTray(); }

  /* =================== VISOR =================== */
  var V=null; // estado del visor
  function openViewer(groups,gi,fromEl){
    if(document.getElementById('story-viewer')||!groups||!groups.length) return;
    injectCss();
    var seen=seenSet(), g=groups[gi], si=0;
    for(var k=0;k<g.items.length;k++){ if(!seen.has(g.items[k].id)){ si=k; break; } }
    var v=document.createElement('div'); v.id='story-viewer'; v.setAttribute('role','dialog'); v.setAttribute('aria-label','historias');
    v.innerHTML='<div class="stv-stage"><div class="stv-load"></div>'+
      '<div class="stv-top"><div class="stv-bars"></div><div class="stv-head"><div class="stv-who" role="button" tabindex="0" aria-label="ver perfil"><div class="stv-av"></div><div class="stv-un"></div></div><div class="stv-t"></div><div class="stv-sp"></div>'+
      '<button type="button" class="stv-btn stv-mute" aria-label="sonido">'+ICON_SND+'</button>'+
      '<button type="button" class="stv-btn stv-x" aria-label="cerrar">'+ICON_X+'</button></div></div></div>'+
      '<div class="stv-foot"></div><button type="button" class="stv-x-d" aria-label="cerrar">'+ICON_X+'</button>';
    document.body.appendChild(v);
    V={el:v,stage:v.querySelector('.stv-stage'),groups:groups,gi:gi,si:si,media:null,raf:0,t0:0,acc:0,dur:IMG_DUR,paused:true,ready:false,muted:false,hold:0,holding:false,hiddenPause:false};
    var prevOverflow=document.body.style.overflow; V.prevOverflow=prevOverflow; document.body.style.overflow='hidden';
    // entrada: crece desde el círculo tocado
    if(fromEl&&V.stage.animate){
      var r=fromEl.getBoundingClientRect(), sr=V.stage.getBoundingClientRect();
      var sx=r.width/sr.width, tx=(r.left+r.width/2)-(sr.left+sr.width/2), ty=(r.top+r.height/2)-(sr.top+sr.height*.4);
      V.stage.animate([{transform:'translate('+tx+'px,'+ty+'px) scale('+sx+')',borderRadius:'50%'},{transform:'none',borderRadius:'18px'}],{duration:420,easing:EASE});
    }
    requestAnimationFrame(function(){ v.classList.add('in'); });
    v.querySelector('.stv-x').onclick=function(e){ e.stopPropagation(); closeViewer(); };
    v.querySelector('.stv-who').onclick=function(e){ e.stopPropagation(); var s=cur(); if(!s) return; haptic(); var uid=s.user_id; closeViewer(); setTimeout(function(){ try{ if(typeof openUserProfile==='function') openUserProfile(uid); }catch(_){} },240); };
    v.querySelector('.stv-x-d').onclick=function(e){ e.stopPropagation(); closeViewer(); };
    v.querySelector('.stv-mute').onclick=function(e){ e.stopPropagation(); V.muted=!V.muted; if(V.media&&V.media.tagName==='VIDEO'){ V.media.muted=V.muted; if(!V.muted) V.media.play().catch(function(){}); } paintMute(); };
    bindGestures();
    document.addEventListener('visibilitychange',onVis);
    play();
  }
  function paintMute(){ if(!V) return; var b=V.el.querySelector('.stv-mute'); if(b) b.innerHTML=V.muted?ICON_MUTE:ICON_SND; }
  function onVis(){ if(!V) return; if(document.hidden){ if(!V.paused){ V.hiddenPause=true; pause(); } } else if(V.hiddenPause){ V.hiddenPause=false; resume(); } }
  function cur(){ var g=V.groups[V.gi]; return g&&g.items[V.si]; }
  function paintBars(){
    var g=V.groups[V.gi], bars=V.el.querySelector('.stv-bars');
    bars.innerHTML=g.items.map(function(_,i){ return '<div class="stv-bar"><i style="transform:scaleX('+(i<V.si?1:0)+')"></i></div>'; }).join('');
  }
  function fill(p){ var b=V.el.querySelectorAll('.stv-bar i')[V.si]; if(b) b.style.transform='scaleX('+Math.max(0,Math.min(1,p))+')'; }
  function paintHead(s){
    var u=s.users||{};
    V.el.querySelector('.stv-av').innerHTML=s._avatar?'<img alt="" src="'+esc(s._avatar)+'">':'';
    V.el.querySelector('.stv-un').innerHTML='<span>@'+esc(u.username||s._name)+'</span>'+(u.kyc_verified?ICON_KYC:'');
    V.el.querySelector('.stv-t').textContent=(typeof _storyTimeAgo==='function'?_storyTimeAgo(s.created_at):'').replace(/^Hace /,'').replace('min',' min');
    var foot=V.el.querySelector('.stv-foot');
    if(s.user_id===me()){
      foot.innerHTML='<button type="button" class="stv-del">'+ICON_TRASH+'eliminar historia</button>';
      foot.querySelector('.stv-del').onclick=function(e){ e.stopPropagation(); delStory(s); };
    }else{
      var lk=liked().has(s.id);
      foot.innerHTML='<input id="story-reply-input" class="stv-in" placeholder="enviar mensaje" enterkeyhint="send" autocomplete="off"><button type="button" class="stv-like'+(lk?' on':'')+'" aria-label="me gusta">'+(lk?ICON_HEART_F:ICON_HEART)+'</button><button type="button" class="stv-send" aria-label="enviar">'+ICON_SEND+'</button>';
      foot.querySelector('.stv-like').onclick=function(e){ e.stopPropagation(); toggleLike(s,this); };
      var inp=foot.querySelector('input');
      inp.addEventListener('focus',function(){ if(typeof isGuest==='function'&&isGuest()){ toast('inicia sesión para enviar mensajes'); inp.blur(); return; } pause(); });
      inp.addEventListener('blur',function(){ setTimeout(function(){ if(V&&!V.holding) resume(); },60); });
      var send=function(){ if(typeof _storySendReply==='function') _storySendReply(s); inp.blur(); };
      inp.addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); send(); } });
      foot.querySelector('.stv-send').onclick=function(e){ e.stopPropagation(); send(); };
    }
  }
  function play(){
    if(!V) return;
    var s=cur(); if(!s){ closeViewer(); return; }
    cancelAnimationFrame(V.raf); V.paused=true; V.ready=false; V.acc=0; V.dur=IMG_DUR;
    paintBars(); paintHead(s);
    var old=V.media; if(old){ if(old.tagName==='VIDEO'){ try{old.pause(); old.removeAttribute('src'); old.load();}catch(e){} } old.remove(); }
    var vid=isVideo(s.media_url), m;
    V.el.classList.toggle('has-vid',vid); V.el.classList.add('loading');
    if(vid){
      m=document.createElement('video'); m.className='stv-media'; m.playsInline=true; m.setAttribute('playsinline',''); m.setAttribute('webkit-playsinline',''); m.preload='auto'; m.muted=V.muted;
      m.addEventListener('loadedmetadata',function(){ if(m.videoHeight&&tooWide(m.videoWidth,m.videoHeight,V&&V.stage)) m.classList.add('fit'); V&&(V.dur=Math.min(m.duration||IMG_DUR/1000,MAX_VIDEO_S)*1000); });
      m.addEventListener('playing',function(){ if(V&&V.media===m){ V.el.classList.remove('loading'); if(!V.ready){ V.ready=true; start(); } } });
      m.addEventListener('waiting',function(){ if(V&&V.media===m) V.el.classList.add('loading'); });
      m.addEventListener('ended',function(){ if(V&&V.media===m) next(); });
      m.addEventListener('error',function(){ if(V&&V.media===m){ V.el.classList.remove('loading'); toast('no se pudo reproducir este video'); setTimeout(function(){ if(V&&V.media===m) next(); },900); } });
      m.src=s.media_url;
      V.stage.insertBefore(m,V.stage.firstChild);
      V.media=m;
      var p=m.play();
      if(p&&p.catch) p.catch(function(){ if(!V||V.media!==m) return; V.muted=true; m.muted=true; paintMute(); m.play().catch(function(){}); });
      paintMute();
    }else{
      m=new Image(); m.className='stv-media'; m.alt=''; m.decoding='async';
      var done=function(){ if(!V||V.media!==m) return; if(tooWide(m.naturalWidth,m.naturalHeight,V.stage)) m.classList.add('fit'); V.el.classList.remove('loading'); V.ready=true; start(); };
      m.onload=function(){ (m.decode?m.decode():Promise.resolve()).catch(function(){}).then(done); };
      m.onerror=function(){ if(V&&V.media===m){ V.el.classList.remove('loading'); setTimeout(function(){ if(V&&V.media===m) next(); },600); } };
      m.src=thumb(s.media_url,Math.min(1440,Math.round((window.innerWidth||400)*(window.devicePixelRatio||2))));
      V.stage.insertBefore(m,V.stage.firstChild);
      V.media=m;
    }
    markSeen(s.id);
    // precarga la siguiente
    var g=V.groups[V.gi], nx=g.items[V.si+1]||(V.groups[V.gi+1]&&V.groups[V.gi+1].items[0]);
    if(nx&&!isVideo(nx.media_url)){ var pi=new Image(); pi.src=thumb(nx.media_url,Math.min(1440,Math.round((window.innerWidth||400)*(window.devicePixelRatio||2)))); }
  }
  function start(){ if(!V) return; V.paused=false; V.t0=performance.now(); loop(); }
  function loop(){
    cancelAnimationFrame(V.raf);
    var tick=function(now){
      if(!V||V.paused) return;
      var p;
      if(V.media&&V.media.tagName==='VIDEO'){ p=(V.media.currentTime*1000)/V.dur; if(V.media.currentTime*1000>=V.dur-30&&V.dur<(V.media.duration||0)*1000){ next(); return; } }
      else { p=(V.acc+now-V.t0)/V.dur; if(p>=1){ fill(1); next(); return; } }
      fill(p);
      V.raf=requestAnimationFrame(tick);
    };
    V.raf=requestAnimationFrame(tick);
  }
  function pause(){
    if(!V||V.paused) return;
    V.paused=true; cancelAnimationFrame(V.raf);
    if(V.media&&V.media.tagName==='VIDEO') V.media.pause(); else V.acc+=performance.now()-V.t0;
  }
  function resume(){
    if(!V||!V.paused||!V.ready) return;
    var a=document.activeElement; if(a&&a.id==='story-reply-input') return;
    if(V.media&&V.media.tagName==='VIDEO') V.media.play().catch(function(){});
    start();
  }
  function next(){
    if(!V) return;
    var g=V.groups[V.gi];
    if(V.si+1<g.items.length){ V.si++; play(); return; }
    nextGroup(1);
  }
  function prev(){
    if(!V) return;
    if(V.si>0){ V.si--; play(); return; }
    if(V.gi>0) nextGroup(-1); else play();
  }
  function nextGroup(d){
    if(!V) return;
    var ng=V.gi+d;
    if(ng<0||ng>=V.groups.length){ closeViewer(); return; }
    haptic();
    var st=V.stage;
    if(st.animate) st.animate([{opacity:.4,transform:'translateX('+(d>0?28:-28)+'px) scale(.97)'},{opacity:1,transform:'none'}],{duration:320,easing:EASE});
    V.gi=ng; V.si=0;
    var seen=seenSet(), g=V.groups[ng];
    if(d>0) for(var k=0;k<g.items.length;k++){ if(!seen.has(g.items[k].id)){ V.si=k; break; } }
    play();
  }
  function bindGestures(){
    var st=V.stage, x0=0, y0=0, t0=0, mode='', id=null;
    st.addEventListener('pointerdown',function(e){
      if(e.target.closest('.stv-btn,.stv-foot,.stv-who')) return;
      if(!V) return;
      id=e.pointerId; x0=e.clientX; y0=e.clientY; t0=performance.now(); mode='';
      try{ st.setPointerCapture(id); }catch(_){}
      clearTimeout(V.hold);
      V.hold=setTimeout(function(){ if(V&&!mode){ V.holding=true; V.el.classList.add('hold'); pause(); } },200);
    });
    st.addEventListener('pointermove',function(e){
      if(!V||e.pointerId!==id) return;
      var dx=e.clientX-x0, dy=e.clientY-y0;
      if(!mode){ if(dy>12&&Math.abs(dy)>Math.abs(dx)){ mode='down'; clearTimeout(V.hold); pause(); } else if(Math.abs(dx)>14&&Math.abs(dx)>Math.abs(dy)){ mode='side'; clearTimeout(V.hold); } }
      if(mode==='down'){ var k=Math.max(0,dy); st.style.transform='translate3d(0,'+k+'px,0) scale('+Math.max(.86,1-k/1400)+')'; V.el.style.backgroundColor='rgba(0,0,0,'+Math.max(.25,1-k/500)+')'; }
      else if(mode==='side'){ st.style.transform='translate3d('+dx*.35+'px,0,0)'; }
    });
    var end=function(e){
      if(!V||e.pointerId!==id) return;
      id=null; clearTimeout(V.hold);
      var dx=e.clientX-x0, dy=e.clientY-y0, dt=performance.now()-t0;
      if(mode==='down'){
        if(dy>110||(dy>40&&dy/dt>.55)){ closeViewer(true); return; }
        springBack(); resume(); return;
      }
      if(mode==='side'){
        springBack();
        if(Math.abs(dx)>60) nextGroup(dx<0?1:-1); else resume();
        return;
      }
      if(V.holding){ V.holding=false; V.el.classList.remove('hold'); resume(); return; }
      if(e.type==='pointercancel') return;
      var r=st.getBoundingClientRect();
      if(e.clientX-r.left<r.width*.3) prev(); else next();
    };
    st.addEventListener('pointerup',end);
    st.addEventListener('pointercancel',end);
    function springBack(){
      if(!V) return;
      var from=st.style.transform||'none'; st.style.transform=''; V.el.style.backgroundColor='';
      if(st.animate) st.animate([{transform:from},{transform:'none'}],{duration:380,easing:'cubic-bezier(.34,1.3,.64,1)'});
    }
    V.el.addEventListener('contextmenu',function(e){ e.preventDefault(); });
  }
  function closeViewer(fromDrag){
    if(!V) return;
    var s=V, v=s.el;
    V=null;
    cancelAnimationFrame(s.raf); clearTimeout(s.hold);
    document.removeEventListener('visibilitychange',onVis);
    if(s.media&&s.media.tagName==='VIDEO'){ try{ s.media.pause(); }catch(e){} }
    var t=s.stage.style.transform||'none';
    if(s.stage.animate) s.stage.animate([{transform:t,opacity:1},{transform:fromDrag?'translate3d(0,60vh,0) scale(.8)':'scale(.94)',opacity:0}],{duration:fromDrag?300:220,easing:EASE,fill:'forwards'});
    v.classList.remove('in'); v.style.backgroundColor='rgba(0,0,0,0)';
    setTimeout(function(){
      if(s.media&&s.media.tagName==='VIDEO'){ try{ s.media.removeAttribute('src'); s.media.load(); }catch(e){} }
      v.remove(); document.body.style.overflow=s.prevOverflow||'';
    },fromDrag?300:230);
    refreshSeenFlags();
    if(trayOpen&&cache.groups) paintRow(cache.groups,false);
  }
  /* me gusta: se guarda en el teléfono y al dueño le llega una notificación (una vez por historia) */
  var LIKE_KEY='rd_st_liked';
  var ICON_HEART='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 20.5s-7.5-4.6-9.3-9.6C1.6 7.6 3.8 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.2 0 5.4 3.1 4.3 6.4-1.8 5-9.3 9.6-9.3 9.6z"/></svg>';
  var ICON_HEART_F=ICON_HEART.replace('fill="none"','fill="currentColor"');
  function liked(){ try{ return new Set(JSON.parse(localStorage.getItem(LIKE_KEY)||'[]')); }catch(e){ return new Set(); } }
  function saveLiked(set){ try{ localStorage.setItem(LIKE_KEY,JSON.stringify([...set].slice(-300))); }catch(e){} }
  function toggleLike(s,btn){
    if(typeof isGuest==='function'&&isGuest()){ toast('inicia sesión para dar me gusta'); return; }
    var set=liked(), on=!set.has(s.id);
    if(on) set.add(s.id); else set.delete(s.id);
    saveLiked(set);
    btn.classList.toggle('on',on); btn.innerHTML=on?ICON_HEART_F:ICON_HEART;
    var ic=btn.querySelector('svg');
    if(ic&&ic.animate) ic.animate(on?[{transform:'scale(1)'},{transform:'scale(1.35)'},{transform:'scale(.92)'},{transform:'scale(1)'}]:[{transform:'scale(1)'},{transform:'scale(.8)'},{transform:'scale(1)'}],{duration:on?420:220,easing:'cubic-bezier(.34,1.45,.64,1)'});
    if(!on){ haptic(); return; }
    try{ if(typeof _rdHapticSuccess==='function') _rdHapticSuccess(); else haptic('MEDIUM'); }catch(e){}
    if(V){
      var b=document.createElement('div'); b.className='stv-burst'; b.innerHTML=ICON_HEART_F; V.stage.appendChild(b);
      if(b.animate) b.animate([{transform:'scale(.2)',opacity:0},{transform:'scale(1.12)',opacity:1,offset:.35},{transform:'scale(.96)',opacity:1,offset:.6},{transform:'scale(1.05) translateY(-30px)',opacity:0}],{duration:900,easing:'cubic-bezier(.22,.9,.3,1)',fill:'forwards'});
      setTimeout(function(){ b.remove(); },950);
    }
    var sent; try{ sent=new Set(JSON.parse(localStorage.getItem(LIKE_KEY+'_n')||'[]')); }catch(e){ sent=new Set(); }
    if(sent.has(s.id)||s.user_id===me()) return;
    sent.add(s.id); try{ localStorage.setItem(LIKE_KEY+'_n',JSON.stringify([...sent].slice(-300))); }catch(e){}
    var S=supa(), U=US(); if(!S) return;
    S.from('notifications').insert({user_id:s.user_id,tipo:'pm',titulo:'Le gustó tu historia',body:'@'+(U.username||U.nombre||'alguien')+' le dio me gusta a tu historia',icon:'lime',source_id:String(U.id),source_type:'pm'})
      .then(function(r){ if(r&&r.error) console.warn('[ruedda stories] like',r.error.message); });
  }
  async function delStory(s){
    if(!confirm('¿Eliminar esta historia?')) return;
    var S=supa(); if(!S) return;
    try{
      var r=await S.from('stories').delete().eq('id',s.id).select('id');
      if(r.error) throw r.error;
      if(!r.data||!r.data.length) throw new Error('sin permiso');
      var m=String(s.media_url).split('/object/public/stories/')[1];
      if(m) S.storage.from('stories').remove([decodeURIComponent(m.split('?')[0])]).catch(function(){});
      toast('historia eliminada',true);
      if(V){ var g=V.groups[V.gi]; g.items.splice(V.si,1);
        if(!g.items.length){ V.groups.splice(V.gi,1); if(!V.groups.length){ closeViewer(); } else { if(V.gi>=V.groups.length) V.gi=V.groups.length-1; V.si=0; play(); } }
        else { if(V.si>=g.items.length) V.si=g.items.length-1; play(); } }
      cache.ts=0;
      if(trayOpen) load(true).then(function(g){ if(trayOpen) paintRow(g,false); }).catch(function(){});
    }catch(e){ console.warn('[ruedda stories] borrar',e&&e.message||e); toast('no se pudo eliminar la historia'); }
  }

  /* abrir todo sin bandeja (web, o cuando el hub no está a la vista) */
  async function openAll(){
    injectCss();
    try{
      var g=await load(false);
      if(!g.length){ toast('no hay historias recientes'); return; }
      var gi=0; for(var i=0;i<g.length;i++){ if(!g[i].seen&&!g[i].mine){ gi=i; break; } }
      openViewer(g,gi,null);
    }catch(e){ console.warn('[ruedda stories]',e&&e.message||e); toast('error cargando historias'); }
  }

  /* =================== PUBLICAR (foto o video) =================== */
  var up={on:false,p:0};
  function syncUploadUi(){
    var b=tray&&tray.querySelector('.rdst-add'); if(b){ b.classList.toggle('up',up.on); b.style.setProperty('--p',Math.round(up.p*100)+'%'); }
    var pb=document.getElementById('story-publish-btn');
    if(pb){
      if(up.on){ if(!pb.dataset.lbl) pb.dataset.lbl=pb.innerHTML; pb.disabled=true; pb.innerHTML='<span style="opacity:.75">subiendo '+Math.round(up.p*100)+'%</span>'; }
      else if(pb.dataset.lbl){ pb.innerHTML=pb.dataset.lbl; delete pb.dataset.lbl; pb.disabled=false; }
    }
  }
  function videoMeta(file){
    return new Promise(function(res){
      var u=URL.createObjectURL(file), v=document.createElement('video'), t=setTimeout(function(){ fin(null); },8000);
      function fin(d){ clearTimeout(t); URL.revokeObjectURL(u); res(d); }
      v.preload='metadata'; v.muted=true;
      v.onloadedmetadata=function(){ fin(v.duration); }; v.onerror=function(){ fin(null); };
      v.src=u;
    });
  }
  async function uploadXhr(path,body,type){
    var S=supa(), base=S&&S.supabaseUrl, key=S&&S.supabaseKey;
    var tok=null; try{ tok=(await S.auth.getSession()).data.session.access_token; }catch(e){}
    if(!base||!key||!tok){ var r=await S.storage.from('stories').upload(path,body,{contentType:type}); if(r.error) throw r.error; return; }
    await new Promise(function(res,rej){
      var x=new XMLHttpRequest();
      x.open('POST',String(base).replace(/\/$/,'')+'/storage/v1/object/stories/'+path.split('/').map(encodeURIComponent).join('/'));
      x.setRequestHeader('Authorization','Bearer '+tok); x.setRequestHeader('apikey',key);
      x.setRequestHeader('Content-Type',type); x.setRequestHeader('x-upsert','false'); x.setRequestHeader('cache-control','max-age=3600');
      x.upload.onprogress=function(e){ if(e.lengthComputable){ up.p=Math.min(.97,e.loaded/e.total); syncUploadUi(); } };
      x.onload=function(){ x.status>=200&&x.status<300?res():rej(new Error('upload '+x.status+' '+(x.responseText||'').slice(0,160))); };
      x.onerror=function(){ rej(new Error('red')); };
      x.send(body);
    });
  }
  /* --- píldora flotante de progreso --- */
  var pill=null, pillHide=0;
  var ICON_CHECK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  function pillShow(thumbUrl){
    clearTimeout(pillHide);
    if(pill) pill.remove();
    pill=document.createElement('div'); pill.id='rdst-pill'; pill.setAttribute('role','status');
    pill.innerHTML='<div class="stp-th"><b'+(thumbUrl?' style="background-image:url(\''+thumbUrl+'\')"':'')+'></b><svg class="r" viewBox="0 0 40 40"><circle class="bg" cx="20" cy="20" r="18"/><circle class="fg" cx="20" cy="20" r="18"/></svg><span class="stp-ok">'+ICON_CHECK+'</span></div>'+
      '<div class="stp-tx"><span class="stp-t">Subiendo tu historia</span><span class="stp-s">preparando…</span></div><button type="button" class="stp-retry">reintentar</button>';
    document.body.appendChild(pill);
    if(pill.animate) pill.animate([{opacity:0,transform:'translate(-50%,24px) scale(.9)'},{opacity:1,transform:'translate(-50%,0) scale(1)'}],{duration:480,easing:'cubic-bezier(.34,1.4,.64,1)'});
  }
  function pillSet(p,sub,title){
    if(!pill) return;
    if(p!=null) pill.querySelector('.fg').style.strokeDashoffset=(113.1*(1-Math.max(0,Math.min(1,p)))).toFixed(1);
    if(sub!=null) pill.querySelector('.stp-s').textContent=sub;
    if(title!=null) pill.querySelector('.stp-t').textContent=title;
  }
  function pillClose(delay){
    var el=pill; clearTimeout(pillHide);
    pillHide=setTimeout(function(){
      if(!el||!el.isConnected) return;
      if(el.animate){ var a=el.animate([{opacity:1,transform:'translate(-50%,0) scale(1)'},{opacity:0,transform:'translate(-50%,16px) scale(.92)'}],{duration:320,easing:EASE,fill:'forwards'}); a.finished.then(function(){ el.remove(); }).catch(function(){ el.remove(); }); }
      else el.remove();
      if(pill===el) pill=null;
    },delay||0);
  }
  function fmtMB(b){ return (b/1048576).toFixed(b>10485760?0:1).replace('.',',')+' MB'; }

  /* --- compositor: vista previa a pantalla completa antes de compartir --- */
  var comp=null;
  function openComposer(file,vid){
    injectCss();
    if(comp) closeComposer(true);
    var url=URL.createObjectURL(file), U=US();
    var el=document.createElement('div'); el.id='rdst-comp'; el.setAttribute('role','dialog'); el.setAttribute('aria-label','nueva historia');
    el.innerHTML='<div class="stc-stage"><div class="stc-prep"><i></i><span>cargando vista previa…</span></div>'+
      '<div class="stc-top"><button type="button" class="stc-x" aria-label="descartar">'+ICON_X+'</button><span class="stc-chip">'+(vid?'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l10.5-6.5z"/></svg>video':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="12" cy="12" r="3.2"/></svg>foto')+' · 24 h</span>'+
      (vid?'<button type="button" class="stc-x stc-snd" aria-label="sonido">'+ICON_MUTE+'</button>':'<span style="width:44px"></span>')+'</div></div>'+
      '<div class="stc-foot"><div class="stc-who"><b'+(U.avatar?' style="background-image:url(\''+esc(U.avatar)+'\')"':'')+'></b><span>tu historia</span></div>'+
      '<button type="button" class="stc-go" disabled>compartir<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></div>';
    document.body.appendChild(el);
    var prevOv=document.body.style.overflow; document.body.style.overflow='hidden';
    comp={el:el,url:url,file:file,vid:vid,prevOv:prevOv,thumb:null};
    var stage=el.querySelector('.stc-stage'), go=el.querySelector('.stc-go'), m;
    var ready=function(){ if(!comp||comp.el!==el) return; el.classList.add('ready'); go.disabled=false; };
    if(vid){
      m=document.createElement('video'); m.className='stc-media'; m.muted=true; m.loop=true; m.playsInline=true; m.setAttribute('playsinline',''); m.autoplay=true;
      m.addEventListener('loadeddata',function(){
        if(tooWide(m.videoWidth,m.videoHeight,stage)) m.classList.add('fit');
        try{ var c=document.createElement('canvas'), k=96/Math.max(m.videoWidth,m.videoHeight); c.width=Math.round(m.videoWidth*k); c.height=Math.round(m.videoHeight*k); c.getContext('2d').drawImage(m,0,0,c.width,c.height); comp&&(comp.thumb=c.toDataURL('image/jpeg',.7)); }catch(e){}
        ready();
      },{once:true});
      m.addEventListener('error',function(){ ready(); },{once:true});
      m.src=url; m.play().catch(function(){});
      var snd=el.querySelector('.stc-snd');
      snd.onclick=function(){ m.muted=!m.muted; snd.innerHTML=m.muted?ICON_MUTE:ICON_SND; if(!m.muted) m.play().catch(function(){}); };
    }else{
      m=new Image(); m.className='stc-media'; m.alt='';
      m.onload=function(){ if(tooWide(m.naturalWidth,m.naturalHeight,stage)) m.classList.add('fit'); comp&&(comp.thumb=url); ready(); };
      m.onerror=function(){ toast('no se pudo abrir esta imagen'); closeComposer(); };
      m.src=url;
    }
    stage.insertBefore(m,stage.firstChild);
    requestAnimationFrame(function(){ el.classList.add('in'); });
    if(stage.animate) stage.animate([{transform:'translateY(40px) scale(.94)',opacity:.4},{transform:'none',opacity:1}],{duration:460,easing:EASE});
    el.querySelector('.stc-x').onclick=function(){ haptic(); closeComposer(); };
    go.onclick=function(){
      if(go.disabled) return;
      haptic('MEDIUM');
      var c=comp, th=c.thumb;
      // la vista previa se encoge hacia la píldora de subida
      if(stage.animate){
        var a=stage.animate([{transform:'none',opacity:1,borderRadius:'18px'},{transform:'translateY(32vh) scale(.12)',opacity:0,borderRadius:'50%'}],{duration:420,easing:EASE,fill:'forwards'});
        el.querySelector('.stc-foot').style.opacity='0';
        setTimeout(function(){ el.classList.remove('in'); },180);
        a.finished.catch(function(){}).then(function(){ closeComposer(true,true); });
      } else closeComposer(true,true);
      upload(c.file,c.vid,th,c.url);
    };
  }
  function closeComposer(instant,keepUrl){
    var c=comp; if(!c) return; comp=null;
    var v=c.el.querySelector('video'); if(v){ try{ v.pause(); v.removeAttribute('src'); v.load(); }catch(e){} }
    var fin=function(){ c.el.remove(); document.body.style.overflow=c.prevOv||''; if(!keepUrl) URL.revokeObjectURL(c.url); };
    if(instant){ fin(); return; }
    c.el.classList.remove('in'); setTimeout(fin,230);
  }

  async function upload(file,vid,thumbUrl,objUrl){
    var S=supa(), uid=me(); if(!S||!uid) return;
    up.on=true; up.p=0; syncUploadUi();
    pillShow(thumbUrl);
    var retry=function(){ upload(file,vid,thumbUrl,objUrl); };
    try{
      var body,type,ext;
      if(vid){
        body=file; type=file.type||'video/mp4';
        ext=((file.name||'').match(/\.(mp4|mov|m4v|webm|3gp)$/i)||[,type.indexOf('quicktime')>=0?'mov':'mp4'])[1].toLowerCase();
      }else{
        pillSet(.04,'optimizando foto…');
        var dataUrl=await _kycCompress(file,1440);
        body=await (await fetch(dataUrl)).blob(); type='image/jpeg'; ext='jpg';
      }
      var total=body.size||0, t0=performance.now();
      pillSet(.06,'0% · '+fmtMB(total));
      var path=uid+'/'+Date.now()+'.'+ext;
      var _sync=syncUploadUi;
      syncUploadUi=function(){ _sync(); var p=up.p; pillSet(.06+p*.88,Math.round(p*100)+'% · '+fmtMB(total*p)+' de '+fmtMB(total)); };
      try{ await uploadXhr(path,body,type); } finally { syncUploadUi=_sync; }
      pillSet(.96,'publicando…');
      var url=S.storage.from('stories').getPublicUrl(path).data.publicUrl;
      var ins=await S.from('stories').insert({user_id:uid,media_url:url});
      if(ins.error) throw ins.error;
      up.p=1;
      if(pill){ pill.classList.add('done'); }
      pillSet(1,'ya la pueden ver todos','Historia publicada');
      try{ if(typeof _rdHapticSuccess==='function') _rdHapticSuccess(); else haptic('MEDIUM'); }catch(e){}
      if(typeof _storyBumpBadgeLocal==='function') _storyBumpBadgeLocal();
      cache.ts=0;
      if(trayOpen) load(true).then(function(g){ if(trayOpen) paintRow(g,true); }).catch(function(){});
      pillClose(2200);
      if(objUrl) setTimeout(function(){ URL.revokeObjectURL(objUrl); },2500);
      console.info('[ruedda stories] subida en',Math.round(performance.now()-t0),'ms');
    }catch(e){
      console.warn('[ruedda stories] publicar',e&&e.message||e);
      haptic('HEAVY');
      if(pill){ pill.classList.add('err'); pillSet(null,'revisa tu conexión','No se pudo subir'); var rb=pill.querySelector('.stp-retry'); rb.onclick=function(){ haptic(); retry(); }; pill.onclick=null; }
      pillClose(9000);
    }finally{ up.on=false; up.p=0; syncUploadUi(); }
  }
  async function publishFile(file){
    var vid=/^video\//.test(file.type)||VIDEO_RE.test(file.name||'');
    if(vid){
      if(file.size>MAX_BYTES){ toast('el video pesa más de 50 MB'); return; }
      var d=await videoMeta(file);
      if(d&&d>MAX_VIDEO_S+0.5){ toast('el video puede durar máximo '+MAX_VIDEO_S+' segundos'); return; }
    }
    openComposer(file,vid);
  }
  function publishFlow(){
    if(up.on){ toast('ya se está subiendo tu historia'); return; }
    if(typeof isGuest==='function'&&isGuest()){ toast('inicia sesión para publicar historias'); return; }
    var U=US();
    var dealer=U.role==='consesionario'||U.role==='concesionario';
    var admin=(typeof isSuperAdmin==='function'&&isSuperAdmin())||U.role==='superadmin';
    if(!dealer&&!admin&&!U.kycVerified){ if(typeof _showStoryKycGateSplash==='function') _showStoryKycGateSplash(); return; }
    var input=document.createElement('input');
    input.type='file'; input.accept='image/*,video/*'; input.style.display='none';
    document.body.appendChild(input);
    input.onchange=function(){ var f=input.files&&input.files[0]; input.remove(); if(f) publishFile(f); };
    input.click();
  }

  /* =================== conexión con el index =================== */
  window.openStories=function(){
    injectCss();
    if(NATIVE&&hubVisible()){ toggleTray(); return; }
    openAll();
  };
  window._storyPublishFlow=publishFlow;
  window._closeStoryViewer=function(){ closeViewer(); };
  window._rdStoriesClose=function(){ closeTray(true); };
  if(/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) window._rdStoriesDebug={openComposer:openComposer,pillShow:pillShow,pillSet:pillSet,pillDone:function(){ pill&&pill.classList.add('done'); pillSet(1,'ya la pueden ver todos','Historia publicada'); }};

  function hook(){
    injectCss();
    document.addEventListener('click',function(e){ if(tray&&tray.contains(e.target)) onTrayClick(e); });
    var sel=window.selectSection;
    if(typeof sel==='function') window.selectSection=function(s){ if(s!=='market') closeTray(true); return sel.apply(this,arguments); };
    if(NATIVE) setTimeout(function(){ load(false).then(prefetchFirst).catch(function(){}); },2500);
    var bk=window.RDBack;
    window.RDBack=function(){ if(comp){ closeComposer(); return true; } if(V){ closeViewer(); return true; } if(trayOpen){ closeTray(); return true; } return typeof bk==='function'?bk.apply(this,arguments):false; };
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',hook); else hook();
})();
