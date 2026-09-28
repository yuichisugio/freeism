import { useCallback, useEffect, useState } from "react";

import { accountLinksSchema } from "../../../../shared/schemas/account-link-schema";
import type { AccountLinks } from "../../../../shared/schemas/account-link-schema";
import { okSchema } from "../../../../shared/schemas/problem-details-schema";
import { requestBff } from "../../../lib/api-client";
import { buildVisibilityInput, buildVisibilityTable, emptyVisibilityEdits, setSelection } from "../lib/visibility-draft";
import type { Destination, VisibilityEdits } from "../lib/visibility-draft";

/**
 * 「アカウント連携」画面の一覧の取得と、公開設定の編集・保存。
 * 公開設定は画面全体の1回の保存でまとめて反映する。
 * @see ../../../../../docs/specification/v0.1/main.ja.md
 * @see ./use-account-links.test.tsx
 */

type LoadState = { status: "loading" } | { status: "error"; error: unknown } | { status: "ready"; links: AccountLinks };

export type VisibilitySaveState = { status: "idle" } | { status: "saving" } | { status: "saved" } | { status: "error"; error: unknown };

/**
 * 一覧の取得・再取得と、公開設定の編集状態を管理する。
 */
export function useAccountLinks() {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [edits, setEdits] = useState<VisibilityEdits>(emptyVisibilityEdits);
  const [saveState, setSaveState] = useState<VisibilitySaveState>({ status: "idle" });

  // --------------------------------------------------
  // 取得
  // --------------------------------------------------

  /**
   * 一覧を取得する。
   * 再取得でも編集中の公開設定は保ち、表示中の一覧は取得完了まで残す。
   */
  const reload = useCallback(async () => {
    try {
      const links = await requestBff("/api/account-links", accountLinksSchema);
      setLoadState({ status: "ready", links });
    } catch (error) {
      setLoadState({ status: "error", error });
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // --------------------------------------------------
  // 公開設定の保存
  // --------------------------------------------------

  const links = loadState.status === "ready" ? loadState.links : null;

  /**
   * 公開設定をまとめて保存し、成功したかを返す。
   */
  const save = async (): Promise<boolean> => {
    if (links === null) return false;
    setSaveState({ status: "saving" });
    try {
      await requestBff("/api/visibility", okSchema, {
        method: "PUT",
        body: buildVisibilityInput(links, edits),
      });
      // 再取得の完了まで編集後の値を表示し、保存済みの値へ表示が戻らないようにする。
      await reload();
      setEdits(emptyVisibilityEdits);
      setSaveState({ status: "saved" });
      return true;
    } catch (error) {
      setSaveState({ status: "error", error });
      return false;
    }
  };

  /**
   * 編集中の公開設定を破棄し、直前の保存結果の通知を消す。
   */
  const discardEdits = () => {
    setEdits(emptyVisibilityEdits);
    setSaveState({ status: "idle" });
  };

  const table = links === null ? null : buildVisibilityTable(links, edits);

  return {
    loadState,
    links,
    table,
    saveState,
    reload,
    save,
    discardEdits,
    /**
     * 指定した公開先×外部アカウントの選択をまとめて変更する。
     * 編集すると直前の保存結果の通知を消す。
     */
    select: (destinations: readonly Destination[], accountIds: readonly string[], isSelected: boolean) => {
      setEdits((current) => setSelection(current, destinations, accountIds, isSelected));
      setSaveState({ status: "idle" });
    },
  };
}
