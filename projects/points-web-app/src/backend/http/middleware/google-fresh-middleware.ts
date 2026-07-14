import { createMiddleware } from "hono/factory";

import type { BackendContext } from "../context";
import { requireBindings } from "../context";
import { problem } from "../problem";

const GOOGLE_FRESH_MILLISECONDS = 900_000;

export async function findFreshGoogleAccountId(
  env: Env,
  session: { createdAt: Date; userId: string },
): Promise<string | null> {
  const sessionAge = Date.now() - session.createdAt.getTime();
  if (!Number.isFinite(sessionAge) || sessionAge < 0 || sessionAge > GOOGLE_FRESH_MILLISECONDS) {
    return null;
  }

  const googleAccount = await requireBindings(env)
    .DB.prepare(
      `SELECT account_id AS accountId
       FROM account
       WHERE user_id = ? AND provider_id = 'google'
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .bind(session.userId)
    .first<{ accountId: string }>();
  return googleAccount?.accountId ?? null;
}

export const googleFreshMiddleware = createMiddleware<BackendContext>(async (context, next) => {
  const { session } = context.get("authSession");
  const googleAccountId = await findFreshGoogleAccountId(context.env, session);
  if (!googleAccountId) {
    return problem(context, 401, "FRESH_GOOGLE_AUTH_REQUIRED", "Fresh Google auth required");
  }

  context.set("googleAccountId", googleAccountId);
  await next();
});
