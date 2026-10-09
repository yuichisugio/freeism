import type { Context } from "hono";

import type { BackendContext } from "../http/context";
import { requireBindings } from "../http/context";
import { provisionMarketsUser } from "../usecases/provision-markets-user";
import type { GetSession } from "./require-markets-session";

export async function requireMarketsAdmin(
  context: Context<BackendContext>,
  getSession: GetSession,
): Promise<{ authUserId: string; marketsUserId: string } | null> {
  const env = requireBindings(context.env);
  const session = await getSession(env, context.req.raw.headers);
  if (!session) return null;
  if (!session.user.role?.split(",").includes("admin")) {
    throw new Error("MARKETS_ADMIN_REQUIRED");
  }
  const marketsUser = await provisionMarketsUser(env.DB, session.user.id);
  context.set("authSession", session);
  return { authUserId: session.user.id, marketsUserId: marketsUser.id };
}
