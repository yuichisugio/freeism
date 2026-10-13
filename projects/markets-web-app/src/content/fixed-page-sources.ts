import docsEn from "./fixed-pages/docs.en.md?raw";
import docsJa from "./fixed-pages/docs.ja.md?raw";
import helpEn from "./fixed-pages/help.en.md?raw";
import helpJa from "./fixed-pages/help.ja.md?raw";
import privacyEn from "./fixed-pages/privacy.en.md?raw";
import privacyJa from "./fixed-pages/privacy.ja.md?raw";
import termsEn from "./fixed-pages/terms.en.md?raw";
import termsJa from "./fixed-pages/terms.ja.md?raw";

export interface FixedPageSource {
  markdown: string;
}

export interface FixedPageData {
  en: FixedPageSource;
  ja: FixedPageSource;
  route: "terms" | "privacy" | "help" | "docs";
}

function normalizeMarkdown(markdown: string): string {
  return markdown.replace(/\r\n?/g, "\n");
}

export const fixedPages: Record<FixedPageData["route"], FixedPageData> = {
  terms: {
    en: { markdown: normalizeMarkdown(termsEn) },
    ja: { markdown: normalizeMarkdown(termsJa) },
    route: "terms",
  },
  privacy: {
    en: { markdown: normalizeMarkdown(privacyEn) },
    ja: { markdown: normalizeMarkdown(privacyJa) },
    route: "privacy",
  },
  help: {
    en: { markdown: normalizeMarkdown(helpEn) },
    ja: { markdown: normalizeMarkdown(helpJa) },
    route: "help",
  },
  docs: {
    en: { markdown: normalizeMarkdown(docsEn) },
    ja: { markdown: normalizeMarkdown(docsJa) },
    route: "docs",
  },
};
