const CACHE_NAME = "mibolsa-v5-yahoo-sin-key-final";
const ASSETS = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/storage.js",
  "./js/api.js",
  "./js/app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if(event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  const currentUrl = new URL(self.location.href);

  // MUY IMPORTANTE:
  // No interceptar APIs externas como Yahoo, Finnhub, Twelve Data o Alpha Vantage.
  // Si se interceptan y fallan, el fallback devuelve index.html y aparece:
  // "Unexpected token '<', <!DOCTYPE... is not valid JSON".
  if(requestUrl.origin !== currentUrl.origin){
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).catch(() => caches.match("./index.html"));
    })
  );
});
