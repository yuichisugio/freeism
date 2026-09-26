import { useCallback, useEffect, useState } from "react";

import { accountLinksSchema } from "../../../../shared/schemas/account-link-schema";
import type { AccountLinks } from "../../../../shared/schemas/account-link-schema";
import { okSchema } from "../../../../shared/schemas/problem-details-schema";
import { requestBff } from "../../../lib/api-client";
import {
  buildVisibilityInput,
  buildVisibilityTable,
  emptyVisibilityEdits,
  setAccountPublic,
  setClientConsent,
  setClientVisibility,
} from "../lib/visibility-draft";
import type { VisibilityEdits } from "../lib/visibility-draft";

/**
 * 「アカウント連携」画面の一覧の取得と、公開設定の編集・保存。
 * 公開設定は画面全体の1回の保存でまとめて反映する。
 * @see ../../../../../docs/specification/v0.1/main.ja.md
 * @see ./use-account-links.test.tsx
 */

type LoadState = { status: "loading" } | { status: "error"; error: unknown } | { status: "ready"; links: AccountLinks };

export type VisibilitySaveState = { status: "idle" } | { status: "saving" } | { status: "saved" } | { status: "error"; error: unknown };

/**
 * 一覧を取得するBFFのパス。
 * 同意画面では今回の連携先を列に含めるため`consentClientId`を付ける。
 */
function accountLinksPath(consentClientId: string | undefined): string {
  return consentClientId === undefined
    ? "/api/account-links"
    : `/api/account-links?${new URLSearchParams({ consentClientId }).toString()}`;
}

/**
 * 一覧の取得・再取得と、公開設定の編集状態を管理する。
 */
export function useAccountLinks(consentClientId?: string) {
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
      const links = await requestBff(accountLinksPath(consentClientId), accountLinksSchema);
      setLoadState({ status: "ready", links });
    } catch (error) {
      setLoadState({ status: "error", error });
    }
  }, [consentClientId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // --------------------------------------------------
  // 公開設定の保存
  // --------------------------------------------------

  const links = loadState.status === "ready" ? loadState.links : null;

  /**
   * 公開設定をまとめて保存し、成功したかを返す。
   * `forcedConsentClientId`は同意画面の「同意して戻る」で同意ONとして保存する連携先。
   */
  const save = async (forcedConsentClientId?: string): Promise<boolean> => {
    if (links === null) return false;
    setSaveState({ status: "saving" });
    try {
      await requestBff("/api/visibility", okSchema, {
        method: "PUT",
        body: buildVisibilityInput(links, edits, forcedConsentClientId),
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

  /**
   * 編集操作。
   * 編集すると直前の保存結果の通知を消す。
   */
  const edit = (update: (current: VisibilityEdits) => VisibilityEdits) => {
    setEdits(update);
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
     * 同意ONとして保存する場合の表（同意画面の「同意して戻る」の可否に使う）。
     */
    tableWithForcedConsent: (clientId: string) => (links === null ? null : buildVisibilityTable(links, edits, clientId)),
    setAccountPublic: (accountId: string, isPublic: boolean) =>
      edit((current) => setAccountPublic(current, accountId, isPublic)),
    setClientConsent: (clientId: string, consented: boolean) =>
      edit((current) => setClientConsent(current, clientId, consented)),
    setClientVisibility: (clientId: string, accountIds: readonly string[], isVisible: boolean) =>
      edit((current) => setClientVisibility(current, clientId, accountIds, isVisible)),
    /**
     * 1つの外部アカウントを、すべての連携先についてまとめて公開・非公開にする。
     */
    setAccountVisibilityForAllClients: (accountId: string, isVisible: boolean) =>
      edit((current) =>
        (links?.clients ?? []).reduce(
          (next, client) => setClientVisibility(next, client.clientId, [accountId], isVisible),
          current,
        ),
      ),
  };
}
