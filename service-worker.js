const CACHE_NAME = "cfx-booking-v6";
const APP_SHELL = ["./", "index.html", "booking.html", "success.html", "css/style.css", "css/booking.css", "css/admin.css", "js/runtime-config.js", "js/pwa.js", "admin/index.html", "admin/login.html", "admin/manifest.webmanifest", "js/admin.js", "js/admin-login.js"];
self.addEventListener("install", function (event) { event.waitUntil(caches.open(CACHE_NAME).then(function (cache) {
  // A missing optional page must not prevent the whole worker from installing.
  return Promise.all(APP_SHELL.map(function (asset) { return cache.add(asset).catch(function () { return undefined; }); }));
}).then(function () { return self.skipWaiting(); })); });
self.addEventListener("activate", function (event) { event.waitUntil(caches.keys().then(function (keys) { return Promise.all(keys.filter(function (key) { return key !== CACHE_NAME; }).map(function (key) { return caches.delete(key); })); }).then(function () { return self.clients.claim(); })); });
self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(function () { return caches.match(event.request).then(function (cached) { return cached || caches.match("index.html"); }); }));
    return;
  }
  const pathname = new URL(event.request.url).pathname;
  const deploymentSensitive = pathname.endsWith("/js/runtime-config.js") || pathname.includes("/js/") || pathname.includes("/admin/");
  if (deploymentSensitive) {
    event.respondWith(fetch(event.request).then(function (response) {
      if (response.ok) caches.open(CACHE_NAME).then(function (cache) { return cache.put(event.request, response.clone()); });
      return response;
    }).catch(function () { return caches.match(event.request).then(function (cached) { return cached || new Response("", { status: 504, statusText: "Offline" }); }); }));
    return;
  }
  event.respondWith(caches.match(event.request).then(function (cached) { return cached || fetch(event.request); }).catch(function () { return new Response("", { status: 504, statusText: "Offline" }); }));
});
self.addEventListener("push", function (event) { const payload = event.data ? event.data.json() : {}; event.waitUntil(self.registration.showNotification(payload.title || "Click & Fix", { body: payload.body || "You have a new appointment update.", icon: "icons/icon-192.svg", data: { url: payload.url || "/admin/" } })); });
self.addEventListener("notificationclick", function (event) { event.notification.close(); event.waitUntil(clients.openWindow(event.notification.data.url)); });
