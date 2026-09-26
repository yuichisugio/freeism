import { Avatar, Description, Dropdown, Header, Label, Separator } from "@heroui/react";

import { commonMessages } from "../../../lib/i18n/common-messages";
import { useMessages } from "../../../lib/i18n/i18n-provider";
import { useAccountSwitcher } from "../hooks/use-account-switcher";
import { useDeviceSessions } from "../hooks/use-device-sessions";
import { useLoginDialog } from "../hooks/use-login-dialog";
import { authMessages } from "../messages";

/**
 * ログイン中の現在のユーザー。
 */
export type CurrentUser = {
  sessionToken: string;
  displayName: string;
};

const addAccountKey = "add-account";
const signOutKey = "sign-out";
const sessionKeyPrefix = "session:";

/**
 * ヘッダー右のアカウントのメニュー。
 * 現在のユーザーのアイコン（表示名の頭文字）から開き、このブラウザーでログイン中のユーザーの一覧（現在のユーザーを示す）と切替、「アカウントを追加」、現在のユーザーの「ログアウト」を並べる。
 * @see ../../../../../docs/specification/v0.1/main.ja.md
 * @see ../../app-shell/components/app-header.test.tsx
 */
export function AccountMenu({ currentUser }: { currentUser: CurrentUser }) {
  const messages = useMessages(authMessages);
  const common = useMessages(commonMessages);
  const deviceSessions = useDeviceSessions();
  const loginDialog = useLoginDialog();
  const switcher = useAccountSwitcher();
  const sessions = deviceSessions.status === "loaded" ? deviceSessions.sessions : [];
  const currentSessionId = deviceSessions.status === "loaded" ? deviceSessions.currentSessionId : null;

  /**
   * メニューの項目（react-ariaの`Key`）ごとの操作。
   * 現在のユーザーの行は切り替えずにメニューを閉じる。
   */
  const handleAction = (key: string | number) => {
    if (key === addAccountKey) {
      loginDialog.open();
    } else if (key === signOutKey) {
      void switcher.signOut(currentUser.sessionToken);
    } else {
      const target = sessions.find((session) => `${sessionKeyPrefix}${session.sessionId}` === key);
      if (target !== undefined && target.sessionId !== currentSessionId) {
        void switcher.switchTo(target);
      }
    }
  };

  return (
    <div className="flex items-center gap-2">
      {switcher.failure === null ? null : (
        <span role="alert" className="text-sm text-danger">
          {switcher.failure === "switch" ? messages.switchFailed : messages.signOutFailed}
        </span>
      )}
      <Dropdown>
        <Dropdown.Trigger aria-label={messages.accountMenuLabel(currentUser.displayName)} className="rounded-full">
          <UserAvatar displayName={currentUser.displayName} />
        </Dropdown.Trigger>
        <Dropdown.Popover placement="bottom end">
          <Dropdown.Menu onAction={handleAction}>
            <Dropdown.Section>
              <Header>{messages.sessionsTitle}</Header>
              {deviceSessions.status === "loaded" ? null : (
                <Dropdown.Item id="sessions-status" isDisabled>
                  <Label>{deviceSessions.status === "loading" ? common.loading : messages.sessionsLoadFailed}</Label>
                </Dropdown.Item>
              )}
              {sessions.map((session) => {
                const isCurrent = session.sessionId === currentSessionId;
                return (
                  <Dropdown.Item
                    key={session.sessionId}
                    id={`${sessionKeyPrefix}${session.sessionId}`}
                    textValue={session.displayName}
                    className={isCurrent ? "bg-default" : undefined}
                  >
                    <UserAvatar displayName={session.displayName} />
                    <div className="flex min-w-0 flex-col">
                      <Label className={isCurrent ? "font-semibold" : undefined}>{session.displayName}</Label>
                      <Description className="break-all">
                        {isCurrent ? `${messages.currentUser} · ` : ""}
                        {session.accountsUserId}
                      </Description>
                    </div>
                  </Dropdown.Item>
                );
              })}
            </Dropdown.Section>
            <Separator />
            <Dropdown.Section>
              <Dropdown.Item id={addAccountKey} textValue={messages.addAccount}>
                <Label>{messages.addAccount}</Label>
              </Dropdown.Item>
            </Dropdown.Section>
            <Separator />
            <Dropdown.Section>
              <Dropdown.Item id={signOutKey} textValue={messages.signOut} variant="danger">
                <Label>{messages.signOut}</Label>
              </Dropdown.Item>
            </Dropdown.Section>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    </div>
  );
}

/**
 * 表示名の頭文字のアイコン。
 */
function UserAvatar({ displayName }: { displayName: string }) {
  const initial = Array.from(displayName)[0]?.toUpperCase() ?? "";
  return (
    <Avatar size="sm" aria-hidden="true">
      <Avatar.Fallback>{initial}</Avatar.Fallback>
    </Avatar>
  );
}
