import { Button, Modal } from "@heroui/react";

import { commonMessages } from "../../../lib/i18n/common-messages";
import { useMessages } from "../../../lib/i18n/i18n-provider";
import { accountLinksMessages } from "../messages";

/**
 * サービス別のヒントを開くボタンとダイアログ。
 * @see ../../../../../docs/specification/v0.1/verify-url.ja.md
 */
export function ServiceHintsDialog() {
  const messages = useMessages(accountLinksMessages);
  const common = useMessages(commonMessages);
  return (
    <Modal>
      <Button variant="ghost" size="sm">
        {messages.hintsOpen}
      </Button>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog>
            <Modal.CloseTrigger aria-label={common.close} />
            <Modal.Header>
              <Modal.Heading>{messages.hintsTitle}</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <ul className="flex list-disc flex-col gap-2 pl-5">
                {messages.hints.map((hint) => (
                  <li key={hint}>{hint}</li>
                ))}
              </ul>
            </Modal.Body>
            <Modal.Footer>
              <Button slot="close" variant="secondary">
                {common.close}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
