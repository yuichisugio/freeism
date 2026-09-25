import { AlertDialog, Button } from "@heroui/react";

import { ErrorNotice } from "../../app-shell/components/status-messages";
import { commonMessages } from "../../../lib/i18n/common-messages";
import { useMessages } from "../../../lib/i18n/i18n-provider";
import type { UnlinkTarget } from "../hooks/use-unlink";
import { formatAccountLabel } from "../lib/account-label";
import { accountLinksMessages } from "../messages";

/**
 * 「連携解除」「OAuthの認証連携だけ解除する」の確認。
 * 拒否された場合は、確認を開いたまま理由を示す。
 */
export function UnlinkDialog({
  target,
  isSubmitting,
  error,
  onConfirm,
  onCancel,
}: {
  target: UnlinkTarget | null;
  isSubmitting: boolean;
  error: unknown;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const messages = useMessages(accountLinksMessages);
  const common = useMessages(commonMessages);
  const label = target === null ? "" : formatAccountLabel(target.account);
  return (
    <AlertDialog>
      <AlertDialog.Backdrop
        isOpen={target !== null}
        onOpenChange={(open) => {
          if (!open) onCancel();
        }}
      >
        <AlertDialog.Container>
          <AlertDialog.Dialog>
            <AlertDialog.Header>
              <AlertDialog.Icon status="danger" />
              <AlertDialog.Heading>
                {target?.kind === "oauth" ? messages.unlinkOAuthTitle : messages.unlinkAccountTitle}
              </AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body className="flex flex-col gap-3">
              <p>
                {target?.kind === "oauth" ? messages.unlinkOAuthDescription(label) : messages.unlinkAccountDescription(label)}
              </p>
              {error === null ? null : <ErrorNotice error={error} codeMessages={messages.errorCodes} />}
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button variant="tertiary" onPress={onCancel}>
                {common.cancel}
              </Button>
              <Button variant="danger" isDisabled={isSubmitting} onPress={onConfirm}>
                {messages.unlinkConfirm}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  );
}
