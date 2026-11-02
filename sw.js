// 打工人小账本 · Service Worker（离线缓存 app shell）
// v31 全面静默化：所有 fetch / cache 操作都被多层 try-catch 包裹，
// 避免 sandbox 端口偶发 ECONNREFUSED 透传到用户 console 干扰正常使用。
const CACHE = 'ledger-pwa-v47';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/icon-maskable.png'
];

/* 静默 reject：避免 unhandled promise rejection 触发 DevTools/控制台报错（如 ECONNREFUSED 127.0.0.1:3000） */
function swallow(p){ return p && p.catch ? p.catch(()=>{}) : Promise.resolve(); }

self.addEventListener('install', (e) => {
  e.waitUntil(
    swallow(
      caches.open(CACHE)
        .then((c) => swallow(c.addAll(ASSETS)))   /* 单资源失败不抛，外层 swallow 兜底 */
        .then(() => self.skipWaiting())
    )
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    swallow(
      caches.keys().then((keys) =>
        swallow(Promise.all(keys.filter((k) => k !== CACHE).map((k) => swallow(caches.delete(k)))))
      ).then(() => self.clients.claim())
    )
  );
});

self.addEventListener('fetch', (e) => {
  // v31 同步异常也吞掉（fetch listener 内的 sync throw 不会被 catch promise 捕获）
  try{
    handleFetch(e);
  }catch(_err){
    /* swallow */
  }
});

function handleFetch(e){
  try{
    if (e.request.method !== 'GET') return;
    const url = new URL(e.request.url);
    // 只处理同源（不同源如 api.github.com 走网络，不缓存）
    if (url.origin !== self.location.origin) return;

    // 导航请求（打开页面）走 network-first：每次优先拉服务器最新版，断网才用缓存
    // v37 关键修复：GitHub Pages 返回 Cache-Control: max-age=600，
    // 普通 fetch(request) 会直接命中浏览器 HTTP 缓存里的旧 index.html（SW 以为拿到的是最新），
    // 导致"改完了手机还显示旧版"。加 cache:'reload' 强制回源，绕过这 10 分钟 HTTP 缓存。
    if (e.request.mode === 'navigate') {
      e.respondWith(
        swallow(
          fetch(new Request(e.request, { cache: 'reload' })).then((res) => {
            if (res && res.status === 200 && res.type === 'basic') {
              const copy = res.clone();
              swallow(caches.open(CACHE).then((c) => swallow(c.put(e.request, copy))));
            }
            return res;
          })
        ).catch(()=> swallow(caches.match('./index.html')).then(r=>r || new Response('', {status:503})))
      );
      return;
    }

    // 静态资源（js/css/图片）仍走 cache-first，提升加载速度
    e.respondWith(
      swallow(
        caches.match(e.request).then((cached) => {
          if (cached) return cached;
          return swallow(
            fetch(e.request).then((res) => {
              if (res && res.status === 200 && res.type === 'basic') {
                const copy = res.clone();
                swallow(caches.open(CACHE).then((c) => swallow(c.put(e.request, copy))));
              }
              return res;
            })
          );
        })
      ).catch(()=> swallow(caches.match('./index.html')).then(r=>r || new Response('', {status:503})))
    );
  }catch(_err){
    /* swallow */
  }
}

/* 兜底：捕获 SW 全局未处理错误，不再 console.error */
self.addEventListener('error', (e) => { /* swallow */ });
self.addEventListener('unhandledrejection', (e) => { e.preventDefault && e.preventDefault(); });