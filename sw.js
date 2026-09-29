// sw.js — Service Worker de Ruedda. Dos trabajos: recibir push notifications
// y mostrar un splash bonito cuando no hay internet (fetch offline fallback).
// No hace cache agresivo de assets a propósito — este proyecto deploya seguido
// y no queremos servir HTML viejo desde cache. Solo cachea lo mínimo para
// poder mostrar la pantalla de "sin conexión" cuando la red falla.

const OFFLINE_CACHE = 'ruedda-offline-v1';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(OFFLINE_CACHE).then((cache) => cache.add(OFFLINE_URL)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// [offline] solo intercepta navegaciones (cargar una página completa), nunca
// las peticiones a Supabase/APIs — si esas fallan, el propio código de la app
// ya las maneja (toasts de error, reintentos). Esto es solo para el caso
// "el usuario abrió/recargó la app y no hay red en absoluto".
// [pwa-perf] estáticos propios: fuentes/íconos con hash → cache-first (nunca cambian);
// splash, isotipo y popups → stale-while-revalidate (sale al instante y se refresca atrás).
const STATIC_CACHE = 'ruedda-static-v1';
function isImmutable(u){ return u.origin === self.location.origin && /^\/assets\/(fonts|inline)\//.test(u.pathname); }
function isSWR(u){ return u.origin === self.location.origin && (/^\/splash\//.test(u.pathname) || /^\/assets\//.test(u.pathname) || u.pathname === '/desktop-popups.js'); }
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method === 'GET' && req.mode !== 'navigate') {
    let u; try { u = new URL(req.url); } catch (e) { return; }
    if (isImmutable(u)) {
      event.respondWith(caches.open(STATIC_CACHE).then(c => c.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }))));
      return;
    }
    if (isSWR(u)) {
      event.respondWith(caches.open(STATIC_CACHE).then(c => c.match(req).then(hit => {
        const net = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => hit);
        return hit || net;
      })));
      return;
    }
    return;
  }
  if (event.request.mode !== 'navigate') return;
  event.respondWith(
    fetch(event.request).catch(() =>
      caches.open(OFFLINE_CACHE).then((cache) => cache.match(OFFLINE_URL))
    )
  );
});

// ============ PUSH ============
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {
    data = { title: 'Ruedda', body: event.data ? event.data.text() : '' };
  }
  const title = data.titulo || data.title || 'Ruedda';
  const body = data.body || '';
  const tag = data.source_type || data.tipo || 'ruedda';
  const url = data.url || '/';

  const options = {
    body,
    tag,
    renotify: true,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url, source_id: data.source_id || null, source_type: data.source_type || null },
    // [Android] agrupa por tipo (ver RUEDDA_ANDROID_BRIEFING.md — canales/tag)
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// [click] enfoca una pestaña ya abierta de Ruedda si existe, si no abre una nueva
// en la URL correcta (calculada del lado del servidor según source_type/source_id).
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) client.navigate(url);
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
