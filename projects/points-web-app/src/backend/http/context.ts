import type { PointsUser } from "../usecases/provision-points-user";

export type Bindings = Omit<Env, "DB"> & {
  DB: D1Database;
  INITIAL_ADMIN_GOOGLE_ACCOUNT_ID: string;
};

export interface AuthenticatedSession {
  session: {
    createdAt: Date;
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
}

export type BackendContext = {
  Bindings: Env;
  Variables: BackendVariables;
};

export function requireBindings(env: Env): Bindings {
  if (env.DB === undefined) {
    throw new Error("Points D1 binding DB is required");
  }
  return env as Bindings;
}
