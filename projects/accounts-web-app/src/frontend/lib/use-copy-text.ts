import { useEffect, useRef, useState } from "react";

/**
 * コピー操作の結果。
 */
export type CopyStatus = "idle" | "copied" | "failed";

/**
 * 「コピーしました」を表示しておく時間（ミリ秒）。
 */
const COPIED_STATUS_DURATION_MS = 3000;

/**
 * 文字列をクリップボードへコピーし、結果を表示用の状態で返す。
 * コピーできた状態は、最後のコピーから3秒後に元へ戻す。
 * 失敗は手動でのコピーを促すため残す。
 * @see ./use-copy-text.test.ts
 */
export function useCopyText() {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const resetTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(resetTimerRef.current), []);

  const copy = async (text: string) => {
    clearTimeout(resetTimerRef.current);
    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
      resetTimerRef.current = setTimeout(() => setStatus("idle"), COPIED_STATUS_DURATION_MS);
    } catch {
      setStatus("failed");
    }
  };

  return { status, copy };
}
