import { useState } from "react";

import { backupSummarySchema } from "../../../../shared/schemas/backup-schema";
import { sendBffRequest } from "../../../lib/api-client";
import { useBffResource } from "./use-bff-resource";

const defaultBackupFileName = "accounts-backup.json";

/**
 * 「設定」画面のJSON出力。
 * 出力前に件数の見込みと非公開情報を含むかを読み込み、出力操作でJSONファイルをダウンロードさせる。
 * @see ../../../../../docs/specification/v0.1/main.ja.md
 * @see ./use-backup-export.test.tsx
 */
export function useBackupExport() {
  const summary = useBffResource("/api/backup/summary", backupSummarySchema);
  const [isExporting, setIsExporting] = useState(false);
  const [isExported, setIsExported] = useState(false);
  const [exportError, setExportError] = useState<unknown>(null);

  const exportBackup = async () => {
    setIsExporting(true);
    setIsExported(false);
    setExportError(null);
    try {
      const response = await sendBffRequest("/api/backup");
      downloadBlob(await response.blob(), readFileName(response.headers.get("Content-Disposition")));
      setIsExported(true);
    } catch (error) {
      setExportError(error);
    } finally {
      setIsExporting(false);
    }
  };

  return {
    summary: summary.data,
    summaryError: summary.error,
    isSummaryLoading: summary.isLoading,
    reloadSummary: summary.reload,
    isExporting,
    isExported,
    exportError,
    exportBackup,
  };
}

export type BackupExport = ReturnType<typeof useBackupExport>;

// --------------------------------------------------
// ダウンロード
// --------------------------------------------------

/**
 * `Content-Disposition`のファイル名を返す。
 * 指定が無ければ既定のファイル名にする。
 */
function readFileName(contentDisposition: string | null): string {
  const match = contentDisposition?.match(/filename="?([^";]+)"?/);
  return match?.[1] ?? defaultBackupFileName;
}

/**
 * 取得したファイルを、一時的なリンクからブラウザーに保存させる。
 */
function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
