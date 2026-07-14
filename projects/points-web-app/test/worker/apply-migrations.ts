import { applyD1Migrations, env, type D1Migration } from "cloudflare:test";

declare global {
  namespace Cloudflare {
    interface Env {
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}

if (env.DB === undefined) {
  throw new Error("Test D1 binding DB is required");
}

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
