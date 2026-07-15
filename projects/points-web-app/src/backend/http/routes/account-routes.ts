import type { Context, Hono } from "hono";

import { closePointsAccount, ClosePointsAccountError } from "../../usecases/close-points-account";
import {
  previewPointsAccountReopen,
  PointsAccountReopenError,
} from "../../usecases/preview-points-account-reopen";
import { reopenPointsAccount } from "../../usecases/reopen-points-account";
import type { BackendContext } from "../context";
import { requireBindings } from "../context";
import { googleFreshMiddleware } from "../middleware/google-fresh-middleware";
import { idempotencyKeyMiddleware, profileBodyLimit } from "../middleware/idempotency-middleware";
import { createSessionMiddleware, type GetSession } from "../middleware/session-middleware";
import { problem } from "../problem";

function mapCloseError(context: Context<BackendContext>, error: unknown): Response {
  if (!(error instanceof ClosePointsAccountError)) throw error;
  if (error.code === "ACCOUNT_CLOSE_ACTIVE_RESERVATION") {
    return problem(context, 409, error.code, "Active reservation prevents account close");
  }
  if (error.code === "ACCOUNT_CLOSE_LAST_ADMIN") {
    return problem(context, 409, error.code, "The final ADMIN cannot close their account");
  }
  if (error.code === "IDEMPOTENCY_KEY_REUSED") {
    return problem(context, 409, error.code, "Idempotency key reused");
  }
  return problem(context, 409, error.code, "Account cannot be closed");
}

function mapReopenError(context: Context<BackendContext>, error: unknown): Response {
  if (!(error instanceof PointsAccountReopenError)) throw error;
  if (error.code === "IDEMPOTENCY_KEY_REUSED") {
    return problem(context, 409, error.code, "Idempotency key reused");
  }
  if (error.code === "SAFE_INTEGER_OVERFLOW") {
    return problem(context, 409, error.code, "Safe integer overflow");
  }
  if (error.code === "REOPEN_SET_CHANGED") {
    return problem(context, 409, error.code, "Reopen FIX set changed");
  }
  return problem(context, 409, error.code, "Account is not closed");
}

export function registerAccountRoutes(app: Hono<BackendContext>, getSession: GetSession) {
  const session = createSessionMiddleware(getSession);

  app.post(
    "/api/account/close",
    profileBodyLimit,
    session,
    googleFreshMiddleware,
    idempotencyKeyMiddleware,
    async (context) => {
      try {
        const result = await closePointsAccount(requireBindings(context.env).DB, {
          authUserId: context.get("authSession").user.id,
          currentSessionId: context.get("authSession").session.id,
          idempotencyKey: context.req.header("Idempotency-Key")!,
          pointsUserId: context.get("pointsUser").id,
          requestId: `req_${crypto.randomUUID()}`,
        });
        return context.json(result.responseBody as object, result.status as 200);
      } catch (error) {
        return mapCloseError(context, error);
      }
    },
  );

  app.get("/api/account/reopen-preview", session, async (context) => {
    try {
      const data = await previewPointsAccountReopen(
        requireBindings(context.env).DB,
        context.get("pointsUser").id,
      );
      return context.json({ data, meta: { requestId: `req_${crypto.randomUUID()}` } });
    } catch (error) {
      return mapReopenError(context, error);
    }
  });

  app.post(
    "/api/account/reopen",
    profileBodyLimit,
    session,
    googleFreshMiddleware,
    idempotencyKeyMiddleware,
    async (context) => {
      let body: unknown;
      try {
        body = await context.req.json();
      } catch {
        return problem(context, 422, "ACCOUNT_REOPEN_BODY_INVALID", "Invalid reopen body");
      }
      if (
        !body ||
        typeof body !== "object" ||
        Array.isArray(body) ||
        Object.keys(body).length !== 1 ||
        typeof (body as { reopenSetHash?: unknown }).reopenSetHash !== "string" ||
        !/^[a-f0-9]{64}$/.test((body as { reopenSetHash: string }).reopenSetHash)
      ) {
        return problem(
          context,
          422,
          "ACCOUNT_REOPEN_BODY_INVALID",
          "Only reopenSetHash is accepted",
        );
      }
      try {
        const result = await reopenPointsAccount(requireBindings(context.env).DB, {
          authUserId: context.get("authSession").user.id,
          currentSessionId: context.get("authSession").session.id,
          idempotencyKey: context.req.header("Idempotency-Key")!,
          pointsUserId: context.get("pointsUser").id,
          reopenSetHash: (body as { reopenSetHash: string }).reopenSetHash,
          requestId: `req_${crypto.randomUUID()}`,
        });
        return context.json(result.responseBody as object, result.status as 200);
      } catch (error) {
        return mapReopenError(context, error);
      }
    },
  );
}
