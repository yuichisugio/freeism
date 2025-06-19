"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ルートレベルエラーハンドリングコンポーネント
 * アプリケーション全体でキャッチされないエラーをハンドリング
 * @param error - エラーオブジェクト
 * @param reset - エラー状態をリセットする関数
 * @returns エラー画面コンポーネント
 */
export default function Error({ error, reset }: ErrorProps) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  useEffect(() => {
    // エラーをコンソールに出力（開発時のデバッグ用）
    console.error("Root level error:", error);
  }, [error]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 dark:bg-gray-900">
      <div className="w-full max-w-md space-y-6 text-center">
        {/* エラーアイコン */}
        <div className="flex justify-center">
          <div className="rounded-full bg-red-100 p-4 dark:bg-red-900/20">
            <AlertTriangle className="h-12 w-12 text-red-600 dark:text-red-400" />
          </div>
        </div>

        {/* エラーメッセージ */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">予期しないエラーが発生しました</h1>
          <p className="text-gray-600 dark:text-gray-400">
            申し訳ございません。アプリケーションでエラーが発生しました。
            <br />
            しばらく時間をおいて再度お試しください。
          </p>
        </div>

        {/* エラー詳細（開発環境のみ） */}
        {process.env.NODE_ENV === "development" && (
          <div className="rounded-lg bg-gray-100 p-4 text-left dark:bg-gray-800">
            <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
              エラー詳細（開発環境のみ表示）
            </h3>
            <p className="text-xs break-all text-gray-700 dark:text-gray-300">{error.message}</p>
            {error.digest && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">エラーID: {error.digest}</p>}
          </div>
        )}

        {/* アクションボタン */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            onClick={reset}
            className="flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            <RefreshCw className="h-4 w-4" />
            再試行
          </Button>
          <Button
            asChild
            variant="outline"
            className="flex items-center gap-2 border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <Link href="/">
              <Home className="h-4 w-4" />
              ホームに戻る
            </Link>
          </Button>
        </div>

        {/* サポート情報 */}
        <div className="text-sm text-gray-500 dark:text-gray-400">
          <p>問題が解決しない場合は、システム管理者にお問い合わせください。</p>
        </div>
      </div>
    </div>
  );
}
