import * as v from "valibot";

import {
  backupAccountItemLimit,
  backupClientConsentLimit,
  backupExternalAccountLimit,
} from "../constants";
import { providerIds } from "../providers";
import { externalIdentifierSchema, httpsUrlSchema } from "./identifier-schema";
import { displayNameSchema } from "./profile-schema";
import { verificationMethodSchema, verificationResultSchema, verificationStatusSchema } from "./verification-schema";

/**
 * JSONによるバックアップと移行の形式と、`/api/backup`の応答。
 * すべての階層で定義された項目だけを受け付ける。
 * 同じClient ID・識別子の値の食い違いや、Web URLの上限などの照合はバックエンドが復元前に検査する。
 * @see ../../../docs/specification/v0.1/main.ja.md
 */

// --------------------------------------------------
// JSON形式
// --------------------------------------------------

const timestampSchema = v.pipe(v.string(), v.isoTimestamp());

export const backupVerificationSchema = v.strictObject({
  method: verificationMethodSchema,
  identifiers: v.pipe(v.array(externalIdentifierSchema), v.maxLength(backupAccountItemLimit)),
  verifiedAt: v.nullable(timestampSchema),
  checkedAt: v.nullable(timestampSchema),
  result: verificationResultSchema,
  evidenceUrl: v.nullable(httpsUrlSchema),
});

export const backupAccountMetadataSchema = v.strictObject({
  service: v.nullable(v.picklist(providerIds)),
  displayName: v.nullable(v.string()),
  identifiers: v.pipe(v.array(externalIdentifierSchema), v.minLength(1), v.maxLength(backupAccountItemLimit)),
  linkedAt: v.nullable(timestampSchema),
  verificationStatus: verificationStatusSchema,
  verifications: v.pipe(v.array(backupVerificationSchema), v.maxLength(backupAccountItemLimit)),
});

export const backupClientConsentSchema = v.strictObject({
  clientId: v.pipe(v.string(), v.nonEmpty()),
  displayName: v.string(),
  consented: v.boolean(),
});

export const backupExternalAccountSchema = v.strictObject({
  metadata: backupAccountMetadataSchema,
  isPublic: v.boolean(),
  clientVisibility: v.pipe(
    v.array(
      v.strictObject({
        clientId: v.pipe(v.string(), v.nonEmpty()),
        isPublic: v.boolean(),
      }),
    ),
    v.maxLength(backupClientConsentLimit),
  ),
});

/**
 * バックアップJSON（`schemaVersion: 1`）。
 * `POST /api/backup/restore`の入力で、`GET /api/backup`の出力も同じ形とする。
 */
export const backupSchema = v.strictObject({
  schemaVersion: v.literal(1),
  accountsOrigin: v.pipe(v.string(), v.url()),
  accountsUserId: v.pipe(v.string(), v.nonEmpty()),
  exportedAt: timestampSchema,
  profile: v.strictObject({
    displayName: displayNameSchema,
  }),
  clientConsents: v.pipe(v.array(backupClientConsentSchema), v.maxLength(backupClientConsentLimit)),
  externalAccounts: v.pipe(v.array(backupExternalAccountSchema), v.maxLength(backupExternalAccountLimit)),
});

export type Backup = v.InferInput<typeof backupSchema>;

// --------------------------------------------------
// 応答
// --------------------------------------------------

/**
 * `GET /api/backup/summary`の`data`。
 * 出力前に本人へ示す件数と、非公開の情報（未検証の登録・非公開の設定・情報提供同意）を含むか。
 */
export const backupSummarySchema = v.object({
  externalAccountCount: v.number(),
  unverifiedAccountCount: v.number(),
  clientConsentCount: v.number(),
  includesPrivateData: v.boolean(),
});

/**
 * `POST /api/backup/restore`の`data`。
 * `updatedAccountCount`は既存の行に対応付けて公開設定を戻した件数、`addedCandidateCount`は登録候補として取り込んだ件数。
 */
export const restoreBackupResultSchema = v.object({
  updatedAccountCount: v.number(),
  addedCandidateCount: v.number(),
  clientConsentCount: v.number(),
});

export type BackupSummary = v.InferOutput<typeof backupSummarySchema>;
export type RestoreBackupResult = v.InferOutput<typeof restoreBackupResultSchema>;
