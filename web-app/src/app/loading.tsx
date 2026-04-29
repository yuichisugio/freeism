"use cache";

import { unstable_cacheLife as cacheLife } from "next/cache";
import { Loader2 } from "lucide-react";

/**
 * ローディングコンポーネント
 * ボタンを押してすぐに画面遷移をしていることを示すために使用
 * 現在のページに留まるとボタンを押しても反応しないと見えてしまうため
 */
export default async function Loading() {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * キャッシュの有効期間を設定
   */
  cacheLife("max");

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <div className="flex h-dvh animate-pulse items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin" />
      <span className="ml-2 text-lg">Loading...</span>
    </div>
  );
}
