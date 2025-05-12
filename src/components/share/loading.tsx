"use client";

import { Loader2 } from "lucide-react";

/**
 * ローディング中の表示を返すコンポーネント
 */
export function Loading(): JSX.Element {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <div className="flex h-full w-full items-center justify-center">
      <Loader2 className="h-10 w-10 animate-spin" />
    </div>
  );
}
