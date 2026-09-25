import * as v from "valibot";
import { describe, expect, it } from "vitest";

import { toProblemIssue } from "../../backend/problem-details";
import { backupSchema, type Backup } from "./backup-schema";

/**
 * 形式の検査（必須項目・版番号・型・未知項目・件数上限・値の長さ上限）。
 * 同じClient ID・識別子の食い違いとWeb URLの上限は`plan-backup-restore.test.ts`で確認する。
 */

// --------------------------------------------------
// テストデータ
// --------------------------------------------------

function createBackup(): Backup {
  return {
    schemaVersion: 1,
    accountsOrigin: "https://accounts.freeism.app",
    accountsUserId: "ausr_source",
    exportedAt: "2026-09-26T00:00:00.000Z",
    profile: { displayName: "サンプル" },
    clientConsents: [{ clientId: "points-client", displayName: "Points", consented: true }],
    externalAccounts: [
      {
        metadata: {
          service: "github",
          displayName: "Alice",
          identifiers: [
            { type: "provider_account", provider: "github", accountId: "123" },
            { type: "url", url: "https://github.com/alice" },
          ],
          linkedAt: "2026-09-01T00:00:00Z",
          verificationStatus: "verified",
          verifications: [
            {
              method: "oauth",
              identifiers: [{ type: "provider_account", provider: "github", accountId: "123" }],
              verifiedAt: "2026-09-01T00:00:00Z",
              checkedAt: "2026-09-01T00:00:00Z",
              result: "verified",
              evidenceUrl: null,
            },
          ],
        },
        isPublic: true,
        clientVisibility: [{ clientId: "points-client", isPublic: true }],
      },
    ],
  };
}

/**
 * 検査して、不備を`code`と`path`（`.`区切り）の組にする。
 */
function readIssues(input: unknown) {
  const result = v.safeParse(backupSchema, input);
  return result.success
    ? []
    : result.issues.map(toProblemIssue).map((issue) => ({
        code: issue.code,
        path: issue.path?.join("."),
      }));
}

// --------------------------------------------------
// テスト
// --------------------------------------------------

describe("backupSchema", () => {
  it("出力と同じ形のJSONを受け付ける", () => {
    expect(readIssues(createBackup())).toEqual([]);
  });

  it.each([
    [
      "必須項目の欠落",
      (backup: Record<string, unknown>) => {
        delete backup.profile;
      },
      { code: "MISSING_REQUIRED_FIELD", path: "profile" },
    ],
    [
      "対応しない版番号",
      (backup: Record<string, unknown>) => {
        backup.schemaVersion = 2;
      },
      { code: "INVALID_VALUE", path: "schemaVersion" },
    ],
    [
      "型の不一致",
      (backup: Record<string, unknown>) => {
        backup.clientConsents = [{ clientId: "points-client", displayName: "Points", consented: "yes" }];
      },
      { code: "INVALID_TYPE", path: "clientConsents.0.consented" },
    ],
    [
      "最上位の未知項目",
      (backup: Record<string, unknown>) => {
        backup.email = "alice@example.com";
      },
      { code: "UNKNOWN_FIELD", path: "email" },
    ],
    [
      "深い階層の未知項目",
      (backup: Record<string, unknown>) => {
        const [account] = backup.externalAccounts as { metadata: Record<string, unknown> }[];
        if (account) account.metadata.importedVerifications = [];
      },
      { code: "UNKNOWN_FIELD", path: "externalAccounts.0.metadata.importedVerifications" },
    ],
    [
      "HTTPSでないURL",
      (backup: Record<string, unknown>) => {
        const [account] = backup.externalAccounts as { metadata: { identifiers: unknown[] } }[];
        if (account) account.metadata.identifiers = [{ type: "url", url: "http://example.com/" }];
      },
      { code: "INVALID_VALUE", path: "externalAccounts.0.metadata.identifiers.0.url" },
    ],
  ])("%sを項目の位置とともに不備にする", (_, mutate, expected) => {
    const backup = createBackup() as unknown as Record<string, unknown>;
    mutate(backup);
    expect(readIssues(backup)).toContainEqual(expected);
  });

  it("不備を1件で止めずにまとめて返す", () => {
    const backup = { ...createBackup(), schemaVersion: 2, unknown: true };
    expect(readIssues(backup).map((issue) => issue.path)).toEqual(["schemaVersion", "unknown"]);
  });

  // --------------------------------------------------
  // 件数上限と値の長さ上限
  // --------------------------------------------------

  it.each([
    ["externalAccounts", 300, "externalAccounts"],
    ["clientConsents", 50, "clientConsents"],
    ["identifiers", 20, "externalAccounts.0.metadata.identifiers"],
    ["verifications", 20, "externalAccounts.0.metadata.verifications"],
    ["verifications[].identifiers", 20, "externalAccounts.0.metadata.verifications.0.identifiers"],
  ] as const)("%sは%i件まで受け付け、超えると不備にする", (target, limit, path) => {
    const build = (count: number) => {
      const backup = createBackup();
      const [account] = backup.externalAccounts;
      const [verification] = account?.metadata.verifications ?? [];
      if (!account || !verification) throw new Error("テストデータが不正です");
      const identifier = { type: "provider_account", provider: "github", accountId: "123" } as const;
      if (target === "externalAccounts") backup.externalAccounts = Array.from({ length: count }, () => account);
      if (target === "clientConsents") {
        backup.clientConsents = Array.from({ length: count }, (_, index) => ({
          clientId: `client-${index}`,
          displayName: "Client",
          consented: false,
        }));
      }
      if (target === "identifiers") account.metadata.identifiers = Array.from({ length: count }, () => identifier);
      if (target === "verifications") {
        account.metadata.verifications = Array.from({ length: count }, () => verification);
      }
      if (target === "verifications[].identifiers") {
        verification.identifiers = Array.from({ length: count }, () => identifier);
      }
      return backup;
    };

    expect(readIssues(build(limit)).filter((issue) => issue.path === path)).toEqual([]);
    expect(readIssues(build(limit + 1))).toContainEqual({ code: "INVALID_VALUE", path });
  });

  it.each([
    ["accountId", 256, { type: "provider_account", provider: "github", accountId: "a" }],
    ["username", 256, { type: "provider_username", provider: "github", username: "a" }],
    ["url", 2048, { type: "url", url: "https://example.com/" }],
  ] as const)("識別子の%sは%i bytesまで受け付ける", (field, maxBytes, base) => {
    const build = (bytes: number) => {
      const backup = createBackup();
      const [account] = backup.externalAccounts;
      if (!account) throw new Error("テストデータが不正です");
      const value =
        field === "url" ? `https://example.com/${"a".repeat(bytes - "https://example.com/".length)}` : "a".repeat(bytes);
      account.metadata.identifiers = [{ ...base, [field]: value } as never];
      return backup;
    };
    const path = `externalAccounts.0.metadata.identifiers.0.${field}`;

    expect(readIssues(build(maxBytes))).toEqual([]);
    expect(readIssues(build(maxBytes + 1))).toContainEqual({ code: "INVALID_VALUE", path });
  });
});
