import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";

/**
 * Workers結合テストのD1へ、`migrations/`の全migrationを適用する。
 * 適用済みのmigrationは読み飛ばされる。
 * @see ../vite.config.ts
 */
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
