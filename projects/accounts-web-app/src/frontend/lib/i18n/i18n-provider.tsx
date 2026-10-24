import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

import { defaultLanguage, readInitialLanguage, storeLanguage } from "./language";
import type { Language } from "./language";

type I18nContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
};

const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * 表示言語を画面全体へ提供する。
 * 事前生成したHTMLと同じ日本語で描画を始め、描画後に保存済みの言語・ブラウザーの言語を反映する（hydrationの不一致を避けるため）。
 * 文書の`lang`属性も表示言語に合わせる。
 */
export function I18nProvider({ children, initialLanguage }: { children: ReactNode; initialLanguage?: Language }) {
  const [language, setLanguageState] = useState<Language>(initialLanguage ?? defaultLanguage);

  useEffect(() => {
    if (initialLanguage === undefined) setLanguageState(readInitialLanguage());
  }, [initialLanguage]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = (next: Language) => {
    setLanguageState(next);
    storeLanguage(next);
  };

  return <I18nContext value={{ language, setLanguage }}>{children}</I18nContext>;
}

/**
 * 現在の表示言語と切替操作を返す。
 */
export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (context === null) throw new Error("useI18n must be used within I18nProvider.");
  return context;
}

/**
 * 日英の文言の組から、現在の表示言語の文言を返す。
 */
export function useMessages<TMessages>(messages: Record<Language, TMessages>): TMessages {
  return messages[useI18n().language];
}
