/* [2026-10-06] Asistente de soporte Ruedda — se descarga SOLO al abrir la
   vista "soporte" (index.html / desktop.html → _rdLoadSupport). Todo corre
   local: base de conocimiento + buscador por palabras clave, sinónimos y
   tolerancia a errores de tipeo. Sin red, sin IA, sin dependencias.
   Si algo falla, la vista original (correo + WhatsApp) queda visible. */
(function(){
  if(window.RDSupport) return;

  var WA='https://wa.me/584123921048', MAIL='contactoruedda@gmail.com';

  // ── acciones: solo se muestran si la función existe en esta página ──
  function fn(n){ return typeof window[n]==='function'; }
  var ACT={
    vender:{t:'vender mi carro', ok:function(){return fn('openVenderModal');}, run:function(){ window.openVenderModal(); }},
    planes:{t:'ver planes', ok:function(){return fn('openPricingSheet');}, run:function(){ window.pendingVenderType='particular'; window.openPricingSheet(true); }},
    market:{t:'ir al market', ok:function(){return fn('selectSection');}, run:function(){ go('home'); window.selectSection('market'); }},
    subastas:{t:'ir a subastas', ok:function(){return fn('selectSection');}, run:function(){ go('home'); window.selectSection('subastas'); }},
    concesionarios:{t:'ver concesionarios', ok:function(){return fn('selectSection');}, run:function(){ go('home'); window.selectSection('consesionarios'); }},
    kyc:{t:'verificar mi cuenta', ok:function(){return fn('openKycView');}, run:function(){ go('kyc'); window.openKycView(); }},
    config:{t:'abrir configuración', ok:function(){return fn('showView');}, run:function(){ go('configuracion'); }},
    cuenta:{t:'ir a mi cuenta', ok:function(){return fn('showView');}, run:function(){ go('cuenta'); }},
    perfil:{t:'editar mis datos', ok:function(){return fn('openEditProfileModal');}, run:function(){ go('configuracion'); window.openEditProfileModal(); }},
    publico:{t:'ver mi perfil público', ok:function(){return fn('openMiPerfil');}, run:function(){ window.openMiPerfil(); }},
    tutorial:{t:'ver tutorial', ok:function(){return fn('rdOpenTutorialFromConfig');}, run:function(){ window.rdOpenTutorialFromConfig(); }},
    notis:{t:'abrir notificaciones', ok:function(){return fn('showView');}, run:function(){ go('notificaciones'); }},
    favoritos:{t:'ver favoritos', ok:function(){return fn('showView');}, run:function(){ go('favoritos'); }},
    historias:{t:'ver historias', ok:function(){return fn('openStories');}, run:function(){ window.openStories(); }},
    carspotting:{t:'abrir carspotting', ok:function(){return fn('showView');}, run:function(){ go('carspotting'); }},
    alquileres:{t:'ver alquileres', ok:function(){return fn('showView');}, run:function(){ go('alquileres'); }},
    extra:{t:'abrir Ruedda Extra', ok:function(){return fn('showView');}, run:function(){ go('ruedda-extra'); }},
    fotografos:{t:'ver fotógrafos', ok:function(){return fn('showView');}, run:function(){ go('fotografos'); }},
    partners:{t:'ver partners', ok:function(){return fn('openPartnersModal');}, run:function(){ window.openPartnersModal(); }},
    hotdeals:{t:'ver hot deals', ok:function(){return fn('showView');}, run:function(){ go('hotdeals-all'); }},
    marcas:{t:'buscar por marca', ok:function(){return fn('showView');}, run:function(){ go('marcas'); }},
    sugerencias:{t:'enviar sugerencia', ok:function(){return fn('showView');}, run:function(){ go('sugerencias'); }},
    comofunciona:{t:'cómo funciona Ruedda', ok:function(){return fn('showView');}, run:function(){ go('como-funciona'); }},
    importaciones:{t:'ver importaciones', ok:function(){return fn('showView');}, run:function(){ go('importaciones'); }},
    wa:{t:'escribir por WhatsApp', ok:function(){return true;}, href:WA},
    mail:{t:MAIL, ok:function(){return true;}, href:'mailto:'+MAIL}
  };
  function go(v){ try{ window.showView(v); }catch(e){} }

  // ── base de conocimiento ─────────────────────────────────────────────
  // k: palabras clave (ya normalizadas por el motor), q: preguntas modelo,
  // a: respuesta (**negrita**, saltos con \n), x: acciones, t: tema.
  var KB=[
  // GENERAL
  {t:'general',q:['qué es Ruedda','para qué sirve Ruedda','de qué trata la app'],k:['ruedda','que es','app','sirve','trata'],
   a:'Ruedda es el marketplace automotriz de Venezuela: **compra, vende y subasta** carros desde el celular o la web.\n\nAdemás del **market** y las **subastas en tiempo real**, tienes concesionarios verificados, historias, carspotting, alquileres, DealMeter (valoración de precios) y herramientas en **Ruedda Extra**.',x:['comofunciona','market']},
  {t:'general',q:['es gratis','cuánto cuesta usar Ruedda','tengo que pagar para usar la app'],k:['gratis','usar','free','es gratis'],
   a:'Usar Ruedda es **gratis**: buscar, guardar favoritos, comentar, escribir a vendedores y publicar tu carro.\n\nPublicar en el market es gratis por **30 días**. Si quieres vender más rápido o apoyar la app hay planes desde **$2**.',x:['planes']},
  {t:'general',q:['en qué ciudades está Ruedda','funciona en toda Venezuela','hay carros en mi ciudad'],k:['ciudad','ciudades','venezuela','nacional','caracas','valencia','maracaibo','barquisimeto','zona','estado'],
   a:'Ruedda funciona en **toda Venezuela**. Cada publicación muestra su ciudad y en el market puedes **filtrar por ciudad** para ver solo lo que está cerca de ti.',x:['market']},
  {t:'general',q:['dónde descargo la app','hay app para iPhone','hay app para Android','cómo instalo Ruedda'],k:['descargar','instalar','app store','iphone','ios','android','play store','apk','aplicacion'],
   a:'Ruedda está en el **App Store** para iPhone. En Android y en cualquier navegador entra a **ruedda.app** y usa "Agregar a pantalla de inicio": se instala como app, sin barra de navegador.\n\nTodo lo que hagas se sincroniza entre web, app y desktop.'},
  {t:'general',q:['es seguro Ruedda','es confiable','cómo sé que no es una estafa'],k:['seguro','seguridad','confiable','estafa','fraude','scam','confianza','legal'],
   a:'Ruedda revisa **cada publicación antes de activarla**, verifica identidades con **KYC** (cédula + selfie) y marca con sello a los usuarios verificados y a los carros **auditados por Ruedda**.\n\nAun así, como en cualquier compra de carro: míralo en persona, revisa documentos y **nunca pagues por adelantado** a alguien que no conoces.',x:['kyc']},
  {t:'general',q:['cómo funciona Ruedda paso a paso','tutorial de la app'],k:['tutorial','guia','paso a paso','aprender','recorrido','como funciona','como se usa'],
   a:'Tienes un **tutorial guiado** de 60 segundos en Configuración → tutorial de uso. Te muestra el market, las subastas, historias y cómo vender.',x:['tutorial','comofunciona']},

  // CUENTA
  {t:'cuenta',q:['cómo creo una cuenta','cómo me registro'],k:['crear cuenta','registrar','registro','registrarme','abrir cuenta','sign up','unirme'],
   a:'Toca **regístrate** (o "cuenta" en la barra de abajo) y crea tu cuenta con correo, **Google** o **Apple**. Toma menos de un minuto.'},
  {t:'cuenta',q:['olvidé mi contraseña','no puedo iniciar sesión','no me deja entrar'],k:['contrasena','clave','password','olvide','iniciar sesion','login','entrar','acceder','no puedo entrar'],
   a:'En la pantalla de inicio de sesión toca **"¿olvidaste tu contraseña?"**, escribe tu correo y te llega un enlace para crear una nueva (revisa spam).\n\nSi entraste con **Google** o **Apple**, usa ese mismo botón: esa cuenta no tiene contraseña de Ruedda.',x:['wa']},
  {t:'cuenta',q:['cómo cambio mi nombre','cambiar teléfono','cambiar correo','editar mis datos'],k:['cambiar','editar','nombre','telefono','correo','email','datos','actualizar','whatsapp'],
   a:'Ve a **Configuración → datos de usuario**. Ahí cambias nombre, correo y teléfono/WhatsApp.',x:['perfil']},
  {t:'cuenta',q:['cómo cambio mi foto de perfil','perfil público','cómo me ven los demás'],k:['foto perfil','avatar','perfil publico','bio','mi perfil','como me ven'],
   a:'En **Configuración → perfil público** ves tu perfil tal como lo ven los demás: foto, nivel, publicaciones, seguidores y reseñas.',x:['publico']},
  {t:'cuenta',q:['cómo elimino mi cuenta','borrar mi cuenta'],k:['eliminar cuenta','borrar cuenta','darme de baja','cerrar cuenta','eliminar mi cuenta','eliminar','borrar'],
   a:'En **Configuración**, al final, está **eliminar cuenta**. Es permanente: se borran tu perfil y tus publicaciones.',x:['config']},
  {t:'cuenta',q:['modo claro','modo oscuro','cambiar el tema'],k:['tema','oscuro','claro','apariencia','dark','light','fondo','colores'],
   a:'En **Configuración → apariencia** eliges el fondo de la app.',x:['config']},
  {t:'cuenta',q:['cerrar sesión','cómo salgo de mi cuenta'],k:['cerrar sesion','salir','logout','desconectar'],
   a:'Ve a **cuenta → configuración** y toca **cerrar sesión** al final de la pantalla.',x:['config']},

  // KYC
  {t:'kyc',q:['cómo verifico mi cuenta','qué es KYC','verificación de identidad'],k:['kyc','verificar','verificacion','verificado','identidad','sello'],
   a:'La verificación **KYC** confirma que eres tú. Ve a **Configuración → verificación KYC** y sube:\n• foto de tu **cédula**\n• una **selfie**\n\nToma **un día hábil máximo**. Al aprobarse te llega una notificación, tu perfil lleva el **sello de verificado** y puedes participar en **subastas a nivel nacional**.',x:['kyc']},
  {t:'kyc',q:['me rechazaron la verificación','KYC rechazado'],k:['kyc rechazado','rechazaron verificacion','verificacion rechazada','no me verificaron'],
   a:'Casi siempre es por fotos borrosas o con reflejo. Vuelve a **verificación KYC** y sube fotos **nítidas y legibles**: la cédula completa, con buena luz, y la selfie de frente.',x:['kyc','wa']},
  {t:'kyc',q:['cuánto tarda la verificación'],k:['tarda verificacion','cuanto tarda kyc','demora verificacion'],
   a:'La verificación toma **un día hábil máximo**. Mientras tanto puedes navegar, guardar favoritos y comentar.',x:['kyc']},

  // VENDER
  {t:'vender',q:['cómo vendo mi carro','cómo publico un carro','quiero vender'],k:['vender','publicar','publico','anunciar','subir carro','vendo','venta','poner a la venta'],
   a:'Así se publica:\n1. Toca **vender**.\n2. Elige **market** (precio fijo) o **subasta**.\n3. Elige tu plan (publicar es **gratis**).\n4. Sube fotos, precio y datos del carro.\n\nTu publicación entra en **revisión** y te avisamos apenas esté activa.',x:['vender','planes']},
  {t:'vender',q:['cuánto tarda en aprobarse mi publicación','mi publicación está en revisión'],k:['revision','aprobar','aprobacion','aprueban','pendiente','activa','tarda publicacion','cuando sale'],
   a:'Revisamos cada publicación para cuidar la calidad del market. Normalmente se aprueba en **pocas horas**. Te llega una **notificación** cuando está activa.\n\nSi pagaste un plan, primero verificamos tu pago.',x:['notis']},
  {t:'vender',q:['por qué rechazaron mi publicación','me rechazaron el carro'],k:['rechazaron','rechazada','rechazo','rechazado','cancelada','no aprobaron','eliminaron'],
   a:'Las razones más comunes:\n• datos que no coinciden con las fotos (año, modelo, km)\n• fotos de internet, borrosas o de otro carro\n• precio claramente irreal o de prueba\n• falta la ciudad o información clave\n\nCorrige y vuelve a publicar. Si tienes dudas sobre tu caso, escríbenos.',x:['wa']},
  {t:'vender',q:['cuántas fotos puedo subir','límite de fotos'],k:['fotos','foto','imagenes','cuantas fotos','limite fotos'],
   a:'**Sin límite**: sube todas las fotos que quieras en cualquier plan.\n\nConsejo: frente, laterales, atrás, interior, tablero encendido (km), motor y cauchos. Luz de día y carro limpio.',x:['fotografos']},
  {t:'vender',q:['cómo edito mi publicación','cambiar el precio','modificar mi anuncio'],k:['editar publicacion','modificar','cambiar precio','editar','actualizar publicacion','corregir'],
   a:'Ve a **cuenta → mis publicaciones**, abre tu carro y toca **editar**. Si bajas el precio, la publicación muestra el aviso de **bajó de precio**, que atrae compradores.',x:['cuenta']},
  {t:'vender',q:['ya vendí mi carro','cómo marco como vendido','cómo quito mi publicación'],k:['vendido','vendi','marcar vendido','quitar publicacion','borrar publicacion','pausar','retirar','desactivar'],
   a:'En **cuenta → mis publicaciones** abre el carro y márcalo como **vendido** o elimínalo. Marcarlo vendido suma **600 XP** a tu nivel.',x:['cuenta']},
  {t:'vender',q:['cómo vendo más rápido','consejos para vender'],k:['rapido','consejos','tips','vender rapido','mas visitas','nadie me escribe','no se vende','vender mas'],
   a:'Lo que más funciona:\n• **precio en rango**: revisa el DealMeter de carros parecidos\n• **muchas fotos** claras y una descripción honesta (usa **Mejorar con IA**)\n• responde rápido los mensajes y preguntas\n• sube una **historia** de tu carro\n• un plan con **destacado** te pone en featured y Hot Deals',x:['planes','historias']},
  {t:'vender',q:['qué es mejorar con IA','me ayuda a escribir la descripción'],k:['ia','inteligencia artificial','mejorar con ia','descripcion','redactar','escribir'],
   a:'Debajo de la descripción tienes **Mejorar con IA**: escribe lo básico y la IA lo convierte en una descripción clara y atractiva. Revísala antes de publicar.'},
  {t:'vender',q:['es obligatorio poner la ciudad'],k:['ciudad obligatoria','ubicacion','direccion'],
   a:'Sí, la **ciudad** es necesaria para que los compradores filtren por zona. No mostramos tu dirección exacta.'},
  {t:'vender',q:['puedo publicar varios carros'],k:['varios carros','mas de un carro','muchos carros','otra publicacion','segundo carro'],
   a:'Sí. Cada carro es una publicación aparte. Si vendes muchos carros, el **paquete concesionario** ($89/mes) te da hasta **35 publicaciones activas** y vitrina propia.',x:['concesionarios']},
  {t:'vender',q:['puedo publicar un carro chocado'],k:['chocado','chocada','chocados','chocadas','choque','danado','siniestrado','accidentado','dano'],
   a:'Sí. Ruedda tiene una sección de **chocados**: vehículos con daños, a precio de daños, indicando tipo de daño y estado. Cero sorpresas.'},
  {t:'vender',q:['qué son las historias','cómo subo una historia'],k:['historia','historias','stories','story','reel'],
   a:'Las **historias** son como en Instagram: muestras tu carro en video o foto en la parte de arriba del market. Es una de las formas más rápidas de llamar la atención.',x:['historias']},
  {t:'vender',q:['cómo transfiero un carro a otro usuario'],k:['transferir','transferencia','garage','mi garage','pasar carro'],
   a:'En **mi garage** abre el carro y usa **transferir a un usuario de Ruedda** con su @usuario. No se puede deshacer, así que revisa bien el nombre.',x:['cuenta']},

  // PLANES
  {t:'planes',q:['qué planes hay','cuánto cuesta publicar','precios de publicación'],k:['planes','plan','precios','cuanto cuesta publicar','tarifas','paquetes','costo publicar'],
   a:'Publicar en el market:\n• **Gratis**: 30 días.\n• **Founder Pack — $2**: insignia Founder, 60 días, 3 días destacado y acceso anticipado.\n• **RueddaFull — $5**: 60 días, 7 días destacado, historia en Instagram y asesor por chat.\n• **RueddaPlus+ — $15**: 90 días, destacado siempre, primero en búsqueda y en tu ciudad, post + historia en redes y tu clip en Clips.\n• **RueddaPro — $90**: fotógrafo a domicilio, video profesional, sello auditado, asesor dedicado y destacado hasta que se venda.\n\nNingún plan tiene límite de fotos.',x:['planes']},
  {t:'planes',q:['qué es el Founder Pack','para qué sirve el plan de 2 dólares'],k:['founder','founder pack','2 dolares','plan de 2','2$','apoyar','apoyo','insignia founder'],
   a:'El **Founder Pack ($2)** es para quien quiere apoyar a Ruedda desde el inicio. Incluye:\n• **insignia Founder** permanente en tu perfil\n• **60 días** de publicación\n• **3 días destacado**\n• **acceso anticipado** a lo nuevo',x:['planes']},
  {t:'planes',q:['qué incluye RueddaFull'],k:['full','rueddafull','5 dolares','plan de 5','5$'],
   a:'**RueddaFull ($5)**: 60 días activa, **7 días destacada** (featured y Hot Deals), una **historia en Instagram** de Ruedda y un **asesor por chat**.',x:['planes']},
  {t:'planes',q:['qué incluye RueddaPlus'],k:['plus','rueddaplus','15 dolares','plan de 15','15$','15'],
   a:'**RueddaPlus+ ($15)**: 90 días, **destacada toda la publicación**, **primero en búsqueda** y en tu ciudad, **post + historia** en redes y tu **clip** en la sección Clips. Es el plan para vender rápido.',x:['planes']},
  {t:'planes',q:['qué incluye RueddaPro','servicio completo'],k:['pro','rueddapro','90 dolares','plan de 90','90$','90','fotografo','video profesional','servicio completo'],
   a:'**RueddaPro ($90)** es el servicio completo: **fotógrafo a domicilio**, **video profesional**, inspección con **sello auditado Ruedda**, **asesor dedicado** que coordina visitas y pruebas de manejo, y **destacado hasta que se venda**.',x:['planes']},
  {t:'planes',q:['qué significa destacado','qué es featured'],k:['destacado','destacada','featured','destacar','resaltar'],
   a:'Una publicación **destacada** lleva la pestaña amarilla **featured**, sube en el market y aparece en **Hot Deals** del inicio. Viene en los planes Founder (3 días), Full (7 días), Plus+ y Pro.',x:['planes','hotdeals']},
  {t:'planes',q:['tengo un código de invitación','dónde pongo mi código'],k:['codigo','codigo invitacion','cupon','promo','descuento','invitacion'],
   a:'Por ahora **no estamos usando códigos de invitación** para publicar: publicar en el market ya es **gratis**.\n\nLos **códigos de acceso a subastas** son otra cosa y siguen funcionando.',x:['planes']},
  {t:'planes',q:['puedo republicar mi carro'],k:['republicar','republicacion','volver a publicar','renovar','vencio','expiro'],
   a:'Sí. Si tu publicación vence sin venderse, puedes **volver a publicarla** desde mis publicaciones. Para que dure más, elige un plan con más días.',x:['cuenta','planes']},

  // PAGOS
  {t:'pagos',q:['cómo pago','métodos de pago','puedo pagar en bolívares'],k:['pago','pagar','metodos','bolivares','bs','pago movil','binance','usdt','dolares','transferencia','zelle'],
   a:'Aceptamos:\n• **Pago móvil** en bolívares, a la tasa **BCV** del día (la app te muestra el monto exacto)\n• **Binance Pay** (USDT)\n\nAl pagar escribe la referencia y el equipo de Ruedda la verifica.',x:['planes']},
  {t:'pagos',q:['ya pagué y no se activa','cuánto tarda en verificarse mi pago'],k:['ya pague','verificar pago','pago pendiente','no se activa','referencia','comprobante','tarda pago'],
   a:'Verificamos cada referencia a mano, normalmente **en pocas horas**. Te llega la notificación **pago aprobado** y tu publicación pasa a revisión.\n\nSi pasó más de un día, escríbenos con tu referencia.',x:['wa']},
  {t:'pagos',q:['me rechazaron el pago'],k:['pago rechazado','rechazaron pago','referencia invalida','no verificaron pago'],
   a:'Suele pasar por una **referencia incompleta** o un monto distinto al indicado. Escríbenos con la captura del pago y lo resolvemos.',x:['wa','mail']},
  {t:'pagos',q:['a qué tasa cobran','tasa BCV'],k:['tasa','bcv','cambio','dolar oficial'],
   a:'Los pagos en bolívares se calculan a la **tasa oficial BCV** del día. El checkout la muestra al momento de pagar.'},
  {t:'pagos',q:['me devuelven el dinero','reembolso'],k:['reembolso','devolucion','devuelven','reintegro','refund'],
   a:'En **subastas**, el **hold de $60** se devuelve si no ganas, o si compraste y encontramos información falsa en la publicación.\n\nPara planes de publicación, escríbenos con tu caso y lo revisamos.',x:['wa']},

  // SUBASTAS
  {t:'subastas',q:['cómo funcionan las subastas','cómo participo en una subasta'],k:['subasta','subastas','pujar','puja','ofertar','postor','como participo'],
   a:'Las subastas son **en tiempo real**: el que ofrezca más al cierre se lo lleva.\n• Para ofertar necesitas un **código de acceso** (hold de $60, reembolsable).\n• Si alguien oferta en el **último minuto, el reloj se extiende**: nadie te gana por sorpresa.\n• El **historial de ofertas** es visible para todos.',x:['subastas']},
  {t:'subastas',q:['qué es el hold','por qué piden 60 dólares','cómo consigo el código de acceso'],k:['hold','deposito','60','codigo acceso','acceso subasta','garantia'],
   a:'Para ofertar pedimos un **hold de $60** que te **devolvemos si no ganas**. Así cuidamos el tiempo del vendedor y de los postores reales.\n\nDos formas de conseguir tu código:\n1. Escríbenos por WhatsApp, Instagram o correo y deja el hold en bolívares o USDT.\n2. Sube el **comprobante de Binance** en la subasta: lo verificamos y el código te llega a **notificaciones**.',x:['subastas','wa']},
  {t:'subastas',q:['cómo subasto mi carro','cuánto cuesta subastar','cuánto cuesta una subasta'],k:['subastar','subastar mi carro','crear subasta','iniciar subasta','precio subasta','cuesta subasta','cuesta una subasta','subasta cuesta','subastas cuesta','cuesta subastar','planes subasta'],
   a:'Toca **vender → subasta**. Planes:\n• **Gratis**\n• **Subasta Normal — $7.99**: visibilidad completa y panel de ofertas.\n• **RueddaPlus+ — $23.95**: redes sociales, **destacada en portada**, panel premium y soporte especializado.\n\nLa subasta puede durar de **1 a 25 días**.',x:['vender']},
  {t:'subastas',q:['qué es el precio de reserva','qué significa sin reserva'],k:['reserva','sin reserva','precio base','minimo'],
   a:'El **precio de reserva** es el mínimo que aceptas. Si la subasta no lo alcanza, **no estás obligado a vender**.\n\n**Sin reserva** significa que el carro se vende a la mejor oferta, sea cual sea.'},
  {t:'subastas',q:['gané una subasta y ahora qué'],k:['gane','ganador','gane subasta','gane la subasta','ganaste'],
   a:'¡Felicidades! Te llega la notificación **ganaste la subasta** con botones para escribirle al vendedor por mensaje o WhatsApp. Coordinen la revisión del carro, los documentos y el pago.\n\nSi encuentras información falsa en la publicación, Ruedda te devuelve el hold.',x:['notis']},
  {t:'subastas',q:['qué es una subasta programada'],k:['programada','proxima subasta','empieza','fecha inicio'],
   a:'Una **subasta programada** ya está publicada pero arranca en una fecha futura. Puedes guardarla y te avisamos cuando empiece.'},

  // COMPRAR
  {t:'comprar',q:['cómo busco un carro','cómo filtro','buscar por marca'],k:['buscar','busqueda','filtro','filtros','marca','modelo','ano','precio','encontrar'],
   a:'Usa la **lupa** para buscar por marca, modelo o precio, o entra a **busca por marcas**. En el market puedes filtrar por ciudad, año, precio, transmisión y más.',x:['market','marcas']},
  {t:'comprar',q:['cómo contacto al vendedor','cómo le escribo al dueño'],k:['contactar','vendedor','escribir','mensaje','chat','whatsapp vendedor','llamar','dueno'],
   a:'Dentro de la publicación toca **enviar mensaje** para escribirle por el chat de Ruedda, o usa su **WhatsApp** si lo publicó. También puedes dejar una **pregunta pública** en los comentarios.'},
  {t:'comprar',q:['puedo ofrecer menos','puedo ofrecer un cambio'],k:['ofrecer menos','ofrecer cambio','negociar','oferta','contraoferta','cambio','permuta','regatear'],
   a:'Sí. En la publicación tienes **ofrecer menos** (propones tu precio) y **ofrecer cambio** (ofreces tu carro como parte de pago). Al vendedor le llega como notificación y mensaje.'},
  {t:'comprar',q:['qué es el DealMeter','qué significa súper oferta','cómo sé si el precio es bueno'],k:['dealmeter','deal meter','super oferta','buen precio','precio justo','caro','valoracion','medidor','pme'],
   a:'El **DealMeter** compara el precio con carros parecidos en todo el país:\n• **Súper oferta**: más de 10% por debajo del mercado\n• **Buen precio**: entre 3% y 10% por debajo\n• **Precio justo**: en rango\n• **Por encima del mercado**: más caro que el promedio\n\nTambién indica la **confianza** del cálculo (alta, media o baja).',x:['extra']},
  {t:'comprar',q:['qué significa auditado por Ruedda'],k:['auditado','auditoria','inspeccion','inspeccionado','certificado'],
   a:'El sello **auditado Ruedda** indica que el equipo de Ruedda **inspeccionó** el carro y su publicación. Viene incluido en el plan **RueddaPro**.'},
  {t:'comprar',q:['hay financiamiento','puedo comprar a crédito'],k:['financiamiento','credito','cuotas','financiar','prestamo','inicial'],
   a:'Algunas publicaciones, sobre todo de concesionarios, muestran **financiamiento disponible** con sus condiciones. Pregúntale los detalles directamente al vendedor.'},
  {t:'comprar',q:['qué debo revisar antes de comprar','consejos para comprar seguro'],k:['comprar seguro','revisar','antes de comprar','consejos compra','documentos','titulo','papeles','manual de compra'],
   a:'Antes de pagar:\n• mira el carro **en persona**, de día, y hazle una prueba de manejo\n• lleva un mecánico o usa el **Scanner OBD2** de Ruedda Extra\n• verifica **placa y VIN** y que el título coincida con la cédula del vendedor\n• **nunca pagues por adelantado** sin ver el carro\n• cierra el trato con un **gestor** o abogado',x:['extra']},
  {t:'comprar',q:['cómo guardo un carro','favoritos'],k:['favorito','favoritos','guardar','corazon','me gusta','seguir carro'],
   a:'Toca el **corazón** en cualquier carro y queda en **favoritos** (barra de abajo). Así le haces seguimiento al precio.',x:['favoritos']},
  {t:'comprar',q:['qué son los Hot Deals'],k:['hot deals','hotdeals','ofertas','descuentos','bajo de precio','rebaja'],
   a:'**Hot Deals** reúne en el inicio los carros **destacados** y más vistos. Los carros que **bajaron de precio** se marcan aparte para que los veas rápido.',x:['hotdeals']},
  {t:'comprar',q:['cómo reporto una publicación','creo que es una estafa'],k:['reportar','denunciar','reporte','sospechoso','falso','enganoso','estafador'],
   a:'Dentro de la publicación o del perfil usa **reportar**. El equipo lo revisa y, si hace falta, retira la publicación o la cuenta. Si ya perdiste dinero, escríbenos de inmediato.',x:['wa']},
  {t:'comprar',q:['cómo califico a un vendedor','reseñas'],k:['resena','resenas','calificar','calificacion','estrellas','opinion','valorar'],
   a:'Desde el **perfil público** del vendedor puedes dejarle una **reseña con estrellas**. Las reseñas de 4★ y 5★ también le suman XP.'},

  // CONCESIONARIOS
  {t:'dealer',q:['soy concesionario','cuánto cuesta la vitrina','paquete concesionario'],k:['concesionario','concesionarios','agencia','dealer','vitrina','negocio','empresa','89'],
   a:'El **paquete concesionario** cuesta **$89/mes** e incluye:\n• **35 publicaciones** activas a la vez\n• vitrina con tu **nombre, logo y banner**\n• botón directo de **WhatsApp y llamada**\n• **estadísticas** de visitas por carro\n• soporte prioritario',x:['concesionarios','wa']},
  {t:'dealer',q:['cómo administro mi vitrina','venció mi vitrina'],k:['administrar vitrina','vitrina vencida','renovar vitrina','vitrina digital'],
   a:'En **cuenta → administrar vitrina digital** editas tu vitrina. El paquete dura **30 días**; al vencer, la app te pide renovarlo.',x:['cuenta']},

  // COMUNIDAD / NIVELES
  {t:'comunidad',q:['cómo funcionan los niveles','cómo subo de nivel','qué es el XP'],k:['nivel','niveles','xp','puntos','subir nivel','experiencia','etapa'],
   a:'Ganas **XP** usando Ruedda:\n• carro vendido: **600**\n• cuenta verificada: **400**\n• publicación o subasta activa: **150**\n• calificación de 4★ o 5★: **100**\n• seguidor: **60**\n• carspotting: **60**\n• favorito: **40**\n• comentario: **25**\n\nHay 16 niveles en 6 etapas: calle, pista, podio, élite, leyenda y eterno.',x:['publico']},
  {t:'comunidad',q:['qué beneficios dan los niveles','publicaciones gratis por nivel'],k:['beneficios nivel','premios','recompensas','publicaciones gratis al mes','perks'],
   a:'Desde el **nivel 5** tienes **publicaciones gratis cada mes** (de 1 hasta 10 en el nivel 16). También hay premios como franela oficial, sesión de fotos, detailing y entrada VIP a eventos. Los premios se reclaman por WhatsApp.',x:['publico']},
  {t:'comunidad',q:['qué es carspotting'],k:['carspotting','spot','spots','calle','avistamiento'],
   a:'**Carspotting** es para compartir los mejores carros que te consigas en la calle. Cada spot suma XP y los más populares salen destacados.',x:['carspotting']},
  {t:'comunidad',q:['qué es Ruedda Extra','qué herramientas hay'],k:['extra','ruedda extra','herramientas','obd2','scanner','decibeles','placa','vin','gestoria','legal','merch','store','tienda'],
   a:'En **Ruedda Extra** tienes:\n• **Comunidad**: clips y noticias\n• **Scanner OBD2**: diagnóstico de tu carro\n• **Medidor de decibeles** del escape (by STXX)\n• **DealMeter**: precios a nivel nacional\n• **Fotógrafos** para tu publicación\n• **Verificar placa y VIN**\n• **Store**: merch oficial de Ruedda y STXX AutoClub\n• **Legal** y **gestoría de documentos** (próximamente)',x:['extra']},
  {t:'comunidad',q:['qué son los cafés','cars and coffee'],k:['cafe','cafes','coffee','cars and coffee','encuentro','evento','eventos','meet'],
   a:'**Cafés** son los encuentros de la comunidad estilo cars & coffee. **Próximamente** en la app: te avisaremos por notificaciones.'},
  {t:'comunidad',q:['qué son los partners','aliados'],k:['partners','partner','aliados','aliado','patrocinante','patrocinio'],
   a:'Los **partners** son aliados de Ruedda: talleres, servicios y marcas del mundo automotriz. Si tu negocio quiere ser partner, escríbenos.',x:['partners','wa']},
  {t:'comunidad',q:['puedo alquilar un carro','cómo pongo mi carro en alquiler'],k:['alquiler','alquilar','rentar','renta','alquileres'],
   a:'En **Alquileres** encuentras carros para tu próximo plan, o publicas el tuyo con **ofrecer mi vehículo en alquiler** y generas ingresos extra.',x:['alquileres']},
  {t:'comunidad',q:['hacen importaciones'],k:['importacion','importaciones','importar','traer carro'],
   a:'Tenemos una sección de **Importaciones** con la información para traer tu carro. Ábrela desde el inicio.',x:['importaciones']},
  {t:'comunidad',q:['necesito un fotógrafo'],k:['fotografo','fotografos','sesion fotos','fotos profesionales'],
   a:'En **Fotógrafos** (Ruedda Extra) encuentras profesionales autorizados para fotografiar tu carro. El plan **RueddaPro** incluye fotógrafo a domicilio.',x:['fotografos','planes']},
  {t:'comunidad',q:['quiero dar una sugerencia','tengo una idea'],k:['sugerencia','sugerir','idea','feedback','mejora','propuesta','recomendacion'],
   a:'¡Nos encanta! Envíala en **sugerencias**: el equipo las lee todas.',x:['sugerencias']},

  // NOTIS / MENSAJES / PROBLEMAS
  {t:'ayuda',q:['dónde veo mis mensajes','no encuentro el chat'],k:['mensajes','bandeja','inbox','chat','conversacion','conversaciones'],
   a:'Tus conversaciones están en **notificaciones → mensajes** (la campana de la barra de abajo).',x:['notis']},
  {t:'ayuda',q:['no me llegan las notificaciones','activar notificaciones push'],k:['notificaciones','notificacion','push','avisos','no me llegan','alertas'],
   a:'Activa **Configuración → notificaciones push** y acepta el permiso del sistema. En iPhone revisa también Ajustes → Ruedda → Notificaciones.\n\nSi la app estuvo en segundo plano mucho tiempo, ciérrala y ábrela para traer lo más reciente.',x:['config']},
  {t:'ayuda',q:['la app está lenta','no cargan las fotos','la app se cuelga'],k:['lenta','lento','no carga','cargando','cuelga','error','falla','bug','pegada','congelada','fotos no cargan'],
   a:'Prueba en este orden:\n1. Revisa tu conexión (datos o Wi-Fi).\n2. Cierra la app por completo y ábrela.\n3. Actualízala desde el App Store o recarga ruedda.app.\n\nSi sigue, escríbenos con una captura y el modelo de tu teléfono.',x:['wa']},
  {t:'ayuda',q:['me da error al publicar'],k:['error publicar','no puedo publicar','no se publica','falla publicar'],
   a:'Revisa que estén completos los campos obligatorios (incluida la **ciudad**) y que las fotos hayan terminado de subir. Si el error sigue, escríbenos con una captura.',x:['wa']},
  {t:'ayuda',q:['cómo hablo con una persona','quiero hablar con soporte'],k:['humano','persona','agente','asesor','soporte','hablar con alguien','atencion','contacto','contactar ruedda','telefono ruedda','correo ruedda'],
   a:'Claro. El equipo de Ruedda te responde por **WhatsApp** o por correo a **'+MAIL+'**.',x:['wa','mail']},
  {t:'ayuda',q:['trabajar en Ruedda','empleo'],k:['trabajo','trabajar','empleo','vacante','carreras','unirme al equipo','pasantia'],
   a:'Las postulaciones están en **RueddaCarreras**, dentro de **ruedda.app/hub**.'}
  ];

  // ── charla casual ──
  var TALK=[
    {k:['hola','buenas','buenos dias','buenas tardes','buenas noches','hey','epa','que tal','saludos','hi','hello'],a:function(){ return '¡Hola'+nm()+'! ¿En qué te ayudo? Puedes preguntarme lo que quieras de Ruedda.'; },x:'chips'},
    {k:['gracias','muchas gracias','thanks','genial','excelente','perfecto','buenisimo','chevere','fino','listo','ok','vale'],a:function(){ return 'Con gusto. ¿Te ayudo con algo más?'; }},
    {k:['chao','adios','hasta luego','nos vemos','bye'],a:function(){ return '¡Hasta pronto! Aquí estoy cuando me necesites.'; }},
    {k:['eres un bot','eres humano','eres una ia','quien eres','con quien hablo','eres real'],a:function(){ return 'Soy **Enzo**, el concierge de Ruedda: respondo al instante con la información de la app. Si necesitas a una persona del equipo, te paso con ellos.'; },x:['wa']},
    {k:['jaja','jajaja','jeje','lol','xd'],a:function(){ return '😄 ¿En qué más te ayudo?'; }},
    {k:['como estas','que haces'],a:function(){ return '¡Todo bien por aquí, listo para ayudarte! ¿Qué necesitas?'; }}
  ];

  var CHIPS=['¿cómo vendo mi carro?','¿qué planes hay?','¿cómo funcionan las subastas?','¿cómo pago?','¿cómo verifico mi cuenta?','¿qué es el DealMeter?','¿cómo compro seguro?','¿cómo subo de nivel?'];

  // ── motor de búsqueda ──
  var STOP=' a al como con cual cuales de del el en es esta este esto hay la las le lo los mas me mi mis no o para pero por puedo que se si sin su sus te tengo ti tu tus un una uno unos y ya yo quiero necesito hacer saber cuando donde favor porfa porfavor ruedda ';
  var SYN={auto:'carro',autos:'carro',coche:'carro',coches:'carro',vehiculo:'carro',vehiculos:'carro',camioneta:'carro',camionetas:'carro',moto:'carro',carros:'carro',
    anuncio:'publicacion',anuncios:'publicacion',aviso:'publicacion',post:'publicacion',publicaciones:'publicacion',
    precio:'precio',precios:'precio',plata:'pago',dinero:'pago',cobran:'pago',cobro:'pago',pagos:'pago',
    clave:'contrasena',password:'contrasena',pass:'contrasena',
    cel:'telefono',celular:'telefono',numero:'telefono',
    whats:'whatsapp',wasap:'whatsapp',wsp:'whatsapp',ws:'whatsapp',
    noti:'notificaciones',notis:'notificaciones',
    puja:'subasta',pujas:'subasta',remate:'subasta',
    cuanto:'cuesta',vale:'cuesta',valor:'cuesta'};
  function norm(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9$ ]+/g,' ').replace(/\s+/g,' ').trim(); }
  function stem(w){ if(w.length>5) w=w.replace(/(aciones|acion|asion|ciones|cion|sion|amente|mente)$/,''); if(w.length>=7) w=w.replace(/(ar|er|ir)$/,''); if(w.length>4) w=w.replace(/(es|s)$/,''); return w; }
  function toks(s){ return norm(s).split(' ').filter(function(w){ return w && STOP.indexOf(' '+w+' ')<0; }).map(function(w){ return stem(SYN[w]||w); }); }
  function lev1(a,b){ // ¿distancia de edición ≤1?
    if(a===b) return true; var la=a.length, lb=b.length; if(Math.abs(la-lb)>1) return false;
    var i=0,j=0,d=0; while(i<la&&j<lb){ if(a[i]===b[j]){i++;j++;continue;} if(++d>1) return false; if(la>lb) i++; else if(lb>la) j++; else {i++;j++;} }
    return d+(la-i)+(lb-j)<=1;
  }
  function tokHit(t,set){ if(set[t]) return 1; if(t.length<5) return 0; for(var w in set){ if(w.length>=5 && lev1(t,w)) return .8; } return 0; }
  KB.forEach(function(e,i){
    e.i=i; e.kn=e.k.map(norm);
    var set={}; e.k.concat(e.q).forEach(function(s){ toks(s).forEach(function(t){ set[t]=1; }); }); e.ts=set;
  });
  function score(q,qt,e,topic){
    var s=0, nq=' '+norm(q)+' ';
    e.kn.forEach(function(k){ if(k.indexOf(' ')>0){ if(nq.indexOf(' '+k+' ')>=0) s+=3; } else if(nq.indexOf(' '+k+' ')>=0) s+=1.6; });
    var hit=0; qt.forEach(function(t){ hit+=tokHit(t,e.ts); });
    s+=hit*1.1 + (qt.length? hit/qt.length : 0)*1.5;
    if(topic && e.t===topic) s+=.6;
    return s;
  }
  function search(q,topic){
    var qt=toks(q);
    return KB.map(function(e){ return {e:e,s:score(q,qt,e,topic)}; }).filter(function(r){ return r.s>0; }).sort(function(a,b){ return b.s-a.s; });
  }
  function talk(q){
    var n=' '+norm(q)+' ';
    if(norm(q).split(' ').length>6) return null;
    for(var i=0;i<TALK.length;i++){ for(var j=0;j<TALK[i].k.length;j++){ if(n.indexOf(' '+TALK[i].k[j]+' ')>=0) return TALK[i]; } }
    return null;
  }
  function nm(){ try{ var n=(window.USER_STATE&&(USER_STATE.nombre||USER_STATE.username))||''; n=String(n).split(' ')[0]; return n? ', '+esc(n):''; }catch(e){ return ''; } }

  // ── UI ──
  // claymorphism: volumen con sombras externas suaves + luz/sombra internas.
  // Solo box-shadow y transform (sin blur de fondo): liviano en Android.
  var CSS=''+
  '#rds{--c-bg:#17171a;--c-hi:rgba(255,255,255,.07);--c-lo:rgba(0,0,0,.55);--c-out:rgba(0,0,0,.55);--c-tx:#f4f4f5;--c-mu:rgba(244,244,245,.55);--c-ln:rgba(255,255,255,.06);--c-acc:#e6f03b;--c-acc-ink:#111;display:flex;flex-direction:column;max-width:680px;margin:0 auto;padding:0 16px;min-height:calc(100dvh - 120px);padding-bottom:calc(var(--rds-b,12px) + 4px);color:var(--c-tx)}'+
  '#rds .rds-log>*{scroll-margin-bottom:calc(var(--rds-b,12px) + 96px)}'+
  'html[data-theme="light"] #rds{--c-bg:#eeeff2;--c-hi:rgba(255,255,255,.95);--c-lo:rgba(140,145,160,.35);--c-out:rgba(120,125,140,.35);--c-tx:#141416;--c-mu:rgba(20,20,22,.55);--c-ln:rgba(0,0,0,.05)}'+
  '#rds .clay{background:var(--c-bg);border:1px solid var(--c-ln);box-shadow:10px 12px 26px -6px var(--c-out),inset 3px 3px 6px var(--c-hi),inset -5px -6px 12px var(--c-lo)}'+
  '#rds .rds-head{display:flex;align-items:center;gap:14px;padding:16px;margin:6px 0 18px;border-radius:28px}'+
  '#rds .rds-ava{position:relative;width:58px;height:58px;border-radius:22px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:linear-gradient(145deg,#f2f86a,#c9d41f);box-shadow:8px 10px 20px -6px rgba(201,212,31,.45),inset 3px 3px 6px rgba(255,255,255,.55),inset -4px -5px 10px rgba(90,95,0,.35)}'+
  '#rds .rds-ava svg{width:40px;height:40px}'+
  '#rds .rds-ava i{position:absolute;right:-3px;bottom:-3px;width:15px;height:15px;border-radius:50%;background:#3ddc84;border:3px solid var(--c-bg);box-shadow:inset 1px 1px 2px rgba(255,255,255,.5)}'+
  '#rds .rds-t{font-size:22px;font-weight:800;letter-spacing:-.5px;line-height:1.1}'+
  '#rds .rds-t span{font-weight:500;color:var(--c-mu);font-size:15px;letter-spacing:-.2px}'+
  '#rds .rds-s{font-size:12.5px;color:var(--c-mu);margin-top:4px}'+
  '#rds .rds-log{flex:1;display:flex;flex-direction:column;gap:12px;padding:4px 2px 16px}'+
  '#rds .rds-row{display:flex;gap:9px;align-items:flex-end;align-self:flex-start;max-width:90%;animation:rdsIn .32s cubic-bezier(.2,.9,.25,1.15) both}'+
  '#rds .rds-mini{width:28px;height:28px;border-radius:11px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:linear-gradient(145deg,#f2f86a,#c9d41f);box-shadow:3px 4px 8px -2px rgba(201,212,31,.35),inset 2px 2px 3px rgba(255,255,255,.5),inset -2px -3px 5px rgba(90,95,0,.3)}'+
  '#rds .rds-mini svg{width:20px;height:20px}'+
  '#rds .rds-m{padding:12px 16px;border-radius:24px;font-size:14.5px;line-height:1.55;white-space:pre-line;word-wrap:break-word;min-width:0}'+
  '#rds .rds-m.b{border-bottom-left-radius:10px}'+
  '#rds .rds-m.u{align-self:flex-end;max-width:84%;border-bottom-right-radius:10px;font-weight:600;color:var(--c-acc-ink);background:linear-gradient(145deg,#f2f86a,#d9e32a);box-shadow:8px 10px 20px -8px rgba(201,212,31,.5),inset 3px 3px 5px rgba(255,255,255,.55),inset -4px -5px 9px rgba(90,95,0,.3);animation:rdsIn .32s cubic-bezier(.2,.9,.25,1.15) both}'+
  '#rds .rds-m b{font-weight:800}'+
  '#rds .rds-acts{display:flex;flex-wrap:wrap;gap:8px;align-self:flex-start;max-width:94%;padding-left:37px;animation:rdsIn .34s .06s cubic-bezier(.2,.9,.25,1.15) both}'+
  '#rds .rds-a{background:var(--c-bg);border:1px solid var(--c-ln);color:var(--c-tx);border-radius:999px;padding:8px 14px;font-family:var(--font);font-size:13px;font-weight:600;cursor:pointer;text-decoration:none;box-shadow:5px 6px 12px -4px var(--c-out),inset 2px 2px 3px var(--c-hi),inset -3px -3px 6px var(--c-lo);transition:transform .18s cubic-bezier(.2,.9,.25,1.2),box-shadow .18s;-webkit-tap-highlight-color:transparent}'+
  '#rds .rds-a:hover{transform:translateY(-1px)}'+
  '#rds .rds-a:active{transform:scale(.96);box-shadow:inset 3px 3px 6px var(--c-lo),inset -2px -2px 4px var(--c-hi)}'+
  '#rds .rds-a.go{color:var(--c-acc-ink);border-color:transparent;background:linear-gradient(145deg,#f2f86a,#d9e32a);box-shadow:5px 6px 12px -5px rgba(201,212,31,.45),inset 2px 2px 3px rgba(255,255,255,.55),inset -3px -3px 6px rgba(90,95,0,.3)}'+
  'html[data-theme="light"] #rds .rds-a.go{color:#111}'+
  '#rds .rds-typ{display:flex;align-items:center;padding:13px 18px;border-radius:24px;border-bottom-left-radius:10px}'+
  // isotipo de la intro (5 celdas en grilla 3×4, CELLS de splash/ruedda-splash.html): cada celda
  // entra de izquierda a derecha escalonada, como en la intro, y el ciclo se repite
  '#rds .rds-iso{position:relative;width:15px;height:20px}'+
  '#rds .rds-iso i{position:absolute;width:5px;height:5px;background:var(--c-tx);clip-path:inset(0 100% 0 0);animation:rdsCell 1.25s cubic-bezier(.16,1,.3,1) infinite}'+
  '#rds .rds-iso i:nth-child(1){left:5px;top:0}'+
  '#rds .rds-iso i:nth-child(2){left:0;top:5px;animation-delay:.07s}'+
  '#rds .rds-iso i:nth-child(3){left:10px;top:5px;animation-delay:.14s}'+
  '#rds .rds-iso i:nth-child(4){left:5px;top:10px;animation-delay:.21s}'+
  '#rds .rds-iso i:nth-child(5){left:10px;top:15px;animation-delay:.28s}'+
  '@keyframes rdsCell{0%{clip-path:inset(0 100% 0 0);opacity:1}32%{clip-path:inset(0 0 0 0);opacity:1}72%{clip-path:inset(0 0 0 0);opacity:1}100%{clip-path:inset(0 0 0 0);opacity:0}}'+
  '#rds .rds-bar{position:sticky;bottom:var(--rds-b,12px);display:flex;gap:8px;align-items:center;padding:8px 8px 8px 10px;margin:0 -2px;border-radius:26px;z-index:2}'+
  '#rds .rds-in{flex:1;min-width:0;background:transparent;border:none;outline:none;color:var(--c-tx);font-family:var(--font);font-size:16px;padding:9px 8px}'+
  '#rds .rds-in::placeholder{color:var(--c-mu)}'+
  '#rds .rds-send{width:44px;height:44px;border-radius:17px;border:none;color:#111;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;background:linear-gradient(145deg,#f2f86a,#d9e32a);box-shadow:5px 6px 12px -5px rgba(201,212,31,.5),inset 2px 2px 4px rgba(255,255,255,.6),inset -3px -4px 7px rgba(90,95,0,.35);transition:opacity .18s,transform .18s cubic-bezier(.2,.9,.25,1.2)}'+
  '#rds .rds-send:disabled{opacity:.4}#rds .rds-send:not(:disabled):active{transform:scale(.92)}'+
  '#rds .rds-send svg{width:19px;height:19px}'+
  '#rds .rds-foot{text-align:center;font-size:12px;color:var(--c-mu);padding:2px 0 12px}'+
  '#rds .rds-foot a{color:var(--c-tx);text-decoration:none;font-weight:700}'+
  '@keyframes rdsIn{from{opacity:0;transform:translateY(8px) scale(.97)}to{opacity:1;transform:none}}'+
  '@media (prefers-reduced-motion:reduce){#rds .rds-row,#rds .rds-m.u,#rds .rds-acts{animation:none}}';

  // Enzo: agente con audífono y micrófono, en clay amarillo Ruedda
  var AGENT='<svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="16.5" r="7.2" fill="#1b1b1d"/><path d="M8.5 35c1.4-6.3 6-9.6 11.5-9.6S30.1 28.7 31.5 35" fill="#1b1b1d"/><path d="M11.6 17.2a8.4 8.4 0 0 1 16.8 0" stroke="#1b1b1d" stroke-width="2.4" stroke-linecap="round"/><rect x="9.4" y="15.4" width="4" height="6.4" rx="2" fill="#1b1b1d"/><rect x="26.6" y="15.4" width="4" height="6.4" rx="2" fill="#1b1b1d"/><path d="M28.6 21.6c0 3-2.2 4.6-5.4 4.6" stroke="#1b1b1d" stroke-width="1.8" stroke-linecap="round"/><circle cx="22.6" cy="26.2" r="1.6" fill="#1b1b1d"/><path d="M17.4 30.4 20 33l2.6-2.6L20 28.6z" fill="#e6f03b"/></svg>';
  var NAME='Enzo';

  function esc(s){ return String(s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function fmt(s){ return esc(s).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>'); }

  var root, log, inp, btn, view, lastTopic=null, busy=false, HIST=[];
  var SK='rd_support_v1';
  function save(){ try{ sessionStorage.setItem(SK,JSON.stringify({h:HIST.slice(-40),t:lastTopic})); }catch(e){} }

  function scrollEnd(smooth){
    requestAnimationFrame(function(){
      var last=log.lastElementChild; if(!last) return;
      try{ last.scrollIntoView({block:'end',behavior:smooth?'smooth':'auto'}); }catch(e){ last.scrollIntoView(false); }
    });
  }
  function addMsg(who,text,acts,silent){
    var d=document.createElement('div'); d.className='rds-m '+who+(who==='b'?' clay':'');
    d.innerHTML= who==='u'? esc(text) : fmt(text);
    if(who==='b'){ var row=document.createElement('div'); row.className='rds-row'; row.innerHTML='<div class="rds-mini">'+AGENT+'</div>'; row.appendChild(d); log.appendChild(row); }
    else log.appendChild(d);
    if(acts&&acts.length) addActs(acts);
    if(!silent){ HIST.push({w:who,m:text,x:acts||null}); save(); }
  }
  function addActs(acts){
    var row=document.createElement('div'); row.className='rds-acts';
    acts.forEach(function(a){
      var el;
      if(typeof a==='string'){
        var A=ACT[a]; if(!A||!A.ok()) return;
        if(A.href){ el=document.createElement('a'); el.href=A.href; if(A.href.indexOf('http')===0){ el.target='_blank'; el.rel='noopener'; } el.className='rds-a go'; el.textContent=A.t; }
        else { el=document.createElement('button'); el.className='rds-a go'; el.textContent=A.t+' ›'; el.onclick=function(){ try{ A.run(); }catch(e){} }; }
      } else { // sugerencia de pregunta
        el=document.createElement('button'); el.className='rds-a'; el.textContent=a.q; el.onclick=function(){ ask(a.q); };
      }
      row.appendChild(el);
    });
    if(row.children.length) log.appendChild(row);
  }
  function typing(on){
    var t=log.querySelector('.rds-typw');
    if(on&&!t){ t=document.createElement('div'); t.className='rds-row rds-typw'; t.innerHTML='<div class="rds-mini">'+AGENT+'</div><div class="rds-typ clay" aria-label="Enzo está pensando"><div class="rds-iso"><i></i><i></i><i></i><i></i><i></i></div></div>'; log.appendChild(t); }
    if(!on){ var w=log.querySelector('.rds-typw'); if(w) w.remove(); }
  }
  function cap(s){ return s.charAt(0).toUpperCase()+s.slice(1); }
  function answer(q){
    var tk=talk(q);
    if(tk){ return {a:tk.a(), x: tk.x==='chips'? CHIPS.slice(0,4).map(function(c){ return {q:cap(c.replace(/[¿?]/g,''))}; }) : (tk.x||[])}; }
    var r=search(q,lastTopic);
    var top=r[0];
    if(!top || top.s<1.6){
      return {a:'Mmm, no tengo eso claro todavía. Prueba con otras palabras o elige un tema. Si es algo de tu cuenta o un pago, el equipo te ayuda directo.', x:CHIPS.slice(0,4).map(function(c){ return {q:cap(c.replace(/[¿?]/g,''))}; }).concat(['wa'])};
    }
    lastTopic=top.e.t;
    var x=(top.e.x||[]).slice();
    // relacionadas: siguientes mejores del mismo tema o con buen puntaje
    var rel=r.slice(1).filter(function(o){ return o.s>=1.6 && (o.e.t===top.e.t ? o.s>=top.s*.5 : o.s>=top.s*.8); }).slice(0,2).map(function(o){ return {q:o.e.q[0].charAt(0).toUpperCase()+o.e.q[0].slice(1)+'?'}; });
    if(!rel.length){ rel=KB.filter(function(e){ return e.t===top.e.t && e!==top.e; }).slice(0,2).map(function(e){ return {q:e.q[0].charAt(0).toUpperCase()+e.q[0].slice(1)+'?'}; }); }
    return {a:top.e.a, x:x.concat(rel)};
  }
  function ask(q){
    q=String(q||'').trim(); if(!q||busy) return;
    busy=true; inp.value=''; btn.disabled=true;
    addMsg('u',q); typing(true); scrollEnd(true);
    var res=answer(q);
    var delay=1500; // Enzo "piensa" con el isotipo de la intro
    setTimeout(function(){ typing(false); addMsg('b',res.a,res.x); busy=false; scrollEnd(true); },delay);
  }

  function bottomOffset(){
    var nav=document.querySelector('.bottom-nav'), b=12;
    if(nav){ var cs=getComputedStyle(nav); if(cs.display!=='none'&&cs.visibility!=='hidden'){ var r=nav.getBoundingClientRect(); if(r.height&&r.top>window.innerHeight*.5) b=Math.max(12,window.innerHeight-r.top+10); } }
    root.style.setProperty('--rds-b',b+'px');
  }

  function mount(v){
    view=v||document.getElementById('view-soporte-ruedda'); if(!view) return;
    if(view.querySelector('#rds')){ bottomOffset(); return; }
    if(!document.getElementById('rds-css')){ var st=document.createElement('style'); st.id='rds-css'; st.textContent=CSS; document.head.appendChild(st); }
    // la vista original (correo + WhatsApp) se oculta: sus enlaces viven en el pie del chat
    var old=view.querySelector(':scope > div:not(.detail-back)'); if(old) old.style.display='none';
    root=document.createElement('div'); root.id='rds';
    root.innerHTML=
      '<div class="rds-head clay"><div class="rds-ava">'+AGENT+'<i></i></div>'+
      '<div><div class="rds-t">'+NAME+' <span>· concierge Ruedda</span></div><div class="rds-s">en línea · respuestas al instante</div></div></div>'+
      '<div class="rds-log" aria-live="polite"></div>'+
      '<div class="rds-foot">¿prefieres hablar con una persona? <a href="'+WA+'" target="_blank" rel="noopener">WhatsApp</a> · <a href="mailto:'+MAIL+'">'+MAIL+'</a></div>'+
      '<form class="rds-bar clay" autocomplete="off"><input class="rds-in" type="text" enterkeyhint="send" placeholder="escribe tu pregunta…" maxlength="300" aria-label="tu pregunta">'+
      '<button class="rds-send" type="submit" disabled aria-label="enviar"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></form>'+
      '';
    view.appendChild(root);
    log=root.querySelector('.rds-log'); inp=root.querySelector('.rds-in'); btn=root.querySelector('.rds-send');
    inp.addEventListener('input',function(){ btn.disabled=!inp.value.trim()||busy; });
    root.querySelector('form').addEventListener('submit',function(e){ e.preventDefault(); ask(inp.value); });
    var saved=null; try{ saved=JSON.parse(sessionStorage.getItem(SK)||'null'); }catch(e){}
    if(saved&&saved.h&&saved.h.length){
      HIST=saved.h; lastTopic=saved.t||null;
      HIST.forEach(function(m){ addMsg(m.w,m.m,m.x,true); });
      log.querySelectorAll('.rds-row,.rds-m,.rds-acts').forEach(function(el){ el.style.animation='none'; });
    } else {
      addMsg('b','¡Hola'+nm()+'! Soy **'+NAME+'**, tu concierge en **Ruedda**. Pregúntame lo que quieras: vender, comprar, subastas, pagos, planes, tu cuenta…',CHIPS.map(function(c){ return {q:cap(c.replace(/[¿?]/g,''))}; }),true);
    }
    bottomOffset();
    window.addEventListener('resize',bottomOffset,{passive:true});
  }

  window.RDSupport={mount:mount, ask:function(q){ ask(q); }, _answer:answer, _kb:KB};
})();
