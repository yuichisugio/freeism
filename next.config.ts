import type { NextConfig } from "next";

import "./src/env";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    domains: ["placekitten.com"],
  },
};

export default nextConfig;
