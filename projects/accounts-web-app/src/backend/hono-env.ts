/**
 * Honoアプリで共有するBindingsの型。
 * `wrangler types`が生成する`CloudflareBindings`を使う。
 */
export type Bindings = CloudflareBindings;

/**
 * Honoアプリの環境型。
 */
export type AppEnv = {
  Bindings: Bindings;
};
