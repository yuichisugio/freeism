import { betterAuth } from "better-auth/minimal";

import { createMarketsAuthOptions } from "./auth-options";

export const auth = betterAuth(
  createMarketsAuthOptions({
    APP_ORIGIN: "http://localhost:3001",
    BETTER_AUTH_SECRETS: "1:schema-generation-secret-at-least-32-characters",
    GOOGLE_CLIENT_ID: "schema-generation-google-client-id",
    GOOGLE_CLIENT_SECRET: "schema-generation-google-client-secret",
  }),
);
