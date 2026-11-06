import { AlertDialog, Button } from "@heroui/react";

import { AlertIcon } from "../../app-shell/components/icons";
import { ErrorNotice } from "../../app-shell/components/status-messages";
import { commonMessages } from "../../../lib/i18n/common-messages";
import { useMessages } from "../../../lib/i18n/i18n-provider";
import type { UnlinkTarget } from "../hooks/use-unlink";
import { formatAccountLabel } from "../lib/account-label";
import { accountLinksMessages } from "../messages";
import type { AccountLinksMessages } from "../messages";

/**
 * 「すべての連携解除」「この証明を解除」の確認。
 * 拒否された場合は、確認を開いたまま理由を示す。
 * @see ../../../../../docs/specification/v0.1/main.ja.md
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
  return (
    <AlertDialog>
      <AlertDialog.Backdrop
        isOpen={target !== null}
        onOpenChange={(open) => {
          if (!open) onCancel();
        }}
      >
        <AlertDialog.Container placement="center">
          <AlertDialog.Dialog>
            <AlertDialog.Header>
              <AlertIcon className="size-5 shrink-0 text-danger" />
              <AlertDialog.Heading>
                {target?.kind === "verification" ? messages.unlinkVerificationTitle : messages.unlinkAccountTitle}
              </AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body className="flex flex-col gap-3">
              <p className="text-sm">{target === null ? null : describeUnlink(target, messages)}</p>
              {error === null ? null : <ErrorNotice error={error} codeMessages={messages.errorCodes} />}
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button size="sm" variant="tertiary" onPress={onCancel}>
                {common.cancel}
              </Button>
              <Button size="sm" variant="danger" isDisabled={isSubmitting} onPress={onConfirm}>
                {messages.unlinkConfirm}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  );
}

/**
 * 解除で終わるものと残るものの説明。
 * 証明の解除では、最後の証明なら行が未検証として残ることを、DNS TXTなら押した行だけが対象であることを添える。
 */
function describeUnlink(target: UnlinkTarget, messages: AccountLinksMessages): string {
  const label = formatAccountLabel(target.account, messages.accountLabelSeparator);
  if (target.kind === "account") return messages.unlinkAccountDescription(label);
  const { method } = target.verification;
  const isLastProof = target.account.verifications.every(({ id }) => id === target.verification.id);
  const sentences = [
    method === "oauth"
      ? messages.unlinkOAuthDescription(label)
      : messages.unlinkProofDescription(label, messages.methods[method]),
    isLastProof ? messages.unlinkLastProof : method === "oauth" ? messages.unlinkOAuthKeeps : messages.unlinkProofKeeps,
    method === "dns_txt" ? messages.unlinkDnsScope : null,
  ];
  return sentences.filter((sentence) => sentence !== null).join("");
}
