import type { ReactNode } from "react";

import { useMessages } from "../../../lib/i18n/i18n-provider";
import { PageMain } from "../../app-shell/components/page-main";
import { ErrorText, LoadingState } from "../../app-shell/components/status-messages";
import { useUserScope } from "../hooks/use-user-scope";
import { authMessages } from "../messages";
import { SignInRequiredCard } from "./sign-in-required-card";

/**
 * AccountsユーザーID付きの画面（`/{-$accountsUserId}/...`）の枠。
 * URLのユーザーと現在のセッションのユーザーが揃うまで画面の中身を表示せず、別のユーザーの内容を見せない。
 * ログインが必要な画面を未ログインで開いたとき・URLのユーザーでログインしていないときは、本文をログインを求めるカードにする。
 * ログイン用のダイアログは自動で開かず、カードの「ログインする」で開く。
 * ユーザーの情報を扱わない画面（使い方・規約など）は、URLのユーザーでログインしていなければ現在のユーザーのURLへ置き換えて表示する。
 * @see ../hooks/use-user-scope.ts
 * @see ./user-scope-gate.test.tsx
 */
export function UserScopeGate({ children }: { children: ReactNode }) {
  const messages = useMessages(authMessages);
  const scope = useUserScope();

  switch (scope.status) {
    case "ready":
      return children;
    case "checking":
      return (
        <PageMain>
          <LoadingState />
        </PageMain>
      );
    case "switchFailed":
      return (
        <PageMain>
          <ErrorText>{messages.switchFailed}</ErrorText>
        </PageMain>
      );
    case "guestSignInRequired":
      return (
        <PageMain>
          <SignInRequiredCard message={messages.signInRequired} />
        </PageMain>
      );
    case "signInRequired":
      return (
        <PageMain>
          <SignInRequiredCard
            message={
              <>
                {messages.userScopeSignInRequired.before}
                <span className="font-mono text-sm">{scope.accountsUserId}</span>
                {messages.userScopeSignInRequired.after}
              </>
            }
          />
        </PageMain>
      );
  }
}
