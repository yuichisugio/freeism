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
