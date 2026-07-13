import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export type ReleaseEnvironment = "staging" | "production";

export function releaseEnvironment(value: string | undefined): ReleaseEnvironment {
  if (value !== "staging" && value !== "production") {
    throw new Error("environment must be staging or production");
  }
  return value;
}

export function migrationCommand(environment: ReleaseEnvironment): string[] {
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

function runWrangler(args: string[], capture = false): string {
  const result = spawnSync("wrangler", args, {
    cwd: resolve(dirname(import.meta.filename), ".."),
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

async function migrationDigest(appRoot: string): Promise<{
  migrationIds: string[];
  sha256: string;
}> {
  const directory = resolve(appRoot, "drizzle");
  const migrationIds = (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort();
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

export async function migrateD1(environment: ReleaseEnvironment): Promise<void> {
  const appRoot = resolve(dirname(import.meta.filename), "..");
  let evidencePath: string | undefined;
  let evidence: Record<string, unknown> | undefined;

  if (environment === "production") {
    const bookmark = JSON.parse(
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
    ) as unknown;
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
    const digest = await migrationDigest(appRoot);
    const generatedAt = new Date().toISOString();
    evidence = {
      schemaVersion: 1,
      generatedAt,
      environment,
      databaseBinding: "DB",
      timeTravel: bookmark,
      pendingMigrations,
      ...digest,
      status: "PENDING_APPLY",
    };
    evidencePath = resolve(
      appRoot,
      "../../artifacts/web-app/d1-migrations",
      `points-production-${generatedAt.replaceAll(":", "-")}.json`,
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

async function main(): Promise<void> {
  await migrateD1(releaseEnvironment(process.argv[2]));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
