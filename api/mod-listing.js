/**
 * POST /api/mod-listing
 * Body: { item_id, item_type: 'listing'|'auction', action: 'aprobar'|'rechazar' }
 * Header: Authorization: Bearer <jwt>
 *
 * Solo superadmin. Aprueba o rechaza publicaciones
 * en la tabla correspondiente y notifica al usuario.
 *
 * GET /api/mod-listing?panel=1
 * Header: Authorization: Bearer <jwt>
 *
 * [security fix] devuelve el markup del panel SuperAdmin -- SOLO si quien
 * llama es superadmin real. Vive acá (en vez de en su propio archivo
 * api/admin-panel.js) porque el proyecto está en el plan Hobby de Vercel,
 * con tope de 12 funciones serverless por deployment -- ya estaban las 12
 * en uso y agregar una función nueva rompía el deploy (el build compilaba
 * bien; fallaba después, al desplegar). Esta rama es aislada y no toca el
 * flujo POST existente: entra y sale antes de llegar a esa lógica.
 *
 * Por qué existía como problema: ese markup vivía como HTML estático
 * dentro de index.html, oculto solo con display:none. Google lo indexaba
 * igual (confirmado: el texto aparecía en el snippet de búsqueda de
 * ruedda.app) y cualquier visitante -- con sesión o sin ella -- podía
 * verlo y ejecutar sus botones con solo escribir showView('superadmin')
 * en la consola, sin ningún guard real. Ahora ese HTML nunca existe en el
 * documento que recibe un visitante normal ni un crawler.
 */
const { supabaseAdmin, getUserFromToken, isSuperadmin } = require('../lib/supabase');
const { sendEmail, layout } = require('../lib/email');

