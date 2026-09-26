import { describe, expect, it } from "vitest";

import type { Backup } from "../../../shared/schemas/backup-schema";
import { planBackupRestore, type ExistingIdentifier } from "./plan-backup-restore";

// --------------------------------------------------
// テストデータ
// --------------------------------------------------

type BackupAccount = Backup["externalAccounts"][number];

const pointsConsent = { clientId: "points-client", displayName: "Points", consented: true };

function createBackup(
  externalAccounts: BackupAccount[],
  clientConsents: Backup["clientConsents"] = [pointsConsent],
): Backup {
  return {
    schemaVersion: 1,
    accountsOrigin: "https://accounts.freeism.app",
    accountsUserId: "ausr_source",
    exportedAt: "2026-09-26T00:00:00.000Z",
    profile: { displayName: "サンプル" },
    clientConsents,
    externalAccounts,
  };
}

function createAccount(
  identifiers: BackupAccount["metadata"]["identifiers"],
  overrides: Partial<Omit<BackupAccount, "metadata">> & {
    verifications?: BackupAccount["metadata"]["verifications"];
  } = {},
): BackupAccount {
  return {
    metadata: {
      service: null,
      displayName: null,
      identifiers,
      linkedAt: null,
      verificationStatus: "unverified",
      verifications: overrides.verifications ?? [],
    },
    isPublic: overrides.isPublic ?? false,
    clientVisibility: overrides.clientVisibility ?? [],
  };
}

const oldVerification: BackupAccount["metadata"]["verifications"][number] = {
  method: "bidirectional_link",
  identifiers: [{ type: "url", url: "https://example.org/about" }],
  verifiedAt: "2026-09-01T00:00:00Z",
  checkedAt: "2026-09-01T00:00:00Z",
  result: "verified",
  evidenceUrl: "https://example.org/about",
};

function existingUrl(accountId: string, value: string, isActive: boolean): ExistingIdentifier {
  return { accountId, kind: "url", provider: "", issuer: "", value, isActive };
}

function readIssues(result: ReturnType<typeof planBackupRestore>) {
  return result.ok ? [] : result.issues.map((issue) => ({ code: issue.code, path: issue.path?.join(".") ?? null }));
}

function readPlan(result: ReturnType<typeof planBackupRestore>) {
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.plan;
}

// --------------------------------------------------
// 既存行との対応付け
// --------------------------------------------------

describe("planBackupRestore 既存行との対応付け", () => {
  it("本人に有効な既存行は公開選択だけを戻し、過去の証明情報を保存しない", () => {
    const plan = readPlan(
      planBackupRestore(
        createBackup([
          createAccount([{ type: "url", url: "https://example.org/about" }], {
            isPublic: true,
            clientVisibility: [{ clientId: "points-client", isPublic: true }],
            verifications: [oldVerification],
          }),
        ]),
        [existingUrl("eac_current", "https://example.org/about", true)],
      ),
    );

    expect(plan.createdAccounts).toEqual([]);
    expect(plan.updatedAccounts).toEqual([
      expect.objectContaining({ id: "eac_current", isPublic: true, importedVerifications: null }),
    ]);
    expect(plan.identifiers).toEqual([]);
    expect(plan.visibility).toEqual([{ accountId: "eac_current", clientId: "points-client", isPublic: true }]);
  });

  it("候補の既存行は更新して過去の証明情報を保持し、行に無い識別子を候補として加える", () => {
    const plan = readPlan(
      planBackupRestore(
        createBackup([
          createAccount(
            [
              { type: "url", url: "https://example.org/about" },
              { type: "provider_username", provider: "github", username: "Alice" },
            ],
            { verifications: [oldVerification] },
          ),
        ]),
        [existingUrl("eac_candidate", "https://example.org/about", false)],
      ),
    );

    expect(plan.updatedAccounts).toEqual([
      expect.objectContaining({ id: "eac_candidate", importedVerifications: [oldVerification] }),
    ]);
    expect(plan.identifiers).toEqual([
      expect.objectContaining({ accountId: "eac_candidate", kind: "provider_username", provider: "github", value: "alice" }),
    ]);
  });

  it("本人に無い外部アカウントは、JSONのサービス・表示名と過去の証明情報を持つ登録候補にする", () => {
    const plan = readPlan(
      planBackupRestore(
        createBackup([
          {
            ...createAccount([{ type: "url", url: "HTTPS://Example.org/about#top" }], {
              verifications: [oldVerification],
            }),
            metadata: {
              ...createAccount([{ type: "url", url: "HTTPS://Example.org/about#top" }]).metadata,
              service: "github",
              displayName: "Alice",
              verifications: [oldVerification],
            },
          },
        ]),
        [],
      ),
    );

    const [created] = plan.createdAccounts;
    expect(created).toEqual(
      expect.objectContaining({ service: "github", displayName: "Alice", importedVerifications: [oldVerification] }),
    );
    expect(plan.identifiers).toEqual([
      expect.objectContaining({ accountId: created?.id, kind: "url", value: "https://example.org/about", host: "example.org" }),
    ]);
  });

  it("同じ識別子を持つ複数のJSONアカウントは1行の候補にまとめる", () => {
    const plan = readPlan(
      planBackupRestore(
        createBackup([
          createAccount([{ type: "url", url: "https://example.org/a" }, { type: "url", url: "https://example.org/b" }]),
          createAccount([{ type: "url", url: "https://example.org/b" }, { type: "url", url: "https://example.org/c" }]),
        ]),
        [],
      ),
    );

    expect(plan.createdAccounts).toHaveLength(1);
    expect(plan.identifiers.map((identifier) => identifier.value)).toEqual([
      "https://example.org/a",
      "https://example.org/b",
      "https://example.org/c",
    ]);
  });

  it("同じ既存行に当たる複数のJSONアカウントは、公開選択が一致すれば1行の更新にまとめる", () => {
    const plan = readPlan(
      planBackupRestore(
        createBackup([
          createAccount([{ type: "url", url: "https://example.org/a" }], { isPublic: true }),
          createAccount([{ type: "url", url: "https://example.org/b" }], { isPublic: true }),
        ]),
        [
          existingUrl("eac_current", "https://example.org/a", true),
          existingUrl("eac_current", "https://example.org/b", true),
        ],
      ),
    );

    expect(plan.updatedAccounts.map((account) => account.id)).toEqual(["eac_current"]);
  });

  it("情報提供同意は同じClient IDを1件にまとめる", () => {
    const plan = readPlan(planBackupRestore(createBackup([], [pointsConsent, pointsConsent]), []));
    expect(plan.clientConsents).toEqual([pointsConsent]);
  });
});

