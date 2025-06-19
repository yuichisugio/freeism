"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeft, Home, RefreshCw } from "lucide-react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

type DashboardErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ダッシュボード内のメイン画面エラーハンドリングコンポーネント
 * sidebar.tsx と header.tsx 以外のメイン画面でのエラーをハンドリング
 * @param error - エラーオブジェクト
 * @param reset - エラー状態をリセットする関数
 * @returns エラー画面コンポーネント
 */
export default function DashboardError({ error, reset }: DashboardErrorProps) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  useEffect(() => {
    // エラーをコンソールに出力（開発時のデバッグ用）
    console.error("Dashboard main content error:", error);
  }, [error]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg space-y-6 text-center">
        {/* エラーアイコン */}
        <div className="flex justify-center">
          <div className="rounded-full bg-red-100 p-3 dark:bg-red-900/20">
            <AlertTriangle className="h-10 w-10 text-red-600 dark:text-red-400" />
          </div>
        </div>

        {/* エラーメッセージ */}
        <div className="space-y-3">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">ページの読み込みでエラーが発生しました</h2>
          <p className="text-gray-600 dark:text-gray-400">
            このページでエラーが発生しました。
            <br />
            ページを再読み込みするか、別のページに移動してください。
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
            ページを再読み込み
          </Button>
          <Button
            asChild
            variant="outline"
            className="flex items-center gap-2 border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <Link href="/dashboard/group-list">
              <ArrowLeft className="h-4 w-4" />
              Group一覧に戻る
            </Link>
          </Button>
        </div>

        {/* 追加オプション */}
        <div className="border-t border-gray-200 pt-4 dark:border-gray-700">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <Link href="/" className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              ホームページに戻る
            </Link>
          </Button>
        </div>

        {/* サポート情報 */}
        <div className="text-sm text-gray-500 dark:text-gray-400">
          <p>
            問題が続く場合は、ブラウザを更新するか、
            <br />
            システム管理者にお問い合わせください。
          </p>
        </div>
      </div>
    </div>
  );
}
