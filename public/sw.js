/* OptiSpace — service worker.
 * 1. Mode hors ligne : garde une copie des pages, des fichiers de l'application et des
 *    réponses /api (GET) ; le réseau est toujours prioritaire, la copie sert quand il manque.
 *    Les données lues via /api/db (POST) sont gardées par l'application (IndexedDB).
 * 2. Notifications push : reçues même lorsque le site est fermé, ouvrent la page concernée. */

const VERSION = 'v1';
const PAGES = `optispace-pages-${VERSION}`;
const STATIC = `optispace-static-${VERSION}`;
const API = `optispace-api-${VERSION}`;
// En développement, les fichiers changent sans changer de nom : jamais servis du cache en premier
const DEV = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith('optispace-') && ![PAGES, STATIC, API].includes(k)).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// Déconnexion : l'application demande d'effacer toutes les copies
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'optispace:clear-cache') {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('optispace-')).map((k) => caches.delete(k)))));
  }
});

function cacheable(response) {
  return response && response.ok && response.type === 'basic' && !response.redirected;
}

// Réseau d'abord, copie si le réseau manque
async function networkFirst(request, cacheName, { fallbackToPage } = {}) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (cacheable(response)) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (fallbackToPage) {
      // Page jamais ouverte hors ligne : la même page sans paramètres, sinon l'accueil
      const url = new URL(request.url);
      const page = (await cache.match(url.origin + url.pathname, { ignoreSearch: true })) || (await cache.match(url.origin + '/dashboard'));
      if (page) return page;
    }
    throw err;
  }
}

// Copie d'abord (fichiers dont le nom change à chaque version)
async function cacheFirst(request) {
  const cache = await caches.open(STATIC);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (cacheable(response)) cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const path = url.pathname;

  // Jamais de copie : test de connexion, authentification, mesure d'audience, rechargement à chaud
  if (path === '/api/ping' || path.startsWith('/api/auth/') || path.startsWith('/ingest') || path.startsWith('/_next/webpack-hmr')) return;

  if (path.startsWith('/_next/static/') || path.startsWith('/assets/') || /\.(png|jpg|jpeg|svg|ico|webp|woff2?)$/.test(path)) {
    event.respondWith(DEV ? networkFirst(request, STATIC) : cacheFirst(request));
    return;
  }
  if (path.startsWith('/api/')) {
    event.respondWith(networkFirst(request, API));
    return;
  }
  // Pages et données de navigation Next.js (RSC)
  const isRsc = request.headers.get('RSC') === '1' || url.searchParams.has('_rsc');
  if (request.mode === 'navigate' || isRsc) {
    event.respondWith(networkFirst(request, PAGES, { fallbackToPage: request.mode === 'navigate' }));
  }
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'OptiSpace', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'OptiSpace';
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, {
        body: data.body || '',
        // Grande image : le logo en couleur ; petite icône de la barre d'état (Android) :
        // silhouette blanche des lunettes OptiSpace (Android n'en garde que la forme)
        icon: '/icon.png',
        badge: '/notification-badge.png',
        tag: data.tag || undefined,
        renotify: Boolean(data.tag),
        // Jamais silencieuse : le téléphone sonne avec la sonnerie de notification du système
        silent: false,
        // Notification importante (ex. tickets reçus par le point de vente) : vibration
        // marquée, et elle reste affichée jusqu'à ce qu'on la touche
        vibrate: data.ring ? [400, 150, 400, 150, 400] : [200, 100, 200],
        requireInteraction: Boolean(data.ring),
        data: { url: data.url || '/', tag: data.tag || null },
      }),
      // Onglets ouverts : la cloche se met à jour immédiatement, sans attendre le rafraîchissement périodique
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
        windows.forEach((client) => client.postMessage({ type: 'optispace:notification' }));
      }),
    ])
  );
});

// Notification ouverte sur le téléphone : marquée lue sur le serveur, donc sur tous les appareils
function markNotificationRead(tag) {
  const id = typeof tag === 'string' && tag.startsWith('n:') ? tag.slice(2) : null;
  if (!id) return Promise.resolve();
  return fetch('/api/notifications', {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: [id] }),
  }).catch(() => {});
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(markNotificationRead(event.notification.tag));
  const target = new URL(event.notification.data && event.notification.data.url ? event.notification.data.url : '/', self.location.origin);
  // Ne jamais ouvrir une adresse externe
  const url = target.origin === self.location.origin ? target.href : self.location.origin + '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
