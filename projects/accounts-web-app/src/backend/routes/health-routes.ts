import { Hono } from "hono";

import type { AppEnv } from "../hono-env";

/**
 * 死活監視用のルート。
 * @see ./health-routes.worker.test.ts
 */
export const healthRoutes = new Hono<AppEnv>().get("/", (c) => c.json({ status: "ok" }));
