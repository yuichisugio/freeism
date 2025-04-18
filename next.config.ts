import type { NextConfig } from "next";

import "./src/env";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

const withPWA = require("next-pwa")({
  dest: "public",
  // disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  sw: "/next-pwa-service-worker.js",
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
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
            value: "no-cache, no-store, must-revalidate",
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
