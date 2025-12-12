const BASE = new URL("./", self.location).pathname;
const CACHE = "24hcd-pwa-v11"; // mỗi lần cập nhật, tăng số này

const STATIC_ASSETS = [
  BASE,
  BASE + "index.html",
  BASE + "manifest.webmanifest",
  BASE + "icon-192-any.png",
  BASE + "icon-512-any.png",
  BASE + "icon-192-maskable.png",
  BASE + "icon-512-maskable.png",
  BASE + "evn_logo.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    try {
      await cache.addAll(STATIC_ASSETS.map(u => new Request(u, { cache: "reload" })));
    } catch (err) {
      // nếu 1 file 404 làm addAll fail, vẫn cho SW cài để app không trắng
      console.warn("SW precache failed:", err);
    }
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(BASE)) return;

  if (req.mode === "navigate") {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok) cache.put(req, fresh.clone());
        return fresh;
      } catch (_) {
        // không bao giờ trả Response.error() => tránh trắng
        return (await cache.match(req, { ignoreSearch: true }))
          || (await cache.match(BASE + "index.html", { ignoreSearch: true }))
          || (await cache.match(BASE, { ignoreSearch: true }))
          || new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      }
    })());
    return;
  }

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreVary: true });
    if (cached) return cached;

    try {
      const res = await fetch(req);
      if (res && res.ok && req.method === "GET") cache.put(req, res.clone());
      return res;
    } catch (_) {
      return (await cache.match(req, { ignoreSearch: true, ignoreVary: true }))
        || new Response("", { status: 504 });
    }
  })());
});
