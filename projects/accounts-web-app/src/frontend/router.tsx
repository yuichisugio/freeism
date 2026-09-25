import { createRouter } from "@tanstack/react-router";

import { routeTree } from "./routeTree.gen";

/**
 * TanStack Startが画面ごとに使うルーターを生成する。
 */
export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
  });
}
