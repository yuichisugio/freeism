if (!self.define) {
  let e,
    s = {};
  const c = (c, a) => (
    (c = new URL(c + ".js", a).href),
    s[c] ||
      new Promise((s) => {
        if ("document" in self) {
          const e = document.createElement("script");
          (e.src = c), (e.onload = s), document.head.appendChild(e);
        } else (e = c), importScripts(c), s();
      }).then(() => {
        let e = s[c];
        if (!e) throw new Error(`Module ${c} didn’t register its module`);
        return e;
      })
  );
  self.define = (a, n) => {
    const i = e || ("document" in self ? document.currentScript.src : "") || location.href;
    if (s[i]) return;
    let t = {};
    const x = (e) => c(e, i),
      r = { module: { uri: i }, exports: t, require: x };
    s[i] = Promise.all(a.map((e) => r[e] || x(e))).then((e) => (n(...e), t));
  };
}
define(["./workbox-e9849328"], function (e) {
  "use strict";
  importScripts(),
    self.skipWaiting(),
    e.clientsClaim(),
    e.precacheAndRoute(
      [
        { url: "/_next/app-build-manifest.json", revision: "5040cec6148cbd5c0802eb7ef7afcae7" },
        { url: "/_next/static/chunks/1026-0238e1ad0a401d98.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/107-0aed7bf5e3335391.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/1668-6a386c93aa7422dd.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/2080-a24a3037f58934f5.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/2176-693e5c7923cb0b97.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/2285-f55bada8c417c93c.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/2448-52d9f7f404e3f345.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/2539-7b6cb75a94405880.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/267-05dff32742dbe126.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/2845-42a40daa1c3053ad.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/2865-e9d34f4ff53a0d20.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/3239-934d85b3c660912f.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/3746.682e6e460a73d8cf.js", revision: "682e6e460a73d8cf" },
        { url: "/_next/static/chunks/3919-d15b95d240e33824.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/3975-b5fafc7fb0cb22d3.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/428-48d4ba918847fc5c.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/4318-3a20e8017de01789.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/4911-33af41ddcde741d8.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/548-602bc43f2477a44e.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/5771-d05f04b4dd1a18b3.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/5952.9e2fb386ade82870.js", revision: "9e2fb386ade82870" },
        { url: "/_next/static/chunks/6209-7801c9d58bc1c333.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/6669-29c20f965c653724.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/7091-cdb9579ab5804b6d.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/7212-329ce1abe1a9b892.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/7232-bd7720fcc1b7e447.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/7429-7c8cffb93981b7b3.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/7501-620b2fe48dcc1938.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/7513-110470d2f8d3a3f8.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/7773-214fba9d62bf52df.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/7943-8c133c809aee1029.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/8200-8d2f7abe052f067d.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/8397-eed1e04fd80844b4.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/8399-8f1ab4716c9129b8.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/867-c21dd2767c0b929e.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/8705-2f836720486d8267.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/8786.206bc12aa2ac178e.js", revision: "206bc12aa2ac178e" },
        { url: "/_next/static/chunks/8898-e1f29b0f36934be3.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/902-2b8ca32db9c5e21d.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/92343493-c31fbccda02e0881.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/9385-50ae89c9de1cc3de.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/9502-02a096fa08e51116.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/9519.cfd6720359f6356c.js", revision: "cfd6720359f6356c" },
        { url: "/_next/static/chunks/9537-7263ab2c99b94c1f.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/9642-2f0b7d7c1f367573.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/app/_not-found/page-c742c7b9d2e8488d.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/app/api/%5B...nextauth%5D/route-3b17e6afb101cb7f.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/app/api/auctions/%5BauctionId%5D/auction-data/route-c2c32ab50f268df8.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        {
          url: "/_next/static/chunks/app/api/auctions/%5BauctionId%5D/sse-server-sent-events/route-9c8a96bb9c10898d.js",
          revision: "x8MU_De4xwL4GwsHDMxNc",
        },
        { url: "/_next/static/chunks/app/api/auctions/%5BauctionId%5D/watchlist/route-0f915f78b36cd2b8.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/app/api/notifications/route-c9a9843da8ec3ef2.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/app/api/push-notification/subscription-update/route-c48026a413789348.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/app/api/upload/get-signed-url/route-a69e44e6a01e2b2f.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/app/api/upload/route-932534ce02754ee3.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/app/auth/signin/page-79dcde976c0fd0b9.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/app/dashboard/auction/%5BauctionId%5D/page-056d7076132847b3.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        {
          url: "/_next/static/chunks/app/dashboard/auction/created-detail/%5BauctionId%5D/page-ff85f66a707f80ed.js",
          revision: "x8MU_De4xwL4GwsHDMxNc",
        },
        { url: "/_next/static/chunks/app/dashboard/auction/history/page-42c0510cec201c74.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/app/dashboard/auction/page-906e86afe67f8313.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/app/dashboard/auction/won-detail/%5BauctionId%5D/page-10f2d8ee1ad5eb7d.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/app/dashboard/create-group/page-d6d514a9ddc5b706.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/app/dashboard/create-notification/page-cee6e02202ebdf1a.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/app/dashboard/create-task/page-9ac6019df059b1ee.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/app/dashboard/github-api-conversion/page-c1d588c315e85ea4.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/app/dashboard/group-list/page-72e8275c42cc419a.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/app/dashboard/group/%5Bid%5D/page-1ab30d2ae67082b0.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/app/dashboard/layout-74efedcedf1348bc.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/app/dashboard/loading-4bfee6237fe740c7.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/app/dashboard/my-group/page-4a05d415bc56c456.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/app/dashboard/my-task/page-377c146a466cef1e.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/app/dashboard/review-search/page-5c97d39f03638301.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/app/dashboard/settings/page-0eb7c3fb988dfe22.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/app/layout-0685129d37664ac4.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/app/loading-733aa35db14375e8.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/app/not-found-08dffe93e5c04ece.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/app/offline/page-7f37772d66d0a5f7.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/app/page-4dbb6b14aafa843c.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/app/privacy/page-95cc489b285a9ce8.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/app/terms/page-8568a91b59c6f874.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/framework-b430241fa08f0355.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/main-08de66c24888c181.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/main-app-1d1bfd6e23d95b73.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/pages/_app-e382a3b9c7db5264.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/pages/_error-9742fc53e30cb1bb.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/chunks/polyfills-42372ed130431b0a.js", revision: "846118c33b2c0e922d7b3a7676f81f6f" },
        { url: "/_next/static/chunks/webpack-b2474b742fa3d238.js", revision: "x8MU_De4xwL4GwsHDMxNc" },
        { url: "/_next/static/css/df7d9c2104aa094b.css", revision: "df7d9c2104aa094b" },
        { url: "/_next/static/x8MU_De4xwL4GwsHDMxNc/_buildManifest.js", revision: "658621122dd4778a41594ab521efa54b" },
        { url: "/_next/static/x8MU_De4xwL4GwsHDMxNc/_ssgManifest.js", revision: "b6652df95db52feb4daf4eca35380933" },
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
            cacheWillUpdate: async ({ request: e, response: s, event: c, state: a }) =>
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
