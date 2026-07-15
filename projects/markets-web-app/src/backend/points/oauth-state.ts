export const POINTS_CONNECTION_RETURN_PATH = "/settings/points-connection";
export const POINTS_USER_SCOPES = [
  "openid",
  "profile",
  "offline_access",
  "points.connection.read",
  "points.balance.read",
  "points.reservations.create",
] as const;

function base64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function randomValue(bytes = 32) {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return base64Url(value);
}

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return `sha256:${[...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
}

export async function createPointsOAuthState(input: {
  callbackUri: string;
  now?: Date;
  sessionId: string;
}) {
  const state = randomValue();
  const pkceVerifier = randomValue(64);
  const pkceDigest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pkceVerifier));
  const now = input.now ?? new Date();
  return {
    callbackUri: input.callbackUri,
    expiresAt: new Date(now.getTime() + 600_000),
    nonce: randomValue(),
    pkceChallenge: base64Url(new Uint8Array(pkceDigest)),
    pkceVerifier,
    returnPath: POINTS_CONNECTION_RETURN_PATH,
    returnUrlHash: await sha256(POINTS_CONNECTION_RETURN_PATH),
    sessionId: input.sessionId,
    state,
    stateHash: await sha256(state),
  };
}

export function assertNoPointsReturnTargetInput(search: URLSearchParams) {
  for (const key of search.keys()) {
    if (key.toLowerCase() === "returnto" || key.toLowerCase() === "return_url") {
      throw new Error("POINTS_RETURN_TARGET_FORBIDDEN");
    }
  }
}
