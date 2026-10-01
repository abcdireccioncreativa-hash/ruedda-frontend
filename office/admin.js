'use strict';
/* ════════════════════════════════════════════════════════════════
   RUEDDA OFFICE — panel de administración (miembros con is_admin
   o superadmins de Ruedda). Todo lo vuelve a validar el servidor.
   ════════════════════════════════════════════════════════════════ */
(function(){
const RO = window.RO, A = RO.Art, UI = RO.UI, esc = RO.esc;
const Admin = RO.Admin = {};
let TAB = 'equipo';

Admin.open = tab => {
  if (!RO.isAdmin()) return;
  TAB = tab || TAB;
  const mo = UI.modal({
    title: 'Administrar oficina', sub: 'Todo es editable. Los cambios llegan en vivo a todos.', wide: true,
    body: `<div class="tabs" style="margin:-18px -20px 18px">${[['equipo', 'Equipo'], ['oficinas', 'Oficinas'], ['tienda', 'Tienda'], ['mundo', 'Mundo'], ['deco', 'Decoración']].map(([k, t]) => `<button data-tab="${k}" class="${TAB === k ? 'on' : ''}">${t}</button>`).join('')}</div><div id="adm"></div>`
  });
  mo.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { TAB = b.dataset.tab; mo.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('on', x === b)); render(); });
  const render = () => { const box = mo.querySelector('#adm'); if (box) Admin[TAB](box); };
  render();
};
const officeOpts = (sel) => `<option value="">— sin oficina —</option>` + (RO.S.config.offices || []).slice().sort((a, b) => a.pos - b.pos).map(o => `<option value="${esc(o.slot)}" ${o.slot === sel ? 'selected' : ''}>${esc(o.name || o.slot)} (${esc(o.slot)})</option>`).join('');

