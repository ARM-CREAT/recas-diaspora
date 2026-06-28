/* RECAS — service worker (v2). N'intercepte QUE les fichiers du site,
   et laisse passer Firebase / Google sans y toucher (temps réel intact). */
const CACHE='recas-v2';
const ASSETS=['./','./index.html','./logo.png','./manifest.json'];
self.addEventListener('install',e=>{ e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).catch(()=>{})); self.skipWaiting(); });
self.addEventListener('activate',e=>{ e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);
  if(url.origin!==location.origin) return;            // ⬅️ laisse passer Firebase, gstatic, googleapis…
  if(req.mode==='navigate'){                           // page : réseau d'abord, cache si hors-ligne
    e.respondWith(fetch(req).catch(()=>caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(req).then(r=> r || fetch(req)));  // fichiers : cache d'abord
});
