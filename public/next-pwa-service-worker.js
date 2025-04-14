if (!self.define) {
  let e,
    s = {};
  const r = (r, a) => (
    (r = new URL(r + ".js", a).href),
    s[r] ||
      new Promise((s) => {
        if ("document" in self) {
          const e = document.createElement("script");
          (e.src = r), (e.onload = s), document.head.appendChild(e);
        } else (e = r), importScripts(r), s();
      }).then(() => {
        let e = s[r];
        if (!e) throw new Error(`Module ${r} didn’t register its module`);
        return e;
      })
  );
  self.define = (a, n) => {
    const i = e || ("document" in self ? document.currentScript.src : "") || location.href;
    if (s[i]) return;
    let t = {};
    const c = (e) => r(e, i),
      u = { module: { uri: i }, exports: t, require: c };
    s[i] = Promise.all(a.map((e) => u[e] || c(e))).then((e) => (n(...e), t));
  };
}
define(["./workbox-e9849328"], function (e) {
  "use strict";
  importScripts(),
    self.skipWaiting(),
    e.clientsClaim(),
    e.precacheAndRoute(
      [
        { url: "/_next/app-build-manifest.json", revision: "4dea3815f84b23e08f1fda16319cd1be" },
        { url: "/_next/static/H0JrZr_8EEuULjrVhFpFb/_buildManifest.js", revision: "2c313534b01717dbe5cabca95b9494ef" },
        { url: "/_next/static/H0JrZr_8EEuULjrVhFpFb/_ssgManifest.js", revision: "b6652df95db52feb4daf4eca35380933" },
        { url: "/_next/static/chunks/1313-bdbf6bb8831ec9c5.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/2357-8581b13bff536833.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/2410-36e42d04e112d681.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/2718-9b5d3e73cbb3e078.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/2797-29cd1658bad1ac76.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/3259-0cbcc0ab3047d4ef.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/344-44773770c5a7bfcd.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/3455-3fa73cad26a05fbc.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/5224-5f45c33fb2dc8f5c.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/5368.2f99e1f47b03f3b2.js", revision: "2f99e1f47b03f3b2" },
        { url: "/_next/static/chunks/5502-a01e832682c61199.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/5744-443da1c542a630b2.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/5945-15b346aaff6f046f.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/6220-b052bbdfb8b44322.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/6345-ff9f7bfa1e9f3975.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/6561.b1dfc1e8a8ec1716.js", revision: "b1dfc1e8a8ec1716" },
        { url: "/_next/static/chunks/7129-65d7ce1970a9822b.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/7725-efdfda5305e90d3f.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/7779-fb6ed75dd06487b1.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/8312-e880b9ee47ec6bd7.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/8408-7b72949ae1be4964.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/9337-89cd01f23fdd2075.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/9479-0d3bcbae8eed01ba.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/9641-2d0e4d99942148bf.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/9959-a27f91ba1b20bbf0.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/app/_not-found/page-b3c882a8fd224b6f.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/app/api/%5B...nextauth%5D/route-2af7a4044e37fe5c.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/app/api/auctions/%5BauctionId%5D/messages/route-d22eee5bf18c6dd4.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        {
          url: "/_next/static/chunks/app/api/auctions/%5BauctionId%5D/sse-server-sent-events/route-ce1a14f39972a19a.js",
          revision: "H0JrZr_8EEuULjrVhFpFb",
        },
        { url: "/_next/static/chunks/app/api/auctions/%5BauctionId%5D/watchlist/route-3ef1ac94e6e0912b.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/app/api/notifications/route-87a38e9f7c18d1b4.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/app/api/push-notification/subscription-update/route-01eb24bb1d18fbe5.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/app/api/upload/get-signed-url/route-f585ce7b9319db9b.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/app/api/upload/route-78b337ea67092c91.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/app/auth/signin/page-eb89c16fa01a5d1c.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/app/dashboard/auction/%5BtaskId%5D/page-3674e0fd1250e66e.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/app/dashboard/auction/created/%5Bid%5D/page-216eef2fac89da21.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/app/dashboard/auction/history/page-d837ac472e85b62d.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/app/dashboard/auction/page-52e08e0796b80a8e.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/app/dashboard/auction/won/%5Bid%5D/page-ac9e44ac9215eec6.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/app/dashboard/create-group/page-896b1e3221c57175.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/app/dashboard/create-notification/page-1822546c7c47e819.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/app/dashboard/group/%5Bid%5D/page-52137fc4e691611f.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/app/dashboard/grouplist/page-5528c8d3f5ac2809.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/app/dashboard/my-groups/page-0a1870de71a26cab.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/app/dashboard/my-tasks/page-2f4bcc2464a671e3.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/app/dashboard/new-task/page-291f8d04260da3ae.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/app/dashboard/notifications/page-43a4eba37a6cbc1b.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/app/dashboard/settings/page-f0ed0c0b1e1f9b2b.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/app/layout-f2072b1726712725.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/app/not-found-dc9f62d694a72f14.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/app/offline/page-42bbd52adac59dd8.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/app/page-98394c357dedb744.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/app/privacy/page-5388d4a35f4027c8.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/app/terms/page-99a8d16cf6f30042.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/ec0f42b1-0dedec206ba14a54.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/framework-6da45da7e54b7a6b.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/main-595902845034a8a9.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/main-app-c4338748bcef8413.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/pages/_app-ea9155e3f2897c07.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/pages/_error-6dbc4318a9c55ac4.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/chunks/polyfills-42372ed130431b0a.js", revision: "846118c33b2c0e922d7b3a7676f81f6f" },
        { url: "/_next/static/chunks/webpack-4f62bba19b67eb47.js", revision: "H0JrZr_8EEuULjrVhFpFb" },
        { url: "/_next/static/css/9bc4d4f6bf0f9bbd.css", revision: "9bc4d4f6bf0f9bbd" },
        { url: "/favicon.svg", revision: "feef837e5e551250b75f060174f3d416" },
        { url: "/icon192_maskable.png", revision: "cfdb3dadefb927e12169f85625bd4f7b" },
        { url: "/icon192_rounded.png", revision: "6e9a47573219d61a01085c420f417db2" },
        { url: "/icon512_maskable.png", revision: "1d6ee46b44e1d941118f13dc1a37b472" },
        { url: "/icon512_rounded.png", revision: "acbb72c971fa35cd2851a70e5e17a6e7" },
        { url: "/images/default-auction-image.png", revision: "61d90d84534b510fcd3778198abef4a5" },
        { url: "/images/default-auction.svg", revision: "3e0d72a0d5b009a915f4d77a5e5cacfa" },
        { url: "/manifest.json", revision: "f4829e0c0e9df3f6182f6a8213816a4a" },
        { url: "/notification-badge.svg", revision: "8f17c1a76b9e7f5bb91cee4b46cb12a1" },
        { url: "/notification-icon.svg", revision: "3fd4acd781a771904300e73060b4f771" },
        { url: "/service-worker.js", revision: "26a451a802ba2965aa177077d3e6894a" },
      ],
      { ignoreURLParametersMatching: [] },
    ),
    e.cleanupOutdatedCaches(),
    e.registerRoute(
      "/",
      new e.NetworkFirst({
        cacheName: "start-url",
        plugins: [
          {
            cacheWillUpdate: async ({ request: e, response: s, event: r, state: a }) =>
              s && "opaqueredirect" === s.type ? new Response(s.body, { status: 200, statusText: "OK", headers: s.headers }) : s,
          },
        ],
      }),
      "GET",
    ),
    e.registerRoute(
      /^https:\/\/fonts\.(?:gstatic)\.com\/.*/i,
      new e.CacheFirst({ cacheName: "google-fonts-webfonts", plugins: [new e.ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 31536e3 })] }),
      "GET",
    ),
    e.registerRoute(
      /^https:\/\/fonts\.(?:googleapis)\.com\/.*/i,
      new e.StaleWhileRevalidate({
        cacheName: "google-fonts-stylesheets",
        plugins: [new e.ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 604800 })],
      }),
      "GET",
    ),
    e.registerRoute(
      /\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,
      new e.StaleWhileRevalidate({ cacheName: "static-font-assets", plugins: [new e.ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 604800 })] }),
      "GET",
    ),
    e.registerRoute(
      /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
      new e.StaleWhileRevalidate({ cacheName: "static-image-assets", plugins: [new e.ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 86400 })] }),
      "GET",
    ),
    e.registerRoute(
      /\/_next\/image\?url=.+$/i,
      new e.StaleWhileRevalidate({ cacheName: "next-image", plugins: [new e.ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 86400 })] }),
      "GET",
    ),
    e.registerRoute(
      /\.(?:mp3|wav|ogg)$/i,
      new e.CacheFirst({
        cacheName: "static-audio-assets",
        plugins: [new e.RangeRequestsPlugin(), new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 })],
      }),
      "GET",
    ),
    e.registerRoute(
      /\.(?:mp4)$/i,
      new e.CacheFirst({
        cacheName: "static-video-assets",
        plugins: [new e.RangeRequestsPlugin(), new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 })],
      }),
      "GET",
    ),
    e.registerRoute(
      /\.(?:js)$/i,
      new e.StaleWhileRevalidate({ cacheName: "static-js-assets", plugins: [new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 })] }),
      "GET",
    ),
    e.registerRoute(
      /\.(?:css|less)$/i,
      new e.StaleWhileRevalidate({ cacheName: "static-style-assets", plugins: [new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 })] }),
      "GET",
    ),
    e.registerRoute(
      /\/_next\/data\/.+\/.+\.json$/i,
      new e.StaleWhileRevalidate({ cacheName: "next-data", plugins: [new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 })] }),
      "GET",
    ),
    e.registerRoute(
      /\.(?:json|xml|csv)$/i,
      new e.NetworkFirst({ cacheName: "static-data-assets", plugins: [new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 })] }),
      "GET",
    ),
    e.registerRoute(
      ({ url: e }) => {
        if (!(self.origin === e.origin)) return !1;
        const s = e.pathname;
        return !s.startsWith("/api/auth/") && !!s.startsWith("/api/");
      },
      new e.NetworkFirst({
        cacheName: "apis",
        networkTimeoutSeconds: 10,
        plugins: [new e.ExpirationPlugin({ maxEntries: 16, maxAgeSeconds: 86400 })],
      }),
      "GET",
    ),
    e.registerRoute(
      ({ url: e }) => {
        if (!(self.origin === e.origin)) return !1;
        return !e.pathname.startsWith("/api/");
      },
      new e.NetworkFirst({
        cacheName: "others",
        networkTimeoutSeconds: 10,
        plugins: [new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 })],
      }),
      "GET",
    ),
    e.registerRoute(
      ({ url: e }) => !(self.origin === e.origin),
      new e.NetworkFirst({
        cacheName: "cross-origin",
        networkTimeoutSeconds: 10,
        plugins: [new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 3600 })],
      }),
      "GET",
    );
});
