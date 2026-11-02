/* ── MASTER DE VITRINAS [2026-11-02] ──────────────────────────────────────────
   Control → Comercial → "Master de vitrinas". Solo superadmin.
   · Cualquier concesionario: banner, logo, datos, vitrina activa.
   · Sus carros: fotos (agregar, cambiar, borrar, ordenar, portada) y datos de cada publicación.
   Datos del concesionario y de la publicación: update directo (igual que la sección Concesionarios).
   Fotos: /api/admin-user?vitrina=1 (lib/vitrina-admin.js, service key) porque la RLS de
   listing_photos solo deja escribir al dueño. Las imágenes se suben al bucket público 'assets'.
   Usa los helpers globales de control.html (sb, $, esc, modal, toast, upload, formHtml, readForm,
   C_FIELDS, C_TIPOS, LISTING_FIELDS, cEstado, tImg, usd, carName, stPill, empty, api, VIEW_TOKEN, CUR).
   ──────────────────────────────────────────────────────────────────────────── */
(function(){
const VM_MIN=6;                       // carros mínimos para que la vitrina cuente (regla del Dealer Membership)
let VM={q:'',sel:null};
const vmApi=b=>api('/api/admin-user?vitrina=1',b);
const vmPickMany=accept=>new Promise(r=>{ const i=document.createElement('input'); i.type='file'; i.multiple=true; i.accept=accept||'image/*'; i.onchange=()=>r(Array.from(i.files||[])); i.click(); });
// la imagen se reduce en el navegador y se sube por el servidor (service key). PNG con transparencia se queda en PNG.
function vmShrink(f,dim){ return new Promise((res,rej)=>{ const url=URL.createObjectURL(f), img=new Image();
  img.onload=()=>{ URL.revokeObjectURL(url); let w=img.naturalWidth,h=img.naturalHeight; const s=Math.min(1,dim/Math.max(w,h)); w=Math.round(w*s); h=Math.round(h*s);
    const c=document.createElement('canvas'); c.width=w; c.height=h; c.getContext('2d').drawImage(img,0,0,w,h);
    const png=/png|webp/i.test(f.type); const t=png?'image/png':'image/jpeg';
    c.toBlob(b=>b?res(b):rej(new Error('no se pudo procesar la imagen')),t,png?undefined:0.86); };
  img.onerror=()=>{ URL.revokeObjectURL(url); rej(new Error('formato no soportado: usa JPG o PNG (las fotos HEIC del iPhone, expórtalas como JPG)')); };
  img.src=url; }); }
const vmB64=b=>new Promise((r,j)=>{ const fr=new FileReader(); fr.onload=()=>r(String(fr.result).split(',')[1]); fr.onerror=()=>j(new Error('no se pudo leer la imagen')); fr.readAsDataURL(b); });
async function vmUp(f,prefix,dim){
  let b=await vmShrink(f,dim||2000);
  if(b.size>2.8*1024*1024) b=await vmShrink(new File([b],'x.jpg',{type:'image/jpeg'}),1400);
  const r=await vmApi({action:'upload',type:b.type,data:await vmB64(b),prefix});
  return r.url;
}
const vmIsImg=u=>u&&/\/storage\//.test(u);

if(!document.getElementById('vm-css')){ const st=document.createElement('style'); st.id='vm-css'; st.textContent=`
.vm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}
.vm-card{border-radius:14px;overflow:hidden;background:var(--card,#fff);border:1px solid var(--line,#eee);cursor:pointer;transition:transform .15s,box-shadow .15s}
.vm-card:hover{transform:translateY(-2px);box-shadow:0 10px 30px rgba(0,0,0,.08)}
.vm-ban{aspect-ratio:16/7;background:#111 center/cover no-repeat;position:relative}
.vm-ban .vm-lg{position:absolute;left:12px;bottom:-18px;width:46px;height:46px;border-radius:12px;background:#111 center/contain no-repeat;border:3px solid var(--card,#fff);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px}
.vm-cb{padding:24px 14px 14px}
.vm-cb .n{font-weight:600;font-size:15px}
.vm-meter{height:6px;border-radius:3px;background:var(--line,#eee);overflow:hidden;margin-top:10px}
.vm-meter i{display:block;height:100%;background:#e6f03b}
.vm-meter.ok i{background:#16a34a}
.vm-hero{position:relative;border-radius:16px;overflow:hidden;aspect-ratio:16/5;background:#111 center/cover no-repeat;margin-bottom:46px}
.vm-hero .vm-hb{position:absolute;right:12px;top:12px;display:flex;gap:8px}
.vm-hero .vm-hl{position:absolute;left:22px;bottom:-34px;width:96px;height:96px;border-radius:20px;background:#111 center/contain no-repeat;border:4px solid var(--bg,#fff);cursor:pointer;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:26px}
.vm-hero .vm-hl:hover::after,.vm-hero:hover .vm-hb .btn{opacity:1}
.vm-cars{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}
.vm-car{border:1px solid var(--line,#eee);border-radius:12px;overflow:hidden;cursor:pointer;background:var(--card,#fff)}
.vm-car .ph{aspect-ratio:4/3;background:#f2f2f2 center/cover no-repeat}
.vm-car .b{padding:10px 12px;font-size:13px}
.vm-ph{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.vm-ph .it{position:relative;border-radius:10px;overflow:hidden;aspect-ratio:4/3;background:#f2f2f2 center/cover no-repeat}
.vm-ph .it .tg{position:absolute;left:6px;top:6px}
.vm-ph .it .ac{position:absolute;left:0;right:0;bottom:0;display:flex;gap:4px;padding:6px;background:linear-gradient(transparent,rgba(0,0,0,.65));justify-content:center}
.vm-ph .it .ac button{height:26px;min-width:26px;padding:0 7px;border-radius:7px;border:0;background:rgba(255,255,255,.92);font-size:12px;cursor:pointer;color:#111}
.vm-ph .it .ac button.r{background:#ef4444;color:#fff}
.vm-ph .add{border:1.5px dashed var(--line2,#ccc);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--mute,#888);font-size:13px;border-radius:10px;aspect-ratio:4/3}
`; document.head.appendChild(st); }

// también lo usa la sección Concesionarios (concImg) para que cambiar logo/portada no dependa de la RLS
window.vmUpload=vmUp; window.vmDealer=(id,patch)=>vmApi({action:'dealer',id,patch});

/* ── lista de vitrinas ── */
RENDER.vitrinas=async(tok,_,soft)=>{
  const V=$('#view');
  if(window.SOCIO){ V.innerHTML=empty('Solo el administrador','El master de vitrinas es del superadmin'); return; }
  if(VM.sel) return vmOpen(VM.sel,tok);
  if(!soft||!$('#vm-l')) V.innerHTML=`<div class="toolbar"><input class="input" id="vm-q" placeholder="Buscar concesionario por nombre o ciudad" value="${esc(VM.q)}"><span class="muted" id="vm-n" style="margin-left:auto;font-size:12.5px"></span></div><div id="vm-l"><div class="skel" style="height:240px"></div></div>`;
  const qi=$('#vm-q'); qi.oninput=()=>{clearTimeout(qi._t);qi._t=setTimeout(()=>{VM.q=qi.value.trim();RENDER.vitrinas(++VIEW_TOKEN,[],true);},220);};
  const [{data,error},{data:pubs}]=await Promise.all([
    sb.from('concesionarios').select('*').order('nombre',{ascending:true}).limit(1000),
    sb.from('listings').select('concesionario_id,estado,vendido').not('concesionario_id','is',null).limit(10000)
  ]); if(stale(tok)) return;
  const L0=$('#vm-l'); if(!L0) return;
  if(error){ L0.innerHTML=empty('No se pudo cargar',error.message); return; }
  const P={}; (pubs||[]).forEach(p=>{ const o=P[p.concesionario_id]=P[p.concesionario_id]||{act:0,tot:0}; o.tot++; if(!p.vendido&&p.estado==='activa') o.act++; });
  let L=data||[]; window._CONC=L;
  if(VM.q){ const s=VM.q.toLowerCase(); L=L.filter(c=>[c.nombre,c.ciudad,c.tag].some(v=>String(v||'').toLowerCase().includes(s))); }
  $('#vm-n').textContent=n(L.length)+' vitrinas';
  if(!L.length){ L0.innerHTML=empty('Sin vitrinas con ese dato'); return; }
  L0.innerHTML=`<div class="vm-grid">${L.map(c=>{ const p=P[c.id]||{act:0,tot:0}; const pct=Math.min(100,p.act/VM_MIN*100);
    return `<div class="vm-card" onclick="vmGo('${c.id}')"><div class="vm-ban" style="${vmIsImg(c.banner_url)?`background-image:url('${esc(tImg(c.banner_url,640))}')`:''}"><div class="vm-lg" style="${vmIsImg(c.logo_url)?`background-image:url('${esc(tImg(c.logo_url,160))}');font-size:0`:''}">${esc(initials(c.nombre||'C'))}</div></div>
    <div class="vm-cb"><div class="n">${esc(c.nombre||'sin nombre')}</div><div class="muted" style="font-size:12.5px;margin-top:2px">${esc(c.ciudad||'—')} · ${cEstado(c)}</div>
    <div class="vm-meter ${p.act>=VM_MIN?'ok':''}"><i style="width:${pct}%"></i></div><div class="muted" style="font-size:12px;margin-top:5px">${n(p.act)} carros activos${p.act>=VM_MIN?' · vitrina completa':` · faltan ${VM_MIN-p.act} para ${VM_MIN}`}</div></div></div>`; }).join('')}</div>`;
};
window.vmGo=id=>{ VM.sel=id; RENDER.vitrinas(++VIEW_TOKEN,[],false); };
window.vmBack=()=>{ VM.sel=null; RENDER.vitrinas(++VIEW_TOKEN,[],false); };

/* ── una vitrina ── */
async function vmOpen(id,tok){
  const V=$('#view'); V.innerHTML='<div class="skel" style="height:360px"></div>';
  const [{data:c,error},{data:L}]=await Promise.all([
    sb.from('concesionarios').select('*').eq('id',id).maybeSingle(),
    sb.from('listings').select('id,titulo,marca,modelo,year,km,estado,vendido,precio_usd,created_at,listing_photos(id,url,orden)').eq('concesionario_id',id).order('created_at',{ascending:false}).limit(200)
  ]); if(stale(tok)) return;
  if(error||!c){ V.innerHTML=`<button class="btn btn-soft" onclick="vmBack()">← Vitrinas</button>`+empty('No encontrado',error&&error.message); return; }
  const cars=L||[]; const act=cars.filter(x=>!x.vendido&&x.estado==='activa').length;
  const cover=x=>{ const p=(x.listing_photos||[]).slice().sort((a,b)=>a.orden-b.orden)[0]; return p?p.url:''; };
  V.innerHTML=`<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px"><button class="btn btn-soft" onclick="vmBack()">← Vitrinas</button><div class="muted" style="font-size:12.5px">${cEstado(c)}</div><a class="btn btn-soft" style="margin-left:auto" href="https://www.ruedda.app/" target="_blank" rel="noopener">Abrir Ruedda ↗</a></div>
  <div class="vm-hero" style="${vmIsImg(c.banner_url)?`background-image:url('${esc(tImg(c.banner_url,1600))}')`:''}">
    <div class="vm-hb"><button class="btn btn-soft" onclick="vmImg('${c.id}','banner_url')">${vmIsImg(c.banner_url)?'Cambiar banner':'Subir banner'}</button>${vmIsImg(c.banner_url)?`<button class="btn btn-soft" onclick="lightbox('${esc(tImg(c.banner_url,2000))}')">Ver</button>`:''}</div>
    <div class="vm-hl" title="Cambiar logo" onclick="vmImg('${c.id}','logo_url')" style="${vmIsImg(c.logo_url)?`background-image:url('${esc(tImg(c.logo_url,320))}');font-size:0`:''}">${esc(initials(c.nombre||'C'))}</div>
  </div>
  <div class="muted" style="font-size:12px;margin:-36px 0 18px 136px">toca el logo para cambiarlo · banner recomendado 1600×700, logo cuadrado con fondo</div>
  ${card(esc(c.nombre||'Concesionario'),'Datos de la vitrina',`<div class="form" style="margin-bottom:6px"><label class="field"><span>Tipo</span><select class="input" data-f="tipo">${C_TIPOS.map(([k,t])=>`<option value="${k}" ${(c.tipo||'agencia')===k?'selected':''}>${t}</option>`).join('')}</select></label></div>
    ${formHtml(C_FIELDS,c)}
    <div class="switch" style="margin-top:10px"><div><div style="font-weight:600">Vitrina activa</div><div class="muted" style="font-size:12px">Apágala para ocultarla de la app sin borrarla</div></div><input type="checkbox" id="vm-act" ${c.activo!==false?'checked':''}></div>
    <div style="display:flex;justify-content:flex-end;margin-top:12px"><button class="btn btn-primary" onclick="vmSave('${c.id}',this)">Guardar datos</button></div>`)}
  ${card(`Carros de la vitrina (${n(cars.length)})`,`${n(act)} activos · ${act>=VM_MIN?'vitrina completa':`faltan ${VM_MIN-act} para llegar a ${VM_MIN}`}`,
    cars.length?`<div class="vm-cars">${cars.map(x=>{ const u=cover(x); return `<div class="vm-car" onclick="vmCar('${x.id}')"><div class="ph" style="${u?`background-image:url('${esc(tImg(u,480))}')`:''}"></div><div class="b"><div style="font-weight:600">${esc(carName(x))}</div><div class="muted" style="margin-top:3px">${usd(x.precio_usd)} · ${(x.listing_photos||[]).length} fotos</div><div style="margin-top:6px">${stPill(x)}</div></div></div>`; }).join('')}</div>`:empty('Sin carros todavía','Cuando el concesionario publique, aparecen aquí'))}`;
}

window.vmImg=async(id,col)=>{
  const f=(await vmPickMany('image/*'))[0]; if(!f) return;
  toast('subiendo…');
  try{ const url=await vmUp(f,'dealer_'+col.replace(/_url$/,''),col==='logo_url'?600:2000);
    await vmApi({action:'dealer',id,patch:{[col]:url}});
    toast(col==='logo_url'?'logo actualizado':'banner actualizado'); vmOpen(id,VIEW_TOKEN);
  }catch(e){ toast('error: '+e.message,true); }
};
window.vmSave=async(id,btn)=>{
  const root=btn.closest('.card'); const patch=readForm(root,C_FIELDS);
  patch.tipo=root.querySelector('[data-f="tipo"]').value; patch.activo=$('#vm-act').checked;
  if(patch.instagram) patch.instagram=patch.instagram.replace(/^@/,'');
  if(!patch.nombre){ toast('el nombre es obligatorio',true); return; }
  btn.disabled=true;
  try{ await vmApi({action:'dealer',id,patch}); }catch(e){ btn.disabled=false; toast('error: '+e.message,true); return; }
  btn.disabled=false; toast('vitrina guardada'); vmOpen(id,VIEW_TOKEN);
};

/* ── un carro: fotos + datos ── */
window.vmCar=async(lid)=>{
  const ov=modal({wide:true,title:'Publicación',body:'<div class="skel" style="height:320px"></div>'});
  const{data:x,error}=await sb.from('listings').select('*,listing_photos(id,url,orden)').eq('id',lid).maybeSingle();
  if(!ov.isConnected) return; if(error||!x){ ov.querySelector('.modal-b').innerHTML=empty('No encontrada',error&&error.message); return; }
  ov._x=x; ov.querySelector('.modal-h h3').textContent=carName(x);
  ov.querySelector('.modal-b').innerHTML=`<div class="section-t" style="margin-top:0">Fotos <span class="muted" style="font-weight:400">· la primera es la portada</span></div><div class="vm-ph" id="vm-ph"></div>
    <div class="section-t" style="margin-top:18px">Datos</div>${formHtml(LISTING_FIELDS,x)}
    <div style="margin-top:8px">${[['es_destacado','Destacada','Aparece primero en el market'],['vendido','Vendida','La marca como vendida'],['auditado_ruedda','Auditada por Ruedda','Muestra el sello de auditoría']].map(([k,t,d])=>`<div class="switch"><div><div style="font-weight:600">${t}</div><div class="muted" style="font-size:12px">${d}</div></div><input type="checkbox" data-b="${k}" ${x[k]?'checked':''}></div>`).join('')}</div>`;
  ov.querySelector('.modal').insertAdjacentHTML('beforeend',`<div class="modal-f"><a class="btn btn-soft" style="margin-right:auto" href="https://www.ruedda.app/?market=${x.id}" target="_blank" rel="noopener">Ver en Ruedda</a><button class="btn btn-primary" onclick="vmCarSave('${x.id}',this)">Guardar datos</button></div>`);
  vmPhPaint(x);
};
function vmPhs(x){ return (x.listing_photos||[]).slice().sort((a,b)=>a.orden-b.orden); }
function vmPhPaint(x){
  const W=$('#vm-ph'); if(!W) return; const P=vmPhs(x);
  W.innerHTML=P.map((p,i)=>`<div class="it" style="background-image:url('${esc(tImg(p.url,400))}')">${i===0?'<span class="pill b tg">portada</span>':''}
    <div class="ac"><button title="mover a la izquierda" ${i===0?'disabled':''} onclick="vmMove('${x.id}',${i},-1)">←</button><button title="poner de portada" ${i===0?'disabled':''} onclick="vmMove('${x.id}',${i},'top')">★</button><button title="mover a la derecha" ${i===P.length-1?'disabled':''} onclick="vmMove('${x.id}',${i},1)">→</button><button title="ver" onclick="lightbox('${esc(tImg(p.url,1600))}')">ver</button><button title="cambiar esta foto" onclick="vmRepl('${x.id}','${p.id}')">cambiar</button><button class="r" title="borrar" onclick="vmDel('${x.id}','${p.id}')">✕</button></div></div>`).join('')
    +`<div class="add" onclick="vmAdd('${x.id}')">+ agregar fotos</div>`;
}
async function vmReload(lid){
  const{data}=await sb.from('listing_photos').select('id,url,orden').eq('listing_id',lid);
  const ov=$('#ov'); if(!ov||!ov._x||ov._x.id!==lid) return; ov._x.listing_photos=data||[]; vmPhPaint(ov._x);
}
window.vmAdd=async lid=>{
  const fs=await vmPickMany('image/*'); if(!fs.length) return;
  toast(`subiendo ${fs.length} foto${fs.length>1?'s':''}…`);
  try{ const urls=[]; for(const f of fs) urls.push(await vmUp(f,'listing_admin'));
    await vmApi({action:'add',listing_id:lid,urls}); toast('fotos agregadas'); vmReload(lid);
  }catch(e){ toast('error: '+e.message,true); }
};
window.vmRepl=async(lid,pid)=>{
  const f=(await vmPickMany('image/*'))[0]; if(!f) return; toast('subiendo…');
  try{ const url=await vmUp(f,'listing_admin'); await vmApi({action:'replace',photo_id:pid,url}); toast('foto cambiada'); vmReload(lid); }
  catch(e){ toast('error: '+e.message,true); }
};
window.vmDel=async(lid,pid)=>{
  if(!confirm('¿Borrar esta foto de la publicación?')) return;
  try{ await vmApi({action:'delete',photo_id:pid}); toast('foto borrada'); vmReload(lid); }catch(e){ toast('error: '+e.message,true); }
};
window.vmMove=async(lid,i,d)=>{
  const ov=$('#ov'); if(!ov||!ov._x) return; const ids=vmPhs(ov._x).map(p=>p.id);
  const [m]=ids.splice(i,1); if(d==='top') ids.unshift(m); else ids.splice(Math.max(0,Math.min(ids.length,i+d)),0,m);
  try{ await vmApi({action:'order',listing_id:lid,ids}); vmReload(lid); }catch(e){ toast('error: '+e.message,true); }
};
window.vmCarSave=async(lid,btn)=>{
  const root=$('#ov .modal'); const patch=readForm(root,LISTING_FIELDS);
  root.querySelectorAll('[data-b]').forEach(el=>patch[el.dataset.b]=el.checked);
  const prev=($('#ov')||{})._x||{}; if(patch.vendido&&!prev.vendido) patch.vendido_at=new Date().toISOString();
  if(!patch.marca||!patch.modelo){ toast('marca y modelo son obligatorios',true); return; }
  btn.disabled=true; patch.updated_at=new Date().toISOString();
  const{error}=await sb.from('listings').update(patch).eq('id',lid); btn.disabled=false;
  if(error){ toast('error: '+error.message,true); return; }
  toast('publicación actualizada'); closeModal(); if(CUR==='vitrinas'&&VM.sel) vmOpen(VM.sel,VIEW_TOKEN);
};
})();
