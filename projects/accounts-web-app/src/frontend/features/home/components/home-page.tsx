import { Button } from "@heroui/react";
import { Link } from "@tanstack/react-router";
import { useEffect } from "react";

import { commonMessages } from "../../../lib/i18n/common-messages";
import { useMessages } from "../../../lib/i18n/i18n-provider";
import { useHydratedSession } from "../../../lib/use-hydrated-session";
import { ErrorText, LoadingState } from "../../app-shell/components/status-messages";
import { DeviceSessionList } from "../../auth/components/device-session-list";
import { useDeviceSessions } from "../../auth/hooks/use-device-sessions";
import { useLoginDialog } from "../../auth/hooks/use-login-dialog";
import { authMessages } from "../../auth/messages";
import { homeMessages } from "../messages";

/**
 * 利用側サービスから開いたログイン画面、またはログイン失敗で戻された場合のログインの要求。
 */
export type LoginRequest = { errorCode: string | undefined };

/**
 * トップページ（`/`）。
 * 簡単な使い方を紹介する静的な内容で、ビルド時に事前生成する。
 * ログインしていない場合は「ログインする」からログイン用のダイアログを開き、ログイン済みの場合はログイン中のユーザーの一覧と切替を示す。
 * セッションに応じた表示は、事前生成したHTMLと描画を揃えるため、hydrationとセッションの確認の後に表示する。
 * OAuth Providerのログイン画面を兼ね、`loginRequest`があればログイン用のダイアログを自動で開く。
 * @see ../../../../../docs/specification/v0.1/main.ja.md
 * @see ./home-page.test.tsx
 */
export function HomePage({ loginRequest }: { loginRequest: LoginRequest | null }) {
  const messages = useMessages(homeMessages);
  const common = useMessages(commonMessages);
  const session = useHydratedSession();
  const loginDialog = useLoginDialog();
  const requestedErrorCode = loginRequest?.errorCode;
  const isLoginRequested = loginRequest !== null;

  useEffect(() => {
    if (isLoginRequested) loginDialog.open(requestedErrorCode);
  }, [isLoginRequested, requestedErrorCode, loginDialog]);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-8">
      <section className="flex flex-col items-start gap-4">
        <h1 className="text-3xl font-semibold">{messages.title}</h1>
        <p>{messages.lead}</p>
        {session.isPending || session.data ? null : (
          <Button variant="primary" onPress={() => loginDialog.open()}>
            {common.signIn}
          </Button>
        )}
      </section>
      {session.data ? <SignedInSessions /> : null}
      <section aria-labelledby="home-steps" className="flex flex-col gap-4">
        <h2 id="home-steps" className="text-xl font-semibold">
          {messages.stepsTitle}
        </h2>
        <ol className="flex list-decimal flex-col gap-3 pl-6">
          {messages.steps.map((step) => (
            <li key={step.title}>
              <p className="font-semibold">{step.title}</p>
              <p className="text-sm text-muted">{step.description}</p>
            </li>
          ))}
        </ol>
        <Link to="/help" className="self-start underline">
          {messages.helpLink}
        </Link>
      </section>
    </main>
  );
}

/**
 * ログイン中のAccountsユーザーの一覧と切替、別のユーザーの追加。
 */
function SignedInSessions() {
  const messages = useMessages(authMessages);
  const loginDialog = useLoginDialog();
  const deviceSessions = useDeviceSessions();
  const { state } = deviceSessions;

  if (state.status === "loading") return <LoadingState />;
  if (state.status === "failed") return <ErrorText>{messages.sessionsLoadFailed}</ErrorText>;
  return (
    <DeviceSessionList
      sessions={state.sessions}
      currentSessionId={state.currentSessionId}
      switchingToken={deviceSessions.switchingToken}
      hasSwitched={deviceSessions.hasSwitched}
      hasSwitchFailed={deviceSessions.hasSwitchFailed}
      onSwitch={(sessionToken) => void deviceSessions.switchSession(sessionToken)}
      onAddUser={() => loginDialog.open()}
    />
  );
}
