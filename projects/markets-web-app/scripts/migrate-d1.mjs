import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export function releaseEnvironment(value) {
  if (value !== "staging" && value !== "production") {
    throw new Error("environment must be staging or production");
  }
  return value;
}

export function migrationCommand(environment) {
  return [
    "d1",
    "migrations",
    "apply",
    "DB",
    "--remote",
    "--env",
    environment,
    "--config",
    "wrangler.jsonc",
  ];
}

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parseJsonc(source) {
  let result = "";
  let inString = false;
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (inString) {
      result += character;
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      result += character;
      continue;
    }
    if (character === "/" && next === "/") {
      while (index < source.length && source[index] !== "\n") index += 1;
      result += "\n";
      continue;
    }
    if (character === "/" && next === "*") {
      index += 2;
      while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) {
        index += 1;
      }
      index += 1;
      continue;
    }
    result += character;
  }
  return JSON.parse(result.replace(/,\s*([}\]])/g, "$1"));
}

function oneBinding(items, predicate, label) {
  const matches = (items ?? []).filter(predicate);
  if (matches.length !== 1) throw new Error(`source wrangler must contain exactly one ${label}`);
  return matches[0];
}

function remoteEnvironment(config, environment) {
  const value = config.env?.[environment];
  if (!value) throw new Error(`source wrangler has no ${environment} environment`);
  return value;
}

export function releaseTargetFromConfig(config, environment) {
  releaseEnvironment(environment);
  const staging = remoteEnvironment(config, "staging");
  const production = remoteEnvironment(config, "production");
  const stagingDatabase = oneBinding(
    staging.d1_databases,
    (item) => item.binding === "DB",
    "staging D1 DB binding",
  );
  const productionDatabase = oneBinding(
    production.d1_databases,
    (item) => item.binding === "DB",
    "production D1 DB binding",
  );
  for (const [name, database] of [
    ["staging", stagingDatabase],
    ["production", productionDatabase],
  ]) {
    if (!database.database_name || !database.database_id || database.migrations_dir !== "drizzle") {
      throw new Error(
        `source wrangler ${name} D1 DB must have name, ID, and migrations_dir=drizzle`,
      );
    }
  }
  if (stagingDatabase.database_id === productionDatabase.database_id) {
    throw new Error("staging and production D1 database IDs must differ");
  }

  const source = environment === "staging" ? staging : production;
  const database = environment === "staging" ? stagingDatabase : productionDatabase;
  const durableObject = oneBinding(
    source.durable_objects?.bindings,
    (item) => item.name === "AUCTION_ROOMS" && item.class_name === "AuctionRoom",
    `${environment} AUCTION_ROOMS binding`,
  );
  const workflow = oneBinding(
    source.workflows,
    (item) => item.binding === "AUCTION_SETTLEMENT" && Boolean(item.name),
    `${environment} AUCTION_SETTLEMENT binding`,
  );
  const service = oneBinding(
    source.services,
    (item) => item.binding === "POINTS_SERVICE" && Boolean(item.service),
    `${environment} POINTS_SERVICE binding`,
  );
  const analytics = oneBinding(
    source.analytics_engine_datasets,
    (item) => item.binding === "OPS_METRICS" && Boolean(item.dataset),
    `${environment} OPS_METRICS binding`,
  );
  const email = oneBinding(
    source.send_email,
    (item) => item.name === "OPS_ALERT_EMAIL" && Boolean(item.destination_address),
    `${environment} OPS_ALERT_EMAIL binding`,
  );
  const route = oneBinding(
    source.routes,
    (item) => item.custom_domain === true && Boolean(item.pattern),
    `${environment} custom domain route`,
  );
  if (source.vars?.APP_ENV !== environment || !source.vars.POINTS_ISSUER) {
    throw new Error(`source wrangler ${environment} vars do not match the environment`);
  }
  if (!source.triggers?.crons?.includes("*/5 * * * *")) {
    throw new Error(`source wrangler ${environment} is missing the five-minute Cron`);
  }
  if (
    source.observability?.enabled !== true ||
    source.observability.logs?.head_sampling_rate !== 1 ||
    source.observability.traces?.enabled !== true
  ) {
    throw new Error(`source wrangler ${environment} observability is incomplete`);
  }

  return {
    environment,
    workerName: source.name,
    database: {
      binding: "DB",
      id: database.database_id,
      migrationsDir: database.migrations_dir,
      name: database.database_name,
    },
    durableObject,
    workflow,
    service,
    analytics,
    email,
    issuer: source.vars.POINTS_ISSUER,
    route,
    observability: source.observability,
  };
}

export async function loadReleaseTarget(environment) {
  const source = await readFile(resolve(appRoot, "wrangler.jsonc"), "utf8");
  return releaseTargetFromConfig(parseJsonc(source), environment);
}

function runWrangler(args, capture = false) {
  const result = spawnSync("wrangler", args, {
    cwd: appRoot,
    encoding: "utf8",
    env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
    stdio: capture ? "pipe" : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(capture ? result.stderr || result.stdout : `wrangler exited ${result.status}`);
  }
  return capture ? result.stdout : "";
}

async function migrationDigest() {
  const directory = resolve(appRoot, "drizzle");
  const migrationIds = (await readdir(directory))
    .filter((file) => /^\d{4}_.+\.sql$/.test(file))
    .sort();
  const contents = await Promise.all(
    migrationIds.map(
      async (file) => `${file}\n${await readFile(resolve(directory, file), "utf8")}`,
    ),
  );
  return {
    migrationIds,
    sha256: createHash("sha256").update(contents.join("\n")).digest("hex"),
  };
}

export async function migrateD1(environment) {
  releaseEnvironment(environment);
  const target = await loadReleaseTarget(environment);
  let evidencePath;
  let evidence;

  if (environment === "production") {
    const timeTravel = JSON.parse(
      runWrangler(
        [
          "d1",
          "time-travel",
          "info",
          "DB",
          "--env",
          environment,
          "--config",
          "wrangler.jsonc",
          "--json",
        ],
        true,
      ),
    );
    const pendingMigrations = runWrangler(
      [
        "d1",
        "migrations",
        "list",
        "DB",
        "--remote",
        "--env",
        environment,
        "--config",
        "wrangler.jsonc",
      ],
      true,
    );
    const generatedAt = new Date().toISOString();
    evidence = {
      schemaVersion: 1,
      generatedAt,
      environment,
      databaseBinding: "DB",
      databaseId: target.database.id,
      databaseName: target.database.name,
      timeTravel,
      pendingMigrations,
      ...(await migrationDigest()),
      status: "PENDING_APPLY",
    };
    evidencePath = resolve(
      appRoot,
      "../../artifacts/web-app/d1-migrations",
      `markets-production-${generatedAt.replaceAll(":", "-")}.json`,
    );
    await mkdir(dirname(evidencePath), { recursive: true });
    await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  }

  runWrangler(migrationCommand(environment));
  if (evidencePath && evidence) {
    evidence.status = "APPLIED";
    evidence.appliedAt = new Date().toISOString();
    await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await migrateD1(releaseEnvironment(process.argv[2]));
}
