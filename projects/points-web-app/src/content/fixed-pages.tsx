import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";

import { fixedPages } from "virtual:fixed-pages";

import {
  FIXED_PAGE_LANGUAGE_STORAGE_KEY,
  type FixedPageLanguage,
  resolveFixedPageLanguage,
} from "./fixed-page-language";

export interface FixedPageSource {
  markdown: string;
  sourceSha256: string;
}

export interface FixedPageData {
  en: FixedPageSource;
  ja: FixedPageSource;
  route: "terms" | "privacy" | "help" | "docs";
}

function browserLanguages(): readonly string[] {
  return typeof navigator === "undefined" ? [] : navigator.languages;
}

function savedLanguage(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage.getItem(FIXED_PAGE_LANGUAGE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function FixedPageView({ page }: { page: FixedPageData }) {
  const [language, setLanguage] = useState<FixedPageLanguage | null>(null);

  useEffect(() => {
    const resolved = resolveFixedPageLanguage(savedLanguage(), browserLanguages());
    document.documentElement.dataset.fixedPageLanguage = resolved;
    setLanguage(resolved);
  }, []);

  function selectLanguage(nextLanguage: FixedPageLanguage) {
    try {
      window.localStorage.setItem(FIXED_PAGE_LANGUAGE_STORAGE_KEY, nextLanguage);
    } catch {
      // The visual and accessibility state still updates when storage is unavailable.
    }
    document.documentElement.dataset.fixedPageLanguage = nextLanguage;
    setLanguage(nextLanguage);
  }

  return (
    <main className="page-shell fixed-page" data-fixed-page={page.route}>
      <header className="fixed-page-header">
        <p className="eyebrow">Public record / 公開記録</p>
        <div aria-label="表示言語 / Display language" className="language-control" role="group">
          <button
            aria-pressed={language === "ja"}
            onClick={() => selectLanguage("ja")}
            type="button"
          >
            日本語
          </button>
          <button
            aria-pressed={language === "en"}
            onClick={() => selectLanguage("en")}
            type="button"
          >
            English
          </button>
        </div>
        <p className="language-help">
          JavaScriptが無効な場合は、日本語とEnglishの両方を表示します。
        </p>
      </header>

      {(["ja", "en"] as const).map((locale) => {
        const source = page[locale];
        const hiddenFromAccessibility = language === null ? undefined : language !== locale;
        return (
          <article
            aria-hidden={hiddenFromAccessibility}
            className="fixed-page-language"
            data-language={locale}
            data-source-sha256={source.sourceSha256}
            key={locale}
            lang={locale}
          >
            <p className="authority-note">
              {locale === "ja"
                ? "日本語版を仕様・法務上の正本とし、英語版は参照翻訳です。"
                : "The Japanese version is the authoritative specification and legal text. The English version is provided for reference."}
            </p>
            <ReactMarkdown skipHtml>{source.markdown}</ReactMarkdown>
          </article>
        );
      })}
    </main>
  );
}

export function FixedPage({ route }: { route: FixedPageData["route"] }) {
  return <FixedPageView page={fixedPages[route]} />;
}
