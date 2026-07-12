import { Hono } from "hono";

import { registerAuthRoutes } from "./http/routes/auth-routes";

export const pointsBackendApp = new Hono<{ Bindings: Env }>();

registerAuthRoutes(pointsBackendApp);
