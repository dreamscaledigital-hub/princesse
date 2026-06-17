/* Service worker: push notifications + cached custom sounds. */
const SOUND_CACHE = "princesse-sounds-v1";
const SOUND_FILES = [
  "/sounds/clochette.mp3",
  "/sounds/bulle.mp3",
  "/sounds/bise.mp3",
  "/sounds/harpe.mp3",
  "/sounds/silence.mp3",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SOUND_CACHE).then((c) => c.addAll(SOUND_FILES)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== SOUND_CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Serve cached sound files (also keeps them ready for the notification 'sound' option).
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin === self.location.origin && url.pathname.startsWith("/sounds/")) {
    event.respondWith(
      caches.open(SOUND_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        const res = await fetch(event.request);
        if (res.ok) cache.put(event.request, res.clone());
        return res;
      })
    );
  }
});

self.addEventListener("push", (event) => {
  let payload = { title: "Une pensée pour toi 💕", body: "", url: "/", sound: "clochette" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch (_) {
    if (event.data) payload.body = event.data.text();
  }

  const soundId = ["clochette", "bulle", "bise", "harpe", "silence"].includes(payload.sound)
    ? payload.sound
    : "clochette";
  const soundUrl = `/sounds/${soundId}.mp3`;
  const title = payload.title || "Une pensée pour toi 💕";

  event.waitUntil((async () => {
    // 1. If the app is open, tell it to play the sound via Web Audio (most reliable).
    let appIsOpen = false;
    try {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      appIsOpen = clients.some((c) => c.visibilityState === "visible");
      for (const c of clients) {
        c.postMessage({ type: "play-notification-sound", payload: { ...payload, sound: soundId } });
      }
    } catch (_) { /* ignore */ }

    // 2. Show the system notification. When the app is closed/backgrounded we let the
    //    browser play whatever sound it can (it will fetch from the SW-cached MP3 if
    //    supported). When the app is in foreground we mute it (the Web Audio bridge
    //    above already played the user's sound) to avoid a double "ding".
    const options = {
      body: payload.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: payload.tag || "pensee",
      renotify: true,
      data: { url: payload.url || "/", sound: soundId },
      silent: appIsOpen ? true : (soundId === "silence"),
      sound: soundUrl, // Honored by some browsers; ignored by Chrome/iOS — best-effort.
      vibrate: soundId === "silence" ? undefined : [80, 40, 80],
    };

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
