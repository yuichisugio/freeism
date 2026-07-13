import { createMiddleware } from "hono/factory";

import { provisionPointsUser } from "../../usecases/provision-points-user";
import type { AuthenticatedSession, BackendContext, Bindings } from "../context";
import { requireBindings } from "../context";
import { problem } from "../problem";

export type GetSession = (env: Bindings, headers: Headers) => Promise<AuthenticatedSession | null>;

export function createSessionMiddleware(getSession: GetSession) {
  return createMiddleware<BackendContext>(async (context, next) => {
    const env = requireBindings(context.env);
    const authSession = await getSession(env, context.req.raw.headers);
    if (!authSession) {
      return problem(context, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
    }

    const pointsUser = await provisionPointsUser(env.DB, authSession.session.userId);
    const isReopenRoute =
      (context.req.method === "GET" && context.req.path === "/api/account/reopen-preview") ||
      (context.req.method === "POST" && context.req.path === "/api/account/reopen");
    if (pointsUser.accountStatus === "CLOSED" && !isReopenRoute) {
      return problem(context, 403, "ACCOUNT_CLOSED", "Account is closed");
    }
    context.set("authSession", authSession);
    context.set("pointsUser", pointsUser);
    await next();
  });
}
