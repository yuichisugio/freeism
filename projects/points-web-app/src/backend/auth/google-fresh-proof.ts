const GOOGLE_FRESH_SECONDS = 15 * 60;
const GOOGLE_ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);

export interface GoogleFreshClaims {
  aud: string | string[];
  auth_time: number;
  iss: string;
  sub: string;
}

export interface GoogleFreshProofInput {
  /** Claims from an ID token whose signature and expiry were already verified. */
  claims: GoogleFreshClaims;
  expectedAudience: string;
  expectedSubject: string;
  nowSeconds: number;
  sessionCreatedAtMs: number;
}

function fail(code: string): never {
  throw new Error(code);
}

export function assertGoogleFreshProof(input: GoogleFreshProofInput): void {
  const { claims, expectedAudience, expectedSubject, nowSeconds, sessionCreatedAtMs } = input;
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];

  if (!GOOGLE_ISSUERS.has(claims.iss) || !audiences.includes(expectedAudience)) {
    fail("INVALID_GOOGLE_ID_TOKEN");
  }
  if (claims.sub !== expectedSubject) {
    fail("GOOGLE_SUBJECT_MISMATCH");
  }

  const sessionAge = nowSeconds - Math.floor(sessionCreatedAtMs / 1000);
  const authenticationAge = nowSeconds - claims.auth_time;
  if (
    !Number.isSafeInteger(nowSeconds) ||
    !Number.isSafeInteger(sessionCreatedAtMs) ||
    !Number.isSafeInteger(claims.auth_time) ||
    sessionAge < 0 ||
    authenticationAge < 0 ||
    sessionAge > GOOGLE_FRESH_SECONDS ||
    authenticationAge > GOOGLE_FRESH_SECONDS
  ) {
    fail("FRESH_GOOGLE_AUTH_REQUIRED");
  }
}
