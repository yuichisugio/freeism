import { Hono } from "hono";

import type { AppEnv } from "../hono-env";
import { createResourceApiOpenApiDocument } from "../openapi/resource-api-openapi-document";

/**
 * Accounts資源APIのOpenAPI文書（`GET /api/v1/openapi.json`）。
 * 連携サービスの開発者が参照する公開の契約のため、認証を求めない。
 * @see ../openapi/resource-api-openapi-document.ts
 * @see ./openapi-routes.worker.test.ts
 */
export const openApiRoutes = new Hono<AppEnv>().get("/", (c) =>
  c.json(createResourceApiOpenApiDocument(c.env.ACCOUNTS_ORIGIN)),
);
