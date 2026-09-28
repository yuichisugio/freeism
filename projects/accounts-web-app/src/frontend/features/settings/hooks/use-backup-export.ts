import { useState } from "react";

import { sendBffRequest } from "../../../lib/api-client";
import { downloadFile } from "../download-file";

const defaultBackupFileName = "accounts-backup.json";

/**
 * 「その他」画面のデータ出力。
 * 出力操作でバックアップJSONをダウンロードさせる。
 * @see ../../../../../docs/specification/v0.1/main.ja.md
 * @see ./use-backup-export.test.tsx
 */
export function useBackupExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [isExported, setIsExported] = useState(false);
  const [exportError, setExportError] = useState<unknown>(null);

  const exportBackup = async () => {
    setIsExporting(true);
    setIsExported(false);
    setExportError(null);
    try {
      const response = await sendBffRequest("/api/backup");
      downloadFile(await response.blob(), readFileName(response.headers.get("Content-Disposition")));
      setIsExported(true);
    } catch (error) {
      setExportError(error);
    } finally {
      setIsExporting(false);
    }
  };

  return { isExporting, isExported, exportError, exportBackup };
}

export type BackupExport = ReturnType<typeof useBackupExport>;

/**
 * `Content-Disposition`のファイル名を返す。
 * 指定が無ければ既定のファイル名にする。
 */
function readFileName(contentDisposition: string | null): string {
  const match = contentDisposition?.match(/filename="?([^";]+)"?/);
  return match?.[1] ?? defaultBackupFileName;
}
