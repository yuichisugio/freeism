import type { Bindings } from "../hono-env";
import { createAuth } from "./create-auth";

/**
 * `auth generate`で標準schemaを生成するための設定。
 * CLIは設定の構成だけを読むため、D1とSecretには仮の値を渡し、D1へ接続できない初期化の失敗は無視する。
 * プラグインや設定を変更したら`pnpm auth:generate`で`src/backend/db/schema/auth.ts`を再生成する。
 * @see https://better-auth.com/docs/concepts/cli
 */
export const auth = createAuth(
  {
    APP_ENV: "local",
    ACCOUNTS_ORIGIN: "http://localhost:5173",
    DB: {} as D1Database,
    BETTER_AUTH_SECRETS: "1:auth-cli-placeholder-secret-value-0000",
    GOOGLE_CLIENT_ID: "auth-cli",
    GOOGLE_CLIENT_SECRET: "auth-cli",
    GITHUB_CLIENT_ID: "auth-cli",
    GITHUB_CLIENT_SECRET: "auth-cli",
    ORCID_CLIENT_ID: "auth-cli",
    ORCID_CLIENT_SECRET: "auth-cli",
  } as Bindings,
  { waitUntil: () => {}, purgeProfiles: () => {} },
);

auth.$context.catch(() => undefined);
