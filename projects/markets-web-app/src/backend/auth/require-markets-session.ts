import type { Context } from "hono";

import { provisionMarketsUser } from "../usecases/provision-markets-user";
import type { AuthenticatedSession, BackendContext, MarketsActor } from "../http/context";
import { requireBindings } from "../http/context";

export type GetSession = (
  env: ReturnType<typeof requireBindings>,
  headers: Headers,
) => Promise<AuthenticatedSession | null>;

export async function requireMarketsSession(
  context: Context<BackendContext>,
  getSession: GetSession,
): Promise<MarketsActor | null> {
  const env = requireBindings(context.env);
  const session = await getSession(env, context.req.raw.headers);
  if (!session) return null;
  const marketsUser = await provisionMarketsUser(env.DB, session.session.userId);
  const google = await env.DB.prepare(
    `SELECT account_id AS accountId FROM account
     WHERE user_id = ? AND provider_id = 'google'
     ORDER BY created_at LIMIT 1`,
  )
    .bind(session.session.userId)
    .first<{ accountId: string }>();
  if (!google) return null;
  const actor: MarketsActor = {
    accountId: google.accountId,
    marketsUserId: marketsUser.id,
    providerId: "google",
  };
  context.set("authSession", session);
  context.set("actor", actor);
  return actor;
}
