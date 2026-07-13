import { Hono } from "hono";

import { createMarketsAuth } from "./auth/create-auth";
import type { GetSession } from "./auth/require-markets-session";
import type { BackendContext } from "./http/context";
import { registerAuthRoutes } from "./http/routes/auth-routes";

export function createMarketsBackendApp(
  getSession: GetSession = (env, headers) => createMarketsAuth(env).api.getSession({ headers }),
) {
  const app = new Hono<BackendContext>();
  registerAuthRoutes(app, getSession);
  return app;
}

export const marketsBackendApp = createMarketsBackendApp();
