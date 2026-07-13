import { Hono } from "hono";

import { createMarketsAuth } from "./auth/create-auth";
import type { GetSession } from "./auth/require-markets-session";
import type { BackendContext } from "./http/context";
import { registerAuthRoutes } from "./http/routes/auth-routes";
import { registerPointsConnectionRoutes } from "./http/routes/points-connection-routes";
import type { PointsConnectionService } from "./points/points-link-saga";
import type { PointsUnlinkAuthorizationService } from "./points/points-unlink-authorization";

export function createMarketsBackendApp(
  getSession: GetSession = (env, headers) => createMarketsAuth(env).api.getSession({ headers }),
  pointsConnectionService?: PointsConnectionService,
  pointsUnlinkAuthorizationService?: PointsUnlinkAuthorizationService,
) {
  const app = new Hono<BackendContext>();
  registerAuthRoutes(app, getSession);
  registerPointsConnectionRoutes(
    app,
    getSession,
    pointsConnectionService,
    pointsUnlinkAuthorizationService,
  );
  return app;
}

export const marketsBackendApp = createMarketsBackendApp();
