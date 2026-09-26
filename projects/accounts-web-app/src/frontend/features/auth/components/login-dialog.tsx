import { Modal } from "@heroui/react";
import { useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { commonMessages } from "../../../lib/i18n/common-messages";
import { useMessages } from "../../../lib/i18n/i18n-provider";
import { LoginDialogContext } from "../hooks/use-login-dialog";
import type { LoginDialogControl, LoginDialogOptions } from "../hooks/use-login-dialog";
import { authMessages } from "../messages";
import { LoginPanel } from "./login-panel";

/**
 * 開いているダイアログの内容。
 * `openCount`は開くたびに増やし、開き直したときにログインの状態を作り直す。
 */
type LoginDialogRequest = LoginDialogOptions & { openCount: number };

/**
 * 全画面共通のログイン用のダイアログと、それを開く操作を提供する。
 * ヘッダー・トップページの「ログインする」、アカウントのメニューの「アカウントを追加」、ログインが必要な失敗の案内、利用側サービスから開いたログイン画面、URLのユーザーでログインしていない画面から開く。
 * @see ../../../../../docs/specification/v0.1/main.ja.md
 * @see ./login-dialog.test.tsx
 */
export function LoginDialogProvider({ children }: { children: ReactNode }) {
  const messages = useMessages(authMessages);
  const common = useMessages(commonMessages);
  const [request, setRequest] = useState<LoginDialogRequest | null>(null);

  const open = useCallback((options: LoginDialogOptions = {}) => {
    setRequest((current) => ({ ...options, openCount: (current?.openCount ?? 0) + 1 }));
  }, []);
  const control = useMemo<LoginDialogControl>(() => ({ open }), [open]);

  return (
    <LoginDialogContext value={control}>
      {children}
      <Modal>
        <Modal.Backdrop
          isOpen={request !== null}
          onOpenChange={(isOpen) => {
            if (!isOpen) setRequest(null);
          }}
        >
          <Modal.Container>
            <Modal.Dialog>
              <Modal.CloseTrigger aria-label={common.close} />
              <Modal.Header>
                <Modal.Heading>{messages.title}</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                {request === null ? null : (
                  <LoginPanel
                    key={request.openCount}
                    errorCode={request.errorCode}
                    returnTo={request.returnTo}
                    onReopen={() => open()}
                  />
                )}
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </LoginDialogContext>
  );
}
