import type {
  AccountLinks,
  LinkedAccount,
  LinkedClient,
} from "../../shared/schemas/account-link-schema";
import type { Database } from "../db/database";
import { D1ClientConsentRepository } from "../db/repositories/d1-client-consent-repository";
import { D1ExternalAccountRepository } from "../db/repositories/d1-external-account-repository";
import { buildAccountsProfileUrl } from "../domain/verification/accounts-profile-url";

/**
 * 「アカウント連携」画面の本人向け一覧。
 * 外部アカウントごとの表示名・メールアドレス・識別子・方法別の証明・公開選択と、公開先の列にするOAuthクライアントを返す。
 * @see ../../../docs/specification/v0.1/main.ja.md
 * @see ./read-account-links.worker.test.ts
 */

type ExternalAccountDetails = Awaited<
  ReturnType<D1ExternalAccountRepository["findOwnExternalAccountDetails"]>
>[number];

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
    consented: client.consented,
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
      consented: false,
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

/**
 * 外部アカウント行を本人向けの応答の形にする。
 * 日時はUTCのRFC 3339文字列、Provider識別子の無いURL行の`provider`は`null`にする。
 */
function toLinkedAccount(externalAccount: ExternalAccountDetails): LinkedAccount {
  return {
    id: externalAccount.id,
    service: externalAccount.service,
    displayName: externalAccount.displayName,
    email: externalAccount.email,
    linkedAt: externalAccount.linkedAt?.toISOString() ?? null,
    isPublic: externalAccount.isPublic,
    verificationStatus: externalAccount.externalIdentifiers.some(
      (identifier) => identifier.isActive,
    )
      ? "verified"
      : "unverified",
    identifiers: externalAccount.externalIdentifiers.map((identifier) => ({
      id: identifier.id,
      type: identifier.kind,
      provider: identifier.provider === "" ? null : identifier.provider,
      value: identifier.value,
      isActive: identifier.isActive,
    })),
    verifications: externalAccount.externalAccountVerifications.map((verification) => ({
      id: verification.id,
      method: verification.method,
      authAccountId: verification.authAccountId,
      evidenceUrl: verification.evidenceUrl,
      verifiedAt: verification.verifiedAt?.toISOString() ?? null,
      checkedAt: verification.checkedAt.toISOString(),
      result: verification.result,
      failureCode: verification.failureCode,
      identifierIds: verification.verificationIdentifiers.map((covered) => covered.identifierId),
    })),
    visibility: Object.fromEntries(
      externalAccount.externalAccountVisibility.map((visibility) => [
        visibility.clientId,
        visibility.isPublic,
      ]),
    ),
    hasImportedVerifications: externalAccount.importedVerificationsJson !== null,
  };
}
