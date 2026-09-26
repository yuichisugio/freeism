import { discoverAccounts } from "../accounts/accounts-discovery";
import type { AccountsFailureReporter } from "../accounts/accounts-failure-reporter";
import { AccountsClientError } from "../accounts/accounts-http";
import { createAccountsAuthorizationRequest } from "../accounts/accounts-oauth-client";
import { findActiveAccountsConnection } from "../infrastructure/db/d1-accounts-connection-repository";
import {
  hashAccountsLinkSecret,
  insertAccountsLinkAttempt,
} from "../infrastructure/db/d1-accounts-link-repository";
import { consumePointsRateLimit } from "../security/rate-limit";
import { AccountsProblemError } from "./accounts-problem-error";

/**
 * 利用者の「Accountsと連携する」の開始。
 * state・nonce・code verifierを試行として保存し、同意画面を毎回表示する認可URLを返す。
 * @see ../../../docs/v0.2/details-ja/profile-setting.md
 * @see ../../../test/worker/accounts-link.worker.test.ts
 */

// --------------------------------------------------
// 開始
// --------------------------------------------------

/**
 * 連携を開始し、Accountsの認可URLを返す。
 * 利用者ごとに1時間10回までとする。
 */
export async function startAccountsLink({
  db,
  fetch,
  reportFailure,
  redirectUri,
  pointsUserId,
  authSessionId,
  accountsConnectionId,
  now = Date.now(),
}: {
  db: D1Database;
  fetch: typeof globalThis.fetch;
  reportFailure: AccountsFailureReporter;
  redirectUri: string;
  pointsUserId: string;
  authSessionId: string;
  accountsConnectionId: string;
  now?: number;
}): Promise<{ authorizationUrl: string }> {
  const rateLimit = await consumePointsRateLimit({
    db,
    now,
    operation: "ACCOUNTS_LINK_START_HOURLY",
    subjectParts: [pointsUserId],
  });
  if (!rateLimit.allowed) {
    throw new AccountsProblemError(429, "ACCOUNTS_LINK_RATE_LIMITED", rateLimit.retryAfterSeconds);
  }

  const connection = await findActiveAccountsConnection(db, accountsConnectionId);
  if (connection === null) throw new AccountsProblemError(409, "ACCOUNTS_CONNECTION_NOT_ACTIVE");

  let authorizationServer;
  try {
    authorizationServer = await discoverAccounts({
      accountsOrigin: connection.accountsOrigin,
      fetch,
    });
  } catch (error) {
    if (!(error instanceof AccountsClientError)) throw error;
    await reportFailure({
      operation: "accounts_discovery",
      code: error.code,
      connectionId: connection.id,
    });
    throw new AccountsProblemError(503, "ACCOUNTS_UNAVAILABLE");
  }

  const { authorizationUrl, attempt } = await createAccountsAuthorizationRequest(
    authorizationServer,
    { clientId: connection.clientId, redirectUri },
  );
  await insertAccountsLinkAttempt(db, {
    stateHash: await hashAccountsLinkSecret(attempt.state),
    pointsUserId,
    authSessionIdHash: await hashAccountsLinkSecret(authSessionId),
    accountsConnectionId: connection.id,
    nonce: attempt.nonce,
    codeVerifier: attempt.codeVerifier,
    createdAt: now,
  });
  return { authorizationUrl };
}
