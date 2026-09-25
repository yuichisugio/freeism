import type { BatchItem } from "drizzle-orm/batch";
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
