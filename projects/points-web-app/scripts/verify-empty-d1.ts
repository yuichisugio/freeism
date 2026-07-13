import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const REQUIRED_SCHEMA_OBJECTS = [
  ["table", "user"],
  ["table", "points_user"],
  ["table", "evaluation_criterion_revision"],
  ["table", "point_package_revision"],
  ["table", "fix_revision"],
  ["table", "point_ledger_entry"],
  ["table", "fix_claim"],
  ["table", "identity_ownership"],
  ["table", "point_reservation"],
  ["table", "points_oauth_connection"],
  ["table", "csv_export_snapshot"],
  ["trigger", "fix_revision_no_update"],
  ["trigger", "point_ledger_entry_no_delete"],
  ["trigger", "fix_claim_no_update"],
] as const;

type SchemaRow = { type: string; name: string };

export function assertRequiredSchema(rows: SchemaRow[]): void {
  const actual = new Set(rows.map((row) => `${row.type}:${row.name}`));
  const missing = REQUIRED_SCHEMA_OBJECTS.filter(([type, name]) => !actual.has(`${type}:${name}`));
  if (missing.length > 0) {
    throw new Error(`empty D1 is missing schema objects: ${missing.map((item) => item.join(":"))}`);
  }
}

function runWrangler(appRoot: string, args: string[], capture = false): string {
  const result = spawnSync("wrangler", args, {
    cwd: appRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      HOME: tmpdir(),
      WRANGLER_LOG_PATH: resolve(tmpdir(), "points-verify-empty-d1.log"),
      WRANGLER_SEND_METRICS: "false",
    },
    stdio: capture ? "pipe" : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(capture ? result.stderr || result.stdout : `wrangler exited ${result.status}`);
  }
  return capture ? result.stdout : "";
}

export async function verifyEmptyD1(): Promise<void> {
  const appRoot = resolve(dirname(import.meta.filename), "..");
  const persistence = await mkdtemp(resolve(tmpdir(), "points-empty-d1-"));
  try {
    runWrangler(appRoot, [
      "d1",
      "migrations",
      "apply",
      "DB",
      "--local",
      "--persist-to",
      persistence,
      "--config",
      "wrangler.jsonc",
    ]);
    const output = runWrangler(
      appRoot,
      [
        "d1",
        "execute",
        "DB",
        "--local",
        "--persist-to",
        persistence,
        "--config",
        "wrangler.jsonc",
        "--command",
        "SELECT type, name FROM sqlite_schema WHERE type IN ('table', 'trigger') ORDER BY type, name",
        "--json",
      ],
      true,
    );
    const payload = JSON.parse(output) as Array<{ results?: SchemaRow[]; success?: boolean }>;
    if (!payload[0]?.success) throw new Error("empty D1 schema inspection failed");
    assertRequiredSchema(payload[0].results ?? []);
    process.stdout.write("Empty D1 migrations and core immutable schema: PASS\n");
  } finally {
    await rm(persistence, { force: true, recursive: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await verifyEmptyD1();
}
