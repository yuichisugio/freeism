import type { PointsOAuthTokenSet } from "./points-token-store";

const M2M_SCOPES = new Set([
  "points.connection.link-attempt.create",
  "points.connection.link-attempt.finalize",
  "points.packages.auction-eligibility",
  "points.reservations.capture",
  "points.reservations.release",
  "points.reservations.status",
]);

export interface PointsOAuthClientConfig {
  audience: string;
  issuer: string;
  m2mClientId: string;
  m2mClientSecret: string;
  settlementClientId: string;
  settlementClientSecret: string;
  userClientId: string;
  userClientSecret: string;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope?: string;
  token_type: string;
}

export class PointsOAuthTokenEndpointError extends Error {
  constructor(
    readonly status: number,
    readonly oauthError?: string,
  ) {
    super("POINTS_TOKEN_REQUEST_FAILED");
  }
}

interface IntrospectionResponse {
  active: boolean;
  aud?: string | string[];
  client_id?: string;
  exp?: number;
  iss?: string;
  scope?: string;
  sub?: string;
}

export interface IntrospectedUserToken extends PointsOAuthTokenSet {
  clientId: string;
  issuer: string;
  subject: string;
}

function basic(clientId: string, clientSecret: string) {
  return `Basic ${btoa(`${clientId}:${clientSecret}`)}`;
}

function scopeSet(scope: string | undefined) {
  return new Set(scope?.split(" ").filter(Boolean) ?? []);
}

function assertScopes(actual: string | undefined, required: readonly string[]) {
  const scopes = scopeSet(actual);
  if (required.some((scope) => !scopes.has(scope))) throw new Error("POINTS_SCOPE_MISMATCH");
  return [...scopes].sort();
}

function includesAudience(actual: string | string[] | undefined, expected: string) {
  return Array.isArray(actual) ? actual.includes(expected) : actual === expected;
}

async function readJson<T>(response: Response, code: string): Promise<T> {
  if (!response.ok) throw new Error(code);
  return response.json<T>();
}

export class PointsOAuthClient {
  constructor(
    private readonly service: Fetcher,
    private readonly config: PointsOAuthClientConfig,
  ) {
    const clientIds = [config.userClientId, config.m2mClientId, config.settlementClientId];
    const clientSecrets = [
      config.userClientSecret,
      config.m2mClientSecret,
      config.settlementClientSecret,
    ];
    if (
      clientIds.some((value) => value.length === 0) ||
      clientSecrets.some((value) => value.length === 0) ||
      new Set(clientIds).size !== 3 ||
      new Set(clientSecrets).size !== 3
    ) {
      throw new Error("POINTS_OAUTH_CLIENTS_NOT_SEPARATE");
    }
  }

  authorizationUrl(input: {
    callbackUri: string;
    nonce: string;
    pkceChallenge: string;
    scopes: readonly string[];
    state: string;
  }) {
    const url = new URL(`${this.config.issuer}/oauth2/authorize`);
    url.search = new URLSearchParams({
      client_id: this.config.userClientId,
      code_challenge: input.pkceChallenge,
      code_challenge_method: "S256",
      nonce: input.nonce,
      redirect_uri: input.callbackUri,
      resource: this.config.audience,
      response_type: "code",
      scope: input.scopes.join(" "),
      state: input.state,
    }).toString();
    return url.toString();
  }

  async exchangeAuthorizationCode(input: {
    callbackUri: string;
    code: string;
    pkceVerifier: string;
    requiredScopes: readonly string[];
  }): Promise<IntrospectedUserToken> {
    const token = await this.token(
      this.config.userClientId,
      this.config.userClientSecret,
      new URLSearchParams({
        client_id: this.config.userClientId,
        code: input.code,
        code_verifier: input.pkceVerifier,
        grant_type: "authorization_code",
        redirect_uri: input.callbackUri,
        resource: this.config.audience,
      }),
    );
    if (!token.refresh_token) throw new Error("POINTS_REFRESH_TOKEN_MISSING");
    const introspection = await this.introspect(
      token.access_token,
      this.config.userClientId,
      this.config.userClientSecret,
    );
    const scopes = this.assertUserIntrospection(introspection, input.requiredScopes);
    return {
      accessToken: token.access_token,
      accessTokenExpiresAt: new Date(Date.now() + token.expires_in * 1000),
      clientId: this.config.userClientId,
      issuer: introspection.iss!,
      refreshToken: token.refresh_token,
      ...(token.refresh_token_expires_in
        ? { refreshTokenExpiresAt: new Date(Date.now() + token.refresh_token_expires_in * 1000) }
        : {}),
      scopes,
      subject: introspection.sub!,
    };
  }

  async exchangeOneTimeAuthorizationCode(input: {
    callbackUri: string;
    code: string;
    pkceVerifier: string;
    requiredScopes: readonly string[];
  }) {
    const token = await this.token(
      this.config.userClientId,
      this.config.userClientSecret,
      new URLSearchParams({
        client_id: this.config.userClientId,
        code: input.code,
        code_verifier: input.pkceVerifier,
        grant_type: "authorization_code",
        redirect_uri: input.callbackUri,
        resource: this.config.audience,
      }),
    );
    const introspection = await this.introspect(
      token.access_token,
      this.config.userClientId,
      this.config.userClientSecret,
    );
    const scopes = this.assertUserIntrospection(introspection, input.requiredScopes);
    return {
      accessToken: token.access_token,
      accessTokenExpiresAt: new Date(Date.now() + token.expires_in * 1000),
      clientId: this.config.userClientId,
      issuer: introspection.iss!,
      scopes,
      subject: introspection.sub!,
    };
  }

