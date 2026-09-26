import { createContext, useContext } from "react";

/**
 * ログイン用のダイアログを開くときの指定。
 * `errorCode`は、ログイン失敗で戻された`?error=`のエラーコードで、案内とともに開く。
 * `returnTo`は、ログインの成功・失敗の後に戻る画面（指定が無い場合は`useLogin`の既定）。
 */
export type LoginDialogOptions = {
  errorCode?: string;
  returnTo?: string;
};

/**
 * ログイン用のダイアログの操作。
 */
export type LoginDialogControl = {
  open: (options?: LoginDialogOptions) => void;
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
