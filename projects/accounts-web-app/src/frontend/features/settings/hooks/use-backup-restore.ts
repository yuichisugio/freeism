import { useState } from "react";

import { restoreBackupResultSchema } from "../../../../shared/schemas/backup-schema";
import type { RestoreBackupResult } from "../../../../shared/schemas/backup-schema";
import type { ProblemIssue } from "../../../../shared/schemas/problem-details-schema";
import { BffError, requestBff } from "../../../lib/api-client";
import { authClient } from "../../../lib/auth-client";
import { readBackupFile } from "../backup-file";

/**
 * 「設定」画面のJSON復元。
 * 送信前にファイルの容量・JSON構文・形式を検査し、サーバーの入力不備も同じ一覧で返す。
 * 復元後は、戻した表示名をヘッダー・アカウントのメニューへ反映するため、現在のセッションを読み直させる。
 * @see ../../../../../docs/specification/v0.1/main.ja.md
 * @see ./use-backup-restore.test.tsx
 */
export function useBackupRestore({ onRestored }: { onRestored: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [result, setResult] = useState<RestoreBackupResult | null>(null);
  const [issues, setIssues] = useState<ProblemIssue[]>([]);
  const [restoreError, setRestoreError] = useState<unknown>(null);

  const clearOutcome = () => {
    setResult(null);
    setIssues([]);
    setRestoreError(null);
  };

  const selectFile = (next: File | null) => {
    setFile(next);
    clearOutcome();
  };

  const restore = async () => {
    if (file === null) return;
    setIsRestoring(true);
    clearOutcome();
    try {
      const checked = await readBackupFile(file);
      if (checked.issues !== null) {
        setIssues(checked.issues);
        return;
      }
      setResult(
        await requestBff("/api/backup/restore", restoreBackupResultSchema, { method: "POST", body: checked.backup }),
      );
      authClient.$store.notify("$sessionSignal");
      onRestored();
    } catch (error) {
      const serverIssues = error instanceof BffError ? (error.problem?.errors ?? []) : [];
      if (serverIssues.length > 0) {
        setIssues(serverIssues);
      } else {
        setRestoreError(error);
      }
    } finally {
      setIsRestoring(false);
    }
  };

  return {
    file,
    selectFile,
    canRestore: file !== null && !isRestoring,
    isRestoring,
    result,
    issues,
    restoreError,
    restore,
  };
}

export type BackupRestore = ReturnType<typeof useBackupRestore>;
