/**
 * 画面の表示言語。
 */
export type Language = "ja" | "en";

/**
 * 事前生成するHTMLの言語。
 */
export const defaultLanguage: Language = "ja";

const languageStorageKey = "accounts.language";

/**
 * ブラウザーの優先言語（`navigator.languages`）から初期言語を決める。
 * 先頭が日本語の場合は日本語、それ以外は英語とする。
 * @see ./language.test.ts
 */
export function detectLanguage(browserLanguages: readonly string[]): Language {
  return browserLanguages[0]?.toLowerCase().startsWith("ja") ? "ja" : "en";
}

/**
 * 保存済みの言語、無ければブラウザー判定の言語を返す。
 * ブラウザーでだけ呼ぶ。
 */
export function readInitialLanguage(): Language {
  const stored = readStoredLanguage();
  return stored ?? detectLanguage(window.navigator.languages);
}

/**
 * 「設定」画面で選んだ言語を保存する。
 * 保存できない環境では、次回もブラウザー判定の言語になる。
 */
export function storeLanguage(language: Language): void {
  try {
    window.localStorage.setItem(languageStorageKey, language);
  } catch {
    // 保存できない環境（プライベートモードの制限など）は切替を現在の表示だけに適用する。
  }
}

function readStoredLanguage(): Language | null {
  try {
    const stored = window.localStorage.getItem(languageStorageKey);
    return stored === "ja" || stored === "en" ? stored : null;
  } catch {
    return null;
  }
}
