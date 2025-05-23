import { memo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeft } from "lucide-react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * エラーインジケーター
 */
export const Error = memo(function Error({ error, previousPageURL }: { error: string; previousPageURL?: string }) {
  const router = useRouter();

  return (
    <div className="container mx-auto flex min-h-[calc(100vh-10rem)] flex-col items-center justify-center py-6">
      <AlertTriangle className="text-destructive h-16 w-16" />
      <p className="text-destructive mt-4 text-lg">{error ? `エラーが発生しました: ${error}` : "オークション情報を取得できませんでした。"}</p>
      <Button variant="outline" className="mt-6" onClick={() => router.push(previousPageURL ?? "/dashboard/group-list")}>
        <ArrowLeft className="mr-2 h-4 w-4" /> 前のページに戻る
      </Button>
    </div>
  );
});
