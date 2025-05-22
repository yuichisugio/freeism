import { memo, useMemo } from "react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { File, X } from "lucide-react";

export const SelectedFileCard = memo(({ name, fileSize, onRemove }: { name: string; fileSize: number; onRemove: () => void }) => {
  // ファイルサイズをKBに変換
  function formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  // ファイルサイズを適切な単位に変換
  const formattedSize = useMemo(() => formatFileSize(fileSize), [fileSize]);

  return (
    <Card className="relative overflow-hidden border-blue-100 bg-white/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <File className="h-4 w-4 text-blue-600" />
            <CardTitle className="text-sm font-medium">{name}</CardTitle>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="rounded-full p-1 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <CardDescription className="text-xs text-neutral-500">{formattedSize}</CardDescription>
      </CardHeader>
      <div className="absolute bottom-0 left-0 h-1 w-full bg-blue-100">
        <div className="h-full w-full animate-pulse bg-blue-600" style={{ width: "100%" }} />
      </div>
    </Card>
  );
});

SelectedFileCard.displayName = "SelectedFileCard";
