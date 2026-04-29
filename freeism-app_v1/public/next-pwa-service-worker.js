if (!self.define) {
  let s,
    e = {};
  const a = (a, n) => (
    (a = new URL(a + ".js", n).href),
    e[a] ||
      new Promise((e) => {
        if ("document" in self) {
          const s = document.createElement("script");
          (s.src = a), (s.onload = e), document.head.appendChild(s);
        } else (s = a), importScripts(a), e();
      }).then(() => {
        let s = e[a];
        if (!s) throw new Error(`Module ${a} didn’t register its module`);
        return s;
      })
  );
  self.define = (n, i) => {
    const t = s || ("document" in self ? document.currentScript.src : "") || location.href;
    if (e[t]) return;
    let c = {};
    const r = (s) => a(s, t),
      u = { module: { uri: t }, exports: c, require: r };
    e[t] = Promise.all(n.map((s) => u[s] || r(s))).then((s) => (i(...s), c));
  };
}
define(["/workbox-e9849328"], function (s) {
  "use strict";
  importScripts(),
    self.skipWaiting(),
    s.clientsClaim(),
    s.precacheAndRoute(
      [
        { url: "/_next/app-build-manifest.json", revision: "4e735bc991c8aba07f600765c468cf1a" },
        { url: "/_next/static/3FkCUBsFDHjVk02zymRWZ/_buildManifest.js", revision: "658621122dd4778a41594ab521efa54b" },
        { url: "/_next/static/3FkCUBsFDHjVk02zymRWZ/_ssgManifest.js", revision: "b6652df95db52feb4daf4eca35380933" },
        { url: "/_next/static/chunks/1668-6a386c93aa7422dd.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/chunks/1682-2f5699decf38bb80.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/chunks/2047-9373ab5d7afb1e46.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/chunks/2080-5b7c51df9f314539.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/chunks/2264-ef6f3e9286a72b5e.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/chunks/2285-de91ba893bd2a19b.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/chunks/2360-7a1f5ee3b5774764.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/chunks/2534-3dd48a71812020ee.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/chunks/2539-19bae83af1a2fad8.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/chunks/2571-54e1319889bef1f2.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/chunks/2845-1b022d16a7375b09.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/chunks/3261.139f6d5baee67b55.js", revision: "139f6d5baee67b55" },
        { url: "/_next/static/chunks/3338.31d33b5185e8dfcf.js", revision: "31d33b5185e8dfcf" },
        { url: "/_next/static/chunks/3472-180426f4446b4f58.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/chunks/3556-e52b24146ed89a0b.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/chunks/4494.a70ec7e933f21966.js", revision: "a70ec7e933f21966" },
        { url: "/_next/static/chunks/4615-11fef0c7b0e961c5.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/chunks/4637-dac4d1a4bff462f3.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/chunks/4952-fbd33188a52393a4.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/chunks/5237-67c0b892cb95b3e0.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/chunks/548-46d6c0ea1ff05687.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/chunks/5564-b9472505c16f3903.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/chunks/5737-34de23e6e32e725c.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/chunks/6016.99301e8fa9ea4402.js", revision: "99301e8fa9ea4402" },
        { url: "/_next/static/chunks/6318-920aa34e78ed5f61.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/chunks/634-4546219a725392d9.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/chunks/7091-cd706d958f4cdecf.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/chunks/7168-2aaa93936819e3b4.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/chunks/7212-329ce1abe1a9b892.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/chunks/7232-3f02e24054ac3273.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/chunks/7530-9ed222874f4ed653.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/chunks/7548-0b777228f89c7d80.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/chunks/7895-cb317164ce109b51.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/chunks/8106-5bedcbdfbfc3b27a.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/chunks/8110-7707298e70edce90.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/chunks/8274-e944058bcc94b305.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/chunks/8281-7930a65fa2ffcf1c.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/chunks/8426-17526444dd52bb4d.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/chunks/8705-eed427663ccf2782.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/chunks/8873-e3b97b40c02effa0.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/chunks/8927-73d6e7722adf4b0d.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/chunks/92343493-b601ab9d36255adf.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/chunks/9380-0b4ec13ff4c2e088.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/chunks/app/_not-found/page-a36b5cad6a84f999.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        {
          url: "/_next/static/chunks/app/api/%5B...nextauth%5D/route-201fc2b4d74ce89a.js",
          revision: "3FkCUBsFDHjVk02zymRWZ",
        },
        {
          url: "/_next/static/chunks/app/api/auctions/%5BauctionId%5D/auction-data/route-62d6063b3e5f81e9.js",
          revision: "3FkCUBsFDHjVk02zymRWZ",
        },
        {
          url: "/_next/static/chunks/app/api/auctions/%5BauctionId%5D/sse-server-sent-events/route-660da380d66ebcf6.js",
          revision: "3FkCUBsFDHjVk02zymRWZ",
        },
        {
          url: "/_next/static/chunks/app/api/notifications/route-dbede59594461778.js",
          revision: "3FkCUBsFDHjVk02zymRWZ",
        },
        {
          url: "/_next/static/chunks/app/api/push-notification/subscription-update/route-44e8484e588a0cd2.js",
          revision: "3FkCUBsFDHjVk02zymRWZ",
        },
        {
          url: "/_next/static/chunks/app/api/upload/get-signed-url/route-3cccd7cde759232d.js",
          revision: "3FkCUBsFDHjVk02zymRWZ",
        },
        { url: "/_next/static/chunks/app/api/upload/route-46b9d052f2fcea99.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/chunks/app/auth/signin/page-13fd7fb4b6c5aee4.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        {
          url: "/_next/static/chunks/app/dashboard/auction/%5BauctionId%5D/page-52ace2784593a0ee.js",
          revision: "3FkCUBsFDHjVk02zymRWZ",
        },
        {
          url: "/_next/static/chunks/app/dashboard/auction/created-detail/%5BauctionId%5D/page-4e3ba93daebe9b30.js",
          revision: "3FkCUBsFDHjVk02zymRWZ",
        },
        {
          url: "/_next/static/chunks/app/dashboard/auction/history/page-865d85feb978ff90.js",
          revision: "3FkCUBsFDHjVk02zymRWZ",
        },
        {
          url: "/_next/static/chunks/app/dashboard/auction/page-16879e8510d69ad4.js",
          revision: "3FkCUBsFDHjVk02zymRWZ",
        },
        {
          url: "/_next/static/chunks/app/dashboard/auction/won-detail/%5BauctionId%5D/page-ab2d8ed498ace136.js",
          revision: "3FkCUBsFDHjVk02zymRWZ",
        },
        {
          url: "/_next/static/chunks/app/dashboard/create-group/page-89760f0fb99683db.js",
          revision: "3FkCUBsFDHjVk02zymRWZ",
        },
        {
          url: "/_next/static/chunks/app/dashboard/create-notification/page-92c66349c4887ef1.js",
          revision: "3FkCUBsFDHjVk02zymRWZ",
        },
        {
          url: "/_next/static/chunks/app/dashboard/create-task/page-7c780f5108af5b14.js",
          revision: "3FkCUBsFDHjVk02zymRWZ",
        },
        { url: "/_next/static/chunks/app/dashboard/error-2f1b44c19e8b6438.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        {
          url: "/_next/static/chunks/app/dashboard/github-api-conversion/page-dadef04a0edb90ce.js",
          revision: "3FkCUBsFDHjVk02zymRWZ",
        },
        {
          url: "/_next/static/chunks/app/dashboard/group-list/loading-c7c5c4fcd04febd4.js",
          revision: "3FkCUBsFDHjVk02zymRWZ",
        },
        {
          url: "/_next/static/chunks/app/dashboard/group-list/page-ba874dc9c101bf43.js",
          revision: "3FkCUBsFDHjVk02zymRWZ",
        },
        {
          url: "/_next/static/chunks/app/dashboard/group/%5Bid%5D/page-1a4e6e458f484560.js",
          revision: "3FkCUBsFDHjVk02zymRWZ",
        },
        { url: "/_next/static/chunks/app/dashboard/layout-49a5b689078624e9.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/chunks/app/dashboard/loading-6746ce47fd077516.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        {
          url: "/_next/static/chunks/app/dashboard/my-group/page-dd8ee6533a02633c.js",
          revision: "3FkCUBsFDHjVk02zymRWZ",
        },
        {
          url: "/_next/static/chunks/app/dashboard/my-task/page-a73c0d28c7b41251.js",
          revision: "3FkCUBsFDHjVk02zymRWZ",
        },
        { url: "/_next/static/chunks/app/dashboard/not-found-a3cfaa46d1acfa4d.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        {
          url: "/_next/static/chunks/app/dashboard/review-search/page-a42940c611939ff6.js",
          revision: "3FkCUBsFDHjVk02zymRWZ",
        },
        {
          url: "/_next/static/chunks/app/dashboard/settings/page-902265e74fc4f1e5.js",
          revision: "3FkCUBsFDHjVk02zymRWZ",
        },
        { url: "/_next/static/chunks/app/error-55d9dd666a8aa798.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/chunks/app/global-error-f16e183a02e71c77.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/chunks/app/layout-4abae6de6ae85a29.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/chunks/app/loading-91609eabe836369c.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/chunks/app/not-found-ee846eb9db51f6d0.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/chunks/app/offline/page-9375a4f1ba7c3680.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/chunks/app/page-1191c46fa0f455d1.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/chunks/app/privacy/page-ed94fef8b8cf4c80.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/chunks/app/terms/page-faacff28c5e4c68b.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/chunks/framework-b430241fa08f0355.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/chunks/main-6f4be70eb0bdbd0b.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/chunks/main-app-839847dd09cf3e7d.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/chunks/pages/_app-e382a3b9c7db5264.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/chunks/pages/_error-9742fc53e30cb1bb.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/chunks/polyfills-42372ed130431b0a.js", revision: "846118c33b2c0e922d7b3a7676f81f6f" },
        { url: "/_next/static/chunks/webpack-597923b1704ea388.js", revision: "3FkCUBsFDHjVk02zymRWZ" },
        { url: "/_next/static/css/414ebf0b4159edb4.css", revision: "414ebf0b4159edb4" },
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
        { url: "/service-worker.js", revision: "26ba1995087183e25ee26456f4c3c84b" },
      ],
      { ignoreURLParametersMatching: [] },
    ),
    s.cleanupOutdatedCaches(),
    s.registerRoute(
      "/",
      new s.NetworkFirst({
        cacheName: "start-url",
        plugins: [
          {
            cacheWillUpdate: async ({ request: s, response: e, event: a, state: n }) =>
              e && "opaqueredirect" === e.type
                ? new Response(e.body, { status: 200, statusText: "OK", headers: e.headers })
                : e,
          },
        ],
      }),
      "GET",
    ),
    s.registerRoute(
      /^https:\/\/fonts\.(?:gstatic)\.com\/.*/i,
      new s.CacheFirst({
        cacheName: "google-fonts-webfonts",
        plugins: [new s.ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 31536e3 })],
      }),
      "GET",
    ),
    s.registerRoute(
      /^https:\/\/fonts\.(?:googleapis)\.com\/.*/i,
      new s.StaleWhileRevalidate({
        cacheName: "google-fonts-stylesheets",
        plugins: [new s.ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 604800 })],
      }),
      "GET",
    ),
    s.registerRoute(
      /\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,
      new s.StaleWhileRevalidate({
        cacheName: "static-font-assets",
        plugins: [new s.ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 604800 })],
      }),
      "GET",
    ),
    s.registerRoute(
      /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
      new s.StaleWhileRevalidate({
        cacheName: "static-image-assets",
        plugins: [new s.ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 86400 })],
      }),
      "GET",
    ),
    s.registerRoute(
      /\/_next\/image\?url=.+$/i,
      new s.StaleWhileRevalidate({
        cacheName: "next-image",
        plugins: [new s.ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 86400 })],
      }),
      "GET",
    ),
    s.registerRoute(
      /\.(?:mp3|wav|ogg)$/i,
      new s.CacheFirst({
        cacheName: "static-audio-assets",
        plugins: [new s.RangeRequestsPlugin(), new s.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 })],
      }),
      "GET",
    ),
    s.registerRoute(
      /\.(?:mp4)$/i,
      new s.CacheFirst({
        cacheName: "static-video-assets",
        plugins: [new s.RangeRequestsPlugin(), new s.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 })],
      }),
      "GET",
    ),
    s.registerRoute(
      /\.(?:js)$/i,
      new s.StaleWhileRevalidate({
        cacheName: "static-js-assets",
        plugins: [new s.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 })],
      }),
      "GET",
    ),
    s.registerRoute(
      /\.(?:css|less)$/i,
      new s.StaleWhileRevalidate({
        cacheName: "static-style-assets",
        plugins: [new s.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 })],
      }),
      "GET",
    ),
    s.registerRoute(
      /\/_next\/data\/.+\/.+\.json$/i,
      new s.StaleWhileRevalidate({
        cacheName: "next-data",
        plugins: [new s.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 })],
      }),
      "GET",
    ),
    s.registerRoute(
      /\.(?:json|xml|csv)$/i,
      new s.NetworkFirst({
        cacheName: "static-data-assets",
        plugins: [new s.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 })],
      }),
      "GET",
    ),
    s.registerRoute(
      ({ url: s }) => {
        if (!(self.origin === s.origin)) return !1;
        const e = s.pathname;
        return !e.startsWith("/api/auth/") && !!e.startsWith("/api/");
      },
      new s.NetworkFirst({
        cacheName: "apis",
        networkTimeoutSeconds: 10,
        plugins: [new s.ExpirationPlugin({ maxEntries: 16, maxAgeSeconds: 86400 })],
      }),
      "GET",
    ),
    s.registerRoute(
      ({ url: s }) => {
        if (!(self.origin === s.origin)) return !1;
        return !s.pathname.startsWith("/api/");
      },
      new s.NetworkFirst({
        cacheName: "others",
        networkTimeoutSeconds: 10,
        plugins: [new s.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 })],
      }),
      "GET",
    ),
    s.registerRoute(
      ({ url: s }) => !(self.origin === s.origin),
      new s.NetworkFirst({
        cacheName: "cross-origin",
        networkTimeoutSeconds: 10,
        plugins: [new s.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 3600 })],
      }),
      "GET",
    );
});
