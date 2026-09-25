import { Button, Card, Link } from "@heroui/react";

import type { LinkedClient } from "../../../../shared/schemas/account-link-schema";
import type { Me } from "../../../../shared/schemas/profile-schema";
import { ErrorText } from "../../app-shell/components/status-messages";
import { useMessages } from "../../../lib/i18n/i18n-provider";
import type { ConsentRequest } from "../hooks/use-consent-request";
import { accountLinksMessages } from "../messages";

/**
 * 同意画面モードの説明と「同意して戻る」「同意しない」。
 * 連携先の名前・紹介URL・戻り先のhost・利用目的の定型文・現在のアクティブユーザーを示す。
 * 一覧の取得前（`isListReady`が`false`）は、連携先が無いことや選択が必要なことを表示しない。
 * @see ../../../../../docs/specification/v0.1/main.ja.md
 */
export function ConsentPanel({
  request,
  client,
  isListReady,
  activeUser,
  isExpired,
  hasFailed,
  isSubmitting,
  canAccept,
  onAccept,
  onDeny,
}: {
  request: ConsentRequest;
  client: LinkedClient | null;
  isListReady: boolean;
  activeUser: Me | null;
  isExpired: boolean;
  hasFailed: boolean;
  isSubmitting: boolean;
  canAccept: boolean;
  onAccept: () => void;
  onDeny: () => void;
}) {
  const messages = useMessages(accountLinksMessages);
  const clientName = client?.name ?? request.clientId;
  const blockedMessage = isExpired
    ? messages.consentExpired
    : hasFailed
      ? messages.consentFailed
      : isListReady && client === null
        ? messages.consentClientMissing
        : null;

  return (
    <Card>
      <Card.Header>
        <Card.Title>{messages.consentTitle(clientName)}</Card.Title>
        <Card.Description>{messages.consentExpiryNotice}</Card.Description>
      </Card.Header>
      <Card.Content className="flex flex-col gap-3">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          {client?.uri == null ? null : (
            <>
              <dt>{messages.consentServiceUrl}</dt>
              <dd className="break-all">
                <Link href={client.uri} target="_blank" rel="noreferrer">
                  {client.uri}
                </Link>
              </dd>
            </>
          )}
          {request.redirectHost === null ? null : (
            <>
              <dt>{messages.consentRedirectHost}</dt>
              <dd className="break-all">{request.redirectHost}</dd>
            </>
          )}
          {activeUser === null ? null : (
            <>
              <dt>{messages.consentActiveUser}</dt>
              <dd className="break-all">
                {activeUser.displayName} ({activeUser.accountsUserId})
              </dd>
            </>
          )}
        </dl>
        <p className="text-sm">{messages.consentPurpose}</p>
        {blockedMessage === null ? null : <ErrorText>{blockedMessage}</ErrorText>}
        {isListReady && blockedMessage === null && !canAccept ? <p className="text-sm">{messages.consentAcceptBlocked}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            isDisabled={blockedMessage !== null || !canAccept || isSubmitting}
            onPress={onAccept}
          >
            {messages.consentAccept}
          </Button>
          <Button variant="secondary" isDisabled={isExpired || hasFailed || isSubmitting} onPress={onDeny}>
            {messages.consentDeny}
          </Button>
        </div>
      </Card.Content>
    </Card>
  );
}
