import { Hono } from "hono";
import { except } from "hono/combine";
import { csrf } from "hono/csrf";
import { etag } from "hono/etag";
import { languageDetector } from "hono/language";
import { prettyJSON } from "hono/pretty-json";
import { secureHeaders } from "hono/secure-headers";
import { trimTrailingSlash } from "hono/trailing-slash";

import type { AppEnv } from "./hono-env";
import { basicAuthMiddleware } from "./middleware/basic-auth-middleware";
import { accountLinkRoutes } from "./routes/account-link-routes";
import { authRoutes } from "./routes/auth-routes";
import { backupRoutes } from "./routes/backup-routes";
import { externalAccountRoutes } from "./routes/external-account-routes";
import { externalUrlRoutes } from "./routes/external-url-routes";
import { healthRoutes } from "./routes/health-routes";
import { profileRoutes } from "./routes/profile-routes";
import { oauthClientRoutes } from "./routes/oauth-client-routes";
import { resourceApiRoutes } from "./routes/resource-api-routes";
import { visibilityRoutes } from "./routes/visibility-routes";

/**
 * API・認証・公開プロフィールを処理するHonoアプリ。
 * Workerのエントリーポイントは、このアプリに画面と静的ファイルの配信を加えて公開する。
 * @see ../../docs/implementation-plan/v0.1.md
 */
export const app = new Hono<AppEnv>();

// --------------------------------------------------
// 全体に適用するミドルウェア
// --------------------------------------------------

app.use(secureHeaders());
app.use(
  languageDetector({
    supportedLanguages: ["ja", "en"],
    fallbackLanguage: "ja",
    caches: false,
  }),
);
// Basic認証は画面と静的ファイルだけに適用し、APIと認証プロトコルは各エンドポイントの認証条件に従う。
app.use(except(["/api/*", "/.well-known/*", "/healthz"], basicAuthMiddleware));

// --------------------------------------------------
// パス別のミドルウェア
// --------------------------------------------------

// Better Authの認証APIはリダイレクト（bodyの無い応答）を返すため、整形の対象から外す。
app.use("/api/*", except("/api/auth/*", prettyJSON({ force: true })));
// Better Authの認証APIは標準のOrigin検証、資源APIはクライアント用Access Tokenで保護するため、CSRFミドルウェアの対象から外す。
app.use("/api/*", except(["/api/auth/*", "/api/v1/*"], csrf()));
app.use("/profiles/*", trimTrailingSlash(), etag());

// --------------------------------------------------
// 機能別ルート
// --------------------------------------------------

// Better Authの標準エンドポイントは認証クライアントから呼ぶため、RPCのルート型に含めない。
app.route("/api/auth", authRoutes);
// 資源APIは連携サービスのバックエンドから呼ぶため、RPCのルート型に含めない。
app.route("/api/v1", resourceApiRoutes);

const routes = app
  .route("/healthz", healthRoutes)
  .route("/api", profileRoutes)
  .route("/api/account-links", accountLinkRoutes)
  .route("/api/external-urls", externalUrlRoutes)
  .route("/api/external-accounts", externalAccountRoutes)
  .route("/api/oauth-clients", oauthClientRoutes)
  .route("/api/backup", backupRoutes)
  .route("/api/visibility", visibilityRoutes);

/**
 * Hono RPCクライアントで使うルート型。
 */
export type AppType = typeof routes;

export default app;
