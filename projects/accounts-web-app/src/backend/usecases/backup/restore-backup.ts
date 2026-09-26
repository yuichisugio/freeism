import type { Backup, RestoreBackupResult } from "../../../shared/schemas/backup-schema";
import { runBatch, type Database } from "../../db/database";
import { D1BackupRepository } from "../../db/repositories/d1-backup-repository";
import { ProblemError } from "../../problem-details";
import { planBackupRestore } from "./plan-backup-restore";

/**
 * 本人へのJSON復元。
 * 形式（`backupSchema`）を満たすバックアップを本人の現在の登録へ照合し、入力不備が無ければ1回のD1 batchで確定する。
 * 出力元（`accountsOrigin`・`accountsUserId`）が異なるJSONも同じ規則で復元する。
 * @see ../../../../docs/specification/v0.1/main.ja.md
 * @see ./restore-backup.worker.test.ts
 */

/**
 * `restoreBackup`の結果。
 * `affectedUserIds`は公開内容が変わりうるユーザー（本人）で、プロフィールのpurge対象にする。
 */
export type RestoreBackupOutput = RestoreBackupResult & { affectedUserIds: string[] };

/**
 * 表示名・情報提供同意・外部アカウントの一般公開とクライアント別の公開選択を戻し、本人に紐付いていない外部アカウントを登録候補として取り込む。
 * 本人に有効な識別子・証明・連携日時・検証日時は維持し、登録候補の過去の証明情報は現在の証明にしない。
 * バックアップに無い外部アカウント・クライアントの設定は維持する。
 * 追加する識別子はすべて候補（`is_active=0`）のため、有効識別子の部分UNIQUEには当たらない。
 * @throws {ProblemError} 入力不備は400 `INVALID_VALUE`と項目ごとの`errors`（DBは変更しない）。
 */
export async function restoreBackup(
  deps: { db: Database; now: Date },
  input: { userId: string; backup: Backup },
): Promise<RestoreBackupOutput> {
  const repository = new D1BackupRepository(deps.db);
  const planned = planBackupRestore(input.backup, await repository.findIdentifiers(input.userId));
  if (!planned.ok) {
    throw new ProblemError(400, "INVALID_VALUE", planned.issues);
  }

  const { plan } = planned;
  await runBatch(deps.db, [
    ...repository.updateDisplayName(input.userId, plan.displayName, deps.now),
    ...repository.upsertClientConsents(input.userId, plan.clientConsents),
    ...repository.deleteOAuthConsents(
      input.userId,
      plan.clientConsents.filter((consent) => !consent.consented).map((consent) => consent.clientId),
    ),
    ...repository.insertExternalAccounts(input.userId, plan.createdAccounts),
    ...repository.updateExternalAccounts(input.userId, plan.updatedAccounts),
    ...repository.insertIdentifiers(input.userId, plan.identifiers),
    ...repository.upsertVisibility(plan.visibility),
  ]);

  return {
    updatedAccountCount: plan.updatedAccounts.length,
    addedCandidateCount: plan.createdAccounts.length,
    clientConsentCount: plan.clientConsents.length,
    affectedUserIds: [input.userId],
  };
}
