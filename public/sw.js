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
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icon.png',
      badge: '/icon.png',
      tag: data.tag || undefined,
      data: { url: data.url || '/' },
    })
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
