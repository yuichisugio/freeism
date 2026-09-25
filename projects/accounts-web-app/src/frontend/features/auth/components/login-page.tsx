import { Card } from "@heroui/react";
import { Link } from "@tanstack/react-router";

import { useMessages } from "../../../lib/i18n/i18n-provider";
import { ErrorText, LoadingState } from "../../app-shell/components/status-messages";
import { useDeviceSessions } from "../hooks/use-device-sessions";
import { useLogin } from "../hooks/use-login";
import { authMessages } from "../messages";
import { DeviceSessionList } from "./device-session-list";
import { LoginErrorNotice } from "./login-error-notice";
import { LoginProviderList } from "./login-provider-list";

/**
 * ログイン画面（`/`）。
 * OAuth Providerのログイン画面を兼ね、ログイン済みのセッションがあれば一覧と切替を表示する。
 * 署名付きクエリが期限切れの場合は、元のサービスからやり直す案内と、クエリを外してログイン画面を開き直す導線を示す。
 * @see ../../../../../docs/specification/v0.1/main.ja.md
 * @see ./login-page.test.tsx
 */
export function LoginPage({ errorCode }: { errorCode: string | undefined }) {
  const messages = useMessages(authMessages);
  const login = useLogin();
  const deviceSessions = useDeviceSessions();
  const { state } = deviceSessions;

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-8">
      <Card>
        <Card.Header>
          <h1 className="text-xl font-semibold">{messages.title}</h1>
          <Card.Description>{messages.description}</Card.Description>
        </Card.Header>
        <Card.Content className="flex flex-col gap-4">
          {errorCode === undefined ? null : <LoginErrorNotice errorCode={errorCode} />}
          {login.startFailure === "failed" ? <ErrorText>{messages.startFailed}</ErrorText> : null}
          {login.startFailure === "expired" ? (
            <ErrorText>
              {messages.requestExpired}{" "}
              <Link to="/" className="underline">
                {messages.reopenLoginPage}
              </Link>
            </ErrorText>
          ) : null}
          <LoginProviderList
            pendingProvider={login.pendingProvider}
            lastUsedMethod={login.lastUsedMethod}
            onSignIn={(provider) => void login.signIn(provider)}
          />
        </Card.Content>
      </Card>
      {state.status === "loading" ? <LoadingState /> : null}
      {state.status === "failed" ? <ErrorText>{messages.sessionsLoadFailed}</ErrorText> : null}
      {state.status === "loaded" && state.sessions.length > 0 ? (
        <DeviceSessionList
          sessions={state.sessions}
          currentSessionId={state.currentSessionId}
          switchingToken={deviceSessions.switchingToken}
          hasSwitched={deviceSessions.hasSwitched}
          hasSwitchFailed={deviceSessions.hasSwitchFailed}
          onSwitch={(sessionToken) => void deviceSessions.switchSession(sessionToken)}
        />
      ) : null}
    </main>
  );
}
