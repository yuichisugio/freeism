import { useSyncExternalStore } from "react";

/**
 * 画面のテーマの設定。
 * `system`はシステムの設定（`prefers-color-scheme`）に従う。
 */
export type ThemePreference = "system" | "light" | "dark";

/**
 * 選べるテーマの設定（「その他」画面の選択肢の順）。
 */
export const themePreferences: readonly ThemePreference[] = ["system", "light", "dark"];

const themeStorageKey = "accounts.theme";
const themeAttribute = "data-theme";

/**
 * 描画前に保存済みのテーマを`<html>`の`data-theme`へ付けるスクリプト。
 * 事前生成したHTMLの`<head>`で実行し、初回描画のちらつきを避ける。
 * `system`・不明な値・読めない環境では属性を付けず、システムの設定に従う。
 * @see ../routes/__root.tsx
 * @see ./theme.test.tsx
 */
export const themeInitScript = `try{var t=localStorage.getItem(${JSON.stringify(themeStorageKey)});if(t==="light"||t==="dark")document.documentElement.setAttribute(${JSON.stringify(themeAttribute)},t)}catch(e){}`;

// --------------------------------------------------
// 状態
// --------------------------------------------------

const listeners = new Set<() => void>();

/**
 * `<html>`の`data-theme`を正として、現在のテーマの設定を読む。
 */
function readTheme(): ThemePreference {
  const value = document.documentElement.getAttribute(themeAttribute);
  return value === "light" || value === "dark" ? value : "system";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * テーマを`<html>`へ反映し、localStorageへ保存する。
 * 保存できない環境では、現在の表示だけに反映する。
 */
function applyTheme(theme: ThemePreference): void {
  if (theme === "system") document.documentElement.removeAttribute(themeAttribute);
  else document.documentElement.setAttribute(themeAttribute, theme);
  try {
    window.localStorage.setItem(themeStorageKey, theme);
  } catch {
    // 保存できない環境（プライベートモードの制限など）は、次回はシステムの設定に従う。
  }
  for (const listener of listeners) listener();
}

/**
 * 現在のテーマの設定と、選んだテーマをすぐに反映する操作を返す。
 * 事前生成するHTMLでは`system`として描画する。
 * @see ./theme.test.tsx
 */
export function useTheme() {
  const theme = useSyncExternalStore<ThemePreference>(subscribe, readTheme, () => "system");
  return { theme, setTheme: applyTheme };
}
