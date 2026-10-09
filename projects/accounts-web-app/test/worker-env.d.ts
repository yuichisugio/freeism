/**
 * Workers結合テストで追加するBindingsの型。
 * @see ../vite.config.ts
 */
declare namespace Cloudflare {
  interface Env {
    TEST_MIGRATIONS: import("cloudflare:test").D1Migration[];
  }
}
