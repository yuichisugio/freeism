import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vite-plus/test";

describe("D1 migration compatibility", () => {
  it("does not use SELECT CASE in any migration trigger body", () => {
    const migrationDirectory = resolve(import.meta.dirname, "../../drizzle");
    const incompatibleMigrations = readdirSync(migrationDirectory)
      .filter((fileName) => fileName.endsWith(".sql"))
      .filter((fileName) =>
        readFileSync(resolve(migrationDirectory, fileName), "utf8").includes("SELECT CASE"),
      );

    expect(incompatibleMigrations).toEqual([]);
  });

  it("expresses the auction eligibility guard without a nested CASE trigger body", () => {
    const migration = readFileSync(
      resolve(import.meta.dirname, "../../drizzle/0003_evaluation-package-revisions.sql"),
      "utf8",
    );
    const guard = migration.slice(
      migration.indexOf("CREATE TRIGGER `point_package_auction_eligibility_finalize_guard`"),
    );

    expect(guard).toContain("AND (\n    SELECT COUNT(*)");
    expect(guard).not.toContain("SELECT CASE");
  });
});
