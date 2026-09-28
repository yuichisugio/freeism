import { AlertDialog, Button, Input, Label, TextField } from "@heroui/react";

import { commonMessages } from "../../../lib/i18n/common-messages";
import { useMessages } from "../../../lib/i18n/i18n-provider";
import { ErrorNotice } from "../../app-shell/components/status-messages";
import type { AccountDeletion } from "../hooks/use-account-deletion";
import { settingsMessages } from "../messages";
import { SettingsSection } from "./settings-section";

/**
 * 退会。
 * 「退会」で確認のダイアログを開き、「DELETE」と入力するまで「退会する」を押せない。
 * @see ../../../../../docs/specification/v0.1/design-system.ja.md
 * @see ./settings-sections.test.tsx
 */
export function AccountDeletionSection({ accountDeletion }: { accountDeletion: AccountDeletion }) {
  const messages = useMessages(settingsMessages);
  const common = useMessages(commonMessages);

  return (
    <SettingsSection title={messages.deletionTitle} description={messages.deletionDescription} tone="danger">
      <Button variant="danger-soft" onPress={accountDeletion.openDialog}>
        {messages.deletionOpenButton}
      </Button>
      <AlertDialog>
        <AlertDialog.Backdrop
          isOpen={accountDeletion.isDialogOpen}
          isDismissable={!accountDeletion.isDeleting}
          isKeyboardDismissDisabled={accountDeletion.isDeleting}
          onOpenChange={(open) => {
            if (!open) accountDeletion.closeDialog();
          }}
        >
          <AlertDialog.Container>
            <AlertDialog.Dialog className="max-w-(--dialog-w)">
              <AlertDialog.Header>
                <AlertDialog.Icon status="danger" />
                <AlertDialog.Heading>{messages.deletionDialogTitle}</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body className="flex flex-col gap-4">
                <p className="text-sm">{messages.deletionDialogDescription}</p>
                <TextField
                  value={accountDeletion.confirmationText}
                  onChange={accountDeletion.changeConfirmationText}
                  isDisabled={accountDeletion.isDeleting}
                >
                  <Label>{messages.deletionConfirmLabel}</Label>
                  <Input className="font-mono" autoComplete="off" spellCheck={false} placeholder="DELETE" />
                </TextField>
                {accountDeletion.deleteError === null ? null : <ErrorNotice error={accountDeletion.deleteError} />}
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button
                  size="sm"
                  variant="tertiary"
                  isDisabled={accountDeletion.isDeleting}
                  onPress={accountDeletion.closeDialog}
                >
                  {common.cancel}
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  isDisabled={!accountDeletion.canDelete}
                  onPress={() => void accountDeletion.deleteAccount()}
                >
                  {accountDeletion.isDeleting ? messages.deleting : messages.deletionButton}
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
    </SettingsSection>
  );
}
