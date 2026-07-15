import { decryptOAuthToken, setTokenUtil } from "better-auth/oauth2";

import type { createMarketsAuth } from "../auth/create-auth";

type MarketsAuth = ReturnType<typeof createMarketsAuth>;

export interface PointsOAuthTokenSet {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
  refreshTokenExpiresAt?: Date;
  scopes: string[];
}

export interface SavePointsOAuthTokenSet extends PointsOAuthTokenSet {
  accountId: string;
  authUserId: string;
}

export interface PointsOAuthAccount extends PointsOAuthTokenSet {
  accountId: string;
  authUserId: string;
}

export interface PointsTokenStore {
  read(accountId: string): Promise<PointsOAuthAccount>;
  remove(accountId: string): Promise<void>;
  save(tokens: SavePointsOAuthTokenSet): Promise<void>;
  saveAccessToken(input: {
    accessToken: string;
    accessTokenExpiresAt: Date;
    accountId: string;
    authUserId: string;
    scopes: string[];
  }): Promise<void>;
}

export function createBetterAuthPointsTokenStore(auth: MarketsAuth): PointsTokenStore {
  return {
    async read(accountId) {
      const context = await auth.$context;
      const account = await context.internalAdapter.findAccountByProviderId(accountId, "points");
      if (!account?.accessToken || !account.refreshToken) throw new Error("POINTS_TOKEN_NOT_FOUND");
      return {
        accessToken: await decryptOAuthToken(account.accessToken, context),
        accessTokenExpiresAt: account.accessTokenExpiresAt ?? new Date(0),
        accountId,
        authUserId: account.userId,
        refreshToken: await decryptOAuthToken(account.refreshToken, context),
        ...(account.refreshTokenExpiresAt
          ? { refreshTokenExpiresAt: account.refreshTokenExpiresAt }
          : {}),
        scopes: account.scope?.split(" ").filter(Boolean) ?? [],
      };
    },
    async remove(accountId) {
      const context = await auth.$context;
      const account = await context.internalAdapter.findAccountByProviderId(accountId, "points");
      if (account) await context.internalAdapter.deleteAccount(account.id);
    },
    async save(tokens) {
      const context = await auth.$context;
      const existing = await context.internalAdapter.findAccountByProviderId(
        tokens.accountId,
        "points",
      );
      const data = {
        accessToken: await setTokenUtil(tokens.accessToken, context),
        accessTokenExpiresAt: tokens.accessTokenExpiresAt,
        refreshToken: await setTokenUtil(tokens.refreshToken, context),
        refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
        scope: [...new Set(tokens.scopes)].sort().join(" "),
        updatedAt: new Date(),
      };
      if (existing) {
        if (existing.userId !== tokens.authUserId) throw new Error("POINTS_ACCOUNT_CONFLICT");
        await context.internalAdapter.updateAccount(existing.id, data);
        return;
      }
      await context.internalAdapter.createAccount({
        ...data,
        accountId: tokens.accountId,
        providerId: "points",
        userId: tokens.authUserId,
      });
    },
    async saveAccessToken(input) {
      const context = await auth.$context;
      const existing = await context.internalAdapter.findAccountByProviderId(
        input.accountId,
        "points",
      );
      if (!existing || existing.userId !== input.authUserId) {
        throw new Error("POINTS_ACCOUNT_NOT_FOUND");
      }
      await context.internalAdapter.updateAccount(existing.id, {
        accessToken: await setTokenUtil(input.accessToken, context),
        accessTokenExpiresAt: input.accessTokenExpiresAt,
        scope: [...new Set(input.scopes)].sort().join(" "),
        updatedAt: new Date(),
      });
    },
  };
}
