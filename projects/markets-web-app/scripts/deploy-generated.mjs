import { spawnSync } from "node:child_process";
import { access, readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";

import { findGeneratedWorkerConfig } from "./assert-worker-build.mjs";
import { loadReleaseTarget, releaseEnvironment } from "./migrate-d1.mjs";

const REQUIRED_FLAGS = [
  "nodejs_compat",
  "assets_navigation_has_no_effect",
  "global_fetch_strictly_public",
];
const REQUIRED_WORKER_FIRST = ["/.well-known/*", "/api/*"];

export function expectedWorkerName(environment) {
  return `auction-worker-${environment}`;
}

function exactlyOne(items, predicate, message) {
  if ((items ?? []).filter(predicate).length !== 1) throw new Error(message);
}

export function assertDeployEnvironment(environment, configuredEnvironment) {
  releaseEnvironment(environment);
  if (configuredEnvironment && configuredEnvironment !== environment) {
    throw new Error(
      `CLOUDFLARE_ENV ${configuredEnvironment} does not match deploy target ${environment}`,
    );
  }
}

export function assertArtifactFreshness(mtimes) {
  if (
    mtimes.artifact < mtimes.source ||
    mtimes.artifact < mtimes.worker ||
    mtimes.artifact < mtimes.lockfile
  ) {
    throw new Error("generated config is stale; rebuild immediately before deployment");
  }
}

export function assertSameMigrationDirectory(
  sourceConfigPath,
  sourceDirectory,
  generatedConfigPath,
  generatedDirectory,
) {
  const sourcePath = resolve(dirname(sourceConfigPath), sourceDirectory);
  const generatedPath = resolve(dirname(generatedConfigPath), generatedDirectory);
  if (sourcePath !== generatedPath) {
    throw new Error("generated config D1 migration directory does not match the source config");
  }
}

function sameJson(actual, expected) {
  return isDeepStrictEqual(actual, expected);
}

export function assertGeneratedConfig(config, environment, expected) {
  releaseEnvironment(environment);
  if (config.targetEnvironment !== environment || config.vars?.APP_ENV !== environment) {
    throw new Error(`generated config is not flattened for ${environment}`);
  }
  if (config.name !== expectedWorkerName(environment) || config.name !== expected.workerName) {
    throw new Error(`unexpected Worker name: ${String(config.name)}`);
  }
  if (config.workers_dev !== false || config.preview_urls !== false) {
    throw new Error("workers.dev and preview URLs must remain disabled");
  }
  if (
    !config.assets?.directory ||
    config.assets.not_found_handling !== "none" ||
    config.assets.html_handling !== "auto-trailing-slash"
  ) {
    throw new Error("generated Static Assets settings do not match the release contract");
  }
  const workerFirst = config.assets.run_worker_first ?? [];
  if (!sameJson([...workerFirst].sort(), REQUIRED_WORKER_FIRST)) {
    throw new Error("generated Static Assets Worker-first routes must match the release contract");
  }
  for (const flag of REQUIRED_FLAGS) {
    if (!config.compatibility_flags?.includes(flag)) {
      throw new Error(`generated config is missing compatibility flag: ${flag}`);
    }
  }
  exactlyOne(
    config.d1_databases,
    (item) =>
      item.binding === expected.database.binding &&
      item.database_id === expected.database.id &&
      item.database_name === expected.database.name,
    "generated config D1 DB does not match the source environment",
  );
  exactlyOne(
    config.durable_objects?.bindings,
    (item) => sameJson(item, expected.durableObject),
    "generated config must contain AUCTION_ROOMS",
  );
  exactlyOne(
    config.workflows,
    (item) => sameJson(item, expected.workflow),
    "generated config must contain AUCTION_SETTLEMENT",
  );
  exactlyOne(
    config.services,
    (item) => sameJson(item, expected.service),
    "generated config must contain environment-specific POINTS_SERVICE",
  );
  exactlyOne(
    config.analytics_engine_datasets,
    (item) => sameJson(item, expected.analytics),
    "generated config must contain OPS_METRICS",
  );
  exactlyOne(
    config.send_email,
    (item) => sameJson(item, expected.email),
    "generated config must contain fixed OPS_ALERT_EMAIL",
  );
  if (!config.triggers?.crons?.includes("*/5 * * * *")) {
    throw new Error("generated config must contain the five-minute Cron");
  }
  if (config.vars?.POINTS_ISSUER !== expected.issuer) {
    throw new Error(`generated config has the wrong POINTS_ISSUER for ${environment}`);
  }
  if (config.vars?.APP_HOST !== expected.host) {
    throw new Error(`generated config has the wrong APP_HOST for ${environment}`);
  }
  if (config.vars?.APP_ORIGIN !== expected.origin) {
    throw new Error(`generated config has the wrong APP_ORIGIN for ${environment}`);
  }
  exactlyOne(
    config.routes,
    (item) => sameJson(item, expected.route),
    "generated config custom domain does not match the source environment",
  );
  if (!sameJson(config.observability, expected.observability)) {
    throw new Error("generated config observability does not match the source environment");
  }
}

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export async function deployGenerated(environment) {
  assertDeployEnvironment(environment, process.env.CLOUDFLARE_ENV);
  const expected = await loadReleaseTarget(environment);
  const configPath = await findGeneratedWorkerConfig(appRoot);
  const config = JSON.parse(await readFile(configPath, "utf8"));
  assertGeneratedConfig(config, environment, expected);

  const sourceConfig = resolve(appRoot, "wrangler.jsonc");
  const generatedDatabase = config.d1_databases.find(
    (item) => item.binding === expected.database.binding,
  );
  assertSameMigrationDirectory(
    sourceConfig,
    expected.database.migrationsDir,
    configPath,
    generatedDatabase.migrations_dir,
  );
  if (config.configPath && resolve(config.configPath) !== sourceConfig) {
    throw new Error("generated config points to a different source config");
  }
  const workerPath = resolve(dirname(configPath), "index.js");
  const [generatedStats, sourceStats, workerStats, lockfileStats] = await Promise.all([
    stat(configPath),
    stat(sourceConfig),
    stat(workerPath),
    stat(resolve(appRoot, "../../pnpm-lock.yaml")),
  ]);
  assertArtifactFreshness({
    artifact: generatedStats.mtimeMs,
    lockfile: lockfileStats.mtimeMs,
    source: sourceStats.mtimeMs,
    worker: workerStats.mtimeMs,
  });
  await access(resolve(dirname(configPath), config.assets.directory));

  const result = spawnSync("wrangler", ["deploy", "--config", configPath], {
    cwd: appRoot,
    env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`wrangler deploy exited ${result.status}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await deployGenerated(releaseEnvironment(process.argv[2]));
}
