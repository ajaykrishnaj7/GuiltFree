self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    try {
      const registration = self.registration;
      const subscription = await registration.pushManager.getSubscription();
      const endpoint = subscription?.endpoint;

      let title = 'Daily nutrition update';
      let message = 'Open the app for today\'s insight.';

      if (endpoint) {
        const response = await fetch('/api/push/latest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        });
        if (response.ok) {
          const data = await response.json();
          title = data.title || title;
          message = data.message || message;
        }
      }

      await registration.showNotification(title, {
        body: message,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        data: { href: '/trends' },
      });
    } catch {
      await self.registration.showNotification('Daily nutrition update', {
        body: 'Open the app for today\'s insight.',
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        data: { href: '/trends' },
      });
    }
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const href = event.notification?.data?.href || '/';

  event.waitUntil((async () => {
    const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientList) {
      if (client.url.includes(self.location.origin) && 'focus' in client) {
        if ('navigate' in client) {
          await client.navigate(href);
        }
        client.focus();
        return;
      }
    }
    if (self.clients.openWindow) {
      await self.clients.openWindow(href);
    }
  })());
});
