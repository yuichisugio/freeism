import type { Backup } from "../../../shared/schemas/backup-schema";
import { downloadFile } from "./download-file";

/**
 * 「データ取込」のテンプレート。
 * 出力JSONと同じ形式（`schemaVersion: 1`）の最小例で、URL識別子だけを持つ未検証の外部アカウント1件とする。
 * テンプレートから作ったJSONも、バックアップJSONと同じ検査と規則で取り込む。
 * @see ../../../../docs/specification/v0.1/main.ja.md
 * @see ./import-template.test.ts
 */
const importTemplate: Backup = {
  schemaVersion: 1,
  accountsOrigin: "https://accounts.freeism.app",
  accountsUserId: "sample-user",
  exportedAt: "2026-01-01T00:00:00Z",
  profile: { displayName: "Sample" },
  clientConsents: [],
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

/**
 * テンプレートの本文（ダウンロードするファイルとAI向けの依頼文に入れる）。
 */
export const importTemplateText = JSON.stringify(importTemplate, null, 2);

const importTemplateFileName = "accounts-import-template.json";

/**
 * テンプレートをJSONファイルとしてダウンロードさせる。
 */
export function downloadImportTemplate(): void {
  downloadFile(new Blob([importTemplateText], { type: "application/json" }), importTemplateFileName);
}
