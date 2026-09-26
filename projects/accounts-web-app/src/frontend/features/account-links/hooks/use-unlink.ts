import { useState } from "react";

import type { LinkedAccount } from "../../../../shared/schemas/account-link-schema";
import { okSchema } from "../../../../shared/schemas/problem-details-schema";
import { requestBff } from "../../../lib/api-client";

/**
 * 「連携解除」（行全体）と「OAuthの認証連携だけ解除する」。
 * 確認ダイアログで確定してから解除する。
 * @see ../../../../../docs/specification/v0.1/main.ja.md
 * @see ./use-unlink.test.tsx
 */

export type UnlinkTarget =
  | { kind: "account"; account: LinkedAccount }
  | { kind: "oauth"; account: LinkedAccount; authAccountId: string };

type UnlinkState = { status: "idle" } | { status: "submitting" } | { status: "failed"; error: unknown } | { status: "done" };

/**
 * 解除する対象のBFFのパス。
 */
function unlinkPath(target: UnlinkTarget): string {
  const accountPath = `/api/external-accounts/${encodeURIComponent(target.account.id)}`;
  return target.kind === "account" ? accountPath : `${accountPath}/oauth/${encodeURIComponent(target.authAccountId)}`;
}

/**
 * 解除の確認と実行。
 * 成功したら`onUnlinked`で一覧を再取得する。
 */
export function useUnlink({ onUnlinked }: { onUnlinked: () => Promise<void> }) {
  const [target, setTarget] = useState<UnlinkTarget | null>(null);
  const [state, setState] = useState<UnlinkState>({ status: "idle" });

  /**
   * 解除の確認を開く。
   */
  const request = (next: UnlinkTarget) => {
    setTarget(next);
    setState({ status: "idle" });
  };

  /**
   * 確認を閉じる。
   */
  const cancel = () => {
    setTarget(null);
    setState({ status: "idle" });
  };

  /**
   * 確認した対象を解除する。
   * 最後のログイン手段などで拒否された場合は、確認を開いたまま理由を示す。
   */
  const confirm = async () => {
    if (target === null) return;
    setState({ status: "submitting" });
    try {
      await requestBff(unlinkPath(target), okSchema, { method: "DELETE" });
      setTarget(null);
      setState({ status: "done" });
      await onUnlinked();
    } catch (error) {
      setState({ status: "failed", error });
    }
  };

  return {
    target,
    request,
    cancel,
    confirm,
    isSubmitting: state.status === "submitting",
    error: state.status === "failed" ? state.error : null,
    isDone: state.status === "done",
  };
}
