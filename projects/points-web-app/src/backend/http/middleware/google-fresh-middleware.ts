import { createMiddleware } from "hono/factory";

import type { BackendContext } from "../context";
import { requireBindings } from "../context";
import { problem } from "../problem";

const GOOGLE_FRESH_MILLISECONDS = 900_000;

export const googleFreshMiddleware = createMiddleware<BackendContext>(async (context, next) => {
  const { session } = context.get("authSession");
  const sessionAge = Date.now() - session.createdAt.getTime();
  if (!Number.isFinite(sessionAge) || sessionAge < 0 || sessionAge > GOOGLE_FRESH_MILLISECONDS) {
    return problem(context, 401, "FRESH_GOOGLE_AUTH_REQUIRED", "Fresh Google auth required");
  }

  const googleAccount = await requireBindings(context.env)
    .DB.prepare(
      `SELECT account_id AS accountId
     FROM account
     WHERE user_id = ? AND provider_id = 'google'
     ORDER BY created_at DESC
     LIMIT 1`,
    )
    .bind(session.userId)
    .first<{ accountId: string }>();
  if (!googleAccount) {
    return problem(context, 401, "FRESH_GOOGLE_AUTH_REQUIRED", "Fresh Google auth required");
  }

  context.set("googleAccountId", googleAccount.accountId);
  await next();
});
