import { jsonFileMaxBytes } from "../../../shared/constants";
import type { ProviderId } from "../../../shared/providers";
import type { Backup, BackupSummary } from "../../../shared/schemas/backup-schema";
import type { Database } from "../../db/database";
import { D1BackupRepository } from "../../db/repositories/d1-backup-repository";
import { D1ExternalAccountRepository } from "../../db/repositories/d1-external-account-repository";
import { ProblemError } from "../../problem-details";
import { toBackupIdentifier } from "./backup-identifier";

/**
 * JSON出力と、出力前に本人へ示す内容の確認。
 * 対象は件数に上限があり小さいため、メモリ上で組み立ててから容量を確認して返す。
 * メールアドレス・token・セッション・Client Secret・鍵・URL検証のHTML本文と、復元で取り込んだ過去の証明情報は含めない。
 * @see ../../../../docs/specification/v0.1/main.ja.md
 * @see ./export-backup.test.ts
 * @see ../../routes/backup-routes.worker.test.ts
 */

type ExportBackupDeps = { db: Database; accountsOrigin: string; now: Date };

// --------------------------------------------------
// ユースケース
// --------------------------------------------------

/**
 * 本人のバックアップJSONを、ダウンロードするファイル名とともに返す。
 * @throws {ProblemError} 直列化した内容が5MiBを超える場合は413 `EXPORT_TOO_LARGE`。
 */
export async function exportBackup(
  deps: ExportBackupDeps,
  input: { userId: string },
): Promise<{ fileName: string; json: string }> {
  const backup = await buildBackup(deps, input);
  return {
    fileName: `accounts-backup-${deps.now.toISOString().slice(0, 10)}.json`,
    json: serializeBackup(backup),
  };
}

/**
 * 出力前に示す件数と、非公開の情報（未検証の登録・非公開の設定・情報提供同意）を含むかを返す。
 */
export async function readBackupSummary(
  deps: ExportBackupDeps,
  input: { userId: string },
): Promise<BackupSummary> {
  const backup = await buildBackup(deps, input);
  const unverifiedAccountCount = backup.externalAccounts.filter(
    (account) => account.metadata.verificationStatus === "unverified",
  ).length;
  return {
    externalAccountCount: backup.externalAccounts.length,
    unverifiedAccountCount,
    clientConsentCount: backup.clientConsents.length,
    includesPrivateData:
      unverifiedAccountCount > 0 ||
      backup.clientConsents.length > 0 ||
      backup.externalAccounts.some((account) => !account.isPublic),
  };
}

// --------------------------------------------------
// 組立て
// --------------------------------------------------

/**
 * バックアップJSONを整形して直列化する。
 * @throws {ProblemError} UTF-8のbyte数が5MiBを超える場合は413 `EXPORT_TOO_LARGE`。
 */
export function serializeBackup(backup: Backup): string {
  const json = JSON.stringify(backup, null, 2);
  if (new TextEncoder().encode(json).length > jsonFileMaxBytes) {
    throw new ProblemError(413, "EXPORT_TOO_LARGE");
  }
  return json;
}

/**
 * 本人の表示名・全外部アカウント（候補を含む）・全情報提供同意からバックアップJSONを組み立てる。
 * `verifications`は現在の証明行から作り、`clientVisibility`は`clientConsents`の各Client IDを網羅する（設定行が無ければ`false`）。
 */
async function buildBackup(deps: ExportBackupDeps, input: { userId: string }): Promise<Backup> {
  const backupRepository = new D1BackupRepository(deps.db);
  const [displayName, clientConsents, externalAccounts] = await Promise.all([
    backupRepository.findDisplayName(input.userId),
    backupRepository.findClientConsents(input.userId),
    new D1ExternalAccountRepository(deps.db).findOwnExternalAccountDetails(input.userId),
  ]);

  return {
    schemaVersion: 1,
    accountsOrigin: deps.accountsOrigin,
    accountsUserId: input.userId,
    exportedAt: deps.now.toISOString(),
    profile: { displayName },
    clientConsents,
    externalAccounts: externalAccounts.map((externalAccount) => {
      const identifierById = new Map(
        externalAccount.externalIdentifiers.map((identifier) => [
          identifier.id,
          toBackupIdentifier(identifier),
        ]),
      );
      const visibilityByClientId = new Map(
        externalAccount.externalAccountVisibility.map((visibility) => [
          visibility.clientId,
          visibility.isPublic,
        ]),
      );
      return {
        metadata: {
          // 外部アカウント行の`service`は、保存時に判定したProvider表の値である。
          service: externalAccount.service as ProviderId | null,
          displayName: externalAccount.displayName,
          identifiers: [...identifierById.values()],
          linkedAt: externalAccount.linkedAt?.toISOString() ?? null,
          verificationStatus: externalAccount.externalIdentifiers.some(
            (identifier) => identifier.isActive,
          )
            ? "verified"
            : "unverified",
          verifications: externalAccount.externalAccountVerifications.map((verification) => ({
            method: verification.method,
            identifiers: verification.verificationIdentifiers.flatMap(
              (covered) => identifierById.get(covered.identifierId) ?? [],
            ),
            verifiedAt: verification.verifiedAt?.toISOString() ?? null,
            checkedAt: verification.checkedAt.toISOString(),
            result: verification.result,
            evidenceUrl: verification.evidenceUrl,
          })),
        },
        isPublic: externalAccount.isPublic,
        clientVisibility: clientConsents.map((consent) => ({
          clientId: consent.clientId,
          isPublic: visibilityByClientId.get(consent.clientId) ?? false,
        })),
      };
    }),
  };
}
