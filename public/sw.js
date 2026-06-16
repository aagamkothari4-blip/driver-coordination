// Service Worker — keeps driver app alive in background
const CACHE_NAME = 'driver-app-v1';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

// Handle push messages (for future FCM integration)
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {};
  e.waitUntil(
    self.registration.showNotification('New Job Request 🚗', {
      body: data.body || 'A new job is available',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'job-notification',
      requireInteraction: true, // stays on screen until dismissed
      data: data
    })
  );
});

// When driver taps the notification, open/focus the app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('driver.html') && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow('/driver.html');
    })
  );
});

// Background sync — poll for notifications every 20s using the SW alarm
// This works even when the tab is completely backgrounded on mobile
let pollTimer = null;

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'START_POLL') {
    const { apiUrl, driverId } = e.data;
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(async () => {
      try {
        const res = await fetch(`${apiUrl}/api/driver/pending-notification?driverId=${driverId}`);
        const data = await res.json();
        if (data.notification && data.notification.time_remaining > 0) {
          // Send message to all open tabs
          const allClients = await clients.matchAll({ includeUncontrolled: true });
          allClients.forEach(c => c.postMessage({ type: 'JOB_NOTIFICATION', job: data.notification }));
          // Also show a native notification in case tabs are all hidden
          self.registration.showNotification('New Job Request 🚗', {
            body: `Pickup: ${data.notification.pickup_address}`,
            tag: 'job-' + data.notification.id,
            requireInteraction: true,
          });
        }
      } catch(e) {}
    }, 20000);
  }
  if (e.data && e.data.type === 'STOP_POLL') {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }
});
