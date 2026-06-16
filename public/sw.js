// Service Worker — keeps driver app alive in background
const CACHE_NAME = 'driver-app-v2';

self.addEventListener('install', e => {
  console.log('[SW] Installing');
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  console.log('[SW] Activated');
  e.waitUntil(clients.claim());
});

// When driver taps the native notification, open/focus the app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('driver.html') && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'NOTIFICATION_CLICKED' });
          return;
        }
      }
      return clients.openWindow('/driver.html');
    })
  );
});

// Background job polling
let pollTimer = null;
let pollConfig = null;

self.addEventListener('message', e => {
  if (!e.data) return;

  if (e.data.type === 'START_POLL') {
    pollConfig = { apiUrl: e.data.apiUrl, driverId: e.data.driverId };
    startPolling();
    console.log('[SW] Started background polling for driver', e.data.driverId);
  }

  if (e.data.type === 'STOP_POLL') {
    stopPolling();
    console.log('[SW] Stopped background polling');
  }

  // Tab tells SW a notification is already being shown — don't double-notify
  if (e.data.type === 'NOTIFICATION_SHOWN') {
    self.registration.getNotifications({ tag: 'job-' + e.data.jobId })
      .then(notes => notes.forEach(n => n.close()));
  }
});

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(doPoll, 15000); // every 15 seconds
  doPoll(); // immediate first poll
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

async function doPoll() {
  if (!pollConfig) return;
  try {
    const res = await fetch(`${pollConfig.apiUrl}/api/driver/pending-notification?driverId=${pollConfig.driverId}`);
    const data = await res.json();

    if (!data.notification) return;

    const job = data.notification;

    // Check if any tab is visible and showing the notification already
    const allClients = await clients.matchAll({ includeUncontrolled: true, type: 'window' });
    
    // Send to all open tabs so they can show in-app notification
    allClients.forEach(c => c.postMessage({ type: 'JOB_NOTIFICATION', job }));

    // Check if all tabs are hidden — if so show native OS notification
    const allHidden = allClients.every(c => c.visibilityState === 'hidden' || !c.visibilityState);
    if (allHidden || allClients.length === 0) {
      // Check if we already showed this notification
      const existing = await self.registration.getNotifications({ tag: 'job-' + job.id });
      if (existing.length === 0) {
        await self.registration.showNotification('🚗 New Job Available!', {
          body: `From: ${job.pickup_address}\nEarnings: ₹${job.estimated_earnings || '—'}`,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: 'job-' + job.id,
          requireInteraction: true,
          vibrate: [300, 100, 300, 100, 300],
          silent: false,
          data: { jobId: job.id }
        });
        console.log('[SW] Showed native notification for job', job.id);
      }
    }
  } catch(e) {
    console.warn('[SW] Poll failed:', e.message);
  }
}
