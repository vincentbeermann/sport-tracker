/* Firebase Cloud Messaging — dedicated background service worker.
 * Registered automatically by getToken(), lives alongside the app-shell sw.js.
 * Config inlined (public values); production project only.
 */
importScripts('vendor/firebase-app-compat.js');
importScripts('vendor/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDptFWxxaRpVzAF2QQ7nQfUUAnw39r8_Dc',
  authDomain: 'sport-tracker-vb.firebaseapp.com',
  projectId: 'sport-tracker-vb',
  storageBucket: 'sport-tracker-vb.firebasestorage.app',
  messagingSenderId: '133773343962',
  appId: '1:133773343962:web:dd7eaf4e2be7cc0904f9e3',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const d = payload.data || payload.notification || {};
  const title = d.title || 'Sport';
  const options = {
    body: d.body || 'Zeit für eine Einheit.',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    tag: d.tag || 'sport-reminder',
    data: { url: d.url || '/' },
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.indexOf(self.location.origin) === 0 && 'focus' in c) return c.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