/* ── EQUIPO ── */
Admin.equipo = box => {
  const ms = RO.S.members.slice().sort((a, b) => (a.display_name || '').localeCompare(b.display_name || ''));
  box.innerHTML = `
    <table class="tbl"><thead><tr><th></th><th>Nombre</th><th>Cargo en la empresa</th><th>Oficina</th><th>Admin</th><th>Monedas</th><th></th></tr></thead><tbody>
    ${ms.map(m => `<tr data-u="${esc(m.user_id)}"><td data-h></td>
      <td><input class="in" data-f="name" value="${esc(m.display_name)}" maxlength="40"></td>
      <td><input class="in" data-f="cargo" value="${esc(m.cargo)}" maxlength="60" placeholder="obligatorio"></td>
      <td><select class="sel" data-f="slot">${officeOpts(m.slot)}</select></td>
      <td><input type="checkbox" data-f="admin" ${m.is_admin ? 'checked' : ''}></td>
      <td><div class="row" style="gap:4px;flex-wrap:nowrap"><span class="mono" style="min-width:34px">${m.coins || 0}</span><button class="btn sm" data-g="50">+50</button><button class="btn sm" data-g="-50">−50</button></div></td>
      <td><div class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn sm" data-a="av">Avatar</button><button class="btn sm y" data-a="save">Guardar</button>${m.user_id !== RO.S.me.user_id ? '<button class="btn sm red" data-a="del">Quitar</button>' : ''}</div></td></tr>`).join('')}
    </tbody></table>
    <label class="lbl" style="margin-top:22px">agregar persona (cuenta de Ruedda)</label>
    <div class="row"><input class="in" id="ad-q" placeholder="Busca por @usuario, nombre o correo…"></div>
    <div id="ad-res" style="margin-top:8px"></div>`;
  box.querySelectorAll('tr[data-u]').forEach(tr => {
    const uid = tr.dataset.u, m = RO.member(uid);
    tr.querySelector('[data-h]').appendChild(UI.headCanvas(m, 2));
    const val = f => tr.querySelector(`[data-f="${f}"]`);
    tr.querySelector('[data-a="save"]').onclick = async () => {
      const cargo = val('cargo').value.trim(); if (!cargo) { val('cargo').focus(); return UI.toast('El cargo es obligatorio: sin rol en la empresa no hay acceso', 'err'); }
      try { await RO.Net.upsertMember(uid, val('slot').value, val('name').value.trim(), cargo, val('admin').checked); UI.toast('Guardado'); localApply(uid, { slot: val('slot').value || null, display_name: val('name').value.trim(), cargo, is_admin: val('admin').checked }); Admin.equipo(box); }
      catch (e) { UI.err(e); }
    };
    tr.querySelector('[data-a="av"]').onclick = () => UI.avatarEditor(uid);
    const del = tr.querySelector('[data-a="del"]');
    if (del) del.onclick = async () => {
      const ok = await UI.confirm('Quitar a ' + esc(m.display_name), 'Pierde el acceso a la oficina. Su cuenta de Ruedda no se toca.', 'Quitar', true);
      if (!ok) return Admin.open('equipo');
      try { await RO.Net.removeMember(uid); RO.S.members = RO.S.members.filter(x => x.user_id !== uid); Admin.open('equipo'); } catch (e) { UI.err(e); }
    };
    tr.querySelectorAll('[data-g]').forEach(b => b.onclick = async () => {
      try { await RO.Net.grant(uid, +b.dataset.g); m.coins = Math.max(0, (m.coins || 0) + +b.dataset.g); Admin.equipo(box); } catch (e) { UI.err(e); }
    });
  });
  const q = box.querySelector('#ad-q'), res = box.querySelector('#ad-res'); let t = 0;
  q.oninput = () => { clearTimeout(t); t = setTimeout(async () => {
    const v = q.value.trim(); if (v.length < 2) { res.innerHTML = ''; return; }
    try {
      const rows = await RO.Net.findUsers(v) || [];
      res.innerHTML = rows.length ? `<table class="tbl"><tbody>${rows.map(u => `<tr><td><b>${esc(u.nombre || '—')}</b> <span class="muted">@${esc(u.username || '—')}</span></td><td class="muted">${esc(u.email || '')}</td><td>${RO.member(u.id) ? '<span class="muted">ya es miembro</span>' : `<button class="btn sm y" data-add="${esc(u.id)}" data-n="${esc(u.nombre || u.username || '')}">Agregar</button>`}</td></tr>`).join('')}</tbody></table>` : '<div class="muted">Sin resultados.</div>';
      res.querySelectorAll('[data-add]').forEach(b => b.onclick = () => addForm(res, b.dataset.add, b.dataset.n));
    } catch (e) { UI.err(e); }
  }, 300); };
};
function addForm(res, uid, name) {
  res.innerHTML = `<div class="glass" style="padding:14px;margin-top:6px"><div class="row"><div><label class="lbl">nombre</label><input class="in" id="nf-n" value="${esc(name)}"></div><div><label class="lbl">cargo en la empresa</label><input class="in" id="nf-c" placeholder="Ej: Director comercial"></div><div><label class="lbl">oficina</label><select class="sel" id="nf-s">${officeOpts('')}</select></div></div>
    <div class="row" style="margin-top:12px;justify-content:space-between"><label style="flex:none;display:flex;gap:8px;align-items:center"><input type="checkbox" id="nf-a"> Admin de la oficina</label><button class="btn y" id="nf-go" style="flex:none">Dar acceso</button></div></div>`;
  res.querySelector('#nf-go').onclick = async () => {
    const cargo = res.querySelector('#nf-c').value.trim(); if (!cargo) return UI.toast('El cargo es obligatorio', 'err');
    try {
      await RO.Net.upsertMember(uid, res.querySelector('#nf-s').value, res.querySelector('#nf-n').value.trim() || name, cargo, res.querySelector('#nf-a').checked);
      if (!RO.member(uid)) RO.S.members.push({ user_id: uid, display_name: res.querySelector('#nf-n').value.trim() || name, cargo, slot: res.querySelector('#nf-s').value || null, is_admin: res.querySelector('#nf-a').checked, avatar: {}, points: 0, coins: 100 });
      UI.toast('Acceso otorgado'); Admin.open('equipo');
    } catch (e) { UI.err(e); }
  };
}
function localApply(uid, patch) {
  const slot = patch.slot;
  if (slot) RO.S.members.forEach(m => { if (m.slot === slot && m.user_id !== uid) m.slot = null; });
  const m = RO.member(uid); if (m) Object.assign(m, patch);
  if (uid === RO.S.me.user_id) Object.assign(RO.S.me, patch);
  RO.G.rebuild(); UI.renderPeople(); UI.renderTop();
}

/* ── OFICINAS (distribución) ── */
Admin.oficinas = box => {
  const offs = JSON.parse(JSON.stringify(RO.S.config.offices || [])).sort((a, b) => a.pos - b.pos);
  const POS = ['Posición 1 (izquierda)', 'Posición 2', 'Posición 3', 'Posición 4 (derecha)'];
  const themes = Object.entries(RO.THEMES);
  box.innerHTML = `<p class="muted" style="margin-bottom:12px;line-height:1.5;font-size:12.5px">Cambia el lugar de cada oficina (se intercambian), su nombre, su piso y a qué @usuario se enlaza automáticamente al entrar. La persona asignada se elige en <b>Equipo</b>.</p>
    <table class="tbl"><thead><tr><th>Lugar</th><th>Id</th><th>Nombre</th><th>@usuario (auto)</th><th>Cargo por defecto</th><th>Piso</th><th>Ocupa</th><th></th></tr></thead><tbody>
    ${offs.map((o, i) => { const m = RO.memberBySlot(o.slot); return `<tr data-i="${i}">
      <td><select class="sel" data-f="pos">${POS.map((p, k) => `<option value="${k}" ${o.pos === k ? 'selected' : ''}>${p}</option>`).join('')}</select></td>
      <td class="mono">${esc(o.slot)}</td>
      <td><input class="in" data-f="name" value="${esc(o.name || '')}" maxlength="30"></td>
      <td><input class="in" data-f="username" value="${esc(o.username || '')}" placeholder="${o.owner_superadmin ? 'superadmin' : '@usuario'}" maxlength="40"></td>
      <td><input class="in" data-f="cargo" value="${esc(o.cargo || '')}" maxlength="60"></td>
      <td><select class="sel" data-f="theme">${themes.map(([k, t]) => `<option value="${k}" ${o.theme === k ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></td>
      <td>${m ? esc(m.display_name) : '<span class="muted">libre</span>'}</td>
      <td><button class="btn sm" data-go="${o.pos}">Ir</button></td></tr>`; }).join('')}
    </tbody></table>
    <div class="row" style="margin-top:16px;justify-content:flex-end"><button class="btn y" id="of-save" style="flex:none">Guardar distribución</button></div>`;
  box.querySelectorAll('tr[data-i]').forEach(tr => {
    const o = offs[+tr.dataset.i];
    tr.querySelectorAll('[data-f]').forEach(inp => inp.onchange = () => {
      const f = inp.dataset.f;
      if (f === 'pos') { const np = +inp.value, other = offs.find(z => z.pos === np && z !== o); if (other) other.pos = o.pos; o.pos = np; }
      else o[f] = f === 'username' ? inp.value.trim().replace(/^@+/, '').toLowerCase() : inp.value.trim();
      if (f === 'pos') { RO.S.config.offices = offs; Admin.oficinas(box); }
    });
  });
  box.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { UI.close(); RO.G.goToOffice(+b.dataset.go); });
  box.querySelector('#of-save').onclick = () => saveConfig(Object.assign({}, RO.S.config, { offices: offs }), 'Distribución guardada');
};

/* ── TIENDA ── */
Admin.tienda = box => {
  const cat = RO.S.catalog.slice().sort((a, b) => a.sort - b.sort);
  box.innerHTML = `<table class="tbl"><thead><tr><th></th><th>Artículo</th><th>Nombre</th><th>Precio</th><th>Categoría</th><th>Activo</th></tr></thead><tbody>
    ${cat.map(c => `<tr data-it="${esc(c.item)}"><td data-cv></td><td class="mono">${esc(c.item)}</td><td><input class="in" data-f="name" value="${esc(c.name)}"></td><td><input class="in" type="number" min="0" step="5" data-f="price" value="${c.price}" style="width:90px"></td><td><input class="in" data-f="category" value="${esc(c.category)}" style="width:110px"></td><td><input type="checkbox" data-f="active" ${c.active ? 'checked' : ''}></td></tr>`).join('')}
    </tbody></table><div class="row" style="margin-top:16px;justify-content:flex-end"><button class="btn y" id="ti-save" style="flex:none">Guardar precios</button></div>`;
  box.querySelectorAll('tr[data-it]').forEach(tr => { const cv = A.drawItem(tr.dataset.it); if (cv) { cv.style.cssText = 'height:24px;width:auto;image-rendering:pixelated'; tr.querySelector('[data-cv]').appendChild(cv); } });
  box.querySelector('#ti-save').onclick = async () => {
    try {
      for (const tr of box.querySelectorAll('tr[data-it]')) {
        const c = cat.find(x => x.item === tr.dataset.it), g = f => tr.querySelector(`[data-f="${f}"]`);
        const row = { item: c.item, name: g('name').value.trim() || c.name, price: Math.max(0, Math.round(+g('price').value || 0)), category: g('category').value.trim() || c.category, active: g('active').checked, sort: c.sort };
        if (row.name !== c.name || row.price !== c.price || row.category !== c.category || row.active !== c.active) { await RO.Net.saveCatalog(row); Object.assign(c, row); }
      }
      UI.toast('Tienda actualizada');
    } catch (e) { UI.err(e); }
  };
};

/* ── MUNDO ── */
Admin.mundo = box => {
  const c = RO.S.config;
  const rooms = Object.entries(c.rooms || {});
  box.innerHTML = `
    <div class="row" style="align-items:flex-start;gap:18px">
      <div>
        <label class="lbl">relojes de hotel (etiqueta | zona horaria, máx. 4)</label>
        <textarea class="ta" id="mw-clocks" style="min-height:96px">${esc((c.clocks || []).map(k => k.label + ' | ' + k.tz).join('\n'))}</textarea>
        <div class="muted" style="font-size:11.5px;margin-top:4px">Zonas IANA: America/Caracas, America/Bogota, America/Toronto, America/New_York, Europe/Madrid…</div>
        <label class="lbl">nombres de las salas</label>
        ${rooms.map(([k, v]) => `<div class="row" style="margin-bottom:6px"><span class="mono muted" style="flex:0 0 80px">${esc(k)}</span><input class="in" data-room="${esc(k)}" value="${esc(v)}"></div>`).join('')}
        <label class="lbl">mensaje de bienvenida</label>
        <input class="in" id="mw-motd" value="${esc(c.motd || '')}">
        <div class="row" style="margin-top:6px"><div><label class="lbl">acelerar: enfriamiento (min)</label><input class="in" type="number" min="1" id="mw-cd" value="${c.boost_cooldown_min || 10}"></div><div><label class="lbl">puntos por persona</label><input class="in" type="number" min="0" id="mw-bp" value="${c.boost_points || 15}"></div></div>
      </div>
      <div>
        <label class="lbl">asistente del garage</label>
        <input class="in" id="mw-npc" value="${esc(c.npc.name || '')}" placeholder="Valentina">
        <label class="lbl">sus frases (una por línea)</label>
        <textarea class="ta" id="mw-ph" style="min-height:190px">${esc((c.npc.phrases || []).join('\n'))}</textarea>
        <label class="lbl">autos del garage (nombre | #color | super·gt·luxe·suv, máx. 8)</label>
        <textarea class="ta" id="mw-cars" style="min-height:120px">${esc((c.cars || []).map(k => k.name + ' | ' + k.color + ' | ' + k.type).join('\n'))}</textarea>
        <label style="display:flex;gap:8px;align-items:center;margin-top:12px"><input type="checkbox" id="mw-vip" ${c.vip_enabled !== false ? 'checked' : ''}> Pasadizo secreto al garage habilitado</label>
      </div>
    </div>
    <div class="row" style="margin-top:16px;justify-content:flex-end"><button class="btn y" id="mw-save" style="flex:none">Guardar mundo</button></div>`;
  box.querySelector('#mw-save').onclick = () => {
    const clocks = [], bad = [];
    box.querySelector('#mw-clocks').value.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 4).forEach(l => {
      const [label, tz] = l.split('|').map(s => (s || '').trim());
      try { new Intl.DateTimeFormat('en', { timeZone: tz }); clocks.push({ label: label || tz, tz }); } catch (e) { bad.push(tz || l); }
    });
    if (bad.length) return UI.toast('Zona horaria inválida: ' + esc(bad.join(', ')), 'err');
    const cars = box.querySelector('#mw-cars').value.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 8).map(l => {
      const [name, color, type] = l.split('|').map(s => (s || '').trim());
      return { name: name || 'Auto', color: /^#[0-9a-f]{6}$/i.test(color || '') ? color : '#e6f03b', type: ['super', 'gt', 'luxe', 'suv'].includes(type) ? type : 'super' };
    });
    const roomsOut = {}; box.querySelectorAll('[data-room]').forEach(i => roomsOut[i.dataset.room] = i.value.trim() || i.dataset.room);
    const next = Object.assign({}, c, {
      clocks: clocks.length ? clocks : c.clocks, cars: cars.length ? cars : c.cars, rooms: roomsOut,
      npc: { name: box.querySelector('#mw-npc').value.trim() || 'Valentina', phrases: box.querySelector('#mw-ph').value.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 80) },
      motd: box.querySelector('#mw-motd').value.trim(),
      boost_cooldown_min: Math.max(1, +box.querySelector('#mw-cd').value || 10),
      boost_points: Math.max(0, Math.min(500, +box.querySelector('#mw-bp').value || 15)),
      vip_enabled: box.querySelector('#mw-vip').checked
    });
    saveConfig(next, 'Mundo actualizado');
  };
};

/* ── DECORACIÓN (gratis para admins) ── */
Admin.deco = box => {
  const items = Object.values(A.ITEMS).filter(i => i.shop);
  box.innerHTML = `<p class="muted" style="margin-bottom:12px;font-size:12.5px">Como admin colocas sin gastar monedas. Elige un artículo y haz clic en el mapa.</p>
    <div class="shop">${items.map(i => `<button class="si" data-i="${i.key}"><span data-cv="${i.key}"></span><b>${esc(i.name)}</b></button>`).join('')}</div>
    <div class="row" style="margin-top:18px;justify-content:space-between"><button class="btn" id="dc-move" style="flex:none">Mover / quitar cualquier decoración</button><button class="btn red" id="dc-board" style="flex:none">Borrar la pizarra</button></div>`;
  box.querySelectorAll('[data-cv]').forEach(s => s.appendChild(A.drawItem(s.dataset.cv)));
  box.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { UI.close(); UI.startEdit({ mode: 'place', item: b.dataset.i, name: A.ITEMS[b.dataset.i].name }); });
  box.querySelector('#dc-move').onclick = () => { UI.close(); UI.startEdit({ mode: 'move' }); };
  box.querySelector('#dc-board').onclick = async () => {
    try { await RO.Net.clearBoard('main'); UI.WB.onClear(); RO.Net.send({ t: 'bc', u: RO.S.me.user_id }); UI.toast('Pizarra en blanco'); } catch (e) { UI.err(e); }
  };
};

async function saveConfig(next, msg) {
  try {
    await RO.Net.saveConfig(next);
    RO.S.config = RO.mergeConfig(next);
    RO.G.rebuild(); UI.renderClocks(); UI.renderPeople();
    UI.toast(msg || 'Guardado'); RO.sfx.coin();
  } catch (e) { UI.err(e); }
}
})();
