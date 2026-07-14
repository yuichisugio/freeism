import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { releaseEnvironment } from "./migrate-d1.mjs";

const FINAL_VERSION = "1.7.0";
const STAGING_VERSIONS = new Set(["1.7.0-rc.1", FINAL_VERSION]);
const SHARED_PACKAGES = ["better-auth", "@better-auth/drizzle-adapter", "auth"];

function packageVersion(manifest, packageName) {
  return manifest.dependencies?.[packageName] ?? manifest.devDependencies?.[packageName];
}

export function assertBetterAuthRelease(environment, manifests) {
  releaseEnvironment(environment);
  const versions = [];
  for (const [app, manifest] of Object.entries(manifests)) {
    for (const packageName of SHARED_PACKAGES) {
      const version = packageVersion(manifest, packageName);
      if (!version) throw new Error(`${app} is missing ${packageName}`);
      versions.push(version);
    }
  }
  const pointsProvider = packageVersion(manifests.points, "@better-auth/oauth-provider");
  if (!pointsProvider) throw new Error("Points is missing @better-auth/oauth-provider");
  versions.push(pointsProvider);
  if (packageVersion(manifests.markets, "@better-auth/oauth-provider")) {
    throw new Error("Markets must not depend on @better-auth/oauth-provider");
  }
  if (new Set(versions).size !== 1)
    throw new Error("Better Auth package versions must match exactly");
  const version = versions[0];
  if (environment === "production" && version !== FINAL_VERSION) {
    throw new Error(`BETTER_AUTH_FINAL_REQUIRED: expected ${FINAL_VERSION}, received ${version}`);
  }
  if (environment === "staging" && !STAGING_VERSIONS.has(version)) {
    throw new Error(`unsupported Better Auth staging version: ${version}`);
  }
  return version;
}

function importerBlock(lockfile, importer) {
  const start = lockfile.indexOf(`  ${importer}:`);
  if (start < 0) throw new Error(`pnpm lockfile has no ${importer} importer`);
  const next = lockfile.indexOf("\n  projects/", start + 1);
  return lockfile.slice(start, next < 0 ? lockfile.length : next);
}

function assertLockfilePackage(block, packageName, version, expected) {
  const escaped = packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `^      ['"]?${escaped}['"]?:\\n        specifier: ([^\\n]+)\\n        version: ([^\\n]+)`,
    "m",
  );
  const match = block.match(pattern);
  if (!expected) {
    if (match) throw new Error(`Markets lockfile must not contain ${packageName}`);
    return;
  }
  if (match?.[1] !== version) {
    throw new Error(`lockfile ${packageName} specifier must be ${version}`);
  }
  const resolvedVersion = match[2].split("(", 1)[0];
  if (resolvedVersion !== version) {
    throw new Error(
      `lockfile ${packageName} resolved version must be ${version}; received ${resolvedVersion}`,
    );
  }
}

export function assertBetterAuthLockfile(lockfile, version) {
  const markets = importerBlock(lockfile, "projects/markets-web-app");
  const points = importerBlock(lockfile, "projects/points-web-app");
  for (const packageName of SHARED_PACKAGES) {
    assertLockfilePackage(markets, packageName, version, true);
    assertLockfilePackage(points, packageName, version, true);
  }
  assertLockfilePackage(markets, "@better-auth/oauth-provider", version, false);
  assertLockfilePackage(points, "@better-auth/oauth-provider", version, true);
}

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(appRoot, "../..");

export const BETTER_AUTH_RELEASE_REGRESSION_COMMANDS = [
  ["pnpm", ["contract:web-app:check"]],
  [
    "pnpm",
    ["--filter", "@freeism/markets-web-app", "test", "--", "src/backend/auth/auth-options.test.ts"],
  ],
  [
    "pnpm",
    [
      "--filter",
      "@freeism/markets-web-app",
      "test:worker",
      "--",
      "test/worker/auth-google.worker.test.ts",
    ],
  ],
  [
    "pnpm",
    [
      "--filter",
      "@freeism/points-web-app",
      "test",
      "--",
      "test/contract/points-oauth.contract.test.ts",
      "test/contract/google-fresh-authorization-params.contract.test.ts",
    ],
  ],
  [
    "pnpm",
    [
      "--filter",
      "@freeism/points-web-app",
      "test:worker",
      "--",
      "test/worker/admin-auth.worker.test.ts",
      "test/worker/auth-social.worker.test.ts",
      "test/worker/oauth-client-bootstrap.worker.test.ts",
      "test/worker/oauth-resource.worker.test.ts",
    ],
  ],
  [
    "pnpm",
    [
      "--filter",
      "@freeism/markets-web-app",
      "test",
      "--",
      "test/contract/settlement-admin-assertion.contract.test.ts",
    ],
  ],
];

export function runBetterAuthReleaseRegressions(
  runner = (command, args) =>
    spawnSync(command, args, {
      cwd: repositoryRoot,
      env: process.env,
      stdio: "inherit",
    }),
) {
  for (const [command, args] of BETTER_AUTH_RELEASE_REGRESSION_COMMANDS) {
    const result = runner(command, args);
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(`Better Auth release regression failed: ${command} ${args.join(" ")}`);
    }
  }
}

export async function verifyBetterAuthRelease(environment, runner) {
  const [markets, points, lockfile] = await Promise.all([
    readFile(resolve(appRoot, "package.json"), "utf8").then(JSON.parse),
    readFile(resolve(repositoryRoot, "projects/points-web-app/package.json"), "utf8").then(
      JSON.parse,
    ),
    readFile(resolve(repositoryRoot, "pnpm-lock.yaml"), "utf8"),
  ]);
  const version = assertBetterAuthRelease(environment, { markets, points });
  assertBetterAuthLockfile(lockfile, version);
  if (version === FINAL_VERSION) runBetterAuthReleaseRegressions(runner);
  process.stdout.write(`Better Auth ${version} ${environment} release gate: PASS\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await verifyBetterAuthRelease(releaseEnvironment(process.env.CLOUDFLARE_ENV));
}
