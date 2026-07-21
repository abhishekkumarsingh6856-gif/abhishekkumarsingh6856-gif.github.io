const CACHE_NAME = 'chatgram-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './chatgram-icon-192.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first for navigation/HTML, cache-first for everything else (so updates land quickly)
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return res;
      }).catch(() => cached);
    })
  );
});

// Lets pages ask the SW to show a real, persistent notification (works even
// when the tab is backgrounded, and behaves correctly for installed PWAs).
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'CHATGRAM_NOTIFY') {
    const { title, body, icon, badge, tag, url } = data.payload || {};
    self.registration.showNotification(title || 'Chatgram', {
      body: body || '',
      icon: icon || './icons/icon-192.png',
      badge: badge || './icons/icon-96.png',
      tag: tag || 'chatgram-notif',
      renotify: true,
      data: { url: url || './index.html' },
      vibrate: [80, 40, 80]
    });
  }
});

// Clicking a notification focuses an existing Chatgram tab, or opens a new one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || './index.html';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
