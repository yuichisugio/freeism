export type Bindings = Omit<Env, "DB"> & {
  DB: D1Database;
};

export function requireBindings(env: Env): Bindings {
  if (env.DB === undefined) {
    throw new Error("Points D1 binding DB is required");
  }
  return env as Bindings;
}
