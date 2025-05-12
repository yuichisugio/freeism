"use client";

import { FileX } from "lucide-react";

/**
 * 結果がない場合の表示を返すコンポーネント
 */
export function NoResult({ message }: { message: string }): JSX.Element {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 py-8">
      <div className="bg-muted/30 rounded-full p-4">
        <FileX className="text-muted-foreground h-12 w-12" />
      </div>
      <div className="text-center">
        <p className="text-muted-foreground text-lg font-medium">{message}</p>
      </div>
    </div>
  );
}
