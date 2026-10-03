import { oauthProviderClient } from "@better-auth/oauth-provider/client";
import { lastLoginMethodClient, multiSessionClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Better Authの画面用クライアント。
 * ログイン・追加連携・同意・退会・セッション切替はBetter Authの標準エンドポイントを直接呼ぶ。
 * `oauthProviderClient`は同意画面・ログイン画面の署名付きクエリを要求へ引き継ぐ。
 * @see https://better-auth.com/docs/concepts/client
 */
export const authClient = createAuthClient({
  basePath: "/api/auth",
  plugins: [oauthProviderClient(), multiSessionClient(), lastLoginMethodClient()],
});
