import { Button, Card, Chip } from "@heroui/react";
import { Link } from "@tanstack/react-router";

import { useMessages } from "../../../lib/i18n/i18n-provider";
import { ErrorText, SuccessNotice } from "../../app-shell/components/status-messages";
import type { DeviceSessionSummary } from "../hooks/use-device-sessions";
import { authMessages } from "../messages";

type DeviceSessionListProps = {
  sessions: DeviceSessionSummary[];
  currentSessionId: string | null;
  switchingToken: string | null;
  hasSwitched: boolean;
  hasSwitchFailed: boolean;
  onSwitch: (sessionToken: string) => void;
  onAddUser: () => void;
};

/**
 * このブラウザーでログイン中のAccountsユーザーの一覧と切替、別のAccountsユーザーの追加。
 * 現在のセッションは「現在のセッション」のテキストで示す。
 */
export function DeviceSessionList({
  sessions,
  currentSessionId,
  switchingToken,
  hasSwitched,
  hasSwitchFailed,
  onSwitch,
  onAddUser,
}: DeviceSessionListProps) {
  const messages = useMessages(authMessages);
  return (
    <Card>
      <Card.Header>
        <h2 className="text-lg font-semibold">{messages.sessionsTitle}</h2>
      </Card.Header>
      <Card.Content className="flex flex-col gap-3">
        {hasSwitched ? <SuccessNotice>{messages.switched}</SuccessNotice> : null}
        {hasSwitchFailed ? <ErrorText>{messages.switchFailed}</ErrorText> : null}
        <ul className="flex flex-col divide-y divide-default">
          {sessions.map((session) => (
            <li key={session.sessionId} className="flex flex-wrap items-center gap-3 py-2">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium break-all">{session.displayName}</span>
                <span className="text-sm text-muted break-all">
                  {messages.accountsUserId}: {session.accountsUserId}
                </span>
              </div>
              {session.sessionId === currentSessionId ? (
                <Chip color="success" size="sm">
                  {messages.currentSession}
                </Chip>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  aria-label={messages.switchToLabel(session.displayName)}
                  isDisabled={switchingToken !== null}
                  onPress={() => onSwitch(session.sessionToken)}
                >
                  {session.sessionToken === switchingToken ? messages.switching : messages.switchTo}
                </Button>
              )}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-4">
          <Link to="/account-links" className="underline">
            {messages.goToAccountLinks}
          </Link>
          <Button size="sm" variant="outline" onPress={onAddUser}>
            {messages.signInAnotherUser}
          </Button>
        </div>
      </Card.Content>
    </Card>
  );
}
