/* ─────────────────────────────────────────────────────────────
   RUEDDA · MAPAS (app, web móvil y desktop)
   Una sola hoja de mapa con tres versiones:
     · market     → carros por ciudad (puntos amarillos con cantidad) — el de siempre
     · agencias   → concesionarios con su LOGO cuadrado
     · fotografos → fotógrafos con su foto cuadrada
   Fluidez: la librería (MapLibre) se empieza a bajar al tocar el botón; el mapa se
   arma recién cuando la hoja terminó de subir (nunca a mitad de la animación); la
   misma instancia se reutiliza entre aperturas; solo se pide Venezuela.
   Mismo diseño que la hoja de ciudades original (#rd-city-sheet).
   ───────────────────────────────────────────────────────────── */
(function(){
  if(window.RDMap) return;
  var DESK=(document.currentScript&&document.currentScript.getAttribute('data-desktop'))==='1';

  // ── librería: una sola vez, al primer toque ──
  var libP=null;
  function lib(){
    if(window.maplibregl) return Promise.resolve(window.maplibregl);
    if(libP) return libP;
    libP=new Promise(function(res,rej){
      var css=document.createElement('link'); css.rel='stylesheet'; css.href='https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.min.css'; document.head.appendChild(css);
      var js=document.createElement('script'); js.src='https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.min.js'; js.async=true;
      js.onload=function(){ res(window.maplibregl); }; js.onerror=function(){ libP=null; rej(new Error('maplibre')); };
      document.head.appendChild(js);
    });
    return libP;
  }

  var CSS=
  '#rd-city-sheet{position:fixed;inset:0;z-index:400;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,0);transition:background .24s ease}'+
  '#rd-city-sheet.on{background:rgba(0,0,0,.35)}'+
  '#rd-city-inner{width:100%;max-width:560px;max-height:90vh;max-height:90dvh;overflow-y:auto;overscroll-behavior:contain;background:color-mix(in srgb,var(--gc12) 94%,transparent);-webkit-backdrop-filter:blur(34px) saturate(180%);backdrop-filter:blur(34px) saturate(180%);border:1px solid var(--w10);border-bottom:none;border-radius:28px 28px 0 0;padding:12px 20px calc(30px + env(safe-area-inset-bottom));box-shadow:inset 0 1px 0 var(--w12);transform:translateY(100%);transition:transform .3s cubic-bezier(.32,.72,0,1);box-sizing:border-box;color:var(--white);font-family:var(--font)}'+
  '#rd-city-sheet.on #rd-city-inner{transform:none}'+
  '#rd-city-sheet #rd-city-inner{background:color-mix(in srgb,var(--gc12) 94%,transparent)}'+
  '.rd-map{position:relative;margin-top:16px;border-radius:22px;overflow:hidden;aspect-ratio:16/11;background:var(--w5);border:1px solid var(--w8)}'+
  '#rd-map-el{position:absolute;inset:0;background:var(--w5);z-index:0;opacity:0;transition:opacity .35s ease}'+
  '#rd-map-el.ready{opacity:1}'+
  '.rd-map-skel{position:absolute;inset:0;background:linear-gradient(110deg,var(--w4) 30%,var(--w8) 50%,var(--w4) 70%);background-size:200% 100%;animation:rdMapSk 1.2s ease-in-out infinite}'+
  '@keyframes rdMapSk{from{background-position:120% 0}to{background-position:-80% 0}}'+
  '.rd-pin{display:grid;place-items:center;border-radius:50%;background:#e6f03b;color:#0a0a0a;font-weight:800;font-size:12px;box-shadow:0 0 0 2px rgba(0,0,0,.55),0 4px 12px rgba(0,0,0,.35);cursor:pointer;font-variant-numeric:tabular-nums;font-family:var(--font)}'+
  '.rd-pin.sel{background:#fff}.rd-pin span{line-height:1}'+
  // logo cuadrado (agencias / fotógrafos)
  '.rd-logo{position:relative;width:44px;height:44px;border-radius:12px;background:#fff center/cover no-repeat;box-shadow:0 0 0 2px rgba(0,0,0,.5),0 6px 16px rgba(0,0,0,.35);cursor:pointer;display:grid;place-items:center;font:800 16px var(--font);color:#0a0a0a;transition:transform .18s cubic-bezier(.22,1,.36,1)}'+
  '.rd-logo:hover{transform:scale(1.08)}'+
  '.rd-logo.contain{background-size:78%}'+
  '.rd-logo b{position:absolute;top:-7px;right:-8px;min-width:20px;height:20px;padding:0 5px;box-sizing:border-box;border-radius:10px;background:#e6f03b;color:#0a0a0a;font:800 11px/20px var(--font);text-align:center;box-shadow:0 0 0 2px rgba(0,0,0,.45)}'+
  '.rd-logo.stack{box-shadow:0 0 0 2px rgba(0,0,0,.5),5px 5px 0 -1px rgba(255,255,255,.55),0 6px 16px rgba(0,0,0,.35)}'+
  '.rd-me{width:16px;height:16px;border-radius:50%;background:#2f80ed;border:3px solid #fff;box-shadow:0 0 0 6px rgba(47,128,237,.25),0 2px 6px rgba(0,0,0,.4)}'+
  '#rd-map-el .maplibregl-ctrl-attrib{font-size:9px;background:rgba(0,0,0,.35)!important;color:rgba(255,255,255,.6)}'+
  '#rd-map-el .maplibregl-ctrl-attrib a{color:inherit}'+
  '#rd-map-el .maplibregl-ctrl-attrib-button{filter:invert(1);opacity:.5;transform:scale(.8)}'+
  'html[data-theme="light"] #rd-map-el .maplibregl-ctrl-attrib{background:rgba(255,255,255,.6)!important;color:rgba(0,0,0,.5)}'+
  'html[data-theme="light"] #rd-map-el .maplibregl-ctrl-attrib-button{filter:none}'+
  '.rd-map-off{position:absolute;inset:0;display:grid;place-items:center;font-size:13px;color:var(--muted);text-align:center;padding:20px}'+
  '.rd-map-flag{position:absolute;top:12px;right:13px;width:17px;height:auto;pointer-events:none;z-index:500;filter:drop-shadow(0 1px 3px rgba(0,0,0,.6))}'+
  'html[data-theme="light"] .rd-map-flag{filter:invert(1) drop-shadow(0 1px 2px rgba(255,255,255,.6))}'+
  '.rd-city-near{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin-top:14px;height:48px;border-radius:14px;border:1px solid var(--w12);background:var(--w5);color:var(--white);font-family:var(--font);font-size:14px;font-weight:700;cursor:pointer}'+
  '.rd-city-near svg{width:17px;height:17px}'+
  '.rd-city-list{display:flex;flex-direction:column;gap:8px;margin-top:18px}'+
  '.rd-city-row{display:flex;align-items:center;gap:12px;padding:13px 14px;border-radius:16px;background:var(--w4);border:1px solid var(--w7);cursor:pointer;transition:background .15s,border-color .15s}'+
  '.rd-city-row:active,.rd-city-row:hover{background:var(--w8)}'+
  '.rd-city-row.sel{border-color:rgba(230,240,59,.55);background:rgba(230,240,59,.07)}'+
  '.rd-city-row b{flex:1;font-size:15px;font-weight:700;letter-spacing:-.2px;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'+
  '.rd-city-row .cnt{font-size:12.5px;font-weight:700;color:var(--w70);font-variant-numeric:tabular-nums}'+
  '.rd-city-row .sub{font-size:12.5px;color:var(--muted);white-space:nowrap}'+
  '.rd-city-row .bar{width:64px;height:5px;border-radius:5px;background:var(--w8);overflow:hidden}'+
  '.rd-city-row .bar i{display:block;height:100%;background:#e6f03b;border-radius:5px}'+
  '.rd-city-row .lg{width:38px;height:38px;border-radius:10px;background:#fff center/cover no-repeat;flex-shrink:0;display:grid;place-items:center;font:800 14px var(--font);color:#0a0a0a;box-shadow:0 0 0 1px var(--w10)}'+
  '.rd-city-row .lg.contain{background-size:78%}'+
  '.rd-city-in{animation:rdCityIn .28s cubic-bezier(.22,.61,.36,1) both}'+
  '@keyframes rdCityIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}'+
  // tarjeta flotante de fotógrafo
  '.rd-map-card{position:absolute;left:10px;right:10px;bottom:10px;z-index:600;display:flex;align-items:center;gap:12px;padding:10px;border-radius:16px;background:color-mix(in srgb,var(--gc8) 88%,transparent);-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);border:1px solid var(--w12);transform:translateY(12px);opacity:0;transition:transform .25s cubic-bezier(.22,1,.36,1),opacity .2s}'+
  '.rd-map-card.on{transform:none;opacity:1}'+
  '.rd-map-card .ph{width:52px;height:52px;border-radius:12px;background:var(--w8) center/cover;flex-shrink:0}'+
  '.rd-map-card .tx{flex:1;min-width:0}.rd-map-card .tx b{display:block;font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rd-map-card .tx span{display:block;font-size:12px;color:var(--muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'+
  '.rd-map-card a{height:34px;padding:0 13px;border-radius:17px;background:var(--white);color:var(--bg);font:700 12.5px/34px var(--font);text-decoration:none;flex-shrink:0}'+
  '.rd-map-btn{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 13px;border-radius:100px;border:1px solid var(--w15);background:var(--w5);color:var(--white);font-family:var(--font);font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap}'+
  '.rd-map-btn svg{width:13px;height:13px}'+
  (DESK?'@media (min-width:900px){#rd-city-sheet{align-items:center}#rd-city-inner{max-width:640px;border-radius:28px;border-bottom:1px solid var(--w10);padding:16px 24px 26px;transform:translateY(24px) scale(.98);opacity:0;transition:transform .3s cubic-bezier(.22,1,.36,1),opacity .22s}#rd-city-sheet.on #rd-city-inner{transform:none;opacity:1}}':'')+
  '@media (prefers-reduced-motion:reduce){.rd-city-in{animation:none}#rd-city-inner{transition:none}}';
  function css(){ if(document.getElementById('rd-map-css')) return; var s=document.createElement('style'); s.id='rd-map-css'; s.textContent=CSS; document.head.appendChild(s); }
  css();   // los botones "mapa" usan estos estilos desde el inicio

  // ── ciudades (coordenadas) ──
  function cities(){ return window.RD_CITIES||CITIES; }
  var CITIES={
    'caracas':[10.49,-66.88,'Caracas'],'maracaibo':[10.65,-71.64,'Maracaibo'],'valencia':[10.16,-68.0,'Valencia'],
    'barquisimeto':[10.07,-69.32,'Barquisimeto'],'maracay':[10.25,-67.6,'Maracay'],'ciudad guayana':[8.3,-62.72,'Ciudad Guayana'],
    'barcelona':[10.13,-64.69,'Barcelona'],'puerto la cruz':[10.21,-64.63,'Puerto La Cruz'],'maturin':[9.75,-63.18,'Maturín'],
    'merida':[8.59,-71.14,'Mérida'],'san cristobal':[7.77,-72.23,'San Cristóbal'],'cumana':[10.46,-64.17,'Cumaná'],
    'barinas':[8.62,-70.21,'Barinas'],'ciudad bolivar':[8.12,-63.55,'Ciudad Bolívar'],'cabimas':[10.4,-71.45,'Cabimas'],
    'punto fijo':[11.7,-70.2,'Punto Fijo'],'coro':[11.4,-69.67,'Coro'],'valera':[9.32,-70.6,'Valera'],'acarigua':[9.55,-69.2,'Acarigua'],
    'los teques':[10.34,-67.04,'Los Teques'],'guarenas':[10.47,-66.54,'Guarenas'],'guatire':[10.47,-66.54,'Guatire'],
    'porlamar':[10.95,-63.85,'Porlamar'],'san fernando de apure':[7.89,-67.47,'San Fernando'],'puerto cabello':[10.47,-68.01,'Puerto Cabello'],
    'guanare':[9.04,-69.74,'Guanare'],'san juan de los morros':[9.91,-67.35,'San Juan de los Morros'],'tucupita':[9.06,-62.05,'Tucupita'],
    'el tigre':[8.89,-64.25,'El Tigre'],'calabozo':[8.92,-67.43,'Calabozo'],'la guaira':[10.6,-66.93,'La Guaira'],'san felipe':[10.34,-68.74,'San Felipe'],
    'carora':[10.17,-70.08,'Carora'],'el vigia':[8.62,-71.65,'El Vigía'],'puerto ayacucho':[5.66,-67.62,'Puerto Ayacucho']
  };
  var ALIAS={'puerto ordaz':'ciudad guayana','san felix':'ciudad guayana','pto ordaz':'ciudad guayana','lecheria':'barcelona','margarita':'porlamar','isla de margarita':'porlamar'};
  function key(c){
    if(typeof window._rdCityKey==='function') return window._rdCityKey(c);
    var k=String(c||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,' ').trim();
    return ALIAS[k]||k;
  }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function img(u,w){ try{ return u?(typeof _tImg==='function'?_tImg(u,{width:w,quality:80}):u):''; }catch(e){ return u; } }
  function hap(s){ try{ window._rdHapticNow&&window._rdHapticNow(s||'LIGHT'); }catch(e){} }

  // ── datos por versión ──
  function items(kind){
    if(kind==='agencias'){
      var src=(typeof CONCESIONARIOS_ALL!=='undefined'&&CONCESIONARIOS_ALL.length)?CONCESIONARIOS_ALL:(typeof CONCESIONARIOS!=='undefined'?CONCESIONARIOS:[]);
      return src.filter(function(d){ return d&&d.nombre; }).map(function(d){ return {id:d.id,name:d.nombre,city:d.ciudad||'',logo:d.logo||d.logo_url||'',contain:true}; });
    }
    if(kind==='fotografos'){
      var f=typeof FOTOGRAFOS!=='undefined'?FOTOGRAFOS:[];
      return f.map(function(p){ return {id:p.id,name:p.nombre,city:p.ciudad||'',logo:(p.fotos&&p.fotos[0])||'',sub:p.especialidad||'fotografía automotriz',wa:p.whatsapp,ig:p.instagram,price:p.precio}; });
    }
    return [];
  }

  // ── mapa reutilizable ──
  var map=null, mapEl=null, markers=[], meMarker=null, curKind=null, mapLight=null;
  function clearMarkers(){ markers.forEach(function(m){ try{ m.remove(); }catch(e){} }); markers=[]; }
  function ensureMap(ml){
    var light=document.documentElement.getAttribute('data-theme')==='light';
    if(map&&mapLight===light) return map;
    if(map){ try{ map.remove(); }catch(e){} map=null; }
    mapEl=document.createElement('div'); mapEl.id='rd-map-el';
    mapLight=light;
    map=new ml.Map({container:mapEl,style:'https://tiles.openfreemap.org/styles/'+(light?'positron':'dark'),
      center:[-66.2,7.6],zoom:4.4,minZoom:3.6,maxZoom:15,
      maxBounds:[[-77.5,-1.5],[-56.5,15.5]],renderWorldCopies:false,
      pixelRatio:Math.min(2,window.devicePixelRatio||1),antialias:false,
      attributionControl:{compact:true},dragRotate:false,pitchWithRotate:false,touchPitch:false,fadeDuration:120,maxTileCacheSize:120});
    try{ map.touchZoomRotate.disableRotation(); }catch(e){}
    return map;
  }

  function pin(n,d,sel){ var e=document.createElement('div'); e.className='rd-pin'+(sel?' sel':''); e.style.width=e.style.height=d+'px'; e.innerHTML='<span>'+n+'</span>'; return e; }
  function logoEl(it,count){
    var e=document.createElement('div'); e.className='rd-logo'+(it.contain?' contain':'')+(count>1?' stack':'');
    if(it.logo) e.style.backgroundImage='url("'+img(it.logo,120)+'")'; else e.textContent=(it.name||'?').charAt(0).toUpperCase();
    if(count>1){ var b=document.createElement('b'); b.textContent=count; e.appendChild(b); }
    return e;
  }

  function drawMarket(ml,sel,cnt){
    var C=cities(), max=1; Object.keys(cnt).forEach(function(k){ if(cnt[k]>max) max=cnt[k]; });
    var b=new ml.LngLatBounds(), n0=0;
    Object.keys(cnt).forEach(function(k){
      var c=C[k]; if(!c) return;
      var d=Math.round(26+14*Math.sqrt(cnt[k]/max)), p=pin(cnt[k],d,sel===k);
      p.addEventListener('click',function(ev){ ev.stopPropagation(); hap('LIGHT'); if(typeof setMarketCity==='function') setMarketCity(k); });
      markers.push(new ml.Marker({element:p}).setLngLat([c[1],c[0]]).addTo(map)); b.extend([c[1],c[0]]); n0++;
    });
    if(sel&&C[sel]) map.jumpTo({center:[C[sel][1],C[sel][0]],zoom:9});
    else if(n0>1) map.fitBounds(b,{padding:40,maxZoom:8,duration:0});
  }

  // logos: agrupados por ciudad de lejos, separados en espiral de cerca
  function drawLogos(ml,kind,list){
    var C=cities(), groups={}, b=new ml.LngLatBounds(), n0=0;
    list.forEach(function(it){ var k=key(it.city); if(!C[k]) return; (groups[k]=groups[k]||[]).push(it); });
    function paint(){
      clearMarkers();
      var near=map.getZoom()>=9.5;
      Object.keys(groups).forEach(function(k){
        var c=C[k], g=groups[k];
        if(!near&&g.length>1){
          var e=logoEl(g[0],g.length);
          e.addEventListener('click',function(ev){ ev.stopPropagation(); hap('LIGHT'); map.flyTo({center:[c[1],c[0]],zoom:11.2,duration:650,essential:true}); });
          markers.push(new ml.Marker({element:e}).setLngLat([c[1],c[0]]).addTo(map));
        } else {
          g.forEach(function(it,i){
            var a=i*2.39996, r=i?0.02*Math.sqrt(i):0; // ángulo áureo: nunca se pisan
            var e=logoEl(it,1);
            e.addEventListener('click',function(ev){ ev.stopPropagation(); hap('LIGHT'); pick(kind,it); });
            markers.push(new ml.Marker({element:e}).setLngLat([c[1]+Math.cos(a)*r*1.25,c[0]+Math.sin(a)*r]).addTo(map));
          });
        }
      });
    }
    Object.keys(groups).forEach(function(k){ b.extend([C[k][1],C[k][0]]); n0++; });
    paint();
    var last=map.getZoom()>=9.5;
    map.__rdZoom&&map.off('zoomend',map.__rdZoom);
    map.__rdZoom=function(){ var now=map.getZoom()>=9.5; if(now!==last){ last=now; paint(); } };
    map.on('zoomend',map.__rdZoom);
    if(n0>1) map.fitBounds(b,{padding:50,maxZoom:8,duration:0});
    else if(n0===1){ var k0=Object.keys(groups)[0]; map.jumpTo({center:[C[k0][1],C[k0][0]],zoom:11}); }
  }

  function pick(kind,it){
    if(kind==='agencias'){
      close();
      setTimeout(function(){ try{ if(typeof showView==='function') showView('concesionarios'); if(typeof openVitrina==='function') openVitrina(it.id); }catch(e){} },320);
      return;
    }
    // fotógrafo: tarjeta sobre el mapa con contacto
    var box=document.querySelector('#rd-city-inner .rd-map'); if(!box) return;
    var old=box.querySelector('.rd-map-card'); if(old) old.remove();
    var wa=String(it.wa||'').replace(/[^0-9]/g,''), ig=String(it.ig||'').replace(/^@/,'');
    var href=wa?'https://wa.me/'+wa:(ig?'https://instagram.com/'+ig:'');
    var c=document.createElement('div'); c.className='rd-map-card';
    c.innerHTML='<div class="ph" style="background-image:url(\''+esc(img(it.logo,160))+'\')"></div><div class="tx"><b>'+esc(it.name)+'</b><span>'+esc(it.sub)+' · '+esc(it.city)+(it.price?' · desde $'+esc(it.price):'')+'</span></div>'+(href?'<a href="'+esc(href)+'" target="_blank" rel="noopener">'+(wa?'escribir':'ver')+'</a>':'');
    box.appendChild(c); requestAnimationFrame(function(){ c.classList.add('on'); });
  }

  // ── hoja ──
  function head(title,sub){
    return '<div style="width:38px;height:4px;border-radius:4px;background:var(--w15);margin:0 auto 18px"></div>'+
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">'+
      '<div><div style="font-size:24px;font-weight:800;letter-spacing:-.5px">'+title+'</div>'+
      '<div style="font-size:13px;color:var(--muted);margin-top:5px">'+sub+'</div></div>'+
      '<button type="button" data-rdmap-close aria-label="cerrar" style="background:var(--w6);border:none;color:var(--w60);width:34px;height:34px;border-radius:50%;display:grid;place-items:center;cursor:pointer;flex-shrink:0"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" style="width:15px;height:15px"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>';
  }
  function flag(){ var s=(window.RD_IMG&&RD_IMG.extra)||''; return s?'<img class="rd-map-flag" src="'+s+'" alt="Ruedda">':''; }
  var NEAR='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/></svg>';

  function open(kind){
    kind=kind||'market';
    if(document.getElementById('rd-city-sheet')) return;
    css(); hap('LIGHT');
    var ml=lib();   // arranca la descarga ya, en paralelo con la animación
    var body='', C=cities();
    var cnt={}, sel=null, total=0, list=[];
    if(kind==='market'){
      if(typeof _rdCityCounts==='function') cnt=_rdCityCounts();
      sel=(typeof mFilters!=='undefined'&&mFilters.city&&mFilters.city!=='todas')?key(mFilters.city):null;
      var max=1; Object.keys(cnt).forEach(function(k){ total+=cnt[k]; if(cnt[k]>max) max=cnt[k]; });
      var rows=Object.keys(cnt).sort(function(a,b){ return cnt[b]-cnt[a]; }).map(function(k,i){
        return '<div class="rd-city-row rd-city-in'+(sel===k?' sel':'')+'" style="animation-delay:'+(Math.min(i,10)*22+60)+'ms" data-city="'+esc(k)+'"><b>'+esc(C[k]?C[k][2]:k)+'</b><span class="bar"><i style="width:'+Math.round(cnt[k]/max*100)+'%"></i></span><span class="cnt">'+cnt[k]+' '+(cnt[k]===1?'carro':'carros')+'</span></div>';
      }).join('');
      body=head('¿dónde lo buscas?',total+' carros publicados en '+Object.keys(cnt).length+' ciudades · toca un punto')+
        '<div class="rd-map"><div class="rd-map-skel"></div>'+flag()+'</div>'+
        '<button type="button" class="rd-city-near" data-rdmap-near>'+NEAR+'usar mi ubicación</button>'+
        '<div class="rd-city-list">'+(sel?'<div class="rd-city-row rd-city-in" data-city=""><b>todas las ciudades</b><span class="cnt">'+total+' carros</span></div>':'')+rows+'</div>';
    } else {
      list=items(kind);
      var nC={}; list.forEach(function(it){ var k=key(it.city); if(C[k]) nC[k]=1; });
      var ag=kind==='agencias';
      var rows2=list.slice().sort(function(a,b){ return String(a.city).localeCompare(String(b.city))||String(a.name).localeCompare(String(b.name)); }).map(function(it,i){
        var lg=it.logo?'style="background-image:url(\''+esc(img(it.logo,96))+'\')"':'';
        return '<div class="rd-city-row rd-city-in" style="animation-delay:'+(Math.min(i,10)*22+60)+'ms" data-id="'+esc(it.id)+'"><span class="lg'+(it.contain?' contain':'')+'" '+lg+'>'+(it.logo?'':esc((it.name||'?').charAt(0).toUpperCase()))+'</span><b>'+esc(it.name)+'</b><span class="sub">'+esc((C[key(it.city)]||[0,0,it.city])[2]||'')+'</span></div>';
      }).join('');
      body=head(ag?'mapa de agencias':'fotógrafos en el mapa',
        list.length?(list.length+' '+(ag?(list.length===1?'agencia':'agencias'):(list.length===1?'fotógrafo':'fotógrafos'))+' en '+Object.keys(nC).length+' '+(Object.keys(nC).length===1?'ciudad':'ciudades')+' · toca un '+(ag?'logo':'perfil')):(ag?'todavía no hay agencias con ciudad':'todavía no hay fotógrafos con ciudad'))+
        '<div class="rd-map"><div class="rd-map-skel"></div>'+flag()+'</div>'+
        '<div class="rd-city-list">'+rows2+'</div>';
    }
    var ov=document.createElement('div'); ov.id='rd-city-sheet';
    ov.innerHTML='<div id="rd-city-inner" role="dialog" aria-label="'+(kind==='market'?'buscar por ciudad':'mapa')+'">'+body+'</div>';
    ov.addEventListener('click',function(e){
      if(e.target===ov||e.target.closest('[data-rdmap-close]')) return close();
      var near=e.target.closest('[data-rdmap-near]'); if(near){ if(typeof _rdNearestCity==='function') _rdNearestCity(near); return; }
      var row=e.target.closest('.rd-city-row'); if(!row) return;
      if(kind==='market'){ if(typeof setMarketCity==='function') setMarketCity(row.getAttribute('data-city')||null); return; }
      var it=list.filter(function(x){ return String(x.id)===row.getAttribute('data-id'); })[0]; if(!it) return;
      if(kind==='agencias') return pick(kind,it);
      // fotógrafo desde la lista: centra el mapa en él y muestra su tarjeta
      var c=C[key(it.city)]; if(map&&c) map.flyTo({center:[c[1],c[0]],zoom:11,duration:600,essential:true});
      pick(kind,it);
    });
    document.body.appendChild(ov);
    curKind=kind;
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ ov.classList.add('on'); }); });
    // el mapa se arma cuando la hoja terminó de subir (nada pesado durante la animación)
    var inner=ov.querySelector('#rd-city-inner'), go=false;
    var start=function(){
      if(go) return; go=true;
      ml.then(function(lib){
        if(!document.body.contains(ov)) return;
        var box=ov.querySelector('.rd-map'); if(!box) return;
        var m=ensureMap(lib);
        mapEl.classList.remove('ready');
        box.insertBefore(mapEl,box.firstChild);
        clearMarkers();
        var reveal=function(){ try{ m.resize(); }catch(e){} requestAnimationFrame(function(){ mapEl.classList.add('ready'); var sk=box.querySelector('.rd-map-skel'); if(sk) setTimeout(function(){ sk.remove(); },360); }); };
        var draw=function(){ try{ m.resize(); if(kind==='market') drawMarket(lib,sel,cnt); else drawLogos(lib,kind,list); }catch(e){} reveal(); };
        if(m.loaded()) draw(); else m.once('load',draw);
      }).catch(function(){ var box=ov.querySelector('.rd-map'); if(box) box.innerHTML='<div class="rd-map-off">el mapa no cargó · elige en la lista de abajo</div>'; });
    };
    inner.addEventListener('transitionend',function(e){ if(e.target===inner) start(); },{once:true});
    setTimeout(start,380);
    document.addEventListener('keydown',onKey);
  }
  function onKey(e){ if(e.key==='Escape') close(); }
  function close(){
    var ov=document.getElementById('rd-city-sheet'); if(!ov) return;
    document.removeEventListener('keydown',onKey);
    ov.classList.remove('on');
    setTimeout(function(){
      // la instancia del mapa se guarda (reabrir es instantáneo); solo se sueltan sus marcadores
      clearMarkers(); if(meMarker){ try{ meMarker.remove(); }catch(e){} meMarker=null; }
      if(map&&map.__rdZoom){ map.off('zoomend',map.__rdZoom); map.__rdZoom=null; }
      if(mapEl&&mapEl.parentNode) mapEl.parentNode.removeChild(mapEl);
      ov.remove();
    },300);
  }
  function preload(){ lib().catch(function(){}); }

  window.RDMap={open:open,close:close,preload:preload,
    map:function(){ return map; },
    me:function(lng,lat){ if(!map||!window.maplibregl) return; if(meMarker) meMarker.remove(); var me=document.createElement('div'); me.className='rd-me'; meMarker=new maplibregl.Marker({element:me}).setLngLat([lng,lat]).addTo(map); map.flyTo({center:[lng,lat],zoom:8.5,duration:900}); }};
})();
