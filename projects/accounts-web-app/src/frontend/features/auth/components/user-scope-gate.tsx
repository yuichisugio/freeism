import { Button } from "@heroui/react";
import type { ReactNode } from "react";

import { commonMessages } from "../../../lib/i18n/common-messages";
import { useMessages } from "../../../lib/i18n/i18n-provider";
import { ErrorText, LoadingState } from "../../app-shell/components/status-messages";
import { useUserScope } from "../hooks/use-user-scope";
import { authMessages } from "../messages";

/**
 * AccountsユーザーID付きの画面（`/{-$accountsUserId}/...`）の枠。
 * URLのユーザーと現在のセッションのユーザーが揃うまで画面の中身を表示せず、別のユーザーの内容を見せない。
 * @see ../hooks/use-user-scope.ts
 * @see ./user-scope-gate.test.tsx
 */
export function UserScopeGate({ children }: { children: ReactNode }) {
  const messages = useMessages(authMessages);
  const common = useMessages(commonMessages);
  const scope = useUserScope();

  switch (scope.status) {
    case "ready":
      return children;
    case "checking":
      return (
        <main className="mx-auto max-w-6xl px-4 py-8">
          <LoadingState />
        </main>
      );
    case "switchFailed":
      return (
        <main className="mx-auto max-w-6xl px-4 py-8">
          <ErrorText>{messages.switchFailed}</ErrorText>
        </main>
      );
    case "signInRequired":
      return (
        <main className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-8">
          <p>{messages.userScopeSignInRequired(scope.accountsUserId)}</p>
          <Button variant="primary" onPress={scope.openLogin}>
            {common.signIn}
          </Button>
        </main>
      );
  }
}
