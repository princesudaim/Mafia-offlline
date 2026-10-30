/* Offline shell. The build replaces this revision whenever the app changes. */
const PREFIX = "nightfall-shell-";
const CACHE = PREFIX + "__BUILD_REVISION__";
const CORE = [
  "./", "index.html", "manifest.webmanifest", "icons/icon-512.png",
  "avatars/crew-12.jpg", "avatars/crew-13.jpg", "avatars/crew-14.jpg", "avatars/crew-15.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(PREFIX) && key !== CACHE).map((key) => caches.delete(key)));
    // Remove the old unversioned cache used by previous releases of this game.
    await caches.delete("nightfall-v2");
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () => (await caches.match("./index.html")) || Response.error()));
    return;
  }
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
});
