import { memo } from "react";
import { AlertTriangle } from "lucide-react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * エラーインジケーター
 */
export const Error = memo(function Error({ error }: { error: string }) {
  console.log("src/components/auction/bid/auction-detail.tsx_ErrorIndicator_render");

  return (
    <div className="border-destructive rounded-lg border p-6 text-center">
      <AlertTriangle className="text-destructive mx-auto mb-3 h-8 w-8" />
      <p className="text-destructive">{error}</p>
    </div>
  );
});
