/* Service worker: push notifications only (no offline cache). */
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = { title: "Une pensée pour toi 💕", body: "" , url: "/" };
  try {
    if (event.data) {
      const data = event.data.json();
      payload = { ...payload, ...data };
    }
  } catch (_) {
    if (event.data) payload.body = event.data.text();
  }
  const title = payload.title || "Une pensée pour toi 💕";
  const options = {
    body: payload.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: payload.tag || "pensee",
    renotify: true,
    data: { url: payload.url || "/" },
    silent: true, // we play the user's chosen sound via the page
    vibrate: [80, 40, 80],
  };
  event.waitUntil((async () => {
    // Tell any open client to play the user's chosen sound.
    try {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of clients) {
        c.postMessage({ type: "play-notification-sound", payload });
      }
    } catch (_) { /* ignore */ }
    await self.registration.showNotification(title, options);
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ("focus" in c) {
          c.navigate(url).catch(() => {});
          return c.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
