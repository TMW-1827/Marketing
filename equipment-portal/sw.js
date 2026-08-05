/* ==========================================================================
   Service Worker: офлайн-режим порталу.
   Стратегія: app shell — cache-first з фоновим оновленням; решта — network-first
   з відкатом на кеш. Дані користувача зберігаються в localStorage/IndexedDB
   і не залежать від кешу.
   ========================================================================== */

const VERSION = 'eq-portal-v1.0.0';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/store.js',
  './js/seed.js',
  './js/auth.js',
  './js/router.js',
  './js/ui.js',
  './js/util.js',
  './js/icons.js',
  './js/workflow.js',
  './js/scanner.js',
  './js/barcode.js',
  './js/views/dashboard.js',
  './js/views/equipment.js',
  './js/views/requests.js',
  './js/views/repairs.js',
  './js/views/inventory.js',
  './js/views/operations.js',
  './js/views/reports.js',
  './js/views/admin.js',
  './js/views/help.js',
  './assets/icon.svg',
  './assets/icon-192.png',
  './assets/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached || caches.match('./index.html'));
      return cached || network;
    })
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
