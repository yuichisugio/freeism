import { defineConfig } from "blume";

export default defineConfig({
  title: "Freeism Docs",
  description: "無料主義 v3 の日本語・英語ドキュメント",
  content: {
    root: "src",
    include: ["freeism.*.md", "note/note.*.md"],
    pages: "pages",
  },
  i18n: {
    defaultLocale: "ja",
    fallbackLocale: null,
    parser: "dot",
    locales: [
      { code: "ja", label: "日本語" },
      { code: "en", label: "English" },
    ],
  },
  navigation: {
    featured: [
      { label: "Freeism", href: "https://freeism.app/" },
      { label: "Docs", href: "https://docs.freeism.app/" },
      { label: "Points", href: "https://points.freeism.app/" },
      { label: "Markets", href: "https://markets.freeism.app/" },
    ],
  },
  search: {
    provider: "pagefind",
  },
  deployment: {
    output: "static",
    site: "https://docs.freeism.app",
  },
});
