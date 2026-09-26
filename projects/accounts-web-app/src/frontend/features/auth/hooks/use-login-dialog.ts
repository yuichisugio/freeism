import { createContext, useContext } from "react";

/**
 * ログイン用のダイアログの操作。
 * `open`は、ログイン失敗で戻された`?error=`のエラーコードを受け取り、案内とともに開く。
 */
export type LoginDialogControl = {
  open: (errorCode?: string) => void;
};

export const LoginDialogContext = createContext<LoginDialogControl | null>(null);

/**
 * 全画面共通のログイン用のダイアログを開く操作を返す。
 * @see ../components/login-dialog.tsx
 */
export function useLoginDialog(): LoginDialogControl {
  const context = useContext(LoginDialogContext);
  if (context === null) throw new Error("useLoginDialog must be used within LoginDialogProvider.");
  return context;
}
