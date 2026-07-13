export type Bindings = Omit<Env, "DB"> & {
  APP_ORIGIN: string;
  BETTER_AUTH_SECRETS: string;
  DB: D1Database;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  POINTS_AUDIENCE: string;
  POINTS_ISSUER: string;
  POINTS_M2M_CLIENT_ID: string;
  POINTS_M2M_CLIENT_SECRET: string;
  POINTS_SERVICE: Fetcher;
  POINTS_SETTLEMENT_CLIENT_ID: string;
  POINTS_SETTLEMENT_CLIENT_SECRET: string;
  POINTS_USER_CLIENT_ID: string;
  POINTS_USER_CLIENT_SECRET: string;
};

export interface AuthenticatedSession {
  session: { id?: string; userId: string };
  user: { id: string };
}

export interface MarketsActor {
  accountId: string;
  marketsUserId: string;
  providerId: "google";
}

export type BackendContext = {
  Bindings: Bindings;
  Variables: { actor: MarketsActor; authSession: AuthenticatedSession };
};

export function requireBindings(env: Env): Bindings {
  if (env.DB === undefined) throw new Error("Markets D1 binding DB is required");
  return env as Bindings;
}
