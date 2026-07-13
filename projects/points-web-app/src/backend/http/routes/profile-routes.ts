import type { Hono } from "hono";

import { getProfile, parseProfileUpdateBody, updateProfile } from "../../usecases/update-profile";
import type { BackendContext } from "../context";
import { requireBindings } from "../context";
import { idempotencyKeyMiddleware, profileBodyLimit } from "../middleware/idempotency-middleware";
import { createSessionMiddleware, type GetSession } from "../middleware/session-middleware";
import { problem } from "../problem";

export function registerProfileRoutes(app: Hono<BackendContext>, getSession: GetSession) {
  const sessionMiddleware = createSessionMiddleware(getSession);

  app.get("/api/profile", sessionMiddleware, async (context) => {
    const profile = await getProfile(requireBindings(context.env).DB, context.get("pointsUser").id);
    return context.json({
      data: profile,
      meta: { requestId: `req_${crypto.randomUUID()}` },
    });
  });

  app.put(
    "/api/profile",
    profileBodyLimit,
    sessionMiddleware,
    idempotencyKeyMiddleware,
    async (context) => {
      let rawBody: unknown;
      try {
        rawBody = await context.req.json();
      } catch {
        return problem(context, 400, "INVALID_REQUEST_BODY", "Invalid request body");
      }

      let body;
      try {
        body = parseProfileUpdateBody(rawBody);
      } catch {
        return problem(context, 422, "INVALID_PROFILE", "Invalid profile");
      }

      try {
        const result = await updateProfile(requireBindings(context.env).DB, {
          actorPointsUserId: context.get("pointsUser").id,
          body,
          idempotencyKey: context.req.header("Idempotency-Key")!,
          requestId: `req_${crypto.randomUUID()}`,
        });
        return context.json(result.body, result.status as 200);
      } catch (error) {
        if (error instanceof Error && error.message === "IDEMPOTENCY_KEY_REUSED") {
          return problem(context, 409, error.message, "Idempotency key reused");
        }
        throw error;
      }
    },
  );
}
