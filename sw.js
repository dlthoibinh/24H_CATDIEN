const BASE = new URL('./', self.location).pathname;

// bump CACHE mỗi lần anh cập nhật để ép client lấy bản mới
const CACHE = '24h-catdien-pwa-v2025.12.12.1';
const SHELL = BASE + 'index.html';

const STATIC_ASSETS = [
  BASE,
  SHELL,
  BASE + 'manifest.webmanifest',
  BASE + 'icon-192-any.png',
  BASE + 'icon-512-any.png',
  BASE + 'icon-192-maskable.png',
  BASE + 'icon-512-maskable.png',
  BASE + 'evn_logo.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(STATIC_ASSETS);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k !== CACHE ? caches.delete(k) : null)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // chỉ xử lý trong scope GitHub pages của anh
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;

  // Điều hướng: network-first, fallback shell
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const c = await caches.open(CACHE);
        // luôn lưu về SHELL (không lưu theo query) để tránh “kẹt” nhiều bản
        c.put(SHELL, fresh.clone());
        return fresh;
      } catch {
        const c = await caches.open(CACHE);
        return (await c.match(SHELL)) || Response.error();
      }
    })());
    return;
  }

  // Asset: cache-first (ignore search để khỏi miss do ?v=…)
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const cached = await c.match(req, { ignoreSearch: true, ignoreVary: true });
    if (cached) return cached;

    const res = await fetch(req);
    if (res.ok && req.method === 'GET') c.put(req, res.clone());
    return res;
  })());
});
