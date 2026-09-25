import { useState } from "react";

/**
 * コピー操作の結果。
 */
export type CopyStatus = "idle" | "copied" | "failed";

/**
 * 文字列をクリップボードへコピーし、結果を表示用の状態で返す。
 */
export function useCopyText() {
  const [status, setStatus] = useState<CopyStatus>("idle");

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  };

  return { status, copy };
}
