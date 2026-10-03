import { useEffect, useState } from "react";

import { accountLinksSchema } from "../../../../shared/schemas/account-link-schema";
import type { AccountLinks, LinkedAccount } from "../../../../shared/schemas/account-link-schema";
import { okSchema } from "../../../../shared/schemas/problem-details-schema";
import type { VisibilityInput } from "../../../../shared/schemas/visibility-schema";
import { requestBff } from "../../../lib/api-client";

/**
 * 同意画面の選択リスト。
 * 今回の連携先の列だけを一覧から取り出して選ばせ、「同意して戻る」ではその列だけを公開設定の保存APIへ送る。
 * ほかの連携先の公開選択と一般公開は送らないため、保存しても変わらない。
 * @see ../../../../../docs/specification/v0.1/main.ja.md
 * @see ./use-consent-selection.test.tsx
 */

type LoadState = { status: "loading" } | { status: "error"; error: unknown } | { status: "ready"; links: AccountLinks };

/**
 * 選択リストの1行。
 */
export type ConsentRow = {
  account: LinkedAccount;
  isSelected: boolean;
};

/**
 * 見出し行の一括チェックの状態（全行を選択・一部を選択・未選択・行が無い）。
 */
export type BulkState = "all" | "some" | "none" | "empty";

function summarizeSelection(rows: readonly ConsentRow[]): BulkState {
  if (rows.length === 0) return "empty";
  if (rows.every((row) => row.isSelected)) return "all";
  return rows.some((row) => row.isSelected) ? "some" : "none";
}

/**
 * 今回の連携先の一覧を取得し、その列の選択を編集・保存する。
 * 選択の初期値は、その連携先への保存済みの公開選択（初回はすべてOFF）とする。
 */
export function useConsentSelection(clientId: string) {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [edits, setEdits] = useState<Readonly<Record<string, boolean>>>({});
  const [saveError, setSaveError] = useState<unknown>(null);

  useEffect(() => {
    const path = `/api/account-links?${new URLSearchParams({ consentClientId: clientId }).toString()}`;
    requestBff(path, accountLinksSchema).then(
      (links) => setLoadState({ status: "ready", links }),
      (error: unknown) => setLoadState({ status: "error", error }),
    );
  }, [clientId]);

  const links = loadState.status === "ready" ? loadState.links : null;
  const client = links?.clients.find((linkedClient) => linkedClient.clientId === clientId) ?? null;
  const rows: ConsentRow[] = (links?.accounts ?? []).map((account) => ({
    account,
    isSelected: edits[account.id] ?? account.visibility[clientId] ?? false,
  }));

  /**
   * 今回の連携先の選択だけを保存し、成功したかを返す。
   */
  const save = async (): Promise<boolean> => {
    setSaveError(null);
    const input: VisibilityInput = {
      accounts: [],
      clients: [{ clientId, visibleAccountIds: rows.filter((row) => row.isSelected).map((row) => row.account.id) }],
    };
    try {
      await requestBff("/api/visibility", okSchema, { method: "PUT", body: input });
      return true;
    } catch (error) {
      setSaveError(error);
      return false;
    }
  };

  return {
    loadState,
    client,
    rows,
    bulkState: summarizeSelection(rows),
    /**
     * 証明済みの行を1件以上選んでいるか（同意の条件）。
     * 未検証の行の選択は数えない。
     */
    hasVerifiedSelection: rows.some((row) => row.isSelected && row.account.verificationStatus === "verified"),
    saveError,
    save,
    setSelected: (accountId: string, isSelected: boolean) =>
      setEdits((current) => ({ ...current, [accountId]: isSelected })),
    /**
     * 未検証の行を含む全行をまとめて選択・解除する。
     */
    setAllSelected: (isSelected: boolean) =>
      setEdits(Object.fromEntries(rows.map((row) => [row.account.id, isSelected]))),
  };
}
