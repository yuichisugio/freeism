import {
  oauthProviderAuthServerMetadata,
  oauthProviderOpenIdConfigMetadata,
} from "@better-auth/oauth-provider";
import { oauthProviderResourceClient } from "@better-auth/oauth-provider/resource-client";
import type { Hono } from "hono";

import { createPointsAuth } from "../../auth/create-auth";
import { pointsOAuthScopes } from "../../auth/points-oauth-provider";
import type { BackendContext } from "../context";
import { requireBindings } from "../context";

/** 発行元の直下でOAuth/OIDCとPoints資源APIのメタデータを公開する。 */
export function registerWellKnownRoutes(app: Hono<BackendContext>) {
  app.get("/.well-known/openid-configuration", (context) =>
    oauthProviderOpenIdConfigMetadata(createPointsAuth(requireBindings(context.env)))(
      context.req.raw,
    ),
  );
  app.get("/.well-known/oauth-authorization-server", (context) =>
    oauthProviderAuthServerMetadata(createPointsAuth(requireBindings(context.env)))(
      context.req.raw,
    ),
  );
  app.get("/.well-known/oauth-protected-resource/api/v1", async (context) => {
    const env = requireBindings(context.env);
    const metadata = await oauthProviderResourceClient(createPointsAuth(env))
      .getActions()
      .getProtectedResourceMetadata({
        resource: `${env.APP_ORIGIN}/api/v1`,
        scopes_supported: [
          ...pointsOAuthScopes.USER.filter((scope) => scope.startsWith("points.")),
          ...pointsOAuthScopes.M2M,
        ],
        bearer_methods_supported: ["header"],
        dpop_bound_access_tokens_required: true,
      });
    return context.json(metadata);
  });
}
