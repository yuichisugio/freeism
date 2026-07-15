import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth/minimal";

import { createDb } from "../db/client";
import * as schema from "../db/schema";
import type { Bindings } from "../http/context";
import { provisionMarketsUser } from "../usecases/provision-markets-user";
import { createMarketsAuthOptions } from "./auth-options";

export function createMarketsAuth(env: Bindings) {
  const options = createMarketsAuthOptions(
    env,
    drizzleAdapter(createDb(env.DB), { provider: "sqlite", schema }),
  );
  options.databaseHooks = {
    account: {
      create: {
        after: async (account) => {
          await provisionMarketsUser(env.DB, account.userId);
        },
      },
    },
    session: {
      create: {
        after: async (session) => {
          await provisionMarketsUser(env.DB, session.userId);
        },
      },
    },
  };
  return betterAuth(options);
}
