import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth/minimal";
import { drizzle } from "drizzle-orm/d1";

import * as schema from "../infrastructure/db/schema";
import type { Bindings } from "../http/context";
import { createPointsAuthOptions } from "./auth-options";

export function createPointsAuth(env: Bindings) {
  const database = drizzleAdapter(drizzle(env.DB, { schema }), {
    provider: "sqlite",
    schema,
  });

  return betterAuth(createPointsAuthOptions(env, database));
}
