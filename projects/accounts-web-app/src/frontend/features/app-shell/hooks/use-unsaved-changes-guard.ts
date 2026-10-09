import { useBlocker } from "@tanstack/react-router";

/**
 * 未保存の変更がある間、別画面への移動を確認ダイアログで止める。
 * 同じ画面のクエリだけの変更は止めない。
 * ブラウザーの再読み込み・タブを閉じる操作はブラウザー標準の確認に任せる。
 */
export function useUnsavedChangesGuard(isDirty: boolean) {
  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) => isDirty && current.pathname !== next.pathname,
    enableBeforeUnload: () => isDirty,
    withResolver: true,
  });

  return {
    isConfirming: blocker.status === "blocked",
    discardAndLeave: () => blocker.proceed?.(),
    keepEditing: () => blocker.reset?.(),
  };
}
