import type { Hono } from "hono";

import { createPointsAuth } from "../../auth/create-auth";
import type { BackendContext } from "../context";
import { requireBindings } from "../context";
import { problem } from "../problem";

export function registerAuthRoutes(app: Hono<BackendContext>) {
  app.post("/api/auth/unlink-account", (context) =>
    problem(context, 409, "ACCOUNT_UNLINK_DISABLED", "Physical account unlink is disabled"),
  );
  app.on(["GET", "POST"], "/api/auth/*", (context) =>
    createPointsAuth(requireBindings(context.env)).handler(context.req.raw),
  );
}
