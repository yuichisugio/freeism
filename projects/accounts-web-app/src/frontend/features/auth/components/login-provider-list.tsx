import { Button, Chip } from "@heroui/react";

import { loginProviderIds } from "../../../../shared/providers";
import type { LoginProviderId } from "../../../../shared/providers";
import { useMessages } from "../../../lib/i18n/i18n-provider";
import { formatServiceName } from "../../../../shared/service-names";
import { authMessages } from "../messages";

type LoginProviderListProps = {
  pendingProvider: LoginProviderId | null;
  lastUsedMethod: string | null;
  onSignIn: (provider: LoginProviderId) => void;
};

/**
 * Google・GitHub・ORCIDのログインボタン。
 * 前回のログイン方法は、色だけでなく「前回使用」のテキストで示す。
 */
export function LoginProviderList({ pendingProvider, lastUsedMethod, onSignIn }: LoginProviderListProps) {
  const messages = useMessages(authMessages);
  return (
    <ul className="flex flex-col gap-3">
      {loginProviderIds.map((provider) => (
        <li key={provider} className="flex items-center gap-3">
          <Button
            className="flex-1"
            variant={provider === lastUsedMethod ? "primary" : "secondary"}
            isDisabled={pendingProvider !== null}
            onPress={() => onSignIn(provider)}
          >
            {provider === pendingProvider ? messages.redirecting : messages.signInWith(formatServiceName(provider))}
          </Button>
          {provider === lastUsedMethod ? (
            <Chip color="accent" size="sm">
              {messages.lastUsed}
            </Chip>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
