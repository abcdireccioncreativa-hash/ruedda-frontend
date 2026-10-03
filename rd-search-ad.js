/* rd-search-ad.js · banner patrocinado de la búsqueda (lupa), editable en Ruedda Control →
   Patrocinantes y banners → "Banner de la búsqueda (lupa)" (patrocinantes.categoria = 'busqueda').
   Si hay uno cargado, reemplaza la tarjeta fija "tu taller de confianza" por su imagen (3:1) con su link.
   Sin banner cargado, queda la tarjeta de siempre. */
(function () {
  var ad = null, loaded = false;
  function css() {
    if (document.getElementById('rd-sad-css')) return;
    var s = document.createElement('style'); s.id = 'rd-sad-css';
    s.textContent = '.rd-sad-img{display:block;position:relative;width:100%;aspect-ratio:3/1;border-radius:16px;overflow:hidden;border:1px solid var(--border);background:var(--card);margin-bottom:20px;cursor:pointer;-webkit-tap-highlight-color:transparent}' +
      '.rd-sad-img img{width:100%;height:100%;object-fit:cover;display:block}' +
      '.rd-sad-img span{position:absolute;top:8px;right:8px;font-size:9px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:#fff;background:rgba(0,0,0,.55);border-radius:6px;padding:3px 6px}';
    document.head.appendChild(s);
  }
  function esc(t) { return String(t || '').replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fill() {
    if (!ad || !ad.imagen_url) return;
    document.querySelectorAll('.rd-search-ad:not([data-sad])').forEach(function (el) {
      el.setAttribute('data-sad', '1');
      css();
      var img = typeof _tImg === 'function' ? _tImg(ad.imagen_url, { width: 1000, quality: 85 }) : ad.imagen_url;
      var box = document.createElement('div');
      box.className = 'rd-sad-img';
      box.setAttribute('role', ad.link ? 'link' : 'img');
      box.setAttribute('aria-label', ad.nombre || 'patrocinado');
      box.innerHTML = '<img src="' + esc(img) + '" alt="' + esc(ad.nombre || '') + '" loading="lazy" decoding="async"><span>ad</span>';
      if (ad.link) box.addEventListener('click', function () {
        try { if (typeof abrirLink === 'function') abrirLink(ad.link, '_blank', 'noopener'); else window.open(ad.link, '_blank', 'noopener'); } catch (e) {}
      });
      el.replaceWith(box);
    });
  }
  function load() {
    if (loaded) return;
    if (typeof _supa === 'undefined' || !_supa) { setTimeout(load, 800); return; }
    loaded = true;
    _supa.from('patrocinantes').select('nombre,imagen_url,link').eq('categoria', 'busqueda').order('created_at', { ascending: false }).limit(1)
      .then(function (r) { ad = r && r.data && r.data[0] || null; fill(); });
  }
  function start() {
    load();
    var pending = false;
    new MutationObserver(function () { if (pending || !ad) return; pending = true; requestAnimationFrame(function () { pending = false; fill(); }); })
      .observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
