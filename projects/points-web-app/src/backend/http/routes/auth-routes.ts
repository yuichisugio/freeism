import type { Hono } from "hono";

import { createPointsAuth } from "../../auth/create-auth";
import { requireBindings } from "../context";

export function registerAuthRoutes(app: Hono<{ Bindings: Env }>) {
  app.on(["GET", "POST"], "/api/auth/*", (context) =>
    createPointsAuth(requireBindings(context.env)).handler(context.req.raw),
  );
}
