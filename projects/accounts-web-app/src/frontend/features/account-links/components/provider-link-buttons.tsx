import { Button } from "@heroui/react";

import { loginProviderIds } from "../../../../shared/providers";
import type { LoginProviderId } from "../../../../shared/providers";
import { ErrorText } from "../../app-shell/components/status-messages";
import { useMessages } from "../../../lib/i18n/i18n-provider";
import { formatServiceName } from "../../../../shared/service-names";
import { accountLinksMessages } from "../messages";

/**
 * Google・GitHub・ORCIDの追加連携ボタン。
 * 連携の失敗（Better Authの`?error=`）の案内も表示する。
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
    <section aria-labelledby="provider-link-heading" className="flex flex-col gap-2">
      <h3 id="provider-link-heading" className="text-sm font-semibold">
        {messages.addProviderTitle}
      </h3>
      <div className="flex flex-wrap gap-2">
        {loginProviderIds.map((provider) => (
          <Button key={provider} variant="outline" isDisabled={pendingProvider !== null} onPress={() => onLink(provider)}>
            {messages.addProvider(formatServiceName(provider))}
          </Button>
        ))}
      </div>
      {hasStartFailed ? <ErrorText>{messages.oauthErrorFallback}</ErrorText> : null}
      {callbackError === null ? null : (
        <ErrorText>{messages.oauthErrors[callbackError] ?? messages.oauthErrorFallback}</ErrorText>
      )}
    </section>
  );
}
