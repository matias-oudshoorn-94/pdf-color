/**
 * Service worker de baja: la PWA fue eliminada. Los navegadores que tenían
 * instalado el worker anterior descargan este archivo al actualizarse, que
 * borra todas las cachés, se da de baja y recarga las pestañas abiertas.
 */
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then((clients) => clients.forEach((client) => client.navigate(client.url))),
  );
});
