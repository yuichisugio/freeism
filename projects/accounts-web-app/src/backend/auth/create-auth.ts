import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { i18n } from "@better-auth/i18n";
import { en, ja } from "@better-auth/i18n/locales";
import { oauthProvider } from "@better-auth/oauth-provider";
import type { Account } from "better-auth";
import { generateRandomString } from "better-auth/crypto";
import { betterAuth } from "better-auth/minimal";
import {
  admin,
  genericOAuth,
  jwt,
  lastLoginMethod,
  multiSession,
  oAuthProxy,
  openAPI,
  testUtils,
} from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/admin/access";

import { createDatabase } from "../db/database";
import { createRandomId } from "../db/id";
import * as schema from "../db/schema";
import { isOAuthProviderId } from "../domain/identity/providers";
import type { Bindings } from "../hono-env";
import { auditLog } from "../logging/audit-log";
import { selectProfilePurgeTargets } from "../usecases/profile/select-profile-purge-targets";
import { syncOAuthAccount } from "../usecases/sync-oauth-account";
import { createAuditAfterHook } from "./audit-auth-events";
import { readOAuthProfile, type AuthContext } from "./read-oauth-profile";
import { requireSavedClientConsent } from "./require-saved-client-consent";

/**
 * 新規ユーザーの表示名。
 */
const provisionalUserName = "仮ユーザー";

/**
 * 連携アカウントの一覧取得と識別子の照合に使う、Client Credentials用の読取scope。
 */
export const identitiesReadScope = "identities:read";

/**
 * Accounts資源APIのresource（Access Tokenの`aud`）。
 * @see ../../../docs/specification/v0.1/main.ja.md
 */
export function createResourceApiIdentifier(accountsOrigin: string): string {
  return `${accountsOrigin}/api/v1`;
}

// --------------------------------------------------
// 設定に使う純粋関数
// --------------------------------------------------

/**
 * Better Authの各モデルのIDを生成する。
 * `user.id`は公開IDとOIDCの`sub`に使うため`ausr_`付きの128bit乱数にし、他のモデルはBetter Auth既定と同じ形式にする。
 * @see ../../../docs/specification/v0.1/main.ja.md
 * @see ./create-auth.test.ts
 */
export function generateAuthId({ model, size }: { model: string; size?: number }): string {
  if (model === "user") {
    return createRandomId("ausr_");
  }

  return generateRandomString(size ?? 32, "a-z", "A-Z", "0-9");
}

/**
 * メールアドレスを返さないORCIDのプロフィールから、Better Authの`user.email`に使う内部用の値を作る。
 * @see https://better-auth.com/docs/concepts/oauth#handling-providers-without-email
 * @see ./create-auth.test.ts
 */
export function mapOrcidProfileToUser(profile: {
  sub?: string | number | null;
  [key: string]: unknown;
}) {
  return { email: `${profile.sub}@orcid.invalid`, emailVerified: false };
}

/**
 * `<version>:<secret>`のカンマ区切りを、先頭がcurrentのversioned secretsへ変換する。
 * @see https://better-auth.com/docs/reference/options
 * @see ./create-auth.test.ts
 */
export function parseAuthSecrets(value: string): { version: number; value: string }[] {
  return value.split(",").map((entry) => {
    const separatorIndex = entry.indexOf(":");
    return {
      version: Number(entry.slice(0, separatorIndex).trim()),
      value: entry.slice(separatorIndex + 1).trim(),
    };
  });
}

// --------------------------------------------------
// Adminのロール
// --------------------------------------------------

const accessControl = createAccessControl(defaultStatements);

/**
 * Adminプラグインのロール。
 * `appAdmin`はユーザーの一覧・取得とban・unbanだけを許可し、`user`は権限を持たない。
 * @see ../../../docs/specification/v0.1/main.ja.md
 */
const adminRoles = {
  appAdmin: accessControl.newRole({ user: ["list", "get", "ban"] }),
  user: accessControl.newRole({}),
};

