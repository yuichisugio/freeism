import { AlertDialog, Button } from "@heroui/react";

import { AlertIcon } from "../../app-shell/components/icons";
import { commonMessages } from "../../../lib/i18n/common-messages";
import { useMessages } from "../../../lib/i18n/i18n-provider";
import { developerMessages } from "../messages";

/**
 * OAuthクライアントの削除の確認。
 * 削除すると発行済みトークンによるAPIの利用も止まることを示す。
 */
export function DeleteOAuthClientDialog({
  isOpen,
  isDeleting,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const messages = useMessages(developerMessages);
  const common = useMessages(commonMessages);

  return (
    <AlertDialog>
      <AlertDialog.Backdrop
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) onCancel();
        }}
      >
        <AlertDialog.Container placement="center">
          <AlertDialog.Dialog>
            <AlertDialog.Header>
              <AlertIcon className="size-5 shrink-0 text-danger" />
              <AlertDialog.Heading>{messages.deleteTitle}</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p>{messages.deleteDescription}</p>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button size="sm" variant="tertiary" isDisabled={isDeleting} onPress={onCancel}>
                {common.cancel}
              </Button>
              <Button size="sm" variant="danger" isDisabled={isDeleting} onPress={onConfirm}>
                {isDeleting ? messages.deleting : messages.deleteClient}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  );
}
