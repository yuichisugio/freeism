"use client";

import { Loader2 } from "lucide-react";

/**
 * ローディング中の表示を返すコンポーネント
 */
export function Loading(): JSX.Element {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <div className="flex h-dvh animate-pulse items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin" />
      <span className="ml-2 text-lg">Loading...</span>
    </div>
  );
}
