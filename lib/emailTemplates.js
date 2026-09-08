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
