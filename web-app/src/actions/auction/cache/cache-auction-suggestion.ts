"use cache";

import type { Suggestion } from "@/types/auction-types";
import { cache } from "react";
import { prisma } from "@/library-setting/prisma";
import { type PromiseResult } from "@/types/general-types";
import { Prisma } from "@prisma/client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション検索提案取得関数の引数
 */
export type GetSearchSuggestionsParams = {
  query: string;
  userId: string;
  userGroupIds: string[];
  limit?: number;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション検索提案取得関数
 * @param query 検索クエリ
 * @param userId ユーザーID
 * @param userGroupIds ユーザーが参加しているグループID一覧
 * @param limit 取得件数
 * @returns オークション検索提案
 */
export const cachedGetSearchSuggestions = cache(
  async (params: GetSearchSuggestionsParams): PromiseResult<Suggestion[]> => {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 引数を分解
     */
    const { query, userId, userGroupIds, limit = 10 } = params;

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * クエリがない場合は空配列を返す
     * ユーザーが参加しているグループがない場合は空配列を返す
     */
    if (
      typeof query !== "string" ||
      typeof userId !== "string" ||
      !Array.isArray(userGroupIds) ||
      typeof limit !== "number" ||
      !userId ||
      !userGroupIds ||
      !query ||
      query.trim().length < 1 ||
      userGroupIds.length === 0 ||
      limit < 1
    ) {
      return { success: true, data: [], message: "オークション検索提案を取得しました" };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * クエリを正規化
     */
    const normalizedQuery = query.trim().replace(/\s+/g, " OR ");

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * SQL クエリの組み立て
     * pgroonga の前方一致 (&^) を使用
     */
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
          public.normalize_japanese(t.task || ' ' || COALESCE(t.detail, '')) &@~ ${normalizedQuery}
        AND
          a."group_id" = ANY(${userGroupIds}::text[])
        ORDER BY
          score DESC
        LIMIT
          ${limit}
      `;

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * Rawクエリ実行
     */
    const suggestions: Suggestion[] = await prisma.$queryRaw<Suggestion[]>(sql);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 結果の整形
     */
    return { success: true, data: suggestions, message: "オークション検索提案を取得しました" };
  },
);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
