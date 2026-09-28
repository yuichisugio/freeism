import { Button, Card } from "@heroui/react";

import { loginProviderIds } from "../../../../shared/providers";
import type { LoginProviderId } from "../../../../shared/providers";
import { formatServiceName } from "../../../../shared/service-names";
import { LoginProviderIcon } from "../../app-shell/components/icons";
import { ErrorText } from "../../app-shell/components/status-messages";
import { useMessages } from "../../../lib/i18n/i18n-provider";
import { accountLinksMessages } from "../messages";

/**
 * 「ログインで証明」カード。
 * Google・GitHub・ORCIDの追加連携のボタンを3列で並べ、各ボタンを列の幅いっぱいに広げる（HeroUIのボタンは既定で内容の幅）。
 * 狭い幅ではサービス名だけにする。
 * 連携の失敗（Better Authの`?error=`）の案内も表示する。
 * @see ../../../../../docs/specification/v0.1/design-system.ja.md
 */
export function ProviderLinkButtons({
  pendingProvider,
  hasStartFailed,
  callbackError,
  onLink,
}: {
  pendingProvider: LoginProviderId | null;
  hasStartFailed: boolean;
  callbackError: string | null;
  onLink: (provider: LoginProviderId) => void;
}) {
  const messages = useMessages(accountLinksMessages);
  return (
    <Card className="gap-4">
      <Card.Header className="gap-4">
        <h2 className="text-lg">{messages.oauthProofTitle}</h2>
        <Card.Description className="text-xs text-muted">{messages.oauthProofDescription}</Card.Description>
      </Card.Header>
      <Card.Content className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-2">
          {loginProviderIds.map((provider) => {
            const serviceName = formatServiceName(provider);
            return (
              <Button
                key={provider}
                variant="outline"
                aria-label={messages.addProvider(serviceName)}
                isDisabled={pendingProvider !== null}
                onPress={() => onLink(provider)}
                className="w-full min-w-0 px-3"
              >
                <LoginProviderIcon provider={provider} className="size-5 shrink-0" />
                <span className="truncate max-sm:hidden">{messages.addProvider(serviceName)}</span>
                <span className="truncate sm:hidden">{serviceName}</span>
              </Button>
            );
          })}
        </div>
        {hasStartFailed ? <ErrorText>{messages.oauthErrorFallback}</ErrorText> : null}
        {callbackError === null ? null : (
          <ErrorText>{messages.oauthErrors[callbackError] ?? messages.oauthErrorFallback}</ErrorText>
        )}
      </Card.Content>
    </Card>
  );
}
