import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  pointsOAuthBootstrapRegistrations,
  registerPointsOAuthClients,
  type PointsOAuthClientKind,
  type RegisteredPointsOAuthClient,
} from "../src/backend/auth/register-points-oauth-clients";

const POINTS_ORIGIN = "https://staging.points.freeism.app";
const MARKETS_ORIGIN = "https://staging.markets.freeism.app";
const STAGING_ENVIRONMENT = "staging";

const SECRET_NAMES = {
  USER: {
    markets: ["POINTS_USER_CLIENT_ID", "POINTS_USER_CLIENT_SECRET"],
    points: ["MARKETS_USER_OAUTH_CLIENT_ID", "MARKETS_USER_OAUTH_CLIENT_SECRET"],
  },
  M2M: {
    markets: ["POINTS_M2M_CLIENT_ID", "POINTS_M2M_CLIENT_SECRET"],
    points: ["MARKETS_M2M_OAUTH_CLIENT_ID", "MARKETS_M2M_OAUTH_CLIENT_SECRET"],
  },
  SETTLEMENT: {
    markets: ["POINTS_SETTLEMENT_CLIENT_ID", "POINTS_SETTLEMENT_CLIENT_SECRET"],
    points: ["MARKETS_SETTLEMENT_OAUTH_CLIENT_ID", "MARKETS_SETTLEMENT_OAUTH_CLIENT_SECRET"],
  },
} as const satisfies Record<
  PointsOAuthClientKind,
  { markets: readonly [string, string]; points: readonly [string, string] }
>;

export interface WranglerInvocation {
  args: string[];
  configPath: string;
  stdin: string;
}

type RunWrangler = (invocation: WranglerInvocation) => void;

function runWrangler(invocation: WranglerInvocation): void {
  const result = spawnSync("wrangler", invocation.args, {
    cwd: dirname(invocation.configPath),
    env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
    input: invocation.stdin,
    stdio: ["pipe", "inherit", "inherit"],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`wrangler secret bulk exited ${String(result.status)}`);
  }
}

function writeWorkerSecrets(
  configPath: string,
  secrets: Record<string, string | null>,
  execute: RunWrangler,
): void {
  execute({
    args: ["secret", "bulk", "--config", configPath, "--env", STAGING_ENVIRONMENT],
    configPath,
    stdin: JSON.stringify(secrets),
  });
}

function credentialSecrets(
  names: readonly [string, string],
  client: RegisteredPointsOAuthClient,
): Record<string, string> {
  return {
    [names[0]]: client.clientId,
    [names[1]]: client.clientSecret,
  };
}

export async function bootstrapStagingOAuthClients(input: {
  bootstrapToken: string;
  fetch?: (request: Request) => Promise<Response>;
  marketsConfigPath?: string;
  pointsConfigPath?: string;
  runWrangler?: RunWrangler;
}): Promise<void> {
  if (!input.bootstrapToken.trim()) throw new Error("bootstrap token is required");

  const appRoot = resolve(dirname(import.meta.filename), "..");
  const pointsConfigPath = input.pointsConfigPath ?? resolve(appRoot, "wrangler.jsonc");
  const marketsConfigPath =
    input.marketsConfigPath ?? resolve(appRoot, "../markets-web-app/wrangler.jsonc");
  const execute = input.runWrangler ?? runWrangler;
  const request = input.fetch ?? globalThis.fetch;

  await registerPointsOAuthClients({
    bootstrapToken: input.bootstrapToken,
    fetch: request,
    marketsOrigin: MARKETS_ORIGIN,
    onRegistered: async (kind, client) => {
      writeWorkerSecrets(
        pointsConfigPath,
        credentialSecrets(SECRET_NAMES[kind].points, client),
        execute,
      );
      writeWorkerSecrets(
        marketsConfigPath,
        credentialSecrets(SECRET_NAMES[kind].markets, client),
        execute,
      );
    },
    pointsOrigin: POINTS_ORIGIN,
    settlementResource: `${MARKETS_ORIGIN}/api/settlements/retry`,
  });

  writeWorkerSecrets(pointsConfigPath, { POINTS_OAUTH_CLIENT_BOOTSTRAP_TOKEN: null }, execute);

  const verificationRegistration = pointsOAuthBootstrapRegistrations({
    marketsOrigin: MARKETS_ORIGIN,
    pointsResource: `${POINTS_ORIGIN}/api/v1`,
    settlementResource: `${MARKETS_ORIGIN}/api/settlements/retry`,
  })[0]!;
  const verification = await request(
    new Request(`${POINTS_ORIGIN}/api/auth/oauth2/register`, {
      body: JSON.stringify(verificationRegistration),
      headers: {
        Authorization: `Bearer ${input.bootstrapToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    }),
  );
  if (verification.status !== 403) {
    throw new Error(
      `OAuth client registration remained enabled with status ${verification.status}`,
    );
  }
}

async function main(): Promise<void> {
  await bootstrapStagingOAuthClients({
    bootstrapToken: process.env.POINTS_OAUTH_CLIENT_BOOTSTRAP_TOKEN ?? "",
  });
  process.stdout.write("Points OAuth staging bootstrap: PASS\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
