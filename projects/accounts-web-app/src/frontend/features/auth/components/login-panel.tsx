import { Link } from "@tanstack/react-router";

import { useMessages } from "../../../lib/i18n/i18n-provider";
import { ErrorText } from "../../app-shell/components/status-messages";
import { appShellMessages } from "../../app-shell/messages";
import { useLogin } from "../hooks/use-login";
import { authMessages } from "../messages";
import { LoginErrorNotice } from "./login-error-notice";
import { LoginProviderList } from "./login-provider-list";

/**
 * ログイン用のダイアログの中身。
 * Providerのボタン・前回のログイン方法・ログイン失敗の案内と、利用規約・プライバシーポリシーへのリンクを示す。
 * 署名付きクエリが期限切れの場合は、元のサービスからやり直す案内と、クエリを外してログインをやり直す導線を示す。
 * 利用規約・プライバシーポリシーは、署名付きクエリを持つログインの途中の画面を残すため新しいタブで開く。
 * @see ../../../../../docs/specification/v0.1/main.ja.md
 * @see ./login-dialog.test.tsx
 */
export function LoginPanel({ errorCode, onReopen }: { errorCode: string | undefined; onReopen: () => void }) {
  const messages = useMessages(authMessages);
  const appShell = useMessages(appShellMessages);
  const login = useLogin();

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">{messages.description}</p>
      {errorCode === undefined ? null : <LoginErrorNotice errorCode={errorCode} />}
      {login.startFailure === "failed" ? <ErrorText>{messages.startFailed}</ErrorText> : null}
      {login.startFailure === "expired" ? (
        <ErrorText>
          {messages.requestExpired}{" "}
          <Link to="/" className="underline" onClick={onReopen}>
            {messages.restartLogin}
          </Link>
        </ErrorText>
      ) : null}
      <LoginProviderList
        pendingProvider={login.pendingProvider}
        lastUsedMethod={login.lastUsedMethod}
        onSignIn={(provider) => void login.signIn(provider)}
      />
      <p className="text-xs text-muted">
        {messages.agreement.before}
        <Link to="/terms" target="_blank" rel="noopener" className="underline">
          {appShell.terms}
        </Link>
        {messages.agreement.between}
        <Link to="/privacy" target="_blank" rel="noopener" className="underline">
          {appShell.privacy}
        </Link>
        {messages.agreement.after}
      </p>
    </div>
  );
}
