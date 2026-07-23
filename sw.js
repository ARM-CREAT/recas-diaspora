/* RECAS — service worker (v5).
   N'intercepte QUE les fichiers du site (jamais Firebase/Google).
   La mise en cache initiale ne bloque plus si un fichier manque. */
const CACHE = 'recas-v5';
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      Promise.all(ASSETS.map(u => c.add(u).catch(() => {})))  // chaque fichier est indépendant : un échec ne bloque pas les autres
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;   // laisse passer Firebase, gstatic, googleapis…
  if (req.mode === 'navigate') {                // page : réseau d'abord, cache si hors-ligne
    e.respondWith(fetch(req).catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(req).then(r => r || fetch(req).catch(() => r)));
});
