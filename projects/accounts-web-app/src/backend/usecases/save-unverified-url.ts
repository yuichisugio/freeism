import type { SaveUnverifiedUrlResult } from "../../shared/schemas/external-url-schema";
import { runBatch, type Database } from "../db/database";
import { D1ExternalAccountRepository } from "../db/repositories/d1-external-account-repository";
import { buildRegistrationIdentifiers, readUrlRegistration } from "./url-registration";

/**
 * 「未検証で保存」。
 * URLの構文・取得先の安全性・サービス判定・登録数の上限だけを検査し、外部通信をせずに`unverified`として登録する。
 * 入力URLが登録済みの場合は、既存の登録・証明・紐付けを変更せずに返す。
 * @see ../../../docs/specification/v0.1/verify-url.ja.md
 * @see ./save-unverified-url.worker.test.ts
 */
export async function saveUnverifiedUrl(
  deps: { db: Database },
  input: { userId: string; url: string },
): Promise<SaveUnverifiedUrlResult> {
  const repository = new D1ExternalAccountRepository(deps.db);
  const registration = await readUrlRegistration(repository, input.userId, input.url);
  if (registration.inputIdentifier !== undefined) {
    return { externalAccountId: registration.externalAccountId, created: false };
  }

  await runBatch(deps.db, [
    repository.upsertExternalAccount({
      id: registration.externalAccountId,
      userId: input.userId,
      service: registration.service,
      displayName: null,
      email: null,
    }),
    ...repository.insertIdentifiers(buildRegistrationIdentifiers(registration, input.userId)),
  ]);

  return { externalAccountId: registration.externalAccountId, created: true };
}
