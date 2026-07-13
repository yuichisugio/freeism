import type { Hono } from "hono";

import { createPointsAuth } from "../../auth/create-auth";
import type { BackendContext } from "../context";
import { requireBindings } from "../context";

export function registerAuthRoutes(app: Hono<BackendContext>) {
  app.on(["GET", "POST"], "/api/auth/*", (context) =>
    createPointsAuth(requireBindings(context.env)).handler(context.req.raw),
  );
}
