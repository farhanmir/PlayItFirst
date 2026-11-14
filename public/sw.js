/* The café is online-only. Never store room state, API data, or gameplay pages. */
const CACHE = 'playitfirst-offline-v1';
const OFFLINE = '/offline.html';
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(OFFLINE)));
  // No skipWaiting: an update must not interrupt a running multiplayer session.
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith('playitfirst-offline-') && key !== CACHE)
      .map((key) => caches.delete(key)),
  )).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin
    || url.pathname.startsWith('/api/') || url.pathname === '/ws'
    || event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request).catch(async () =>
    (await caches.match(OFFLINE)) || new Response('Reconnect to play your café.', {
      status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    }),
  ));
});
