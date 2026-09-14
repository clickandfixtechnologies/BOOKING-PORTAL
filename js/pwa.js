if ("serviceWorker" in navigator) window.addEventListener("load", function () {
  const path = /\/(admin|tracking|track|technician)\//.test(location.pathname) ? "../service-worker.js" : "service-worker.js";
  navigator.serviceWorker.register(path, { updateViaCache: "none" }).then(function (registration) {
    // Runtime configuration and admin JavaScript must not remain pinned to an
    // old service-worker cache after a production deployment.
    return registration.update();
  }).catch(function (error) { console.warn("Service worker registration failed", error); });
});
