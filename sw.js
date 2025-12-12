const BASE = new URL("./", self.location).pathname;
const CACHE = "24hcd-pwa-v11"; // mỗi lần cập nhật lớn, tăng số này để tránh cache cũ gây trắng

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
    // addAll dễ fail nếu 1 file 404 => cache từng file để không làm SW “cài đặt fail”
    for (const url of STATIC_ASSETS) {
      try {
        await cache.add(new Request(url, { cache: "reload" }));
      } catch (err) {
        // bỏ qua file lỗi, vẫn cài SW để app không trắng
      }
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

  // Navigate: network-first, fail thì trả index.html (không trả Response.error để tránh trắng)
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok) cache.put(req, fresh.clone());
        return fresh;
      } catch (_) {
        return (await cache.match(req, { ignoreSearch: true }))
          || (await cache.match(BASE + "index.html", { ignoreSearch: true }))
          || (await cache.match(BASE, { ignoreSearch: true }))
          || new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      }
    })());
    return;
  }

  // Asset: cache-first
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreVary: true, ignoreSearch: true });
    if (cached) return cached;

    try {
      const res = await fetch(req);
      if (res && res.ok && req.method === "GET") cache.put(req, res.clone());
      return res;
    } catch (_) {
      return new Response("", { status: 504 });
    }
  })());
});