  async getM2MAccessToken(scopes: readonly string[]) {
    if (scopes.length === 0 || scopes.some((scope) => !M2M_SCOPES.has(scope))) {
      throw new Error("POINTS_M2M_SCOPE_INVALID");
    }
    const token = await this.token(
      this.config.m2mClientId,
      this.config.m2mClientSecret,
      new URLSearchParams({
        grant_type: "client_credentials",
        resource: this.config.audience,
        scope: scopes.join(" "),
      }),
    );
    const introspection = await this.introspect(
      token.access_token,
      this.config.m2mClientId,
      this.config.m2mClientSecret,
    );
    if (
      !introspection.active ||
      introspection.iss !== this.config.issuer ||
      introspection.client_id !== this.config.m2mClientId ||
      introspection.sub !== undefined ||
      !includesAudience(introspection.aud, this.config.audience) ||
      !introspection.exp ||
      introspection.exp * 1000 <= Date.now()
    ) {
      throw new Error("POINTS_M2M_INTROSPECTION_INVALID");
    }
    assertScopes(introspection.scope, scopes);
    return token.access_token;
  }

  async refreshUserToken(refreshToken: string, requiredScopes: readonly string[]) {
    const token = await this.token(
      this.config.userClientId,
      this.config.userClientSecret,
      new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        resource: this.config.audience,
      }),
    );
    const nextRefreshToken = token.refresh_token;
    if (!nextRefreshToken) throw new Error("POINTS_REFRESH_TOKEN_MISSING");
    const introspection = await this.introspect(
      token.access_token,
      this.config.userClientId,
      this.config.userClientSecret,
    );
    const scopes = this.assertUserIntrospection(introspection, requiredScopes);
    return {
      accessToken: token.access_token,
      accessTokenExpiresAt: new Date(Date.now() + token.expires_in * 1000),
      refreshToken: nextRefreshToken,
      ...(token.refresh_token_expires_in
        ? { refreshTokenExpiresAt: new Date(Date.now() + token.refresh_token_expires_in * 1000) }
        : {}),
      scopes,
    } satisfies PointsOAuthTokenSet;
  }

  async introspectUserAccessToken(accessToken: string, requiredScopes: readonly string[]) {
    const introspection = await this.introspect(
      accessToken,
      this.config.userClientId,
      this.config.userClientSecret,
    );
    const scopes = this.assertUserIntrospection(introspection, requiredScopes);
    return {
      clientId: introspection.client_id!,
      issuer: introspection.iss!,
      scopes,
      subject: introspection.sub!,
    };
  }

  async revoke(token: string, hint: "access_token" | "refresh_token") {
    await this.service.fetch(
      new Request(`${this.config.issuer}/oauth2/revoke`, {
        body: new URLSearchParams({ token, token_type_hint: hint }),
        headers: {
          Authorization: basic(this.config.userClientId, this.config.userClientSecret),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        method: "POST",
      }),
    );
  }

  private assertUserIntrospection(
    introspection: IntrospectionResponse,
    requiredScopes: readonly string[],
  ) {
    if (
      !introspection.active ||
      introspection.iss !== this.config.issuer ||
      introspection.client_id !== this.config.userClientId ||
      !introspection.sub ||
      !includesAudience(introspection.aud, this.config.audience) ||
      !introspection.exp ||
      introspection.exp * 1000 <= Date.now()
    ) {
      throw new Error("POINTS_USER_INTROSPECTION_INVALID");
    }
    return assertScopes(introspection.scope, requiredScopes);
  }

  private async introspect(token: string, clientId: string, clientSecret: string) {
    return readJson<IntrospectionResponse>(
      await this.service.fetch(
        new Request(`${this.config.issuer}/oauth2/introspect`, {
          body: new URLSearchParams({ token }),
          headers: {
            Authorization: basic(clientId, clientSecret),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          method: "POST",
        }),
      ),
      "POINTS_INTROSPECTION_FAILED",
    );
  }

  private async token(clientId: string, clientSecret: string, body: URLSearchParams) {
    const response = await this.service.fetch(
      new Request(`${this.config.issuer}/oauth2/token`, {
        body,
        headers: {
          Authorization: basic(clientId, clientSecret),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        method: "POST",
      }),
    );
    if (!response.ok) {
      const problem: unknown = await response.json<unknown>().catch(() => undefined);
      const oauthError =
        typeof problem === "object" &&
        problem !== null &&
        "error" in problem &&
        typeof problem.error === "string"
          ? problem.error
          : undefined;
      throw new PointsOAuthTokenEndpointError(response.status, oauthError);
    }
    const token = await response.json<TokenResponse>();
    if (
      !token.access_token ||
      token.token_type.toLowerCase() !== "bearer" ||
      !Number.isSafeInteger(token.expires_in) ||
      token.expires_in <= 0
    ) {
      throw new Error("POINTS_TOKEN_RESPONSE_INVALID");
    }
    return token;
  }
}