// --------------------------------------------------
// 入力不備
// --------------------------------------------------

describe("planBackupRestore 入力不備", () => {
  it("同じClient IDの同意・表示名の食い違いを不備にする", () => {
    const result = planBackupRestore(
      createBackup([], [pointsConsent, { clientId: "points-client", displayName: "Points 2", consented: false }]),
      [],
    );
    expect(readIssues(result)).toEqual([
      { code: "INVALID_VALUE", path: "clientConsents.1.consented" },
      { code: "INVALID_VALUE", path: "clientConsents.1.displayName" },
    ]);
  });

  it("clientConsentsに無いClient IDの公開選択を不備にする", () => {
    const result = planBackupRestore(
      createBackup([
        createAccount([{ type: "url", url: "https://example.org/a" }], {
          clientVisibility: [{ clientId: "unknown-client", isPublic: true }],
        }),
      ]),
      [],
    );
    expect(readIssues(result)).toEqual([
      { code: "INVALID_VALUE", path: "externalAccounts.0.clientVisibility.0.clientId" },
    ]);
  });

  it("同じ識別子を持つJSONアカウントの一般公開・公開選択の食い違いを不備にする", () => {
    const result = planBackupRestore(
      createBackup([
        createAccount([{ type: "provider_username", provider: "github", username: "Alice" }], {
          isPublic: true,
          clientVisibility: [{ clientId: "points-client", isPublic: true }],
        }),
        createAccount([{ type: "provider_username", provider: "github", username: "alice" }], {
          isPublic: false,
          clientVisibility: [{ clientId: "points-client", isPublic: false }],
        }),
      ]),
      [],
    );
    expect(readIssues(result)).toEqual([
      { code: "INVALID_VALUE", path: "externalAccounts.1.isPublic" },
      { code: "INVALID_VALUE", path: "externalAccounts.1.clientVisibility.0.isPublic" },
    ]);
  });

  it("同じ既存行に当たる複数のJSONアカウントの公開選択の食い違いを不備にする", () => {
    const result = planBackupRestore(
      createBackup([
        createAccount([{ type: "url", url: "https://example.org/a" }], { isPublic: true }),
        createAccount([{ type: "url", url: "https://example.org/b" }], { isPublic: false }),
      ]),
      [
        existingUrl("eac_current", "https://example.org/a", true),
        existingUrl("eac_current", "https://example.org/b", true),
      ],
    );
    expect(readIssues(result)).toEqual([{ code: "INVALID_VALUE", path: "externalAccounts.1.isPublic" }]);
  });

  it("1つのJSONアカウントが既存の複数行に当たる場合を不備にする", () => {
    const result = planBackupRestore(
      createBackup([
        createAccount([{ type: "url", url: "https://example.org/a" }, { type: "url", url: "https://example.org/b" }]),
      ]),
      [
        existingUrl("eac_first", "https://example.org/a", true),
        existingUrl("eac_second", "https://example.org/b", false),
      ],
    );
    expect(readIssues(result)).toEqual([
      { code: "INVALID_VALUE", path: "externalAccounts.0.metadata.identifiers" },
    ]);
  });

  it("登録できないURLを不備にする", () => {
    const result = planBackupRestore(
      createBackup([createAccount([{ type: "url", url: "https://localhost/about" }])]),
      [],
    );
    expect(readIssues(result)).toEqual([
      { code: "INVALID_VALUE", path: "externalAccounts.0.metadata.identifiers.0.url" },
    ]);
  });

  it("本人の現在のURLと重複を除いて150件までを受け付け、超えると不備にする", () => {
    const existing = Array.from({ length: 149 }, (_, index) =>
      existingUrl("eac_current", `https://example.org/${index}`, false),
    );
    const backupWith = (urls: string[]) =>
      createBackup([createAccount(urls.map((url) => ({ type: "url", url })))]);

    // 既存と同じURLは数えない。
    expect(readIssues(planBackupRestore(backupWith(["https://example.org/0", "https://example.org/new"]), existing))).toEqual([]);
    expect(
      readIssues(planBackupRestore(backupWith(["https://example.org/new", "https://example.org/new2"]), existing)),
    ).toEqual([{ code: "URL_LIMIT_REACHED", path: null }]);
  });

  it("不備を1件で止めずにまとめて返す", () => {
    const result = planBackupRestore(
      createBackup(
        [
          createAccount([{ type: "url", url: "https://localhost/" }], {
            clientVisibility: [{ clientId: "unknown-client", isPublic: true }],
          }),
        ],
        [pointsConsent, { ...pointsConsent, consented: false }],
      ),
      [],
    );
    expect(readIssues(result).map((issue) => issue.path)).toEqual([
      "clientConsents.1.consented",
      "externalAccounts.0.clientVisibility.0.clientId",
      "externalAccounts.0.metadata.identifiers.0.url",
    ]);
  });
});
