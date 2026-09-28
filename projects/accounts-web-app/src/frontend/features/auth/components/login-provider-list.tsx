import { Button, Chip } from "@heroui/react";
import { useId } from "react";

import { loginProviderIds } from "../../../../shared/providers";
import type { LoginProviderId } from "../../../../shared/providers";
import { formatServiceName } from "../../../../shared/service-names";
import { useMessages } from "../../../lib/i18n/i18n-provider";
import { LoginProviderIcon } from "../../app-shell/components/icons";
import { authMessages } from "../messages";

type LoginProviderListProps = {
  pendingProvider: LoginProviderId | null;
  lastUsedMethod: string | null;
  onSignIn: (provider: LoginProviderId) => void;
};

/**
 * Google・GitHub・ORCIDのログインボタン（サービスのアイコン付き、同じ幅で縦に中央へ並べる）。
 * 前回のログイン方法は主ボタンにし、色だけでなく「前回使用」のチップ（ボタンの説明として読み上げる）で示す。
 * @see ../../../../../docs/specification/v0.1/design-system/design-system.ja.md
 */
export function LoginProviderList({ pendingProvider, lastUsedMethod, onSignIn }: LoginProviderListProps) {
  const messages = useMessages(authMessages);
  const lastUsedId = useId();
  return (
    <ul className="flex flex-col items-center gap-2">
      {loginProviderIds.map((provider) => {
        const isLastUsed = provider === lastUsedMethod;
        return (
          <li key={provider} className="w-full max-w-(--provider-w)">
            <Button
              fullWidth
              variant={isLastUsed ? "primary" : "outline"}
              isDisabled={pendingProvider !== null}
              aria-describedby={isLastUsed ? lastUsedId : undefined}
              onPress={() => onSignIn(provider)}
            >
              <LoginProviderIcon provider={provider} className="size-5" />
              {provider === pendingProvider ? messages.redirecting : messages.signInWith(formatServiceName(provider))}
              {isLastUsed ? (
                <Chip id={lastUsedId} aria-hidden="true" className="bg-highlight text-highlight-foreground">
                  {messages.lastUsed}
                </Chip>
              ) : null}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
