/* ─────────────────────────────────────────────────────────────
   RUEDDA · CORAZONES Y RESPUESTAS EN EL CHAT (web móvil y desktop)
   Mismo formato que el chat nativo de la app (1.7 build 30), sin tablas nuevas:
    · corazón: mensaje oculto "[[rdlike:ID]]" / "[[rdunlike:ID]]"; vale el último
      de cada persona. En "conduciendo el mercado" van en la sala ROOM+':rx'
      (la poda de 35 por sala no les quita lugar a los mensajes).
    · respuesta: el mensaje lleva "\n[[rdre:ID]]" con el id del citado.
   Gestos: doble toque / doble clic = corazón; deslizar a la derecha = responder
   (táctil); en desktop, botones al pasar el mouse.
   ───────────────────────────────────────────────────────────── */
(function(){
  var LIKE=/^\[\[rd(un)?like:([\w-]+)\]\]$/, RE=/\n?\[\[rdre:([\w-]+)\]\]/;
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  var R=window.RDRX={
    like:function(t){ var m=LIKE.exec(String(t||'')); return m?{id:m[2],on:!m[1]}:null; },
    replyId:function(t){ var m=RE.exec(String(t||'')); return m?m[1]:null; },
    strip:function(t){ return String(t||'').replace(/\n?\[\[rdre:[\w-]+\]\]/g,''); },
    marker:function(id,on){ return '[[rd'+(on?'':'un')+'like:'+id+']]'; },
    /** rows: [{text, who}] en orden → {n:{id:cuántos}, me:{id:true}} */
    tally:function(rows,meKey){
      var st={};
      (rows||[]).forEach(function(r){ var l=R.like(r.text); if(!l) return; (st[l.id]=st[l.id]||{})[r.who]=l.on; });
      var n={}, me={};
      for(var id in st){ var c=0; for(var w in st[id]) if(st[id][w]) c++; if(c) n[id]=c; if(st[id][meKey]) me[id]=true; }
      return {n:n,me:me};
    },
    /** texto corto de un mensaje para la cita */
    snippet:function(t,img){
      var s=R.strip(t).replace(/\n?\[\[rdpost:[\w-]+\]\]/g,' publicación').replace(/\s+/g,' ').trim();
      return s||(img?'📷 foto':'mensaje');
    },
    quote:function(mid,name,text){
      return '<div class="rdrx-q" data-q="'+esc(mid)+'"><b>'+esc(name)+'</b><span>'+esc(text)+'</span></div>';
    },
    pill:function(n){
      return n?'<span class="rdrx-pill"><svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.9 4.5c2.1 0 3.6 1.2 5.1 3 1.5-1.8 3-3 5.1-3 3.9 0 6 3.9 4.5 7.3C19.5 16.4 12 21 12 21z"/></svg>'+(n>1?'<i>'+n+'</i>':'')+'</span>':'';
    },
    /** botones de pasar el mouse (solo dispositivos con mouse) */
    hov:function(){
      return '<span class="rdrx-hov"><button type="button" data-act="reply" aria-label="responder"><svg viewBox="0 0 24 24"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg></button><button type="button" data-act="like" aria-label="me encanta"><svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.9 4.5c2.1 0 3.6 1.2 5.1 3 1.5-1.8 3-3 5.1-3 3.9 0 6 3.9 4.5 7.3C19.5 16.4 12 21 12 21z"/></svg></button></span>';
    },
    /** corazón grande que late sobre la burbuja */
    pop:function(box,mid){
      var b=box&&box.querySelector('.thread-bubble[data-mid="'+CSS.escape(mid)+'"] .bubble-body'); if(!b) return;
      var h=document.createElement('span'); h.className='rdrx-pop';
      h.innerHTML='<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.9 4.5c2.1 0 3.6 1.2 5.1 3 1.5-1.8 3-3 5.1-3 3.9 0 6 3.9 4.5 7.3C19.5 16.4 12 21 12 21z"/></svg>';
      b.appendChild(h); setTimeout(function(){ h.remove(); },900);
    },
    flash:function(box,mid){
      var el=box&&box.querySelector('.thread-bubble[data-mid="'+CSS.escape(mid)+'"]');
      if(!el){ try{ showToast('ese mensaje es más antiguo'); }catch(e){} return; }
      el.scrollIntoView({block:'center',behavior:'smooth'});
      el.classList.remove('rdrx-flash'); void el.offsetWidth; el.classList.add('rdrx-flash');
    },
    /** "respondiendo a…" encima de la caja de texto; info=null lo quita */
    setReply:function(parent,before,info,onCancel){
      if(!parent) return;
      var bar=parent.querySelector(':scope > .rdrx-reply');
      if(!info){ if(bar) bar.remove(); return; }
      if(!bar){ bar=document.createElement('div'); bar.className='rdrx-reply'; parent.insertBefore(bar,before||parent.firstChild); }
      if(getComputedStyle(parent).display.indexOf('flex')>-1) parent.style.flexWrap='wrap';
      bar.innerHTML='<div><b>Respondiendo a '+esc(info.name)+'</b><span>'+esc(info.text)+'</span></div><button type="button" aria-label="cancelar">×</button>';
      bar.querySelector('button').onclick=function(){ bar.remove(); onCancel&&onCancel(); };
    },
    /** gestos sobre el contenedor de mensajes (se puede llamar varias veces: solo enlaza una) */
    bind:function(box,h){
      if(!box||box.__rdrx) { if(box) box.__rdrx=h; return; }
      box.__rdrx=h;
      var lastTap={mid:null,t:0,x:0,y:0}, lastTouch=0, sw=null;
      function bub(e){ var el=e.target.closest&&e.target.closest('.thread-bubble[data-mid]'); return el&&box.contains(el)?el:null; }
      box.addEventListener('click',function(e){
        var q=e.target.closest&&e.target.closest('.rdrx-q'); if(q){ e.stopPropagation(); R.flash(box,q.getAttribute('data-q')); return; }
        var a=e.target.closest&&e.target.closest('.rdrx-hov button'); if(!a) return;
        var el=bub(e); if(!el) return; e.stopPropagation();
        var mid=el.getAttribute('data-mid');
        if(a.getAttribute('data-act')==='reply') box.__rdrx.reply(mid); else box.__rdrx.like(mid);
      });
      // doble clic (mouse). En táctil lo maneja touchend para que no cuente dos veces.
      box.addEventListener('dblclick',function(e){
        if(Date.now()-lastTouch<700) return;
        var el=bub(e); if(!el||!e.target.closest('.bubble-body')||e.target.closest('.rdrx-hov')) return;
        e.preventDefault(); try{ getSelection().removeAllRanges(); }catch(_){}
        box.__rdrx.like(el.getAttribute('data-mid'));
      });
      box.addEventListener('touchstart',function(e){
        lastTouch=Date.now();
        var el=bub(e), t=e.touches[0]; if(!el||e.touches.length>1) { sw=null; return; }
        sw={el:el,x:t.clientX,y:t.clientY,d:0,on:false,armed:false,edge:t.clientX<32};
      },{passive:true});
      box.addEventListener('touchmove',function(e){
        if(!sw||sw.edge) return;
        var t=e.touches[0], dx=t.clientX-sw.x, dy=t.clientY-sw.y;
        if(!sw.on){
          if(Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)){ sw=null; return; }
          if(dx>10&&dx>Math.abs(dy)*1.4){ sw.on=true; sw.el.classList.add('rdrx-sw'); sw.ar=document.createElement('span'); sw.ar.className='rdrx-ar'; sw.ar.innerHTML='<svg viewBox="0 0 24 24"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>'; (sw.el.querySelector('.bubble-body')||sw.el).appendChild(sw.ar); }
          else return;
        }
        e.preventDefault();
        var L=62, d=Math.max(0,dx); d=d<L?d:L+(d-L)*.22; sw.d=d;
        sw.el.style.transform='translateX('+d+'px)';
        var p=Math.min(1,d/L); sw.ar.style.opacity=p; sw.ar.style.transform='translateY(-50%) scale('+(.5+.5*p)+')';
        if(d>=L&&!sw.armed){ sw.armed=true; try{ _rdHaptic&&_rdHaptic('LIGHT'); }catch(_){} }
        else if(d<L-8) sw.armed=false;
      },{passive:false});
      box.addEventListener('touchend',function(e){
        var s=sw; sw=null;
        if(s&&s.on){
          s.el.style.transition='transform .35s cubic-bezier(.3,1.4,.5,1)'; s.el.style.transform='';
          setTimeout(function(){ s.el.style.transition=''; s.el.classList.remove('rdrx-sw'); s.ar&&s.ar.remove(); },360);
          if(s.armed) box.__rdrx.reply(s.el.getAttribute('data-mid'));
          return;
        }
        // doble toque
        var el=bub(e); if(!el||!e.target.closest('.bubble-body')) return;
        var t=e.changedTouches[0], mid=el.getAttribute('data-mid'), now=Date.now();
        if(lastTap.mid===mid&&now-lastTap.t<320&&Math.abs(t.clientX-lastTap.x)<30&&Math.abs(t.clientY-lastTap.y)<30){
          e.preventDefault(); lastTap.mid=null; box.__rdrx.like(mid);
        } else lastTap={mid:mid,t:now,x:t.clientX,y:t.clientY};
      });
      box.addEventListener('touchcancel',function(){ if(sw&&sw.on){ sw.el.style.transform=''; sw.el.classList.remove('rdrx-sw'); sw.ar&&sw.ar.remove(); } sw=null; });
    }
  };

  // ── pegamento con la página (index.html / desktop.html): usa sus globales al llamar ──
  function hap(k){ try{ if(typeof _rdHaptic==='function') _rdHaptic(k); }catch(e){} }
  function toast(t){ try{ showToast(t); }catch(e){} }
  var pmTal={ref:null,len:-1,v:null};
  function pmTally(t){
    var L=t.likes||[];
    if(pmTal.ref!==L||pmTal.len!==L.length){ pmTal={ref:L,len:L.length,v:R.tally(L.map(function(l){ return {text:l.text,who:l.mine?'me':'them'}; }),'me')}; }
    return pmTal.v;
  }
  R.pm={reply:null};
  /** piezas de la burbuja de un chat privado */
  R.pmBits=function(m){
    var t=typeof currentThread!=='undefined'?currentThread:null;
    var out={a:'',c:'',q:'',p:'',h:'',text:R.strip(m.text)};
    var rid=R.replyId(m.text);
    if(rid&&t){
      var q=(t.messages||[]).find(function(x){ return String(x.id)===rid; });
      out.q=R.quote(rid,q?(q.mine?'tú':(t.otherName||'usuario')):'mensaje',q?R.snippet(q.text):'mensaje anterior');
    }
    if(!t||!t.isPM||!m.id) return out;
    var tal=pmTally(t), id=String(m.id), n=tal.n[id]||0;
    out.a=' data-mid="'+esc(id)+'"'; out.c=n?' rdrx-has':''; out.p=R.pill(n); out.h=R.hov();
    return out;
  };
  R.pmSig=function(){ var t=typeof currentThread!=='undefined'?currentThread:null; return t&&t.likes?String(t.likes.length):'0'; };
  R.pmLike=function(mid){
    var t=currentThread; if(!t||!t.isPM||!_supa) return;
    var on=!pmTally(t).me[mid], text=R.marker(mid,on);
    var tmp={text:text,mine:true,at:new Date().toISOString()};
    (t.likes=t.likes||[]).push(tmp);
    hap(on?'MEDIUM':'LIGHT');
    renderThreadMessages();
    if(on) R.pop(document.getElementById('thread-messages'),mid);
    _supa.from('private_messages').insert({sender_id:USER_STATE.id,receiver_id:t.otherId,source_id:t.sourceId||null,source_type:t.sourceType||null,source_title:t.carTitle,text:text}).then(function(r){
      if(r.error){ t.likes=t.likes.filter(function(x){ return x!==tmp; }); renderThreadMessages(); toast('no se pudo guardar el corazón'); return; }
      if(on) _supa.from('notifications').insert({user_id:t.otherId,tipo:'pm',titulo:'Le gustó tu mensaje',body:(USER_STATE.nombre||USER_STATE.username||'Un usuario')+' le dio ❤️ a tu mensaje',icon:'lime',source_id:String(USER_STATE.id),source_type:'pm'}).then(null,function(){});
      try{ _loadPrivateMessages(); }catch(e){}
    });
  };
  function inputBar(kind){
    if(kind==='pm'){ var i=document.getElementById('thread-input'); return i&&{parent:i.parentElement,before:i,input:i}; }
    var pv=document.getElementById('gc-photo-preview'); return pv&&{parent:pv.parentElement,before:pv,input:document.getElementById('global-chat-input')};
  }
  R.pmReply=function(mid){
    var t=currentThread; if(!t) return;
    var q=(t.messages||[]).find(function(x){ return String(x.id)===mid; }); if(!q) return;
    R.pm.reply={tid:String(t.id),mid:mid};
    var b=inputBar('pm'); if(!b) return;
    R.setReply(b.parent,b.before,{name:q.mine?'tu mensaje':(t.otherName||'usuario'),text:R.snippet(q.text)},function(){ R.pm.reply=null; });
    try{ b.input.focus(); }catch(e){}
  };
  /** al enviar: agrega la cita (si es de este chat) y quita la barra */
  R.pmTake=function(text){
    var r=R.pm.reply, t=typeof currentThread!=='undefined'?currentThread:null;
    R.pm.reply=null; var b=inputBar('pm'); if(b) R.setReply(b.parent,null,null);
    return r&&t&&t.isPM&&r.tid===String(t.id)?text+'\n[[rdre:'+r.mid+']]':text;
  };
  /** cambia de chat: la cita pendiente de otro chat se suelta */
  R.pmSync=function(){
    var r=R.pm.reply, t=typeof currentThread!=='undefined'?currentThread:null;
    if(r&&(!t||r.tid!==String(t.id))){ R.pm.reply=null; var b=inputBar('pm'); if(b) R.setReply(b.parent,null,null); }
    var box=document.getElementById('thread-messages');
    if(box) R.bind(box,{like:R.pmLike,reply:R.pmReply});
  };

  // chat del mercado: corazones en la sala ROOM+':rx'
  R.gcRx=[]; R.gc={reply:null};
  function rxRoom(){ return (typeof GLOBAL_CHAT_ROOM!=='undefined'?GLOBAL_CHAT_ROOM:'conduciendo-el-mercado')+':rx'; }
  var gcTal={len:-1,v:null};
  function gcTally(){
    if(gcTal.len!==R.gcRx.length) gcTal={len:R.gcRx.length,v:R.tally(R.gcRx.map(function(r){ return {text:r.text,who:String(r.user_id)}; }),String(USER_STATE.id))};
    return gcTal.v;
  }
  R.gcBits=function(m){
    var out={a:'',c:'',q:'',p:'',h:'',text:m.text?R.strip(m.text):''};
    var rid=R.replyId(m.text);
    if(rid){
      var q=GLOBAL_CHAT_MSGS.find(function(x){ return String(x.id)===rid; });
      out.q=R.quote(rid,q?(String(q.user_id)===String(USER_STATE.id)?'tú':_globalChatSenderName(q.user_id)):'mensaje',q?R.snippet(q.text,q.image_url):'mensaje anterior');
    }
    if(!m.id||String(m.id).indexOf('tmp_')===0||(typeof isGuest==='function'&&isGuest())) return out;
    var id=String(m.id), n=gcTally().n[id]||0;
    out.a=' data-mid="'+esc(id)+'"'; out.c=n?' rdrx-has':''; out.p=R.pill(n); out.h=R.hov();
    return out;
  };
  R.gcLoadRx=async function(){
    if(!_supa) return;
    try{
      var r=await _supa.from('public_chat_messages').select('id,user_id,text,created_at').eq('room',rxRoom()).order('created_at',{ascending:false}).limit(35);
      if(r.error) return;
      R.gcRx=(r.data||[]).reverse();
      if(currentView==='global-chat') renderGlobalChatMessages();
    }catch(e){}
  };
  R.gcOnRx=function(m){
    if(!m||R.gcRx.some(function(x){ return x.id===m.id; })) return;
    R.gcRx=R.gcRx.filter(function(x){ return !(String(x.id).indexOf('tmp_')===0&&x.user_id===m.user_id&&x.text===m.text); });
    R.gcRx.push(m); if(R.gcRx.length>35) R.gcRx=R.gcRx.slice(-35);
    if(currentView==='global-chat'){ renderGlobalChatMessages(); var l=R.like(m.text); if(l&&l.on&&m.user_id!==USER_STATE.id) R.pop(document.getElementById('global-chat-messages'),l.id); }
  };
  /** el canal del chat del mercado también escucha la sala de corazones */
  R.gcListen=function(ch){ return ch.on('postgres_changes',{event:'INSERT',schema:'public',table:'public_chat_messages',filter:'room=eq.'+rxRoom()},function(p){ R.gcOnRx(p.new); }); };
  R.gcLike=function(mid){
    if(!_supa||(typeof isGuest==='function'&&isGuest())){ toast('inicia sesión para reaccionar'); return; }
    var on=!gcTally().me[mid], text=R.marker(mid,on);
    var tmp={id:'tmp_'+Date.now(),user_id:USER_STATE.id,text:text,created_at:new Date().toISOString()};
    R.gcRx.push(tmp); hap(on?'MEDIUM':'LIGHT');
    renderGlobalChatMessages();
    if(on) R.pop(document.getElementById('global-chat-messages'),mid);
    _supa.from('public_chat_messages').insert({room:rxRoom(),user_id:USER_STATE.id,text:text}).then(function(r){
      if(r.error){ R.gcRx=R.gcRx.filter(function(x){ return x!==tmp; }); renderGlobalChatMessages(); toast('no se pudo guardar el corazón'); }
    });
  };
  R.gcReply=function(mid){
    if(typeof isGuest==='function'&&isGuest()){ toast('inicia sesión para responder'); return; }
    var q=GLOBAL_CHAT_MSGS.find(function(x){ return String(x.id)===mid; }); if(!q) return;
    R.gc.reply=mid;
    var b=inputBar('gc'); if(!b) return;
    var me=String(q.user_id)===String(USER_STATE.id);
    R.setReply(b.parent,b.before,{name:me?'tu mensaje':_globalChatSenderName(q.user_id),text:R.snippet(q.text,q.image_url)},function(){ R.gc.reply=null; });
    try{ b.input&&b.input.focus(); }catch(e){}
  };
  R.gcTake=function(text){
    var r=R.gc.reply; R.gc.reply=null; var b=inputBar('gc'); if(b) R.setReply(b.parent,null,null);
    return r?(text||'')+'\n[[rdre:'+r+']]':text;
  };
  R.gcSync=function(){ var box=document.getElementById('global-chat-messages'); if(box) R.bind(box,{like:R.gcLike,reply:R.gcReply}); };
  var css=document.createElement('style');
  css.textContent=[
    '.thread-bubble[data-mid] .bubble-body{position:relative;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;touch-action:pan-y manipulation}',
    '@media (hover:hover) and (pointer:fine){.thread-bubble[data-mid] .bubble-body{-webkit-user-select:text;user-select:text}}',
    '.thread-bubble.rdrx-has .bubble-body{margin-bottom:12px}',
    '.thread-bubble[data-mid]{position:relative}',
    '.rdrx-q{display:flex;flex-direction:column;gap:1px;margin:-2px -6px 7px;padding:6px 10px 7px;border-left:3px solid currentColor;border-radius:8px;background:color-mix(in srgb,currentColor 9%,transparent);cursor:pointer;min-width:120px;max-width:100%}',
    '.thread-bubble.theirs .rdrx-q{border-left-color:var(--rd-green)}',
    '.thread-bubble.theirs .rdrx-q b{color:var(--rd-green)}',
    '.rdrx-q b{font-size:12px;font-weight:700;opacity:.9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.rdrx-q span{font-size:13px;line-height:1.3;opacity:.72;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
    '.rdrx-pill{position:absolute;bottom:-14px;display:inline-flex;align-items:center;gap:3px;height:22px;padding:0 7px;border-radius:11px;background:var(--card2,#1e1e1e);border:2px solid var(--surface-hi,#000);color:var(--white);font-size:11px;font-weight:700;font-style:normal;animation:rdrxIn .38s cubic-bezier(.3,1.6,.5,1)}',
    '.thread-bubble.mine .rdrx-pill{left:8px}.thread-bubble.theirs .rdrx-pill{right:8px}',
    '.rdrx-pill svg{width:12px;height:12px;fill:#f2352b}.rdrx-pill i{font-style:normal}',
    '.rdrx-pop{position:absolute;left:50%;top:50%;width:44px;height:44px;margin:-22px 0 0 -22px;pointer-events:none;animation:rdrxPop .85s ease forwards;filter:drop-shadow(0 3px 8px rgba(0,0,0,.25))}',
    '.rdrx-pop svg{width:100%;height:100%;fill:#f2352b}',
    '@keyframes rdrxPop{0%{opacity:0;transform:scale(.3)}25%{opacity:1;transform:scale(1.12)}45%{transform:scale(1)}75%{opacity:1;transform:scale(1)}100%{opacity:0;transform:translateY(-10px) scale(1.15)}}',
    '@keyframes rdrxIn{from{transform:scale(.4)}to{transform:scale(1)}}',
    '.rdrx-ar{position:absolute;left:-42px;top:50%;width:30px;height:30px;border-radius:50%;background:var(--w10);display:grid;place-items:center;opacity:0;pointer-events:none}',
    '.rdrx-ar svg,.rdrx-hov svg{width:15px;height:15px;fill:none;stroke:var(--white);stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}',
    '.rdrx-hov{display:none}',
    '@media (hover:hover) and (pointer:fine){.rdrx-hov{display:flex;gap:4px;position:absolute;top:50%;transform:translateY(-50%);opacity:0;transition:opacity .15s}.thread-bubble.mine .rdrx-hov{left:-72px}.thread-bubble.theirs .rdrx-hov{right:-72px}.thread-bubble[data-mid]:hover .rdrx-hov{opacity:1}.rdrx-hov button{width:30px;height:30px;border-radius:50%;border:none;background:var(--w8);display:grid;place-items:center;cursor:pointer}.rdrx-hov button:hover{background:var(--w14)}}',
    '.rdrx-flash .bubble-body{animation:rdrxFlash .6s ease}',
    '@keyframes rdrxFlash{0%,100%{filter:none}40%{filter:brightness(1.35)}}',
    '.rdrx-reply{flex:0 0 100%;display:flex;align-items:center;gap:10px;margin:0 0 8px;padding:7px 8px 7px 10px;border-left:3px solid var(--rd-green);border-radius:10px;background:var(--w6);box-sizing:border-box;animation:rdrxUp .22s ease}',
    '.rdrx-reply div{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}',
    '.rdrx-reply b{font-size:12px;font-weight:700;color:var(--rd-green);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.rdrx-reply span{font-size:13px;color:var(--w60);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.rdrx-reply button{width:24px;height:24px;flex-shrink:0;border-radius:50%;border:none;background:var(--w10);color:var(--white);font-size:16px;line-height:1;cursor:pointer}',
    '@keyframes rdrxUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}',
    'html[data-theme="light"] .rdrx-reply,html[data-theme="light"] .rdrx-reply b{border-left-color:#0a0a0a}html[data-theme="light"] .rdrx-reply b,html[data-theme="light"] .thread-bubble.theirs .rdrx-q b{color:#0a0a0a}html[data-theme="light"] .thread-bubble.theirs .rdrx-q{border-left-color:#0a0a0a}'
  ].join('\n');
  (document.head||document.documentElement).appendChild(css);
})();
