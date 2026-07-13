export type Bindings = Omit<Env, "DB"> & {
  DB: D1Database;
  INITIAL_ADMIN_GOOGLE_ACCOUNT_ID: string;
};

export function requireBindings(env: Env): Bindings {
  if (env.DB === undefined) {
    throw new Error("Points D1 binding DB is required");
  }
  return env as Bindings;
}
