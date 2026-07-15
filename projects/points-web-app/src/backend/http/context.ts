import type { PointsOAuthPrincipal } from "../auth/resource-token-introspection";
import type { PointsUser } from "../usecases/provision-points-user";

export type Bindings = Omit<Env, "DB"> & {
  CSV_EXPORT_CURSOR_SECRET: string;
  DB: D1Database;
  INITIAL_ADMIN_GOOGLE_ACCOUNT_ID: string;
  MARKETS_M2M_OAUTH_CLIENT_ID: string;
  MARKETS_M2M_OAUTH_CLIENT_SECRET: string;
  MARKETS_SETTLEMENT_RETRY_RESOURCE: string;
  MARKETS_SETTLEMENT_OAUTH_CLIENT_ID: string;
  MARKETS_SETTLEMENT_OAUTH_CLIENT_SECRET: string;
  MARKETS_USER_OAUTH_CLIENT_ID: string;
  MARKETS_USER_OAUTH_CLIENT_SECRET: string;
  POINTS_OAUTH_CLIENT_BOOTSTRAP_TOKEN?: string;
  POINTS_OAUTH_PAIRWISE_SECRET: string;
  POINTS_OPS_DRILL_TOKEN?: string;
};

export interface AuthenticatedSession {
  session: {
    createdAt: Date;
    id?: string;
    userId: string;
  };
  user: {
    id: string;
  };
}

export interface BackendVariables {
  authSession: AuthenticatedSession;
  googleAccountId: string;
  pointsUser: PointsUser;
  oauthPrincipal: PointsOAuthPrincipal;
}

export type BackendContext = {
  Bindings: Bindings;
  Variables: BackendVariables;
};

export function requireBindings(env: Env): Bindings {
  if (env.DB === undefined) {
    throw new Error("Points D1 binding DB is required");
  }
  return env as Bindings;
}
