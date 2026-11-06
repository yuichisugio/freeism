import { Hono } from "hono";

import { getAuth } from "../auth/auth";
import type { AppEnv } from "../hono-env";

/**
 * Better Authの標準エンドポイント（`/api/auth/*`）。
 * `disabledPaths`で塞いだパスは404になる。
 * @see ../auth/create-auth.ts
 * @see ./auth-routes.worker.test.ts
 */
export const authRoutes = new Hono<AppEnv>().on(["GET", "POST"], "/*", (c) =>
  getAuth().handler(c.req.raw),
);
