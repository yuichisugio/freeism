import { createRouter } from "@tanstack/react-router";

import { parseRawSearch, stringifyRawSearch } from "./lib/search-params";
import { routeTree } from "./routeTree.gen";

/**
 * TanStack Startが画面ごとに使うルーターを生成する。
 * クエリは署名付きのOAuthクエリを保つため、値を文字列のまま読み書きする。
 */
export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    parseSearch: parseRawSearch,
    stringifySearch: stringifyRawSearch,
  });
}
