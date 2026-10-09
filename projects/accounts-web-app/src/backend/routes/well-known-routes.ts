import {
  oauthProviderAuthServerMetadata,
  oauthProviderOpenIdConfigMetadata,
} from "@better-auth/oauth-provider";
import { oauthProviderResourceClient } from "@better-auth/oauth-provider/resource-client";
import { Hono } from "hono";

import { getAuth } from "../auth/auth";
import { createResourceApiIdentifier, identitiesReadScope } from "../auth/create-auth";
import type { AppEnv } from "../hono-env";

/**
 * 認可サーバーと資源APIのメタデータ（`/.well-known/*`）。
 * Better Authは`/api/auth`配下で動くため、発行元`iss`（`ACCOUNTS_ORIGIN`）の直下で公式のメタデータ関数を公開する。
 * 資源APIの401・403の`WWW-Authenticate`は、`resource_metadata`で`/oauth-protected-resource/api/v1`を示す。
 * @see https://better-auth.com/docs/plugins/oauth-provider
 * @see ./well-known-routes.worker.test.ts
 */
export const wellKnownRoutes = new Hono<AppEnv>()
  .get("/openid-configuration", (c) => oauthProviderOpenIdConfigMetadata(getAuth())(c.req.raw))
  .get("/oauth-authorization-server", (c) =>
    oauthProviderAuthServerMetadata(getAuth())(c.req.raw),
  )
  .get("/oauth-protected-resource/api/v1", async (c) =>
    c.json(
      await oauthProviderResourceClient(getAuth())
        .getActions()
        .getProtectedResourceMetadata({
          resource: createResourceApiIdentifier(c.env.ACCOUNTS_ORIGIN),
          scopes_supported: [identitiesReadScope],
          bearer_methods_supported: ["header"],
          dpop_bound_access_tokens_required: true,
        }),
    ),
  );
