const CACHE = "sinapsis-v2";
const ASSETS = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];
// Files whose latest version matters more than instant load (the app shell) —
// these go network-first so a redeploy reaches the device right away instead
// of getting stuck behind a stale cached copy indefinitely.
const NETWORK_FIRST = ["./", "./index.html", "./manifest.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

function isNetworkFirst(url) {
  const path = url.pathname.endsWith("/") ? url.pathname + "index.html" : url.pathname;
  return NETWORK_FIRST.some((a) => path.endsWith(a.replace("./", "/")) || path.endsWith("/index.html"));
}

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return; // never intercept API calls (Anthropic, Firebase, fonts, cdns)

  if (isNetworkFirst(url)) {
    e.respondWith(
      fetch(e.request)
        .then((resp) => {
          if (resp && resp.status === 200) {
            const clone = resp.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return resp;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Static assets (icons, etc.): cache-first, refresh in background.
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetchPromise = fetch(e.request)
        .then((resp) => {
          if (resp && resp.status === 200) {
            const clone = resp.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return resp;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
