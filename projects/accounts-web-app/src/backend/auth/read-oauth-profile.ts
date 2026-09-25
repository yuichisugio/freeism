import type { Account } from "better-auth";
import { decryptOAuthToken } from "better-auth/oauth2";

import type { OAuthProviderId } from "../domain/identity/providers";
import type { OAuthProfile } from "../usecases/sync-oauth-account";

/**
 * Better Authの内部コンテキスト。
 */
export type AuthContext = Parameters<typeof decryptOAuthToken>[1];

/**
 * Providerの`getUserInfo`が返す値のうち、同期に使う部分。
 */
type ProviderUserInfo = {
  user: { name?: string | null; email?: string | null };
  data: Record<string, unknown>;
};

/**
 * 文字列の値だけを取り出し、空文字はnullにする。
 */
function readText(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

/**
 * Providerの`getUserInfo`の結果を、同期に使うプロフィールへ変換する。
 * GoogleはID Token、GitHubは`/user`と`/user/emails`、ORCIDはuserinfoの値を使う。
 * ORCIDの`user.email`は`mapProfileToUser`で作った内部用の値のため保存しない。
 * @see ../../../docs/specification/v0.1/main.ja.md
 * @see ./read-oauth-profile.test.ts
 */
export function toOAuthProfile(
  providerId: OAuthProviderId,
  accountId: string,
  userInfo: ProviderUserInfo,
): OAuthProfile {
  switch (providerId) {
    case "google":
      return {
        identity: { providerId, accountId, username: null },
        displayName: readText(userInfo.user.name),
        email: readText(userInfo.user.email),
      };
    case "github":
      return {
        identity: { providerId, accountId, username: readText(userInfo.data.login) },
        displayName: readText(userInfo.user.name),
        email: readText(userInfo.user.email),
      };
    case "orcid": {
      const fullName = [readText(userInfo.data.given_name), readText(userInfo.data.family_name)]
        .filter((name) => name !== null)
        .join(" ");
      return {
        identity: { providerId, accountId, username: null },
        displayName: readText(userInfo.data.name) ?? readText(fullName),
        email: null,
      };
    }
  }
}

/**
 * 標準`account`の保存済みtokenで、Providerから検証済みプロフィールを取得する。
 * GoogleはID Tokenを復号せずにclaimsを読み、GitHub・ORCIDは復号したAccess TokenでProviderのAPIを1回呼ぶ。
 * ORCIDは保存済みID Tokenのnonceを再検証できないため、userinfoだけで取得する。
 * @throws Providerから取得できなかった場合
 */
export async function readOAuthProfile(
  account: Account & { providerId: OAuthProviderId },
  authContext: AuthContext,
): Promise<OAuthProfile> {
  const provider = authContext.socialProviders.find(
    (socialProvider) => socialProvider.id === account.providerId,
  );
  if (!provider) {
    throw new Error(`OAuth provider is not configured: ${account.providerId}`);
  }

  const tokens =
    account.providerId === "google"
      ? { idToken: account.idToken ?? undefined }
      : {
          accessToken: account.accessToken
            ? await decryptOAuthToken(account.accessToken, authContext)
            : undefined,
        };
  const userInfo = await provider.getUserInfo(tokens);
  if (!userInfo) {
    throw new Error(`Failed to read OAuth profile: ${account.providerId}`);
  }

  return toOAuthProfile(account.providerId, account.accountId, {
    user: userInfo.user,
    data: userInfo.data as Record<string, unknown>,
  });
}
