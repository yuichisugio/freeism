import type { Hono } from "hono";

import { createPointsAuth } from "../../auth/create-auth";
import { findActiveAccountsConnection } from "../../infrastructure/db/d1-accounts-connection-repository";
import type { BackendContext } from "../context";
import { requireBindings } from "../context";
import { problem } from "../problem";

export function registerAuthRoutes(app: Hono<BackendContext>) {
  app.post("/api/auth/unlink-account", (context) =>
    problem(context, 409, "ACCOUNT_UNLINK_DISABLED", "Physical account unlink is disabled"),
  );
  app.on(["GET", "POST"], "/api/auth/*", async (context) => {
    const env = requireBindings(context.env);
    const url = new URL(context.req.url);
    const callback = /^\/api\/auth\/callback\/(accounts-[^/]+)(\/oauth-proxy)?$/.exec(url.pathname);
    let providerId = callback?.[1];
    if (url.pathname === "/api/auth/link-social" && context.req.method === "POST") {
      const body: unknown = await context.req.raw
        .clone()
        .json()
        .catch(() => null);
      if (
        typeof body === "object" &&
        body !== null &&
        "provider" in body &&
        typeof body.provider === "string"
      ) {
        providerId = body.provider;
      }
    }
    const accountsConnectionId = providerId?.startsWith("accounts-")
      ? providerId.slice("accounts-".length)
      : undefined;
    if (callback && accountsConnectionId && !callback[2]) {
      const connection = await findActiveAccountsConnection(env.DB, accountsConnectionId);
      if (connection === null || url.searchParams.get("iss") !== connection.accountsOrigin) {
        return problem(
          context,
          400,
          "ACCOUNTS_AUTHORIZATION_RESPONSE_INVALID",
          "Invalid Accounts issuer",
        );
      }
    }
    return createPointsAuth(env, { accountsConnectionId }).handler(context.req.raw);
  });
}
