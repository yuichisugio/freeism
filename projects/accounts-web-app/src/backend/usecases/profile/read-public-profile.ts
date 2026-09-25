import type { Database } from "../../db/database";
import { D1PublicProfileRepository } from "../../db/repositories/d1-public-profile-repository";
import type { IdentifierKind } from "../../domain/identity/identifier-key";
import type { VerificationMethod } from "../../domain/identity/verification-method";
import type { VerificationResult } from "../../domain/verification/verification-result";

/**
 * 公開プロフィールに掲載する外部アカウント。
 * 識別子は現在有効なものだけ、証明は成功したことのある方法だけとし、`checkedAt`・`result`は直近の試行を表す。
 */
export type PublicExternalAccount = {
  id: string;
  service: string | null;
  displayName: string | null;
  linkedAt: Date | null;
  identifiers: { kind: IdentifierKind; provider: string; value: string }[];
  verifications: {
    method: VerificationMethod;
    verifiedAt: Date;
    checkedAt: Date;
    result: VerificationResult;
    evidenceUrl: string | null;
  }[];
};

/**
 * 公開プロフィールの内容。
 */
export type PublicProfile = {
  accountsUserId: string;
  displayName: string;
  externalAccounts: PublicExternalAccount[];
};

/**
 * 公開プロフィールの内容をD1から読む。
 * ユーザーが存在しない・banされている場合は`null`を返す。
 * 外部アカウントは本人が一般公開を許可し、有効な識別子を1件以上持つ行だけを返し、0件でもプロフィールを返す。
 * @see ../../../../docs/specification/v0.1/main.ja.md
 * @see ../../routes/public-profile-routes.worker.test.ts
 */
export async function readPublicProfile(
  deps: { db: Database },
  input: { accountsUserId: string },
): Promise<PublicProfile | null> {
  const repository = new D1PublicProfileRepository(deps.db);
  const visibleUser = await repository.findVisibleUser(input.accountsUserId);
  if (visibleUser === undefined) {
    return null;
  }

  const externalAccounts = await repository.findPublicExternalAccounts(visibleUser.id);
  return {
    accountsUserId: visibleUser.id,
    displayName: visibleUser.name,
    externalAccounts: externalAccounts
      .filter((externalAccount) => externalAccount.externalIdentifiers.length > 0)
      .map((externalAccount) => ({
        id: externalAccount.id,
        service: externalAccount.service,
        displayName: externalAccount.displayName,
        linkedAt: externalAccount.linkedAt,
        identifiers: externalAccount.externalIdentifiers,
        verifications: externalAccount.externalAccountVerifications.flatMap(
          ({ verifiedAt, ...verification }) =>
            verifiedAt === null ? [] : [{ ...verification, verifiedAt }],
        ),
      })),
  };
}
