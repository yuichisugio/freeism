import type { Backup } from "../../../shared/schemas/backup-schema";
import { downloadFile } from "./download-file";

/**
 * 「データ取込」のテンプレートの本文（ダウンロードするファイルとAI向けの依頼文に入れる）。
 * 出力JSONと同じ形式（`schemaVersion: 1`）の最小例で、URL識別子だけを持つ未検証の外部アカウント1件とする。
 * 取込で表示名を上書きしないよう、`profile.displayName` には現在の表示名を入れる。
 * テンプレートから作ったJSONも、バックアップJSONと同じ検査と規則で取り込む。
 * @see ../../../../docs/specification/v0.1/main.ja.md
 * @see ./import-template.test.ts
 * @see ../../../backend/routes/backup-routes.worker.test.ts
 */
export function buildImportTemplateText(displayName: string): string {
  const importTemplate: Backup = {
    schemaVersion: 1,
    accountsOrigin: "https://accounts.freeism.app",
    accountsUserId: "sample-user",
    exportedAt: "2026-01-01T00:00:00Z",
    profile: { displayName },
    externalAccounts: [
      {
        metadata: {
          service: null,
          displayName: null,
          identifiers: [{ type: "url", url: "https://example.com/your-page" }],
          linkedAt: null,
          verificationStatus: "unverified",
          verifications: [],
        },
        isPublic: false,
        clientVisibility: [],
      },
    ],
  };
  return JSON.stringify(importTemplate, null, 2);
}

const importTemplateFileName = "accounts-import-template.json";

/**
 * テンプレートの本文をJSONファイルとしてダウンロードさせる。
 */
export function downloadImportTemplate(templateText: string): void {
  downloadFile(new Blob([templateText], { type: "application/json" }), importTemplateFileName);
}
