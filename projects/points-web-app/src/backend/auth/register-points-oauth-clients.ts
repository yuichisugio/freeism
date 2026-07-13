import { pointsOAuthScopes } from "./points-oauth-provider";

type RegistrationRequest = {
  client_name: string;
  grant_types: string[];
  redirect_uris?: string[];
  resources: string[];
  response_types?: ["code"];
  scope: string;
  subject_type?: "pairwise" | "public";
  token_endpoint_auth_method: "client_secret_basic";
  type: "web";
};

export interface RegisteredPointsOAuthClient {
  clientId: string;
  clientSecret: string;
}

export interface RegisteredPointsOAuthClients {
  USER: RegisteredPointsOAuthClient;
  M2M: RegisteredPointsOAuthClient;
  SETTLEMENT: RegisteredPointsOAuthClient;
}

export type PointsOAuthClientKind = keyof RegisteredPointsOAuthClients;

export function pointsOAuthBootstrapRegistrations(input: {
  marketsOrigin: string;
  pointsResource: string;
  settlementResource: string;
}): RegistrationRequest[] {
  return [
    {
      client_name: "Markets User",
      grant_types: ["authorization_code", "refresh_token"],
      redirect_uris: [`${input.marketsOrigin}/api/points-connections/callback`],
      resources: [input.pointsResource],
      response_types: ["code"],
      scope: pointsOAuthScopes.USER.join(" "),
      subject_type: "pairwise",
      token_endpoint_auth_method: "client_secret_basic",
      type: "web",
    },
    {
      client_name: "Markets M2M",
      grant_types: ["client_credentials"],
      resources: [input.pointsResource],
      scope: pointsOAuthScopes.M2M.join(" "),
      subject_type: "public",
      token_endpoint_auth_method: "client_secret_basic",
      type: "web",
    },
    {
      client_name: "Markets Settlement",
      grant_types: ["authorization_code"],
      redirect_uris: [`${input.marketsOrigin}/api/settlements/retry-callback`],
      resources: [input.settlementResource],
      response_types: ["code"],
      scope: pointsOAuthScopes.SETTLEMENT.join(" "),
      subject_type: "pairwise",
      token_endpoint_auth_method: "client_secret_basic",
      type: "web",
    },
  ];
}

export async function registerPointsOAuthClients(input: {
  bootstrapToken: string;
  fetch?: (request: Request) => Promise<Response>;
  marketsOrigin: string;
  onRegistered: (kind: PointsOAuthClientKind, client: RegisteredPointsOAuthClient) => Promise<void>;
  pointsOrigin: string;
  settlementResource: string;
}): Promise<RegisteredPointsOAuthClients> {
  const register = input.fetch ?? globalThis.fetch;
  const registrations = pointsOAuthBootstrapRegistrations({
    marketsOrigin: input.marketsOrigin,
    pointsResource: `${input.pointsOrigin}/api/v1`,
    settlementResource: input.settlementResource,
  });
  const kinds = ["USER", "M2M", "SETTLEMENT"] as const;
  const clients = {} as RegisteredPointsOAuthClients;

  for (const [index, registration] of registrations.entries()) {
    const response = await register(
      new Request(`${input.pointsOrigin}/api/auth/oauth2/register`, {
        body: JSON.stringify(registration),
        headers: {
          Authorization: `Bearer ${input.bootstrapToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      }),
    );
    if (!response.ok) {
      throw new Error(`OAuth client registration failed with status ${response.status}`);
    }

    const body: unknown = await response.json();
    if (
      typeof body !== "object" ||
      body === null ||
      !("client_id" in body) ||
      typeof body.client_id !== "string" ||
      !("client_secret" in body) ||
      typeof body.client_secret !== "string"
    ) {
      throw new Error("OAuth client registration returned invalid metadata");
    }
    const kind = kinds[index]!;
    const client = { clientId: body.client_id, clientSecret: body.client_secret };
    await input.onRegistered(kind, client);
    clients[kind] = client;
  }

  return clients;
}
