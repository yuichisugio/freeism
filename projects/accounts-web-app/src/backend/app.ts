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
import { authRoutes } from "./routes/auth-routes";
import { healthRoutes } from "./routes/health-routes";

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

app.use("/api/*", prettyJSON({ force: true }));
// Better Authの認証APIは標準のOrigin検証で保護するため、CSRFミドルウェアの対象から外す。
app.use("/api/*", except("/api/auth/*", csrf()));
app.use("/profiles/*", trimTrailingSlash(), etag());

// --------------------------------------------------
// 機能別ルート
// --------------------------------------------------

// Better Authの標準エンドポイントは認証クライアントから呼ぶため、RPCのルート型に含めない。
app.route("/api/auth", authRoutes);

const routes = app.route("/healthz", healthRoutes);

/**
 * Hono RPCクライアントで使うルート型。
 */
export type AppType = typeof routes;

export default app;
