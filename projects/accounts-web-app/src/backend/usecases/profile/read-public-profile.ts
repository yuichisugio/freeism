import { verificationMethodSchema } from "../../../shared/schemas/verification-schema";
import type { Database } from "../../db/database";
import { D1PublicProfileRepository } from "../../db/repositories/d1-public-profile-repository";
import type { IdentifierKind } from "../../domain/identity/identifier-key";
import type { VerificationMethod } from "../../domain/identity/verification-method";

/**
 * 公開プロフィールに掲載する外部アカウント。
 * 識別子は現在有効なものだけとし、証明は現在有効な方法（重複なし、OAuth・双方向リンク・DNS TXTの順）と、そのうち最も古い証明日時だけを持つ。
 */
export type PublicExternalAccount = {
  id: string;
  service: string | null;
  identifiers: { kind: IdentifierKind; provider: string; value: string }[];
  methods: VerificationMethod[];
  verifiedAt: Date;
};

/**
 * 公開プロフィールの内容。
 * `displayName`はAccountsユーザーの表示名（外部アカウントの表示名ではない）。
 */
export type PublicProfile = {
  accountsUserId: string;
  displayName: string;
  externalAccounts: PublicExternalAccount[];
};

/**
 * 公開プロフィールの内容をD1から読む。
 * 外部アカウントは、本人が一般公開を許可し、有効な識別子と現在有効な証明を持つ行（証明済みの行）だけを返す。
 * ユーザーが存在しない・banされている・証明済みの行が0件の場合は`null`（存在しないプロフィール）を返す。
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

  const externalAccounts = (await repository.findPublicExternalAccounts(visibleUser.id)).flatMap(
    (externalAccount): PublicExternalAccount[] => {
      const verifiedAts = externalAccount.externalAccountVerifications.flatMap(({ verifiedAt }) =>
        verifiedAt === null ? [] : [verifiedAt.getTime()],
      );
      if (externalAccount.externalIdentifiers.length === 0 || verifiedAts.length === 0) {
        return [];
      }
      const methods = new Set(
        externalAccount.externalAccountVerifications.map(({ method }) => method),
      );
      return [
        {
          id: externalAccount.id,
          service: externalAccount.service,
          identifiers: externalAccount.externalIdentifiers,
          methods: verificationMethodSchema.options.filter((method) => methods.has(method)),
          verifiedAt: new Date(Math.min(...verifiedAts)),
        },
      ];
    },
  );
  return externalAccounts.length === 0
    ? null
    : { accountsUserId: visibleUser.id, displayName: visibleUser.name, externalAccounts };
}
