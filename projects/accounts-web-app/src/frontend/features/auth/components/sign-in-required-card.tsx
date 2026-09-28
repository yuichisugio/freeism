import { Button, Card } from "@heroui/react";
import { useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { commonMessages } from "../../../lib/i18n/common-messages";
import { useMessages } from "../../../lib/i18n/i18n-provider";
import { useLoginDialog } from "../hooks/use-login-dialog";

/**
 * ログインを求めるカード。
 * 左に1文、右に「ログインする」を置き、押すとログイン用のダイアログを開いてログイン後に同じ画面へ戻す。
 * ダイアログは自動で開かない。
 * @see ../../../../../docs/specification/v0.1/design-system.ja.md
 * @see ./user-scope-gate.test.tsx
 */
export function SignInRequiredCard({ message }: { message: ReactNode }) {
  const common = useMessages(commonMessages);
  const loginDialog = useLoginDialog();
  const pathname = useLocation({ select: (location) => location.pathname });

  return (
    <Card className="flex-row flex-wrap items-center justify-between">
      <p>{message}</p>
      <Button variant="primary" onPress={() => loginDialog.open({ returnTo: pathname })}>
        {common.signIn}
      </Button>
    </Card>
  );
}
