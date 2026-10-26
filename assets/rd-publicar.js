/* ─────────────────────────────────────────────────────────────
   RUEDDA · PUBLICAR PASO A PASO (V150)
   Pantalla completa, una pregunta por paso, avanza sola al tocar. Llega desde la
   hoja de vender de siempre (particular / subasta / concesionario / alquiler).
   No reemplaza la lógica de publicar: al final escribe los valores en el
   formulario de siempre (oculto) y llama a handlePublicar() / submitAlquilerForm(),
   así que planes, pagos, códigos, subida de fotos, reintentos y revisión son
   exactamente los mismos.
     · vive en un Shadow DOM: su CSS no toca el de la app ni al revés, y abrirlo no
       recalcula estilos del documento entero
     · se baja y compila en reposo (ver _pwLoad en index.html), nunca en el arranque
     · miniaturas de fotos decodificadas fuera del hilo principal (createImageBitmap)
     · solo transform/opacity en las transiciones; un paso en el DOM a la vez
     · borradores: campos en localStorage, fotos/videos/documentos en IndexedDB
     · volver deslizando desde el borde izquierdo: en la app iOS lo anima iOS
       (RDNT.edge* → window._rdLayer), en la web lo sigue el dedo
   ───────────────────────────────────────────────────────────── */
