import { Button, Chip } from "@heroui/react";

import { formatUtcDateTime } from "../../../../shared/format-date-time";
import type { LinkedAccount, LinkedVerification } from "../../../../shared/schemas/account-link-schema";
import { CheckIcon } from "../../app-shell/components/icons";
import { ErrorNotice } from "../../app-shell/components/status-messages";
import { useMessages } from "../../../lib/i18n/i18n-provider";
import type { UnlinkTarget } from "../hooks/use-unlink";
import { accountLinksMessages } from "../messages";

/**
 * 公開設定の表の行の「詳細」。
 * 証明済みの行は成功した証明ごとのブロックと「すべての連携解除」、未検証の行は直近の検証結果・案内・「再検証」・「すべての連携解除」を示す。
 * @see ../../../../../docs/specification/v0.1/main.ja.md
 * @see ../../../../../docs/specification/v0.1/design-system.ja.md
 */
export function AccountDetail({
  account,
  serviceName,
  isReverifying,
  reverifyError,
  onRequestUnlink,
  onReverify,
}: {
  account: LinkedAccount;
  serviceName: string;
  isReverifying: boolean;
  reverifyError: unknown;
  onRequestUnlink: (target: UnlinkTarget) => void;
  onReverify: (account: LinkedAccount) => void;
}) {
  const messages = useMessages(accountLinksMessages);
  const unlinkAccountButton = (
    <Button size="sm" variant="danger-soft" onPress={() => onRequestUnlink({ kind: "account", account })}>
      {messages.unlinkAccount}
    </Button>
  );

  if (account.verificationStatus === "verified") {
    return (
      <>
        {account.verifications.map((verification) => (
          <VerificationBlock
            key={verification.id}
            verification={verification}
            serviceName={serviceName}
            onRequestUnlink={() => onRequestUnlink({ kind: "verification", account, verification })}
          />
        ))}
        <div className="flex flex-wrap items-center gap-2">{unlinkAccountButton}</div>
      </>
    );
  }

  const { latestAttempt } = account;
  return (
    <>
      <p className="text-sm">
        {latestAttempt === null
          ? messages.neverChecked
          : messages.latestAttempt(formatUtcDateTime(latestAttempt.checkedAt), messages.results[latestAttempt.result])}
      </p>
      {latestAttempt === null || latestAttempt.failureCode === null ? null : (
        <p className="text-sm text-muted">{messages.failureGuidance[latestAttempt.failureCode]}</p>
      )}
      {account.hasImportedVerifications ? <p className="text-sm text-muted">{messages.importedCandidate}</p> : null}
      {account.primaryUrl === null ? <p className="text-sm text-muted">{messages.noUrlGuidance}</p> : null}
      {reverifyError === null ? null : <ErrorNotice error={reverifyError} codeMessages={messages.errorCodes} />}
      <div className="flex flex-wrap items-center gap-2">
        {account.primaryUrl === null ? null : (
          <Button size="sm" variant="primary" isPending={isReverifying} onPress={() => onReverify(account)}>
            {isReverifying ? messages.reverifying : messages.reverify}
          </Button>
        )}
        {unlinkAccountButton}
      </div>
    </>
  );
}

/**
 * 成功した証明1件のブロック。
 * 方法名と「成功」、証明日時・証拠・確認した識別子、「この証明を解除」を置く。
 */
function VerificationBlock({
  verification,
  serviceName,
  onRequestUnlink,
}: {
  verification: LinkedVerification;
  serviceName: string;
  onRequestUnlink: () => void;
}) {
  const messages = useMessages(accountLinksMessages);
  const methodName = messages.methods[verification.method];
  const isOAuth = verification.method === "oauth";
  return (
    <div
      role="group"
      aria-label={messages.verificationGroupLabel(methodName)}
      className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-lg border border-border bg-surface px-4 py-3 max-sm:grid-cols-1"
    >
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <b className="font-display font-bold">{methodName}</b>
          <Chip color="success" variant="soft">
            <CheckIcon className="size-3" />
            {messages.results.verified}
          </Chip>
        </div>
        <dl className="grid grid-cols-3 gap-x-5 gap-y-2 text-sm max-[820px]:grid-cols-2 max-sm:grid-cols-1">
          <div>
            <dt className="text-xs text-muted">{messages.verifiedAt}</dt>
            <dd className="tabular-nums">{formatUtcDateTime(verification.verifiedAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">{messages.evidenceLabels[verification.method]}</dt>
            <dd className={isOAuth ? "wrap-anywhere" : "font-mono text-xs wrap-anywhere"}>
              {verification.evidence ?? messages.oauthEvidence(serviceName)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">{messages.identifier}</dt>
            {verification.identifiers.map((identifier) => (
              <dd key={identifier.id} className="font-mono text-xs wrap-anywhere">
                {identifier.type === "url" ? identifier.value : `${messages.identifierTypes[identifier.type]} ${identifier.value}`}
              </dd>
            ))}
          </div>
        </dl>
      </div>
      <Button size="sm" variant="outline" onPress={onRequestUnlink} className="justify-self-start">
        {messages.unlinkVerification}
      </Button>
    </div>
  );
}
