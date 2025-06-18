"use cache";

import type { Suggestion } from "@/types/auction-types";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション検索提案取得関数
 * @param query 検索クエリ
 * @param limit 取得件数
 * @returns オークション検索提案
 */
export const cachedGetSearchSuggestions = cache(
  async (query: string, userId: string, limit = 10): Promise<Suggestion[]> => {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * クエリがない場合は空配列を返す
     */
    if (!query || query.trim().length < 1 || !userId) {
      return [];
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * ユーザーが所属するグループのIDを取得
     */
    const userGroupMemberships = await prisma.groupMembership.findMany({
      where: { userId },
      select: { groupId: true },
    });
    const userGroupIds = userGroupMemberships.map((gm) => gm.groupId);
    if (userGroupIds.length === 0) {
      return [];
    }

    const normalizedQuery = query.trim().replace(/\s+/g, " OR ");

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * SQL クエリの組み立て
     * pgroonga の前方一致 (&^) を使用
     */
    try {
      const sql = Prisma.sql`
        SELECT
          t.id,
          t.task as text,
          t.detail as detail,
          pgroonga_score(t.tableoid, t.ctid) as score,
          pgroonga_highlight_html(t.task, ARRAY[${query}]) as highlighted
        FROM
          "Task" t
        JOIN
          "Auction" a ON t.id = a."task_id"
        WHERE
          public.normalize_japanese(t.task || ' ' || COALESCE(t.detail, '')) &@~ ${normalizedQuery} -- task と detail を結合して検索
        AND
          a."group_id" = ANY(${userGroupIds}::text[]) -- ユーザーが所属するグループのオークションのみ
        ORDER BY
          score DESC
        LIMIT
          ${limit}
      `;

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      /**
       * Rawクエリ実行
       */
      const suggestions: Suggestion[] = await prisma.$queryRaw<Suggestion[]>(sql);

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      /**
       * コンソール
       */

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      /**
       * 結果の整形
       */
      return suggestions;

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
    } catch (error) {
      console.error("src/lib/auction/action/cache-auction-listing.ts_getSearchSuggestions_error", error);
      return [];
    }
  },
);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
