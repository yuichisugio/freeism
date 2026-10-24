import type { PointsOAuthPrincipal } from "../auth/resource-token-introspection";
import type { PointsUser } from "../usecases/provision-points-user";

export type Bindings = Omit<Env, "DB"> & {
  DB: D1Database;
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
