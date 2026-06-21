/* Skafld service worker — shows push reminders and focuses the app on click. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      let data = {};
      try {
        data = event.data ? event.data.json() : {};
      } catch (e) {
        data = { title: 'Skafld', body: event.data ? event.data.text() : '' };
      }

      // If a Skafld window is open/focused, its in-tab alarm already handles this —
      // don't also pop a system notification (avoids the double-alert).
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (wins.some((c) => c.focused || c.visibilityState === 'visible')) return;

      const title = data.title || 'Skafld';
      await self.registration.showNotification(title, {
        body: data.body || '',
        tag: data.tag || undefined,
        renotify: !!data.tag,
        icon: '/icon.svg',
        badge: '/icon.svg',
        vibrate: [120, 60, 120],
        data: { url: data.url || '/' },
      });
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

// The browser can rotate the push endpoint; tell any open page to re-subscribe & re-POST.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.clients.matchAll({ includeUncontrolled: true }).then((list) => {
      list.forEach((c) => c.postMessage({ type: 'pushsubscriptionchange' }));
    })
  );
});