// --------------------------------------------------
// Better Authの構成
// --------------------------------------------------

/**
 * `createAuth`へ渡す実行環境の部品。
 */
export type CreateAuthOptions = {
  /** 応答後に続ける処理をWorkersの`waitUntil`へ渡す。 */
  waitUntil: (promise: Promise<unknown>) => void;
  /** 公開内容が変わったユーザーの公開プロフィールのキャッシュpurgeを依頼する。 */
  purgeProfiles: (accountsUserIds: readonly string[]) => void;
  /** 結合テスト用に`testUtils`プラグインを追加する。 */
  enableTestUtils?: boolean;
};

/**
 * Workersの環境変数とD1からBetter Authを構成する。
 * 主仕様「提供・技術要件」の設定表とプラグイン表に従い、HTTP経路はAccountsのルート経由に限定するパスを`disabledPaths`で塞ぐ。
 * @see ../../../docs/specification/v0.1/main.ja.md
 * @see ../../../docs/implementation-plan/v0.1.md
 * @see ./create-auth.worker.test.ts
 */
export function createAuth(
  env: Bindings,
  { waitUntil, purgeProfiles, enableTestUtils = false }: CreateAuthOptions,
) {
  const db = createDatabase(env.DB);
  const accountsOrigin = env.ACCOUNTS_ORIGIN;
  const resourceApiIdentifier = createResourceApiIdentifier(accountsOrigin);
  // staging・PreviewはPreviewのhostからの要求も受け付ける。
  const previewHosts = env.PREVIEW_HOST_PATTERN ? [env.PREVIEW_HOST_PATTERN] : [];

  /**
   * OAuthの標準`account`の作成・更新後に独自表を同期し、公開内容が変わりうるユーザーの公開プロフィールをpurgeする。
   * 失敗してもログインは継続し、次回のログインでの`account.update.after`で再構成する。
   * エンドポイント外（`testUtils`など）の呼出しでは、フックの第2引数が無いため`auth.$context`を使う。
   */
  const syncAuthAccount = async (
    account: Account,
    endpointContext: { context: AuthContext } | null,
  ) => {
    const { providerId } = account;
    if (!isOAuthProviderId(providerId)) {
      return;
    }

    try {
      // `auth.$context`は設定値で型付けされ、Better Authの汎用の`AuthContext`へ代入できないため変換する。
      const authContext =
        endpointContext?.context ?? ((await auth.$context) as unknown as AuthContext);
      const profile = await readOAuthProfile({ ...account, providerId }, authContext);
      const { affectedUserIds } = await syncOAuthAccount(
        { db, now: new Date() },
        { userId: account.userId, authAccountId: account.id, profile },
      );
      purgeProfiles(
        await selectProfilePurgeTargets(
          { db },
          { actorUserId: account.userId, affectedUserIds },
        ),
      );
      auditLog({ event: "oauth_sync", outcome: "success", method: providerId });
      // 旧所有者がいる場合は、ユーザー名・プロフィールURLの紐付け先を今回の本人へ更新している。
      const previousOwnerCount = affectedUserIds.length - 1;
      if (previousOwnerCount > 0) {
        auditLog({
          event: "identifier_transfer",
          outcome: "success",
          method: "oauth",
          count: previousOwnerCount,
        });
      }
    } catch (error) {
      auditLog({
        event: "oauth_sync",
        outcome: "failure",
        method: providerId,
        errorCategory: error instanceof Error ? error.name : "UnknownError",
      });
    }
  };

  const auth = betterAuth({
    // 許可したhostとfallbackは、Better Authが信頼するoriginにも自動で加わる。
    baseURL: {
      allowedHosts: [new URL(accountsOrigin).host, ...previewHosts],
      fallback: accountsOrigin,
    },
    basePath: "/api/auth",
    secrets: parseAuthSecrets(env.BETTER_AUTH_SECRETS),
    database: drizzleAdapter(db, { provider: "sqlite", schema }),
    socialProviders: {
      google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET },
      github: { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET },
    },
    account: {
      encryptOAuthTokens: true,
      updateAccountOnSignIn: true,
      accountLinking: {
        disableImplicitLinking: true,
        trustedProviders: ["google", "github", "orcid"],
        allowDifferentEmails: true,
        updateUserInfoOnLink: false,
      },
    },
    session: {
      freshAge: 0,
      cookieCache: { enabled: true, strategy: "jwe", maxAge: 3600 },
    },
    user: {
      deleteUser: {
        enabled: true,
        // 本人の独自表・登録OAuthクライアントとそのトークン・同意はCASCADEで同じ削除に含まれる。
        afterDelete: async (deletedUser) => {
          purgeProfiles([deletedUser.id]);
          auditLog({ event: "user_withdrawn", outcome: "success" });
        },
      },
    },
    rateLimit: { enabled: true, storage: "database" },
    // `/token`はOAuth Providerとの併用のため無効にし、残りはAccountsのルート経由の`auth.api`呼出しに限定する。
    disabledPaths: [
      "/token",
      "/oauth2/register",
      "/oauth2/create-client",
      "/oauth2/update-client",
      "/oauth2/delete-client",
      "/unlink-account",
      "/update-user",
    ],
    hooks: {
      before: requireSavedClientConsent(db),
      after: createAuditAfterHook({ purgeProfiles }),
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => ({ data: { ...user, name: provisionalUserName } }),
        },
      },
      account: {
        create: { after: syncAuthAccount },
        update: { after: syncAuthAccount },
      },
    },
    advanced: {
      database: { generateId: generateAuthId, joins: true },
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
      backgroundTasks: { handler: waitUntil },
    },
    plugins: [
      jwt({
        disableSettingJwtHeader: true,
        jwt: { issuer: accountsOrigin },
        jwks: { keyPairConfig: { alg: "EdDSA" } },
      }),
      oauthProvider({
        loginPage: "/",
        consentPage: "/account-links",
        scopes: ["openid", identitiesReadScope],
        // Refresh Tokenを発行しないため、`refresh_token`を除く。
        grantTypes: ["authorization_code", "client_credentials"],
        accessTokenExpiresIn: 900,
        m2mAccessTokenExpiresIn: 900,
        resources: [
          {
            identifier: resourceApiIdentifier,
            name: "Accounts API",
            dpopBoundAccessTokensRequired: true,
          },
        ],
        clientRegistrationDefaultResources: [resourceApiIdentifier],
        // 所有者の確認は標準エンドポイントが行うため、ログイン本人に登録・管理とClient Credentials用scopeの設定を許可する。
        clientPrivileges: ({ session }) => Boolean(session),
      }),
      genericOAuth({
        config: [
          {
            providerId: "orcid",
            discoveryUrl: "https://orcid.org/.well-known/openid-configuration",
            clientId: env.ORCID_CLIENT_ID,
            clientSecret: env.ORCID_CLIENT_SECRET,
            scopes: ["openid"],
            tokenEndpointAuth: { method: "client_secret_post" },
            mapProfileToUser: mapOrcidProfileToUser,
          },
        ],
      }),
      i18n({ translations: { ja, en }, defaultLocale: "ja", detection: ["header"] }),
      lastLoginMethod(),
      multiSession(),
      oAuthProxy({ productionURL: accountsOrigin }),
      openAPI(),
      admin({
        ac: accessControl,
        roles: adminRoles,
        defaultRole: "user",
        adminRoles: ["appAdmin"],
      }),
      ...(enableTestUtils ? [testUtils()] : []),
    ],
  });

  return auth;
}

/**
 * Accountsで使うBetter Authのインスタンス型。
 */
export type Auth = ReturnType<typeof createAuth>;
