import { Hono } from "hono";

import { createMarketsAuth } from "./auth/create-auth";
import type { GetSession } from "./auth/require-markets-session";
import type { BackendContext } from "./http/context";
import { createIdempotencyMiddleware } from "./http/middleware/idempotency-middleware";
import {
  jsonMutationBodyLimit,
  requestSecurityMiddleware,
} from "./http/middleware/request-security-middleware";
import { registerAuthRoutes } from "./http/routes/auth-routes";
import { registerAuctionEventRoutes } from "./http/routes/auction-event-routes";
import { registerAuctionCommandRoutes } from "./http/routes/auction-command-routes";
import { registerAuctionImportRoutes } from "./http/routes/auction-import-routes";
import { registerAuctionManagementRoutes } from "./http/routes/auction-management-routes";
import { registerPointsConnectionRoutes } from "./http/routes/points-connection-routes";
import type { PointsConnectionService } from "./points/points-link-saga";
import type { PointsUnlinkAuthorizationService } from "./points/points-unlink-authorization";

export function createMarketsBackendApp(
  getSession: GetSession = (env, headers) => createMarketsAuth(env).api.getSession({ headers }),
  pointsConnectionService?: PointsConnectionService,
  pointsUnlinkAuthorizationService?: PointsUnlinkAuthorizationService,
) {
  const app = new Hono<BackendContext>();
  app.use(
    "/api/points-connection/confirm",
    jsonMutationBodyLimit,
    requestSecurityMiddleware,
    createIdempotencyMiddleware(getSession, "points-connection-confirm"),
  );
  app.use("/api/auctions/:auctionId/bids", jsonMutationBodyLimit, requestSecurityMiddleware);
  app.use("/api/auctions/:auctionId/auto-bid", jsonMutationBodyLimit, requestSecurityMiddleware);
  app.use("/api/auctions/:auctionId/buy-now", jsonMutationBodyLimit, requestSecurityMiddleware);
  registerAuthRoutes(app, getSession);
  registerAuctionCommandRoutes(app, getSession);
  registerAuctionEventRoutes(app, getSession);
  registerAuctionImportRoutes(app, getSession);
  registerAuctionManagementRoutes(app, getSession);
  registerPointsConnectionRoutes(
    app,
    getSession,
    pointsConnectionService,
    pointsUnlinkAuthorizationService,
  );
  return app;
}

export const marketsBackendApp = createMarketsBackendApp();
