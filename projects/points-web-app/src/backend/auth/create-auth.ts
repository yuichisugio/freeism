import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth/minimal";

import * as schema from "../infrastructure/db/schema";
import { createDb } from "../infrastructure/db/client";
import {
  ensurePermanentOAuthSubject,
  reconcilePermanentOAuthSubjects,
} from "../infrastructure/db/permanent-oauth-subject-repository";
import type { Bindings } from "../http/context";
import { bootstrapInitialAdmin } from "../usecases/bootstrap-admin";
import { provisionPointsUser } from "../usecases/provision-points-user";
import { createPointsAuthOptions } from "./auth-options";

export function createPointsAuth(env: Bindings) {
  const database = drizzleAdapter(createDb(env.DB), {
    provider: "sqlite",
    schema,
  });

  const options = createPointsAuthOptions(env, database);
  options.databaseHooks = {
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
          await bootstrapInitialAdmin(env.DB, {
            authUserId: session.userId,
            initialGoogleAccountId: env.INITIAL_ADMIN_GOOGLE_ACCOUNT_ID,
            membershipId: `adm_${crypto.randomUUID()}`,
            pointsUserId: pointsUser.id,
          });
        },
      },
    },
  };

  return betterAuth(options);
}
