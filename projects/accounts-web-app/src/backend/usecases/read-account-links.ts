import type {
  AccountLinks,
  LatestAttempt,
  LinkedAccount,
  LinkedClient,
  LinkedVerification,
} from "../../shared/schemas/account-link-schema";
import type { Database } from "../db/database";
import { D1ClientConsentRepository } from "../db/repositories/d1-client-consent-repository";
import { D1ExternalAccountRepository } from "../db/repositories/d1-external-account-repository";
import { buildAccountsProfileUrl } from "../domain/verification/accounts-profile-url";

/**
 * 「アカウント連携」画面の本人向け一覧。
 * 外部アカウントごとの表示名・メールアドレス・識別子・成功した証明・未検証の行の直近の試行・公開選択と、公開先の列にするOAuthクライアントを返す。
 * @see ../../../docs/specification/v0.1/main.ja.md
 * @see ./read-account-links.worker.test.ts
 */

type ExternalAccountDetails = Awaited<
  ReturnType<D1ExternalAccountRepository["findOwnExternalAccountDetails"]>
>[number];
type VerificationDetails = ExternalAccountDetails["externalAccountVerifications"][number];

/**
 * 同じ日時の試行を並べる順（同じ要求では、先に確かめるリンクの結果を直近の試行とする）。
 */
const attemptMethodOrder = { bidirectional_link: 0, dns_txt: 1, oauth: 2 } as const;

/**
 * 本人の外部アカウント一覧と、公開先の列にするOAuthクライアントを読む。
 * クライアントは保存済みの有効な提供先と、`consentClientId`で指定した今回の認可要求の連携先とする。
 */
export async function readAccountLinks(
  deps: { db: Database; accountsOrigin: string },
  input: { userId: string; consentClientId?: string },
): Promise<AccountLinks> {
  const accountRepository = new D1ExternalAccountRepository(deps.db);
  const clientRepository = new D1ClientConsentRepository(deps.db);
  const [externalAccounts, linkedClients, consentClient] = await Promise.all([
    accountRepository.findOwnExternalAccountDetails(input.userId),
    clientRepository.findLinkedClients(input.userId),
    input.consentClientId === undefined
      ? undefined
      : clientRepository.findActiveClient(input.consentClientId),
  ]);

  const clients: LinkedClient[] = linkedClients.map((client) => ({
    clientId: client.clientId,
    name: client.name ?? client.clientId,
    uri: client.uri,
    isConsentRequest: client.clientId === consentClient?.clientId,
  }));
  if (
    consentClient !== undefined &&
    !clients.some((client) => client.clientId === consentClient.clientId)
  ) {
    clients.push({
      clientId: consentClient.clientId,
      name: consentClient.name ?? consentClient.clientId,
      uri: consentClient.uri,
      isConsentRequest: true,
    });
  }

  return {
    profileUrl: buildAccountsProfileUrl({
      accountsOrigin: deps.accountsOrigin,
      accountsUserId: input.userId,
    }),
    accounts: externalAccounts.map(toLinkedAccount),
    clients,
  };
}

// --------------------------------------------------
// 変換
// --------------------------------------------------

/**
 * 外部アカウント行を本人向けの応答の形にする。
 * 日時はUTCのRFC 3339文字列、Provider識別子の無いURL行の`provider`は`null`にする。
 */
function toLinkedAccount(externalAccount: ExternalAccountDetails): LinkedAccount {
  const isVerified = externalAccount.externalIdentifiers.some((identifier) => identifier.isActive);
  const identifiers = externalAccount.externalIdentifiers.map((identifier) => ({
    id: identifier.id,
    type: identifier.kind,
    provider: identifier.provider === "" ? null : identifier.provider,
    value: identifier.value,
    isActive: identifier.isActive,
  }));
  const verifications = externalAccount.externalAccountVerifications;
  return {
    id: externalAccount.id,
    service: externalAccount.service,
    displayName: externalAccount.displayName,
    email: externalAccount.email,
    linkedAt: externalAccount.linkedAt?.toISOString() ?? null,
    isPublic: externalAccount.isPublic,
    verificationStatus: isVerified ? "verified" : "unverified",
    identifiers,
    verifications: verifications
      .flatMap(({ verifiedAt, ...verification }) =>
        verifiedAt === null ? [] : [{ ...verification, verifiedAt }],
      )
      .toSorted((left, right) => left.verifiedAt.getTime() - right.verifiedAt.getTime())
      .map((verification) => toLinkedVerification(verification, identifiers)),
    // 証明済みの行は成功した証明だけを示すため、直近の試行を返さない。
    latestAttempt: isVerified ? null : findLatestAttempt(verifications),
    primaryUrl: identifiers.find((identifier) => identifier.type === "url")?.value ?? null,
    visibility: Object.fromEntries(
      externalAccount.externalAccountVisibility.map((visibility) => [
        visibility.clientId,
        visibility.isPublic,
      ]),
    ),
    // 取り込んだ証明情報は再証明待ちの案内に使うため、有効な識別子がある行では示さない。
    hasImportedVerifications: !isVerified && externalAccount.importedVerificationsJson !== null,
  };
}

/**
 * 成功した証明行を、証拠と確認した識別子を持つ形にする。
 */
function toLinkedVerification(
  verification: VerificationDetails & { verifiedAt: Date },
  identifiers: LinkedAccount["identifiers"],
): LinkedVerification {
  const coveredIds = new Set(
    verification.verificationIdentifiers.map((covered) => covered.identifierId),
  );
  return {
    id: verification.id,
    method: verification.method,
    verifiedAt: verification.verifiedAt.toISOString(),
    evidence: toEvidence(verification),
    identifiers: identifiers.filter((identifier) => coveredIds.has(identifier.id)),
  };
}

/**
 * 証明方法ごとの証拠の表示値。
 * DNS TXTの`evidence_key`は正規化hostで、照会したTXTレコード名にして返す。
 */
function toEvidence(verification: VerificationDetails): string | null {
  switch (verification.method) {
    case "oauth":
      return null;
    case "bidirectional_link":
      return verification.evidenceUrl;
    case "dns_txt":
      return `_accounts.${verification.evidenceKey}`;
  }
}

/**
 * 成功していない証明行のうち、直近の試行を選ぶ。
 * 試行が無い場合は`null`を返す。
 */
function findLatestAttempt(verifications: readonly VerificationDetails[]): LatestAttempt | null {
  const [latest] = verifications
    .filter((verification) => verification.verifiedAt === null)
    .toSorted(
      (left, right) =>
        right.checkedAt.getTime() - left.checkedAt.getTime() ||
        attemptMethodOrder[left.method] - attemptMethodOrder[right.method],
    );
  return latest === undefined
    ? null
    : {
        checkedAt: latest.checkedAt.toISOString(),
        result: latest.result,
        failureCode: latest.failureCode,
      };
}
