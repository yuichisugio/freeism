import { defineConfig } from "drizzle-kit";

/**
 * D1のmigrationを生成する設定。
 * 生成したmigrationは`wrangler d1 migrations apply`で適用する。
 */
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/backend/db/schema",
  out: "./migrations",
});
