import { AlertDialog, Button } from "@heroui/react";

import { AlertIcon } from "./icons";
import { useMessages } from "../../../lib/i18n/i18n-provider";
import { appShellMessages } from "../messages";

/**
 * 未保存の変更がある状態で、別画面への移動や編集対象の切替を行う前の確認。
 * 「変更を破棄して移動」で移動・切替を続け、「編集に戻る」で取りやめる。
 */
export function UnsavedChangesDialog({
  isOpen,
  onDiscard,
  onKeepEditing,
}: {
  isOpen: boolean;
  onDiscard: () => void;
  onKeepEditing: () => void;
}) {
  const messages = useMessages(appShellMessages);
  return (
    <AlertDialog>
      <AlertDialog.Backdrop
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) onKeepEditing();
        }}
      >
        <AlertDialog.Container placement="center">
          <AlertDialog.Dialog>
            <AlertDialog.Header>
              <AlertIcon className="size-5 shrink-0 text-warning" />
              <AlertDialog.Heading>{messages.unsavedTitle}</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p>{messages.unsavedDescription}</p>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button size="sm" variant="tertiary" onPress={onKeepEditing}>
                {messages.keepEditing}
              </Button>
              <Button size="sm" variant="danger" onPress={onDiscard}>
                {messages.discardAndLeave}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  );
}
