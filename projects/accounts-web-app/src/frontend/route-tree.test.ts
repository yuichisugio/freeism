// @vitest-environment happy-dom
import { createMemoryHistory, createRouter } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "./routeTree.gen";

/**
 * 実際の経路の構成で指定したURLを読み込み、移動後の状態を返す。
 * 画面は描画せず、経路の`beforeLoad`だけを確かめる。
 * 画面の経路はブラウザーで読み込むため、happy-domの環境で実行する。
 */
async function loadPath(path: string) {
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: [path] }) });
  await router.load();
  return router.state;
}

describe("画面の経路", () => {
  it("AccountsユーザーIDだけのURLは、そのユーザーの「アカウント連携」画面へ置き換える", async () => {
    const state = await loadPath("/ausr_alice");

    expect(state.location.pathname).toBe("/ausr_alice/account-links");
  });

  it("AccountsユーザーIDに画面が続くURLは、そのまま読み込む", async () => {
    const state = await loadPath("/ausr_alice/settings");

    expect(state.location.pathname).toBe("/ausr_alice/settings");
  });
});
