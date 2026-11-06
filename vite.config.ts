import { defineConfig } from "vite-plus";

export default defineConfig({
  lint: {
    ignorePatterns: [
      "**/worker-configuration.d.ts",
      "projects/accounts-web-app/dist/**",
      "projects/accounts-web-app/src/frontend/routeTree.gen.ts",
    ],
    options: {
      typeAware: true,
      typeCheck: true,
    },
    overrides: [
      {
        files: ["projects/accounts-web-app/**"],
        plugins: ["typescript", "react", "vitest"],
        rules: {
          "typescript/no-floating-promises": "error",
        },
      },
    ],
  },
});
