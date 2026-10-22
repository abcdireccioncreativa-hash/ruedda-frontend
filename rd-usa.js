/* rd-usa.js · Subastas USA (Copart / IAAI) dentro de Subastas → "usa".
   Datos: tabla public.usa_lots (la llena .github/workflows/usa-sync.yml una vez al día desde la API
   gratuita de Apibara). Si la tabla está vacía o no existe, el botón "usa" sigue mostrando el aviso
   de lanzamiento de siempre (rdUsaPopup).
   Calculadora de importación: tasas en app_settings 'usa_calc' (Control → Subastas USA). */
(function () {
  var LOTS = [], CALC = null, loaded = false, loading = null, on = false, view = 'home', q = '', F = { plat: 'all', buy: false, make: '', y1: 0, y2: 0, pmax: 0, sort: 'cierre' };
  var F0 = JSON.stringify(F);
  function activo() { return JSON.stringify(F) !== F0; }
  var CALC_DEF = { fee_pct: 10, fee_min: 400, grua_usd: 600, flete_usd: 1800, seguro_pct: 1.5, arancel_pct: 40, iva_pct: 16, tasas_pct: 2, inttt_usd: 150, gestoria_usd: 700 };

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function usd(v) { return '$' + Math.round(Number(v) || 0).toLocaleString('en-US'); }
  function img(u, w) { try { return typeof _tImg === 'function' ? _tImg(u, { width: w || 600, quality: 78 }) : u; } catch (e) { return u; } }
  function sb() { return typeof _supa !== 'undefined' ? _supa : null; }
  function haptic() { try { window._rdHapticNow && window._rdHapticNow('LIGHT'); } catch (e) {} }

  function css() {
    if (document.getElementById('rd-usa-css')) return;
    var s = document.createElement('style'); s.id = 'rd-usa-css';
    s.textContent = [
      '#rd-usa{display:none;padding:4px 0 120px;animation:fadeIn .25s ease;font-family:var(--font);color:var(--white)}',
      '#rd-usa .ru-top{display:flex;gap:10px;padding:6px 18px 0}',
      '#rd-usa .ru-search{flex:1;min-width:0;display:flex;align-items:center;gap:10px;background:var(--card);border:1px solid var(--border);border-radius:999px;padding:0 16px;height:48px}',
      '#rd-usa .ru-search svg{width:19px;height:19px;color:var(--w40);flex-shrink:0}',
      '#rd-usa .ru-search input{flex:1;min-width:0;background:none;border:none;outline:none;color:var(--white);font-family:var(--font);font-size:15.5px}',
      '#rd-usa .ru-search input::placeholder{color:var(--w40)}',
      '#rd-usa .ru-fbtn{display:flex;align-items:center;gap:8px;height:48px;padding:0 18px;border-radius:999px;background:var(--card);border:1px solid var(--border);color:var(--white);font-family:var(--font);font-size:15px;font-weight:600;cursor:pointer;flex-shrink:0}',
      '#rd-usa .ru-fbtn svg{width:18px;height:18px}',
      '#rd-usa .ru-fbtn.act{background:var(--lime);color:var(--lime-ink);border-color:var(--lime)}',
      '#rd-usa .ru-calc{margin:16px 18px 6px;display:flex;align-items:center;gap:16px;padding:14px 18px 14px 14px;border-radius:22px;cursor:pointer;background:linear-gradient(115deg,var(--card) 0%,rgba(var(--rd-green-rgb),.13) 100%);border:1px solid var(--border);-webkit-tap-highlight-color:transparent}',
      '#rd-usa .ru-calc:active{transform:scale(.985)}',
      '#rd-usa .ru-calc-ic{width:58px;height:58px;border-radius:16px;background:var(--w7);display:flex;align-items:center;justify-content:center;flex-shrink:0}',
      '#rd-usa .ru-calc-ic svg{width:34px;height:34px;color:var(--white)}',
      '#rd-usa .ru-calc-t{font-size:16.5px;font-weight:800;letter-spacing:-.3px}',
      '#rd-usa .ru-calc-s{font-size:13px;color:var(--w50);margin-top:3px}',
      '#rd-usa .ru-chev{margin-left:auto;width:20px;height:20px;color:var(--w50);flex-shrink:0}',
      '#rd-usa .ru-row{margin-top:26px}',
      '#rd-usa .ru-rh{display:flex;align-items:center;justify-content:space-between;padding:0 18px;margin-bottom:14px}',
      '#rd-usa .ru-rt{font-size:21px;font-weight:800;letter-spacing:-.6px;line-height:1.15}',
      '#rd-usa .ru-arrow{width:40px;height:40px;border-radius:50%;background:var(--w7);border:none;display:flex;align-items:center;justify-content:center;color:var(--white);cursor:pointer}',
      '#rd-usa .ru-arrow svg{width:19px;height:19px}',
      '#rd-usa .ru-strip{display:flex;gap:14px;overflow-x:auto;scroll-snap-type:x mandatory;scroll-padding:0 18px;padding:0 18px 4px;scrollbar-width:none;-webkit-overflow-scrolling:touch}',
      '#rd-usa .ru-strip::-webkit-scrollbar{display:none}',
      '#rd-usa .ru-strip .ru-card{flex:0 0 72%;scroll-snap-align:start}',
      '@media(min-width:700px){#rd-usa .ru-strip .ru-card{flex-basis:320px}}',
      '#rd-usa .ru-card{min-width:0;cursor:pointer;-webkit-tap-highlight-color:transparent}',
      '#rd-usa .ru-card:active{opacity:.8}',
      '#rd-usa .ru-ph{position:relative;aspect-ratio:4/3;border-radius:18px;overflow:hidden;background:var(--card);box-shadow:inset 0 0 0 1px var(--w6,rgba(255,255,255,.06))}',
      '#rd-usa .ru-ph::after{content:"";position:absolute;inset:0;border-radius:inherit;box-shadow:inset 0 0 0 1px rgba(255,255,255,.06);pointer-events:none}',
      '#rd-usa .ru-ph img{width:100%;height:100%;object-fit:cover;display:block;opacity:0;transition:opacity .3s ease}',
      '#rd-usa .ru-ph .ru-noph{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--w20,rgba(255,255,255,.2))}',
      '.ru-badge{position:absolute;top:10px;left:10px;font-size:11px;font-weight:800;letter-spacing:.8px;text-transform:uppercase;color:#fff;border-radius:999px;padding:6px 11px;line-height:1}',
      '.ru-badge.copart{background:#1f5fff}.ru-badge.iaai{background:#e3122d}',
      '#rd-usa .ru-360{position:absolute;left:10px;bottom:10px;font-size:11.5px;font-weight:700;color:#fff;background:rgba(0,0,0,.55);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);border-radius:999px;padding:5px 9px}',
      '#rd-usa .ru-vid{position:absolute;right:10px;bottom:10px;width:30px;height:30px;border-radius:50%;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center}',
      '#rd-usa .ru-vid svg{width:12px;height:12px;color:#fff;margin-left:2px}',
      '#rd-usa .ru-ct{font-size:15px;font-weight:700;letter-spacing:-.2px;margin-top:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '#rd-usa .ru-cl{font-size:13px;color:var(--w45,rgba(255,255,255,.45));margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.ru-tm{display:flex;align-items:center;gap:5px;font-size:13.5px;font-weight:700;margin-top:4px;font-variant-numeric:tabular-nums}',
      '.ru-tm svg{width:15px;height:15px;color:var(--white);flex-shrink:0}',
      '.ru-tm.fin{color:var(--w40)}',
      '#rd-usa .ru-pr{display:flex;align-items:stretch;gap:10px;margin-top:7px}',
      '#rd-usa .ru-pr>div{min-width:0}',
      '#rd-usa .ru-pr>div+div{border-left:1px solid var(--border);padding-left:10px}',
      '#rd-usa .ru-pl{font-size:11.5px;color:var(--w45,rgba(255,255,255,.45))}',
      '#rd-usa .ru-pv{font-size:16px;font-weight:800;letter-spacing:-.3px;white-space:nowrap}',
      '#rd-usa .ru-pv.buy,#rd-usa .ru-pl.buy{color:var(--rd-green)}',
      '#rd-usa .ru-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px 14px;padding:0 18px}',
      '@media(min-width:700px){#rd-usa .ru-grid{grid-template-columns:repeat(auto-fill,minmax(220px,1fr))}}',
      '#rd-usa .ru-back{display:flex;align-items:center;gap:4px;font-size:14px;font-weight:300;padding:16px 10px 6px;cursor:pointer;width:fit-content}',
      '#rd-usa .ru-back svg{width:22px;height:22px}',
      '#rd-usa .ru-empty{padding:40px 24px;text-align:center;color:var(--w40);font-size:14px}',
      '#rd-usa .ru-foot{padding:26px 18px 0;font-size:11.5px;color:var(--w30);line-height:1.5}',
      /* hojas: detalle, calculadora, filtro */
      '.ru-sheet{position:fixed;inset:0;z-index:10010;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.5);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);animation:fadeIn .2s ease;font-family:var(--font);color:var(--white)}',
      '.ru-sheet .ru-sc{width:100%;max-width:560px;max-height:92vh;overflow-y:auto;background:var(--bg);border:1px solid var(--border);border-bottom:none;border-radius:26px 26px 0 0;padding:0 0 calc(22px + env(safe-area-inset-bottom));animation:fadeInUp .28s cubic-bezier(.25,.46,.45,.94);-webkit-overflow-scrolling:touch}',
      '@media(min-width:700px){.ru-sheet{align-items:center;padding:24px}.ru-sheet .ru-sc{border-radius:26px;border-bottom:1px solid var(--border)}}',
      '.ru-sheet .ru-grab{width:38px;height:4px;border-radius:4px;background:var(--w20,rgba(255,255,255,.2));margin:10px auto 6px}',
      '.ru-sheet .ru-pad{padding:6px 20px 0}',
      '.ru-sheet .ru-h{font-size:22px;font-weight:800;letter-spacing:-.5px;line-height:1.15}',
      '.ru-sheet .ru-sub{font-size:13px;color:var(--w45,rgba(255,255,255,.45));margin-top:4px;line-height:1.45}',
      /* página del lote (entra al post, no hoja) */
      '#ru-post{position:fixed;inset:0;z-index:99;background:var(--bg);color:var(--white);overflow-y:auto;-webkit-overflow-scrolling:touch;font-family:var(--font);transform:translateX(100%);transition:transform .42s cubic-bezier(.32,.72,0,1)}',
      '#ru-post.in{transform:none}',
      '#ru-post .rp-bar{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 14px 8px;background:color-mix(in srgb,var(--bg) 80%,transparent);-webkit-backdrop-filter:blur(22px) saturate(170%);backdrop-filter:blur(22px) saturate(170%);border-bottom:1px solid var(--border)}',
      '#ru-post .rp-back{display:flex;align-items:center;gap:4px;font-size:15px;font-weight:400;cursor:pointer;padding:6px 4px;background:none;border:none;color:var(--white);font-family:var(--font)}',
      '#ru-post .rp-back svg{width:22px;height:22px}',
      '#ru-post .rp-bar .ru-badge{position:static}',
      '#ru-post .rp-acts{display:flex;align-items:center;gap:10px}',
      '#ru-post .rp-share{width:36px;height:36px;border-radius:50%;background:var(--w7);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;color:var(--white);cursor:pointer;padding:0}',
      '#ru-post .rp-share svg{width:17px;height:17px}',
      '#ru-post .rp-hero{position:relative}',
      '#ru-post .rp-gal{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;background:var(--card)}',
      '#ru-post .rp-gal::-webkit-scrollbar{display:none}',
      '#ru-post .rp-gal img{flex:0 0 100%;width:100%;aspect-ratio:4/3;object-fit:cover;scroll-snap-align:start;display:block}',
      '#ru-post .rp-count{position:absolute;right:12px;bottom:12px;font-size:12px;font-weight:600;color:#fff;background:rgba(0,0,0,.6);border-radius:999px;padding:5px 10px;font-variant-numeric:tabular-nums}',
      '#ru-post .rp-thumbs{display:flex;gap:6px;overflow-x:auto;padding:10px 20px 0;scrollbar-width:none}',
      '#ru-post .rp-thumbs::-webkit-scrollbar{display:none}',
      '#ru-post .rp-thumbs img{flex:0 0 64px;height:48px;object-fit:cover;border-radius:8px;opacity:.45;cursor:pointer;transition:opacity .2s}',
      '#ru-post .rp-thumbs img.on{opacity:1;box-shadow:0 0 0 2px var(--white)}',
      '#ru-post .rp-b{padding:20px 20px calc(130px + env(safe-area-inset-bottom));max-width:760px;margin:0 auto}',
      '#ru-post .rp-eye{font-size:11.5px;font-weight:600;letter-spacing:.6px;text-transform:uppercase;color:var(--w45,rgba(255,255,255,.45))}',
      '#ru-post .rp-t{font-size:27px;font-weight:800;letter-spacing:-.8px;line-height:1.1;margin-top:6px}',
      '#ru-post .rp-loc{font-size:14px;color:var(--w50,rgba(255,255,255,.5));margin-top:6px}',
      '#ru-post .rp-time{display:flex;align-items:center;gap:10px;margin-top:18px;padding:14px 16px;border:1px solid var(--border);border-radius:14px}',
      '#ru-post .rp-time svg{width:20px;height:20px;color:var(--white);flex-shrink:0}',
      '#ru-post .rp-time .a{font-size:16px;font-weight:700;font-variant-numeric:tabular-nums}',
      '#ru-post .rp-time .b{font-size:12.5px;color:var(--w45,rgba(255,255,255,.45));margin-top:1px}',
      '#ru-post .rp-pr{display:grid;grid-template-columns:1fr 1fr;border:1px solid var(--border);border-radius:14px;margin-top:10px;overflow:hidden}',
      '#ru-post .rp-pr>div{padding:14px 16px}#ru-post .rp-pr>div+div{border-left:1px solid var(--border)}',
      '#ru-post .rp-pr .l{font-size:12px;color:var(--w45,rgba(255,255,255,.45))}',
      '#ru-post .rp-pr .v{font-size:24px;font-weight:800;letter-spacing:-.6px;margin-top:3px;font-variant-numeric:tabular-nums}',
      '#ru-post .rp-pr .v.buy{color:var(--rd-green)}',
      '#ru-post .rp-pr.one{grid-template-columns:1fr}',
      '#ru-post .rp-h{font-size:13px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:var(--w45,rgba(255,255,255,.45));margin:30px 0 4px}',
      '#ru-post .rp-row{display:flex;justify-content:space-between;gap:16px;padding:13px 0;border-bottom:1px solid var(--border);font-size:14.5px}',
      '#ru-post .rp-row span:first-child{color:var(--w55,rgba(255,255,255,.55))}#ru-post .rp-row span:last-child{font-weight:600;text-align:right;word-break:break-word}',
      '#ru-post .rp-cta{display:flex;flex-direction:column;gap:10px;margin-top:22px}',
      '#ru-post .rp-cta .ru-btn{margin-top:0}',
      '#ru-post .rp-link{display:inline-block;margin-top:20px;font-size:14px;font-weight:500;color:var(--white);text-decoration:underline;text-decoration-color:var(--w30);text-underline-offset:4px}',
      '.ru-gal{display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x mandatory;padding:8px 20px 4px;scrollbar-width:none}',
      '.ru-gal::-webkit-scrollbar{display:none}',
      '.ru-gal img{flex:0 0 86%;aspect-ratio:4/3;object-fit:cover;border-radius:16px;scroll-snap-align:center;background:var(--card)}',
      '.ru-kv{display:grid;grid-template-columns:auto 1fr;gap:9px 16px;margin-top:16px;font-size:13.5px}',
      '.ru-kv dt{color:var(--w45,rgba(255,255,255,.45))}.ru-kv dd{margin:0;text-align:right;font-weight:600;word-break:break-word}',
      '.ru-box{display:flex;gap:10px;margin-top:16px}',
      '.ru-box>div{flex:1;background:var(--card);border:1px solid var(--border);border-radius:16px;padding:12px 14px}',
      '.ru-box .l{font-size:11.5px;color:var(--w45,rgba(255,255,255,.45))}.ru-box .v{font-size:20px;font-weight:800;letter-spacing:-.4px;margin-top:2px}',
      '.ru-box .v.buy{color:var(--rd-green)}',
      '.ru-btn{display:block;width:100%;border:none;border-radius:14px;padding:15px;font-family:var(--font);font-size:15px;font-weight:800;cursor:pointer;margin-top:12px;text-align:center;text-decoration:none}',
      '.ru-btn.p{background:var(--lime);color:var(--lime-ink)}.ru-btn.s{background:var(--w7);color:var(--white);border:1px solid var(--border);font-weight:600}',
      '.ru-note{font-size:11.5px;color:var(--w35,rgba(255,255,255,.35));line-height:1.5;margin-top:12px}',
      '.ru-in{width:100%;background:var(--card);border:1px solid var(--border);border-radius:14px;padding:14px 14px 14px 30px;font-family:var(--font);font-size:20px;font-weight:700;color:var(--white);outline:none}',
      '.ru-inw{position:relative;margin-top:14px}.ru-inw span{position:absolute;left:14px;top:50%;transform:translateY(-50%);font-size:20px;font-weight:700;color:var(--w40)}',
      '.ru-lines{margin-top:16px;border-top:1px solid var(--border)}',
      '.ru-line{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);font-size:13.5px}',
      '.ru-line span:first-child{color:var(--w60,rgba(255,255,255,.6))}.ru-line span:last-child{font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}',
      '.ru-line.tot{border-bottom:none;padding-top:14px}.ru-line.tot span{font-size:17px;font-weight:800;color:var(--white)}.ru-line.tot span:last-child{color:var(--rd-green)}',
      '.ru-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}',
      '.ru-chip{border:1px solid var(--border);background:var(--w7);color:var(--white);border-radius:999px;padding:10px 15px;font-family:var(--font);font-size:14px;font-weight:600;cursor:pointer}',
      '.ru-chip.on{background:var(--lime);border-color:var(--lime);color:var(--lime-ink)}',
      '.ru-yrs{display:flex;align-items:center;gap:10px;margin-top:10px}.ru-yrs span{color:var(--w40)}',
      '.ru-sel{flex:1;min-width:0;appearance:none;-webkit-appearance:none;background:var(--card) url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23999%27 stroke-width=%272%27%3E%3Cpath d=%27m6 9 6 6 6-6%27/%3E%3C/svg%3E") no-repeat right 12px center/16px;border:1px solid var(--border);border-radius:14px;padding:13px 36px 13px 14px;font-family:var(--font);font-size:15px;font-weight:600;color:var(--white)}',
      '.ru-clear{background:none;border:none;color:var(--w50,rgba(255,255,255,.5));font-family:var(--font);font-size:14px;font-weight:600;text-decoration:underline;text-underline-offset:4px;cursor:pointer;padding:4px}',
      '.ru-sheet .ru-chips{flex-wrap:wrap}',
      '.ru-lab{font-size:12px;font-weight:700;color:var(--w45,rgba(255,255,255,.45));margin-top:18px}'
    ].join('');
    document.head.appendChild(s);
  }

  var IC = {
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7.5"/><path d="m20.5 20.5-4.2-4.2"/></svg>',
    filter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></svg>',
    ship: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M5 30h38l-5 9H11z"/><path d="M10 30v-7h28v7"/><path d="M14 23v-6h8v6M26 23v-9h8v9"/><path d="M4 43c3 0 3-1.6 6-1.6s3 1.6 6 1.6 3-1.6 6-1.6 3 1.6 6 1.6 3-1.6 6-1.6 3 1.6 6 1.6"/></svg>',
    chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="m9 6 6 6-6 6"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    timer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 1.5M10 2.5h4M18.5 6.5l1.3-1.3"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg>',
    car: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" style="width:54px;height:54px"><path d="M3 15.5V12l2-5h14l2 5v3.5"/><path d="M3 15.5h18v2.5H3z"/><circle cx="7" cy="15.5" r="1.4"/><circle cx="17" cy="15.5" r="1.4"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5"/><path d="M5 12v6.5A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V12"/></svg>',
    back: '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>'
  };

  function left(t) {
    if (!t) return '';
    var ms = new Date(t).getTime() - Date.now();
    if (!(ms > 0)) return 'finalizada';
    var s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60;
    return d ? d + 'd ' + h + 'h ' + m + 'm' : h + 'h ' + m + 'm ' + ss + 's';
  }
  function tc(t) { return String(t || '').toLowerCase().replace(/(^|[\s\-\/])([a-záéíóúñ0-9])/g, function (m, a, b) { return a + b.toUpperCase(); }).replace(/\b(Bmw|Gmc|Ram|Amg|Ev|Phev|Gt3|Ss|Zl1|Gt|Gts|Gti|Suv|Srt|Rs|Mx|Cx|Hr|Xc|Xj|Xf|Sl|Slk|Cla|Gla|Glb|Glc|Gle|Gls|Ml|Se|Le|Xle|Xse|Lx|Ex|Sv|Sr|Sr5|Trd|Awd|4wd|Ii|Iii)\b/g, function (m) { return m.toUpperCase(); }); }
  function name(x) { return [x.year, tc(x.make), tc(x.model)].filter(Boolean).join(' ') || x.title || 'vehículo'; }
  function photos(x) { try { return Array.isArray(x.photos) ? x.photos : JSON.parse(x.photos || '[]'); } catch (e) { return []; } }

  function card(x) {
    var ph = photos(x)[0], t = left(x.auction_at), fin = t === 'finalizada';
    var pr = x.buy_now
      ? '<div><div class="ru-pl">bids</div><div class="ru-pv">' + usd(x.current_bid) + '</div></div><div><div class="ru-pl buy">comprar ya</div><div class="ru-pv buy">' + usd(x.buy_now) + '</div></div>'
      : '<div><div class="ru-pl">bids</div><div class="ru-pv">' + usd(x.current_bid) + '</div></div>';
    return '<div class="ru-card" data-id="' + esc(x.id) + '">' +
      '<div class="ru-ph">' + (ph ? '<img src="' + esc(img(ph, 600)) + '" alt="" loading="lazy" decoding="async" onload="this.style.opacity=1" onerror="this.remove()">' : '<div class="ru-noph">' + IC.car + '</div>') +
      '<span class="ru-badge ' + (x.platform === 'iaai' ? 'iaai">IAAI' : 'copart">COPART') + '</span>' +
      (x.has_360 ? '<span class="ru-360">360°</span>' : '') + (x.has_video ? '<span class="ru-vid">' + IC.play + '</span>' : '') + '</div>' +
      '<div class="ru-ct">' + esc(name(x)) + '</div>' +
      '<div class="ru-cl">' + esc(x.location || 'Estados Unidos') + '</div>' +
      (x.auction_at ? '<div class="ru-tm' + (fin ? ' fin' : '') + '">' + IC.timer + '<span data-end="' + esc(x.auction_at) + '">' + t + '</span></div>' : '') +
      '<div class="ru-pr">' + pr + '</div></div>';
  }

  function precio(x) { return Number(x.current_bid) || 0; }
  function list() {
    var ql = q.trim().toLowerCase();
    var out = LOTS.filter(function (x) {
      if (F.plat !== 'all' && x.platform !== F.plat) return false;
      if (F.buy && !x.buy_now) return false;
      if (F.make && tc(x.make) !== F.make) return false;
      if (F.y1 && (x.year || 0) < F.y1) return false;
      if (F.y2 && (x.year || 9999) > F.y2) return false;
      if (F.pmax && precio(x) > F.pmax) return false;
      if (ql && (name(x) + ' ' + (x.location || '') + ' ' + (x.damage || '') + ' ' + (x.lot_number || '')).toLowerCase().indexOf(ql) === -1) return false;
      return true;
    });
    var by = {
      cierre: function (a, b) { return new Date(a.auction_at || 0) - new Date(b.auction_at || 0); },
      barato: function (a, b) { return precio(a) - precio(b); },
      caro: function (a, b) { return precio(b) - precio(a); },
      nuevo: function (a, b) { return (b.year || 0) - (a.year || 0); }
    };
    if (activo() || ql) out.sort(by[F.sort] || by.cierre);
    return out;
  }
  function rows(items) {
    var m = {}, order = [];
    items.forEach(function (x) { var k = x.fila || 'otros'; if (!m[k]) { m[k] = { t: x.fila_titulo || 'Subastas USA', items: [] }; order.push(k); } m[k].items.push(x); });
    order.sort(function (a, b) { return (m[a].items[0].fila_orden || 0) - (m[b].items[0].fila_orden || 0); });
    return order.map(function (k) { return { k: k, t: m[k].t, items: m[k].items }; });
  }

  function root() {
    var r = document.getElementById('rd-usa');
    if (r) return r;
    var sec = document.getElementById('auctions-section'); if (!sec) return null;
    r = document.createElement('div'); r.id = 'rd-usa';
    sec.parentNode.insertBefore(r, sec.nextSibling);
    r.addEventListener('click', function (e) {
      var c = e.target.closest('.ru-card'); if (c) { haptic(); return detail(c.getAttribute('data-id')); }
      var a = e.target.closest('[data-ru]'); if (!a) return;
      var k = a.getAttribute('data-ru');
      if (k === 'calc') calc();
      else if (k === 'filter') filter();
      else if (k === 'back') { view = 'home'; paint(); window.scrollTo(0, 0); }
      else if (k.indexOf('row:') === 0) { view = k.slice(4); paint(); window.scrollTo(0, 0); }
    });
    return r;
  }

  function paint() {
    var r = root(); if (!r) return;
    var items = list(), act = activo();
    var head = '<div class="ru-top"><label class="ru-search">' + IC.search + '<input id="ru-q" type="search" placeholder="Buscar en USA" value="' + esc(q) + '" autocomplete="off"></label>' +
      '<button class="ru-fbtn' + (act ? ' act' : '') + '" data-ru="filter">' + IC.filter + 'Filtro</button></div>';
    var calcCard = '<div class="ru-calc" data-ru="calc"><div class="ru-calc-ic">' + IC.ship + '</div><div style="min-width:0"><div class="ru-calc-t">¿Cuánto te sale traerlo?</div><div class="ru-calc-s">Puesto y nacionalizado en Venezuela</div></div><span class="ru-chev">' + IC.chev + '</span></div>';
    var body;
    if (!items.length) body = '<div class="ru-empty">' + (LOTS.length ? 'nada coincide con tu búsqueda' : 'cargando subastas de USA…') + '</div>';
    else if (q.trim() || act || view === 'todo') body = '<div class="ru-row"><div class="ru-rh"><div class="ru-rt">' + (q.trim() || act ? 'Resultados (' + items.length + ')' : 'Todo') + '</div></div><div class="ru-grid">' + items.map(card).join('') + '</div></div>';
    else if (view !== 'home') {
      var rw = rows(items).filter(function (x) { return x.k === view; })[0];
      body = '<div class="ru-back" data-ru="back">' + IC.back + '<span>volver</span></div>' + (rw ? '<div class="ru-row" style="margin-top:6px"><div class="ru-rh"><div class="ru-rt">' + esc(rw.t) + '</div></div><div class="ru-grid">' + rw.items.map(card).join('') + '</div></div>' : '');
    } else body = rows(items).map(function (rw) {
      return '<div class="ru-row"><div class="ru-rh"><div class="ru-rt">' + esc(rw.t) + '</div><button class="ru-arrow" data-ru="row:' + esc(rw.k) + '" aria-label="ver todos">' + IC.arrow + '</button></div><div class="ru-strip">' + rw.items.map(card).join('') + '</div></div>';
    }).join('');
    var upd = LOTS.reduce(function (m, x) { return x.updated_at > m ? x.updated_at : m; }, '');
    r.innerHTML = head + (view === 'home' && !q.trim() ? calcCard : '') + body +
      '<div class="ru-foot">Lotes de Copart e IAAI' + (upd ? ' · precios al ' + new Date(upd).toLocaleString('es', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '') + '. Las pujas cambian en vivo en la subasta; confirma el precio antes de comprar. Ruedda no está afiliado a Copart ni a IAAI.</div>';
    var inp = r.querySelector('#ru-q');
    inp.oninput = function () { q = inp.value; clearTimeout(inp._t); inp._t = setTimeout(function () { var p = inp.selectionStart; paint(); var n = document.getElementById('ru-q'); if (n) { n.focus(); try { n.setSelectionRange(p, p); } catch (e) {} } }, 220); };
  }

  // cuenta regresiva en las cards visibles
  setInterval(function () {
    if (!on) return;
    document.querySelectorAll('#rd-usa [data-end],.ru-sheet [data-end],#ru-post [data-end]').forEach(function (s) {
      var t = left(s.getAttribute('data-end')); if (s.textContent !== t) { s.textContent = t; if (t === 'finalizada') s.parentNode.classList.add('fin'); }
    });
  }, 1000);

  function sheet(html) {
    var o = document.createElement('div'); o.className = 'ru-sheet';
    o.innerHTML = '<div class="ru-sc"><div class="ru-grab"></div>' + html + '</div>';
    o.addEventListener('click', function (e) { if (e.target === o || e.target.closest('[data-x]')) o.remove(); });
    document.body.appendChild(o);
    return o;
  }

  function detail(id) {
    var x = LOTS.filter(function (l) { return l.id === id; })[0]; if (!x) return;
    var phs = photos(x), t = left(x.auction_at), plat = x.platform === 'iaai' ? 'IAAI' : 'Copart';
    var src = x.platform === 'iaai' ? 'https://www.iaai.com/Search?Keyword=' + encodeURIComponent(x.vin || x.lot_number || '') : 'https://www.copart.com/lot/' + encodeURIComponent(x.lot_number || '');
    var fecha = x.auction_at ? new Date(x.auction_at).toLocaleString('es', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' }) : '';
    var ficha = [['Lote', x.lot_number], ['VIN', x.vin], ['Odómetro', x.odometer_mi ? Math.round(x.odometer_mi).toLocaleString('es') + ' mi · ' + Math.round(x.odometer_mi * 1.609).toLocaleString('es') + ' km' : ''], ['Daño', tc(x.damage)], ['Combustible', tc(x.fuel)], ['Transmisión', tc(x.transmission)], ['Ubicación', x.location], ['Subasta', fecha], ['Valor estimado (ERV)', x.erv ? usd(x.erv) : '']]
      .filter(function (r) { return r[1]; });
    var base = x.buy_now || x.current_bid || 0;
    var old = document.getElementById('ru-post'); if (old) old.remove();
    var o = document.createElement('div'); o.id = 'ru-post';
    o.innerHTML = '<div class="rp-bar"><button class="rp-back" data-a="back">' + IC.back + '<span>volver</span></button><div class="rp-acts"><span class="ru-badge ' + x.platform + '">' + plat.toUpperCase() + '</span><button class="rp-share" data-a="share" aria-label="compartir publicación">' + IC.share + '</button></div></div>' +
      (phs.length ? '<div class="rp-hero"><div class="rp-gal">' + phs.map(function (p, i) { return '<img src="' + esc(img(p, 1200)) + '" alt="" ' + (i ? 'loading="lazy" ' : '') + 'decoding="async">'; }).join('') + '</div>' + (phs.length > 1 ? '<span class="rp-count">1 / ' + phs.length + '</span>' : '') + '</div>' +
        (phs.length > 1 ? '<div class="rp-thumbs">' + phs.map(function (p, i) { return '<img src="' + esc(img(p, 200)) + '" data-i="' + i + '" class="' + (i ? '' : 'on') + '" alt="" loading="lazy">'; }).join('') + '</div>' : '') : '') +
      '<div class="rp-b"><div class="rp-eye">' + plat + ' · lote ' + esc(x.lot_number || '') + '</div>' +
      '<div class="rp-t">' + esc(name(x)) + '</div><div class="rp-loc">' + esc(x.location || 'Estados Unidos') + '</div>' +
      (x.auction_at ? '<div class="rp-time">' + IC.timer + '<div><div class="a">' + (t === 'finalizada' ? 'subasta finalizada' : 'cierra en <span data-end="' + esc(x.auction_at) + '">' + t + '</span>') + '</div><div class="b">' + esc(fecha) + '</div></div></div>' : '') +
      '<div class="rp-pr' + (x.buy_now ? '' : ' one') + '"><div><div class="l">bids</div><div class="v">' + usd(x.current_bid) + '</div></div>' + (x.buy_now ? '<div><div class="l">comprar ya</div><div class="v buy">' + usd(x.buy_now) + '</div></div>' : '') + '</div>' +
      '<div class="rp-cta"><a class="ru-btn p" href="mailto:team@ruedda.app?subject=' + encodeURIComponent('Quiero importar: ' + name(x) + ' · lote ' + (x.lot_number || '')) + '&body=' + encodeURIComponent('Hola Ruedda, me interesa este carro de ' + plat + ':\n' + name(x) + '\nLote: ' + (x.lot_number || '') + '\nVIN: ' + (x.vin || '') + '\n' + src) + '">quiero este carro</a>' +
      '<button class="ru-btn s" data-a="calc">¿cuánto me sale traerlo?</button>' +
      '<button class="ru-btn s" data-a="share">compartir publicación</button></div>' +
      '<div class="rp-h">ficha del lote</div>' + ficha.map(function (r) { return '<div class="rp-row"><span>' + esc(r[0]) + '</span><span>' + esc(r[1]) + '</span></div>'; }).join('') +
      '<a class="rp-link" href="' + esc(src) + '" target="_blank" rel="noopener">ver lote original en ' + plat + '</a>' +
      '<div class="ru-note" style="margin-top:18px">Puja tomada en la última actualización de Ruedda; en la subasta cambia en vivo. Ruedda no está afiliado a ' + plat + '.</div></div>';
    var nav = document.querySelector('.navbar'), nb = nav ? nav.getBoundingClientRect().bottom : 0;
    o.style.top = Math.max(0, Math.round(nb)) + 'px';
    document.body.appendChild(o);
    var close = function () { o.classList.remove('in'); setTimeout(function () { o.remove(); }, 420); };
    POST_CLOSE = close;
    dragClose(o, function () { POST_CLOSE = null; o.remove(); });
    o.addEventListener('click', function (e) {
      var a = e.target.closest('[data-a]');
      if (a && a.getAttribute('data-a') === 'back') return close();
      if (a && a.getAttribute('data-a') === 'calc') return calc(base);
      if (a && a.getAttribute('data-a') === 'share') return share(x);
      var th = e.target.closest('.rp-thumbs img'); if (th) { var g = o.querySelector('.rp-gal'); g.scrollTo({ left: g.clientWidth * Number(th.getAttribute('data-i')), behavior: 'smooth' }); }
    });
    var g = o.querySelector('.rp-gal'), cnt = o.querySelector('.rp-count');
    if (g) g.addEventListener('scroll', function () {
      var i = Math.round(g.scrollLeft / Math.max(1, g.clientWidth));
      if (cnt) cnt.textContent = (i + 1) + ' / ' + phs.length;
      o.querySelectorAll('.rp-thumbs img').forEach(function (im, k) { im.classList.toggle('on', k === i); });
    }, { passive: true });
    o.offsetHeight; requestAnimationFrame(function () { o.classList.add('in'); });
  }

  var POST_CLOSE = null;
  // mismo gesto que los posts de Ruedda: sigue el dedo, se va con la velocidad o vuelve con resorte
  function dragClose(o, gone) {
    var g = null;
    o.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1 || o.scrollTop > 0 || e.target.closest('.rp-gal,.rp-thumbs,input')) { g = null; return; }
      var t = e.touches[0]; g = { x: t.clientX, y: t.clientY, d: 0, ax: null, h: [[performance.now(), t.clientY]] };
    }, { passive: true });
    o.addEventListener('touchmove', function (e) {
      if (!g) return;
      var t = e.touches[0], dx = t.clientX - g.x, dy = t.clientY - g.y;
      if (!g.ax) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        g.ax = dy > 0 && dy > Math.abs(dx) * 1.2 ? 'y' : (dx > 0 && dx > Math.abs(dy) * 1.3 ? 'x' : 'no');
        if (g.ax === 'no') { g = null; return; }
        o.style.transition = 'none';
      }
      e.preventDefault();
      var now = performance.now(), c = g.ax === 'y' ? t.clientY : t.clientX;
      g.h.push([now, c]); while (g.h.length > 2 && now - g.h[0][0] > 90) g.h.shift();
      g.d = Math.max(0, g.ax === 'y' ? dy : dx);
      var p = g.d / (g.ax === 'y' ? innerHeight : innerWidth);
      o.style.transform = g.ax === 'y' ? 'translate3d(0,' + g.d + 'px,0) scale(' + (1 - p * 0.08).toFixed(4) + ')' : 'translate3d(' + g.d + 'px,0,0)';
      o.style.borderRadius = g.ax === 'y' ? Math.min(26, g.d / 4) + 'px' : '';
    }, { passive: false });
    var end = function () {
      if (!g || !g.ax) { g = null; return; }
      var a = g.h[0], b = g.h[g.h.length - 1], v = (b[1] - a[1]) / Math.max(16, b[0] - a[0]);
      var ax = g.ax, d = g.d, L = ax === 'y' ? innerHeight : innerWidth; g = null;
      var cur = o.style.transform;
      if (d > L * 0.22 || (v > 0.55 && d > 24)) {
        haptic();
        var to = ax === 'y' ? 'translate3d(0,' + innerHeight + 'px,0) scale(.92)' : 'translate3d(' + innerWidth + 'px,0,0)';
        var an = o.animate([{ transform: cur }, { transform: to }], { duration: Math.max(170, Math.min(320, L / Math.max(v, 2.2))), easing: 'cubic-bezier(.25,.8,.3,1)', fill: 'forwards' });
        an.onfinish = gone;
        return;
      }
      o.style.transform = ''; o.style.borderRadius = ''; o.style.transition = '';
      o.animate([{ transform: cur }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.32,1.25,.5,1)' });
    };
    o.addEventListener('touchend', end, { passive: true });
    o.addEventListener('touchcancel', end, { passive: true });
  }
  function share(x) {
    var url = 'https://www.ruedda.app/?usa=' + encodeURIComponent(x.id);
    var title = name(x) + ' · subasta en ' + (x.platform === 'iaai' ? 'IAAI' : 'Copart') + ' · Ruedda';
    haptic();
    if (navigator.share) { navigator.share({ title: title, text: title, url: url }).catch(function () {}); return; }
    var ok = function () { if (typeof showToast === 'function') showToast('link copiado', true); };
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(ok).catch(function () { if (typeof showToast === 'function') showToast(url); });
    else if (typeof showToast === 'function') showToast(url);
  }
  // link compartido (?usa=copart:123): abre Subastas → usa → la página del lote
  function deepLink() {
    var id = null; try { id = new URLSearchParams(location.search).get('usa'); } catch (e) {}
    if (!id) return;
    load().then(function () {
      if (!LOTS.some(function (l) { return l.id === id; })) { if (typeof showToast === 'function') showToast('esa subasta de USA ya cerró'); return; }
      try { if (typeof showView === 'function') showView('home'); if (typeof selectSection === 'function') selectSection('subastas'); } catch (e) {}
      setTimeout(function () { if (typeof rdRegion === 'function') rdRegion('us'); detail(id); }, 350);
    });
  }

  function cfg() { var c = {}; for (var k in CALC_DEF) c[k] = (CALC && CALC[k] != null && CALC[k] !== '') ? Number(CALC[k]) : CALC_DEF[k]; return c; }
  function calc(precio) {
    var o = sheet('<div class="ru-pad"><div class="ru-h">¿Cuánto te sale traerlo?</div><div class="ru-sub">Escribe el precio de la subasta y te decimos cuánto te sale puesto y nacionalizado en Venezuela: grúa, flete, seguro, arancel, IVA y placas.</div>' +
      '<div class="ru-inw"><span>$</span><input class="ru-in" id="ru-cp" inputmode="numeric" placeholder="precio en la subasta" value="' + (precio ? Math.round(precio) : '') + '"></div>' +
      '<div class="ru-lines" id="ru-cl"></div>' +
      '<div class="ru-note">Estimado de referencia con tasas cargadas por Ruedda. El costo final depende del agente aduanal, el puerto, el tipo de vehículo y la tasa del día.</div>' +
      '<button class="ru-btn s" data-x>cerrar</button></div>');
    var inp = o.querySelector('#ru-cp'), out = o.querySelector('#ru-cl');
    function run() {
      var c = cfg(), p = parseFloat(String(inp.value).replace(/[^\d.]/g, '')) || 0;
      if (!p) { out.innerHTML = '<div class="ru-line"><span>escribe el precio para calcular</span><span></span></div>'; return; }
      var fee = Math.max(p * c.fee_pct / 100, c.fee_min), seg = (p + c.grua_usd + c.flete_usd) * c.seguro_pct / 100;
      var cif = p + fee + c.grua_usd + c.flete_usd + seg, ar = cif * c.arancel_pct / 100, iva = (cif + ar) * c.iva_pct / 100, ta = cif * c.tasas_pct / 100;
      var tot = cif + ar + iva + ta + c.inttt_usd + c.gestoria_usd;
      var L = [['Precio en la subasta', p], ['Comisión de la subasta (' + c.fee_pct + '%)', fee], ['Grúa hasta el puerto en USA', c.grua_usd], ['Flete marítimo a Venezuela', c.flete_usd], ['Seguro (' + c.seguro_pct + '%)', seg], ['Arancel de nacionalización (' + c.arancel_pct + '%)', ar], ['IVA (' + c.iva_pct + '%)', iva], ['Tasas aduaneras (' + c.tasas_pct + '%)', ta], ['INTTT · placas y registro', c.inttt_usd], ['Agente aduanal y gestoría', c.gestoria_usd]];
      out.innerHTML = L.map(function (l) { return '<div class="ru-line"><span>' + esc(l[0]) + '</span><span>' + usd(l[1]) + '</span></div>'; }).join('') + '<div class="ru-line tot"><span>Total estimado</span><span>' + usd(tot) + '</span></div>';
    }
    inp.oninput = run; run(); if (!precio) setTimeout(function () { inp.focus(); }, 300);
  }

  function filter() {
    var makes = {}, ys = [];
    LOTS.forEach(function (x) { var m = tc(x.make); if (m) makes[m] = (makes[m] || 0) + 1; if (x.year) ys.push(x.year); });
    var mk = Object.keys(makes).sort(function (a, b) { return makes[b] - makes[a] || a.localeCompare(b); });
    var ymin = ys.length ? Math.min.apply(null, ys) : 1990, ymax = ys.length ? Math.max.apply(null, ys) : new Date().getFullYear() + 1, yr = [];
    for (var y = ymax; y >= ymin; y--) yr.push(y);
    var chips = function (g, ops, cur) { return '<div class="ru-chips" data-g="' + g + '">' + ops.map(function (p) { return '<button class="ru-chip' + (String(cur) === String(p[0]) ? ' on' : '') + '" data-v="' + esc(p[0]) + '">' + esc(p[1]) + '</button>'; }).join('') + '</div>'; };
    var sel = function (id, cur, lbl) { return '<select class="ru-sel" id="' + id + '"><option value="0">' + lbl + '</option>' + yr.map(function (y) { return '<option value="' + y + '"' + (cur === y ? ' selected' : '') + '>' + y + '</option>'; }).join('') + '</select>'; };
    var o = sheet('<div class="ru-pad"><div style="display:flex;align-items:baseline;justify-content:space-between"><div class="ru-h">Filtros</div><button class="ru-clear" data-clear>limpiar</button></div>' +
      '<div class="ru-lab">subasta</div>' + chips('plat', [['all', 'todas'], ['copart', 'Copart'], ['iaai', 'IAAI']], F.plat) +
      '<div class="ru-lab">marca</div>' + chips('make', [['', 'todas']].concat(mk.map(function (m) { return [m, m + ' · ' + makes[m]]; })), F.make) +
      '<div class="ru-lab">año</div><div class="ru-yrs">' + sel('ru-y1', F.y1, 'desde') + '<span>—</span>' + sel('ru-y2', F.y2, 'hasta') + '</div>' +
      '<div class="ru-lab">bids hasta</div>' + chips('pmax', [[0, 'cualquiera'], [5000, '$5.000'], [10000, '$10.000'], [20000, '$20.000'], [40000, '$40.000'], [80000, '$80.000']], F.pmax) +
      '<div class="ru-lab">compra</div>' + chips('buy', [[0, 'todas'], [1, 'solo con comprar ya']], F.buy ? 1 : 0) +
      '<div class="ru-lab">ordenar por</div>' + chips('sort', [['cierre', 'cierra primero'], ['barato', 'menor bid'], ['caro', 'mayor bid'], ['nuevo', 'más nuevos']], F.sort) +
      '<button class="ru-btn p" data-x id="ru-fgo"></button></div>');
    var go = o.querySelector('#ru-fgo');
    function upd() { var n = list().length; go.textContent = n ? 'ver ' + n + (n === 1 ? ' resultado' : ' resultados') : 'sin resultados con estos filtros'; paint(); }
    o.addEventListener('click', function (e) {
      if (e.target.closest('[data-clear]')) { F = JSON.parse(F0); o.remove(); paint(); filter(); return; }
      var b = e.target.closest('.ru-chip'); if (!b) return;
      var g = b.parentNode.getAttribute('data-g'), v = b.getAttribute('data-v');
      b.parentNode.querySelectorAll('.ru-chip').forEach(function (x) { x.classList.toggle('on', x === b); });
      if (g === 'plat') F.plat = v; else if (g === 'make') F.make = v; else if (g === 'pmax') F.pmax = Number(v); else if (g === 'buy') F.buy = v === '1'; else if (g === 'sort') F.sort = v;
      haptic(); upd();
    });
    o.querySelector('#ru-y1').onchange = function () { F.y1 = Number(this.value); if (F.y2 && F.y1 > F.y2) { F.y2 = F.y1; o.querySelector('#ru-y2').value = F.y1; } upd(); };
    o.querySelector('#ru-y2').onchange = function () { F.y2 = Number(this.value); if (F.y1 && F.y2 && F.y2 < F.y1) { F.y1 = F.y2; o.querySelector('#ru-y1').value = F.y2; } upd(); };
    upd();
  }

  function load() {
    if (loading) return loading;
    var s = sb(); if (!s) return Promise.resolve();
    loading = Promise.all([
      s.from('usa_lots').select('*').order('fila_orden', { ascending: true }).order('orden', { ascending: true }).limit(200),
      s.from('app_settings').select('value').eq('key', 'usa_calc').maybeSingle()
    ]).then(function (r) {
      var cut = Date.now() - 6 * 3600 * 1000;
      LOTS = ((r[0] && r[0].data) || []).filter(function (x) { return !x.auction_at || new Date(x.auction_at).getTime() > cut; });
      try { var v = r[1] && r[1].data && r[1].data.value; CALC = v ? (typeof v === 'string' ? JSON.parse(v) : v) : null; } catch (e) { CALC = null; }
      loaded = true; if (on) paint();
    }).catch(function (e) { console.warn('[ruedda usa]', e && e.message); loaded = true; });
    return loading;
  }

  function sync() {
    var r = document.getElementById('rd-usa'), sec = document.getElementById('auctions-section');
    var vis = on && typeof currentSection !== 'undefined' && currentSection === 'subastas';
    if (r) r.style.display = vis ? 'block' : 'none';
    if (sec && on && typeof currentSection !== 'undefined' && currentSection === 'subastas') sec.style.display = 'none';
  }

  // true = hay lotes y se muestra la sección USA; false = sigue el aviso de lanzamiento
  window.rdUsaShow = function () {
    if (!LOTS.length) { load(); return false; }
    css(); on = true; view = 'home'; paint(); sync();
    return true;
  };
  window.rdUsaHide = function () {
    if (!on) return; on = false;
    var r = document.getElementById('rd-usa'); if (r) r.style.display = 'none';
    var sec = document.getElementById('auctions-section');
    if (sec && typeof currentSection !== 'undefined' && currentSection === 'subastas') sec.style.display = 'block';
  };
  window.rdUsaCalc = function (p) { css(); load().then(function () { calc(p); }); };

  // al cambiar de sección se respeta "usa" (renderCurrentSection vuelve a mostrar las subastas de VE)
  function hook() {
    var o = window.renderCurrentSection;
    if (typeof o !== 'function' || o._ru) return;
    var w = function () { var r = o.apply(this, arguments); try { sync(); } catch (e) {} return r; };
    w._ru = true; window.renderCurrentSection = w;
  }
  // al cambiar de vista desde el header (vender, menú…) se cierra la página del lote
  function hookView() {
    var o = window.showView;
    if (typeof o !== 'function' || o._ru) return;
    var w = function () { if (POST_CLOSE && document.getElementById('ru-post')) { POST_CLOSE(); POST_CLOSE = null; } return o.apply(this, arguments); };
    w._ru = true; window.showView = w;
  }
  function start() { hook(); hookView(); setTimeout(load, 2500); deepLink(); }
  if (document.readyState === 'complete') start(); else window.addEventListener('load', start);
})();
