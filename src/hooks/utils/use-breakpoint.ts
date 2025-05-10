import { useEffect, useState } from "react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ブレークポイントを管理するカスタムフック
 * @returns {Object} ブレークポイントの状態
 */
export const useBreakpoint = (): { isSmUp: boolean } => {
  const [isSmUp, setIsSmUp] = useState<boolean>(() => (typeof window !== "undefined" ? window.matchMedia("(min-width: 640px)").matches : false));

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const handler = (e: MediaQueryListEvent) => setIsSmUp(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return { isSmUp };
};
