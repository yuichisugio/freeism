"use client";

import { useEffect, useState } from "react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ブレークポイントを管理するカスタムフック
 * @returns {boolean} ブレークポイントの状態
 */
export const useBreakpoint = (): { isSmUp: boolean } => {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ブレークポイントの状態
   * useBreakpointフックでは、typeof window !== "undefined"チェックで、SSR環境ではブレークポイントの状態をfalseにしている。
   * window.matchMediaが対応していないブラウザでは、window.matchMediaがundefinedになるため、falseになる。
   */
  const [isSmUp, setIsSmUp] = useState<boolean>(() =>
    typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(min-width: 640px)").matches : false,
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ブレークポイントの状態を更新
   */
  useEffect(() => {
    // matchMediaが利用できない場合は何もしない
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }
    // matchMediaが利用できる場合はブレークポイントの状態を更新
    const mq = window.matchMedia("(min-width: 640px)");
    const handler = (e: MediaQueryListEvent) => setIsSmUp(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ブレークポイントの状態を返す
   */
  return { isSmUp };
};
