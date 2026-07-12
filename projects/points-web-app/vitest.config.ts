import { defineConfig } from "vite-plus";

import { fixedPagesPlugin } from "./build/fixed-pages-plugin";

export default defineConfig({
  plugins: [fixedPagesPlugin()],
  test: {
    environment: "happy-dom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "test/contract/**/*.contract.test.ts"],
  },
});
