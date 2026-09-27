import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth/minimal";
import type { BetterAuthOptions } from "better-auth";

import * as schema from "../infrastructure/db/schema";
import { createDb } from "../infrastructure/db/client";
import {
  ensurePermanentOAuthSubject,
  reconcilePermanentOAuthSubjects,
} from "../infrastructure/db/permanent-oauth-subject-repository";
import type { Bindings } from "../http/context";
import { provisionPointsUser } from "../usecases/provision-points-user";
import { createPointsAuthOptions } from "./auth-options";

export function createPointsAuth(env: Bindings, options: { enableTestUtils?: boolean } = {}) {
  const database = drizzleAdapter(createDb(env.DB), {
    provider: "sqlite",
    schema,
  });

  const databaseHooks = {
    account: {
      create: {
        after: async (account) => {
          const pointsUser = await provisionPointsUser(env.DB, account.userId);
          await ensurePermanentOAuthSubject(env.DB, {
            accountId: account.accountId,
            pointsUserId: pointsUser.id,
            providerId: account.providerId,
          });
        },
      },
      update: {
        after: async (account) => {
          const pointsUser = await provisionPointsUser(env.DB, account.userId);
          await ensurePermanentOAuthSubject(env.DB, {
            accountId: account.accountId,
            pointsUserId: pointsUser.id,
            providerId: account.providerId,
          });
        },
      },
    },
    session: {
      create: {
        after: async (session) => {
          const pointsUser = await provisionPointsUser(env.DB, session.userId);
          await reconcilePermanentOAuthSubjects(env.DB, session.userId, pointsUser.id);
        },
      },
    },
  } satisfies NonNullable<BetterAuthOptions["databaseHooks"]>;

  const authOptions = {
    ...createPointsAuthOptions(env, database, options.enableTestUtils),
    databaseHooks,
  };

  return betterAuth(authOptions);
}
