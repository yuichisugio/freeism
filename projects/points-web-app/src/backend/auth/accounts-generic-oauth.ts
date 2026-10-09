import { genericOAuth } from "better-auth/plugins";

import { openAccountsClient } from "../accounts/accounts-connection-context";
import { discoverAccounts } from "../accounts/accounts-discovery";
import { decodeBase64Url, encodeBase64Url } from "../accounts/base64url";
import { importAccountsKeyEncryptionKey } from "../accounts/accounts-key-vault";
import { exchangeAccountsCodeForGenericOAuth } from "../accounts/accounts-oauth-client";
import { toAccountsProviderId } from "../accounts/accounts-provider-id";
import { findActiveAccountsConnection } from "../infrastructure/db/d1-accounts-connection-repository";
import { findAccountsLinkAttemptByVerifier } from "../infrastructure/db/d1-accounts-link-repository";

/**
 * AccountsのOIDCプロファイルから、Points内部でのみ使うメール識別子を作る。
 * 実メールは本人対応に利用しない。
 */
async function toInternalEmail(origin: string, sub: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${origin}\n${sub}`),
  );
  return `accounts-${encodeBase64Url(new Uint8Array(digest))}@identity.points.invalid`;
}

function readIdTokenSubject(idToken: string): string | null {
  try {
    const payload = JSON.parse(
      new TextDecoder().decode(decodeBase64Url(idToken.split(".")[1] ?? "")),
    ) as { sub?: unknown };
    return typeof payload.sub === "string" && payload.sub.length > 0 ? payload.sub : null;
  } catch {
    return null;
  }
}

/**
 * 指定されたACTIVE接続先だけを公開Generic OAuth pluginへ登録する。
 * Accounts以外の認証要求で他の接続先のdiscoveryを実行しない。
 */
export function createAccountsGenericOAuthPlugin(
  config: { DB: D1Database; ACCOUNTS_KEY_ENCRYPTION_KEY: string },
  connectionId: string,
) {
  return {
    id: "points-accounts-generic-oauth" as const,
    async init(context: Parameters<ReturnType<typeof genericOAuth>["init"]>[0]): Promise<any> {
      const connection = await findActiveAccountsConnection(config.DB, connectionId);
      if (connection === null) return;
      const client = await openAccountsClient(
        await importAccountsKeyEncryptionKey(config.ACCOUNTS_KEY_ENCRYPTION_KEY),
        { ...connection, connectionId },
      );
      const endpoint = { accountsOrigin: connection.accountsOrigin, fetch: globalThis.fetch };
      const initialized = await genericOAuth({
        config: [
          {
            providerId: toAccountsProviderId(connectionId),
            clientId: connection.clientId,
            discoveryUrl: `${connection.accountsOrigin}/.well-known/openid-configuration`,
            requireIdTokenVerification: true,
            scopes: ["openid"],
            prompt: "consent",
            disableSignUp: true,
            getToken: async ({ code, codeVerifier, redirectURI }) => {
              if (!codeVerifier) throw new Error("Accounts PKCE verifier is missing");
              const attempt = await findAccountsLinkAttemptByVerifier(config.DB, {
                codeVerifier,
                accountsConnectionId: connectionId,
                now: Date.now(),
              });
              if (attempt === null) throw new Error("Accounts link attempt is missing");
              return exchangeAccountsCodeForGenericOAuth(
                {
                  endpoint,
                  authorizationServer: await discoverAccounts(endpoint),
                  client,
                },
                { code, codeVerifier, nonce: attempt.nonce, redirectUri: redirectURI },
              );
            },
            getUserInfo: async ({ idToken }) => {
              if (!idToken) return null;
              const sub = readIdTokenSubject(idToken);
              if (sub === null) return null;
              return {
                sub,
                email: await toInternalEmail(connection.accountsOrigin, sub),
                emailVerified: false,
              };
            },
          },
        ],
      }).init(context);
      return initialized;
    },
  };
}
