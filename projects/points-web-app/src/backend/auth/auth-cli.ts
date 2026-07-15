import { betterAuth } from "better-auth/minimal";

import { createPointsAuthOptions } from "./auth-options";

export const auth = betterAuth(
  createPointsAuthOptions({
    APP_ORIGIN: "http://localhost:3000",
    BETTER_AUTH_SECRETS: "1:schema-generation-secret-at-least-32-characters",
    GITHUB_CLIENT_ID: "schema-generation-github-client-id",
    GITHUB_CLIENT_SECRET: "schema-generation-github-client-secret",
    GOOGLE_CLIENT_ID: "schema-generation-google-client-id",
    GOOGLE_CLIENT_SECRET: "schema-generation-google-client-secret",
    MARKETS_SETTLEMENT_RETRY_RESOURCE: "http://localhost:3001/api/settlements/retry",
    POINTS_OAUTH_PAIRWISE_SECRET: "schema-generation-pairwise-secret-at-least-32-characters",
  }),
);
