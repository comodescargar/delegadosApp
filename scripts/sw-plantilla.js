// Service worker de la app (plantilla). Al compilar, vite.config.js sustituye la versión y la lista de archivos.
// Estrategia: la app entera (HTML, JS, CSS, iconos) se sirve desde la copia guardada en el móvil, así abre
// sin cobertura y siempre con archivos de la misma versión. Las peticiones a Supabase no pasan por aquí.
const VERSION = '__VERSION__';
const ARCHIVOS = __ARCHIVOS__;
const CACHE = `delegado-${VERSION}`;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('delegado-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

// La app pide activar la versión nueva cuando el usuario pulsa «Actualizar»
self.addEventListener('message', (e) => { if (e.data === 'actualizar') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const pet = e.request;
  if (pet.method !== 'GET') return;
  const url = new URL(pet.url);
  if (url.origin !== self.location.origin) return;

  if (pet.mode === 'navigate') {
    // Páginas: la del árbitro (/a/…) o la app; primero la copia guardada, si no, la red
    const pagina = url.pathname.startsWith('/a/') ? '/arbitro.html' : '/index.html';
    e.respondWith((async () => (await caches.match(pagina, { ignoreVary: true })) || fetch(pet))());
    return;
  }
  e.respondWith((async () => {
    // ignoreVary: los módulos se piden con «crossorigin» y el servidor responde con Vary; sin esto no coinciden
    const guardada = await caches.match(pet, { ignoreSearch: true, ignoreVary: true });
    if (guardada) return guardada;
    try { return await fetch(pet); } catch { return Response.error(); }
  })());
});
