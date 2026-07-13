import { spawnSync } from "node:child_process";
import { access, readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { findGeneratedWorkerConfig } from "../../../scripts/web-app/assert-worker-build.mjs";
import { releaseEnvironment } from "./migrate-d1.mjs";

const REQUIRED_FLAGS = [
  "nodejs_compat",
  "assets_navigation_has_no_effect",
  "global_fetch_strictly_public",
];

export function expectedWorkerName(environment) {
  return `auction-worker-${environment}`;
}

function exactlyOne(items, predicate, message) {
  if ((items ?? []).filter(predicate).length !== 1) throw new Error(message);
}

export function assertGeneratedConfig(config, environment) {
  releaseEnvironment(environment);
  if (config.targetEnvironment !== environment || config.vars?.APP_ENV !== environment) {
    throw new Error(`generated config is not flattened for ${environment}`);
  }
  if (config.name !== expectedWorkerName(environment)) {
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
  if (workerFirst.some((pattern) => pattern === "/*" || pattern === "*")) {
    throw new Error("generated Static Assets must remain asset-first");
  }
  for (const flag of REQUIRED_FLAGS) {
    if (!config.compatibility_flags?.includes(flag)) {
      throw new Error(`generated config is missing compatibility flag: ${flag}`);
    }
  }
  exactlyOne(
    config.d1_databases,
    (item) => item.binding === "DB" && Boolean(item.database_id),
    "generated config must contain exactly one named D1 DB binding",
  );
  exactlyOne(
    config.durable_objects?.bindings,
    (item) => item.name === "AUCTION_ROOMS" && item.class_name === "AuctionRoom",
    "generated config must contain AUCTION_ROOMS",
  );
  exactlyOne(
    config.workflows,
    (item) => item.binding === "AUCTION_SETTLEMENT",
    "generated config must contain AUCTION_SETTLEMENT",
  );
  exactlyOne(
    config.services,
    (item) => item.binding === "POINTS_SERVICE" && item.service === `points-worker-${environment}`,
    "generated config must contain environment-specific POINTS_SERVICE",
  );
  exactlyOne(
    config.analytics_engine_datasets,
    (item) => item.binding === "OPS_METRICS" && Boolean(item.dataset),
    "generated config must contain OPS_METRICS",
  );
  exactlyOne(
    config.send_email,
    (item) => item.name === "OPS_ALERT_EMAIL" && Boolean(item.destination_address),
    "generated config must contain fixed OPS_ALERT_EMAIL",
  );
  if (!config.triggers?.crons?.includes("*/5 * * * *")) {
    throw new Error("generated config must contain the five-minute Cron");
  }
  const expectedIssuer =
    environment === "production"
      ? "https://points.freeism.app"
      : "https://staging.points.freeism.app";
  if (config.vars?.POINTS_ISSUER !== expectedIssuer) {
    throw new Error(`generated config has the wrong POINTS_ISSUER for ${environment}`);
  }
}

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export async function deployGenerated(environment) {
  releaseEnvironment(environment);
  const configPath = await findGeneratedWorkerConfig(appRoot);
  const config = JSON.parse(await readFile(configPath, "utf8"));
  assertGeneratedConfig(config, environment);

  const sourceConfig = resolve(appRoot, "wrangler.jsonc");
  if (config.configPath && resolve(config.configPath) !== sourceConfig) {
    throw new Error("generated config points to a different source config");
  }
  const workerPath = resolve(dirname(configPath), "index.js");
  const [generatedStats, sourceStats, workerStats] = await Promise.all([
    stat(configPath),
    stat(sourceConfig),
    stat(workerPath),
  ]);
  if (
    generatedStats.mtimeMs < sourceStats.mtimeMs ||
    generatedStats.mtimeMs < workerStats.mtimeMs
  ) {
    throw new Error("generated config is stale; rebuild immediately before deployment");
  }
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
