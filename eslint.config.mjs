import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import tanstackQueryPlugin from "@tanstack/eslint-plugin-query";
import pluginQuery from "@tanstack/eslint-plugin-query";
import typescript from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";
import vitest from "@vitest/eslint-plugin";
import importPlugin from "eslint-plugin-import";
import jsxA11yPlugin from "eslint-plugin-jsx-a11y";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import unicorn from "eslint-plugin-unicorn";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  ...pluginQuery.configs["flat/recommended"],
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      "@typescript-eslint": typescript,
      unicorn: unicorn,
      import: importPlugin,
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
      "jsx-a11y": jsxA11yPlugin,
      "@tanstack/query": tanstackQueryPlugin,
    },
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        project: "./tsconfig.eslint.json",
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      ...(typescript.configs?.["recommended-type-checked"]?.rules ?? {}),
      ...(typescript.configs?.["stylistic-type-checked"]?.rules ?? {}),
      ...reactPlugin.configs.recommended.rules,
      ...reactPlugin.configs["jsx-runtime"].rules,
      ...reactHooksPlugin.configs.recommended.rules,
      ...jsxA11yPlugin.configs.recommended.rules,
      ...(tanstackQueryPlugin.configs.recommended.rules ?? {}),
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "react/prop-types": "off",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "inline-type-imports",
        },
      ],
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-misused-promises": [
        "error",
        {
          checksVoidReturn: { attributes: false },
        },
      ],
      "unicorn/filename-case": [
        "error",
        {
          case: "kebabCase",
        },
      ],
      "func-style": ["error", "declaration", { allowArrowFunctions: true }],
      "prefer-arrow-callback": ["error", { allowNamedFunctions: true }],
      "import/no-default-export": "error",
    },
  },
  {
    files: [
      "**/page.tsx",
      "**/layout.tsx",
      "**/not-found.tsx",
      "**/loading.tsx",
      "next.config.ts",
      "postcss.config.mjs",
      "tailwind.config.ts",
      "src/emails/**.tsx",
    ],
    rules: {
      "import/no-default-export": "off",
      "import/prefer-default-export": "error",
    },
  },
  {
    ignores: [
      "src/components/ui/*",
      "*.md",
      "*.svg",
      "next.config.ts",
      "public/next-pwa-service-worker.js",
      "public/service-worker.js",
      "scripts/update-auction-status-to-active.cjs",
      "scripts/update-auction-status-to-completed.cjs",
      "vitest.config.ts",
      "html/**/*",
      ".next/**/*",
      "coverage/**/*",
    ],
  },
  {
    files: ["**/*.test.{ts,tsx}"],
    plugins: { vitest },
    rules: {
      ...vitest.configs.recommended.rules,
      "@typescript-eslint/unbound-method": "off",
    },
    languageOptions: {
      globals: vitest.environments.env.globals,
    },
  },
];

export default eslintConfig;
