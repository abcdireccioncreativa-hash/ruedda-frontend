// lib/emailTemplates.js
// Plantillas de correo transaccional/lifecycle de Ruedda.
// HTML con tablas + estilos en línea a propósito — los clientes de correo
// (Outlook, Gmail app, Apple Mail viejo) no soportan CSS moderno de forma
// confiable, así que nada de flexbox/grid/variables CSS acá.
// Fondo BLANCO a propósito, aunque la app sea oscura: un correo en "modo
// oscuro" se rompe en buena parte de los clientes — la identidad de marca
// va en el logo y el acento negro de los botones, no en el fondo.

const LOGO_URL = 'https://www.ruedda.app/icon-512.png';
const SITE_URL = 'https://www.ruedda.app';
const APP_STORE_URL = 'https://apps.apple.com/app/ruedda-la-app-automotriz/id6812039590';
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif";
const HERO_IMG = SITE_URL + '/email/appstore-hero.jpg';
const UNSUB_URL = 'mailto:contactoruedda@gmail.com?subject=Darme%20de%20baja';

// Plantilla propia (no usa base()) porque el lanzamiento lleva un hero negro
// a sangre y una lista de novedades — mismas reglas de compatibilidad: solo
// tablas y estilos en línea, esquema claro fijo.
function launchLayout({ nombre }) {
  const first = String(nombre || '').trim().split(/\s+/)[0];
  const hi = first ? esc(first) + ', la' : 'La';
  const feature = (t, d) => `<tr><td style="padding:16px 0;border-top:1px solid #efefea">
      <div style="font-size:15px;font-weight:700;color:#0a0a0a;letter-spacing:-.2px;margin-bottom:4px">${t}</div>
      <div style="font-size:14px;line-height:1.6;color:#6b6b66">${d}</div>
    </td></tr>`;
  const button = (label, bg, fg, cls) => `<table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td bgcolor="${bg}" class="${cls}" style="background:${bg};border-radius:14px">
        <a href="${APP_STORE_URL}" style="display:inline-block;background:${bg};color:${fg} !important;font-weight:700;font-size:15px;text-decoration:none;padding:15px 28px;border-radius:14px;font-family:${FONT};letter-spacing:-.1px">${label}</a>
      </td></tr></table>`;
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ruedda ya está en la App Store</title>
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<style>
  :root{ color-scheme: light only; supported-color-schemes: light only; }
  @media (prefers-color-scheme: dark){
    .rd-hero{ background:#0a0a0a !important; }
    .rd-cta-light{ background:#ffffff !important; color:#0a0a0a !important; }
    .rd-cta{ background:#0a0a0a !important; color:#ffffff !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#f4f4f0;font-family:${FONT}">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">La app automotriz de Venezuela, ahora en tu iPhone. Descárgala gratis.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f0;padding:32px 12px">
    <tr><td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:22px;overflow:hidden;max-width:520px;width:100%;border:1px solid #ececE4">

        <tr><td bgcolor="#0a0a0a" style="background:#0a0a0a;padding:0;line-height:0;font-size:0">
          <a href="${APP_STORE_URL}"><img src="${HERO_IMG}" width="520" alt="Ruedda — la app automotriz de Venezuela" style="display:block;width:100%;max-width:520px;height:auto;border:0;border-radius:22px 22px 0 0"></a>
        </td></tr>

        <tr><td bgcolor="#0a0a0a" class="rd-hero" style="background:#0a0a0a;padding:30px 34px 38px">
          <div style="font-size:11px;font-weight:700;letter-spacing:2.2px;color:#8e8e87;text-transform:uppercase;margin-bottom:12px">ya disponible · app store</div>
          <h1 style="margin:0 0 14px;font-size:32px;font-weight:800;letter-spacing:-.8px;color:#ffffff;line-height:1.12">ruedda ya está<br>en tu iPhone.</h1>
          <div style="font-size:15px;line-height:1.6;color:#b9b9b2;margin-bottom:28px">El mercado automotriz de Venezuela, en una app nativa. Gratis.</div>
          ${button('descargar en la App Store', '#ffffff', '#0a0a0a', 'rd-cta-light')}
        </td></tr>

        <tr><td style="padding:34px 34px 6px">
          <div style="font-size:15.5px;line-height:1.7;color:#333">${hi} espera terminó. Todo lo que ya conoces de Ruedda — el market, las subastas y los mejores concesionarios del país — ahora vive en una app hecha para iPhone: más rápida, más fluida y siempre a un toque.</div>
        </td></tr>

        <tr><td style="padding:18px 34px 0">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${feature('las subastas, en tu bolsillo', 'Sigue cada lote en tiempo real y entérate al instante cuando te superan, cuando ganas o cuando está por cerrar.')}
            ${feature('más rápida que nunca', 'La experiencia completa de Ruedda, optimizada para iPhone. Sin pestañas, sin esperas.')}
            ${feature('tu misma cuenta', 'Entra con tu usuario o tu correo de siempre. Tus vehículos, favoritos y mensajes te están esperando.')}
          </table>
        </td></tr>

        <tr><td style="padding:26px 34px 8px">
          ${button('descargar gratis', '#0a0a0a', '#ffffff', 'rd-cta')}
        </td></tr>

        <tr><td style="padding:26px 34px 32px">
          <div style="height:1px;background:#eee;margin-bottom:20px"></div>
          <div style="font-size:11.5px;color:#999;line-height:1.6">Recibes este correo porque tienes una cuenta en Ruedda.<br>Ruedda — la app automotriz de Venezuela · contactoruedda@gmail.com<br><a href="${UNSUB_URL}" style="color:#999;text-decoration:underline">Darme de baja de estos correos</a></div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function base({ preheader = '', title, bodyHtml, ctaLabel, ctaUrl, footerNote = '' }) {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<style>
  /* [fix botón verde en Apple Mail / iOS Mail modo oscuro] sin declarar el
     color-scheme, algunos clientes "adivinan" que un botón casi-negro es
     texto y le aplican SU propio color de acento al invertir para modo
     oscuro — a un usuario le llegó verde en vez de negro. Los meta tags de
     arriba + este bloque (target:.rd-cta) le dicen explícitamente al
     cliente que este correo es de esquema claro fijo, así no reinterpreta
     nada. Se ignora en clientes que no soportan @media, sin romper nada.
  */
  :root{ color-scheme: light only; supported-color-schemes: light only; }
  @media (prefers-color-scheme: dark){
    .rd-cta{ background:#0a0a0a !important; color:#ffffff !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#f4f4f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${esc(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f0;padding:32px 0">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:20px;overflow:hidden;max-width:480px;width:100%;border:1px solid #ececE4">
        <tr><td style="padding:32px 32px 0">
          <img src="${LOGO_URL}" width="36" height="36" alt="Ruedda" style="border-radius:9px;display:block;margin-bottom:20px">
        </td></tr>
        <tr><td style="padding:0 32px">
          <h1 style="margin:0 0 14px;font-size:22px;font-weight:800;letter-spacing:-.3px;color:#0a0a0a;line-height:1.3">${title}</h1>
          <div style="font-size:14.5px;line-height:1.7;color:#444;font-weight:400">${bodyHtml}</div>
        </td></tr>
        ${ctaUrl ? `<tr><td style="padding:26px 32px 4px">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td bgcolor="#0a0a0a" class="rd-cta" style="background:#0a0a0a;border-radius:12px">
              <a href="${ctaUrl}" style="display:inline-block;background:#0a0a0a;color:#ffffff !important;font-weight:700;font-size:14px;text-decoration:none;padding:14px 26px;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">${esc(ctaLabel)}</a>
            </td>
          </tr></table>
        </td></tr>` : ''}
        <tr><td style="padding:28px 32px 32px">
          <div style="height:1px;background:#eee;margin-bottom:20px"></div>
          <div style="font-size:11.5px;color:#999;line-height:1.6">${footerNote || 'Ruedda — el marketplace automotriz más avanzado de Venezuela.'}<br>contactoruedda@gmail.com</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// cada función recibe los datos puntuales que necesita y devuelve {subject, html}
const templates = {

  bienvenida: ({ nombre } = {}) => ({
    subject: `bienvenido a Ruedda${nombre ? ', ' + nombre : ''} 🏁`,
    html: base({
      preheader: 'Ya estás dentro. Compra, vende o subasta tu vehículo con transparencia total.',
      title: `bienvenido${nombre ? ', ' + esc(nombre) : ''}. 🏁`,
      bodyHtml: `Tu cuenta ya está activa. Ruedda es el marketplace automotriz más avanzado de Venezuela — compra, vende y subasta vehículos con transparencia, en tiempo real.<br><br>Para participar en subastas necesitas verificar tu cédula desde tu perfil — toma menos de un minuto.`,
      ctaLabel: 'entrar a Ruedda',
      ctaUrl: SITE_URL
    })
  }),

  resetPassword: ({ actionUrl } = {}) => ({
    subject: 'restablece tu contraseña de Ruedda',
    html: base({
      preheader: 'Pediste restablecer tu contraseña. El enlace vence pronto por tu seguridad.',
      title: 'restablece tu contraseña.',
      bodyHtml: `Pediste restablecer la contraseña de tu cuenta Ruedda. Si fuiste tú, toca el botón de abajo — el enlace vence en un rato, por tu seguridad.<br><br>Si no fuiste tú, ignora este correo: tu contraseña sigue igual y tu cuenta está a salvo.`,
      ctaLabel: 'restablecer contraseña',
      ctaUrl: actionUrl,
      footerNote: 'Si el botón no funciona, copia y pega este enlace en tu navegador:<br>' + actionUrl
    })
  }),

  appDisponible: ({ nombre } = {}) => ({
    subject: 'ya está: Ruedda llegó a la App Store 🏁',
    html: launchLayout({ nombre }),
    // Gmail/Apple Mail muestran su botón nativo de "anular suscripción" con esto
    headers: { 'List-Unsubscribe': '<' + UNSUB_URL + '>' }
  }),

  appProntoLanzamiento: ({ nombre } = {}) => ({
    subject: 'faltan pocos días para la app de Ruedda 🏎️',
    html: base({
      preheader: 'La app nativa de Ruedda para iOS y Android está por llegar.',
      title: `${nombre ? esc(nombre) + ', falta' : 'falta'} poco. 🏎️`,
      bodyHtml: `La app nativa de Ruedda está a días de llegar a la App Store y Google Play — todo lo que ya usas en la web, ahora con notificaciones push, más rápido y siempre a la mano.<br><br>Actívala apenas esté disponible y sé de los primeros en probarla.`,
      ctaLabel: 'ver Ruedda ahora',
      ctaUrl: SITE_URL
    })
  }),

  codigoPublicacionGratis: ({ nombre, codigo = 'RU3DDA' } = {}) => ({
    subject: `un código para publicar gratis en Ruedda 🛞`,
    html: base({
      preheader: `Usa el código ${codigo} y publica tu vehículo sin costo.`,
      title: `${nombre ? esc(nombre) + ', tu' : 'tu'} código de publicación gratis. 🛞`,
      bodyHtml: `Queremos que publiques tu próximo vehículo en Ruedda sin costo. Usa este código al publicar:<br><br>
        <div style="background:#f4f4f0;border:1px dashed #ccc;border-radius:12px;padding:16px;text-align:center;font-size:22px;font-weight:800;letter-spacing:3px;color:#0a0a0a;margin:4px 0 4px">${esc(codigo)}</div>
        <br>Válido por tiempo limitado — publica hoy y llega a compradores reales en todo el país.`,
      ctaLabel: 'publicar mi vehículo',
      ctaUrl: SITE_URL
    })
  }),

  cuentaVerificada: ({ nombre } = {}) => ({
    subject: 'tu cuenta ya está verificada',
    html: base({
      preheader: 'Ya puedes participar en subastas a nivel nacional.',
      title: `${nombre ? esc(nombre) + ', ya' : 'ya'} estás verificado.`,
      bodyHtml: `Tu cédula fue validada. Tu cuenta ahora lleva el sello de verificado junto a tu nombre y ya puedes participar en subastas a nivel nacional.<br><br>Compradores y vendedores confían más en cuentas verificadas — aprovéchalo.`,
      ctaLabel: 'ver subastas activas',
      ctaUrl: SITE_URL
    })
  }),

  nuevaOferta: ({ nombre, vehiculo, monto } = {}) => ({
    subject: `nueva oferta en tu ${vehiculo || 'vehículo'}`,
    html: base({
      preheader: `Recibiste una nueva oferta de ${monto || ''}.`,
      title: 'tienes una nueva oferta.',
      bodyHtml: `${nombre ? esc(nombre) + ', alguien' : 'Alguien'} acaba de ofertar${monto ? ' <strong>' + esc(monto) + '</strong>' : ''} por tu ${esc(vehiculo || 'vehículo')} en subasta.<br><br>Revisa el estado de tu subasta y sigue el conteo en tiempo real.`,
      ctaLabel: 'ver mi subasta',
      ctaUrl: SITE_URL
    })
  }),

  superado: ({ nombre, vehiculo, monto } = {}) => ({
    subject: `te superaron en la puja por ${vehiculo || 'un vehículo'}`,
    html: base({
      preheader: 'Otro postor superó tu oferta. Todavía puedes recuperar el primer lugar.',
      title: 'te superaron en la puja.',
      bodyHtml: `${nombre ? esc(nombre) + ', otro' : 'Otro'} postor acaba de superar tu oferta${monto ? ' con <strong>' + esc(monto) + '</strong>' : ''} por el ${esc(vehiculo || 'vehículo')} que sigues.<br><br>Todavía tienes tiempo de recuperar el primer lugar antes de que cierre.`,
      ctaLabel: 'volver a ofertar',
      ctaUrl: SITE_URL
    })
  }),

  ganasteSubasta: ({ nombre, vehiculo, monto } = {}) => ({
    subject: `ganaste la subasta — ${vehiculo || 'tu vehículo'} 🔑`,
    html: base({
      preheader: 'Felicidades, fuiste el mejor postor.',
      title: 'ganaste la subasta. 🔑',
      bodyHtml: `${nombre ? esc(nombre) + ', felicidades' : 'Felicidades'} — fuiste el mejor postor por el ${esc(vehiculo || 'vehículo')}${monto ? ' con <strong>' + esc(monto) + '</strong>' : ''}.<br><br>Coordina directamente con el vendedor desde Ruedda para cerrar la entrega.`,
      ctaLabel: 'ver detalles y contactar',
      ctaUrl: SITE_URL
    })
  }),

  subastaPorCerrar: ({ nombre, vehiculo, tiempo } = {}) => ({
    subject: `tu subasta de ${vehiculo || 'tu vehículo'} cierra pronto`,
    html: base({
      preheader: 'Quedan pocas horas — revisa el estado de tu subasta.',
      title: 'tu subasta cierra pronto.',
      bodyHtml: `${nombre ? esc(nombre) + ', tu' : 'Tu'} subasta del ${esc(vehiculo || 'vehículo')} cierra en ${esc(tiempo || 'pocas horas')}.<br><br>Revisa las últimas ofertas y prepárate para el cierre.`,
      ctaLabel: 'ver mi subasta',
      ctaUrl: SITE_URL
    })
  }),

  nuevoMensaje: ({ nombre, remitente } = {}) => ({
    subject: `nuevo mensaje${remitente ? ' de ' + remitente : ''} en Ruedda`,
    html: base({
      preheader: 'Tienes un mensaje nuevo esperando respuesta.',
      title: 'tienes un mensaje nuevo.',
      bodyHtml: `${nombre ? esc(nombre) + ', ' : ''}${esc(remitente || 'alguien')} te escribió en Ruedda sobre uno de tus vehículos.<br><br>Responde rápido — los compradores más activos cierran más tratos.`,
      ctaLabel: 'ver mensaje',
      ctaUrl: SITE_URL
    })
  })

};

module.exports = { base, templates, LOGO_URL, SITE_URL };
