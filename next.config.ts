import type { NextConfig } from "next";

import "./src/library-setting/env";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

const withPWA = require("next-pwa")({
  dest: "public",
  disable: process.env.NODE_ENV === "development", // 開発環境ではService Workerを無効化
  register: true,
  skipWaiting: true,
  sw: "/next-pwa-service-worker.js",
  // Windows環境でのパス問題を回避するため、path.joinを使用せずスラッシュで統一
  swSrc: "./public/service-worker.js",
  // Workboxファイルの絶対パス指定でケースセンシティブ問題を回避
  buildExcludes: [/.*\.js\.map$/, /^manifest.*\.js$/, /\.map$/, /app-build-manifest\.json$/],
  runtimeCaching: [
    {
      urlPattern: /^https?.*/,
      handler: "NetworkFirst",
      options: {
        cacheName: "offlineCache",
        expiration: {
          maxEntries: 200,
        },
      },
    },
  ],
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  experimental: {
    useCache: true,
  },
  reactStrictMode: true,
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "placekitten.com",
        port: "",
        pathname: "/**",
      },
      // picsum.photos を許可する設定を追加
      {
        protocol: "https",
        hostname: "picsum.photos",
        port: "",
        pathname: "/**",
      },
      // cdn.jsdelivr.net を許可する設定を追加
      {
        protocol: "https",
        hostname: "cdn.jsdelivr.net",
        port: "",
        pathname: "/**",
      },
      // Google Photos（Googleアカウントのプロフィール画像）を許可する設定を追加
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        port: "",
        pathname: "/**",
      },
      // 他のGoogleドメインも追加（必要に応じて）
      {
        protocol: "https",
        hostname: "lh4.googleusercontent.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "lh5.googleusercontent.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "lh6.googleusercontent.com",
        port: "",
        pathname: "/**",
      },
      // GitHubのアバター画像を許可する設定を追加
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
      {
        source: "/next-pwa-service-worker.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache,no-cache, must-revalidate",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self'",
          },
        ],
      },
    ];
  },
};
// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

export default withPWA(nextConfig);
