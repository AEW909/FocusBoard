const CACHE = "focusboard-v1";

const PRECACHE = ["/", "/login"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first for navigations, cache-first for assets
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, cross-origin, and API requests
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/")
  ) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/"))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) =>
      cached ?? fetch(request).then((response) => {
        if (response.ok && url.pathname.startsWith("/_next/static/")) {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      })
    )
  );
});

// ── Push notifications (wired in slice 2) ────────────────────────────────────

self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title ?? "FocusBoard";
  const options = {
    body: data.body ?? "",
    icon: "/icon-192",
    badge: "/icon-192",
    tag: data.tag ?? "focusboard",
    data: { url: data.url ?? "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url ?? "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((windows) => {
      const existing = windows.find((w) => w.url === target && "focus" in w);
      if (existing) return existing.focus();
      return self.clients.openWindow(target);
    })
  );
});