const ADMIN_PANEL_HTML_MOBILE = `<div id="view-superadmin" class="view">
  <div class="detail-back" onclick="showView('cuenta')">
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>
    <span>cuenta</span>
  </div>

  <!-- [SA REDESIGN] header premium — solo estético, cero lógica tocada -->
  <div style="padding:2px 18px 18px">
    <div style="display:flex;align-items:center;gap:12px">
      <div style="width:44px;height:44px;border-radius:13px;background:linear-gradient(135deg,rgba(8,68,26,.16),rgba(8,68,26,.04));border:1px solid rgba(8,68,26,.22);display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <svg viewBox="0 0 24 24" fill="none" stroke="#08441A" stroke-width="1.8" style="width:21px;height:21px"><path d="M12 2 4 6v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V6l-8-4z"/><path d="M9 12l2 2 4-4.5"/></svg>
      </div>
      <div>
        <div style="display:flex;align-items:center;gap:8px">
          <h2 style="font-size:22px;font-weight:800;letter-spacing:-.4px">SuperAdmin</h2>
          <span style="background:var(--lime);color:var(--lime-ink);font-size:9.5px;font-weight:800;padding:2.5px 9px;border-radius:100px;letter-spacing:.4px">ADMIN</span>
        </div>
        <div style="font-size:11.5px;color:var(--w35);margin-top:1px">panel de control · Ruedda</div>
      </div>
    </div>
  </div>

  <!-- [SA REDESIGN] categorías — agrupan visualmente los mismos 13 tabs de siempre.
       cada sa-tab-X conserva su id y onclick original intactos; solo se envuelven en
       grupos que se muestran/ocultan por categoría. saTab() no se toca en absoluto. -->
  <div class="sa-cat-row" id="sa-cat-row">
    <button class="sa-cat-btn active" id="sa-cat-usuarios" onclick="saCategory('usuarios')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>
      <span>usuarios &amp; accesos</span>
    </button>
    <button class="sa-cat-btn" id="sa-cat-contenido" onclick="saCategory('contenido')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2 4 6v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V6l-8-4z"/></svg>
      <span>contenido &amp; moderación</span>
    </button>
    <button class="sa-cat-btn" id="sa-cat-dinero" onclick="saCategory('dinero')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 9.5c0-1.5 1.3-2 3-2s3 .8 3 2-1.3 2-3 2-3 .7-3 2 1.3 2 3 2 3-.5 3-2"/></svg>
      <span>monetización</span>
    </button>
    <button class="sa-cat-btn" id="sa-cat-soporte" onclick="saCategory('soporte')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      <span>comunidad &amp; soporte</span>
    </button>
  </div>

  <!-- TABS — agrupadas, mismos elementos de siempre -->
  <div class="sa-tabgroup" data-cat="usuarios">
    <div class="tabs sa-tabs-inner">
      <div class="tab active" id="sa-tab-cuentas" onclick="saTab('cuentas')" style="white-space:nowrap;flex-shrink:0">cuentas</div>
      <div class="tab" id="sa-tab-usuarios" onclick="saTab('usuarios')" style="white-space:nowrap;flex-shrink:0">usuarios</div>
      <div class="tab" id="sa-tab-kyc" onclick="saTab('kyc')" style="white-space:nowrap;flex-shrink:0">KYC</div>
      <div class="tab" id="sa-tab-bypass" onclick="saTab('bypass')" style="white-space:nowrap;flex-shrink:0">bypass</div>
      <div class="tab" id="sa-tab-acceso" onclick="saTab('acceso')" style="white-space:nowrap;flex-shrink:0">enviar código</div>
    </div>
  </div>
  <div class="sa-tabgroup" data-cat="contenido" style="display:none">
    <div class="tabs sa-tabs-inner">
      <div class="tab" id="sa-tab-moderacion" onclick="saTab('moderacion')" style="white-space:nowrap;flex-shrink:0">moderación</div>
      <div class="tab" id="sa-tab-publicaciones" onclick="saTab('publicaciones')" style="white-space:nowrap;flex-shrink:0">publicaciones</div>
      <div class="tab" id="sa-tab-comunidad" onclick="saTab('comunidad')" style="white-space:nowrap;flex-shrink:0">comunidad</div>
      <div class="tab" id="sa-tab-eventos" onclick="saTab('eventos')" style="white-space:nowrap;flex-shrink:0">eventos</div>
      <div class="tab" id="sa-tab-documentos" onclick="saTab('documentos')" style="white-space:nowrap;flex-shrink:0">documentos</div>
      <div class="tab" id="sa-tab-logos" onclick="saTab('logos')" style="white-space:nowrap;flex-shrink:0">logos marcas</div>
      <div class="tab" id="sa-tab-comparativa" onclick="saTab('comparativa')" style="white-space:nowrap;flex-shrink:0">comparativa precios</div>
      <div class="tab" id="sa-tab-criterio" onclick="saTab('criterio')" style="white-space:nowrap;flex-shrink:0">criterio ruedda</div>
      <div class="tab" id="sa-tab-intro" onclick="saTab('intro')" style="white-space:nowrap;flex-shrink:0">intro app</div>
    </div>
  </div>
  <div class="sa-tabgroup" data-cat="dinero" style="display:none">
    <div class="tabs sa-tabs-inner">
      <div class="tab" id="sa-tab-codigos" onclick="saTab('codigos')" style="white-space:nowrap;flex-shrink:0">códigos</div>
      <div class="tab" id="sa-tab-pagos" onclick="saTab('pagos')" style="white-space:nowrap;flex-shrink:0">pagos</div>
      <div class="tab" id="sa-tab-patrocinantes" onclick="saTab('patrocinantes')" style="white-space:nowrap;flex-shrink:0">patrocinantes</div>
      <div class="tab" id="sa-tab-aucodigos" onclick="saTab('aucodigos')" style="white-space:nowrap;flex-shrink:0">subastas activas</div>
    </div>
  </div>
  <div class="sa-tabgroup" data-cat="soporte" style="display:none">
    <div class="tabs sa-tabs-inner">
      <div class="tab" id="sa-tab-fotografos" onclick="saTab('fotografos')" style="white-space:nowrap;flex-shrink:0">fotógrafos</div>
      <div class="tab" id="sa-tab-mensajes" onclick="saTab('mensajes')" style="white-space:nowrap;flex-shrink:0">ruedda team</div>
      <div class="tab" id="sa-tab-solicitudes" onclick="saTab('solicitudes')" style="white-space:nowrap;flex-shrink:0">solicitudes</div>
    </div>
  </div>

  <!-- USUARIOS TAB -->
  <div id="sa-usuarios" style="display:none;flex-direction:column;padding:18px 18px 100px;gap:14px">
    <!-- SEARCH -->
    <div style="display:flex;align-items:center;gap:10px;background:var(--card);border:1px solid var(--border);border-radius:12px;padding:12px 15px">
      <svg fill="none" viewBox="0 0 24 24" stroke="var(--w30)" stroke-width="2" style="width:16px;height:16px;flex-shrink:0"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      <input id="sa-user-search" type="text" placeholder="buscar por nombre o correo..." oninput="renderSAUsuarios(this.value)" style="background:none;border:none;outline:none;font-family:var(--font);font-size:14px;color:var(--white);width:100%">
    </div>
    <div id="sa-user-list" style="display:flex;flex-direction:column;gap:8px"></div>
  </div>

  <!-- CUENTAS TAB -->
  <div id="sa-cuentas" style="padding:18px 18px 100px;display:flex;flex-direction:column;gap:14px">
    <div style="font-size:12px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">crear cuenta particular</div>
    <input class="form-input" id="sa-p-nombre" type="text" placeholder="nombre completo">
    <input class="form-input" id="sa-p-email" type="email" placeholder="correo electrónico">
    <input class="form-input" id="sa-p-username" type="text" placeholder="@usuario">
    <div style="display:flex;gap:0;background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden">
      <span style="padding:13px 14px;font-size:14px;font-weight:700;color:var(--w40);border-right:1px solid var(--border);flex-shrink:0">V</span>
      <input class="form-input" id="sa-p-cedula" type="number" placeholder="cédula" style="border:none;border-radius:0;flex:1">
    </div>
    <input class="form-input" id="sa-p-pass" type="password" placeholder="contraseña temporal">
    <button onclick="saCrearParticular()" style="background:var(--card);border:1px solid var(--border);border-radius:13px;padding:14px;font-family:var(--font);font-size:14px;font-weight:700;color:var(--white);cursor:pointer;transition:all .15s">crear cuenta particular</button>

    <div style="height:1px;background:var(--border);margin:8px 0"></div>

    <div style="font-size:12px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">crear cuenta concesionario</div>
    <input class="form-input" id="sa-d-nombre" type="text" placeholder="nombre del concesionario">
    <input class="form-input" id="sa-d-rep" type="text" placeholder="nombre del representante">
    <input class="form-input" id="sa-d-email" type="email" placeholder="correo electrónico">
    <input class="form-input" id="sa-d-username" type="text" placeholder="@usuario">
    <input class="form-input" id="sa-d-ubicacion" type="text" placeholder="ciudad / ubicación">
    <div style="display:flex;gap:0;background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden">
      <span style="padding:13px 14px;font-size:14px;font-weight:700;color:var(--w40);border-right:1px solid var(--border);flex-shrink:0">J</span>
      <input class="form-input" id="sa-d-cedula" type="number" placeholder="cédula / RIF" style="border:none;border-radius:0;flex:1">
    </div>
    <input class="form-input" id="sa-d-pass" type="password" placeholder="contraseña temporal">
    <button onclick="saCrearConcesionario()" style="background:var(--lime);color:var(--lime-ink);border:none;border-radius:13px;padding:14px;font-family:var(--font);font-size:14px;font-weight:800;cursor:pointer;transition:all .15s">crear cuenta concesionario</button>

    <div style="height:1px;background:var(--border);margin:8px 0"></div>

    <div style="font-size:12px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">crear SuperAdmin</div>
    <input class="form-input" id="sa-a-email" type="email" placeholder="correo SuperAdmin">
    <input class="form-input" id="sa-a-pass" type="password" placeholder="contraseña">
    <button onclick="saCrearAdmin()" style="background:rgba(8,68,26,.12);border:1px solid rgba(8,68,26,.3);border-radius:13px;padding:14px;font-family:var(--font);font-size:14px;font-weight:700;color:#08441A;cursor:pointer;transition:all .15s">crear SuperAdmin</button>
  </div>

  <!-- CÓDIGOS TAB -->
  <div id="sa-codigos" style="display:none;padding:18px 18px 100px;display:none;flex-direction:column;gap:14px">
    <input class="form-input" id="sa-code-text" type="text" placeholder="código personalizado (ej. RUEDDA2025)" style="text-transform:uppercase;letter-spacing:1px" oninput="this.value=this.value.toUpperCase()">
    <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:10px">
      <div style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.5px">tipo de código</div>
      <label style="display:flex;align-items:center;gap:10px;cursor:pointer"><input type="checkbox" id="sa-code-particular" style="accent-color:#08441A;width:16px;height:16px"><span style="font-size:14px">particular</span></label>
      <label style="display:flex;align-items:center;gap:10px;cursor:pointer"><input type="checkbox" id="sa-code-subasta" style="accent-color:#08441A;width:16px;height:16px"><span style="font-size:14px">subasta</span></label>
      <label style="display:flex;align-items:center;gap:10px;cursor:pointer"><input type="checkbox" id="sa-code-consesionario" style="accent-color:#08441A;width:16px;height:16px"><span style="font-size:14px">concesionario (activa vitrina)</span></label>
    </div>
    <div style="display:flex;gap:10px">
      <div style="flex:1"><div style="font-size:11px;color:var(--muted);margin-bottom:6px;font-weight:600">usos máximos</div><input class="form-input" id="sa-code-usos" type="number" placeholder="1" min="1" style="width:100%"></div>
      <div style="flex:1"><div style="font-size:11px;color:var(--muted);margin-bottom:6px;font-weight:600">caduca (días)</div><input class="form-input" id="sa-code-dias" type="number" placeholder="30" min="1" style="width:100%"></div>
    </div>
    <button onclick="saGenerarCodigo()" style="background:var(--lime);color:var(--lime-ink);border:none;border-radius:13px;padding:14px;font-family:var(--font);font-size:14px;font-weight:800;cursor:pointer">generar código</button>
    <div id="sa-codes-list" style="display:flex;flex-direction:column;gap:8px;margin-top:4px"></div>
  </div>

  <!-- MODERACIÓN TAB -->
  <div id="sa-moderacion" style="display:none;padding:18px 18px 100px;flex-direction:column;gap:0">
    <div class="tabs" style="padding:0 0 0;margin-bottom:14px">
      <div class="tab active" id="mod-tab-particular" onclick="modTab('particular')">particular</div>
      <div class="tab" id="mod-tab-subasta" onclick="modTab('subasta')">subasta</div>
      <div class="tab" id="mod-tab-consesionario" onclick="modTab('consesionario')">concesionario</div>
    </div>
    <div id="mod-queue" style="display:flex;flex-direction:column;gap:10px"></div>
  </div>

  <!-- FOTOGRAFOS TAB -->
  <div id="sa-fotografos" style="display:none;padding:18px 18px 100px;flex-direction:column;gap:14px">
    <div style="font-size:12px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">publicar fotógrafo</div>
    <input class="form-input" id="sa-f-nombre" type="text" placeholder="nombre completo">
    <input class="form-input" id="sa-f-ciudad" type="text" placeholder="ciudad">
    <input class="form-input" id="sa-f-telefono" type="tel" placeholder="teléfono">
    <input class="form-input" id="sa-f-especialidad" type="text" placeholder="especialidad (ej. autos deportivos)">
    <div style="font-size:11px;color:var(--muted);margin-bottom:2px;font-weight:600">catálogo (links)</div>
    <div id="sa-f-catalogo-list" style="display:flex;flex-direction:column;gap:8px"></div>
    <button onclick="saAddCatalogoLink()" style="background:transparent;border:1px dashed var(--w15);border-radius:12px;padding:12px;font-family:var(--font);font-size:13px;color:var(--w40);cursor:pointer;transition:all .15s;display:flex;align-items:center;justify-content:center;gap:6px" onmouseover="this.style.borderColor='var(--w35)'" onmouseout="this.style.borderColor='var(--w15)'">
      <svg fill="none" viewBox="0 0 20 20" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><line x1="10" y1="4" x2="10" y2="16"/><line x1="4" y1="10" x2="16" y2="10"/></svg>
      agregar link de catálogo
    </button>
    <button onclick="saPublicarFotografo()" style="background:var(--lime);color:var(--lime-ink);border:none;border-radius:13px;padding:14px;font-family:var(--font);font-size:14px;font-weight:800;cursor:pointer;transition:all .15s;margin-top:4px" onmousedown="this.style.transform='scale(.98)'" onmouseup="this.style.transform='scale(1)'">publicar fotógrafo</button>
    <div style="height:1px;background:var(--border);margin:4px 0"></div>
    <div style="font-size:12px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">fotógrafos activos</div>
    <div id="sa-f-list" style="display:flex;flex-direction:column;gap:8px"></div>
  </div>

  <!-- PAGOS TAB -->
  <div id="sa-pagos" style="display:none;flex-direction:column;padding:18px 18px 100px;gap:14px">
    <div style="font-size:12px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.5px">datos de pago móvil</div>

    <!-- BANK LOGO UPLOAD -->
    <div style="display:flex;align-items:center;gap:14px">
      <div id="sa-bank-logo-preview" onclick="document.getElementById('sa-bank-logo-file').click()" style="width:56px;height:56px;border-radius:14px;background:var(--card);border:1px dashed var(--w15);display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;flex-shrink:0;transition:border-color .15s" onmouseover="this.style.borderColor='var(--w35)'" onmouseout="this.style.borderColor='var(--w15)'">
        <svg fill="none" viewBox="0 0 24 24" stroke="var(--w25)" stroke-width="1.5" style="width:20px;height:20px"><path d="M3 9a2 2 0 0 1 2-2h.93a2 2 0 0 0 1.664-.89l.812-1.22A2 2 0 0 1 10.07 4h3.86a2 2 0 0 1 1.664.89l.812 1.22A2 2 0 0 0 18.07 7H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z"/><circle cx="12" cy="13" r="3"/></svg>
      </div>
      <input id="sa-bank-logo-file" type="file" accept="image/*" style="display:none" onchange="saBankLogoUpload(this)">
      <div style="flex:1">
        <div style="font-size:13px;font-weight:600;margin-bottom:2px">logo del banco</div>
        <div style="font-size:12px;color:var(--muted)">se muestra en el checkout</div>
      </div>
    </div>

    <input class="form-input" id="sa-pay-banco" type="text" placeholder="nombre del banco" style="width:100%">
    <input class="form-input" id="sa-pay-telefono" type="tel" placeholder="teléfono de pago móvil" style="width:100%">
    <input class="form-input" id="sa-pay-cedula" type="text" placeholder="cédula / RIF del titular" style="width:100%">
    <input class="form-input" id="sa-pay-cuenta" type="text" placeholder="número de cuenta (opcional)" style="width:100%">

    <button onclick="savePaymentData()" style="background:var(--lime);color:var(--lime-ink);border:none;border-radius:13px;padding:14px;font-family:var(--font);font-size:14px;font-weight:800;cursor:pointer;transition:all .15s;margin-top:4px" onmousedown="this.style.transform='scale(.98)'" onmouseup="this.style.transform='scale(1)'">guardar datos de pago</button>

    <div style="height:1px;background:var(--border);margin:4px 0"></div>

    <!-- [V135] banner 16:9 arriba del selector de plan — simple contenedor
         de foto (ej. "código gratis del día"). Vacío = no se muestra. -->
    <div style="font-size:12px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.5px">banner del selector de plan</div>
    <input type="file" id="sa-pricing-banner-file" accept="image/*" style="display:none" onchange="_saUploadPricingBanner(this)">
    <div id="sa-pricing-banner-preview" onclick="document.getElementById('sa-pricing-banner-file').click()" style="width:100%;aspect-ratio:16/9;background:var(--card);border:1.5px dashed var(--border);border-radius:14px;display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden">
      <span style="font-size:13px;color:var(--muted)">toca para subir (ej. "código gratis del día")</span>
    </div>
    <button onclick="_saRemovePricingBanner()" style="background:rgba(255,60,60,.08);border:1px solid rgba(255,80,80,.2);border-radius:12px;padding:11px;font-family:var(--font);font-size:12.5px;font-weight:700;color:rgba(255,100,100,.85);cursor:pointer">quitar banner</button>

    <div style="height:1px;background:var(--border);margin:4px 0"></div>

    <!-- PENDING PAYMENTS -->
    <div style="font-size:12px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.5px">referencias pendientes de confirmación</div>
    <div id="sa-pending-refs" style="display:flex;flex-direction:column;gap:8px"></div>
  </div>

  <!-- BYPASS TAB -->
  <div id="sa-acceso" style="display:none;padding:18px 18px 100px;flex-direction:column;gap:12px">
    <div style="font-size:13px;color:var(--muted);font-weight:300">comprobantes de hold de compradores · revisa y envía el código de acceso de la subasta.</div>
    <div id="sa-access-list" style="display:flex;flex-direction:column;gap:14px"></div>
  </div>
  <div id="sa-aucodigos" style="display:none;padding:18px 18px 100px;flex-direction:column;gap:12px">
    <div style="font-size:13px;color:var(--muted);font-weight:300">cada subasta tiene su código de acceso. cópialo para entregarlo, o regenéralo.</div>
    <div id="sa-aucodes-list" style="display:flex;flex-direction:column;gap:10px"></div>
  </div>
  <div id="sa-kyc" style="display:none;padding:18px 18px 100px;flex-direction:column;gap:12px">
    <div style="font-size:13px;color:var(--muted);font-weight:300">solicitudes de verificación pendientes · compara el nombre registrado con la cédula de las fotos.</div>
    <div id="sa-kyc-list" style="display:flex;flex-direction:column;gap:14px"></div>
  </div>
  <div id="sa-bypass" style="display:none;padding:18px 18px 100px;display:none;flex-direction:column;gap:12px">
    <p style="font-size:13px;color:var(--muted);margin-bottom:8px">acceso directo para testing sin pasar por pagos.</p>
    <button onclick="bypassPublicacion()" style="background:var(--card);border:1px solid var(--border);border-radius:13px;padding:15px;font-family:var(--font);font-size:14px;font-weight:700;color:var(--white);cursor:pointer;transition:all .15s;text-align:left;display:flex;align-items:center;justify-content:space-between">
      crear publicación (market)<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M7 17L17 7M7 7h10v10"/></svg>
    </button>
    <button onclick="bypassSubasta()" style="background:var(--card);border:1px solid var(--border);border-radius:13px;padding:15px;font-family:var(--font);font-size:14px;font-weight:700;color:var(--white);cursor:pointer;transition:all .15s;text-align:left;display:flex;align-items:center;justify-content:space-between">
      crear subasta directa<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M7 17L17 7M7 7h10v10"/></svg>
    </button>
    <div style="height:1px;background:var(--border);margin:4px 0"></div>
    <p style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.5px">simular roles</p>
    <button onclick="simularRol('consesionario',true)" style="background:rgba(8,68,26,.08);border:1px solid rgba(8,68,26,.2);border-radius:13px;padding:14px 15px;font-family:var(--font);font-size:14px;font-weight:700;color:#08441A;cursor:pointer;text-align:left;display:flex;align-items:center;justify-content:space-between">
      concesionario — vitrina activa<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M7 17L17 7M7 7h10v10"/></svg>
    </button>
    <button onclick="simularRol('consesionario',false)" style="background:var(--w4);border:1px solid var(--w10);border-radius:13px;padding:14px 15px;font-family:var(--font);font-size:14px;font-weight:700;color:var(--w60);cursor:pointer;text-align:left;display:flex;align-items:center;justify-content:space-between">
      concesionario — vitrina inactiva<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M7 17L17 7M7 7h10v10"/></svg>
    </button>
    <button onclick="simularRol('particular',false)" style="background:var(--w4);border:1px solid var(--w10);border-radius:13px;padding:14px 15px;font-family:var(--font);font-size:14px;font-weight:700;color:var(--w60);cursor:pointer;text-align:left;display:flex;align-items:center;justify-content:space-between">
      particular<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M7 17L17 7M7 7h10v10"/></svg>
    </button>

    <!-- ═══ DIAGNÓSTICO DB ═══ -->
    <div style="height:1px;background:var(--border);margin:8px 0"></div>
    <p style="font-size:11px;color:rgba(255,170,0,.8);font-weight:700;text-transform:uppercase;letter-spacing:.5px">🔧 diagnóstico DB</p>
    <button onclick="dbDiagnostico()" style="background:rgba(255,170,0,.08);border:1px solid rgba(255,170,0,.25);border-radius:13px;padding:14px 15px;font-family:var(--font);font-size:13px;font-weight:700;color:#ffaa00;cursor:pointer;text-align:left">
      ver estado real del DB
    </button>
    <button onclick="dbTestInsert()" style="background:rgba(255,170,0,.05);border:1px solid rgba(255,170,0,.15);border-radius:13px;padding:14px 15px;font-family:var(--font);font-size:13px;font-weight:700;color:rgba(255,170,0,.7);cursor:pointer;text-align:left">
      test: insertar publicación de prueba
    </button>
    <div id="sa-diag-output" style="background:rgba(0,0,0,.4);border:1px solid var(--w8);border-radius:13px;padding:14px;font-family:monospace;font-size:11px;color:var(--w70);white-space:pre-wrap;word-break:break-all;display:none;max-height:300px;overflow-y:auto;line-height:1.5"></div>
  </div>
  <!-- COMUNIDAD TAB -->
  <div id="sa-comunidad" style="display:none;flex-direction:column;padding:18px 18px 100px;gap:28px">

    <!-- CLIPS -->
    <div>
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--muted);margin-bottom:14px">Ruedda Clips</div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px">
        <input class="form-input" id="sa-clip-url" type="url" placeholder="link del reel (Instagram o YouTube)">
        <div style="display:flex;gap:8px">
          <input class="form-input" id="sa-clip-thumb" type="url" placeholder="portada (sube una imagen →)" style="flex:1" readonly>
          <button onclick="document.getElementById('sa-clip-thumb-file').click()" style="flex-shrink:0;background:var(--card);color:var(--white);border:1px solid var(--border);border-radius:12px;font-size:12px;font-weight:700;padding:0 14px;cursor:pointer;font-family:var(--font);white-space:nowrap" id="sa-fetch-thumb-btn">subir portada</button>
          <input type="file" id="sa-clip-thumb-file" accept="image/*" style="display:none" onchange="saUploadClipThumb(this)">
        </div>
        <button onclick="saAddClip()" style="background:var(--lime);color:var(--lime-ink);border:none;border-radius:12px;font-size:13px;font-weight:800;padding:12px 18px;cursor:pointer;font-family:var(--font)">añadir clip</button>
      </div>
      <div id="sa-clips-list" style="display:flex;flex-direction:column;gap:8px">
        <div style="font-size:13px;color:var(--muted)">cargando clips...</div>
      </div>
    </div>

    <div style="height:1px;background:var(--border)"></div>

    <!-- NOTICIAS -->
    <div>
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--muted);margin-bottom:14px">Nueva noticia</div>
      <input class="form-input" id="sa-noticia-titulo" type="text" placeholder="título de la noticia" style="margin-bottom:10px">
      <input class="form-input" id="sa-noticia-autor" type="text" placeholder="firma  (ej: - Enrique, Ruedda)" style="margin-bottom:10px">
      <input type="file" id="sa-noticia-img-input" accept="image/*" style="display:none" onchange="previewNoticiaImg(this)">
      <div id="sa-noticia-preview" onclick="document.getElementById('sa-noticia-img-input').click()" style="width:100%;aspect-ratio:16/9;background:var(--card);border:1.5px dashed var(--border);border-radius:14px;display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;margin-bottom:12px">
        <span style="font-size:13px;color:var(--muted)">toca para subir banner</span>
      </div>
      <textarea id="sa-noticia-content" placeholder="cuerpo de la noticia..." style="width:100%;background:var(--card);border:1px solid var(--border);border-radius:13px;color:var(--white);font-size:14px;padding:14px;resize:none;font-family:var(--font);box-sizing:border-box;height:120px;line-height:1.6;margin-bottom:10px"></textarea>
      <button onclick="saAddNoticia()" style="width:100%;background:var(--lime);color:var(--lime-ink);border:none;border-radius:13px;font-size:14px;font-weight:800;padding:14px;cursor:pointer;font-family:var(--font)">publicar noticia</button>
      <div id="sa-noticias-list" style="display:flex;flex-direction:column;gap:8px;margin-top:16px">
        <div style="font-size:13px;color:var(--muted)">cargando noticias...</div>
      </div>
    </div>

    <div style="height:1px;background:var(--border)"></div>

    <!-- SUGERENCIAS -->
    <div>
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--muted);margin-bottom:14px">Buzón de sugerencias</div>
      <div id="sa-sugerencias-list" style="display:flex;flex-direction:column;gap:8px">
        <div style="font-size:13px;color:var(--muted)">cargando...</div>
      </div>
    </div>

  </div>

  <!-- [V134] EVENTOS -->
  <div id="sa-eventos" style="display:none;flex-direction:column;padding:18px 18px 100px;gap:14px">
    <div style="font-size:17px;font-weight:800;letter-spacing:-.3px;margin-bottom:4px">Nuevo evento</div>
    <div style="font-size:13px;color:var(--muted);margin-bottom:4px">Aparece en Comunidad → Eventos. La card se pone "LIVE" sola entre la hora de inicio y fin, y "evento acabado" después, no hay que borrarlo ni tocarlo, solo queda ahí.</div>
    <input class="form-input" id="sa-evento-titulo" type="text" placeholder="título del evento">
    <input type="file" id="sa-evento-img-input" accept="image/*" style="display:none" onchange="previewEventoImg(this)">
    <div id="sa-evento-preview" onclick="document.getElementById('sa-evento-img-input').click()" style="width:100%;aspect-ratio:16/9;background:var(--card);border:1.5px dashed var(--border);border-radius:14px;display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden">
      <span style="font-size:13px;color:var(--muted)">toca para subir la foto</span>
    </div>
    <div style="display:flex;gap:8px">
      <input class="form-input" id="sa-evento-fecha" type="date" style="flex:1">
      <input class="form-input" id="sa-evento-hora-inicio" type="time" style="flex:1">
      <input class="form-input" id="sa-evento-hora-fin" type="time" style="flex:1">
    </div>
    <div style="font-size:11px;color:var(--w30);margin-top:-6px">fecha, hora de inicio y hora de fin (con esas dos calcula solo cuándo está LIVE)</div>
    <input class="form-input" id="sa-evento-ubicacion" type="text" placeholder="ubicación (opcional)">
    <textarea id="sa-evento-descripcion" placeholder="descripción del evento..." style="width:100%;background:var(--card);border:1px solid var(--border);border-radius:13px;color:var(--white);font-size:14px;padding:14px;resize:none;font-family:var(--font);box-sizing:border-box;height:100px;line-height:1.6"></textarea>
    <select id="sa-evento-entrada" onchange="_saToggleEventoLinkField()" style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:13px 14px;font-family:var(--font);font-size:14px;color:var(--white);outline:none">
      <option value="libre">entrada libre</option>
      <option value="pagada">requiere comprar entradas</option>
    </select>
    <input class="form-input" id="sa-evento-link" type="url" placeholder="link para comprar entradas" style="display:none">
    <button onclick="saAddEvento()" style="width:100%;background:#000;color:var(--white);border:1px solid var(--w15);border-radius:13px;font-size:14px;font-weight:800;padding:14px;cursor:pointer;font-family:var(--font)">publicar evento</button>
    <div id="sa-eventos-list" style="display:flex;flex-direction:column;gap:8px;margin-top:6px">
      <div style="font-size:13px;color:var(--muted)">cargando eventos...</div>
    </div>
  </div>

  <!-- PUBLICACIONES -->
  <!-- [FIX] LOGOS DE MARCAS — 56 marcas de MARCAS_LIST, ninguna se puede quedar
       fuera. Lista compacta (no cards grandes, sería demasiado scroll) con
       thumbnail + botón de subida por fila. -->
  <div id="sa-logos" style="display:none;flex-direction:column;padding:18px 18px 100px;gap:14px">
    <div style="font-size:17px;font-weight:800;letter-spacing:-.3px;margin-bottom:4px">Logos de marcas</div>
    <div style="font-size:13px;color:var(--muted);margin-bottom:4px">Sube el logo de cada marca para la vista "Marcas". Se ven en la app apenas se suben, carga suave automática.</div>
    <input type="text" id="sa-logos-search" placeholder="buscar marca..." oninput="saLoadMarcaLogos(this.value)" style="background:var(--w5);border:1px solid var(--w10);border-radius:12px;padding:12px 14px;font-family:var(--font);font-size:14px;color:var(--white);outline:none;box-sizing:border-box">
    <div id="sa-logos-list" style="display:flex;flex-direction:column;gap:8px">
      <div style="text-align:center;padding:30px;color:var(--w30);font-size:13px">cargando...</div>
    </div>
  </div>

  <!-- [comparativa de precios] data que alimenta el chart del detalle de market. súper simple:
       marca+modelo + un JSON con los rangos. sin entrada acá, el chart no aparece en la app — no rompe nada. -->
  <div id="sa-comparativa" style="display:none;flex-direction:column;padding:18px 18px 100px;gap:14px">
    <div style="font-size:17px;font-weight:800;letter-spacing:-.3px;margin-bottom:4px">Comparativa de precios</div>
    <div style="font-size:13px;color:var(--muted);margin-bottom:4px">Alimenta el chart que aparece en el detalle de cada publicación de market (no subastas), entre especificaciones y descripción. Se busca por marca+modelo exacto. Si no hay entrada cargada para esa combinación, el chart simplemente no se muestra.</div>
    <input type="text" id="sa-cmp-marca" placeholder="marca (ej. toyota)" style="background:var(--w5);border:1px solid var(--w10);border-radius:12px;padding:12px 14px;font-family:var(--font);font-size:14px;color:var(--white);outline:none;box-sizing:border-box">
    <input type="text" id="sa-cmp-modelo" placeholder="modelo (ej. corolla)" style="background:var(--w5);border:1px solid var(--w10);border-radius:12px;padding:12px 14px;font-family:var(--font);font-size:14px;color:var(--white);outline:none;box-sizing:border-box">
    <textarea id="sa-cmp-payload" rows="8" placeholder='{"3m":{"p":[13500,13700,14200],"labels":["may","jun","jul"]},"6m":{"p":[13350,13500,13800,14200],"labels":["mar","may","jul","ago"]}}' style="background:var(--w5);border:1px solid var(--w10);border-radius:12px;padding:12px 14px;font-family:monospace;font-size:12px;color:var(--white);outline:none;resize:vertical;box-sizing:border-box;line-height:1.5"></textarea>
    <div style="font-size:11px;color:var(--w30);line-height:1.5">rangos válidos: 3m, 6m, 1a, 3a, 5a, cada uno con "p" (array de precios) y "labels" (array de textos del eje, mismo largo que "p"). solo hace falta llenar los rangos que quieras mostrar; los demás se ocultan solos.</div>
    <button onclick="saSaveComparativa()" style="width:100%;background:var(--lime);color:var(--lime-ink);border:none;border-radius:13px;padding:15px;font-family:var(--font);font-size:15px;font-weight:800;cursor:pointer">guardar</button>
    <div style="font-size:13px;font-weight:700;color:var(--w40);margin-top:10px;text-transform:uppercase;letter-spacing:.4px">entradas cargadas</div>
    <div id="sa-cmp-list" style="display:flex;flex-direction:column;gap:8px">
      <div style="text-align:center;padding:20px;color:var(--w30);font-size:13px">cargando...</div>
    </div>
  </div>

  <!-- [Criterio Ruedda] activación manual del medidor mientras el motor de
       tasación no esté deployado — publicación por publicación, mismos campos
       que escribiría el motor automático (pme_usd/pme_delta/pme_classification/
       pme_confianza), pme_basado_en queda como 'manual'. -->
  <div id="sa-criterio" style="display:none;flex-direction:column;padding:18px 18px 100px;gap:14px">
    <div style="font-size:17px;font-weight:800;letter-spacing:-.3px;margin-bottom:4px">Criterio Ruedda</div>
    <div style="font-size:13px;color:var(--muted);margin-bottom:4px">Mientras el motor automático no esté deployado, acá activas el medidor a mano por publicación. Toca una fila, pon el precio estimado y guarda — el comprador ve el mismo chip que si lo hubiera calculado el motor.</div>
    <div style="display:flex;gap:8px;margin-bottom:4px">
      <button onclick="saLoadCriterioList('listings')" id="sa-crit-tab-listings" style="flex:1;background:rgba(8,68,26,.15);border:1px solid rgba(8,68,26,.3);border-radius:10px;padding:9px;font-family:var(--font);font-size:12px;font-weight:700;color:#08441A;cursor:pointer">market</button>
      <button onclick="saLoadCriterioList('auctions')" id="sa-crit-tab-auctions" style="flex:1;background:var(--w5);border:1px solid var(--border);border-radius:10px;padding:9px;font-family:var(--font);font-size:12px;font-weight:700;color:var(--w50);cursor:pointer">subastas</button>
    </div>
    <div id="sa-crit-list" style="display:flex;flex-direction:column;gap:8px">
      <div style="text-align:center;padding:30px;color:var(--w30);font-size:13px">cargando...</div>
    </div>
  </div>

  <!-- [ONBOARDING NATIVO] fotos del intro (#rd-intro) — solo se ve en la app
       nativa o instalada como PWA (showOnWeb:false), pero las 7 fotos y sus
       textos se editan desde acá igual que cualquier otra foto de la app. -->
  <div id="sa-intro" style="display:none;flex-direction:column;padding:18px 18px 100px;gap:14px">
    <div style="font-size:17px;font-weight:800;letter-spacing:-.3px;margin-bottom:4px">Intro de la app (onboarding)</div>
    <div style="font-size:13px;color:var(--muted);margin-bottom:4px">Las 9 fotos de la portada que ve quien abre la app nativa por primera vez. No aparece en el navegador. Solo en la app instalada. Subir una foto la reemplaza al instante para todos, sin republicar. Ya no hay fotos por defecto: la que no tenga foto subida acá se ve con un degradado hasta que subas una.</div>
    <div id="sa-intro-list" style="display:flex;flex-direction:column;gap:8px">
      <div style="text-align:center;padding:30px;color:var(--w30);font-size:13px">cargando...</div>
    </div>
  </div>

  <div id="sa-documentos" style="display:none;flex-direction:column;padding:18px 18px 100px;gap:14px">
    <div style="font-size:17px;font-weight:800;letter-spacing:-.3px;margin-bottom:4px">Documentos · verificación "Auditado por Ruedda"</div>
    <div style="font-size:13px;color:var(--muted);margin-bottom:4px">Revisa los documentos contra las fotos del vehículo. Si apruebas, el card se lleva el sello. Si niegas, no pasa nada, simplemente no lo obtiene.</div>
    <div id="sa-doc-list" style="display:flex;flex-direction:column;gap:14px">
      <div style="text-align:center;padding:30px;color:var(--w30);font-size:13px">cargando...</div>
    </div>
  </div>

  <!-- [CONS HUB v1] SOLICITUDES — "solicita tu carro" + "ser partner" -->
  <div id="sa-solicitudes" style="display:none;flex-direction:column;padding:18px 18px 100px;gap:14px">
    <div style="font-size:17px;font-weight:800;letter-spacing:-.3px;margin-bottom:4px">Solicitudes</div>
    <div style="font-size:13px;color:var(--muted);margin-bottom:4px">Leads de "solicita tu carro" y "ser partner" que llegan desde la sección concesionarios.</div>
    <div style="display:flex;gap:8px;margin-bottom:4px">
      <button onclick="saLoadSolicitudes('car')" id="sa-sol-tab-car" style="flex:1;background:rgba(8,68,26,.15);border:1px solid rgba(8,68,26,.3);border-radius:10px;padding:9px;font-family:var(--font);font-size:12px;font-weight:700;color:#08441A;cursor:pointer">solicita tu carro</button>
      <button onclick="saLoadSolicitudes('partner')" id="sa-sol-tab-partner" style="flex:1;background:var(--w5);border:1px solid var(--border);border-radius:10px;padding:9px;font-family:var(--font);font-size:12px;font-weight:700;color:var(--w50);cursor:pointer">ser partner</button>
      <button onclick="saLoadSolicitudes('publicar')" id="sa-sol-tab-publicar" style="flex:1;background:var(--w5);border:1px solid var(--border);border-radius:10px;padding:9px;font-family:var(--font);font-size:12px;font-weight:700;color:var(--w50);cursor:pointer">publicar por ti</button>
    </div>
    <div id="sa-sol-list" style="display:flex;flex-direction:column;gap:10px">
      <div style="text-align:center;padding:30px;color:var(--w30);font-size:13px">cargando...</div>
    </div>
  </div>

  <div id="sa-publicaciones" style="display:none;flex-direction:column;padding:18px 18px 100px;gap:14px">
    <div style="font-size:17px;font-weight:800;letter-spacing:-.3px;margin-bottom:4px">Gestor Global</div>
    <div style="font-size:13px;color:var(--muted);margin-bottom:4px">Todas las publicaciones de la plataforma.</div>
    <div style="display:flex;gap:8px;margin-bottom:4px">
      <button onclick="saLoadPublicaciones('listings')" id="sa-pub-tab-listings" style="flex:1;background:rgba(8,68,26,.15);border:1px solid rgba(8,68,26,.3);border-radius:10px;padding:9px;font-family:var(--font);font-size:12px;font-weight:700;color:#08441A;cursor:pointer">market</button>
      <button onclick="saLoadPublicaciones('auctions')" id="sa-pub-tab-auctions" style="flex:1;background:var(--w5);border:1px solid var(--border);border-radius:10px;padding:9px;font-family:var(--font);font-size:12px;font-weight:700;color:var(--w50);cursor:pointer">subastas</button>
      <button onclick="saLoadPublicaciones('rentals')" id="sa-pub-tab-rentals" style="flex:1;background:var(--w5);border:1px solid var(--border);border-radius:10px;padding:9px;font-family:var(--font);font-size:12px;font-weight:700;color:var(--w50);cursor:pointer">alquileres</button>
    </div>
    <!-- [subir aprobadas huérfanas] publicaciones que SuperAdmin aprobó pero el
         dueño nunca tocó "subir" en mis publicaciones — quedan en estado='aprobada'
         invisibles para siempre. Este botón las activa directo (bypass del checkout
         del dueño), en lotes chicos y secuenciales para no repetir la carga pesada
         que rompió el market la vez pasada. Opera sobre la tabla que esté activa
         en el toggle de arriba (market/subastas). -->
    <button onclick="saSubirAprobadas()" id="sa-pub-subir-btn" style="width:100%;background:rgba(8,68,26,.1);border:1px solid rgba(8,68,26,.25);border-radius:10px;padding:10px;font-family:var(--font);font-size:12px;font-weight:700;color:#08441A;cursor:pointer;margin-bottom:2px">⬆ subir aprobadas que el dueño nunca subió</button>
    <div id="sa-pub-list" style="display:flex;flex-direction:column;gap:8px">
      <div style="text-align:center;padding:30px;color:var(--w30);font-size:13px">cargando...</div>
    </div>
  </div>

  <!-- RUEDDA TEAM -->
  <div id="sa-mensajes" style="display:none;flex-direction:column;padding:18px 18px 100px;gap:28px">
    <div>
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--muted);margin-bottom:14px">foto del canal Ruedda Team</div>
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:4px">
        <div id="sa-rtm-avatar-preview" onclick="document.getElementById('sa-rtm-avatar-file').click()" style="width:56px;height:56px;border-radius:50%;background:var(--card);border:1.5px solid rgba(8,68,26,.4);display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;flex-shrink:0;font-weight:800;color:#08441A">R</div>
        <input type="file" id="sa-rtm-avatar-file" accept="image/*" style="display:none" onchange="saUploadRueddaTeamAvatar(this)">
        <div style="font-size:12px;color:var(--muted);line-height:1.5">toca el círculo para subir<br>una foto nueva</div>
      </div>
    </div>

    <div style="height:1px;background:var(--border)"></div>

    <div>
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--muted);margin-bottom:14px">mensaje global a todos los usuarios</div>
      <textarea id="sa-rtm-body" placeholder="escribe el anuncio..." style="width:100%;background:var(--card);border:1px solid var(--border);border-radius:13px;color:var(--white);font-size:14px;padding:14px;resize:none;font-family:var(--font);box-sizing:border-box;height:100px;line-height:1.6;margin-bottom:10px"></textarea>
      <button onclick="saSendRueddaTeamMessage()" style="width:100%;background:var(--lime);color:var(--lime-ink);border:none;border-radius:13px;font-size:14px;font-weight:800;padding:14px;cursor:pointer;font-family:var(--font)">enviar a todos</button>
      <div id="sa-rtm-list" style="display:flex;flex-direction:column;gap:8px;margin-top:16px">
        <div style="font-size:13px;color:var(--muted)">cargando anuncios...</div>
      </div>
    </div>
  </div>
    <div style="font-size:17px;font-weight:800;letter-spacing:-.3px;margin-bottom:4px">Patrocinantes</div>
    <div style="font-size:13px;color:var(--muted);margin-bottom:8px">Gestiona los patrocinantes por categoría. La categoría "market" es el banner rotativo que aparece arriba del market. Las demás son de RueddaExtra. Cada card puede tener imagen, nombre y link.</div>
    <div id="sa-pat-content" style="display:flex;flex-direction:column;gap:14px">
      <div style="font-size:13px;color:var(--muted)">cargando...</div>
    </div>

    <div style="height:1px;background:var(--border);margin:22px 0"></div>

    <div style="height:1px;background:var(--border);margin:22px 0"></div>

    <!-- [CONS HUB v1] banner 16:9 de la sección "concesionarios" — misma mecánica
         bucket 'assets' + app_settings key/value que el resto de este panel. -->
    <div style="font-size:17px;font-weight:800;letter-spacing:-.3px;margin-bottom:4px">Concesionarios · banner</div>
    <div style="font-size:13px;color:var(--muted);margin-bottom:8px">Foto 16:9 horizontal del banner patrocinante que aparece arriba en la sección "concesionarios". Toca para subir.</div>
    <div id="sa-cons-banner-preview" onclick="document.getElementById('sa-cons-banner-file').click()" style="width:100%;aspect-ratio:16/9;border-radius:16px;background:var(--card);border:1.5px dashed rgba(8,68,26,.4);display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;color:var(--w30)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" style="width:26px;height:26px"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>
    </div>
    <input type="file" id="sa-cons-banner-file" accept="image/*" style="display:none" onchange="_saUploadConsBanner(this)">

    <div style="height:1px;background:var(--border);margin:22px 0"></div>

    <!-- [ENCUENTRA] fotos de "Busca por marcas" y "Red post-venta" — submenu debajo
         de hot deals en Market. Mismo patrón exacto que la foto del canal Ruedda
         Team (bucket 'assets' + app_settings key/value), sin inventar un sistema
         nuevo. El fade-in suave (foto, no la card) lo hace el cliente en
         _encuentraSetPhoto() cuando el usuario vuelve a Market. -->
    <div style="font-size:17px;font-weight:800;letter-spacing:-.3px;margin-bottom:4px">Encuentra · fotos</div>
    <div style="font-size:13px;color:var(--muted);margin-bottom:8px">Fotos de los accesos "Agencias", "Busca por marcas" y "Red post-venta" del submenu Encuentra en Market. Toca el cuadro para subir.</div>
    <div style="display:flex;gap:14px">
      <div style="flex:1;text-align:center">
        <div id="sa-enc-agencias-preview" onclick="document.getElementById('sa-enc-agencias-file').click()" style="width:100%;aspect-ratio:1/1;border-radius:16px;background:var(--card);border:1.5px dashed rgba(8,68,26,.4);display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;color:var(--w30)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" style="width:26px;height:26px"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>
        </div>
        <input type="file" id="sa-enc-agencias-file" accept="image/*" style="display:none" onchange="_saUploadEncuentraPhoto(this,'agencias')">
        <div style="font-size:11.5px;color:var(--muted);margin-top:8px">agencias</div>
      </div>
      <div style="flex:1;text-align:center">
        <div id="sa-enc-marcas-preview" onclick="document.getElementById('sa-enc-marcas-file').click()" style="width:100%;aspect-ratio:1/1;border-radius:16px;background:var(--card);border:1.5px dashed rgba(8,68,26,.4);display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;color:var(--w30)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" style="width:26px;height:26px"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>
        </div>
        <input type="file" id="sa-enc-marcas-file" accept="image/*" style="display:none" onchange="_saUploadEncuentraPhoto(this,'marcas')">
        <div style="font-size:11.5px;color:var(--muted);margin-top:8px">busca por marcas</div>
      </div>
      <div style="flex:1;text-align:center">
        <div id="sa-enc-postventa-preview" onclick="document.getElementById('sa-enc-postventa-file').click()" style="width:100%;aspect-ratio:1/1;border-radius:16px;background:var(--card);border:1.5px dashed rgba(8,68,26,.4);display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;color:var(--w30)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" style="width:26px;height:26px"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>
        </div>
        <input type="file" id="sa-enc-postventa-file" accept="image/*" style="display:none" onchange="_saUploadEncuentraPhoto(this,'postventa')">
        <div style="font-size:11.5px;color:var(--muted);margin-top:8px">red post-venta</div>
      </div>
    </div>
    <!-- [RC] fila 2 — Comunidad y Subastas ahora también son contenedores de foto -->
    <div style="display:flex;gap:14px;margin-top:14px">
      <div style="flex:1;text-align:center">
        <div id="sa-enc-comunidad-preview" onclick="document.getElementById('sa-enc-comunidad-file').click()" style="width:100%;aspect-ratio:1/1;border-radius:16px;background:var(--card);border:1.5px dashed rgba(8,68,26,.4);display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;color:var(--w30)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" style="width:26px;height:26px"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>
        </div>
        <input type="file" id="sa-enc-comunidad-file" accept="image/*" style="display:none" onchange="_saUploadEncuentraPhoto(this,'comunidad')">
        <div style="font-size:11.5px;color:var(--muted);margin-top:8px">comunidad</div>
      </div>
      <div style="flex:1;text-align:center">
        <div id="sa-enc-subastas-preview" onclick="document.getElementById('sa-enc-subastas-file').click()" style="width:100%;aspect-ratio:1/1;border-radius:16px;background:var(--card);border:1.5px dashed rgba(8,68,26,.4);display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;color:var(--w30)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" style="width:26px;height:26px"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>
        </div>
        <input type="file" id="sa-enc-subastas-file" accept="image/*" style="display:none" onchange="_saUploadEncuentraPhoto(this,'subastas')">
        <div style="font-size:11.5px;color:var(--muted);margin-top:8px">subastas</div>
      </div>
      <div style="flex:1;text-align:center">
        <div id="sa-enc-repuestos-preview" onclick="document.getElementById('sa-enc-repuestos-file').click()" style="width:100%;aspect-ratio:1/1;border-radius:16px;background:var(--card);border:1.5px dashed rgba(8,68,26,.4);display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;color:var(--w30)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" style="width:26px;height:26px"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>
        </div>
        <input type="file" id="sa-enc-repuestos-file" accept="image/*" style="display:none" onchange="_saUploadEncuentraPhoto(this,'repuestos')">
        <div style="font-size:11.5px;color:var(--muted);margin-top:8px">repuestos</div>
      </div>
    </div>
    <!-- [RC] fila 3 — Alquileres e Importaciones -->
    <div style="display:flex;gap:14px;margin-top:14px">
      <div style="flex:1;text-align:center">
        <div id="sa-enc-alquileres-preview" onclick="document.getElementById('sa-enc-alquileres-file').click()" style="width:100%;aspect-ratio:1/1;border-radius:16px;background:var(--card);border:1.5px dashed rgba(8,68,26,.4);display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;color:var(--w30)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" style="width:26px;height:26px"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>
        </div>
        <input type="file" id="sa-enc-alquileres-file" accept="image/*" style="display:none" onchange="_saUploadEncuentraPhoto(this,'alquileres')">
        <div style="font-size:11.5px;color:var(--muted);margin-top:8px">alquileres</div>
      </div>
      <div style="flex:1;text-align:center">
        <div id="sa-enc-importaciones-preview" onclick="document.getElementById('sa-enc-importaciones-file').click()" style="width:100%;aspect-ratio:1/1;border-radius:16px;background:var(--card);border:1.5px dashed rgba(8,68,26,.4);display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;color:var(--w30)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" style="width:26px;height:26px"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>
        </div>
        <input type="file" id="sa-enc-importaciones-file" accept="image/*" style="display:none" onchange="_saUploadEncuentraPhoto(this,'importaciones')">
        <div style="font-size:11.5px;color:var(--muted);margin-top:8px">importaciones</div>
      </div>
      <div style="flex:1"></div>
    </div>

    <div style="height:1px;background:var(--border);margin:22px 0"></div>

    <!-- [RC] ORDEN DE ENCUENTRA — arrastra para reordenar los cards del submenu.
         Persiste como JSON en app_settings (encuentra_order); el cliente lo
         aplica moviendo nodos por data-enc, sin re-render. Pointer events =
         funciona igual con mouse y touch. -->
    <div style="font-size:17px;font-weight:800;letter-spacing:-.3px;margin-bottom:4px">Encuentra · orden</div>
    <div style="font-size:13px;color:var(--muted);margin-bottom:10px">Arrastra los cards para reordenar cómo aparecen en Market. Se guarda automáticamente al soltar.</div>
    <div id="sa-enc-order-list" style="display:flex;flex-direction:column;gap:8px"></div>

    <div style="height:1px;background:var(--border);margin:22px 0"></div>

    <!-- [XP/NIVELES] insignia por nivel — PNG/SVG ultra ligero. Los 16 niveles
         ya existen (tabla user_levels, migración 20260816000002_xp_levels.sql);
         acá solo se sube la imagen, mismo patrón upsert-por-key que marca_logos.
         Aparece junto al nombre al abrir un perfil y en "usuarios top". -->
    <div style="font-size:17px;font-weight:800;letter-spacing:-.3px;margin-bottom:4px">Insignias por nivel</div>
    <div style="font-size:13px;color:var(--muted);margin-bottom:10px">Una insignia por cada nivel del sistema de XP. Sube PNG o SVG ultra liviano, toca el cuadro.</div>
    <div id="sa-levels-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px"></div>
  </div>`;
