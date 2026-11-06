// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { themeInitScript, useTheme } from "./theme";

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

/**
 * `<head>`で描画前に実行するスクリプトを、保存済みの値で実行する。
 */
function runThemeInitScript(storedTheme: string) {
  window.localStorage.setItem("accounts.theme", storedTheme);
  // 事前生成したHTMLの`<script>`と同じ文字列を実行する。
  // oxlint-disable-next-line typescript/no-implied-eval
  new Function(themeInitScript)();
}

describe("themeInitScript", () => {
  it.each(["light", "dark"])("保存済みのテーマが%sなら、描画前に<html>のdata-themeへ付ける", (storedTheme) => {
    runThemeInitScript(storedTheme);

    expect(document.documentElement.getAttribute("data-theme")).toBe(storedTheme);
  });

  it.each(["system", "blue"])("保存済みの値が%sなら、data-themeを付けずシステムの設定に従う", (storedTheme) => {
    runThemeInitScript(storedTheme);

    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });
});

describe("useTheme", () => {
  it("<html>のdata-themeから現在のテーマを返し、無ければシステムとする", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("system");

    document.documentElement.setAttribute("data-theme", "dark");
    const { result: darkResult } = renderHook(() => useTheme());
    expect(darkResult.current.theme).toBe("dark");
  });

  it("テーマを選ぶと、すぐに<html>へ反映して保存し、ほかの利用箇所にも知らせる", () => {
    const { result } = renderHook(() => useTheme());
    const { result: other } = renderHook(() => useTheme());

    act(() => result.current.setTheme("light"));

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(window.localStorage.getItem("accounts.theme")).toBe("light");
    expect(result.current.theme).toBe("light");
    expect(other.current.theme).toBe("light");
  });

  it("システムを選ぶと、data-themeを外して保存する", () => {
    document.documentElement.setAttribute("data-theme", "dark");
    const { result } = renderHook(() => useTheme());

    act(() => result.current.setTheme("system"));

    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(window.localStorage.getItem("accounts.theme")).toBe("system");
    expect(result.current.theme).toBe("system");
  });
});
