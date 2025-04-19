if (!self.define) {
  let e,
    s = {};
  const a = (a, n) => (
    (a = new URL(a + ".js", n).href),
    s[a] ||
      new Promise((s) => {
        if ("document" in self) {
          const e = document.createElement("script");
          (e.src = a), (e.onload = s), document.head.appendChild(e);
        } else (e = a), importScripts(a), s();
      }).then(() => {
        let e = s[a];
        if (!e) throw new Error(`Module ${a} didn’t register its module`);
        return e;
      })
  );
  self.define = (n, r) => {
    const i = e || ("document" in self ? document.currentScript.src : "") || location.href;
    if (s[i]) return;
    let t = {};
    const c = (e) => a(e, i),
      o = { module: { uri: i }, exports: t, require: c };
    s[i] = Promise.all(n.map((e) => o[e] || c(e))).then((e) => (r(...e), t));
  };
}
define(["./workbox-e9849328"], function (e) {
  "use strict";
  importScripts(),
    self.skipWaiting(),
    e.clientsClaim(),
    e.precacheAndRoute(
      [
        { url: "/_next/app-build-manifest.json", revision: "31f70edb64205bef528a1de7d509ce5c" },
        { url: "/_next/static/EZrNZOzoryxPOZXDy1XPe/_buildManifest.js", revision: "46cee57542691a32c154019ef6cef759" },
        { url: "/_next/static/EZrNZOzoryxPOZXDy1XPe/_ssgManifest.js", revision: "b6652df95db52feb4daf4eca35380933" },
        { url: "/_next/static/chunks/1262-9094bbb1fb39a83b.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/1556-8c10511126ca662a.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/1693-4a743653c620589c.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/1699-84a5922b2911f117.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/2325-964fc62776089e3a.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/2455-b989f979dbc21ff9.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/2534-1b29c694f4c91d13.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/2563-a1a9226d3e652ebf.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/2897-fe6083d5dd964539.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/3836-c752a334a3604d5e.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/4152-e1d2497645b2675c.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/4254-139a5dceaa6de837.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/4400-35afe39960240362.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/4717-6b4b4679e9b221ce.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/5367-daec95b2ec01625a.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/5778-5ef981acd96cc8e0.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/6192-7c322d21ceeb2e38.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/7295.f572fb0dd8128335.js", revision: "f572fb0dd8128335" },
        { url: "/_next/static/chunks/8076-9ae08e9d7359f085.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/8747-1fbd6594c3c87c01.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/8896-35a2f6dc743f769f.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/8983.e1eb70d88b967b02.js", revision: "e1eb70d88b967b02" },
        { url: "/_next/static/chunks/9505-8f446cf2f9c03a0b.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/9915-73d2486d05c96cad.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/9971-e5196954aeb97712.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/app/_not-found/page-a2c7c09be88e76e6.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/app/api/%5B...nextauth%5D/route-5cef0027a77b485c.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/app/api/auctions/%5BauctionId%5D/messages/route-7f6bc41eee2a4927.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        {
          url: "/_next/static/chunks/app/api/auctions/%5BauctionId%5D/sse-server-sent-events/route-38099069e41f02a4.js",
          revision: "EZrNZOzoryxPOZXDy1XPe",
        },
        { url: "/_next/static/chunks/app/api/auctions/%5BauctionId%5D/watchlist/route-dccb0411fae1a0e3.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/app/api/notifications/route-697dd0636bb6084c.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/app/api/push-notification/subscription-update/route-fff357bf59d27174.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/app/api/upload/get-signed-url/route-75d6ec04a59eb99e.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/app/api/upload/route-fe3f10769051d270.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/app/auth/signin/page-60b801b0c683900c.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/app/dashboard/auction/%5BtaskId%5D/page-4929758880a8d021.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/app/dashboard/auction/created/%5Bid%5D/page-80f06c57d169a04d.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/app/dashboard/auction/history/page-2b0566de614d8dbe.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/app/dashboard/auction/page-fb0d5cc95b81700f.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/app/dashboard/auction/won/%5Bid%5D/page-2145522869f76458.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/app/dashboard/create-group/page-8a1048cf7c8cde00.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/app/dashboard/create-notification/page-2a63af44b5bbf2b8.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/app/dashboard/github-api-conversion/page-280703760de783f1.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/app/dashboard/group/%5Bid%5D/page-415369da4858f843.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/app/dashboard/grouplist/page-f5622647043ad7b6.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/app/dashboard/my-groups/page-d72e196b42597fbf.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/app/dashboard/my-tasks/page-e131a9e43677b467.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/app/dashboard/new-task/page-af9d324c0fbc4f46.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/app/dashboard/notifications/page-e52dc94c1ee501b9.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/app/dashboard/settings/page-87ce62c99989bc3b.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/app/layout-5352517a48404f4a.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/app/not-found-0fdba0464e85634c.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/app/offline/page-e70822a78d4df7dd.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/app/page-3c5b6825be27301f.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/app/privacy/page-caede1b3f81f24c8.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/app/terms/page-27b10df5071732a6.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/ba6fca0d-69c74ec922ab1f76.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/framework-e1b8b0866d2b23b8.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/main-2994c8dd09f7c6b1.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/main-app-4491a60b0d9c0cd9.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/pages/_app-c069e457722a0e8f.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/pages/_error-db77631c491f986e.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/chunks/polyfills-42372ed130431b0a.js", revision: "846118c33b2c0e922d7b3a7676f81f6f" },
        { url: "/_next/static/chunks/webpack-2d334a26a5ffa8b0.js", revision: "EZrNZOzoryxPOZXDy1XPe" },
        { url: "/_next/static/css/f0c961bf21e459ee.css", revision: "f0c961bf21e459ee" },
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
            cacheWillUpdate: async ({ request: e, response: s, event: a, state: n }) =>
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
