/** @typedef  {import("prettier").Config} PrettierConfig */
/** @typedef  {import("@ianvs/prettier-plugin-sort-imports").PluginConfig} SortImportsConfig */

/** @type { PrettierConfig | SortImportsConfig } */
const config = {
  // 基本設定
  arrowParens: "always",
  printWidth: 120,
  singleQuote: false,
  semi: true,
  trailingComma: "all",
  tabWidth: 2,
  proseWrap: "always",
  // 条件付きプラグイン設定
  overrides: [
    {
      // TypeScript/JavaScript/JSX/TSXファイル用の設定
      files: ["*.ts", "*.tsx", "*.js", "*.jsx", "*.cjs", "*.mjs"],
      options: {
        plugins: ["@ianvs/prettier-plugin-sort-imports", "prettier-plugin-tailwindcss"],
        tailwindFunctions: ["cn", "cva"],
        importOrder: [
          "<TYPES>",
          "^(react/(.*)$)|^(react$)|^(react-native(.*)$)",
          "^(next/(.*)$)|^(next$)",
          "^(expo(.*)$)|^(expo$)",
          "<THIRD_PARTY_MODULES>",
          "",
          "<TYPES>^@acme",
          "^@acme/(.*)$",
          "",
          "<TYPES>^[.|..|~]",
          "^~/",
          "^[../]",
          "^[./]",
        ],
        importOrderParserPlugins: ["typescript", "jsx", "decorators-legacy"],
        importOrderTypeScriptVersion: "5.0.0",
      },
    },
    {
      // Markdownファイル用の設定
      files: ["*.md", "*.mdx"],
      options: {
        // Markdownファイルはimport sortingを適用しない
        plugins: ["prettier-plugin-tailwindcss"],
      },
    },
  ],
};

export default config;
