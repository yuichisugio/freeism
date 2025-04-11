import type { NextConfig } from "next";

import "./src/env";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  webpack: (config, { dev }) => {
    // 開発モードの場合のみFast Refreshを無効化
    if (dev) {
      config.hot = false;
    }
    return config;
  },
};

export default nextConfig;
