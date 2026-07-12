import { env } from "cloudflare:workers";
import { decryptOAuthToken, setTokenUtil } from "better-auth/oauth2";
import { describe, expect, it } from "vite-plus/test";

import { createPointsAuth } from "../../src/backend/auth/create-auth";

const PREVIOUS_SECRETS = "1:test-previous-secret-at-least-32-characters";
const CURRENT_SECRETS = "2:test-current-secret-at-least-32-characters";
const CURRENT_AND_PREVIOUS_SECRETS =
  "2:test-current-secret-at-least-32-characters,1:test-previous-secret-at-least-32-characters";
const UNKNOWN_SECRETS = "999:test-unknown-secret-at-least-32-characters";

function withSecrets(secrets: string): Parameters<typeof createPointsAuth>[0] {
  return {
    ...env,
    BETTER_AUTH_SECRETS: secrets,
  } as Parameters<typeof createPointsAuth>[0];
}

async function authContext(secrets: string) {
  return createPointsAuth(withSecrets(secrets)).$context;
}

async function encryptToken(token: string, context: Awaited<ReturnType<typeof authContext>>) {
  const encrypted = await setTokenUtil(token, context);
  if (encrypted === null || encrypted === undefined) {
    throw new Error("Better Auth did not encrypt the OAuth token");
  }
  return encrypted;
}

describe("Better Auth standard OAuth token encryption", () => {
  it("encrypts new tokens with the current secret version", async () => {
    const context = await authContext(CURRENT_AND_PREVIOUS_SECRETS);
    const encrypted = await encryptToken("access-token", context);
    const currentContext = await authContext(CURRENT_SECRETS);
    const previousContext = await authContext(PREVIOUS_SECRETS);

    await expect(decryptOAuthToken(encrypted, currentContext)).resolves.toBe("access-token");
    await expect(decryptOAuthToken(encrypted, previousContext)).rejects.toThrow();
  });

  it("decrypts ciphertext written with the previous secret", async () => {
    const previousContext = await authContext(PREVIOUS_SECRETS);
    const encrypted = await encryptToken("refresh-token", previousContext);
    const currentContext = await authContext(CURRENT_AND_PREVIOUS_SECRETS);

    await expect(decryptOAuthToken(encrypted, currentContext)).resolves.toBe("refresh-token");
  });

  it("rejects ciphertext with an unknown secret version", async () => {
    const unknownContext = await authContext(UNKNOWN_SECRETS);
    const encrypted = await encryptToken("access-token", unknownContext);
    const currentContext = await authContext(CURRENT_AND_PREVIOUS_SECRETS);

    await expect(decryptOAuthToken(encrypted, currentContext)).rejects.toThrow(
      "Secret version 999 not found",
    );
  });

  it("rejects modified authenticated ciphertext", async () => {
    const context = await authContext(CURRENT_AND_PREVIOUS_SECRETS);
    const encrypted = await encryptToken("access-token", context);
    const lastCharacter = encrypted.at(-1);
    const tampered = `${encrypted.slice(0, -1)}${lastCharacter === "0" ? "1" : "0"}`;

    await expect(decryptOAuthToken(tampered, context)).rejects.toThrow();
  });
});
