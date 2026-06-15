import { Loader2 } from "lucide-react";

/**
 * グループリストページのローディング表示
 * @returns ローディングコンポーネント
 */
export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-sm text-neutral-600 dark:text-neutral-400">読み込み中...</p>
      </div>
    </div>
  );
}
