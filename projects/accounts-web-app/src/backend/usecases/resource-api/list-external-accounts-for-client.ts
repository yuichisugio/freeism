import type {
  ExternalAccountListResponse,
  ProvidedExternalAccount,
} from "../../../shared/schemas/resource-api-schema";
import type { ExternalIdentifier } from "../../../shared/schemas/identifier-schema";
import type { Database } from "../../db/database";
import { D1ResourceApiRepository } from "../../db/repositories/d1-resource-api-repository";
import type { ExternalIdentifierRow } from "../../db/repositories/d1-external-account-repository";
import { requestError } from "../../resource-api-response";

/**
 * 一覧取得（`QUERY /api/v1/external-accounts`）。
 * 問い合わせ元へ提供を許可した外部アカウントを、有効な識別子と一度でも成功した証明とともに全件返す。
 * @throws {ResourceApiRequestError} ユーザーが存在しない・banされている・問い合わせ元への同意が無い場合は、同じ内容の404 `NOT_FOUND`。
 * @see ../../../../docs/specification/v0.1/main.ja.md
 * @see ../../routes/resource-api-routes.worker.test.ts
 */
export async function listExternalAccountsForClient(
  deps: { db: Database; accountsOrigin: string },
  input: { clientId: string; accountsUserId: string },
): Promise<ExternalAccountListResponse> {
  const repository = new D1ResourceApiRepository(deps.db);
  if (!(await repository.hasConsentedUser(input.accountsUserId, input.clientId))) {
    throw requestError(404, "NOT_FOUND", "The user was not found.");
  }

  const rows = await repository.findVisibleExternalAccounts(input.accountsUserId, input.clientId);
  const externalAccounts = rows.flatMap((row): ProvidedExternalAccount[] => {
    if (row.externalAccountVisibility.length === 0 || row.externalIdentifiers.length === 0) {
      return [];
    }
    const activeIdentifierIds = new Set(row.externalIdentifiers.map((identifier) => identifier.id));
    return [
      {
        service: row.service,
        displayName: row.displayName,
        identifiers: sortIdentifierRows(row.externalIdentifiers).map(toExternalIdentifier),
        linkedAt: row.linkedAt?.toISOString() ?? null,
        verificationStatus: "verified",
        verifications: row.externalAccountVerifications
          .toSorted((left, right) => methodOrder[left.method] - methodOrder[right.method])
          .map((verification) => ({
            method: verification.method,
            identifiers: sortIdentifierRows(
              verification.verificationIdentifiers
                .map((covered) => covered.identifier)
                .filter((identifier) => activeIdentifierIds.has(identifier.id)),
            ).map(toExternalIdentifier),
            verifiedAt: verification.verifiedAt?.toISOString() ?? null,
            checkedAt: verification.checkedAt.toISOString(),
            result: verification.result,
            evidenceUrl: verification.evidenceUrl,
          })),
      },
    ];
  });

  return {
    accountsOrigin: deps.accountsOrigin,
    accountsUserId: input.accountsUserId,
    externalAccounts,
  };
}

// --------------------------------------------------
// 変換
// --------------------------------------------------

/**
 * 識別子・証明方法の並び順（主仕様の応答例と同じ順）。
 */
const kindOrder = { provider_account: 0, provider_username: 1, url: 2 } as const;
const methodOrder = { oauth: 0, bidirectional_link: 1, dns_txt: 2 } as const;

function sortIdentifierRows(rows: readonly ExternalIdentifierRow[]): ExternalIdentifierRow[] {
  return rows.toSorted(
    (left, right) =>
      kindOrder[left.kind] - kindOrder[right.kind] || left.value.localeCompare(right.value),
  );
}

/**
 * 保存した識別子行を、照合入力と共通の識別子の形にする。
 */
function toExternalIdentifier(row: ExternalIdentifierRow): ExternalIdentifier {
  switch (row.kind) {
    case "url":
      return { type: "url", url: row.value };
    case "provider_account":
      return {
        type: "provider_account",
        provider: row.provider as ExternalIdentifierProvider,
        accountId: row.value,
      };
    case "provider_username":
      return {
        type: "provider_username",
        provider: row.provider as ExternalIdentifierProvider,
        username: row.value,
      };
  }
}

/**
 * Provider識別子行の`provider`は、保存時にProvider表の値だけを受け付けている。
 */
type ExternalIdentifierProvider = Extract<
  ExternalIdentifier,
  { type: "provider_account" }
>["provider"];
