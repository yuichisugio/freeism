import type { VisibilityInput } from "../../../shared/schemas/visibility-schema";
import { runBatch, type Database } from "../../db/database";
import { D1VisibilityRepository } from "../../db/repositories/d1-visibility-repository";
import { findClientsLackingVerifiedSelection } from "../../domain/visibility/find-clients-lacking-verified-selection";
import { ProblemError } from "../../problem-details";
import type { ProblemIssue } from "../../../shared/schemas/problem-details-schema";

/**
 * 「アカウント連携」画面全体の「保存」。
 * 一般公開・各OAuthクライアントへの情報提供同意・外部アカウント別の公開選択を、条件を満たす場合だけ1回のD1 batchで保存する。
 * @throws {ProblemError} 本人の行でない外部アカウント・有効でないクライアントは400 `INVALID_VALUE`、同意ONで証明済みの選択が無いクライアントがある場合は400 `CONSENT_REQUIRES_VERIFIED_ACCOUNT`（`errors[].path`は`["clients", i]`）。
 * @returns 公開プロフィールの再生成（purge）が必要なユーザー。一般公開を変えた場合だけ本人を含む。
 * @see ../../../../docs/specification/v0.1/main.ja.md
 * @see ../../routes/visibility-routes.worker.test.ts
 */
export async function saveVisibilitySettings(
  deps: { db: Database },
  input: { userId: string; settings: VisibilityInput },
): Promise<{ affectedUserIds: string[] }> {
  const { userId, settings } = input;
  const repository = new D1VisibilityRepository(deps.db);
  const [accountStates, activeClients] = await Promise.all([
    repository.findOwnAccountStates(userId),
    repository.findActiveClients(settings.clients.map((client) => client.clientId)),
  ]);

  // --------------------------------------------------
  // 検査
  // --------------------------------------------------

  const ownAccounts = new Map(accountStates.map((state) => [state.id, state]));
  const clientNames = new Map(activeClients.map((client) => [client.clientId, client.name]));
  const invalidIssues: ProblemIssue[] = [
    ...settings.accounts.flatMap((account, index) =>
      ownAccounts.has(account.externalAccountId)
        ? []
        : [
            invalidValue("externalAccountId is not your external account.", [
              "accounts",
              index,
              "externalAccountId",
            ]),
          ],
    ),
    ...settings.clients.flatMap((client, index) => [
      ...(clientNames.has(client.clientId)
        ? []
        : [
            invalidValue("clientId is not an active OAuth client.", ["clients", index, "clientId"]),
          ]),
      ...client.visibleAccountIds.flatMap((accountId, accountIndex) =>
        ownAccounts.has(accountId)
          ? []
          : [
              invalidValue("visibleAccountIds must contain your external accounts.", [
                "clients",
                index,
                "visibleAccountIds",
                accountIndex,
              ]),
            ],
      ),
    ]),
  ];
  if (invalidIssues.length > 0) {
    throw new ProblemError(400, "INVALID_VALUE", invalidIssues);
  }

  const verifiedAccountIds = new Set(
    accountStates.filter((state) => state.isVerified).map((state) => state.id),
  );
  const lackingIndexes = findClientsLackingVerifiedSelection(settings.clients, verifiedAccountIds);
  if (lackingIndexes.length > 0) {
    throw new ProblemError(
      400,
      "CONSENT_REQUIRES_VERIFIED_ACCOUNT",
      lackingIndexes.map((index) => ({
        code: "CONSENT_REQUIRES_VERIFIED_ACCOUNT",
        message: "A consented client needs at least one selected verified external account.",
        path: ["clients", index],
      })),
    );
  }

  // --------------------------------------------------
  // 保存
  // --------------------------------------------------

  const clientIds = settings.clients.map((client) => client.clientId);
  const selections = settings.clients.flatMap((client) =>
    [...new Set(client.visibleAccountIds)].map((accountId) => ({
      accountId,
      clientId: client.clientId,
    })),
  );
  const withdrawnClientIds = settings.clients
    .filter((client) => !client.consented)
    .map((client) => client.clientId);

  await runBatch(deps.db, [
    ...repository.updateAccountPublic(userId, {
      publicIds: settings.accounts
        .filter((account) => account.isPublic)
        .map((account) => account.externalAccountId),
      privateIds: settings.accounts
        .filter((account) => !account.isPublic)
        .map((account) => account.externalAccountId),
    }),
    repository.upsertClientConsents(
      userId,
      settings.clients.map((client) => ({
        clientId: client.clientId,
        displayName: clientNames.get(client.clientId) ?? client.clientId,
        consented: client.consented,
      })),
    ),
    ...repository.replaceClientVisibility(userId, clientIds, selections),
    repository.deleteOAuthConsents(userId, withdrawnClientIds),
  ]);

  const isPublicChanged = settings.accounts.some(
    (account) => ownAccounts.get(account.externalAccountId)?.isPublic !== account.isPublic,
  );
  return { affectedUserIds: isPublicChanged ? [userId] : [] };
}

/**
 * 入力値が条件を満たさない不備1件を作る。
 */
function invalidValue(message: string, path: (string | number)[]): ProblemIssue {
  return { code: "INVALID_VALUE", message, path };
}
