import { openAccountsClient } from "../accounts/accounts-connection-context";
import { discoverAccounts } from "../accounts/accounts-discovery";
import { AccountsClientError, type AccountsClientErrorCode } from "../accounts/accounts-http";
import { exchangeAccountsAuthorizationCode } from "../accounts/accounts-oauth-client";
import { findActiveAccountsConnection } from "../infrastructure/db/d1-accounts-connection-repository";
import {
  consumeAccountsLinkAttempt,
  hashAccountsLinkSecret,
  recordAccountsLinkRejection,
  saveAccountsLink,
} from "../infrastructure/db/d1-accounts-link-repository";
import { AccountsProblemError } from "./accounts-problem-error";
import {
  refreshAccountsLinkSnapshots,
  type AccountsSnapshotDependencies,
} from "./refresh-accounts-link-snapshots";

/**
 * 利用者の「Accountsと連携する」の戻り先の処理。
 * 試行を1回だけ取り出し、認可応答の検査・コード交換・ID Tokenの検証を経て連携を保存する。
 * 認可応答のAccess Tokenは使わず、保存もしない。
 * @see ../../../docs/v0.2/details-ja/profile-setting.md
 * @see ../../../test/worker/accounts-link.worker.test.ts
 */

// --------------------------------------------------
// 失敗の分類
// --------------------------------------------------

/**
 * Accountsとのやり取りの失敗を、戻り先で利用者に示すcodeにする。
 * 利用者の操作・試行に原因がないものは`ACCOUNTS_UNAVAILABLE`にまとめる。
 */
function toCallbackProblem(code: AccountsClientErrorCode): AccountsProblemError {
  switch (code) {
    case "AUTHORIZATION_DENIED":
      return new AccountsProblemError(400, "ACCOUNTS_AUTHORIZATION_DENIED");
    case "AUTHORIZATION_RESPONSE_INVALID":
    case "AUTHORIZATION_CODE_INVALID":
      return new AccountsProblemError(400, "ACCOUNTS_LINK_ATTEMPT_INVALID");
    case "ID_TOKEN_INVALID":
      return new AccountsProblemError(400, "ACCOUNTS_ID_TOKEN_INVALID");
    default:
      return new AccountsProblemError(503, "ACCOUNTS_UNAVAILABLE");
  }
}

// --------------------------------------------------
// 戻り先
// --------------------------------------------------

/**
 * 連携を完了する。
 * 保存した後に一覧を取得してsnapshotを保存するが、取得の失敗は連携の成立を妨げない。
 * @throws {AccountsProblemError} 試行の不正・拒否・ID Tokenの不正・別のPointsユーザーに連携済みなど
 */
export async function completeAccountsLink(
  dependencies: AccountsSnapshotDependencies,
  {
    callbackParameters,
    redirectUri,
    pointsUserId,
    authSessionId,
    requestId,
  }: {
    callbackParameters: URLSearchParams;
    redirectUri: string;
    pointsUserId: string;
    authSessionId: string;
    requestId: string;
  },
): Promise<{ accountsLinkId: string; status: "CREATED" | "RENEWED" }> {
  const { db, kek, fetch, reportFailure } = dependencies;
  const now = (dependencies.now ?? Date.now)();
  const state = callbackParameters.get("state");
  const attempt =
    state === null
      ? null
      : await consumeAccountsLinkAttempt(db, {
          stateHash: await hashAccountsLinkSecret(state),
          pointsUserId,
          authSessionIdHash: await hashAccountsLinkSecret(authSessionId),
          now,
        });
  if (attempt === null) throw new AccountsProblemError(400, "ACCOUNTS_LINK_ATTEMPT_INVALID");

  const connectionId = attempt.accountsConnectionId;
  const connection = await findActiveAccountsConnection(db, connectionId);
  if (connection === null) throw new AccountsProblemError(409, "ACCOUNTS_CONNECTION_NOT_ACTIVE");

  let accountsUserId: string;
  try {
    const endpoint = { accountsOrigin: connection.accountsOrigin, fetch };
    ({ accountsUserId } = await exchangeAccountsAuthorizationCode(
      {
        endpoint,
        authorizationServer: await discoverAccounts(endpoint),
        client: await openAccountsClient(kek, { ...connection, connectionId }),
      },
      {
        callbackParameters,
        redirectUri,
        attempt: { state: state!, nonce: attempt.nonce, codeVerifier: attempt.codeVerifier },
      },
    ));
  } catch (error) {
    if (!(error instanceof AccountsClientError)) throw error;
    const problem = toCallbackProblem(error.code);
    if (problem.code === "ACCOUNTS_ID_TOKEN_INVALID") {
      await recordAccountsLinkRejection(db, {
        pointsUserId,
        accountsConnectionId: connectionId,
        code: problem.code,
        now,
        requestId,
      });
    }
    if (problem.code === "ACCOUNTS_UNAVAILABLE") {
      await reportFailure({ operation: "accounts_link_callback", code: error.code, connectionId });
    }
    throw problem;
  }

  const saved = await saveAccountsLink(db, {
    pointsUserId,
    accountsConnectionId: connectionId,
    accountsOrigin: connection.accountsOrigin,
    accountsUserId,
    now,
    requestId,
  });
  if (saved.status === "LINKED_TO_OTHER_POINTS_USER") {
    const code = "ACCOUNTS_USER_LINKED_TO_OTHER_POINTS_USER";
    await recordAccountsLinkRejection(db, {
      pointsUserId,
      accountsConnectionId: connectionId,
      code,
      now,
      requestId,
    });
    throw new AccountsProblemError(409, code);
  }

  await refreshAccountsLinkSnapshots(dependencies, [
    { id: saved.accountsLinkId, accountsConnectionId: connectionId, accountsUserId },
  ]);
  return saved;
}
