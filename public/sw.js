// Versioned runtime cache. The cache name comes from ?v=<build id> in the registration URL, so every build starts a fresh cache and old ones are deleted on activate.
// Code/HTML/manifest: network-first (never serve stale code when online). Heavy static art/audio: cache-first within the current build's cache.
const V = new URL(self.location).searchParams.get('v') || '0'; const CACHE = 'wv-' + V;
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => { for (const k of await caches.keys()) if (k.startsWith('wv-') && k !== CACHE) await caches.delete(k); await self.clients.claim(); })()));
const HEAVY = /\.(png|webp|jpg|jpeg|mp3|ogg|woff2?|json)$/i;
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET' || r.headers.has('range')) return; const u = new URL(r.url); if (u.origin !== location.origin) return;
  if (HEAVY.test(u.pathname) && !/manifest/.test(u.pathname)) {
    e.respondWith(caches.open(CACHE).then(async c => { const hit = await c.match(r); if (hit) return hit; const res = await fetch(r); if (res.ok && res.status === 200) c.put(r, res.clone()).catch(() => { }); return res; }));
  } else {
    e.respondWith(fetch(r).then(res => { if (res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)).catch(() => { }); } return res; }).catch(() => caches.match(r).then(h => h || Response.error())));
  }
});
