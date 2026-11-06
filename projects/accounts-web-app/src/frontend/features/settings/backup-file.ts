import * as v from "valibot";

import { jsonFileMaxBytes } from "../../../shared/constants";
import { backupSchema } from "../../../shared/schemas/backup-schema";
import { toProblemIssue, type ProblemIssue } from "../../../shared/schemas/problem-details-schema";

/**
 * 復元するバックアップJSONファイルの、送信前の検査。
 * 不備はサーバーの`errors[]`と同じ形（`code`・`message`・`path`）にして、画面で同じ一覧に表示する。
 * 同じClient ID・識別子の食い違いやWeb URLの上限などの照合はバックエンドが行う。
 * @see ../../../../docs/specification/v0.1/main.ja.md
 * @see ./hooks/use-backup-restore.test.tsx
 */

type ReadBackupFileResult =
  | { backup: v.InferOutput<typeof backupSchema>; issues: null }
  | { backup: null; issues: ProblemIssue[] };

/**
 * ファイルの容量・JSON構文・バックアップ形式を検査し、復元の入力を返す。
 */
export async function readBackupFile(file: File): Promise<ReadBackupFileResult> {
  if (file.size > jsonFileMaxBytes) {
    return { backup: null, issues: [{ code: "REQUEST_TOO_LARGE", message: "", path: null }] };
  }

  let json: unknown;
  try {
    json = JSON.parse(await file.text());
  } catch {
    return { backup: null, issues: [{ code: "INVALID_JSON", message: "", path: null }] };
  }

  const result = v.safeParse(backupSchema, json);
  if (!result.success) {
    return { backup: null, issues: result.issues.map(toProblemIssue) };
  }
  return { backup: result.output, issues: null };
}

// --------------------------------------------------
// 表示
// --------------------------------------------------

/**
 * 不備の位置を`externalAccounts[3].metadata.identifiers[0].url`の形で表す。
 * 特定の項目を指せない場合は`null`。
 */
export function formatIssuePath(path: ProblemIssue["path"]): string | null {
  if (path === null || path.length === 0) return null;
  return path
    .map((key, index) => {
      if (typeof key === "number") return `[${key}]`;
      return index === 0 ? key : `.${key}`;
    })
    .join("");
}
