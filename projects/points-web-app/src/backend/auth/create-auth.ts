import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth/minimal";
import type { BetterAuthOptions } from "better-auth";
import {
  addOAuthServerContext,
  APIError,
  createAuthMiddleware,
  getOAuthState,
  getSessionFromCtx,
} from "better-auth/api";

import * as schema from "../infrastructure/db/schema";
import { createDb } from "../infrastructure/db/client";
import {
  ensurePermanentOAuthSubject,
  reconcilePermanentOAuthSubjects,
} from "../infrastructure/db/permanent-oauth-subject-repository";
import type { Bindings } from "../http/context";
import { toAccountsProviderId } from "../accounts/accounts-provider-id";
import {
  hashAccountsLinkSecret,
  insertAccountsLinkAttempt,
  setVerifiedAccountsLinkAttempt,
} from "../infrastructure/db/d1-accounts-link-repository";
import { provisionPointsUser } from "../usecases/provision-points-user";
import { createAccountsGenericOAuthPlugin } from "./accounts-generic-oauth";
import { consumePointsRateLimit } from "../security/rate-limit";
import { createPointsAuthOptions } from "./auth-options";

type AccountsOAuthServerContext = {
  ticket: string;
  connectionId: string;
  pointsUserId: string;
  authSessionIdHash: string;
};

function readAccountsOAuthServerContext(value: unknown): AccountsOAuthServerContext | null {
  if (typeof value !== "object" || value === null) return null;
  const context = value as Record<string, unknown>;
  if (
    typeof context.ticket !== "string" ||
    typeof context.connectionId !== "string" ||
    typeof context.pointsUserId !== "string" ||
    typeof context.authSessionIdHash !== "string"
  )
    return null;
  return context as AccountsOAuthServerContext;
}

function isPermanentSocialProvider(providerId: string): boolean {
  return providerId === "google" || providerId === "github";
}

export function createPointsAuth(
  env: Bindings,
  options: { enableTestUtils?: boolean; accountsConnectionId?: string } = {},
) {
  const database = drizzleAdapter(createDb(env.DB), {
    provider: "sqlite",
    schema,
  });

  const databaseHooks = {
    account: {
      create: {
        after: async (account) => {
          if (
            options.accountsConnectionId &&
            account.providerId === toAccountsProviderId(options.accountsConnectionId)
          ) {
            try {
              const state = await getOAuthState();
              const serverContext = readAccountsOAuthServerContext(state?.serverContext);
              if (
                serverContext === null ||
                serverContext.connectionId !== options.accountsConnectionId ||
                state?.link?.userId !== account.userId
              )
                throw new Error("Accounts OAuth state binding is invalid");
              const saved = await setVerifiedAccountsLinkAttempt(env.DB, {
                ticket: serverContext.ticket,
                pointsUserId: serverContext.pointsUserId,
                authSessionIdHash: serverContext.authSessionIdHash,
                accountsConnectionId: options.accountsConnectionId,
                accountsUserId: account.accountId,
                now: Date.now(),
              });
              if (!saved) throw new Error("Accounts OAuth attempt is missing");
            } finally {
              await env.DB.prepare("DELETE FROM account WHERE id = ?").bind(account.id).run();
            }
            return;
          }
          if (!isPermanentSocialProvider(account.providerId)) return;
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
          if (!isPermanentSocialProvider(account.providerId)) return;
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

  const baseAuthOptions = createPointsAuthOptions(env, database, options.enableTestUtils);
  const authOptions = {
    ...baseAuthOptions,
    account: {
      ...baseAuthOptions.account,
      accountLinking: {
        ...baseAuthOptions.account.accountLinking,
        trustedProviders: [
          ...baseAuthOptions.account.accountLinking.trustedProviders,
          ...(options.accountsConnectionId
            ? [toAccountsProviderId(options.accountsConnectionId)]
            : []),
        ],
      },
    },
    databaseHooks,
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        const providerId = ctx.body?.provider;
        if (typeof providerId !== "string" || !providerId.startsWith("accounts-")) return;
        if (ctx.path === "/sign-in/social") {
          throw new APIError("FORBIDDEN", {
            message: "Accounts is available for account linking only",
          });
        }
        if (ctx.path !== "/link-social") return;
        const connectionId = options.accountsConnectionId;
        if (!connectionId || providerId !== toAccountsProviderId(connectionId)) {
          throw new APIError("BAD_REQUEST", { message: "Accounts connection is unavailable" });
        }
        const session = await getSessionFromCtx(ctx);
        if (!session?.session.id || !session.user.id) {
          throw new APIError("UNAUTHORIZED", { message: "Points session is required" });
        }
        const pointsUser = await env.DB.prepare(
          "SELECT id FROM points_user WHERE auth_user_id = ? AND account_status = 'ACTIVE'",
        )
          .bind(session.user.id)
          .first<{ id: string }>();
        if (!pointsUser) throw new APIError("FORBIDDEN", { message: "Points user is unavailable" });
        const rateLimit = await consumePointsRateLimit({
          db: env.DB,
          now: Date.now(),
          operation: "ACCOUNTS_LINK_START_HOURLY",
          subjectParts: [pointsUser.id],
        });
        if (!rateLimit.allowed) {
          throw new APIError("TOO_MANY_REQUESTS", {
            message: "ACCOUNTS_LINK_RATE_LIMITED",
          });
        }
        const callbackURL = ctx.body?.callbackURL;
        if (typeof callbackURL !== "string") {
          throw new APIError("BAD_REQUEST", { message: "Accounts callback is required" });
        }
        const callback = new URL(callbackURL, env.APP_ORIGIN);
        const ticket = callback.searchParams.get("ticket");
        if (
          callback.origin !== env.APP_ORIGIN ||
          callback.pathname !== "/api/accounts-links/finish" ||
          !ticket ||
          ticket.length < 22
        )
          throw new APIError("BAD_REQUEST", { message: "Accounts callback is invalid" });
        await addOAuthServerContext({
          ticket,
          connectionId,
          pointsUserId: pointsUser.id,
          authSessionIdHash: await hashAccountsLinkSecret(session.session.id),
        });
      }),
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/link-social") return;
        const state = await getOAuthState();
        const serverContext = readAccountsOAuthServerContext(state?.serverContext);
        if (!state?.codeVerifier || !state.idTokenNonce || !state.link || !serverContext) return;
        if (serverContext.connectionId !== options.accountsConnectionId) return;
        await insertAccountsLinkAttempt(env.DB, {
          stateHash: await hashAccountsLinkSecret(serverContext.ticket),
          pointsUserId: serverContext.pointsUserId,
          authSessionIdHash: serverContext.authSessionIdHash,
          accountsConnectionId: serverContext.connectionId,
          nonce: state.idTokenNonce,
          codeVerifier: state.codeVerifier,
          createdAt: Date.now(),
        });
      }),
    },
    plugins: [
      ...baseAuthOptions.plugins,
      ...(options.accountsConnectionId
        ? [createAccountsGenericOAuthPlugin(env, options.accountsConnectionId)]
        : []),
    ],
  };

  return betterAuth(authOptions);
}
