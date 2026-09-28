import { Button, Card } from "@heroui/react";
import { useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { commonMessages } from "../../../lib/i18n/common-messages";
import { useMessages } from "../../../lib/i18n/i18n-provider";
import { PageMain } from "../../app-shell/components/page-main";
import { ErrorText, LoadingState } from "../../app-shell/components/status-messages";
import { useLoginDialog } from "../hooks/use-login-dialog";
import { useUserScope } from "../hooks/use-user-scope";
import { authMessages } from "../messages";

/**
 * AccountsユーザーID付きの画面（`/{-$accountsUserId}/...`）の枠。
 * URLのユーザーと現在のセッションのユーザーが揃うまで画面の中身を表示せず、別のユーザーの内容を見せない。
 * ログインが必要な画面を未ログインで開いたときは、本文を「表示するにはログインしてください」の1文にし、ログイン用のダイアログを開く。
 * ダイアログを閉じた後も開き直せるよう、1文の横に「ログインする」を置く。
 * ユーザーの情報を扱わない画面（ヘルプ・規約など）は、URLのユーザーでログインしていなければ現在のユーザーのURLへ置き換えて表示する。
 * @see ../hooks/use-user-scope.ts
 * @see ./user-scope-gate.test.tsx
 */
export function UserScopeGate({ children }: { children: ReactNode }) {
  const messages = useMessages(authMessages);
  const common = useMessages(commonMessages);
  const scope = useUserScope();
  const loginDialog = useLoginDialog();
  const pathname = useLocation({ select: (location) => location.pathname });

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
          <div className="flex flex-wrap items-center gap-3">
            <p>{messages.signInRequired}</p>
            <Button size="sm" variant="primary" onPress={() => loginDialog.open({ returnTo: pathname })}>
              {common.signIn}
            </Button>
          </div>
        </PageMain>
      );
    case "signInRequired":
      return (
        <PageMain>
          <Card className="items-start gap-4">
            <p>{messages.userScopeSignInRequired(scope.accountsUserId)}</p>
            <Button variant="primary" onPress={scope.openLogin}>
              {common.signIn}
            </Button>
          </Card>
        </PageMain>
      );
  }
}
