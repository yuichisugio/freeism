import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

import { fixedPagesPlugin } from "./build/fixed-pages-plugin";

export default defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    fixedPagesPlugin(),
    tanstackStart({
      router: {
        routeFileIgnorePattern: "\\.test\\.",
      },
      server: {
        entry: "./src/server.ts",
      },
      spa: {
        enabled: true,
        prerender: {
          outputPath: "/index.html",
          crawlLinks: false,
          retryCount: 0,
        },
      },
      prerender: {
        enabled: true,
        autoStaticPathsDiscovery: false,
        autoSubfolderIndex: false,
        crawlLinks: false,
        failOnError: true,
      },
      pages: [
        { path: "/terms", prerender: { enabled: true, outputPath: "/terms.html" } },
        { path: "/privacy", prerender: { enabled: true, outputPath: "/privacy.html" } },
        { path: "/help", prerender: { enabled: true, outputPath: "/help.html" } },
        { path: "/docs", prerender: { enabled: true, outputPath: "/docs.html" } },
      ],
    }),
    react(),
  ],
});
