self.addEventListener("fetch", (event) => {
  if (!navigator.onLine) {
    // オンラインではない場合、オフラインページにリダイレクト
    if (event.request.mode === "navigate") {
      event.respondWith(
        fetch(event.request).catch(() => {
          return caches.match("/offline");
        }),
      );
    }
  }
});
