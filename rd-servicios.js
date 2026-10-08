/* [2026-10-08] servicios del post: card de financiamiento + traslado nacional.
   - .rd-fin-soon: card "financiamiento" cuando el vendedor NO lo ofrece. Es un
     contenedor de imagen (app_settings 'financiamiento_card_url', se sube en
     Control → Apariencia), sin texto encima (la imagen ya lo dice); el degradado y la
     imagen cubren también el borde (si no, el borde de 1px mostraba el fondo claro).
     Al tocarla abre "financiamiento en camino".
   - .rd-tras-card: card "traslado nacional" → abre el menú de grúas (aún sin aliados).
   Las cards con financiamiento activo del vendedor no se tocan. */
(function(){
  if(window.__rdSvc) return; window.__rdSvc=1;
  var SUPA='https://ltodsegzbbdcaublkgtp.supabase.co';
  var ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0b2RzZWd6YmJkY2F1YmxrZ3RwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MjIwOTgsImV4cCI6MjA5NTI5ODA5OH0.WXbnE5_XfNwwVUtDGSWa6Voetcflcl7m2vDOpEofs_w';
  var LS='rd_fin_card_url';
  var IMG=''; try{ IMG=localStorage.getItem(LS)||''; }catch(e){}

  var css=''
  +'.rds-root{--rds-acc:#e6f03b;--rds-acc-ink:#000}'
  +'html[data-theme="light"] .rds-root{--rds-acc:#0a0a0a;--rds-acc-ink:#fff}'
  +'.rd-fin-soon,.rd-tras-card{cursor:pointer;transition:transform .25s cubic-bezier(.32,.72,0,1);-webkit-tap-highlight-color:transparent}'
  +'.rd-fin-soon:active,.rd-tras-card:active{transform:scale(.97)}'
  +'.rd-fin-soon.rds-img{position:relative;overflow:hidden;padding:0!important;min-height:108px;background-color:var(--surface-hi)!important;background-origin:border-box!important;background-position:center!important;background-size:cover!important;background-repeat:no-repeat!important;border-color:transparent!important}'
  +'.rds-img .rds-shade{position:absolute;inset:-1px;background:linear-gradient(180deg,rgba(0,0,0,0) 30%,rgba(0,0,0,.72) 100%)}'
  +'.rds-img .rds-txt{position:absolute;left:13px;right:13px;bottom:12px;display:flex;flex-direction:column;gap:5px}'
  +'.rds-img .rds-t{font-size:14px;font-weight:700;color:#fff;letter-spacing:-.2px}'
  +'.rds-chip{align-self:flex-start;font-size:9.5px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;padding:3px 8px;border-radius:99px;background:#e6f03b;color:#000}'
  +'.rds-go{font-size:10px;font-weight:700;letter-spacing:.8px;color:var(--white);opacity:.75;display:flex;align-items:center;gap:4px}'
  +'.rds-go svg{width:10px;height:10px}'
  +'.rds-ov{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.6);display:flex;align-items:flex-end;justify-content:center;opacity:0;transition:opacity .25s ease;color:var(--white)}'
  +'.rds-ov.on{opacity:1}'
  +'.rds-sheet{width:100%;max-width:520px;max-height:88vh;overflow:auto;background:var(--gc3,rgba(14,14,14,.92));backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1px solid var(--w10,rgba(255,255,255,.1));border-bottom:none;border-radius:26px 26px 0 0;padding:12px 18px calc(28px + env(safe-area-inset-bottom));transform:translateY(100%);transition:transform .38s cubic-bezier(.32,.72,0,1);font-family:var(--font,inherit)}'
  +'.rds-ov.on .rds-sheet{transform:none}'
  +'@media(min-width:760px){.rds-ov{align-items:center}.rds-sheet{border-radius:26px;border-bottom:1px solid var(--w10,rgba(255,255,255,.1));transform:translateY(24px) scale(.98);padding-bottom:26px}}'
  +'.rds-handle{width:38px;height:4px;border-radius:99px;background:var(--w20,rgba(255,255,255,.2));margin:0 auto 16px}'
  +'.rds-hero{width:100%;aspect-ratio:16/9;border-radius:18px;background:var(--surface-hi) center/cover no-repeat;margin-bottom:18px}'
  +'.rds-ico{width:58px;height:58px;border-radius:18px;display:flex;align-items:center;justify-content:center;background:rgba(230,240,59,.1);border:1px solid rgba(230,240,59,.28);color:#e6f03b;margin-bottom:16px}'
  +'html[data-theme="light"] .rds-ico{background:rgba(0,0,0,.05);border-color:rgba(0,0,0,.1);color:#0a0a0a}'
  +'.rds-ico svg,.rds-ico .icon-mask{width:28px;height:28px}'
  +'.rds-k{font-size:10.5px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:var(--rds-acc);margin-bottom:8px}'
  +'.rds-h{font-size:24px;font-weight:800;letter-spacing:-.6px;line-height:1.15;margin-bottom:10px}'
  +'.rds-p{font-size:14px;line-height:1.65;color:var(--white);opacity:.72;margin-bottom:18px}'
  +'.rds-list{display:flex;flex-direction:column;gap:8px;margin-bottom:18px}'
  +'.rds-row{display:flex;align-items:center;gap:12px;padding:13px 14px;border-radius:16px;background:var(--w4,rgba(255,255,255,.04));border:1px solid var(--w8,rgba(255,255,255,.08))}'
  +'.rds-row .rds-ri{width:36px;height:36px;border-radius:11px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:var(--w6,rgba(255,255,255,.06));color:var(--white)}'
  +'.rds-row .rds-ri svg,.rds-row .rds-ri .icon-mask{width:19px;height:19px}'
  +'.rds-row b{display:block;font-size:14px;font-weight:700;letter-spacing:-.2px}'
  +'.rds-row span{display:block;font-size:12px;opacity:.6;line-height:1.45;margin-top:2px}'
  +'.rds-row.dim{opacity:.55}'
  +'.rds-row .rds-pill{margin-left:auto;flex-shrink:0;font-size:9.5px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;padding:4px 8px;border-radius:99px;border:1px solid var(--w15,rgba(255,255,255,.15));opacity:.8}'
  +'.rds-empty{display:flex;gap:11px;align-items:flex-start;padding:14px 15px;border-radius:16px;background:rgba(230,240,59,.07);border:1px solid rgba(230,240,59,.22);margin-bottom:18px;font-size:13px;line-height:1.6}'
  +'html[data-theme="light"] .rds-empty{background:rgba(0,0,0,.04);border-color:rgba(0,0,0,.1)}'
  +'.rds-empty svg{width:17px;height:17px;flex-shrink:0;margin-top:2px;color:var(--rds-acc)}'
  +'.rds-btn{width:100%;border:0;border-radius:14px;padding:14px;font-size:15px;font-weight:700;font-family:inherit;cursor:pointer;background:var(--rds-acc);color:var(--rds-acc-ink)}';
  var st=document.createElement('style'); st.textContent=css; (document.head||document.documentElement).appendChild(st);
  document.documentElement.classList.add('rds-root');

  var ARROW='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  var I={
    card:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20M6 15h4"/></svg>',
    car:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17h14v-4l-2-5H7l-2 5z"/><circle cx="8" cy="17" r="1.6"/><circle cx="16" cy="17" r="1.6"/><path d="M5 13h14"/></svg>',
    p2p:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="8" r="3"/><circle cx="17" cy="8" r="3"/><path d="M2 20c0-3 2.2-5 5-5s5 2 5 5M12 20c0-3 2.2-5 5-5s5 2 5 5"/></svg>',
    shield:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>',
    tow:'<span class="icon-mask icon-mask-asistencia-vial"></span>',
    route:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h7a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h7"/></svg>',
    clock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/></svg>',
    info:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>'
  };
  function esc(s){ return String(s).replace(/["'()\\<>]/g,function(c){ return encodeURIComponent(c); }); }

  function paintFin(el){
    if(IMG){
      el.classList.add('rds-img');
      el.style.backgroundImage='url("'+esc(IMG)+'")';
      el.innerHTML='<div class="rds-shade"></div>'; el.setAttribute('aria-label','financiamiento');
    } else {
      el.classList.remove('rds-img'); el.style.backgroundImage='';
      var lab=el.querySelectorAll('div')[1]; if(lab) lab.textContent='en camino';
    }
    el.setAttribute('role','button');
  }
  function paintTras(el){
    if(el.dataset.rdsOn) return; el.dataset.rdsOn='1';
    var img=el.querySelector('img'); if(img) img.style.opacity='.85';
    var d=el.querySelectorAll('div');
    if(d[0]) d[0].style.color='var(--white)';
    if(d[1]){ d[1].className='rds-go'; d[1].removeAttribute('style'); d[1].innerHTML='ver grúas'+ARROW; }
    el.setAttribute('role','button');
  }
  function paint(){
    document.querySelectorAll('.rd-fin-soon').forEach(paintFin);
    document.querySelectorAll('.rd-tras-card').forEach(paintTras);
  }
  window.rdSvcPaint=paint;

  function open(html){
    var ov=document.createElement('div'); ov.className='rds-ov';
    ov.innerHTML='<div class="rds-sheet" role="dialog" aria-modal="true"><div class="rds-handle"></div>'+html+'<button class="rds-btn" data-rds-close>entendido</button></div>';
    function close(){ ov.classList.remove('on'); setTimeout(function(){ ov.remove(); },320); }
    ov.addEventListener('click',function(e){ if(e.target===ov||e.target.closest('[data-rds-close]')) close(); });
    document.body.appendChild(ov);
    try{ window._rdHapticNow&&window._rdHapticNow(); }catch(e){}
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ ov.classList.add('on'); }); });
  }
  function row(ic,t,s,dim){ return '<div class="rds-row'+(dim?' dim':'')+'"><div class="rds-ri">'+ic+'</div><div><b>'+t+'</b><span>'+s+'</span></div>'+(dim?'<div class="rds-pill">pronto</div>':'')+'</div>'; }

  window.rdOpenFinSoon=function(){
    open((IMG?'<div class="rds-hero" style="background-image:url(&quot;'+esc(IMG)+'&quot;)"></div>':'<div class="rds-ico">'+I.card+'</div>')
      +'<div class="rds-k">próximamente</div>'
      +'<div class="rds-h">Financiamiento en camino.</div>'
      +'<div class="rds-p">Con Ruedda podrás financiar vehículos usados y nuevos de manera P2P: personas que financian a personas, directo dentro de la app.</div>'
      +'<div class="rds-list">'
      +row(I.car,'Usados y nuevos','Financia el carro que quieres, sea de un particular o de un concesionario.')
      +row(I.p2p,'P2P, sin banco de por medio','Quien financia y quien compra se conectan directo, con condiciones claras.')
      +row(I.shield,'Con el respaldo de Ruedda','Perfiles verificados y todo el proceso dentro de la plataforma.')
      +'</div>');
  };
  window.rdOpenGruas=function(){
    open('<div class="rds-ico">'+I.tow+'</div>'
      +'<div class="rds-k">traslado nacional</div>'
      +'<div class="rds-h">Grúas y traslados.</div>'
      +'<div class="rds-p">Mueve tu carro a cualquier ciudad de Venezuela sin salir de Ruedda.</div>'
      +'<div class="rds-list">'
      +row(I.route,'Grúa plataforma','De una ciudad a otra, con seguimiento.',1)
      +row(I.clock,'Asistencia vial 24/7','Si te quedas accidentado en la vía.',1)
      +row(I.home,'Puerta a puerta','Del vendedor directo a tu casa.',1)
      +'</div>'
      +'<div class="rds-empty">'+I.info+'<div>Todavía no tenemos grúas aliadas en tu zona. Estamos sumando las mejores del país; muy pronto podrás pedir tu traslado desde aquí.</div></div>');
  };

  document.addEventListener('click',function(e){
    var t=e.target.closest&&e.target.closest('.rd-fin-soon,.rd-tras-card'); if(!t) return;
    if(t.classList.contains('rd-tras-card')) window.rdOpenGruas(); else window.rdOpenFinSoon();
  });

  function boot(){
    paint();
    fetch(SUPA+'/rest/v1/app_settings?select=value&key=eq.financiamiento_card_url',{headers:{apikey:ANON,Authorization:'Bearer '+ANON}})
      .then(function(r){ return r.ok?r.json():null; })
      .then(function(rows){
        if(!rows) return;
        var u=(rows[0]&&rows[0].value)||'';
        if(u===IMG) return;
        IMG=u; try{ u?localStorage.setItem(LS,u):localStorage.removeItem(LS); }catch(e){}
        if(u){ var im=new Image(); im.onload=paint; im.onerror=paint; im.src=u; } else paint();
      }).catch(function(){});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();
