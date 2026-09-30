/* ─────────────────────────────────────────────────────────────
   RUEDDA · CHAT NATIVO (app iOS 1.6+)
   Los chats (privados y "conduciendo el mercado") los dibuja iOS con UIKit.
   Este módulo es su capa de datos: usa la MISMA sesión y el MISMO cliente de
   Supabase de la web (_supa), así las consultas, permisos y notificaciones son
   idénticos a los de siempre. Solo se descarga si la app trae
   window.__RD_NATIVE_CHAT; en la web, la PWA y versiones anteriores no existe.
   iOS → web:  RDNC.* (callAsyncJavaScript, devuelve datos)
   web → iOS:  webkit.messageHandlers.rdChat (abrir chat, eventos en vivo)
   ───────────────────────────────────────────────────────────── */
(function(){
  if(!window.__RD_NATIVE_CHAT) return;
  var H=window.webkit&&webkit.messageHandlers&&webkit.messageHandlers.rdChat;
  if(!H||typeof openThread!=='function') return;
  function post(m){ try{ H.postMessage(m); }catch(e){} }
  function me(){ try{ return (USER_STATE&&USER_STATE.id)||null; }catch(e){ return null; } }
  function myName(){ try{ return USER_STATE.nombre||USER_STATE.username||'Un usuario'; }catch(e){ return 'Un usuario'; } }
  function theme(){ return document.documentElement.getAttribute('data-theme')==='light'?'light':'dark'; }
  function dealerRole(r){ return r==='concesionario'||r==='consesionario'; }
  function img(u,w,q){ try{ return u?_tImg(u,{width:w,quality:q}):''; }catch(e){ return u||''; } }
  function pmRow(m){
    return {id:String(m.id),mine:String(m.sender_id)===String(me()),text:m.text||'',at:m.created_at||'',read:!!m.read,
      st:m.source_type||'',sid:m.source_id!=null?String(m.source_id):'',stitle:m.source_title||''};
  }
  function gcRow(m){
    return {id:String(m.id),uid:String(m.user_id),mine:String(m.user_id)===String(me()),text:m.text||'',
      img:m.image_url?img(m.image_url,500,75):'',full:m.image_url||'',at:m.created_at||''};
  }
  function gcUser(u){ return u?{id:String(u.id),n:u.nombre||u.username||'usuario Ruedda',av:u.avatar_url?img(u.avatar_url,120,75):''}:null; }

  var RDNC=window.RDNC={}, cur=null;

  // ── abrir: los mismos puntos de entrada de siempre ─────────────
  var webOpenThread=window.openThread, webOpenGlobal=window.openGlobalChat;
  window.openThread=function(id){
    var t=(THREADS||[]).find(function(x){ return String(x.id)===String(id); });
    if(!t||!t.isPM||!me()) return webOpenThread.apply(this,arguments);
    t.unread=false;
    var dealer=!!(t.otherIsDealer||dealerRole(t.otherRole));
    cur={kind:'pm',otherId:String(t.otherId),title:t.carTitle||'mensaje',sid:t.sourceId?String(t.sourceId):'',st:t.sourceType||''};
    post({ev:'open',kind:'pm',theme:theme(),me:String(me()),
      thread:{otherId:cur.otherId,name:t.otherName||'usuario',avatar:img(t.otherAvatar,120,75),dealer:dealer,kyc:!!t.otherKyc,
        title:cur.title,sid:cur.sid,st:cur.st},
      seed:(t.messages||[]).map(function(m){ return {text:m.text||'',mine:!!m.mine,time:m.time||'',st:m.sourceType||'',sid:m.sourceId?String(m.sourceId):'',stitle:m.sourceTitle||''}; })});
  };
  window.openGlobalChat=function(){
    if(!me()) return webOpenGlobal.apply(this,arguments);
    cur={kind:'gc'};
    post({ev:'open',kind:'gc',theme:theme(),me:String(me()),
      seed:(typeof GLOBAL_CHAT_MSGS!=='undefined'?GLOBAL_CHAT_MSGS:[]).filter(function(m){ return String(m.id).indexOf('tmp_')!==0; }).map(gcRow),
      users:Object.values(typeof _globalChatUsersCache!=='undefined'?_globalChatUsersCache:{}).map(gcUser)});
  };

  // ── chat privado ───────────────────────────────────────────────
  var PM_COLS='id,sender_id,receiver_id,source_id,source_type,source_title,text,read,created_at';
  RDNC.pmLoad=async function(o,before){
    var u=me(), q=_supa.from('private_messages').select(PM_COLS)
      .or('and(sender_id.eq.'+u+',receiver_id.eq.'+o+'),and(sender_id.eq.'+o+',receiver_id.eq.'+u+')')
      .order('created_at',{ascending:false}).limit(60);
    if(before) q=q.lt('created_at',before);
    var r=await q; if(r.error) throw new Error(r.error.message);
    var data=r.data||[];
    var un=data.filter(function(m){ return String(m.receiver_id)===String(u)&&!m.read; }).map(function(m){ return m.id; });
    if(un.length) _supa.from('private_messages').update({read:true}).in('id',un).then(null,function(){});
    return {rows:data.reverse().map(pmRow),more:data.length===60};
  };
  RDNC.pmRead=async function(ids){
    if(ids&&ids.length) await _supa.from('private_messages').update({read:true}).in('id',ids);
    return true;
  };
  // avatar real (logo del concesionario o foto) y teléfono para llamar: igual que openThread
  RDNC.pmHeader=async function(o,dealer,sid){
    var out={avatar:'',phone:''};
    if(dealer){
      var c=await _supa.from('concesionarios').select('*').eq('user_id',o).maybeSingle();
      var cd=c.data;
      if(cd&&(cd.logo_url||cd.logo)) out.avatar=img(cd.logo_url||cd.logo,120,75);
      var tel=String((cd&&(cd.telefono||cd.whatsapp))||'').replace(/[^0-9+]/g,'');
      if(!tel&&sid){
        try{
          var s=await _supa.from('listings').select('whatsapp').eq('id',String(sid)).maybeSingle();
          tel=String((s.data&&s.data.whatsapp)||'').replace(/[^0-9+]/g,'');
          if(!tel){ var s2=await _supa.from('auctions').select('whatsapp').eq('id',String(sid)).maybeSingle(); tel=String((s2.data&&s2.data.whatsapp)||'').replace(/[^0-9+]/g,''); }
        }catch(e){}
      }
      out.phone=tel;
    } else {
      var uu=await _supa.from('users').select('avatar_url').eq('id',o).maybeSingle();
      if(uu.data&&uu.data.avatar_url) out.avatar=img(uu.data.avatar_url,120,75);
    }
    return out;
  };
  RDNC.pmSend=async function(o,text,title,sid,st){
    var r=await _supa.from('private_messages').insert({sender_id:me(),receiver_id:o,source_id:sid||null,source_type:st||null,source_title:title,text:text}).select(PM_COLS).single();
    if(r.error) throw new Error(r.error.message);
    // notificación persistente para el receptor — igual que sendThreadReply
    _supa.from('notifications').insert({user_id:o,tipo:'pm',titulo:'Nuevo mensaje',body:myName()+' respondió sobre '+(title||'tu publicación'),icon:'lime',source_id:String(me()),source_type:'pm'}).then(null,function(){});
    return pmRow(r.data);
  };
  // tarjeta de publicación ([[rdpost:ID]]) y miniatura de historia respondida
  RDNC.post=async function(id){
    var l=(typeof MARKET_LISTINGS!=='undefined'?MARKET_LISTINGS:[]).find(function(x){ return String(x.id)===String(id); });
    if(!l&&typeof _ensureMarketListing==='function') l=await _ensureMarketListing(id);
    if(!l) return null;
    var ph=l.photoUrls&&l.photoUrls[0];
    return {title:l.title||'publicación',sub:fmtBid(l.price)+(l.location?' · '+l.location:''),img:ph?img(ph,160,72):''};
  };
  // tarjeta de la negociación (arriba del chat): la publicación o subasta de origen
  RDNC.ctx=async function(sid,st){
    if(!sid) return null;
    if(st==='auction'){
      var all=[].concat(typeof AUCTIONS!=='undefined'?AUCTIONS:[],typeof AUCTIONS_CHOCADOS!=='undefined'?AUCTIONS_CHOCADOS:[]);
      var a=all.find(function(x){ return String(x.id)===String(sid); });
      if(a){ var ph=a.photoUrls&&a.photoUrls[0]; return {title:a.title||'subasta',sub:(a.currentBid?fmtBid(a.currentBid):'subasta')+' · subasta',img:ph?img(ph,160,72):''}; }
      return null;
    }
    if(st==='listing'||st==='market'||!st) return await RDNC.post(sid);
    return null;
  };
  RDNC.story=async function(id){
    var r=await _supa.from('stories').select('media_url').eq('id',id).maybeSingle();
    return r.data&&r.data.media_url?img(r.data.media_url,120,70):'';
  };

  // ── conduciendo el mercado ─────────────────────────────────────
  var ROOM=typeof GLOBAL_CHAT_ROOM!=='undefined'?GLOBAL_CHAT_ROOM:'conduciendo-el-mercado';
  async function gcUsers(ids){
    var cache=typeof _globalChatUsersCache!=='undefined'?_globalChatUsersCache:{};
    var miss=ids.filter(function(id,i){ return ids.indexOf(id)===i&&!cache[id]; });
    if(miss.length){ var r=await _supa.from('users').select('id,nombre,username,avatar_url').in('id',miss); (r.data||[]).forEach(function(u){ cache[u.id]=u; }); }
    return ids.map(function(id){ return gcUser(cache[id]); }).filter(Boolean);
  }
  RDNC.gcLoad=async function(){
    var r=await _supa.from('public_chat_messages').select('*').eq('room',ROOM).order('created_at',{ascending:false}).limit(35);
    if(r.error) throw new Error(r.error.message);
    var rows=(r.data||[]).reverse();
    try{ GLOBAL_CHAT_MSGS=rows.slice(); }catch(e){}
    return {rows:rows.map(gcRow),users:await gcUsers(rows.map(function(m){ return m.user_id; }))};
  };
  RDNC.gcSend=async function(text,b64){
    var url=null;
    if(b64){
      var bin=atob(b64), arr=new Uint8Array(bin.length);
      for(var i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
      var path='chat-'+me()+'_'+Date.now()+'.jpg';
      var up=await _supa.storage.from('assets').upload(path,new Blob([arr],{type:'image/jpeg'}),{upsert:false,contentType:'image/jpeg'});
      if(up.error) throw new Error('error subiendo foto: '+up.error.message);
      url=_supa.storage.from('assets').getPublicUrl(path).data.publicUrl;
    }
    var r=await _supa.from('public_chat_messages').insert({room:ROOM,user_id:me(),text:text||null,image_url:url}).select('*').single();
    if(r.error) throw new Error(r.error.message);
    return gcRow(r.data);
  };
  RDNC.gcDelete=async function(id){
    var r=await _supa.from('public_chat_messages').delete().eq('id',id).select('id');
    if(r.error) throw new Error(r.error.message);
    return (r.data||[]).length>0;
  };
  // compartir publicación: mis publicaciones, mismo texto que _gcShareListing
  RDNC.gcMine=async function(){
    if(!MOCK_MY_LISTINGS.length) await _loadMyListings();
    return MOCK_MY_LISTINGS.map(function(l,i){ return {i:i,title:l.title||'',price:String(l.price||''),img:l.photoUrl?img(l.photoUrl,300,70):''}; });
  };
  RDNC.gcShare=async function(i){
    var l=MOCK_MY_LISTINGS[i]; if(!l) throw new Error('publicación no disponible');
    var r=await _supa.from('public_chat_messages').insert({room:ROOM,user_id:me(),text:'compartió su publicación: '+l.title+' · '+l.price,image_url:l.photoUrl||null}).select('*').single();
    if(r.error) throw new Error(r.error.message);
    return gcRow(r.data);
  };

  // ── en vivo: solo mientras hay un chat nativo abierto ──────────
  var ch=null;
  function stopLive(){ if(ch){ try{ ch.unsubscribe(); _supa.removeChannel(ch); }catch(e){} ch=null; } }
  RDNC.live=function(kind,o){
    stopLive(); var u=me(); if(!u) return false;
    var c=_supa.channel('rdnc-'+kind+'-'+Date.now());
    if(kind==='pm'){
      var onIns=function(p){ var m=p.new; var other=String(m.sender_id)===String(u)?m.receiver_id:m.sender_id; if(String(other)===String(o)) post({ev:'pm',row:pmRow(m)}); };
      c.on('postgres_changes',{event:'INSERT',schema:'public',table:'private_messages',filter:'receiver_id=eq.'+u},onIns)
       .on('postgres_changes',{event:'INSERT',schema:'public',table:'private_messages',filter:'sender_id=eq.'+u},onIns)
       .on('postgres_changes',{event:'UPDATE',schema:'public',table:'private_messages',filter:'sender_id=eq.'+u},function(p){ var m=p.new; if(m&&m.read&&String(m.receiver_id)===String(o)) post({ev:'pmread',id:String(m.id)}); });
    } else {
      c.on('postgres_changes',{event:'INSERT',schema:'public',table:'public_chat_messages',filter:'room=eq.'+ROOM},async function(p){
        var m=p.new, us=await gcUsers([m.user_id]); post({ev:'gc',row:gcRow(m),user:us[0]||null});
      }).on('postgres_changes',{event:'DELETE',schema:'public',table:'public_chat_messages'},function(p){ if(p.old&&p.old.id) post({ev:'gcdel',id:String(p.old.id)}); });
    }
    c.subscribe(function(s){ post({ev:'live',state:s}); });
    ch=c; return true;
  };

  function doAction(a){
    try{
      if(!a||!a.t) return;
      if(a.t==='profile') (a.dealer?_openVitrinaByUserId:openUserProfile)(a.id);
      else if(a.t==='source') _goToSource(String(a.id),a.type||'');
      else if(a.t==='listing') openMarketDetail(String(a.id));
    }catch(e){}
  }
  // ── cerrar: la bandeja se refresca y, si hace falta, se abre lo tocado ──
  RDNC.closed=function(a){
    stopLive(); cur=null; parked=null;
    try{ if(typeof _loadPrivateMessages==='function') _loadPrivateMessages(true); }catch(e){}
    doAction(a);
    return true;
  };

  // ── perfil / publicación POR ENCIMA del chat (como WhatsApp) ─────────
  // El chat queda en pausa en iOS; al volver de esa pantalla, el chat regresa
  // tal cual estaba en vez de ir al inicio.
  var parked=null, ROOTS=['home','notificaciones','favoritos','cuenta'];
  RDNC.peek=async function(a){
    parked={t:Date.now(),view:null,from:currentView};
    doAction(a);
    // espera a que la vista nueva esté puesta (el perfil y la vitrina cargan async)
    for(var i=0;i<20;i++){ await new Promise(function(r){ setTimeout(r,40); }); if(currentView!==parked.from) break; }
    parked.view=currentView;
    return parked.view;
  };
  function resume(nav){
    parked=null; post({ev:'resume'});
    window.__rdResumeNav=nav;
  }
  RDNC.resumed=function(){
    var n=window.__rdResumeNav; window.__rdResumeNav=null;
    try{ if(n) n(); else { webShowView('notificaciones'); if(typeof switchNotifTab==='function') switchNotifTab('mensajes'); } }catch(e){}
    return true;
  };
  RDNC.unparked=function(){ parked=null; return true; };
  var webShowView=window.showView;
  window.showView=function(name){
    if(parked&&parked.view){
      // volver desde el perfil (su "atrás" va a la bandeja) → regresa el chat
      if(name===parked.from&&currentView===parked.view){ var from=parked.from; resume(function(){ webShowView(from); if(from==='notificaciones'&&typeof switchNotifTab==='function') switchNotifTab('mensajes'); }); return; }
      // se fue a otra sección desde otra pantalla: el chat en pausa se suelta
      if(ROOTS.indexOf(name)>-1&&currentView!==parked.view){ parked=null; post({ev:'unpark'}); }
    }
    return webShowView.apply(this,arguments);
  };
  // publicaciones, subastas y vitrinas salen por su propio "volver": desde un chat, vuelven al chat
  ['_rdExitMarketDetail','_rdExitAuctionDetail','_rdExitVitrina'].forEach(function(fn){
    var orig=window[fn]; if(typeof orig!=='function') return;
    window[fn]=function(afterNav){
      if(parked&&parked.view&&currentView===parked.view){
        var from=parked.from;
        try{ if(fn!=='_rdExitVitrina'&&typeof _stopViewerPresence==='function') _stopViewerPresence(); }catch(e){}
        resume(function(){ webShowView(from||'notificaciones'); if(from==='notificaciones'&&typeof switchNotifTab==='function') switchNotifTab('mensajes'); if(typeof afterNav==='function') afterNav(); });
        return;
      }
      return orig.apply(this,arguments);
    };
  });
  // al volver del segundo plano, el socket de iOS puede haber muerto: iOS lo pide de nuevo
  RDNC.wake=function(){ if(cur) RDNC.live(cur.kind,cur.otherId); return true; };

  post({ev:'ready'});
})();