const ADMIN_PANEL_HTML_DESKTOP = `<div id="view-superadmin" class="view">
  <div class="detail-back" onclick="showView('cuenta')">
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>
    <span>cuenta</span>
  </div>

  <!-- [SA REDESIGN] header premium — solo estético, cero lógica tocada -->
  <div style="padding:2px 18px 18px">
    <div style="display:flex;align-items:center;gap:12px">
      <div style="width:44px;height:44px;border-radius:13px;background:linear-gradient(135deg,rgba(8,68,26,.16),rgba(8,68,26,.04));border:1px solid rgba(8,68,26,.22);display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <svg viewBox="0 0 24 24" fill="none" stroke="#08441A" stroke-width="1.8" style="width:21px;height:21px"><path d="M12 2 4 6v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V6l-8-4z"/><path d="M9 12l2 2 4-4.5"/></svg>
      </div>
      <div>
        <div style="display:flex;align-items:center;gap:8px">
          <h2 style="font-size:22px;font-weight:800;letter-spacing:-.4px">SuperAdmin</h2>
          <span style="background:var(--lime);color:var(--lime-ink);font-size:9.5px;font-weight:800;padding:2.5px 9px;border-radius:100px;letter-spacing:.4px">ADMIN</span>
        </div>
        <div style="font-size:11.5px;color:var(--w35);margin-top:1px">panel de control · Ruedda</div>
      </div>
    </div>
  </div>

  <!-- [SA REDESIGN] categorías — agrupan visualmente los mismos 13 tabs de siempre.
       cada sa-tab-X conserva su id y onclick original intactos; solo se envuelven en
       grupos que se muestran/ocultan por categoría. saTab() no se toca en absoluto. -->
  <div class="sa-cat-row" id="sa-cat-row">
    <button class="sa-cat-btn active" id="sa-cat-usuarios" onclick="saCategory('usuarios')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>
      <span>usuarios &amp; accesos</span>
    </button>
    <button class="sa-cat-btn" id="sa-cat-contenido" onclick="saCategory('contenido')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2 4 6v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V6l-8-4z"/></svg>
      <span>contenido &amp; moderación</span>
    </button>
    <button class="sa-cat-btn" id="sa-cat-dinero" onclick="saCategory('dinero')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 9.5c0-1.5 1.3-2 3-2s3 .8 3 2-1.3 2-3 2-3 .7-3 2 1.3 2 3 2 3-.5 3-2"/></svg>
      <span>monetización</span>
    </button>
    <button class="sa-cat-btn" id="sa-cat-soporte" onclick="saCategory('soporte')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      <span>comunidad &amp; soporte</span>
    </button>
  </div>

  <!-- TABS — agrupadas, mismos elementos de siempre -->
  <div class="sa-tabgroup" data-cat="usuarios">
    <div class="tabs sa-tabs-inner">
      <div class="tab active" id="sa-tab-cuentas" onclick="saTab('cuentas')" style="white-space:nowrap;flex-shrink:0">cuentas</div>
      <div class="tab" id="sa-tab-usuarios" onclick="saTab('usuarios')" style="white-space:nowrap;flex-shrink:0">usuarios</div>
      <div class="tab" id="sa-tab-kyc" onclick="saTab('kyc')" style="white-space:nowrap;flex-shrink:0">KYC</div>
      <div class="tab" id="sa-tab-bypass" onclick="saTab('bypass')" style="white-space:nowrap;flex-shrink:0">bypass</div>
      <div class="tab" id="sa-tab-acceso" onclick="saTab('acceso')" style="white-space:nowrap;flex-shrink:0">enviar código</div>
    </div>
  </div>
  <div class="sa-tabgroup" data-cat="contenido" style="display:none">
    <div class="tabs sa-tabs-inner">
      <div class="tab" id="sa-tab-moderacion" onclick="saTab('moderacion')" style="white-space:nowrap;flex-shrink:0">moderación</div>
      <div class="tab" id="sa-tab-publicaciones" onclick="saTab('publicaciones')" style="white-space:nowrap;flex-shrink:0">publicaciones</div>
      <div class="tab" id="sa-tab-comunidad" onclick="saTab('comunidad')" style="white-space:nowrap;flex-shrink:0">comunidad</div>
      <div class="tab" id="sa-tab-documentos" onclick="saTab('documentos')" style="white-space:nowrap;flex-shrink:0">documentos</div>
      <div class="tab" id="sa-tab-logos" onclick="saTab('logos')" style="white-space:nowrap;flex-shrink:0">logos marcas</div>
      <div class="tab" id="sa-tab-comparativa" onclick="saTab('comparativa')" style="white-space:nowrap;flex-shrink:0">comparativa precios</div>
      <div class="tab" id="sa-tab-criterio" onclick="saTab('criterio')" style="white-space:nowrap;flex-shrink:0">criterio ruedda</div>
      <div class="tab" id="sa-tab-portada" onclick="saTab('portada')" style="white-space:nowrap;flex-shrink:0">foto portada</div>
    </div>
  </div>
  <div class="sa-tabgroup" data-cat="dinero" style="display:none">
    <div class="tabs sa-tabs-inner">
      <div class="tab" id="sa-tab-codigos" onclick="saTab('codigos')" style="white-space:nowrap;flex-shrink:0">códigos</div>
      <div class="tab" id="sa-tab-pagos" onclick="saTab('pagos')" style="white-space:nowrap;flex-shrink:0">pagos</div>
      <div class="tab" id="sa-tab-patrocinantes" onclick="saTab('patrocinantes')" style="white-space:nowrap;flex-shrink:0">patrocinantes</div>
      <div class="tab" id="sa-tab-aucodigos" onclick="saTab('aucodigos')" style="white-space:nowrap;flex-shrink:0">subastas activas</div>
    </div>
  </div>
  <div class="sa-tabgroup" data-cat="soporte" style="display:none">
    <div class="tabs sa-tabs-inner">
      <div class="tab" id="sa-tab-fotografos" onclick="saTab('fotografos')" style="white-space:nowrap;flex-shrink:0">fotógrafos</div>
      <div class="tab" id="sa-tab-mensajes" onclick="saTab('mensajes')" style="white-space:nowrap;flex-shrink:0">ruedda team</div>
      <div class="tab" id="sa-tab-solicitudes" onclick="saTab('solicitudes')" style="white-space:nowrap;flex-shrink:0">solicitudes</div>
    </div>
  </div>

  <!-- USUARIOS TAB -->
  <div id="sa-usuarios" style="display:none;flex-direction:column;padding:18px 18px 100px;gap:14px">
    <!-- SEARCH -->
    <div style="display:flex;align-items:center;gap:10px;background:var(--card);border:1px solid var(--border);border-radius:12px;padding:12px 15px">
      <svg fill="none" viewBox="0 0 24 24" stroke="var(--w30)" stroke-width="2" style="width:16px;height:16px;flex-shrink:0"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      <input id="sa-user-search" type="text" placeholder="buscar por nombre o correo..." oninput="renderSAUsuarios(this.value)" style="background:none;border:none;outline:none;font-family:var(--font);font-size:14px;color:var(--white);width:100%">
    </div>
    <div id="sa-user-list" style="display:flex;flex-direction:column;gap:8px"></div>
  </div>

  <!-- CUENTAS TAB -->
  <div id="sa-cuentas" style="padding:18px 18px 100px;display:flex;flex-direction:column;gap:14px">
    <div style="font-size:12px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">crear cuenta particular</div>
    <input class="form-input" id="sa-p-nombre" type="text" placeholder="nombre completo">
    <input class="form-input" id="sa-p-email" type="email" placeholder="correo electrónico">
    <input class="form-input" id="sa-p-username" type="text" placeholder="@usuario">
    <div style="display:flex;gap:0;background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden">
      <span style="padding:13px 14px;font-size:14px;font-weight:700;color:var(--w40);border-right:1px solid var(--border);flex-shrink:0">V</span>
      <input class="form-input" id="sa-p-cedula" type="number" placeholder="cédula" style="border:none;border-radius:0;flex:1">
    </div>
    <input class="form-input" id="sa-p-pass" type="password" placeholder="contraseña temporal">
    <button onclick="saCrearParticular()" style="background:var(--card);border:1px solid var(--border);border-radius:13px;padding:14px;font-family:var(--font);font-size:14px;font-weight:700;color:var(--white);cursor:pointer;transition:all .15s">crear cuenta particular</button>

    <div style="height:1px;background:var(--border);margin:8px 0"></div>

    <div style="font-size:12px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">crear cuenta concesionario</div>
    <input class="form-input" id="sa-d-nombre" type="text" placeholder="nombre del concesionario">
    <input class="form-input" id="sa-d-rep" type="text" placeholder="nombre del representante">
    <input class="form-input" id="sa-d-email" type="email" placeholder="correo electrónico">
    <input class="form-input" id="sa-d-username" type="text" placeholder="@usuario">
    <input class="form-input" id="sa-d-ubicacion" type="text" placeholder="ciudad / ubicación">
    <div style="display:flex;gap:0;background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden">
      <span style="padding:13px 14px;font-size:14px;font-weight:700;color:var(--w40);border-right:1px solid var(--border);flex-shrink:0">J</span>
      <input class="form-input" id="sa-d-cedula" type="number" placeholder="cédula / RIF" style="border:none;border-radius:0;flex:1">
    </div>
    <input class="form-input" id="sa-d-pass" type="password" placeholder="contraseña temporal">
    <button onclick="saCrearConcesionario()" style="background:var(--lime);color:var(--lime-ink);border:none;border-radius:13px;padding:14px;font-family:var(--font);font-size:14px;font-weight:800;cursor:pointer;transition:all .15s">crear cuenta concesionario</button>

    <div style="height:1px;background:var(--border);margin:8px 0"></div>

    <div style="font-size:12px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">crear SuperAdmin</div>
    <input class="form-input" id="sa-a-email" type="email" placeholder="correo SuperAdmin">
    <input class="form-input" id="sa-a-pass" type="password" placeholder="contraseña">
    <button onclick="saCrearAdmin()" style="background:rgba(8,68,26,.12);border:1px solid rgba(8,68,26,.3);border-radius:13px;padding:14px;font-family:var(--font);font-size:14px;font-weight:700;color:#08441A;cursor:pointer;transition:all .15s">crear SuperAdmin</button>
  </div>

  <!-- CÓDIGOS TAB -->
  <div id="sa-codigos" style="display:none;padding:18px 18px 100px;display:none;flex-direction:column;gap:14px">
    <input class="form-input" id="sa-code-text" type="text" placeholder="código personalizado (ej. RUEDDA2025)" style="text-transform:uppercase;letter-spacing:1px" oninput="this.value=this.value.toUpperCase()">
    <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:10px">
      <div style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.5px">tipo de código</div>
      <label style="display:flex;align-items:center;gap:10px;cursor:pointer"><input type="checkbox" id="sa-code-particular" style="accent-color:#08441A;width:16px;height:16px"><span style="font-size:14px">particular</span></label>
      <label style="display:flex;align-items:center;gap:10px;cursor:pointer"><input type="checkbox" id="sa-code-subasta" style="accent-color:#08441A;width:16px;height:16px"><span style="font-size:14px">subasta</span></label>
      <label style="display:flex;align-items:center;gap:10px;cursor:pointer"><input type="checkbox" id="sa-code-consesionario" style="accent-color:#08441A;width:16px;height:16px"><span style="font-size:14px">concesionario (activa vitrina)</span></label>
    </div>
    <div style="display:flex;gap:10px">
      <div style="flex:1"><div style="font-size:11px;color:var(--muted);margin-bottom:6px;font-weight:600">usos máximos</div><input class="form-input" id="sa-code-usos" type="number" placeholder="1" min="1" style="width:100%"></div>
      <div style="flex:1"><div style="font-size:11px;color:var(--muted);margin-bottom:6px;font-weight:600">caduca (días)</div><input class="form-input" id="sa-code-dias" type="number" placeholder="30" min="1" style="width:100%"></div>
    </div>
    <button onclick="saGenerarCodigo()" style="background:var(--lime);color:var(--lime-ink);border:none;border-radius:13px;padding:14px;font-family:var(--font);font-size:14px;font-weight:800;cursor:pointer">generar código</button>
    <div id="sa-codes-list" style="display:flex;flex-direction:column;gap:8px;margin-top:4px"></div>
  </div>

  <!-- MODERACIÓN TAB -->
  <div id="sa-moderacion" style="display:none;padding:18px 18px 100px;flex-direction:column;gap:0">
    <div class="tabs" style="padding:0 0 0;margin-bottom:14px">
      <div class="tab active" id="mod-tab-particular" onclick="modTab('particular')">particular</div>
      <div class="tab" id="mod-tab-subasta" onclick="modTab('subasta')">subasta</div>
      <div class="tab" id="mod-tab-consesionario" onclick="modTab('consesionario')">concesionario</div>
    </div>
    <div id="mod-queue" style="display:flex;flex-direction:column;gap:10px"></div>
  </div>

  <!-- FOTOGRAFOS TAB -->
  <div id="sa-fotografos" style="display:none;padding:18px 18px 100px;flex-direction:column;gap:14px">
    <div style="font-size:12px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">publicar fotógrafo</div>
    <input class="form-input" id="sa-f-nombre" type="text" placeholder="nombre completo">
    <input class="form-input" id="sa-f-ciudad" type="text" placeholder="ciudad">
    <input class="form-input" id="sa-f-telefono" type="tel" placeholder="teléfono">
    <input class="form-input" id="sa-f-especialidad" type="text" placeholder="especialidad (ej. autos deportivos)">
    <div style="font-size:11px;color:var(--muted);margin-bottom:2px;font-weight:600">catálogo (links)</div>
    <div id="sa-f-catalogo-list" style="display:flex;flex-direction:column;gap:8px"></div>
    <button onclick="saAddCatalogoLink()" style="background:transparent;border:1px dashed var(--w15);border-radius:12px;padding:12px;font-family:var(--font);font-size:13px;color:var(--w40);cursor:pointer;transition:all .15s;display:flex;align-items:center;justify-content:center;gap:6px" onmouseover="this.style.borderColor='var(--w35)'" onmouseout="this.style.borderColor='var(--w15)'">
      <svg fill="none" viewBox="0 0 20 20" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><line x1="10" y1="4" x2="10" y2="16"/><line x1="4" y1="10" x2="16" y2="10"/></svg>
      agregar link de catálogo
    </button>
    <button onclick="saPublicarFotografo()" style="background:var(--lime);color:var(--lime-ink);border:none;border-radius:13px;padding:14px;font-family:var(--font);font-size:14px;font-weight:800;cursor:pointer;transition:all .15s;margin-top:4px" onmousedown="this.style.transform='scale(.98)'" onmouseup="this.style.transform='scale(1)'">publicar fotógrafo</button>
    <div style="height:1px;background:var(--border);margin:4px 0"></div>
    <div style="font-size:12px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">fotógrafos activos</div>
    <div id="sa-f-list" style="display:flex;flex-direction:column;gap:8px"></div>
  </div>

  <!-- PAGOS TAB -->
  <div id="sa-pagos" style="display:none;flex-direction:column;padding:18px 18px 100px;gap:14px">
    <div style="font-size:12px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.5px">datos de pago móvil</div>

    <!-- BANK LOGO UPLOAD -->
    <div style="display:flex;align-items:center;gap:14px">
      <div id="sa-bank-logo-preview" onclick="document.getElementById('sa-bank-logo-file').click()" style="width:56px;height:56px;border-radius:14px;background:var(--card);border:1px dashed var(--w15);display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;flex-shrink:0;transition:border-color .15s" onmouseover="this.style.borderColor='var(--w35)'" onmouseout="this.style.borderColor='var(--w15)'">
        <svg fill="none" viewBox="0 0 24 24" stroke="var(--w25)" stroke-width="1.5" style="width:20px;height:20px"><path d="M3 9a2 2 0 0 1 2-2h.93a2 2 0 0 0 1.664-.89l.812-1.22A2 2 0 0 1 10.07 4h3.86a2 2 0 0 1 1.664.89l.812 1.22A2 2 0 0 0 18.07 7H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z"/><circle cx="12" cy="13" r="3"/></svg>
      </div>
      <input id="sa-bank-logo-file" type="file" accept="image/*" style="display:none" onchange="saBankLogoUpload(this)">
      <div style="flex:1">
        <div style="font-size:13px;font-weight:600;margin-bottom:2px">logo del banco</div>
        <div style="font-size:12px;color:var(--muted)">se muestra en el checkout</div>
      </div>
    </div>

    <input class="form-input" id="sa-pay-banco" type="text" placeholder="nombre del banco" style="width:100%">
    <input class="form-input" id="sa-pay-telefono" type="tel" placeholder="teléfono de pago móvil" style="width:100%">
    <input class="form-input" id="sa-pay-cedula" type="text" placeholder="cédula / RIF del titular" style="width:100%">
    <input class="form-input" id="sa-pay-cuenta" type="text" placeholder="número de cuenta (opcional)" style="width:100%">

    <button onclick="savePaymentData()" style="background:var(--lime);color:var(--lime-ink);border:none;border-radius:13px;padding:14px;font-family:var(--font);font-size:14px;font-weight:800;cursor:pointer;transition:all .15s;margin-top:4px" onmousedown="this.style.transform='scale(.98)'" onmouseup="this.style.transform='scale(1)'">guardar datos de pago</button>

    <div style="height:1px;background:var(--border);margin:4px 0"></div>

    <!-- [V135] banner 16:9 arriba del selector de plan — simple contenedor
         de foto (ej. "código gratis del día"). Vacío = no se muestra. -->
    <div style="font-size:12px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.5px">banner del selector de plan</div>
    <input type="file" id="sa-pricing-banner-file" accept="image/*" style="display:none" onchange="_saUploadPricingBanner(this)">
    <div id="sa-pricing-banner-preview" onclick="document.getElementById('sa-pricing-banner-file').click()" style="width:100%;aspect-ratio:16/9;background:var(--card);border:1.5px dashed var(--border);border-radius:14px;display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden">
      <span style="font-size:13px;color:var(--muted)">toca para subir (ej. "código gratis del día")</span>
    </div>
    <button onclick="_saRemovePricingBanner()" style="background:rgba(255,60,60,.08);border:1px solid rgba(255,80,80,.2);border-radius:12px;padding:11px;font-family:var(--font);font-size:12.5px;font-weight:700;color:rgba(255,100,100,.85);cursor:pointer">quitar banner</button>

    <div style="height:1px;background:var(--border);margin:4px 0"></div>

    <!-- PENDING PAYMENTS -->
    <div style="font-size:12px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.5px">referencias pendientes de confirmación</div>
    <div id="sa-pending-refs" style="display:flex;flex-direction:column;gap:8px"></div>
  </div>

  <!-- BYPASS TAB -->
  <div id="sa-acceso" style="display:none;padding:18px 18px 100px;flex-direction:column;gap:12px">
    <div style="font-size:13px;color:var(--muted);font-weight:300">comprobantes de hold de compradores · revisa y envía el código de acceso de la subasta.</div>
    <div id="sa-access-list" style="display:flex;flex-direction:column;gap:14px"></div>
  </div>
  <div id="sa-aucodigos" style="display:none;padding:18px 18px 100px;flex-direction:column;gap:12px">
    <div style="font-size:13px;color:var(--muted);font-weight:300">cada subasta tiene su código de acceso. cópialo para entregarlo, o regenéralo.</div>
    <div id="sa-aucodes-list" style="display:flex;flex-direction:column;gap:10px"></div>
  </div>
  <div id="sa-kyc" style="display:none;padding:18px 18px 100px;flex-direction:column;gap:12px">
    <div style="font-size:13px;color:var(--muted);font-weight:300">solicitudes de verificación pendientes · compara el nombre registrado con la cédula de las fotos.</div>
    <div id="sa-kyc-list" style="display:flex;flex-direction:column;gap:14px"></div>
  </div>
  <div id="sa-bypass" style="display:none;padding:18px 18px 100px;display:none;flex-direction:column;gap:12px">
    <p style="font-size:13px;color:var(--muted);margin-bottom:8px">acceso directo para testing sin pasar por pagos.</p>
    <button onclick="bypassPublicacion()" style="background:var(--card);border:1px solid var(--border);border-radius:13px;padding:15px;font-family:var(--font);font-size:14px;font-weight:700;color:var(--white);cursor:pointer;transition:all .15s;text-align:left;display:flex;align-items:center;justify-content:space-between">
      crear publicación (market)<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M7 17L17 7M7 7h10v10"/></svg>
    </button>
    <button onclick="bypassSubasta()" style="background:var(--card);border:1px solid var(--border);border-radius:13px;padding:15px;font-family:var(--font);font-size:14px;font-weight:700;color:var(--white);cursor:pointer;transition:all .15s;text-align:left;display:flex;align-items:center;justify-content:space-between">
      crear subasta directa<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M7 17L17 7M7 7h10v10"/></svg>
    </button>
    <div style="height:1px;background:var(--border);margin:4px 0"></div>
    <p style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.5px">simular roles</p>
    <button onclick="simularRol('consesionario',true)" style="background:rgba(8,68,26,.08);border:1px solid rgba(8,68,26,.2);border-radius:13px;padding:14px 15px;font-family:var(--font);font-size:14px;font-weight:700;color:#08441A;cursor:pointer;text-align:left;display:flex;align-items:center;justify-content:space-between">
      concesionario — vitrina activa<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M7 17L17 7M7 7h10v10"/></svg>
    </button>
    <button onclick="simularRol('consesionario',false)" style="background:var(--w4);border:1px solid var(--w10);border-radius:13px;padding:14px 15px;font-family:var(--font);font-size:14px;font-weight:700;color:var(--w60);cursor:pointer;text-align:left;display:flex;align-items:center;justify-content:space-between">
      concesionario — vitrina inactiva<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M7 17L17 7M7 7h10v10"/></svg>
    </button>
    <button onclick="simularRol('particular',false)" style="background:var(--w4);border:1px solid var(--w10);border-radius:13px;padding:14px 15px;font-family:var(--font);font-size:14px;font-weight:700;color:var(--w60);cursor:pointer;text-align:left;display:flex;align-items:center;justify-content:space-between">
      particular<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M7 17L17 7M7 7h10v10"/></svg>
    </button>

    <!-- ═══ DIAGNÓSTICO DB ═══ -->
    <div style="height:1px;background:var(--border);margin:8px 0"></div>
    <p style="font-size:11px;color:rgba(255,170,0,.8);font-weight:700;text-transform:uppercase;letter-spacing:.5px">🔧 diagnóstico DB</p>
    <button onclick="dbDiagnostico()" style="background:rgba(255,170,0,.08);border:1px solid rgba(255,170,0,.25);border-radius:13px;padding:14px 15px;font-family:var(--font);font-size:13px;font-weight:700;color:#ffaa00;cursor:pointer;text-align:left">
      ver estado real del DB
    </button>
    <button onclick="dbTestInsert()" style="background:rgba(255,170,0,.05);border:1px solid rgba(255,170,0,.15);border-radius:13px;padding:14px 15px;font-family:var(--font);font-size:13px;font-weight:700;color:rgba(255,170,0,.7);cursor:pointer;text-align:left">
      test: insertar publicación de prueba
    </button>
    <div id="sa-diag-output" style="background:rgba(0,0,0,.4);border:1px solid var(--w8);border-radius:13px;padding:14px;font-family:monospace;font-size:11px;color:var(--w70);white-space:pre-wrap;word-break:break-all;display:none;max-height:300px;overflow-y:auto;line-height:1.5"></div>
  </div>
  <!-- COMUNIDAD TAB -->
  <div id="sa-comunidad" style="display:none;flex-direction:column;padding:18px 18px 100px;gap:28px">

    <!-- CLIPS -->
    <div>
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--muted);margin-bottom:14px">Ruedda Clips</div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px">
        <input class="form-input" id="sa-clip-url" type="url" placeholder="link del reel (Instagram o YouTube)">
        <div style="display:flex;gap:8px">
          <input class="form-input" id="sa-clip-thumb" type="url" placeholder="portada (sube una imagen →)" style="flex:1" readonly>
          <button onclick="document.getElementById('sa-clip-thumb-file').click()" style="flex-shrink:0;background:var(--card);color:var(--white);border:1px solid var(--border);border-radius:12px;font-size:12px;font-weight:700;padding:0 14px;cursor:pointer;font-family:var(--font);white-space:nowrap" id="sa-fetch-thumb-btn">subir portada</button>
          <input type="file" id="sa-clip-thumb-file" accept="image/*" style="display:none" onchange="saUploadClipThumb(this)">
        </div>
        <button onclick="saAddClip()" style="background:var(--lime);color:var(--lime-ink);border:none;border-radius:12px;font-size:13px;font-weight:800;padding:12px 18px;cursor:pointer;font-family:var(--font)">añadir clip</button>
      </div>
      <div id="sa-clips-list" style="display:flex;flex-direction:column;gap:8px">
        <div style="font-size:13px;color:var(--muted)">cargando clips...</div>
      </div>
    </div>

    <div style="height:1px;background:var(--border)"></div>

    <!-- NOTICIAS -->
    <div>
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--muted);margin-bottom:14px">Nueva noticia</div>
      <input class="form-input" id="sa-noticia-titulo" type="text" placeholder="título de la noticia" style="margin-bottom:10px">
      <input class="form-input" id="sa-noticia-autor" type="text" placeholder="firma  (ej: - Enrique, Ruedda)" style="margin-bottom:10px">
      <input type="file" id="sa-noticia-img-input" accept="image/*" style="display:none" onchange="previewNoticiaImg(this)">
      <div id="sa-noticia-preview" onclick="document.getElementById('sa-noticia-img-input').click()" style="width:100%;aspect-ratio:16/9;background:var(--card);border:1.5px dashed var(--border);border-radius:14px;display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;margin-bottom:12px">
        <span style="font-size:13px;color:var(--muted)">toca para subir banner</span>
      </div>
      <textarea id="sa-noticia-content" placeholder="cuerpo de la noticia..." style="width:100%;background:var(--card);border:1px solid var(--border);border-radius:13px;color:var(--white);font-size:14px;padding:14px;resize:none;font-family:var(--font);box-sizing:border-box;height:120px;line-height:1.6;margin-bottom:10px"></textarea>
      <button onclick="saAddNoticia()" style="width:100%;background:var(--lime);color:var(--lime-ink);border:none;border-radius:13px;font-size:14px;font-weight:800;padding:14px;cursor:pointer;font-family:var(--font)">publicar noticia</button>
      <div id="sa-noticias-list" style="display:flex;flex-direction:column;gap:8px;margin-top:16px">
        <div style="font-size:13px;color:var(--muted)">cargando noticias...</div>
      </div>
    </div>

    <div style="height:1px;background:var(--border)"></div>

    <!-- SUGERENCIAS -->
    <div>
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--muted);margin-bottom:14px">Buzón de sugerencias</div>
      <div id="sa-sugerencias-list" style="display:flex;flex-direction:column;gap:8px">
        <div style="font-size:13px;color:var(--muted)">cargando...</div>
      </div>
    </div>

  </div>

  <!-- PUBLICACIONES -->
  <!-- [FIX] LOGOS DE MARCAS — 56 marcas de MARCAS_LIST, ninguna se puede quedar
       fuera. Lista compacta (no cards grandes, sería demasiado scroll) con
       thumbnail + botón de subida por fila. -->
  <div id="sa-logos" style="display:none;flex-direction:column;padding:18px 18px 100px;gap:14px">
    <div style="font-size:17px;font-weight:800;letter-spacing:-.3px;margin-bottom:4px">Logos de marcas</div>
    <div style="font-size:13px;color:var(--muted);margin-bottom:4px">Sube el logo de cada marca para la vista "Marcas". Se ven en la app apenas se suben, carga suave automática.</div>
    <input type="text" id="sa-logos-search" placeholder="buscar marca..." oninput="saLoadMarcaLogos(this.value)" style="background:var(--w5);border:1px solid var(--w10);border-radius:12px;padding:12px 14px;font-family:var(--font);font-size:14px;color:var(--white);outline:none;box-sizing:border-box">
    <div id="sa-logos-list" style="display:flex;flex-direction:column;gap:8px">
      <div style="text-align:center;padding:30px;color:var(--w30);font-size:13px">cargando...</div>
    </div>
  </div>

  <!-- [comparativa de precios] data que alimenta el chart del detalle de market. súper simple:
       marca+modelo + un JSON con los rangos. sin entrada acá, el chart no aparece en la app — no rompe nada. -->
  <div id="sa-comparativa" style="display:none;flex-direction:column;padding:18px 18px 100px;gap:14px">
    <div style="font-size:17px;font-weight:800;letter-spacing:-.3px;margin-bottom:4px">Comparativa de precios</div>
    <div style="font-size:13px;color:var(--muted);margin-bottom:4px">Alimenta el chart que aparece en el detalle de cada publicación de market (no subastas), entre especificaciones y descripción. Se busca por marca+modelo exacto. Si no hay entrada cargada para esa combinación, el chart simplemente no se muestra.</div>
    <input type="text" id="sa-cmp-marca" placeholder="marca (ej. toyota)" style="background:var(--w5);border:1px solid var(--w10);border-radius:12px;padding:12px 14px;font-family:var(--font);font-size:14px;color:var(--white);outline:none;box-sizing:border-box">
    <input type="text" id="sa-cmp-modelo" placeholder="modelo (ej. corolla)" style="background:var(--w5);border:1px solid var(--w10);border-radius:12px;padding:12px 14px;font-family:var(--font);font-size:14px;color:var(--white);outline:none;box-sizing:border-box">
    <textarea id="sa-cmp-payload" rows="8" placeholder='{"3m":{"p":[13500,13700,14200],"labels":["may","jun","jul"]},"6m":{"p":[13350,13500,13800,14200],"labels":["mar","may","jul","ago"]}}' style="background:var(--w5);border:1px solid var(--w10);border-radius:12px;padding:12px 14px;font-family:monospace;font-size:12px;color:var(--white);outline:none;resize:vertical;box-sizing:border-box;line-height:1.5"></textarea>
    <div style="font-size:11px;color:var(--w30);line-height:1.5">rangos válidos: 3m, 6m, 1a, 3a, 5a, cada uno con "p" (array de precios) y "labels" (array de textos del eje, mismo largo que "p"). solo hace falta llenar los rangos que quieras mostrar; los demás se ocultan solos.</div>
    <button onclick="saSaveComparativa()" style="width:100%;background:var(--lime);color:var(--lime-ink);border:none;border-radius:13px;padding:15px;font-family:var(--font);font-size:15px;font-weight:800;cursor:pointer">guardar</button>
    <div style="font-size:13px;font-weight:700;color:var(--w40);margin-top:10px;text-transform:uppercase;letter-spacing:.4px">entradas cargadas</div>
    <div id="sa-cmp-list" style="display:flex;flex-direction:column;gap:8px">
      <div style="text-align:center;padding:20px;color:var(--w30);font-size:13px">cargando...</div>
    </div>
  </div>

  <!-- [Criterio Ruedda] activación manual del medidor mientras el motor de
       tasación no esté deployado — publicación por publicación, mismos campos
       que escribiría el motor automático (pme_usd/pme_delta/pme_classification/
       pme_confianza), pme_basado_en queda como 'manual'. -->
  <div id="sa-criterio" style="display:none;flex-direction:column;padding:18px 18px 100px;gap:14px">
    <div style="font-size:17px;font-weight:800;letter-spacing:-.3px;margin-bottom:4px">Criterio Ruedda</div>
    <div style="font-size:13px;color:var(--muted);margin-bottom:4px">Mientras el motor automático no esté deployado, acá activas el medidor a mano por publicación. Toca una fila, pon el precio estimado y guarda — el comprador ve el mismo chip que si lo hubiera calculado el motor.</div>
    <div style="display:flex;gap:8px;margin-bottom:4px">
      <button onclick="saLoadCriterioList('listings')" id="sa-crit-tab-listings" style="flex:1;background:rgba(8,68,26,.15);border:1px solid rgba(8,68,26,.3);border-radius:10px;padding:9px;font-family:var(--font);font-size:12px;font-weight:700;color:#08441A;cursor:pointer">market</button>
      <button onclick="saLoadCriterioList('auctions')" id="sa-crit-tab-auctions" style="flex:1;background:var(--w5);border:1px solid var(--border);border-radius:10px;padding:9px;font-family:var(--font);font-size:12px;font-weight:700;color:var(--w50);cursor:pointer">subastas</button>
    </div>
    <div id="sa-crit-list" style="display:flex;flex-direction:column;gap:8px">
      <div style="text-align:center;padding:30px;color:var(--w30);font-size:13px">cargando...</div>
    </div>
  </div>

  <!-- [foto portada landing] reemplaza el SVG del carro del hero (desktop) por una
       foto real, mismo patrón app_settings key/value + crossfade que fotógrafos/encuentra. -->
  <div id="sa-portada" style="display:none;flex-direction:column;padding:18px 18px 100px;gap:14px">
    <div style="font-size:17px;font-weight:800;letter-spacing:-.3px;margin-bottom:4px">Foto de portada — landing</div>
    <div style="font-size:13px;color:var(--muted);margin-bottom:10px">Reemplaza el dibujo del carro en el hero de la página de inicio (desktop) por una foto real. Toca el cuadro para subir.</div>
    <div style="max-width:320px">
      <div id="sa-portada-preview" onclick="document.getElementById('sa-portada-file').click()" style="width:100%;aspect-ratio:16/9;border-radius:16px;background:var(--card);border:1.5px dashed rgba(8,68,26,.4);display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;color:var(--w30)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" style="width:26px;height:26px"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>
      </div>
      <input type="file" id="sa-portada-file" accept="image/*" style="display:none" onchange="saUploadLandingPortada(this)">
    </div>
  </div>

  <div id="sa-documentos" style="display:none;flex-direction:column;padding:18px 18px 100px;gap:14px">
    <div style="font-size:17px;font-weight:800;letter-spacing:-.3px;margin-bottom:4px">Documentos · verificación "Auditado por Ruedda"</div>
    <div style="font-size:13px;color:var(--muted);margin-bottom:4px">Revisa los documentos contra las fotos del vehículo. Si apruebas, el card se lleva el sello. Si niegas, no pasa nada, simplemente no lo obtiene.</div>
    <div id="sa-doc-list" style="display:flex;flex-direction:column;gap:14px">
      <div style="text-align:center;padding:30px;color:var(--w30);font-size:13px">cargando...</div>
    </div>
  </div>

  <!-- [CONS HUB v1] SOLICITUDES — "solicita tu carro" + "ser partner" -->
  <div id="sa-solicitudes" style="display:none;flex-direction:column;padding:18px 18px 100px;gap:14px">
    <div style="font-size:17px;font-weight:800;letter-spacing:-.3px;margin-bottom:4px">Solicitudes</div>
    <div style="font-size:13px;color:var(--muted);margin-bottom:4px">Leads de "solicita tu carro" y "ser partner" que llegan desde la sección concesionarios.</div>
    <div style="display:flex;gap:8px;margin-bottom:4px">
      <button onclick="saLoadSolicitudes('car')" id="sa-sol-tab-car" style="flex:1;background:rgba(8,68,26,.15);border:1px solid rgba(8,68,26,.3);border-radius:10px;padding:9px;font-family:var(--font);font-size:12px;font-weight:700;color:#08441A;cursor:pointer">solicita tu carro</button>
      <button onclick="saLoadSolicitudes('partner')" id="sa-sol-tab-partner" style="flex:1;background:var(--w5);border:1px solid var(--border);border-radius:10px;padding:9px;font-family:var(--font);font-size:12px;font-weight:700;color:var(--w50);cursor:pointer">ser partner</button>
      <button onclick="saLoadSolicitudes('publicar')" id="sa-sol-tab-publicar" style="flex:1;background:var(--w5);border:1px solid var(--border);border-radius:10px;padding:9px;font-family:var(--font);font-size:12px;font-weight:700;color:var(--w50);cursor:pointer">publicar por ti</button>
    </div>
    <div id="sa-sol-list" style="display:flex;flex-direction:column;gap:10px">
      <div style="text-align:center;padding:30px;color:var(--w30);font-size:13px">cargando...</div>
    </div>
  </div>

  <div id="sa-publicaciones" style="display:none;flex-direction:column;padding:18px 18px 100px;gap:14px">
    <div style="font-size:17px;font-weight:800;letter-spacing:-.3px;margin-bottom:4px">Gestor Global</div>
    <div style="font-size:13px;color:var(--muted);margin-bottom:4px">Todas las publicaciones de la plataforma.</div>
    <div style="display:flex;gap:8px;margin-bottom:4px">
      <button onclick="saLoadPublicaciones('listings')" id="sa-pub-tab-listings" style="flex:1;background:rgba(8,68,26,.15);border:1px solid rgba(8,68,26,.3);border-radius:10px;padding:9px;font-family:var(--font);font-size:12px;font-weight:700;color:#08441A;cursor:pointer">market</button>
      <button onclick="saLoadPublicaciones('auctions')" id="sa-pub-tab-auctions" style="flex:1;background:var(--w5);border:1px solid var(--border);border-radius:10px;padding:9px;font-family:var(--font);font-size:12px;font-weight:700;color:var(--w50);cursor:pointer">subastas</button>
      <button onclick="saLoadPublicaciones('rentals')" id="sa-pub-tab-rentals" style="flex:1;background:var(--w5);border:1px solid var(--border);border-radius:10px;padding:9px;font-family:var(--font);font-size:12px;font-weight:700;color:var(--w50);cursor:pointer">alquileres</button>
    </div>
    <!-- [subir aprobadas huérfanas] publicaciones que SuperAdmin aprobó pero el
         dueño nunca tocó "subir" en mis publicaciones — quedan en estado='aprobada'
         invisibles para siempre. Este botón las activa directo (bypass del checkout
         del dueño), en lotes chicos y secuenciales para no repetir la carga pesada
         que rompió el market la vez pasada. Opera sobre la tabla que esté activa
         en el toggle de arriba (market/subastas). -->
    <button onclick="saSubirAprobadas()" id="sa-pub-subir-btn" style="width:100%;background:rgba(8,68,26,.1);border:1px solid rgba(8,68,26,.25);border-radius:10px;padding:10px;font-family:var(--font);font-size:12px;font-weight:700;color:#08441A;cursor:pointer;margin-bottom:2px">⬆ subir aprobadas que el dueño nunca subió</button>
    <div id="sa-pub-list" style="display:flex;flex-direction:column;gap:8px">
      <div style="text-align:center;padding:30px;color:var(--w30);font-size:13px">cargando...</div>
    </div>
  </div>

  <!-- RUEDDA TEAM -->
  <div id="sa-mensajes" style="display:none;flex-direction:column;padding:18px 18px 100px;gap:28px">
    <div>
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--muted);margin-bottom:14px">foto del canal Ruedda Team</div>
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:4px">
        <div id="sa-rtm-avatar-preview" onclick="document.getElementById('sa-rtm-avatar-file').click()" style="width:56px;height:56px;border-radius:50%;background:var(--card);border:1.5px solid rgba(8,68,26,.4);display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;flex-shrink:0;font-weight:800;color:#08441A">R</div>
        <input type="file" id="sa-rtm-avatar-file" accept="image/*" style="display:none" onchange="saUploadRueddaTeamAvatar(this)">
        <div style="font-size:12px;color:var(--muted);line-height:1.5">toca el círculo para subir<br>una foto nueva</div>
      </div>
    </div>

    <div style="height:1px;background:var(--border)"></div>

    <div>
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--muted);margin-bottom:14px">mensaje global a todos los usuarios</div>
      <textarea id="sa-rtm-body" placeholder="escribe el anuncio..." style="width:100%;background:var(--card);border:1px solid var(--border);border-radius:13px;color:var(--white);font-size:14px;padding:14px;resize:none;font-family:var(--font);box-sizing:border-box;height:100px;line-height:1.6;margin-bottom:10px"></textarea>
      <button onclick="saSendRueddaTeamMessage()" style="width:100%;background:var(--lime);color:var(--lime-ink);border:none;border-radius:13px;font-size:14px;font-weight:800;padding:14px;cursor:pointer;font-family:var(--font)">enviar a todos</button>
      <div id="sa-rtm-list" style="display:flex;flex-direction:column;gap:8px;margin-top:16px">
        <div style="font-size:13px;color:var(--muted)">cargando anuncios...</div>
      </div>
    </div>
  </div>
    <div style="font-size:17px;font-weight:800;letter-spacing:-.3px;margin-bottom:4px">Patrocinantes</div>
    <div style="font-size:13px;color:var(--muted);margin-bottom:8px">Gestiona los patrocinantes por categoría. La categoría "market" es el banner rotativo que aparece arriba del market. Las demás son de RueddaExtra. Cada card puede tener imagen, nombre y link.</div>
    <div id="sa-pat-content" style="display:flex;flex-direction:column;gap:14px">
      <div style="font-size:13px;color:var(--muted)">cargando...</div>
    </div>

    <div style="height:1px;background:var(--border);margin:22px 0"></div>

    <div style="height:1px;background:var(--border);margin:22px 0"></div>

    <!-- [CONS HUB v1] banner 16:9 de la sección "concesionarios" — misma mecánica
         bucket 'assets' + app_settings key/value que el resto de este panel. -->
    <div style="font-size:17px;font-weight:800;letter-spacing:-.3px;margin-bottom:4px">Concesionarios · banner</div>
    <div style="font-size:13px;color:var(--muted);margin-bottom:8px">Foto 16:9 horizontal del banner patrocinante que aparece arriba en la sección "concesionarios". Toca para subir.</div>
    <div id="sa-cons-banner-preview" onclick="document.getElementById('sa-cons-banner-file').click()" style="width:100%;aspect-ratio:16/9;border-radius:16px;background:var(--card);border:1.5px dashed rgba(8,68,26,.4);display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;color:var(--w30)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" style="width:26px;height:26px"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>
    </div>
    <input type="file" id="sa-cons-banner-file" accept="image/*" style="display:none" onchange="_saUploadConsBanner(this)">

    <div style="height:1px;background:var(--border);margin:22px 0"></div>

    <!-- [ENCUENTRA] fotos de "Busca por marcas" y "Red post-venta" — submenu debajo
         de hot deals en Market. Mismo patrón exacto que la foto del canal Ruedda
         Team (bucket 'assets' + app_settings key/value), sin inventar un sistema
         nuevo. El fade-in suave (foto, no la card) lo hace el cliente en
         _encuentraSetPhoto() cuando el usuario vuelve a Market. -->
    <div style="font-size:17px;font-weight:800;letter-spacing:-.3px;margin-bottom:4px">Encuentra · fotos</div>
    <div style="font-size:13px;color:var(--muted);margin-bottom:8px">Fotos de los accesos "Agencias", "Busca por marcas" y "Red post-venta" del submenu Encuentra en Market. Toca el cuadro para subir.</div>
    <div style="display:flex;gap:14px">
      <div style="flex:1;text-align:center">
        <div id="sa-enc-agencias-preview" onclick="document.getElementById('sa-enc-agencias-file').click()" style="width:100%;aspect-ratio:1/1;border-radius:16px;background:var(--card);border:1.5px dashed rgba(8,68,26,.4);display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;color:var(--w30)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" style="width:26px;height:26px"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>
        </div>
        <input type="file" id="sa-enc-agencias-file" accept="image/*" style="display:none" onchange="_saUploadEncuentraPhoto(this,'agencias')">
        <div style="font-size:11.5px;color:var(--muted);margin-top:8px">agencias</div>
      </div>
      <div style="flex:1;text-align:center">
        <div id="sa-enc-marcas-preview" onclick="document.getElementById('sa-enc-marcas-file').click()" style="width:100%;aspect-ratio:1/1;border-radius:16px;background:var(--card);border:1.5px dashed rgba(8,68,26,.4);display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;color:var(--w30)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" style="width:26px;height:26px"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>
        </div>
        <input type="file" id="sa-enc-marcas-file" accept="image/*" style="display:none" onchange="_saUploadEncuentraPhoto(this,'marcas')">
        <div style="font-size:11.5px;color:var(--muted);margin-top:8px">busca por marcas</div>
      </div>
      <div style="flex:1;text-align:center">
        <div id="sa-enc-postventa-preview" onclick="document.getElementById('sa-enc-postventa-file').click()" style="width:100%;aspect-ratio:1/1;border-radius:16px;background:var(--card);border:1.5px dashed rgba(8,68,26,.4);display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;color:var(--w30)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" style="width:26px;height:26px"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>
        </div>
        <input type="file" id="sa-enc-postventa-file" accept="image/*" style="display:none" onchange="_saUploadEncuentraPhoto(this,'postventa')">
        <div style="font-size:11.5px;color:var(--muted);margin-top:8px">red post-venta</div>
      </div>
    </div>
    <!-- [RC] fila 2 — Comunidad y Subastas ahora también son contenedores de foto -->
    <div style="display:flex;gap:14px;margin-top:14px">
      <div style="flex:1;text-align:center">
        <div id="sa-enc-comunidad-preview" onclick="document.getElementById('sa-enc-comunidad-file').click()" style="width:100%;aspect-ratio:1/1;border-radius:16px;background:var(--card);border:1.5px dashed rgba(8,68,26,.4);display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;color:var(--w30)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" style="width:26px;height:26px"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>
        </div>
        <input type="file" id="sa-enc-comunidad-file" accept="image/*" style="display:none" onchange="_saUploadEncuentraPhoto(this,'comunidad')">
        <div style="font-size:11.5px;color:var(--muted);margin-top:8px">comunidad</div>
      </div>
      <div style="flex:1;text-align:center">
        <div id="sa-enc-subastas-preview" onclick="document.getElementById('sa-enc-subastas-file').click()" style="width:100%;aspect-ratio:1/1;border-radius:16px;background:var(--card);border:1.5px dashed rgba(8,68,26,.4);display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;color:var(--w30)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" style="width:26px;height:26px"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>
        </div>
        <input type="file" id="sa-enc-subastas-file" accept="image/*" style="display:none" onchange="_saUploadEncuentraPhoto(this,'subastas')">
        <div style="font-size:11.5px;color:var(--muted);margin-top:8px">subastas</div>
      </div>
      <div style="flex:1;text-align:center">
        <div id="sa-enc-repuestos-preview" onclick="document.getElementById('sa-enc-repuestos-file').click()" style="width:100%;aspect-ratio:1/1;border-radius:16px;background:var(--card);border:1.5px dashed rgba(8,68,26,.4);display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;color:var(--w30)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" style="width:26px;height:26px"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>
        </div>
        <input type="file" id="sa-enc-repuestos-file" accept="image/*" style="display:none" onchange="_saUploadEncuentraPhoto(this,'repuestos')">
        <div style="font-size:11.5px;color:var(--muted);margin-top:8px">repuestos</div>
      </div>
    </div>
    <!-- [RC] fila 3 — Alquileres e Importaciones -->
    <div style="display:flex;gap:14px;margin-top:14px">
      <div style="flex:1;text-align:center">
        <div id="sa-enc-alquileres-preview" onclick="document.getElementById('sa-enc-alquileres-file').click()" style="width:100%;aspect-ratio:1/1;border-radius:16px;background:var(--card);border:1.5px dashed rgba(8,68,26,.4);display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;color:var(--w30)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" style="width:26px;height:26px"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>
        </div>
        <input type="file" id="sa-enc-alquileres-file" accept="image/*" style="display:none" onchange="_saUploadEncuentraPhoto(this,'alquileres')">
        <div style="font-size:11.5px;color:var(--muted);margin-top:8px">alquileres</div>
      </div>
      <div style="flex:1;text-align:center">
        <div id="sa-enc-importaciones-preview" onclick="document.getElementById('sa-enc-importaciones-file').click()" style="width:100%;aspect-ratio:1/1;border-radius:16px;background:var(--card);border:1.5px dashed rgba(8,68,26,.4);display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;color:var(--w30)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" style="width:26px;height:26px"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>
        </div>
        <input type="file" id="sa-enc-importaciones-file" accept="image/*" style="display:none" onchange="_saUploadEncuentraPhoto(this,'importaciones')">
        <div style="font-size:11.5px;color:var(--muted);margin-top:8px">importaciones</div>
      </div>
      <div style="flex:1"></div>
    </div>

    <div style="height:1px;background:var(--border);margin:22px 0"></div>

    <!-- [RC] Fotógrafos — cover 4:3, mismo patrón app_settings key/value + crossfade -->
    <div style="font-size:17px;font-weight:800;letter-spacing:-.3px;margin-bottom:4px">Fotógrafos — foto de portada</div>
    <div style="font-size:13px;color:var(--muted);margin-bottom:10px">Foto 4:3 que aparece al tope de la vista "fotógrafos disponibles". Toca el cuadro para subir.</div>
    <div style="max-width:220px">
      <div id="sa-fotografos-cover-preview" onclick="document.getElementById('sa-fotografos-cover-file').click()" style="width:100%;aspect-ratio:4/3;border-radius:16px;background:var(--card);border:1.5px dashed rgba(8,68,26,.4);display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;color:var(--w30)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" style="width:26px;height:26px"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>
      </div>
      <input type="file" id="sa-fotografos-cover-file" accept="image/*" style="display:none" onchange="_saUploadFotografosCover(this)">
    </div>

    <div style="height:1px;background:var(--border);margin:22px 0"></div>

    <!-- [RC] ORDEN DE ENCUENTRA — arrastra para reordenar los cards del submenu.
         Persiste como JSON en app_settings (encuentra_order); el cliente lo
         aplica moviendo nodos por data-enc, sin re-render. Pointer events =
         funciona igual con mouse y touch. -->
    <div style="font-size:17px;font-weight:800;letter-spacing:-.3px;margin-bottom:4px">Encuentra · orden</div>
    <div style="font-size:13px;color:var(--muted);margin-bottom:10px">Arrastra los cards para reordenar cómo aparecen en Market. Se guarda automáticamente al soltar.</div>
    <div id="sa-enc-order-list" style="display:flex;flex-direction:column;gap:8px"></div>

    <div style="height:1px;background:var(--border);margin:22px 0"></div>

    <!-- [XP/NIVELES] insignia por nivel — PNG/SVG ultra ligero. Los 16 niveles
         ya existen (tabla user_levels, migración 20260816000002_xp_levels.sql);
         acá solo se sube la imagen, mismo patrón upsert-por-key que marca_logos.
         Aparece junto al nombre al abrir un perfil y en "usuarios top". -->
    <div style="font-size:17px;font-weight:800;letter-spacing:-.3px;margin-bottom:4px">Insignias por nivel</div>
    <div style="font-size:13px;color:var(--muted);margin-bottom:10px">Una insignia por cada nivel del sistema de XP. Sube PNG o SVG ultra liviano, toca el cuadro.</div>
    <div id="sa-levels-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px"></div>
  </div>`;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── rama GET: fragmento del panel SuperAdmin, aislada del flujo POST ──
  if (req.method === 'GET') {
    if (req.query.panel !== '1') return res.status(404).json({ error: 'not found' });
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'no autenticado' });
    const admin = await isSuperadmin(user.id);
    if (!admin) return res.status(403).json({ error: 'acceso denegado' });
    // index.html y desktop.html tienen paneles admin LIGERAMENTE distintos
    // (mobile trae la pestaña "eventos", desktop trae "portada") -- cada
    // frontend pide el suyo con ?client=mobile|desktop, nunca se mezclan.
    const panelHtml = req.query.client === 'desktop' ? ADMIN_PANEL_HTML_DESKTOP : ADMIN_PANEL_HTML_MOBILE;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, private');
    return res.status(200).send(panelHtml);
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  try {
    // Parse body — Vercel puede no parsear automáticamente
    let body = req.body;
    if (typeof body === 'string') { try{ body=JSON.parse(body); }catch(_){ body={}; } }
    if (!body) body = {};

    // 1. Auth + rol
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'no autenticado' });
    const admin = await isSuperadmin(user.id);
    if (!admin) return res.status(403).json({ error: 'acceso denegado' });

    const { item_id, item_type, action } = body;
    if (!item_id || !['listing', 'auction'].includes(item_type) || !['aprobar', 'rechazar'].includes(action)) {
      return res.status(400).json({ error: 'parámetros inválidos' });
    }

    const tabla = item_type === 'listing' ? 'listings' : 'auctions';
    const nuevoEstado = action === 'aprobar' ? 'activa' : 'rechazada';

    // 2. Leer item para obtener user_id
    const { data: item, error: fetchErr } = await supabaseAdmin
      .from(tabla)
      .select('id, user_id, titulo, marca, modelo, year, estado')
      .eq('id', item_id)
      .maybeSingle();

    if (fetchErr || !item) return res.status(404).json({ error: 'publicación no encontrada' });

    // Solo moderar items en revisión o pendiente_pago
    if (!['revision', 'pendiente_pago', 'pendiente'].includes(item.estado)) {
      return res.status(409).json({ error: `estado actual: ${item.estado} — no se puede moderar` });
    }

    // 3. Actualizar estado
    const { error: updateErr } = await supabaseAdmin
      .from(tabla)
      .update({ estado: nuevoEstado })
      .eq('id', item_id);

    if (updateErr) {
      console.error('[ruedda mod-listing] update:', updateErr.message);
      return res.status(500).json({ error: 'error al actualizar' });
    }

    // 4. Notificar al usuario (best-effort)
    if (item.user_id) {
      const label = [item.year, item.marca, item.modelo].filter(Boolean).join(' ');
      await supabaseAdmin.from('notifications').insert({
        user_id: item.user_id,
        tipo: action === 'aprobar' ? 'ganador' : 'system',
        titulo: action === 'aprobar' ? '¡Publicación aprobada!' : 'Publicación rechazada',
        body: action === 'aprobar'
          ? `Tu ${label} ya está activa en Ruedda.`
          : 'Tu publicación no cumplió los estándares de Ruedda. Contáctanos por soporte.',
        icon: action === 'aprobar' ? 'lime' : ''
      }).catch(() => {});

      // 5. Correo al dueño (best-effort, no bloquea la respuesta)
      supabaseAdmin
        .from('users')
        .select('email')
        .eq('id', item.user_id)
        .maybeSingle()
        .then(({ data }) => {
          if (!data?.email) return;
          if (action === 'aprobar') {
            sendEmail({
              to: data.email,
              subject: '¡Tu publicación ya está activa en Ruedda!',
              html: layout('Publicación activa', `Tu ${label || 'publicación'} fue aprobada y ya está visible para todos en Ruedda. No necesitas hacer nada más.`)
            });
          } else {
            sendEmail({
              to: data.email,
              subject: 'Tu publicación no fue aprobada',
              html: layout('Publicación rechazada', `Tu ${label || 'publicación'} no cumplió los estándares de Ruedda. Contáctanos por soporte si tienes dudas.`)
            });
          }
        })
        .catch(() => {});
    }

    return res.status(200).json({ ok: true, estado: nuevoEstado });

  } catch (e) {
    console.error('[ruedda mod-listing] catch:', e.message);
    return res.status(500).json({ error: 'error interno' });
  }
};
