import { spawnSync } from "node:child_process";
import { access, readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { releaseEnvironment, type ReleaseEnvironment } from "./migrate-d1";

const REQUIRED_COMPATIBILITY_FLAGS = [
  "nodejs_compat",
  "assets_navigation_has_no_effect",
  "global_fetch_strictly_public",
] as const;

type GeneratedConfig = {
  configPath?: string;
  targetEnvironment?: string;
  name?: string;
  compatibility_flags?: string[];
  workers_dev?: boolean;
  preview_urls?: boolean;
  vars?: { APP_ENV?: string };
  assets?: {
    directory?: string;
    not_found_handling?: string;
    html_handling?: string;
  };
  d1_databases?: Array<{ binding?: string; database_id?: string }>;
};

export function expectedWorkerName(environment: ReleaseEnvironment): string {
  return `points-worker-${environment}`;
}

export function assertGeneratedConfig(
  config: GeneratedConfig,
  environment: ReleaseEnvironment,
): void {
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
    config.assets?.not_found_handling !== "none" ||
    config.assets.html_handling !== "auto-trailing-slash" ||
    !config.assets.directory
  ) {
    throw new Error("generated Static Assets settings do not match the release contract");
  }
  for (const flag of REQUIRED_COMPATIBILITY_FLAGS) {
    if (!config.compatibility_flags?.includes(flag)) {
      throw new Error(`generated config is missing compatibility flag: ${flag}`);
    }
  }
  const databases = config.d1_databases?.filter((database) => database.binding === "DB") ?? [];
  if (databases.length !== 1 || !databases[0]?.database_id) {
    throw new Error("generated config must contain exactly one named D1 DB binding");
  }
}

async function generatedConfigPath(appRoot: string): Promise<string> {
  const candidates = [
    resolve(appRoot, "dist/server/wrangler.json"),
    resolve(appRoot, "dist/wrangler.json"),
  ];
  const existing: string[] = [];
  for (const candidate of candidates) {
    try {
      await access(candidate);
      existing.push(candidate);
    } catch {
      // Only one of the framework's documented output locations may exist.
    }
  }
  if (existing.length !== 1) {
    throw new Error(`expected one generated wrangler.json, found ${existing.length}`);
  }
  return existing[0]!;
}

export async function deployGenerated(environment: ReleaseEnvironment): Promise<void> {
  const appRoot = resolve(dirname(import.meta.filename), "..");
  const configPath = await generatedConfigPath(appRoot);
  const config = JSON.parse(await readFile(configPath, "utf8")) as GeneratedConfig;
  assertGeneratedConfig(config, environment);

  const sourceConfig = resolve(appRoot, "wrangler.jsonc");
  if (config.configPath && resolve(config.configPath) !== sourceConfig) {
    throw new Error("generated config points to a different source config");
  }
  const [generatedStats, sourceStats, workerStats] = await Promise.all([
    stat(configPath),
    stat(sourceConfig),
    stat(resolve(dirname(configPath), "index.js")),
  ]);
  if (
    generatedStats.mtimeMs < sourceStats.mtimeMs ||
    generatedStats.mtimeMs < workerStats.mtimeMs
  ) {
    throw new Error("generated config is stale; rebuild immediately before deployment");
  }
  await access(resolve(dirname(configPath), config.assets!.directory!));

  const result = spawnSync("wrangler", ["deploy", "--config", configPath], {
    cwd: appRoot,
    env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`wrangler deploy exited ${result.status}`);
}

async function main(): Promise<void> {
  await deployGenerated(releaseEnvironment(process.argv[2]));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
