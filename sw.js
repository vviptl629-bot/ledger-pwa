// 打工人小账本 · Service Worker（离线缓存 app shell）
const CACHE = 'ledger-pwa-v24';
const ASSETS = [
  './',
  './index.html',
  './xlsx.full.min.js',
  './manifest.webmanifest',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/icon-maskable.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // 只处理同源（不同源如 api.github.com 走网络，不缓存）
  if (url.origin !== self.location.origin) return;

  // 导航请求（打开页面）走 network-first：每次优先拉服务器最新版，断网才用缓存
  // 这是修复"手机端卡在旧缓存打不开"的关键 —— 旧版是 cache-first，永远返回旧 index.html
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 静态资源（js/css/图片）仍走 cache-first，提升加载速度
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
