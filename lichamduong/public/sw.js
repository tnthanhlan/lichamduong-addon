const CACHE = "lich-am-duong-v6";
const FILES = ["./index.html", "./lunar.js", "./app.js", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(FILES)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

// Network-first: luôn thử lấy bản mới nhất từ mạng trước.
// Chỉ dùng bản đã lưu (cache) khi không có mạng hoặc mạng lỗi.
// Tránh bị kẹt vĩnh viễn ở một bản cache hỏng như trước.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  if (e.request.url.includes("/api/")) return; // luôn lấy dữ liệu trực tiếp từ server, không cache
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const resClone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, resClone)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request).then(res => res || caches.match("./index.html")))
  );
});