(function () {
  if (window.RDPW) return;

  var CSS = `
:host{all:initial;position:fixed;inset:0;z-index:290;display:block;visibility:hidden;pointer-events:none;contain:strict;font-family:var(--font,-apple-system,system-ui,sans-serif);
  --bg:#000;--c1:#111113;--c2:#1c1c1e;--c3:#2a2a2d;--fg:#fff;--in:#000;--m:rgba(255,255,255,.5);--m2:rgba(255,255,255,.3);--ln:rgba(255,255,255,.1);
  --dash:rgba(255,255,255,.22);--phc:rgba(255,255,255,.18);--shc:#0c0c0d;--fade:rgba(0,0,0,0);
  --ez:cubic-bezier(.32,.72,0,1);--sb:env(safe-area-inset-bottom);--st:env(safe-area-inset-top);color:var(--fg);-webkit-font-smoothing:antialiased}
:host([data-t=light]){--bg:#f6f6ef;--c1:#fff;--c2:#ebebe2;--c3:#d9d9ce;--fg:#15160e;--in:#fff;--m:rgba(21,22,14,.55);--m2:rgba(21,22,14,.34);--ln:rgba(20,22,10,.1);
  --dash:rgba(21,22,14,.24);--phc:rgba(21,22,14,.2);--shc:#fff;--fade:rgba(246,246,239,0)}
:host(.on){visibility:visible;pointer-events:auto}
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
button,input,textarea{font:inherit;color:inherit;background:none;border:0;outline:0;-webkit-appearance:none;appearance:none;border-radius:0}
button{cursor:pointer;text-align:inherit}
svg{display:block}
.pg{position:absolute;inset:0;display:flex;flex-direction:column;background:var(--bg);transform:translate3d(100%,0,0);will-change:transform}
.pg.in{transform:none;transition:transform .5s var(--ez)}
.pg.out{transform:translate3d(100%,0,0);transition:transform .38s cubic-bezier(.4,0,.6,1)}
.pg.ins{transition:none}
.wrap{position:relative;flex:1;display:flex;flex-direction:column;width:100%;max-width:520px;margin:0 auto;min-height:0}
header{position:relative;z-index:3;display:flex;align-items:center;gap:14px;padding:calc(var(--st) + 14px) 18px 10px}
.ib{width:38px;height:38px;border-radius:50%;background:var(--c2);display:grid;place-items:center;flex:none;transition:opacity .3s,transform .3s var(--ez)}
.ib:active{transform:scale(.92)}
.ib svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.ib.hid{opacity:0;pointer-events:none}
.bar{flex:1;height:3px;border-radius:3px;background:var(--c3);overflow:hidden}
.bar i{display:block;height:100%;width:0;background:var(--fg);border-radius:3px;transition:width .55s var(--ez)}
.stage{position:relative;flex:1;overflow:hidden}
.s{position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:18px 22px 150px;opacity:0;pointer-events:none;
  transform:translate3d(28px,0,0);transition:opacity .38s var(--ez),transform .5s var(--ez);background:var(--bg)}
.s.on{opacity:1;transform:none;pointer-events:auto}
.s.back{transform:translate3d(-28px,0,0)}
.s.ins{transition:none}
.s.drag{transition:none;box-shadow:-10px 0 30px rgba(0,0,0,.28)}
.k{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--m2);margin-bottom:12px;font-weight:500}
h1{font-size:30px;line-height:1.08;letter-spacing:-.03em;font-weight:400}
.sub{margin-top:10px;font-size:14px;line-height:1.5;color:var(--m);font-weight:300}
.blk{margin-top:28px}
.ft{position:absolute;left:0;right:0;bottom:0;z-index:3;padding:14px 22px calc(var(--sb) + 18px);
  background:linear-gradient(to bottom,var(--fade),var(--bg) 38%);transition:transform .45s var(--ez),opacity .3s}
.ft.hid{transform:translateY(110%);opacity:0;pointer-events:none}
.cta{width:100%;height:56px;border-radius:28px;background:var(--fg);color:var(--in);font-size:16px;font-weight:500;letter-spacing:-.01em;
  display:flex;align-items:center;justify-content:center;gap:10px;transition:opacity .3s,transform .2s var(--ez);text-align:center}
.cta:active{transform:scale(.98)}
.cta[disabled]{opacity:.22;pointer-events:none}
.cta .spn{width:18px;height:18px;border-radius:50%;border:2px solid var(--phc);border-top-color:var(--in);animation:rot .8s linear infinite;display:none}
.cta.ld .spn{display:block}.cta.ld span{display:none}
.cta.ld,.cta.ld[disabled]{opacity:1;pointer-events:none}
.ldt{height:0;overflow:hidden;text-align:center;font-size:12px;color:var(--m);transition:height .3s var(--ez),margin .3s var(--ez)}
.ldt.on{height:16px;margin-top:10px}
@keyframes rot{to{rotate:360deg}}
.alt{display:block;margin-top:22px;font-size:13px;color:var(--m);line-height:1.5;text-align:left}
.alt u{color:var(--fg);text-underline-offset:3px}
.cp{display:none;margin:-4px auto 12px;padding:4px 10px;font-size:13px;color:var(--m);letter-spacing:-.01em;text-decoration:underline;text-decoration-color:var(--m2);text-decoration-thickness:1px;text-underline-offset:4px;transition:opacity .2s}
.cp.on{display:block}.cp:active{opacity:.5}
.s.wcp{padding-bottom:186px}

/* fotos */
.ph{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
.ph .t{position:relative;aspect-ratio:1;border-radius:12px;overflow:hidden;background:var(--c2);animation:pop .45s var(--ez) both;-webkit-touch-callout:none}
.ph .t img{width:100%;height:100%;object-fit:cover;display:block;opacity:0;transition:opacity .35s;pointer-events:none;-webkit-user-drag:none}
.ph .t img.ok{opacity:1}
.ph .t:first-child{grid-column:span 2;grid-row:span 2}
.ph .t:first-child::after{content:'portada';position:absolute;left:8px;bottom:8px;font-size:11px;padding:5px 9px;border-radius:20px;color:#fff;background:rgba(0,0,0,.55);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
.ph .t .x{position:absolute;top:6px;right:6px;width:24px;height:24px;border-radius:50%;background:rgba(0,0,0,.55);display:grid;place-items:center;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);z-index:1}
.ph .t .x svg{width:11px;height:11px;stroke:#fff;stroke-width:2.4;fill:none}
.ph .t.lift{z-index:5;animation:none;box-shadow:0 18px 40px rgba(0,0,0,.45);transition:box-shadow .2s;will-change:transform}
.ph .t.lift .x{opacity:0}
.ph .add{aspect-ratio:1;border-radius:12px;border:1px dashed var(--dash);display:grid;place-items:center;color:var(--m)}
.ph .add svg{width:22px;height:22px;stroke:currentColor;stroke-width:1.8;fill:none}
.drop{width:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;height:260px;border-radius:22px;background:var(--c1);border:1px solid var(--ln);text-align:center}
.drop .o{width:58px;height:58px;border-radius:50%;background:var(--fg);color:var(--in);display:grid;place-items:center}
.drop .o svg{width:24px;height:24px;stroke:currentColor;stroke-width:2;fill:none}
.drop b{font-weight:500;font-size:16px}.drop small{color:var(--m);font-size:13px;font-weight:300}
.cnt{display:flex;align-items:center;gap:10px;margin:18px 0 12px;font-size:13px;color:var(--m)}
.cnt .r{width:22px;height:22px}.cnt .r circle{fill:none;stroke-width:2.5}
.cnt .r .a{stroke:var(--c3)}.cnt .r .b{stroke:var(--fg);stroke-linecap:round;transition:stroke-dashoffset .5s var(--ez);transform:rotate(-90deg);transform-origin:50% 50%}
.cnt.ok{color:var(--fg)}
.tip{margin-top:14px;font-size:12px;color:var(--m2);line-height:1.6;font-weight:300}
@keyframes pop{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:none}}

/* buscador */
.srch{position:relative;margin-bottom:14px}
.srch input{width:100%;height:46px;border-radius:14px;background:var(--c2);padding:0 16px 0 42px;font-size:16px}
.srch input::placeholder{color:var(--m2)}
.srch input::-webkit-search-cancel-button{-webkit-appearance:none}
.srch svg{position:absolute;left:14px;top:14px;width:18px;height:18px;stroke:var(--m);fill:none;stroke-width:2}

/* marcas */
.mg{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.mc{position:relative;aspect-ratio:1/.9;border-radius:16px;background:var(--c2);transition:transform .25s var(--ez),background .25s}
.mc:active{transform:scale(.95)}
.mc .lg{position:absolute;left:0;right:0;top:4%;height:70%;display:flex;align-items:center;justify-content:center;pointer-events:none}
.mc span,.ph .t .x svg,.ic svg,.ib svg,.drop *{pointer-events:none}
.mc svg{fill:currentColor;color:var(--fg)}
.mc span{position:absolute;left:0;right:0;bottom:11px;text-align:center;font-size:11px;color:var(--m)}
.mc .lg .tx{position:static;font-size:15px;font-weight:500;letter-spacing:-.01em;color:var(--fg);padding:0 6px}
.mc.sel{background:var(--fg)}.mc.sel svg{color:var(--in)}.mc.sel span,.mc.sel .tx{color:var(--in)}

/* chips */
.ch{display:flex;flex-wrap:wrap;gap:8px}
.c{height:44px;padding:0 18px;border-radius:22px;background:var(--c2);font-size:15px;display:inline-flex;align-items:center;gap:8px;
  transition:background .25s,color .25s,transform .25s var(--ez)}
.c:active{transform:scale(.96)}
.c.sel{background:var(--fg);color:var(--in)}
.row{padding:20px 0;border-bottom:1px solid var(--ln);transition:opacity .35s}
.row:last-child{border-bottom:0}
.row .lb{display:flex;justify-content:space-between;align-items:baseline;font-size:13px;color:var(--m);margin-bottom:12px}
.row .lb em{font-style:normal;color:var(--fg);opacity:0;transition:opacity .3s;text-align:right;margin-left:12px}
.row.done .lb em{opacity:1}
.row.wait{opacity:.32}
.yg{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.yg .c{justify-content:center;padding:0}

/* inputs grandes */
.big{display:flex;align-items:baseline;gap:8px;border-bottom:1px solid var(--dash);padding-bottom:10px;transition:border-color .3s}
.big:focus-within{border-color:var(--fg)}
.big input{flex:1;min-width:0;font-size:44px;font-weight:300;letter-spacing:-.03em}
.big input::placeholder{color:var(--phc)}
.big .u{font-size:18px;color:var(--m)}
.big .un{display:flex;gap:2px;align-self:center}
.big .un button{font-size:15px;color:var(--m2);padding:6px 7px;transition:color .25s}
.big .un button.on{color:var(--fg)}
.big .pre{font-size:44px;font-weight:300;color:var(--m)}
.fld{margin-top:22px}
.fld label{display:block;font-size:13px;color:var(--m);margin-bottom:8px}
.fld input,.inp{width:100%;height:52px;border-radius:14px;background:var(--c2);padding:0 16px;font-size:17px}
.fld input::placeholder,.inp::placeholder{color:var(--m2)}
.inp[type=date],.inp[type=time]{font-size:16px;padding:0 14px}
:host(:not([data-t=light])) .inp[type=date],:host(:not([data-t=light])) .inp[type=time]{color-scheme:dark}
.sug{margin-top:14px}
.hint{margin-top:14px;font-size:13px;color:var(--m);line-height:1.5;font-weight:300}
.stp{display:flex;gap:10px;margin-top:20px}
.stp button{flex:1;height:50px;border-radius:25px;background:var(--c2);font-size:22px;font-weight:300;text-align:center;transition:transform .2s var(--ez),background .2s;touch-action:manipulation;-webkit-user-select:none;user-select:none}
.stp button:active{transform:scale(.96);background:var(--c3)}

/* colores */
.cg{display:grid;grid-template-columns:repeat(4,1fr);gap:14px 8px}
.sw{display:flex;flex-direction:column;align-items:center;gap:8px;font-size:12px;color:var(--m)}
.sw i{width:52px;height:52px;border-radius:50%;box-shadow:inset 0 0 0 1px var(--ln);transition:transform .25s var(--ez),box-shadow .25s}
.sw.sel i{box-shadow:0 0 0 2px var(--bg),0 0 0 4px var(--fg);transform:scale(1.04)}
.sw.sel{color:var(--fg)}

/* lista */
.ls{border-radius:16px;background:var(--c1);overflow:hidden}
.ls button{display:flex;justify-content:space-between;align-items:center;width:100%;height:52px;padding:0 18px;font-size:16px;border-bottom:1px solid var(--ln)}
.ls button:last-child{border-bottom:0}
.ls button:active,.ls button.sel{background:var(--c2)}
.ls button svg{width:16px;height:16px;stroke:var(--m2);fill:none;stroke-width:2}

/* tarjetas */
.cards{display:flex;flex-direction:column;gap:8px}
.cd{display:flex;justify-content:space-between;align-items:center;padding:20px;border-radius:18px;background:var(--c2);transition:background .25s,color .25s,transform .25s var(--ez)}
.cd:active{transform:scale(.98)}
.cd b{display:block;font-size:17px;font-weight:500;letter-spacing:-.01em}
.cd small{display:block;margin-top:4px;font-size:13px;color:var(--m);font-weight:300}
.cd.sel{background:var(--fg);color:var(--in)}.cd.sel small{color:var(--in);opacity:.6}
.seg{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.seg .cd{justify-content:center;text-align:center;padding:26px 12px}
.warn{margin-top:10px;font-size:12px;color:#ff9f0a;line-height:1.5;display:none}
.warn.on{display:block}
.ta{display:block;width:100%;min-height:170px;border-radius:16px;background:var(--c2);padding:16px;font-size:16px;line-height:1.5;resize:none}
.ta::placeholder{color:var(--m2)}
.meter{display:flex;justify-content:space-between;align-items:center;margin-top:10px;font-size:12px;color:var(--m)}
.meter .mb{flex:1;height:3px;border-radius:3px;background:var(--c3);margin-right:12px;overflow:hidden}
.meter .mb i{display:block;height:100%;width:0;background:var(--fg);transition:width .3s var(--ez)}
.meter.ok{color:var(--fg)}
.add-ch{margin-top:14px}
.add-ch .c{height:36px;padding:0 14px;gap:5px;font-size:13px;color:var(--m)}
.add-ch .c::before{content:"+"}
.tel{display:flex;align-items:center;gap:10px;height:56px;border-radius:16px;background:var(--c2);padding:0 16px}
.tel span{font-size:17px;color:var(--m)}
.tel input{flex:1;min-width:0;font-size:19px;letter-spacing:.01em}
.tel input::placeholder{color:var(--m2)}

/* interruptor */
.sw2{display:flex;align-items:center;gap:14px;width:100%;padding:18px;border-radius:18px;background:var(--c1)}
.sw2 .tx{flex:1;min-width:0}
.sw2 b{display:block;font-size:16px;font-weight:500}
.sw2 small{display:block;margin-top:3px;font-size:12px;color:var(--m);font-weight:300;line-height:1.45}
.tg{position:relative;width:50px;height:30px;border-radius:15px;background:var(--c3);flex:none;transition:background .3s}
.tg::after{content:'';position:absolute;left:3px;top:3px;width:24px;height:24px;border-radius:50%;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.18);transition:transform .35s var(--ez)}
.tg.on{background:#34c759}.tg.on::after{transform:translateX(20px)}
.rev{overflow:hidden;max-height:0;opacity:0;transition:max-height .5s var(--ez),opacity .35s,margin .35s}
.rev.on{max-height:900px;opacity:1;margin-top:10px}

/* extras */
.xl{display:flex;flex-direction:column;gap:8px}
.xr{display:flex;align-items:center;gap:14px;padding:16px;border-radius:18px;background:var(--c1);width:100%}
.ic{width:42px;height:42px;border-radius:12px;background:var(--c2);display:grid;place-items:center;flex:none}
.ic svg{width:20px;height:20px;stroke:var(--fg);fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.xr .tx{flex:1;min-width:0}
.xr b{display:block;font-size:15px;font-weight:500}
.xr small{display:block;margin-top:2px;font-size:12px;color:var(--m);font-weight:300;line-height:1.4}
.xr em{font-style:normal;font-size:12px;color:var(--m);flex:none}
.xr.ok em{color:var(--fg)}
.code{display:flex;gap:8px;margin-top:10px}
.code input{flex:1;min-width:0;height:46px;border-radius:12px;background:var(--c2);padding:0 14px;font-size:15px;letter-spacing:.08em;text-transform:uppercase}
.code input::placeholder{text-transform:none;letter-spacing:0;color:var(--m2)}
.code button{height:46px;padding:0 18px;border-radius:12px;background:var(--fg);color:var(--in);font-size:14px;font-weight:500}
.cmsg{margin-top:8px;font-size:12px;color:var(--m)}
.cmsg.ok{color:#34c759}.cmsg.bad{color:#ff5a52}
.fot{margin-top:18px;padding:18px;border-radius:18px;border:1px solid var(--ln)}
.fot b{display:block;font-size:15px;font-weight:500}
.fot p{margin-top:6px;font-size:13px;color:var(--m);line-height:1.5;font-weight:300}
.fot button{margin-top:12px;font-size:13px;text-decoration:underline;text-underline-offset:3px}

/* calendario */
.cal{border-radius:18px;background:var(--c1);padding:14px}
.cal .hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.cal .hd b{font-size:15px;font-weight:500;text-transform:capitalize}
.cal .hd button{width:34px;height:34px;border-radius:50%;background:var(--c2);display:grid;place-items:center;transition:opacity .2s}
.cal .hd svg{width:14px;height:14px;stroke:var(--fg);fill:none;stroke-width:2}
.cal .g{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
.cal .wd{font-size:11px;color:var(--m2);text-align:center;padding:4px 0}
.cal .dy{aspect-ratio:1;border-radius:50%;font-size:14px;display:grid;place-items:center;text-align:center;transition:background .2s,color .2s}
.cal .dy.sel{background:var(--fg);color:var(--in)}
.cal .dy.past{color:var(--m2);opacity:.5;pointer-events:none}
.cal-q{margin-top:12px}
.cal-n{margin-top:10px;font-size:12px;color:var(--m)}

/* resumen */
.pv{border-radius:20px;overflow:hidden;background:var(--c1)}
.pv .im{aspect-ratio:16/10;background:var(--c2)}
.pv .im img{width:100%;height:100%;object-fit:cover;display:block}
.pv .in{padding:16px 18px 18px}
.pv .tt{font-size:19px;font-weight:500;letter-spacing:-.02em}
.pv .mt{margin-top:4px;font-size:13px;color:var(--m)}
.pv .pr{margin-top:12px;font-size:24px;font-weight:500;letter-spacing:-.02em}
.sm{margin-top:18px;border-radius:16px;background:var(--c1);overflow:hidden}
.sm button{display:flex;justify-content:space-between;align-items:center;gap:12px;width:100%;min-height:52px;padding:12px 18px;border-bottom:1px solid var(--ln)}
.sm button:last-child{border-bottom:0}
.sm button:active{background:var(--c2)}
.sm span{font-size:14px;color:var(--m);flex:none}
.sm b{flex:1;min-width:0;font-weight:400;font-size:15px;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sm button::after{content:'';width:7px;height:7px;border-top:1.5px solid var(--m2);border-right:1.5px solid var(--m2);transform:rotate(45deg);flex:none;margin-left:-4px}

/* listo */
.done-s{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;min-height:72%}
.ck{width:76px;height:76px;margin-bottom:30px}
.ck circle{fill:none;stroke:var(--fg);stroke-width:2;stroke-dasharray:227;stroke-dashoffset:227;transition:stroke-dashoffset .9s var(--ez)}
.ck path{fill:none;stroke:var(--fg);stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:40;stroke-dashoffset:40;transition:stroke-dashoffset .5s .55s var(--ez)}
.s.on .ck circle,.s.on .ck path{stroke-dashoffset:0}
.skip{display:block;margin:14px 0 0;width:100%;text-align:center;font-size:13px;color:var(--m);padding:8px 10px}
.saved{position:absolute;top:calc(var(--st) + 62px);left:0;right:0;text-align:center;font-size:11px;color:var(--m2);letter-spacing:.04em;opacity:0;transition:opacity .4s;pointer-events:none;z-index:2}
.saved.on{opacity:1}

/* hoja salir */
.shb{position:absolute;inset:0;z-index:8;background:rgba(0,0,0,.5);opacity:0;pointer-events:none;transition:opacity .35s}
.shb.on{opacity:1;pointer-events:auto}
.sh{position:absolute;left:0;right:0;bottom:0;z-index:9;max-width:520px;margin:0 auto;background:var(--shc);border-radius:26px 26px 0 0;padding:10px 22px calc(var(--sb) + 18px);
  transform:translateY(105%);visibility:hidden;transition:transform .5s var(--ez),visibility 0s linear .5s}
.sh.on{transform:none;visibility:visible;transition:transform .5s var(--ez),visibility 0s}
.sh .gr{display:block;width:36px;height:4px;border-radius:4px;background:var(--c3);margin:0 auto 20px}
.sh b{display:block;font-size:20px;font-weight:500;letter-spacing:-.02em}
.sh p{margin:8px 0 22px;font-size:14px;color:var(--m);line-height:1.5;font-weight:300}
.sb2{display:block;width:100%;height:50px;margin-top:8px;border-radius:25px;background:var(--c2);font-size:15px;text-align:center}
.sb2.red{background:none;color:#ff5a52}
.shade{position:absolute;inset:0;background:#000;opacity:0;pointer-events:none;z-index:0}
@media (prefers-reduced-motion:reduce){*{transition-duration:.01ms!important;animation-duration:.01ms!important}}
`;

  /* —— datos (mismos valores que los <select> del formulario de siempre) —— */
  var MODELOS = {'Toyota':['Corolla','Hilux','Fortuner','4Runner','Yaris','Land Cruiser','Prado','Camry','RAV4','FJ Cruiser','Tacoma','Terios'],
    'Chevrolet':['Aveo','Optra','Spark','Cruze','Silverado','Tahoe','Captiva','Grand Vitara','Corsa','Malibu','Camaro','Trailblazer'],
    'Ford':['Explorer','Fiesta','Focus','F-150','Ranger','EcoSport','Mustang','Fusion','Escape','Bronco','Expedition'],
    'Hyundai':['Elantra','Accent','Tucson','Santa Fe','Getz','Creta','Sonata','i10'],'Kia':['Rio','Sportage','Picanto','Cerato','Sorento','Seltos'],
    'Mitsubishi':['Lancer','Montero','L200','Outlander','ASX','Signo'],'Jeep':['Grand Cherokee','Cherokee','Wrangler','Compass','Renegade','Liberty'],
    'Nissan':['Sentra','Frontier','Patrol','X-Trail','Kicks','Versa','Tiida'],'Honda':['Civic','Accord','CR-V','Fit','Pilot','HR-V'],
    'Mazda':['Mazda 3','Mazda 6','CX-5','CX-30','BT-50','MX-5'],'BMW':['Serie 3','Serie 5','X3','X5','X6','M3','M4'],
    'Mercedes-Benz':['Clase C','Clase E','GLE','GLC','Clase G','Clase A'],'Volkswagen':['Gol','Jetta','Golf','Tiguan','Amarok','Polo'],
    'Chery':['Tiggo 2','Tiggo 4','Tiggo 7','Tiggo 8','Arauca','Orinoco'],'Renault':['Logan','Sandero','Duster','Clio','Megane'],
    'Peugeot':['206','207','208','307','2008','3008'],'Fiat':['Palio','Siena','Uno','Strada','Fiorino'],'Dodge':['Charger','Challenger','Durango','Journey']};
  var VAG = ['volkswagen','porsche','audi','seat','skoda','bentley','lamborghini'];
  var COLORES = [['negro','#0b0b0b'],['blanco','#f4f4f2'],['gris','#6d6f73'],['plata','#c3c6cb'],['azul','#1f3f8f'],['rojo','#b3141c'],['verde','#2e5e3a'],
    ['beige','#d8c7a5'],['marrón','#5a3a26'],['vino','#5c0f1f'],['amarillo','#e9c41c'],['naranja','#e2671b']];
  var CARROCERIA = [['sedan','Sedán'],['suv','SUV'],['camioneta','Camioneta'],['pickup','Pickup'],['hatchback','Hatchback'],['crossover','Crossover'],['coupe','Coupé'],
    ['descapotable','Descapotable'],['wagon','Wagon'],['minivan','Minivan'],['van','Van'],['fastback','Fastback'],['roadster','Roadster'],['hothatch','HotHatch'],
    ['liftback','Liftback'],['targa','Targa'],['buggy','Buggy']];
  var MODS = [['original','Original'],['esteticas-menores','Estéticas menores'],['estetica','Estética'],['estetica-mecanica','Estética y mecánica'],['swap','Swap de motor']];
  var TRANS = [['automática','automática'],['sincrónica','sincrónica'],['auto CVT','CVT'],['DSG','DSG'],['DCT','DCT'],['automática con levas','con levas'],['secuencial','secuencial']];
  var COMB = [['gasolina','gasolina'],['diesel','diésel'],['híbrido','híbrido'],['eléctrico','eléctrico']];
  var MOTOR = [['3 cyl','3 cil'],['4 cyl','4 cil'],['5 cyl','5 cil'],['6 cyl','6 cil'],['8 cyl','8 cil'],['10 cyl','10 cil'],['12 cyl','12 cil'],['rotativo','rotativo'],['eléctrico','eléctrico']];
  var TRAC = [['FWD','FWD'],['RWD','RWD'],['AWD','AWD'],['4x4','4x4'],['unknown','no lo sé']];
  var ESTADOF = ['impecable','excelente','bueno','con detalles','para reparar'];
  var DANOS = ['Frontal leve','Frontal moderado','Frontal severo','Lateral izquierdo','Lateral derecho','Trasero leve','Trasero moderado','Trasero severo','Volcamiento','Hundimiento de techo','Daño múltiple'];
  var ESTADOS = ['enciende y rueda','enciende pero no rueda','no enciende','quemado','pérdida total'];
  var CLASES = [['comercial','Comercial','Para el día a día.'],['deportivo','Deportivo','Hecho para manejar.'],['clasico','Clásico','Con historia.'],['nicho','De nicho','Para conocedores.']];
  var DURS = [1,3,5,7,10,15,25];
  var FRASES = {
    venta:['mantenimiento al día','único dueño','papeles al día','nunca chocado','aire acondicionado funcionando','cauchos nuevos','full equipo','se acepta revisión mecánica'],
    subasta:['mantenimiento al día','papeles al día','se acepta revisión mecánica','motor revisado','cauchos en buen estado','aire acondicionado funcionando'],
    alquiler:['aire acondicionado','bluetooth','cámara de retroceso','tanque lleno al entregar','kilometraje libre','ideal para viajes']
  };
  var IC = {
    video:'<svg viewBox="0 0 24 24"><rect x="3" y="6" width="13" height="12" rx="3"/><path d="M16 10l5-3v10l-5-3"/></svg>',
    doc:'<svg viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>',
    sello:'<svg viewBox="0 0 24 24"><path d="M12 3l2.4 1.8 3-.2.9 2.8 2.4 1.8-1 2.8 1 2.8-2.4 1.8-.9 2.8-3-.2L12 21l-2.4-1.8-3 .2-.9-2.8L3.3 14.8l1-2.8-1-2.8 2.4-1.8.9-2.8 3 .2z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg>',
    plus:'<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    x:'<svg viewBox="0 0 12 12"><path d="M2 2l8 8M10 2l-8 8"/></svg>',
    chev:'<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>'
  };
  var DMIN = 60, MAX_FOTOS = 40, MAX_VIDEOS = 3, MAX_VIDEO_BYTES = 500 * 1024 * 1024, MAX_DOCS = 10, MAX_DRAFTS = 12;

  /* —— utilidades —— */
  function h(t, a, c) {
    var e = document.createElement(t);
    if (a) for (var k in a) {
      if (k === 'html') e.innerHTML = a[k];
      else if (k === 'on') for (var ev in a.on) e.addEventListener(ev, a.on[ev]);
      else if (a[k] != null) e.setAttribute(k, a[k]);
    }
    if (c) c.forEach(function (x) { if (x != null && x !== false) e.appendChild(typeof x === 'string' ? document.createTextNode(x) : x); });
    return e;
  }
  function buzz(s) { try { if (window._rdHapticNow && window._rdHapticNow(s || 'LIGHT')) return; } catch (e) {} try { navigator.vibrate && navigator.vibrate(6); } catch (e) {} }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function num(v) { return parseInt(String(v == null ? '' : v).replace(/\D/g, ''), 10) || 0; }
  function has(v) { return v != null && v !== ''; }
  function norm(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function selOnly(box, el) { [].forEach.call(box.children, function (x) { x.classList.remove('sel'); }); el.classList.add('sel'); }
  function toast(t, ok) { try { showToast(t, ok); } catch (e) {} }
  function later(f) { setTimeout(f, 260); }
  function label(list, v) { var m = list.filter(function (x) { return x[0] === v; })[0]; return m ? m[1] : (v || ''); }
  function uid() { try { return crypto.randomUUID(); } catch (e) { return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); } }
  function userKey() { try { return (typeof USER_STATE !== 'undefined' && USER_STATE.id) || 'anon'; } catch (e) { return 'anon'; } }
  function optionsOf(id) { var s = document.getElementById(id); return s ? [].map.call(s.options, function (o) { return o.value; }).filter(Boolean) : []; }

  /* —— miniaturas: se decodifican fuera del hilo principal, una a la vez —— */
  var tq = Promise.resolve();
  function thumb(p) {
    if (p.t || p._q) return;
    p._q = 1;
    tq = tq.then(function () { return mkThumb(p.file); }).then(function (u) {
      p.t = u; p._q = 0;
      (p._imgs || []).forEach(function (im) { setSrc(im, u); }); p._imgs = null;
    });
  }
  function mkThumb(f) {
    var fallback = function () { return URL.createObjectURL(f); };
    if (!window.createImageBitmap || !f) return Promise.resolve(fallback());
    return createImageBitmap(f).then(function (b) {
      var s = Math.min(1, 720 / Math.max(b.width, b.height)), c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(b.width * s)); c.height = Math.max(1, Math.round(b.height * s));
      c.getContext('2d').drawImage(b, 0, 0, c.width, c.height);
      if (b.close) b.close();
      return new Promise(function (r) { c.toBlob(function (bl) { r(bl ? URL.createObjectURL(bl) : fallback()); }, 'image/jpeg', 0.84); });
    }).catch(fallback);
  }
  function setSrc(im, u) { im.onload = function () { im.classList.add('ok'); }; im.src = u; if (im.complete && im.naturalWidth) im.classList.add('ok'); }
  function img(p) {
    var im = h('img', { alt: '', decoding: 'async', draggable: 'false' });
    if (p.t) setSrc(im, p.t); else { (p._imgs = p._imgs || []).push(im); thumb(p); }
    return im;
  }
  function freeFotos(list) { (list || []).forEach(function (p) { if (p.t) { try { URL.revokeObjectURL(p.t); } catch (e) {} } }); }

  /* —— borradores —— */
  var LS = function () { return 'rd_pw_drafts_' + userKey(); };
  function drafts() { try { var a = JSON.parse(localStorage.getItem(LS()) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function putDrafts(a) { try { localStorage.setItem(LS(), JSON.stringify(a.slice(0, MAX_DRAFTS))); return true; } catch (e) { return false; } }
  var DBP = null;
  function db() {
    if (DBP) return DBP;
    DBP = new Promise(function (ok, ko) {
      try {
        var r = indexedDB.open('rd-pw', 1);
        r.onupgradeneeded = function () { r.result.createObjectStore('f'); };
        r.onsuccess = function () { ok(r.result); };
        r.onerror = function () { ko(r.error); };
      } catch (e) { ko(e); }
    });
    DBP.catch(function () { DBP = null; });
    return DBP;
  }
  function idb(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (ok, ko) {
        var t = d.transaction('f', mode), st = t.objectStore('f'), out;
        var r = fn(st); if (r) r.onsuccess = function () { out = r.result; };
        t.oncomplete = function () { ok(out); };
        t.onerror = t.onabort = function () { ko(t.error); };
      });
    });
  }
  function idbPut(k, v) { return idb('readwrite', function (s) { s.put(v, k); }); }
  function idbGet(k) { return idb('readonly', function (s) { return s.get(k); }); }
  function idbDel(k) { return idb('readwrite', function (s) { s.delete(k); s.delete(k + ':v'); }); }
  function coverOf(p) {
    return new Promise(function (r) {
      if (!p || !p.t) return r('');
      var im = new Image();
      im.onload = function () {
        try {
          var s = 200 / Math.max(im.naturalWidth, im.naturalHeight), c = document.createElement('canvas');
          c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s);
          c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
          r(c.toDataURL('image/jpeg', 0.7));
        } catch (e) { r(''); }
      };
      im.onerror = function () { r(''); };
      im.src = p.t;
    });
  }

  /* —— estado —— */
  var host = null, root = null, R = {};
  var K = 'venta', PVT = 'particular', d = {}, F = { fotos: [], videos: [], docs: [] };
  var DID = null, cur = null, ret = null, els = {}, busy = 0, isOpen = false, filesDirty = false, coverCache = '';

  var S = {
    fotos:{k:'fotos',t:'Empecemos por<br>las fotos.',s:'Mínimo 3, ideal 10 o más. La primera es la portada.',r:rFotos,ok:function(){return F.fotos.length>=3;}},
    marca:{k:'el carro',t:'¿Qué marca es?',r:rMarca,auto:1},
    modelo:{k:'el carro',t:'¿Qué modelo?',r:rModelo,ok:function(){return has(d.modelo&&d.modelo.trim());}},
    anio:{k:'el carro',t:'¿De qué año?',r:rAnio,auto:1},
    cond:{k:'el carro',t:'¿Nuevo o usado?',r:rCond,auto:1},
    km:{k:'el carro',t:'¿Cuántos kilómetros tiene?',r:rKm,ok:function(){return num(d.km)>0;},skip:function(){return K==='venta'&&d.cond==='nuevo';}},
    meca:{k:'lo técnico',t:'Lo técnico.',s:'Toca y seguimos solos.',r:rMeca,auto:1},
    carro:{k:'el carro',t:'¿Qué tipo de carro es?',r:rCarro,auto:1},
    color:{k:'el carro',t:'¿De qué color?',r:rColor,auto:1},
    hist:{k:'su historia',t:'Su historia.',s:'Lo que el comprador quiere saber.',r:rHist,auto:1},
    choque:{k:'su historia',t:'¿Está chocado?',r:rChoque,auto:1,skip:function(){return K==='venta'&&d.cond==='nuevo';}},
    ciudad:{k:'ubicación',t:'¿Dónde está el carro?',r:rCiudad,auto:1},
    clase:{k:'el carro',t:'¿Cómo lo clasificas?',r:rClase,auto:1},
    precio:{k:'precio',t:'¿En cuánto lo vendes?',s:'En dólares. Puedes cambiarlo cuando quieras.',r:rPrecio,ok:function(){return num(d.precio)>0;}},
    finan:{k:'precio',t:'¿Ofreces financiamiento?',r:rFinan,ok:function(){return !d.finan||(d.finanTxt||'').trim().length>=10;}},
    base:{k:'subasta',t:'¿Desde cuánto arranca?',s:'El precio base que ven todos. Si lo dejas en 0, arranca en 0.',r:rBase},
    dur:{k:'subasta',t:'¿Cuánto dura la subasta?',r:rDur,auto:1},
    prog:{k:'subasta',t:'¿Cuándo empieza?',r:rProg,ok:function(){return has(d.prog)&&(d.prog!=='prog'||futuro());},autoIf:function(){return d.prog!=='prog';}},
    dir:{k:'alquiler',t:'¿Dónde se recoge?',s:'La dirección donde entregas el carro.',r:rDir,ok:function(){return (d.dir||'').trim().length>=4;}},
    pdia:{k:'alquiler',t:'¿Cuánto por día?',s:'En dólares.',r:rPdia,ok:function(){return num(d.pdia)>0;}},
    dispo:{k:'alquiler',t:'¿Qué días está disponible?',s:'Toca los días. Puedes cambiarlo después.',r:rDispo,ok:function(){return (d.dias||[]).length>0;}},
    desc:{k:'descripción',t:'Cuéntalo como si lo vendieras en persona.',r:rDesc,ok:function(){return (d.desc||'').trim().length>=DMIN;}},
    req:{k:'alquiler',t:'¿Qué requisitos pides?',s:'Lo mínimo que necesita quien lo alquila.',r:rReq,ok:function(){return (d.req||'').trim().length>=4;}},
    contacto:{k:'contacto',t:'¿A qué WhatsApp te escriben?',r:rContacto,ok:function(){return String(d.wa||'').length>=10;}},
    extras:{k:'opcional',t:'Suma confianza.',s:'Nada de esto es obligatorio, pero vende más.',r:rExtras},
    rev:{k:'revisa',t:'Así se verá.',r:rRev,cta:function(){return K==='alquiler'?'enviar a revisión':PVT==='consesionario'?'publicar vehículo':'publicar';}},
    fin:{r:rFin}
  };
  var FLOWS = {
    venta:['fotos','marca','modelo','anio','cond','km','meca','carro','color','hist','choque','ciudad','clase','precio','finan','desc','contacto','extras','rev','fin'],
    subasta:['fotos','marca','modelo','anio','km','meca','carro','color','hist','choque','ciudad','clase','base','dur','prog','desc','extras','rev','fin'],
    alquiler:['fotos','marca','modelo','anio','dir','pdia','dispo','desc','req','rev','fin']
  };
  function kindOf(pvt) { return pvt === 'subasta' ? 'subasta' : pvt === 'alquiler' ? 'alquiler' : 'venta'; }
  function flow() { return FLOWS[K].filter(function (id) { return !(S[id].skip && S[id].skip()); }); }
  function isAuto(st) { return st.autoIf ? st.autoIf() : !!st.auto; }

  /* —— armado de la pantalla (una sola vez) —— */
  function build() {
    if (host) return;
    host = document.createElement('div');
    host.id = 'rdpw';
    host.setAttribute('role', 'dialog'); host.setAttribute('aria-modal', 'true'); host.setAttribute('aria-label', 'publicar');
    root = host.attachShadow({ mode: 'open' });
    var st = document.createElement('style'); st.textContent = CSS; root.appendChild(st);
    var pg = h('div', { 'class': 'pg' });
    var wrap = h('div', { 'class': 'wrap' });
    R.bk = h('button', { 'class': 'ib', 'aria-label': 'atrás', html: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>', on: { click: function () { back(); } } });
    R.pb = h('i');
    R.cl = h('button', { 'class': 'ib', 'aria-label': 'cerrar', html: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>', on: { click: askExit } });
    wrap.appendChild(h('header', null, [R.bk, h('div', { 'class': 'bar' }, [R.pb]), R.cl]));
    R.sv = h('div', { 'class': 'saved' }, ['borrador guardado']);
    wrap.appendChild(R.sv);
    R.stage = h('div', { 'class': 'stage' });
    wrap.appendChild(R.stage);
    R.go = h('button', { 'class': 'cta' }, [h('span', null, ['continuar']), h('i', { 'class': 'spn' })]);
    R.go.addEventListener('click', function () { if (cur === 'rev') publicar(); else next(); });
    R.ldt = h('div', { 'class': 'ldt', 'aria-live': 'polite' });
    R.cp = h('button', { 'class': 'cp', on: { click: function () { try { openPricingSheet(true); } catch (e) {} } } }, ['Consultar precios']);
    R.ft = h('div', { 'class': 'ft' }, [R.cp, R.go, R.ldt]);
    wrap.appendChild(R.ft);
    pg.appendChild(wrap);
    R.pg = pg;
    root.appendChild(pg);
    R.shb = h('div', { 'class': 'shb', on: { click: function () { sheet(false); } } });
    R.sh = h('div', { 'class': 'sh', role: 'dialog', 'aria-label': 'salir' }, [
      h('i', { 'class': 'gr' }), h('b', null, ['¿Guardar como borrador?']),
      h('p', null, ['Lo encuentras en Mis publicaciones y sigues donde lo dejaste.']),
      h('button', { 'class': 'cta', on: { click: function () { sheet(false); saveDraft(true).then(function () { toast('borrador guardado en mis publicaciones', true); }); close(); } } }, [h('span', null, ['guardar borrador'])]),
      h('button', { 'class': 'sb2', on: { click: function () { sheet(false); } } }, ['seguir editando']),
      h('button', { 'class': 'sb2 red', on: { click: function () { sheet(false); discard(); close(); } } }, ['descartar'])
    ]);
    root.appendChild(R.shb); root.appendChild(R.sh);
    R.fi = h('input', { type: 'file', accept: 'image/*', multiple: '', hidden: '' });
    R.fv = h('input', { type: 'file', accept: 'video/*', multiple: '', hidden: '' });
    R.fd = h('input', { type: 'file', accept: 'image/*,application/pdf', multiple: '', hidden: '' });
    root.appendChild(R.fi); root.appendChild(R.fv); root.appendChild(R.fd);
    R.fi.addEventListener('change', function () { addFotos(this.files); this.value = ''; });
    R.fv.addEventListener('change', function () { addVideos(this.files); this.value = ''; });
    R.fd.addEventListener('change', function () { addDocs(this.files); this.value = ''; });
    // los gestos de la app (swipe de salida de posts, pull-to-refresh) no ven lo que pasa aquí adentro
    ['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach(function (ev) { host.addEventListener(ev, function (e) { e.stopPropagation(); }, { passive: true }); });
    host.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); if (R.sh.classList.contains('on')) sheet(false); else back(); } });
    // teclado iOS: el botón sube con el teclado
    if (window.visualViewport) {
      var vv = visualViewport, fit = function () { if (!isOpen) return; var k = Math.max(0, innerHeight - vv.height - vv.offsetTop); R.ft.style.paddingBottom = k > 40 ? (k + 12) + 'px' : ''; };
      vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit);
    }
    // la app se va a segundo plano: que las fotos queden guardadas por si iOS la cierra
    document.addEventListener('visibilitychange', function () { if (document.hidden && isOpen && cur !== 'fin' && meaningful()) saveDraft(true); });
    edgeWeb();
    document.body.appendChild(host);
  }

  /* —— pasos —— */
  function section(id, dir) {
    var st = S[id];
    var el = h('section', { 'class': 's' + (dir < 0 ? ' back' : '') });
    if (st.k) el.appendChild(h('div', { 'class': 'k' }, [st.k]));
    if (st.t) el.appendChild(h('h1', { html: st.t }));
    var sub = typeof st.s === 'function' ? st.s() : st.s;
    if (sub) el.appendChild(h('p', { 'class': 'sub' }, [sub]));
    st.r(el, st);
    return el;
  }
  function show(id, dir, instant) {
    if (!S[id]) return;
    var old = cur && els[cur];
    var el = section(id, dir);
    if (instant) el.classList.add('ins');
    R.stage.appendChild(el);
    els = {}; els[id] = el;
    if (old && old !== el) {
      old.classList.remove('on');
      if (dir < 0) old.classList.remove('back'); else old.classList.add('back');
      old.style.pointerEvents = 'none';
      var o = old; setTimeout(function () { o.remove(); }, instant ? 0 : 520);
    }
    if (instant) { el.classList.remove('back'); el.classList.add('on'); requestAnimationFrame(function () { el.classList.remove('ins'); }); }
    else requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.remove('back'); el.classList.add('on'); }); });
    cur = id; ui();
  }
  function ui() {
    var st = S[cur], Fl = flow(), i = Fl.indexOf(cur), n = Fl.length - 2;
    R.pb.style.width = (cur === 'fin' ? 100 : Math.max(2, Math.round(i / n * 100))) + '%';
    R.bk.classList.toggle('hid', cur === 'fin' || (i <= 0 && !ret));
    R.cl.classList.toggle('hid', cur === 'fin');
    R.ft.classList.toggle('hid', (isAuto(st) && !ret) || cur === 'fin');
    R.cp.classList.toggle('on', cur === 'fotos' && !ret && K !== 'alquiler' && PVT !== 'consesionario');
    R.go.querySelector('span').textContent = ret ? 'listo' : (typeof st.cta === 'function' ? st.cta() : (st.cta || 'continuar'));
    refresh();
  }
  function refresh() {
    var st = S[cur]; if (!st) return;
    if (st.autoIf) R.ft.classList.toggle('hid', isAuto(st) && !ret);
    R.go.disabled = !!(st.ok && !st.ok());
  }
  function next() {
    if (busy) return;
    var st = S[cur]; if (st && st.ok && !st.ok()) return;
    autosave(); buzz();
    if (ret) { var r = ret; ret = null; show(r, 1); return; }
    var Fl = flow(); show(Fl[Fl.indexOf(cur) + 1], 1);
  }
  function prevOf() { if (ret) return ret; var Fl = flow(), i = Fl.indexOf(cur); return i > 0 ? Fl[i - 1] : null; }
  function back() {
    if (busy || !isOpen) return;
    if (R.sh.classList.contains('on')) { sheet(false); return; }
    var p = prevOf();
    if (!p) { askExit(); return; }
    ret = null; show(p, -1);
  }

  /* —— salir / borradores —— */
  function meaningful() { return F.fotos.length > 0 || has(d.marca) || has(d.modelo); }
  function sheet(on) { R.sh.classList.toggle('on', on); R.shb.classList.toggle('on', on); if (on) buzz(); }
  function askExit() {
    if (busy) return;
    if (cur === 'fin') { close(); return; }
    if (!meaningful()) { discard(); close(); return; }
    sheet(true);
  }
  function meta() {
    var Fl = flow(), i = Math.max(0, Fl.indexOf(ret || cur));
    return { id: DID, pvt: PVT, paso: ret || cur, upd: Date.now(), d: d, nf: F.fotos.length, pct: Math.max(4, Math.round(i / (Fl.length - 2) * 100)), cover: coverCache };
  }
  var svT = 0;
  function flash() { R.sv.classList.add('on'); clearTimeout(svT); svT = setTimeout(function () { R.sv.classList.remove('on'); }, 1100); }
  // cada paso guarda los campos (barato); los archivos se guardan al salir o al irse a segundo plano
  function autosave() {
    if (!meaningful() || cur === 'fin') return;
    var a = drafts().filter(function (x) { return x.id !== DID; });
    a.unshift(meta());
    if (putDrafts(a)) flash();
    if (!coverCache && F.fotos[0] && F.fotos[0].t) coverOf(F.fotos[0]).then(function (c) { if (c) { coverCache = c; var b = drafts(); b.forEach(function (x) { if (x.id === DID) x.cover = c; }); putDrafts(b); } });
  }
  function saveDraft(withFiles) {
    if (!meaningful()) return Promise.resolve();
    var cv = F.fotos[0] ? coverOf(F.fotos[0]) : Promise.resolve('');
    return cv.then(function (c) {
      coverCache = c || '';
      var a = drafts().filter(function (x) { return x.id !== DID; });
      a.unshift(meta());
      putDrafts(a);
      if (!withFiles || !filesDirty) return;
      filesDirty = false;
      var id = DID, fotos = F.fotos.map(function (p) { return p.file; }), docs = F.docs.slice(), vids = F.videos.slice();
      // archivos tal cual (sin copiar a memoria); si este WebKit no guarda Blobs en IndexedDB, como bytes
      return idbPut(id, { fotos: fotos, docs: docs }).catch(function () {
        return Promise.all([asBytes(fotos), asBytes(docs)]).then(function (r) { return idbPut(id, { fotos: r[0], docs: r[1] }); });
      }).then(function () {
        // videos (hasta 500MB c/u) solo como archivo: si no se puede, el borrador queda sin ellos
        return vids.length ? idbPut(id + ':v', vids).catch(function () { console.warn('[ruedda publicar] los videos no se guardan en el borrador'); }) : idb('readwrite', function (s) { s.delete(id + ':v'); });
      }).catch(function (e) { filesDirty = true; console.warn('[ruedda publicar] no se pudieron guardar las fotos del borrador:', e && e.message); });
    });
  }
  function asBytes(list) {
    return Promise.all(list.map(function (f) {
      return (f.arrayBuffer ? f.arrayBuffer() : new Response(f).arrayBuffer()).then(function (b) { return { n: f.name || 'archivo', t: f.type || '', b: b }; });
    }));
  }
  function asFile(x) {
    if (!x) return null;
    if (x.b) return new File([x.b], x.n, { type: x.t });
    if (x instanceof File) return x;
    if (x instanceof Blob) return new File([x], 'foto.jpg', { type: x.type || 'image/jpeg' });
    return null;
  }
  function dropDraft(id) {
    var a = drafts().filter(function (x) { return x.id !== id; });
    putDrafts(a);
    idbDel(id).catch(function () {});
  }
  function discard() { if (DID) dropDraft(DID); }

  /* —— abrir / cerrar —— */
  var underView = null;
  function theme() { host.setAttribute('data-t', document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'); }
  function cover(on) { document.documentElement.classList.toggle('rd-pw-cover', on); }
  function lock(on) { document.documentElement.classList.toggle('rd-lk', on || !!document.querySelector('body>#mis-pub-sheet:not(.out),body>#edit-listing-modal')); }
  function present(startId) {
    var fresh1 = !host; build(); theme();
    busy = 0; ret = null; cur = null; els = {};
    R.stage.innerHTML = '';
    sheet(false); ld(false);
    // la pantalla ya vive montada (invisible, fuera de cuadro): abrir es solo deslizarla.
    // Nada que toque el documento de la app (bloqueo de scroll, tapar la vista) corre
    // durante el deslizamiento: así el primer cuadro sale sin recalcular toda la app.
    host.classList.add('on');
    R.pg.classList.remove('in', 'out', 'ins'); R.pg.style.transform = '';
    isOpen = true;
    show(startId && S[startId] ? startId : flow()[0], 1, true);
    // recién armada (sin precarga) necesita un cuadro en su sitio antes de deslizar
    var go = function () { R.pg.classList.add('in'); };
    requestAnimationFrame(fresh1 ? function () { requestAnimationFrame(go); } : go);
    clearTimeout(present._t);
    present._t = setTimeout(function () { if (isOpen) { lock(true); cover(true); } }, 520);
    histPush();
    try { if (typeof _rdHapticNow === 'function') _rdHapticNow('LIGHT'); } catch (e) {}
  }
  function fresh(pvt) {
    freeFotos(F.fotos);
    PVT = pvt || 'particular'; K = kindOf(PVT);
    d = { dur: K === 'subasta' ? 5 : undefined };
    F = { fotos: [], videos: [], docs: [] };
    DID = uid(); filesDirty = false; coverCache = '';
  }
  function open(pvt) {
    fresh(pvt);
    present();
  }
  function resume(id) {
    var m = drafts().filter(function (x) { return x.id === id; })[0];
    if (!m) { toast('ese borrador ya no existe'); return Promise.resolve(false); }
    // misma sesión que sigue en memoria (p. ej. volviendo de fotógrafos): sin leer nada
    if (DID === id && (F.fotos.length || !m.nf)) { PVT = m.pvt; K = kindOf(PVT); d = m.d || {}; present(m.paso); return Promise.resolve(true); }
    fresh(m.pvt); DID = id; d = m.d || {}; coverCache = m.cover || '';
    try { pendingVenderType = PVT === 'alquiler' ? pendingVenderType : PVT; } catch (e) {}
    return Promise.all([idbGet(id).catch(function () { return null; }), idbGet(id + ':v').catch(function () { return null; })]).then(function (r) {
      var pack = r[0] || {}, vids = r[1] || [];
      F.fotos = (pack.fotos || []).map(asFile).filter(Boolean).map(function (f) { return { file: f }; });
      F.docs = (pack.docs || []).map(asFile).filter(Boolean);
      F.videos = (vids || []).map(asFile).filter(Boolean);
      if (m.nf && F.fotos.length < m.nf) toast('algunas fotos del borrador no se guardaron · vuelve a agregarlas');
      var step = m.paso && S[m.paso] ? m.paso : 'fotos';
      if (step === 'fin') step = 'rev';
      // si faltan fotos, arranca por ahí
      if (F.fotos.length < 3 && flow().indexOf(step) > 0) step = 'fotos';
      present(step);
      return true;
    });
  }
  function close(instant) {
    if (!isOpen) return;
    isOpen = false; busy = 0;
    cover(false);
    histPop();
    var done = function () {
      host.classList.remove('on');
      R.pg.classList.remove('in', 'out', 'ins'); R.pg.style.transform = ''; R.pg.style.transition = '';
      R.stage.innerHTML = ''; els = {}; cur = null;
      lock(false);
      try { document.activeElement && document.activeElement.blur && document.activeElement.blur(); } catch (e) {}
    };
    if (instant) { done(); return; }
    R.pg.classList.remove('in'); R.pg.classList.add('out');
    setTimeout(done, 400);
  }

  /* —— historial (solo web: en la app iOS el gesto de borde llega por RDNT) —— */
  var NATIVE = !!(window.__RD_NATIVE_TABS && window.webkit && webkit.messageHandlers && webkit.messageHandlers.rdTabs);
  var hist = false, ignorePop = 0;
  function histPush() { if (NATIVE || hist) return; try { history.pushState({ rdpw: 1, rueddaView: (typeof currentView !== 'undefined' ? currentView : 'home') }, '', location.href); hist = true; } catch (e) {} }
  function histPop() { if (!hist) return; hist = false; ignorePop++; try { history.back(); } catch (e) { ignorePop--; } }
  window._pwPop = function () {
    if (ignorePop > 0) { ignorePop--; return true; }
    if (!isOpen) return false;
    hist = false;
    // la hoja de planes o el pago abiertos encima: el "atrás" los cierra a ellos
    var ps = document.getElementById('pricing-sheet'), co = document.getElementById('checkout-modal');
    if (ps && ps.classList.contains('open')) { try { closePricingSheet(); } catch (e) {} histPush(); return true; }
    if (co && co.classList.contains('open')) { try { closeCheckout(); } catch (e) {} histPush(); return true; }
    if (busy) { histPush(); return true; }
    var p = prevOf();
    if (p && cur !== 'fin') { ret = null; show(p, -1, true); histPush(); return true; }
    // primer paso: sale (guarda el borrador si hay algo)
    exitQuiet(true);
    return true;
  };
  function exitQuiet(instant) {
    if (cur !== 'fin' && meaningful()) { saveDraft(true).then(function () { toast('borrador guardado en mis publicaciones', true); }); }
    else if (cur !== 'fin') discard();
    hist = false; close(instant);
  }

  /* —— volver desde el borde —— */
  function canEdge() { return isOpen && !busy && !R.sh.classList.contains('on') && !R.go.classList.contains('ld'); }
  var edgeSt = null;
  // capa que ve el gesto nativo (rd-native-tabs.js): begin destapa lo de abajo, end decide
  var layer = {
    can: canEdge,
    begin: function () {
      var p = cur === 'fin' ? null : prevOf();
      if (p) {
        var cu = els[cur], el = section(p, -1);
        el.classList.add('ins', 'on'); el.classList.remove('back');
        R.stage.insertBefore(el, R.stage.firstChild);
        if (cu) cu.style.visibility = 'hidden';
        edgeSt = { mode: 'step', p: p, el: el, cu: cu };
      } else {
        cover(false); host.style.visibility = 'hidden';
        edgeSt = { mode: 'exit' };
      }
      return true;
    },
    end: function (ok) {
      var e = edgeSt; edgeSt = null; if (!e) return;
      if (e.mode === 'step') {
        if (ok) {
          if (e.cu) e.cu.remove();
          ret = null; els = {}; els[e.p] = e.el; cur = e.p; ui();
          requestAnimationFrame(function () { e.el.classList.remove('ins'); });
        } else { e.el.remove(); if (e.cu) e.cu.style.visibility = ''; }
      } else {
        host.style.visibility = '';
        if (ok) exitQuiet(true); else cover(true);
      }
    }
  };
  window._rdPwLayer = function () { return isOpen ? layer : null; };

  // web (Safari / PWA / navegador): el paso sigue al dedo desde el borde izquierdo
  function edgeWeb() {
    if (NATIVE) return;
    var x0 = 0, y0 = 0, t0 = 0, on = false, dec = false, W = 1, dx = 0, mode = '', under = null, cu = null;
    R.pg.addEventListener('touchstart', function (e) {
      on = false; dec = false;
      if (e.touches.length !== 1 || !canEdge()) return;
      var t = e.touches[0];
      if (t.clientX > 28) return;
      x0 = t.clientX; y0 = t.clientY; t0 = performance.now(); W = R.pg.clientWidth || innerWidth; dx = 0; on = true;
    }, { passive: true });
    R.pg.addEventListener('touchmove', function (e) {
      if (!on) return;
      var t = e.touches[0], mx = t.clientX - x0, my = t.clientY - y0;
      if (!dec) {
        if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
        dec = true;
        if (mx <= 0 || Math.abs(my) > Math.abs(mx)) { on = false; return; }
        var p = cur === 'fin' ? null : prevOf();
        cu = els[cur];
        if (p) {
          mode = 'step'; under = section(p, -1); under.classList.add('ins', 'on'); under.classList.remove('back');
          under.style.transform = 'translate3d(' + (-0.3 * W) + 'px,0,0)';
          R.stage.insertBefore(under, R.stage.firstChild);
          if (cu) cu.classList.add('drag');
        } else { mode = 'exit'; cover(false); R.pg.style.transition = 'none'; }
      }
      if (e.cancelable) e.preventDefault();
      dx = Math.max(0, mx);
      var k = Math.min(1, dx / W);
      if (mode === 'step') {
        if (cu) cu.style.transform = 'translate3d(' + dx + 'px,0,0)';
        under.style.transform = 'translate3d(' + (-0.3 * W * (1 - k)) + 'px,0,0)';
      } else R.pg.style.transform = 'translate3d(' + dx + 'px,0,0)';
    }, { passive: false });
    function end() {
      if (!on) return; on = false; if (!dec) return;
      var v = dx / Math.max(1, performance.now() - t0), done = dx > W * 0.35 || (v > 0.5 && dx > 30);
      var ms = 260, ez = 'cubic-bezier(.25,.8,.3,1)';
      if (mode === 'step') {
        var u = under, c = cu, p = prevOf();
        if (c) { c.style.transition = 'transform ' + ms + 'ms ' + ez; c.style.transform = done ? 'translate3d(' + W + 'px,0,0)' : ''; }
        u.style.transition = 'transform ' + ms + 'ms ' + ez; u.style.transform = done ? 'none' : 'translate3d(' + (-0.3 * W) + 'px,0,0)';
        setTimeout(function () {
          if (done) {
            if (c) c.remove();
            u.style.transition = ''; u.style.transform = ''; u.classList.remove('ins');
            ret = null; els = {}; els[p] = u; cur = p; ui(); buzz();
          } else {
            u.remove(); if (c) { c.classList.remove('drag'); c.style.transition = ''; c.style.transform = ''; }
          }
        }, ms + 20);
      } else {
        R.pg.style.transition = 'transform ' + ms + 'ms ' + ez;
        R.pg.style.transform = done ? 'translate3d(' + W + 'px,0,0)' : '';
        setTimeout(function () {
          R.pg.style.transition = '';
          if (done) exitQuiet(true); else { R.pg.style.transform = ''; cover(true); }
        }, ms + 20);
      }
    }
    R.pg.addEventListener('touchend', end); R.pg.addEventListener('touchcancel', end);
  }

  /* —— fotos —— */
  function addFotos(files) {
    var list = [].slice.call(files || []).filter(function (f) { return /^image\//.test(f.type) || /\.(jpe?g|png|heic|heif|webp)$/i.test(f.name || ''); });
    var room = MAX_FOTOS - F.fotos.length;
    if (list.length > room) toast(room > 0 ? 'solo se agregaron ' + room + ' · máximo ' + MAX_FOTOS + ' fotos' : 'máximo ' + MAX_FOTOS + ' fotos');
    list.slice(0, Math.max(0, room)).forEach(function (f) { F.fotos.push({ file: f }); });
    if (!list.length) return;
    filesDirty = true; buzz();
    if (els.fotos && els.fotos._paint) els.fotos._paint();
    refresh();
  }
  function rFotos(el) {
    if (K !== 'alquiler' && PVT !== 'consesionario') el.classList.add('wcp');
    var box = h('div', { 'class': 'blk' }); el.appendChild(box);
    function paint() {
      box.innerHTML = '';
      if (!F.fotos.length) {
        box.appendChild(h('button', { 'class': 'drop', on: { click: pick } }, [h('div', { 'class': 'o', html: IC.plus }), h('b', null, ['Agregar fotos']), h('small', null, ['Desde tu galería o cámara'])]));
        box.appendChild(h('p', { 'class': 'tip' }, ['Horizontales (16:9), con luz de día: frente, laterales, interior, tablero y motor. Si nos gusta tu post, te lo boosteamos gratis.']));
      } else {
        var n = F.fotos.length, C = 2 * Math.PI * 9, p = Math.min(n / 10, 1);
        box.appendChild(h('div', { 'class': 'cnt' + (n >= 10 ? ' ok' : ''), html: '<svg class="r" viewBox="0 0 22 22"><circle class="a" cx="11" cy="11" r="9"/><circle class="b" cx="11" cy="11" r="9" stroke-dasharray="' + C + '" stroke-dashoffset="' + (C * (1 - p)) + '"/></svg>' + (n >= 10 ? n + ' fotos. perfecto.' : n < 3 ? n + ' de 3 mínimo' : n + ' fotos · 10 o más vende mejor') }));
        var g = h('div', { 'class': 'ph' });
        F.fotos.forEach(function (f) { g.appendChild(tile(f, g)); });
        g.appendChild(h('button', { 'class': 'add', 'aria-label': 'agregar fotos', html: IC.plus, on: { click: pick } }));
        box.appendChild(g);
        box.appendChild(h('p', { 'class': 'tip' }, ['Mantén presionada una foto para moverla. Toca una para hacerla portada.']));
        dragGrid(g, el, paint);
      }
    }
    el._paint = paint; paint();
    if (K !== 'alquiler' && PVT !== 'consesionario') {
      el.appendChild(h('button', { 'class': 'alt', on: { click: function () { try { _showPublishForMeSheet(); } catch (e) {} } } }, ['¿Prefieres que lo publiquemos por ti? ', h('u', null, ['Toca aquí.'])]));
    }
  }
  function tile(f, g) {
    var t = h('div', { 'class': 't' });
    t._f = f;
    t.appendChild(img(f));
    t.appendChild(h('button', { 'class': 'x', 'aria-label': 'quitar foto', html: IC.x, on: { click: function (e) {
      e.stopPropagation();
      var i = F.fotos.indexOf(f); if (i < 0) return;
      F.fotos.splice(i, 1); if (f.t) { try { URL.revokeObjectURL(f.t); } catch (_) {} }
      if (i === 0) coverCache = '';
      filesDirty = true; els.fotos && els.fotos._paint(); refresh();
    } } }));
    return t;
  }
  // arrastrar para ordenar: mantener presionado levanta la foto, las demás se acomodan (FLIP)
  function dragGrid(g, scroller, repaint) {
    var hold = 0, drag = null, sx = 0, sy = 0;
    function tiles() { return [].filter.call(g.children, function (c) { return c.classList.contains('t'); }); }
    function cancelHold() { clearTimeout(hold); hold = 0; }
    function start(t, x, y) {
      var r = t.getBoundingClientRect();
      drag = { t: t, ox: x - r.left, oy: y - r.top, x: x, y: y, moved: false };
      t.classList.add('lift'); t.style.transition = 'none';
      buzz('MEDIUM');
      place();
    }
    function place() {
      var t = drag.t; t.style.transform = 'none';
      var r = t.getBoundingClientRect();
      t.style.transform = 'translate3d(' + (drag.x - drag.ox - r.left) + 'px,' + (drag.y - drag.oy - r.top) + 'px,0) scale(1.04)';
    }
    function move(x, y) {
      drag.x = x; drag.y = y; drag.moved = true;
      var ts = tiles(), from = ts.indexOf(drag.t), to = -1;
      for (var i = 0; i < ts.length; i++) {
        if (ts[i] === drag.t) continue;
        var r = ts[i].getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) { to = i; break; }
      }
      if (to > -1 && to !== from) {
        var before = new Map(); ts.forEach(function (c) { if (c !== drag.t) before.set(c, c.getBoundingClientRect()); });
        var f = F.fotos.splice(from, 1)[0]; F.fotos.splice(to, 0, f);
        var ref = ts[to]; if (to > from) ref = ref.nextSibling; g.insertBefore(drag.t, ref);
        if (to === 0 || from === 0) coverCache = '';
        filesDirty = true; buzz();
        before.forEach(function (r0, c) {
          var r1 = c.getBoundingClientRect(), dx = r0.left - r1.left, dy = r0.top - r1.top;
          if ((dx || dy) && c.animate) c.animate([{ transform: 'translate3d(' + dx + 'px,' + dy + 'px,0) scale(' + (r0.width / r1.width) + ')', transformOrigin: '0 0' }, { transform: 'none', transformOrigin: '0 0' }], { duration: 300, easing: 'cubic-bezier(.32,.72,0,1)' });
        });
      }
      place();
      // cerca de los bordes, la página se desplaza sola
      var sr = scroller.getBoundingClientRect();
      if (y < sr.top + 70) scroller.scrollTop -= 8; else if (y > sr.bottom - 90) scroller.scrollTop += 8;
    }
    function end() {
      cancelHold();
      if (!drag) return;
      var t = drag.t; drag = null;
      t.style.transition = 'transform .3s cubic-bezier(.32,.72,0,1)';
      t.style.transform = '';
      setTimeout(function () { t.classList.remove('lift'); t.style.transition = ''; repaint(); }, 300);
    }
    g.addEventListener('touchstart', function (e) {
      var t = e.target.closest && e.target.closest('.t');
      if (!t || e.target.closest('.x') || e.touches.length !== 1) return;
      sx = e.touches[0].clientX; sy = e.touches[0].clientY;
      cancelHold();
      hold = setTimeout(function () { hold = 0; start(t, sx, sy); }, 280);
    }, { passive: true });
    g.addEventListener('touchmove', function (e) {
      var p = e.touches[0];
      if (drag) { if (e.cancelable) e.preventDefault(); move(p.clientX, p.clientY); return; }
      if (hold && (Math.abs(p.clientX - sx) > 8 || Math.abs(p.clientY - sy) > 8)) cancelHold();
    }, { passive: false });
    // soltar después de levantar no cuenta como toque (no cambia la portada)
    g.addEventListener('touchend', function (e) { var was = !!drag; end(); if (was && e.cancelable) e.preventDefault(); });
    g.addEventListener('touchcancel', end);
    g.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    // ratón (escritorio): mismo gesto
    g.addEventListener('mousedown', function (e) {
      var t = e.target.closest && e.target.closest('.t');
      if (!t || e.target.closest('.x') || e.button !== 0) return;
      sx = e.clientX; sy = e.clientY;
      hold = setTimeout(function () { hold = 0; start(t, sx, sy); }, 280);
      var mm = function (ev) { if (drag) move(ev.clientX, ev.clientY); else if (Math.abs(ev.clientX - sx) > 6 || Math.abs(ev.clientY - sy) > 6) cancelHold(); };
      var mu = function () { removeEventListener('mousemove', mm); removeEventListener('mouseup', mu); if (drag) { g._skipClick = true; } end(); };
      addEventListener('mousemove', mm); addEventListener('mouseup', mu);
    });
    // tocar (sin arrastrar) hace portada
    g.addEventListener('click', function (e) {
      if (g._skipClick) { g._skipClick = false; return; }
      var t = e.target.closest && e.target.closest('.t');
      if (!t || e.target.closest('.x')) return;
      var i = F.fotos.indexOf(t._f); if (i <= 0) return;
      F.fotos.splice(i, 1); F.fotos.unshift(t._f); coverCache = ''; filesDirty = true; buzz(); repaint();
    });
  }
  function pick() { R.fi.click(); }

  function srch(el, ph) {
    var s = h('div', { 'class': 'srch blk', html: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>' });
    var q = h('input', { type: 'search', placeholder: ph, autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', enterkeyhint: 'search' });
    s.appendChild(q); el.appendChild(s); return q;
  }
  function rMarca(el) {
    var q = srch(el, 'buscar marca'), g = h('div', { 'class': 'mg' }); el.appendChild(g);
    var names = optionsOf(K === 'alquiler' ? 'af-marca' : 'marca-select');
    var SV = (typeof MARCA_SVG !== 'undefined') ? MARCA_SVG : {}, URLS = (typeof MARCA_SVG_URL !== 'undefined') ? MARCA_SVG_URL : '/assets/marcas.svg';
    var html = names.map(function (m, i) {
      var sv = SV[m], e = String(m).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
      var inner = sv ? '<div class="lg"><svg style="width:' + (sv[1] * 0.78) + '%;height:' + (sv[2] * 0.78 / 0.7) + '%" aria-hidden="true"><use href="' + URLS + '#mk-' + sv[0] + '"/></svg></div><span>' + e + '</span>'
        : '<div class="lg"><span class="tx">' + e + '</span></div>';
      return '<button class="mc' + (d.marca === m ? ' sel' : '') + '" data-i="' + i + '" data-n="' + norm(m) + '" aria-label="' + e + '">' + inner + '</button>';
    }).join('');
    g.innerHTML = html;
    g.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.mc'); if (!b) return;
      var m = names[+b.dataset.i]; selOnly(g, b);
      if (d.marca !== m) { d.modelo = ''; d.version = ''; }
      d.marca = m; buzz(); later(next);
    });
    q.addEventListener('input', function () { var v = norm(q.value.trim()); [].forEach.call(g.children, function (x) { x.style.display = !v || x.dataset.n.indexOf(v) > -1 ? '' : 'none'; }); });
  }
  function rModelo(el) {
    var w = h('div', { 'class': 'blk big' }), i = h('input', { type: 'text', placeholder: 'ej. Corolla', autocomplete: 'off', autocapitalize: 'words', enterkeyhint: 'next', value: d.modelo || '' });
    w.appendChild(i); el.appendChild(w);
    var list = MODELOS[d.marca] || [], sg = h('div', { 'class': 'ch sug' });
    var f = h('div', { 'class': 'fld' }), ver = null;
    if (K !== 'alquiler') ver = h('input', { type: 'text', placeholder: 'ej. XLI, Limited, 4x4', autocomplete: 'off', enterkeyhint: 'next', value: d.version || '' });
    function paint() {
      sg.innerHTML = ''; var v = norm(i.value.trim());
      list.filter(function (m) { return !v || norm(m).indexOf(v) > -1; }).slice(0, 8).forEach(function (m) {
        sg.appendChild(h('button', { 'class': 'c' + (d.modelo === m ? ' sel' : ''), on: { click: function () { i.value = m; d.modelo = m; paint(); refresh(); buzz(); if (!ver) later(next); } } }, [m]));
      });
    }
    if (list.length) { el.appendChild(sg); paint(); }
    i.addEventListener('input', function () { d.modelo = i.value; paint(); refresh(); });
    if (ver) {
      f.appendChild(h('label', null, ['Versión · opcional'])); f.appendChild(ver); el.appendChild(f);
      ver.addEventListener('input', function () { d.version = ver.value; });
    }
    [i, ver].forEach(function (x) { if (x) x.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); if (x === i && d.modelo && ver) ver.focus(); else if (d.modelo) { x.blur(); next(); } } }); });
  }
  function rAnio(el) {
    var g = h('div', { 'class': 'yg blk' }), ys = years();
    g.innerHTML = ys.map(function (a) { return '<button class="c' + (+d.anio === a ? ' sel' : '') + '" data-y="' + a + '">' + a + '</button>'; }).join('');
    g.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('.c'); if (!b) return; selOnly(g, b); d.anio = +b.dataset.y; buzz(); later(next); });
    el.appendChild(g);
  }
  function years() {
    var id = K === 'alquiler' ? 'af-year' : 'year-select';
    try { populateYears(id); } catch (e) {}
    var o = optionsOf(id).map(Number).filter(Boolean);
    if (!o.length) { for (var y = new Date().getFullYear() + 1; y >= 1950; y--) o.push(y); }
    return o;
  }
  function cards(el, opts, key, cls, after) {
    var g = h('div', { 'class': (cls || 'cards') + ' blk' });
    opts.forEach(function (c) {
      g.appendChild(h('button', { 'class': 'cd' + (d[key] === c[0] ? ' sel' : ''), on: { click: function (e) { selOnly(g, e.currentTarget); d[key] = c[0]; buzz(); (after || function () { later(next); })(c[0]); } } },
        [h('div', null, [h('b', null, [c[1]]), c[2] ? h('small', null, [c[2]]) : null])]));
    });
    el.appendChild(g); return g;
  }
  function rCond(el) {
    cards(el, [['usado', 'Usado'], ['nuevo', 'Nuevo', '0 km']], 'cond', 'seg', function (v) {
      if (v === 'nuevo') { d.km = 0; d.kmU = ''; d.duenos = ''; d.duenosN = ''; d.estadoF = 'impecable'; d.choc = 'no'; d.dano = []; d.estado = ''; }
      else if (d.km === 0) d.km = '';
      later(next);
    });
  }
  // km o millas: se escribe lo del tablero; si son millas se publica convertido a km
  function rKm(el) {
    var i = h('input', { type: 'text', inputmode: 'numeric', placeholder: '0', autocomplete: 'off', enterkeyhint: 'next', value: num(d.km) ? fmt(num(d.km)) : '' });
    var un = h('div', { 'class': 'un' }), hint = h('p', { 'class': 'hint' });
    function paint() {
      [].forEach.call(un.children, function (b) { b.classList.toggle('on', b._u === (d.kmU || 'km')); });
      hint.textContent = d.kmU === 'mi' ? (num(d.km) ? 'Se publica como ' + fmt(kmReal()) + ' km.' : 'Lo pasamos a kilómetros al publicar.') : 'El número exacto del tablero genera confianza.';
    }
    ['km', 'mi'].forEach(function (u) { var b = h('button', { on: { click: function () { d.kmU = u === 'mi' ? 'mi' : ''; paint(); buzz(); } } }, [u]); b._u = u; un.appendChild(b); });
    el.appendChild(h('div', { 'class': 'blk big' }, [i, un])); el.appendChild(hint); paint();
    i.addEventListener('input', function () { var n = num(i.value); d.km = n || ''; i.value = n ? fmt(n) : ''; paint(); refresh(); });
    i.addEventListener('keydown', function (e) { if (e.key === 'Enter' && num(d.km)) { i.blur(); next(); } });
  }
  /* filas que se completan en orden y avanzan solas */
  function rows(el, defs, done) {
    var box = h('div', { 'class': 'blk' }); el.appendChild(box); var Rr = [];
    defs.forEach(function (df, ri) {
      var r = h('div', { 'class': 'row' }), em = h('em'), lb = h('div', { 'class': 'lb' }, [df.l, em]), ch = h('div', { 'class': 'ch' });
      df.o.forEach(function (o) {
        var v = Array.isArray(o) ? o[0] : o, t = Array.isArray(o) ? o[1] : o, multi = !!df.multi;
        var on = multi ? (d[df.k] || []).indexOf(v) > -1 : d[df.k] === v;
        ch.appendChild(h('button', { 'class': 'c' + (on ? ' sel' : ''), on: { click: function (e) {
          if (multi) {
            var a = (d[df.k] || []).slice(), j = a.indexOf(v);
            if (j > -1) a.splice(j, 1); else a.push(v);
            d[df.k] = a; e.currentTarget.classList.toggle('sel', j < 0);
            em.textContent = a.length ? (a.length === 1 ? a[0] : a.length + ' tipos') : '';
          } else { selOnly(ch, e.currentTarget); d[df.k] = v; em.textContent = t; }
          buzz(); if (df.after) df.after(v, Rr); upd(ri);
        } } }, [t]));
      });
      if (df.multi) { var a0 = d[df.k] || []; em.textContent = a0.length ? (a0.length === 1 ? a0[0] : a0.length + ' tipos') : ''; }
      else if (has(d[df.k])) { var m = df.o.filter(function (o) { return (Array.isArray(o) ? o[0] : o) === d[df.k]; })[0]; em.textContent = m ? (Array.isArray(m) ? m[1] : m) : ''; }
      r.appendChild(lb); r.appendChild(ch); if (df.extra) r.appendChild(df.extra); box.appendChild(r); Rr.push(r);
      if (df.hide && df.hide()) r.style.display = 'none';
    });
    function vis(i) { return Rr[i].style.display !== 'none'; }
    function filled(df) { return df.multi ? (d[df.k] || []).length > 0 : has(d[df.k]); }
    function upd(changed) {
      var first = -1;
      defs.forEach(function (df, i) { var ok = filled(df) || !vis(i); Rr[i].classList.toggle('done', filled(df)); if (!ok && first < 0) first = i; });
      Rr.forEach(function (r, i) { r.classList.toggle('wait', first > -1 && i > first); });
      if (changed == null) return;
      // un campo de selección múltiple no avanza solo: se espera al siguiente
      if (defs[changed] && defs[changed].multi && first < 0) return;
      if (first < 0) { if (!(defs.stay && defs.stay())) later(done); return; }
      if (first > changed) { var t = Rr[first]; setTimeout(function () { el.scrollTo({ top: t.offsetTop - 120, behavior: 'smooth' }); }, 160); }
    }
    box._upd = upd; upd(); return Rr;
  }
  function rMeca(el) {
    var warn = h('div', { 'class': 'warn' }, ['DSG es solo para el grupo VAG (Volkswagen, Audi, Seat, Skoda, Porsche…).']);
    function vagChk() { warn.classList.toggle('on', d.trans === 'DSG' && !!d.marca && VAG.indexOf((d.marca || '').toLowerCase()) < 0); }
    var Rr = rows(el, [
      { k: 'trans', l: 'Transmisión', o: TRANS, extra: warn, after: vagChk },
      { k: 'comb', l: 'Combustible', o: COMB, after: function (v) {
        if (v !== 'eléctrico') return;
        d.motor = 'eléctrico';
        var r = Rr[2], b = [].filter.call(r.querySelectorAll('.c'), function (x) { return x.textContent === 'eléctrico'; })[0];
        if (b) selOnly(r.querySelector('.ch'), b); r.querySelector('em').textContent = 'eléctrico';
      } },
      { k: 'motor', l: 'Motor', o: MOTOR },
      { k: 'trac', l: 'Tracción', o: TRAC }], next);
    vagChk();
  }
  function rCarro(el) {
    var g = h('div', { 'class': 'ch blk' });
    CARROCERIA.forEach(function (c) { g.appendChild(h('button', { 'class': 'c' + (d.carro === c[0] ? ' sel' : ''), on: { click: function (e) { selOnly(g, e.currentTarget); d.carro = c[0]; buzz(); later(next); } } }, [c[1]])); });
    el.appendChild(g);
  }
  function rColor(el) {
    var g = h('div', { 'class': 'cg blk' });
    COLORES.forEach(function (c) {
      var b = h('button', { 'class': 'sw' + (d.color === c[0] ? ' sel' : '') }, [h('i', { style: 'background:' + c[1] }), c[0]]);
      b.addEventListener('click', function () { selOnly(g, b); d.color = c[0]; i.value = ''; buzz(); later(next); }); g.appendChild(b);
    });
    el.appendChild(g);
    var f = h('div', { 'class': 'fld' }), i = h('input', { type: 'text', placeholder: 'otro: ej. negro mate', enterkeyhint: 'next', value: COLORES.some(function (c) { return c[0] === d.color; }) ? '' : (d.color || '') });
    f.appendChild(i); el.appendChild(f);
    var ok = h('button', { 'class': 'cta', style: 'margin-top:12px;display:none' }, [h('span', null, ['continuar'])]);
    el.appendChild(ok);
    i.addEventListener('input', function () { ok.style.display = i.value.trim() ? '' : 'none'; if (i.value.trim()) [].forEach.call(g.children, function (x) { x.classList.remove('sel'); }); });
    var go = function () { if (i.value.trim()) { d.color = i.value.trim(); i.blur(); next(); } };
    ok.addEventListener('click', go);
    i.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); go(); } });
    if (i.value) ok.style.display = '';
  }
  function rHist(el) {
    var nuevo = K === 'venta' && d.cond === 'nuevo';
    var ex = h('div', { 'class': 'rev' + (d.duenos === '4+' ? ' on' : '') }), exi = h('input', { 'class': 'inp', type: 'text', inputmode: 'numeric', placeholder: 'cantidad exacta', value: d.duenosN || '' });
    ex.appendChild(exi);
    var defs = [];
    if (K === 'venta' && !nuevo) defs.push({ k: 'estadoF', l: 'Estado físico', o: ESTADOF });
    if (!nuevo) defs.push({ k: 'duenos', l: 'Dueños anteriores', o: [['1', '1'], ['2', '2'], ['3', '3'], ['4+', '4 o más']], extra: ex, after: function (v) { ex.classList.toggle('on', v === '4+'); } });
    defs.push({ k: 'mod', l: '¿Tiene modificaciones?', o: MODS });
    defs.stay = function () { return d.duenos === '4+' && num(d.duenosN) < 4; };
    var Rr = rows(el, defs, next);
    exi.addEventListener('input', function () { exi.value = exi.value.replace(/\D/g, '').slice(0, 2); d.duenosN = exi.value; });
    exi.addEventListener('keydown', function (e) { if (e.key === 'Enter' && num(exi.value) >= 4) { exi.blur(); if (has(d.mod)) next(); } });
    exi.addEventListener('change', function () { if (num(exi.value) >= 4 && has(d.mod)) later(next); });
    void Rr;
  }
  function rChoque(el) {
    var sub = K === 'subasta' ? 'Marca sí si tiene daños estructurales. Ser claro aquí evita sorpresas y genera confianza.' : 'Si tiene daños, sale en la sección Chocados del market. Ser claro genera confianza.';
    el.insertBefore(h('p', { 'class': 'sub' }, [sub]), el.querySelector('h1').nextSibling);
    var cont = h('button', { 'class': 'cta', style: 'margin-top:22px' }, [h('span', null, ['continuar'])]);
    var Rr = rows(el, [
      { k: 'choc', l: '¿Chocado?', o: [['no', 'No'], ['si', 'Sí, tiene daños']], after: function (v) {
        Rr[1].style.display = Rr[2].style.display = v === 'si' ? '' : 'none';
        cont.style.display = v === 'si' ? '' : 'none';
        if (v === 'no') { d.dano = []; d.estado = ''; }
      } },
      { k: 'dano', l: 'Tipo de daño · puedes marcar varios', o: DANOS, multi: 1, hide: function () { return d.choc !== 'si'; } },
      { k: 'estado', l: 'Estado actual', o: ESTADOS, hide: function () { return d.choc !== 'si'; } }], next);
    cont.style.display = d.choc === 'si' ? '' : 'none';
    cont.addEventListener('click', function () { if (d.choc === 'si' && (d.dano || []).length && has(d.estado)) next(); else toast('marca el tipo de daño y el estado actual'); });
    el.appendChild(cont);
  }
  function rCiudad(el) {
    var q = srch(el, 'buscar ciudad'), ls = h('div', { 'class': 'ls' }); el.appendChild(ls);
    var C = (typeof CIUDADES_VE !== 'undefined') ? CIUDADES_VE : [];
    ls.innerHTML = C.map(function (c, i) { return '<button data-i="' + i + '" data-n="' + norm(c) + '"' + (d.ciudad === c ? ' class="sel"' : '') + '>' + c.replace(/</g, '&lt;') + IC.chev + '</button>'; }).join('');
    ls.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('button'); if (!b) return; selOnly(ls, b); d.ciudad = C[+b.dataset.i]; buzz(); later(next); });
    q.addEventListener('input', function () { var v = norm(q.value.trim()); [].forEach.call(ls.children, function (x) { x.style.display = !v || x.dataset.n.indexOf(v) > -1 ? '' : 'none'; }); });
  }
  function rClase(el) { cards(el, CLASES, 'clase'); }
  function money(el, key, o) {
    o = o || {};
    var w = h('div', { 'class': 'blk big' }), i = h('input', { type: 'text', inputmode: 'numeric', placeholder: '0', autocomplete: 'off', enterkeyhint: 'done', value: num(d[key]) ? fmt(num(d[key])) : '' });
    w.appendChild(h('span', { 'class': 'pre' }, ['$'])); w.appendChild(i); w.appendChild(h('span', { 'class': 'u' }, [o.u || 'USD'])); el.appendChild(w);
    function set(n) { n = Math.max(0, Math.min(n, 99999999)); d[key] = n; i.value = n ? fmt(n) : ''; refresh(); }
    i.addEventListener('input', function () { set(num(i.value)); });
    i.addEventListener('keydown', function (e) { if (e.key === 'Enter') { i.blur(); if (S[cur].ok && S[cur].ok()) next(); } });
    var st = h('div', { 'class': 'stp' }), s1 = o.step || 100, s2 = o.big || 500;
    [[-1, '−'], [1, '+']].forEach(function (p) {
      var b = h('button', { 'aria-label': p[0] < 0 ? 'bajar' : 'subir' }, [p[1]]), t, n = 0;
      function tick() { set(num(d[key]) + p[0] * (n > 8 ? s2 : s1)); buzz(); n++; t = setTimeout(tick, n < 3 ? 320 : n < 8 ? 140 : 90); }
      function stop() { clearTimeout(t); n = 0; }
      b.addEventListener('pointerdown', function (e) { e.preventDefault(); tick(); });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { b.addEventListener(ev, stop); });
      st.appendChild(b);
    });
    el.appendChild(st);
    return i;
  }
  function rPrecio(el) { money(el, 'precio'); el.appendChild(h('p', { 'class': 'hint' }, ['Mantén presionado + o − para ir más rápido.'])); }
  function sw(el, key, title, sub, onChange, icon) {
    var t = h('div', { 'class': 'tg' + (d[key] ? ' on' : '') }), r = h('button', { 'class': 'sw2', role: 'switch', 'aria-checked': d[key] ? 'true' : 'false' },
      [icon ? h('div', { 'class': 'ic', html: icon }) : null, h('div', { 'class': 'tx' }, [h('b', null, [title]), sub ? h('small', null, [sub]) : null]), t]);
    r.addEventListener('click', function () { d[key] = !d[key]; t.classList.toggle('on', !!d[key]); r.setAttribute('aria-checked', d[key] ? 'true' : 'false'); buzz(); if (onChange) onChange(!!d[key]); refresh(); });
    el.appendChild(r); return r;
  }
  function rFinan(el) {
    var box = h('div', { 'class': 'blk' }); el.appendChild(box);
    var rv = h('div', { 'class': 'rev' + (d.finan ? ' on' : '') }), ta = h('textarea', { 'class': 'ta', placeholder: 'Explica las condiciones: inicial, cuotas, tasa, requisitos…', style: 'min-height:130px' });
    ta.value = d.finanTxt || ''; rv.appendChild(ta);
    sw(box, 'finan', 'Ofrecer financiamiento', 'Si eres concesionario o tienes un plan propio. Los carros con financiamiento reciben más contactos.', function (on) { rv.classList.toggle('on', on); });
    box.appendChild(rv);
    ta.addEventListener('input', function () { d.finanTxt = ta.value; refresh(); });
  }
  function rBase(el) {
    money(el, 'base', { nofocus: 1 });
    var rv = h('div', { 'class': 'fld' }), w = h('div', { 'class': 'tel' }), i = h('input', { type: 'text', inputmode: 'numeric', placeholder: 'opcional', value: num(d.reserva) ? fmt(num(d.reserva)) : '' });
    w.appendChild(h('span', null, ['$'])); w.appendChild(i);
    rv.appendChild(h('label', null, ['Precio de reserva · solo lo ves tú'])); rv.appendChild(w);
    rv.appendChild(h('p', { 'class': 'hint', style: 'margin-top:8px' }, ['El mínimo por el que vendes. No se muestra en la publicación.']));
    el.appendChild(rv);
    i.addEventListener('input', function () { var n = num(i.value); d.reserva = n || ''; i.value = n ? fmt(n) : ''; });
  }
  function rDur(el) {
    if (!d.dur) d.dur = 5;
    var g = h('div', { 'class': 'yg blk' });
    DURS.forEach(function (n) { g.appendChild(h('button', { 'class': 'c' + (d.dur === n ? ' sel' : ''), on: { click: function (e) { selOnly(g, e.currentTarget); d.dur = n; buzz(); later(next); } } }, [n + (n === 1 ? ' día' : ' días')])); });
    el.appendChild(g); el.appendChild(h('p', { 'class': 'hint' }, ['5 días es lo que mejor funciona.']));
  }
  function today() { var n = new Date(); return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0'); }
  function futuro() { if (!d.pf || !d.ph) return false; var t = new Date(d.pf + 'T' + d.ph + ':00').getTime(); return !isNaN(t) && t > Date.now(); }
  function rProg(el) {
    var rv = h('div', { 'class': 'rev' + (d.prog === 'prog' ? ' on' : '') });
    cards(el, [['ya', 'Apenas se apruebe', 'Arranca cuando Ruedda la revise.'], ['prog', 'Programarla', 'Capta interesados hasta la fecha que elijas.']], 'prog', null, function (v) { rv.classList.toggle('on', v === 'prog'); refresh(); if (v === 'ya') later(next); });
    var f1 = h('input', { 'class': 'inp', type: 'date', min: today(), value: d.pf || '' }), f2 = h('input', { 'class': 'inp', type: 'time', value: d.ph || '' });
    var msg = h('p', { 'class': 'hint' }, ['Recomendado: deja que capte interesados unos días.']);
    rv.appendChild(h('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:8px' }, [h('div', { 'class': 'fld', style: 'margin-top:0' }, [h('label', null, ['Fecha']), f1]), h('div', { 'class': 'fld', style: 'margin-top:0' }, [h('label', null, ['Hora']), f2])]));
    rv.appendChild(msg); el.appendChild(rv);
    function chk() { d.pf = f1.value; d.ph = f2.value; var bad = d.pf && d.ph && !futuro(); msg.textContent = bad ? 'Tiene que ser en el futuro.' : 'Recomendado: deja que capte interesados unos días.'; msg.style.color = bad ? '#ff5a52' : ''; refresh(); }
    f1.addEventListener('input', chk); f2.addEventListener('input', chk); f1.addEventListener('change', chk); f2.addEventListener('change', chk);
  }
  function rDir(el) {
    var w = h('div', { 'class': 'blk big' }), i = h('input', { type: 'text', placeholder: 'ej. Las Mercedes', autocomplete: 'street-address', enterkeyhint: 'next', value: d.dir || '', style: 'font-size:30px' });
    w.appendChild(i); el.appendChild(w);
    i.addEventListener('input', function () { d.dir = i.value; refresh(); });
    i.addEventListener('keydown', function (e) { if (e.key === 'Enter' && (d.dir || '').trim().length >= 4) { i.blur(); next(); } });
    var g = h('div', { 'class': 'ch sug' });
    ['Caracas', 'Valencia', 'Maracaibo', 'Lechería', 'Barquisimeto'].forEach(function (c) { g.appendChild(h('button', { 'class': 'c', on: { click: function () { i.value = (i.value.trim() ? i.value.replace(/,?\s*$/, '') + ', ' : '') + c; d.dir = i.value; refresh(); } } }, [c])); });
    el.appendChild(g);
  }
  function rPdia(el) { money(el, 'pdia', { u: '/ día', step: 5, big: 20 }); el.appendChild(h('p', { 'class': 'hint' }, ['Mantén presionado + o − para ir más rápido.'])); }
  function rDispo(el) {
    var now = new Date(), Y = now.getFullYear(), M = now.getMonth(), td = today();
    d.dias = (d.dias || []).filter(function (k) { return k >= td; });
    var MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    var cal = h('div', { 'class': 'cal blk' }), hb = h('b'), g = h('div', { 'class': 'g' }), cnt = h('div', { 'class': 'cal-n' });
    var pv = h('button', { 'aria-label': 'mes anterior', html: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>' }), nx = h('button', { 'aria-label': 'mes siguiente', html: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>' });
    cal.appendChild(h('div', { 'class': 'hd' }, [pv, hb, nx])); cal.appendChild(g); el.appendChild(cal);
    function key(y, m, dd) { return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(dd).padStart(2, '0'); }
    function days() { var out = [], n = new Date(Y, M + 1, 0).getDate(); for (var i = 1; i <= n; i++) { var k = key(Y, M, i); if (k >= td) out.push([k, new Date(Y, M, i).getDay()]); } return out; }
    function paint() {
      hb.textContent = MES[M] + ' ' + Y;
      var off = new Date(Y, M, 1).getDay(), n = new Date(Y, M + 1, 0).getDate(), s = '';
      ['D', 'L', 'M', 'M', 'J', 'V', 'S'].forEach(function (w) { s += '<div class="wd">' + w + '</div>'; });
      for (var i = 0; i < off; i++) s += '<div></div>';
      for (var j = 1; j <= n; j++) { var k = key(Y, M, j); s += '<button class="dy' + (d.dias.indexOf(k) > -1 ? ' sel' : '') + (k < td ? ' past' : '') + '" data-k="' + k + '">' + j + '</button>'; }
      g.innerHTML = s;
      pv.style.opacity = (Y === now.getFullYear() && M === now.getMonth()) ? 0.3 : 1; upd();
    }
    g.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.dy'); if (!b || b.classList.contains('past')) return;
      var k = b.dataset.k, j = d.dias.indexOf(k); if (j > -1) d.dias.splice(j, 1); else d.dias.push(k);
      b.classList.toggle('sel', j < 0); buzz(); upd();
    });
    function upd() { var n = d.dias.length; cnt.textContent = n ? (n + (n === 1 ? ' día disponible' : ' días disponibles')) : 'Ningún día marcado'; refresh(); }
    pv.addEventListener('click', function () { if (Y === now.getFullYear() && M === now.getMonth()) return; M--; if (M < 0) { M = 11; Y--; } paint(); });
    nx.addEventListener('click', function () { if ((Y - now.getFullYear()) * 12 + M - now.getMonth() >= 11) return; M++; if (M > 11) { M = 0; Y++; } paint(); });
    var q = h('div', { 'class': 'ch cal-q' });
    [['Todo el mes', function () { return true; }], ['Fines de semana', function (x) { return x[1] === 0 || x[1] === 6; }], ['Entre semana', function (x) { return x[1] > 0 && x[1] < 6; }]].forEach(function (o) {
      q.appendChild(h('button', { 'class': 'c', on: { click: function () { days().forEach(function (x) { if (o[1](x) && d.dias.indexOf(x[0]) < 0) d.dias.push(x[0]); }); buzz(); paint(); } } }, [o[0]]));
    });
    q.appendChild(h('button', { 'class': 'c', on: { click: function () { var ks = days().map(function (x) { return x[0]; }); d.dias = d.dias.filter(function (k) { return ks.indexOf(k) < 0; }); paint(); } } }, ['Limpiar mes']));
    el.appendChild(q); el.appendChild(cnt); paint();
  }
  function rDesc(el) {
    var ta = h('textarea', { 'class': 'ta blk', placeholder: K === 'alquiler' ? 'Cuéntale a quien lo va a alquilar sobre tu carro…' : 'Estado, equipamiento, historial, mantenimiento. Mientras más detalle, más rápido se vende.' });
    ta.value = d.desc || ''; el.appendChild(ta);
    var mb = h('i'), lab = h('span'), mt = h('div', { 'class': 'meter' }, [h('div', { 'class': 'mb' }, [mb]), lab]); el.appendChild(mt);
    function upd() { var n = (d.desc || '').trim().length; mb.style.width = Math.min(100, n / DMIN * 100) + '%'; mt.classList.toggle('ok', n >= DMIN); lab.textContent = n >= DMIN ? 'bien detallado' : 'faltan ' + (DMIN - n) + ' caracteres'; refresh(); }
    ta.addEventListener('input', function () { d.desc = ta.value; upd(); });
    var g = h('div', { 'class': 'ch add-ch' });
    (FRASES[K] || FRASES.venta).forEach(function (f) {
      if ((d.desc || '').toLowerCase().indexOf(f) > -1) return;
      g.appendChild(h('button', { 'class': 'c', on: { click: function (e) { var v = ta.value.trim(); ta.value = (v ? (/[.!]$/.test(v) ? v + ' ' : v + '. ') : '') + f.charAt(0).toUpperCase() + f.slice(1) + '.'; d.desc = ta.value; e.currentTarget.remove(); buzz(); upd(); } } }, [f]));
    });
    el.appendChild(g);
    el.appendChild(h('p', { 'class': 'hint' }, ['Las descripciones vagas se rechazan en revisión.']));
    upd();
  }
  function rReq(el) {
    var ta = h('textarea', { 'class': 'ta blk', placeholder: 'ej. mayor de 25 años, licencia vigente, depósito de garantía…', style: 'min-height:120px' });
    ta.value = d.req || ''; el.appendChild(ta);
    ta.addEventListener('input', function () { d.req = ta.value; refresh(); });
    var g = h('div', { 'class': 'ch add-ch' });
    ['mayor de 25 años', 'licencia vigente', 'cédula', 'depósito de garantía', 'no fumar', 'sin mascotas', 'solo dentro de la ciudad'].forEach(function (f) {
      if ((d.req || '').toLowerCase().indexOf(f) > -1) return;
      g.appendChild(h('button', { 'class': 'c', on: { click: function (e) { var v = ta.value.trim(); ta.value = (v ? v.replace(/[.,]?$/, ', ') : '') + f; d.req = ta.value; e.currentTarget.remove(); buzz(); refresh(); } } }, [f]));
    });
    el.appendChild(g);
  }
  function waFmt(n) { return String(n || '').replace(/^(\d{3})(\d{0,3})(\d{0,4}).*/, function (_, a, b, c) { return [a, b, c].filter(Boolean).join(' '); }); }
  function rContacto(el) {
    if (!d.wa) { try { var tel = String((USER_STATE && (USER_STATE.telefono || USER_STATE.celular)) || '').replace(/\D/g, '').replace(/^58/, '').replace(/^0/, ''); if (tel.length === 10) d.wa = tel; } catch (e) {} }
    var w = h('div', { 'class': 'tel blk' }), i = h('input', { type: 'tel', inputmode: 'tel', autocomplete: 'tel-national', placeholder: '412 000 0000', value: waFmt(d.wa) });
    w.appendChild(h('span', null, ['+58'])); w.appendChild(i); el.appendChild(w);
    el.appendChild(h('p', { 'class': 'hint' }, ['Solo lo ven los compradores interesados.']));
    i.addEventListener('input', function () { var n = i.value.replace(/\D/g, '').replace(/^58/, '').replace(/^0/, '').slice(0, 10); i.value = waFmt(n); d.wa = n; refresh(); });
    i.addEventListener('keydown', function (e) { if (e.key === 'Enter' && String(d.wa || '').length >= 10) { i.blur(); next(); } });
  }
  function addVideos(files) {
    [].slice.call(files || []).forEach(function (f) {
      if (F.videos.length >= MAX_VIDEOS) { toast('máximo ' + MAX_VIDEOS + ' videos'); return; }
      if (f.size > MAX_VIDEO_BYTES) { toast('"' + f.name + '" pesa más de 500MB, no se agregó'); return; }
      F.videos.push(f);
    });
    filesDirty = true; buzz(); if (els.extras && els.extras._set) els.extras._set();
  }
  function addDocs(files) {
    [].slice.call(files || []).forEach(function (f) {
      if (F.docs.length >= MAX_DOCS) { toast('máximo ' + MAX_DOCS + ' documentos'); return; }
      if (f.size > 20 * 1024 * 1024) { toast('"' + f.name + '" pesa más de 20MB, no se agregó'); return; }
      F.docs.push(f);
    });
    filesDirty = true; buzz(); if (els.extras && els.extras._set) els.extras._set();
  }
  function rExtras(el) {
    var L = h('div', { 'class': 'xl blk' }); el.appendChild(L);
    var rowsX = [];
    function row(ic, title, sub, list, input, clear) {
      var em = h('em'), r = h('button', { 'class': 'xr', on: { click: function () {
        if (list().length && clear) { if (confirm('¿Quitar ' + list().length + ' ' + title.toLowerCase() + '?')) { clear(); filesDirty = true; set(); } return; }
        input.click();
      } } }, [h('div', { 'class': 'ic', html: IC[ic] }), h('div', { 'class': 'tx' }, [h('b', null, [title]), h('small', null, [sub])]), em]);
      function set() { var n = list().length; em.textContent = n ? n + ' ✓' : 'agregar'; r.classList.toggle('ok', !!n); }
      set(); rowsX.push(set); L.appendChild(r); return r;
    }
    row('video', 'Videos', 'Hasta 3, estables y en buena resolución.', function () { return F.videos; }, R.fv, function () { F.videos = []; });
    row('doc', 'Documentos', 'Título, cédula, revisión. Te da el sello "Auditado por Ruedda".', function () { return F.docs; }, R.fd, function () { F.docs = []; });
    el._set = function () { rowsX.forEach(function (f) { f(); }); };
    var cw = h('div', { 'class': 'rev' + (d.avalta ? ' on' : '') }), ci = h('input', { type: 'text', placeholder: 'código de invitación', autocapitalize: 'characters', autocomplete: 'off', value: d.avaltaCode || '' }), cm = h('div', { 'class': 'cmsg' + (d.avaltaCode ? ' ok' : '') }, [d.avaltaCode ? 'Código ' + d.avaltaCode + ' · pendiente de verificación.' : '']);
    cw.appendChild(h('div', { 'class': 'code' }, [ci, h('button', { on: { click: function () {
      var v = ci.value.trim().toUpperCase();
      if (v.replace(/[^A-Z0-9]/g, '').length >= 6) { d.avaltaCode = v; cm.textContent = 'Código ' + v + ' · pendiente de verificación.'; cm.className = 'cmsg ok'; try { _rdHapticSuccess(); } catch (e) { buzz(); } ci.blur(); }
      else { d.avaltaCode = ''; cm.textContent = 'Código incompleto.'; cm.className = 'cmsg bad'; }
    } } }, ['aplicar'])])); cw.appendChild(cm);
    var s = h('div'); L.appendChild(s);
    sw(s, 'avalta', 'Certificado Avalta', 'Solo con código de invitación.', function (on) { cw.classList.toggle('on', on); if (!on) { d.avaltaCode = ''; cm.textContent = ''; ci.value = ''; } }, IC.sello);
    s.appendChild(cw);
    if (K !== 'alquiler') el.appendChild(h('div', { 'class': 'fot' }, [h('b', null, ['Las fotos sí importan.']), h('p', null, ['Una buena sesión puede aumentar la visibilidad de tu publicación un 60%. Contrata un fotógrafo con los estándares de Ruedda en tu ciudad.']),
      h('button', { on: { click: fotografos } }, ['ver fotógrafos disponibles'])]));
  }
  // fotógrafos es una pantalla de la app: se guarda el borrador, se abre, y al volver sigue aquí
  function fotografos() {
    var id = DID;
    saveDraft(true);
    window._pwResumeId = id;
    close(true);
    try { openFotografos('pw'); } catch (e) {}
  }

  function kmReal() { return d.kmU === 'mi' ? Math.round(num(d.km) * 1.609344) : num(d.km); }
  function kmTxt() { return d.kmU === 'mi' ? fmt(num(d.km)) + ' mi' : fmt(num(d.km)) + ' km'; }
  function precioTxt() { return K === 'alquiler' ? '$' + fmt(num(d.pdia)) + ' / día' : K === 'subasta' ? 'Base $' + fmt(num(d.base)) + ' · ' + (d.dur || 5) + ' días' : '$' + fmt(num(d.precio)); }
  function titulo() { return [d.marca, d.modelo].filter(Boolean).join(' ') || 'tu carro'; }
  function rRev(el) {
    var f = F.fotos[0], im = h('div', { 'class': 'im' }); if (f) im.appendChild(img(f));
    var tt = [d.marca, d.modelo, d.version].filter(Boolean).join(' ');
    var meta2 = K === 'alquiler' ? [d.dir, (d.dias || []).length + ' días disponibles'] : [K === 'venta' && d.cond === 'nuevo' ? '0 km · nuevo' : num(d.km) ? kmTxt() : null, d.ciudad, label(TRANS, d.trans)];
    el.appendChild(h('div', { 'class': 'pv blk' }, [im, h('div', { 'class': 'in' }, [h('div', { 'class': 'tt' }, [tt + (d.anio ? ' · ' + d.anio : '')]),
      h('div', { 'class': 'mt' }, [meta2.filter(Boolean).join(' · ')]), h('div', { 'class': 'pr' }, [precioTxt()])])]));
    var A = {
      fotos: ['Fotos', F.fotos.length + ' fotos'], marca: ['Marca', d.marca], modelo: ['Modelo', [d.modelo, d.version].filter(Boolean).join(' · ')], anio: ['Año', d.anio],
      cond: ['Condición', d.cond === 'nuevo' ? 'Nuevo' : d.cond === 'usado' ? 'Usado' : ''], km: ['Kilometraje', num(d.km) ? kmTxt() + (d.kmU === 'mi' ? ' · ' + fmt(kmReal()) + ' km' : '') : ''],
      meca: ['Técnico', [label(TRANS, d.trans), label(COMB, d.comb), label(MOTOR, d.motor), label(TRAC, d.trac)].filter(Boolean).join(' · ')],
      carro: ['Carrocería', label(CARROCERIA, d.carro)], color: ['Color', d.color],
      hist: ['Historia', [d.estadoF, d.duenos ? (d.duenos === '4+' ? (d.duenosN || '4+') : d.duenos) + (d.duenos === '1' ? ' dueño' : ' dueños') : null, label(MODS, d.mod)].filter(Boolean).join(' · ')],
      choque: ['Chocado', d.choc === 'si' ? ['Sí', (d.dano || []).join(', '), d.estado].filter(Boolean).join(' · ') : d.choc === 'no' ? 'No' : ''],
      ciudad: ['Ciudad', d.ciudad], clase: ['Clasificación', label(CLASES, d.clase)],
      precio: ['Precio', '$' + fmt(num(d.precio))], finan: ['Financiamiento', d.finan ? 'Sí' : 'No'],
      base: ['Precio base', '$' + fmt(num(d.base)) + (num(d.reserva) ? ' · reserva $' + fmt(num(d.reserva)) : '')], dur: ['Duración', (d.dur || 5) + ' días'],
      prog: ['Inicio', d.prog === 'prog' ? d.pf + ' · ' + d.ph : 'Apenas se apruebe'], dir: ['Se recoge en', d.dir], pdia: ['Precio por día', '$' + fmt(num(d.pdia))],
      dispo: ['Disponibilidad', (d.dias || []).length + ' días'], desc: ['Descripción', (d.desc || '').trim()], req: ['Requisitos', (d.req || '').trim()],
      contacto: ['WhatsApp', d.wa ? '+58 ' + waFmt(d.wa) : ''],
      extras: ['Extras', [F.videos.length ? F.videos.length + ' videos' : null, F.docs.length ? F.docs.length + ' documentos' : null, d.avaltaCode ? 'Avalta' : null].filter(Boolean).join(' · ') || 'Ninguno']
    };
    var sm = h('div', { 'class': 'sm' });
    flow().forEach(function (id) {
      if (!A[id]) return; var r = A[id];
      sm.appendChild(h('button', { on: { click: function () { if (busy) return; ret = 'rev'; show(id, -1); } } }, [h('span', null, [r[0]]), h('b', null, [r[1] == null || r[1] === '' ? '—' : String(r[1])])]));
    });
    el.appendChild(sm);
    if (PVT === 'consesionario') el.appendChild(h('p', { 'class': 'hint' }, ['Se publica en tu vitrina después de la revisión.']));
  }

  /* —— publicar: se llena el formulario de siempre y se usa su mismo envío —— */
  function ld(on, txt) {
    if (!R.go) return;
    R.go.classList.toggle('ld', !!on); R.go.disabled = !!on || !!(S[cur] && S[cur].ok && !S[cur].ok());
    R.ldt.textContent = on ? (txt || '') : ''; R.ldt.classList.toggle('on', !!(on && txt));
    R.bk.style.pointerEvents = R.cl.style.pointerEvents = on ? 'none' : '';
  }
  function setVal(id, v) {
    var el = document.getElementById(id); if (!el) return;
    v = v == null ? '' : String(v);
    if (el.tagName === 'SELECT' && v && ![].some.call(el.options, function (o) { return o.value === v; })) el.appendChild(new Option(v, v));
    el.value = v;
  }
  function byPH(ph) { var f = document.querySelector('.vender-form'); return f && f.querySelector('input[placeholder="' + ph + '"],textarea[placeholder="' + ph + '"]'); }
  function setPH(ph, v) { var el = byPH(ph); if (el) el.value = v == null ? '' : String(v); }
  function setChk(id, on, fn) { var el = document.getElementById(id); if (!el) return; el.checked = !!on; if (fn) { try { fn(el); } catch (e) {} } }
  function apply() {
    try { pendingVenderType = PVT; } catch (e) {}
    // fotos, videos, documentos
    photoItems = F.fotos.map(function (p) { return { src: p.t || '', name: p.file.name || 'foto.jpg', file: p.file }; });
    try { _rdSyncVenderPhotos(); } catch (e) { window._venderPhotos = F.fotos.map(function (p) { return p.file; }); }
    try { videoItems.forEach(function (v) { if (v.src) URL.revokeObjectURL(v.src); }); } catch (e) {}
    videoItems = F.videos.map(function (f) { return { src: '', name: f.name, file: f }; });
    docItems = F.docs.map(function (f) { return { name: f.name, file: f, isPdf: f.type === 'application/pdf' }; });
    // marca → modelo → versión (en cascada, como los toca la persona)
    setVal('marca-select', d.marca);
    return Promise.resolve(typeof _pjOnMarcaChange === 'function' ? _pjOnMarcaChange(d.marca) : null).catch(function () {}).then(function () {
      var mi = document.getElementById('modelo-input'), vi = document.getElementById('version-input');
      if (mi) { mi.disabled = false; mi.value = (d.modelo || '').trim(); try { _pjOnModeloInput(mi.value); } catch (e) {} }
      if (vi) { vi.disabled = !mi || !mi.value; vi.value = (d.version || '').trim(); try { _pjOnVersionInput(vi.value); } catch (e) {} }
      ['modelo-pj-list', 'version-pj-list'].forEach(function (id) { var l = document.getElementById(id); if (l) l.classList.remove('pj-combo-open'); });
      try { populateYears('year-select'); } catch (e) {}
      setVal('year-select', d.anio);
      var nuevo = K === 'venta' && d.cond === 'nuevo';
      setPH('km', nuevo ? '0' : (num(d.km) ? fmt(kmReal()) : ''));
      setVal('duenos-select', nuevo ? '' : (d.duenos || ''));
      setVal('duenos-exacto-input', d.duenos === '4+' ? (d.duenosN || '') : '');
      setVal('transmision-select', d.trans); setVal('combustible-select', d.comb); setVal('motor-select', d.motor); setVal('traccion-select', d.trac);
      setVal('tipo-vehiculo-select', d.carro); setVal('clasificacion-select', d.clase); setVal('modificaciones-select', d.mod);
      setPH('ej. negro mate', d.color || '');
      setVal('vender-ciudad-select', d.ciudad);
      setPH('precio de venta', K === 'venta' && num(d.precio) ? fmt(num(d.precio)) : '');
      setVal('precio-base-input', K === 'subasta' && num(d.base) ? fmt(num(d.base)) : '');
      setVal('precio-reserva-input', K === 'subasta' && num(d.reserva) ? fmt(num(d.reserva)) : '');
      setVal('auction-duration', d.dur || 5);
      var prog = K === 'subasta' && d.prog === 'prog';
      setChk('programada-toggle', prog);
      setVal('programada-fecha', prog ? d.pf : ''); setVal('programada-hora', prog ? d.ph : '');
      try { setListingCond(nuevo ? 'nuevo' : 'usado'); } catch (e) {}
      setVal('estado-fisico-select', K === 'venta' ? (nuevo ? 'impecable' : d.estadoF) : '');
      setPH('+58 412 000 0000', K === 'venta' && d.wa ? '+58 ' + waFmt(d.wa) : '');
      setPH('sé sumamente detallado: estado, equipamiento, historial. no aceptamos descripciones mediocres, el sistema rechaza la publicación.', (d.desc || '').trim());
      var choc = d.choc === 'si';
      setChk('chocado-toggle', choc);
      document.querySelectorAll('.dano-pill').forEach(function (p) { p.classList.toggle('active', choc && (d.dano || []).indexOf(p.textContent.trim()) > -1); });
      document.querySelectorAll('.estado-pill').forEach(function (p) { p.classList.toggle('active', choc && p.textContent.trim() === d.estado); });
      var fin = K === 'venta' && !!d.finan;
      setChk('financiamiento-toggle', fin);
      setVal('financiamiento-detalle-textarea', fin ? (d.finanTxt || '').trim() : '');
      window._avaltaCode = d.avalta && d.avaltaCode ? d.avaltaCode : '';
      setChk('avalta-toggle', !!window._avaltaCode);
      try { _avaltaSub(); } catch (e) {}
    });
  }
  function publicar() {
    if (busy) return;
    if (K === 'alquiler') return enviarAlquiler();
    busy = 1; ld(true, '');
    apply().then(function () {
      busy = 0; ld(false);
      saveDraft(true);
      try { handlePublicar(); } catch (e) { console.error('[ruedda publicar]', e); toast('no se pudo abrir el pago, intenta de nuevo'); }
    }, function (e) { busy = 0; ld(false); console.error('[ruedda publicar] apply', e); toast('algo falló preparando tu publicación'); });
  }
  function enviarAlquiler() {
    var set = function (id, v) { var el = document.getElementById(id); if (el) el.value = v == null ? '' : String(v); };
    try { populateYears('af-year'); } catch (e) {}
    setVal('af-marca', d.marca); set('af-modelo', (d.modelo || '').trim()); setVal('af-year', d.anio || '');
    set('af-direccion', (d.dir || '').trim()); set('af-precio', num(d.pdia)); set('af-descripcion', (d.desc || '').trim()); set('af-requisitos', (d.req || '').trim());
    _afPhotos = F.fotos.map(function (p) { return { file: p.file, dataUrl: '' }; });
    _afSelectedDates = new Set(d.dias || []);
    busy = 1; ld(true, F.fotos.length ? 'subiendo ' + F.fotos.length + ' fotos…' : 'enviando…');
    saveDraft(true);
    Promise.resolve(submitAlquilerForm({ quiet: true })).then(function (ok) {
      busy = 0; ld(false);
      if (ok) done('alquiler');
    }, function () { busy = 0; ld(false); toast('error publicando'); });
  }
  var doneMsg = '';
  function done(m) {
    busy = 0; ld(false);
    try { closePricingSheet(); } catch (e) {}
    try { closeCheckout(); } catch (e) {}
    window._venderPhotos = [];
    discard();
    doneMsg = m === 'paid' ? 'Verificamos tu pago y te avisamos apenas tu ' + titulo() + ' esté publicado.'
      : m === 'alquiler' ? 'Revisamos tu ' + titulo() + ' y te avisamos apenas esté disponible para alquilar.'
      : m === 'dealer' ? 'Revisamos tu ' + titulo() + ' y sale en tu vitrina apenas se apruebe.'
      : 'Revisamos tu ' + titulo() + ' y te avisamos apenas esté publicado.';
    if (!isOpen) present('fin'); else show('fin', 1);
    try { _rdHapticSuccess(); } catch (e) {}
    try { if (typeof _loadMyListings === 'function' && document.getElementById('mis-pub-grid')) _loadMyListings(); } catch (e) {}
  }
  function rFin(el) {
    var w = h('div', { 'class': 'done-s' });
    w.appendChild(h('div', { html: '<svg class="ck" viewBox="0 0 76 76"><circle cx="38" cy="38" r="36"/><path d="M24 39l10 10 19-21"/></svg>' }));
    w.appendChild(h('h1', null, ['Enviado a revisión.']));
    w.appendChild(h('p', { 'class': 'sub' }, [doneMsg]));
    w.appendChild(h('button', { 'class': 'cta', style: 'margin-top:34px', on: { click: function () {
      var alq = K === 'alquiler';
      close();
      setTimeout(function () { try { if (alq) showView('alquileres'); else openMisPublicaciones(); } catch (e) {} }, 120);
    } } }, [h('span', null, [K === 'alquiler' ? 'ver alquileres' : 'ir a mis publicaciones'])]));
    w.appendChild(h('button', { 'class': 'skip', on: { click: function () { close(); setTimeout(function () { try { openVenderModal(); } catch (e) {} }, 380); } } }, ['publicar otro']));
    el.appendChild(w);
  }

  /* —— el envío de siempre, visto desde aquí —— */
  function active() { return isOpen && K !== 'alquiler'; }
  var _carg = window._rdPubCargando, _cerr = window._rdPubCerrar, _perr = window._rdPubError, _rev = window.showRevisionScreen, _spl = window._showPublicacionRevisionSplash;
  if (typeof _carg === 'function') window._rdPubCargando = function (txt) { if (active()) { if (_cerr) _cerr(); busy = 1; ld(true, txt || 'enviando…'); return; } return _carg.apply(this, arguments); };
  if (typeof _cerr === 'function') window._rdPubCerrar = function () { if (active()) { busy = 0; ld(false); } return _cerr.apply(this, arguments); };
  if (typeof _perr === 'function') window._rdPubError = function () { if (active()) { busy = 0; ld(false); } return _perr.apply(this, arguments); };
  if (typeof _rev === 'function') window.showRevisionScreen = function (m) { if (active()) return done(m); return _rev.apply(this, arguments); };
  if (typeof _spl === 'function') window._showPublicacionRevisionSplash = function () { if (active()) return done('dealer'); return _spl.apply(this, arguments); };

  window.RDPW = {
    open: open, resume: resume, close: close,
    isOpen: function () { return isOpen; },
    drafts: drafts, dropDraft: dropDraft,
    // vuelve al formulario después de una pantalla de la app (fotógrafos)
    back: function () { var id = window._pwResumeId; window._pwResumeId = null; if (id) return resume(id); }
  };
  // se arma en reposo apenas baja el archivo: al tocar "vender" ya está todo listo
  (window.requestIdleCallback || function (f) { setTimeout(f, 1); })(function () { build(); theme(); }, { timeout: 4000 });
})();
