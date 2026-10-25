/* OptiSpace — service worker des notifications push.
 * Reçoit les notifications envoyées par le serveur (Web Push) même lorsque le site est fermé,
 * et ouvre la page concernée au clic. */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

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
        icon: '/icon.png',
        badge: '/icon.png',
        tag: data.tag || undefined,
        renotify: Boolean(data.tag),
        data: { url: data.url || '/' },
      }),
      // Onglets ouverts : la cloche se met à jour immédiatement, sans attendre le rafraîchissement périodique
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
        windows.forEach((client) => client.postMessage({ type: 'optispace:notification' }));
      }),
    ])
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
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
