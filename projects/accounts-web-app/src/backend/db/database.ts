import type { BatchItem } from "drizzle-orm/batch";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

import * as schema from "./schema";

/**
 * D1へ接続したDrizzleのデータベース。
 */
export type Database = ReturnType<typeof createDatabase>;

/**
 * D1のBatchへ渡す1文。
 */
export type DatabaseBatchItem = BatchItem<"sqlite">;

/**
 * D1 bindingからschemaとrelationsを持つDrizzleのデータベースを作る。
 */
export function createDatabase(d1: D1Database) {
  return drizzle(d1, { schema });
}

/**
 * 複数の文をD1の`batch()`1回で確定する。
 * 文が無い場合は何もしない。
 * @see https://developers.cloudflare.com/d1/worker-api/d1-database/#batch
 */
export async function runBatch(db: Database, items: readonly DatabaseBatchItem[]): Promise<void> {
  const [first, ...rest] = items;
  if (!first) {
    return;
  }

  await db.batch([first, ...rest]);
}

/**
 * 値の配列を1つのバインド値にし、`json_each`で展開する副問合せ。
 * 件数によらず1つのバインド値で渡し、D1の1文100バインド変数の上限に掛からないようにする。
 * @see https://developers.cloudflare.com/d1/sql-api/query-json/#expand-arrays-for-in-queries
 */
export function jsonEachValues(values: readonly string[]) {
  return sql`(select value from json_each(${JSON.stringify(values)}))`;
}

/**
 * D1のUNIQUE制約違反による失敗かを判定する。
 * Drizzleが包んだ例外も`cause`をたどって確認する。
 * 有効識別子の部分UNIQUEに違反した場合は、同じ識別子への操作が競合したものとして扱う。
 */
export function isUniqueConstraintError(error: unknown): boolean {
  for (let current: unknown = error; current instanceof Error; current = current.cause) {
    if (current.message.includes("UNIQUE constraint failed")) {
      return true;
    }
  }
  return false;
}
