/* ─────────────────────────────────────────────────────────────
   RUEDDA · PAUSA ("ya volvemos")
   Para QUITARLA: RD_PAUSA = false y push. Nada más.
   Va como PRIMER script del <head> de cada página. Pinta negro desde el
   primer cuadro (la página de abajo nunca se asoma) y monta /pausa/ encima.
   Pase secreto: 5 toques al logo → este dispositivo queda con
   localStorage rd_pausa_pase=1 y ve Ruedda normal.
   ───────────────────────────────────────────────────────────── */
(function(){
  var RD_PAUSA = true;
  if(!RD_PAUSA) return;
  try{ if(localStorage.getItem('rd_pausa_pase')==='1') return; }catch(e){}
  var h=location.hostname;
  // páginas de proyectos aparte abiertas por su dominio *.vercel.app: se ven por ruedda.app (misma ruta)
  if(/\.vercel\.app$/.test(h)){ location.replace('https://www.ruedda.app'+location.pathname+location.search); return; }
  var base=(/(^|\.)ruedda\.app$/.test(h)||h==='localhost'||h==='127.0.0.1')?'':'https://www.ruedda.app';
  var d=document.documentElement; d.classList.add('rd-pausa');
  var st=document.createElement('style'); st.id='rd-pausa-css';
  st.textContent='html.rd-pausa,html.rd-pausa body{background:#000!important;overflow:hidden!important}'+
    'html.rd-pausa body{visibility:hidden!important}'+
    '#rd-pausa{position:fixed;top:0;left:0;width:100%;height:100%;height:100dvh;border:0;margin:0;padding:0;z-index:2147483647;background:#000;visibility:visible!important;display:block}';
  (document.head||d).appendChild(st);
  function tema(){ var m=document.querySelector('meta[name="theme-color"]'); if(!m){ m=document.createElement('meta'); m.name='theme-color'; (document.head||d).appendChild(m); } m.setAttribute('content','#000000'); }
  function montar(){
    if(document.getElementById('rd-pausa')) return;
    var f=document.createElement('iframe'); f.id='rd-pausa'; f.title='Ruedda, ya volvemos';
    f.src=base+'/pausa/index.html'; document.body.appendChild(f); tema();
  }
  if(document.body) montar(); else document.addEventListener('DOMContentLoaded',montar);
  addEventListener('message',function(e){
    if(!e.data||e.data.rdPausa!=='entrar') return;
    if(e.origin!==location.origin && !/^https:\/\/(www\.)?ruedda\.app$/.test(e.origin)) return;
    try{ localStorage.setItem('rd_pausa_pase','1'); }catch(_){}
    var f=document.getElementById('rd-pausa'); if(f) f.remove();
    var c=document.getElementById('rd-pausa-css'); if(c) c.remove();
    d.classList.remove('rd-pausa');
  });
})();
